"""All preflight IO is fake or temporary; live wallet/network access is forbidden."""
import asyncio
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3
from types import SimpleNamespace as NS
import unittest
from unittest.mock import patch
import rgb_lib as rgb
import payment_preflight as preflight
import payment_store as store
import wallet_runtime
import test_phase1 as phase1


def unspent(amount=None, btc=20000):
    allocations=[] if amount is None else [NS(asset_id=wallet_runtime.ASSET_ID,
                                           assignment=rgb.Assignment.FUNGIBLE(amount),settled=True)]
    return NS(utxo=NS(exists=True,colorable=True,btc_amount=btc,outpoint=NS(txid='a'*64,vout=0 if amount is not None else 1)),
              pending_blinded=0,rgb_allocations=allocations)


class FakeWallet:
    def __init__(self):
        self.calls=[]
        self.asset=NS(settled=10,spendable=10)
        self.btc=NS(colored=NS(settled=30000,spendable=30000),vanilla=NS(settled=0,spendable=0))
        self.utxos=[unspent(10),unspent()]
        self.transfers=[]
        self.asset_transfers={}
        self.assets=NS(nia=[NS(asset_id=wallet_runtime.ASSET_ID)],uda=[],cfa=[],ifa=[])
        self.transactions=[NS(txid='b'*64,confirmation_time=NS(height=1500,timestamp=1234))]
        self.network=rgb.BitcoinNetwork.SIGNET_CUSTOM
        self.fee=2.0
        self.fail=None
        self.on_sync=None
    def _call(self,name):
        self.calls.append(name)
        if self.fail==name:raise RuntimeError('private-native-error')
    def get_wallet_data(self):
        self._call('wallet_data');return NS(bitcoin_network=self.network)
    def list_assets(self,schemas):
        assert schemas==[]
        self._call('assets');return self.assets
    def list_transactions(self,online,skip_sync):
        assert online is None and skip_sync is True
        self._call('transactions');return self.transactions
    def list_transfers(self,asset_id):
        self._call('transfers')
        return self.transfers if asset_id is None else self.asset_transfers.get(asset_id,[])
    def go_online(self,options):
        assert options.skip_consistency_check is False
        assert options.indexer_url=='https://indexer.example.invalid/api'
        assert options.vanilla_sync_lookback==100
        self._call('online');return 'fake-online'
    def sync(self,online,options):
        assert online=='fake-online'
        assert options.strategy==rgb.SyncStrategy.FULL_SCAN
        name='sync_colored' if isinstance(options.keychain,rgb.SyncKeychain.COLORED) else 'sync_vanilla'
        self._call(name)
        if self.on_sync:self.on_sync()
    def get_asset_balance(self,asset_id):
        assert asset_id==wallet_runtime.ASSET_ID
        self._call('asset');return self.asset
    def get_fee_estimation(self,online,blocks):
        assert blocks==3
        self._call('fee');return self.fee
    def get_btc_balance(self,online,skip_sync):
        assert skip_sync is True
        self._call('btc');return self.btc
    def list_unspents(self,online,settled_only,skip_sync):
        assert settled_only is False and skip_sync is True
        self._call('utxos');return self.utxos
    def __getattr__(self,name):raise AssertionError('Forbidden wallet method: '+name)


class PreflightTests(unittest.TestCase):
    setUp_base=phase1.Phase1Tests.setUp
    booking=phase1.Phase1Tests.booking
    proposal=phase1.Phase1Tests.proposal

    def setUp(self):
        self.setUp_base()
        self.env={
            'RUEDA_RGB_NETWORK':'mutinynet',
            'RUEDA_RGB_INDEXER_URL':'https://indexer.example.invalid/api',
            'RUEDA_MUTINYNET_GENESIS_HASH':'1'*64,
            'RUEDA_MUTINYNET_CHECKPOINT_HEIGHT':'1000',
            'RUEDA_MUTINYNET_CHECKPOINT_HASH':'2'*64,
            'RUEDA_RGB_WALLET_DIR':str(self.root/'fake-wallet'),
            'RUEDA_RGB_FEE_RESERVE_SATS':'10000',
            'RUEDA_RGB_MAX_FEE_RATE_SAT_VB':'10',
            'RUEDA_RGB_PREFLIGHT_VBYTES':'1000',
        }
        self.enterContext(patch.dict(os.environ,self.env))
        self.enterContext(patch('urllib.request.OpenerDirector.open',side_effect=AssertionError('Live network forbidden')))
        self.wallet=FakeWallet()
        self.sessions=0
        self.urls=[]
        @contextmanager
        def session(directory):
            assert directory==self.root/'fake-wallet'
            self.sessions+=1
            yield self.wallet
        self.enterContext(patch('payment_preflight.wallet_session',session))
        self.enterContext(patch('payment_preflight._indexer_get',side_effect=self.indexer_get))
        row=self.proposal()
        self.row=store.approve_payment_request(row['request_id'],row['approval_digest'])

    def indexer_get(self,url):
        self.urls.append(url)
        answers={'/block-height/2000':'7'*64,
                 '/block-height/1500':'6'*64,
                 '/tx/'+('b'*64)+'/status':json.dumps({'confirmed':True,'block_height':1500,'block_hash':'6'*64,'block_time':1234}),
                 '/tx/'+('a'*64)+'/outspend/0':json.dumps({'spent':False}),
                 '/tx/'+('a'*64)+'/outspend/1':json.dumps({'spent':False}),
                 '/block-height/1990':'4'*64,
                 '/tx/'+('a'*64)+'/status':json.dumps({'confirmed':True,'block_height':1990,'block_hash':'4'*64}),
                 '/block-height/0':'1'*64,'/block-height/1000':'2'*64,'/blocks/tip/height':'2000'}
        for path,answer in answers.items():
            if url=='https://indexer.example.invalid/api'+path:return answer
        raise AssertionError('Unexpected indexer request')

    def run_preflight(self):
        return preflight.payment_preflight(self.row['request_id'],self.row['approval_digest'])

    def assert_error(self,code):
        with self.assertRaises(preflight.PreflightError) as result:self.run_preflight()
        self.assertEqual(result.exception.code,code)
        self.assertNotIn('private-native-error',str(result.exception))

    def test_success_synchronizes_both_keychains_and_stays_disabled(self):
        result=self.run_preflight()
        self.assertTrue(result['preflight_passed'])
        self.assertTrue(result['blockchain_sync_performed'])
        for key in ['payments_enabled','payment_sent','ready_to_execute','utxos_reserved',
                    'exact_transaction_fee_verified']:self.assertFalse(result[key])
        self.assertEqual(self.wallet.calls,['wallet_data','transactions','assets','transfers','transfers',
                                          'online','sync_colored','sync_vanilla','assets','transfers',
                                          'transfers','asset','fee','btc','utxos'])
        self.assertTrue(result['wallet_cached_chain_verified'])
        for secret_field in ['invoice','recipient_id','approval_digest','wallet_dir','indexer_url']:
            self.assertNotIn(secret_field,result)
        with sqlite3.connect(store.DB_PATH) as c:
            self.assertEqual(c.execute(f'SELECT status FROM {store.TABLE}').fetchone()[0],'approved')

    def test_missing_configuration_fails_before_wallet_access(self):
        for key in [*self.env,'RUEDA_RGB_ALLOWED_TRANSPORTS']:
            with self.subTest(key=key),patch.dict(os.environ):
                os.environ.pop(key,None)
                self.assert_error('preflight_configuration_required')
        self.assertEqual(self.sessions,0)
        self.assertEqual(self.urls,[])

    def test_malformed_configuration_and_wrong_library_version(self):
        changes={'RUEDA_RGB_NETWORK':'mainnet','RUEDA_RGB_INDEXER_URL':'http://indexer.invalid',
                 'RUEDA_MUTINYNET_CHECKPOINT_HEIGHT':'0','RUEDA_MUTINYNET_GENESIS_HASH':'invalid',
                 'RUEDA_RGB_WALLET_DIR':'relative','RUEDA_RGB_FEE_RESERVE_SATS':'-1',
                 'RUEDA_RGB_MAX_FEE_RATE_SAT_VB':'1001','RUEDA_RGB_PREFLIGHT_VBYTES':'0'}
        for key,value in changes.items():
            with self.subTest(key=key),patch.dict(os.environ,{key:value}):
                self.assert_error('preflight_configuration_required')
        with patch('payment_preflight.importlib.metadata.version',return_value='other'):
            self.assert_error('preflight_configuration_required')
        self.assertEqual(self.sessions,0)

    def test_wrong_genesis_checkpoint_or_lagging_tip(self):
        for suffix,value in [('/block-height/0','3'*64),('/block-height/1000','3'*64),
                             ('/blocks/tip/height','999'),('/blocks/tip/height','bad')]:
            original=self.indexer_get
            with self.subTest(suffix=suffix),patch('payment_preflight._indexer_get',
                    side_effect=lambda url: value if url.endswith(suffix) else original(url)):
                self.assert_error('indexer_network_mismatch')
        self.assertEqual(self.sessions,0)

    def test_indexer_unavailable_is_sanitized(self):
        with patch('payment_preflight._indexer_get',side_effect=preflight.PreflightError('indexer_verification_failed')):
            self.assert_error('indexer_verification_failed')
        self.assertEqual(self.sessions,0)

    def test_invalid_digest_unapproved_and_unknown_requests(self):
        original=self.row
        for row in [dict(original,approval_digest='0'*64),dict(original,request_id='missing')]:
            self.row=row;self.assert_error('approved_payment_invalid')
        self.row=original
        with sqlite3.connect(store.DB_PATH) as c:
            c.execute('DROP TRIGGER payment_v1_immutable')
            c.execute(f"UPDATE {store.TABLE} SET status='pending_approval'")
        self.assert_error('approved_payment_invalid')
        self.assertEqual(self.sessions,0)

    def test_tampered_invoice_and_booking(self):
        with sqlite3.connect(store.DB_PATH) as c:
            c.execute('DROP TRIGGER payment_v1_immutable')
            c.execute(f"UPDATE {store.TABLE} SET amount=2")
        self.assert_error('approved_payment_invalid')
        self.assertEqual(self.sessions,0)

    def test_expired_invoice_and_revoked_transport(self):
        with patch('rgb_payments.time.time',return_value=4102444801):
            self.assert_error('approved_payment_invalid')
        with patch.dict(os.environ,{'RUEDA_RGB_ALLOWED_TRANSPORTS':'rpcs://different.invalid'}):
            self.assert_error('approved_payment_invalid')
        self.assertEqual(self.sessions,0)

    def test_invoice_expires_during_sync(self):
        with patch('rgb_payments.time.time',return_value=1000) as clock:
            self.wallet.on_sync=lambda:setattr(clock,'return_value',4102444801)
            self.assert_error('approved_payment_invalid')

    def test_sync_and_wallet_failures_sanitized(self):
        for method in ['wallet_data','transactions','assets','online','sync_colored','sync_vanilla','transfers','asset','fee','btc','utxos']:
            with self.subTest(method=method):
                self.wallet.fail=method
                self.assert_error('wallet_preflight_failed')
        self.wallet.fail=None
        with patch('payment_preflight.wallet_session',side_effect=RuntimeError('private-native-error')):
            self.assert_error('wallet_preflight_failed')

    def test_wrong_wallet_network_and_pending_transfers(self):
        self.wallet.network=rgb.BitcoinNetwork.SIGNET
        self.assert_error('wallet_network_mismatch')
        self.wallet.network=rgb.BitcoinNetwork.SIGNET_CUSTOM
        for status in list(rgb.TransferStatus):
            if status not in [rgb.TransferStatus.SETTLED,rgb.TransferStatus.FAILED]:
                self.wallet.transfers=[NS(status=status)]
                self.assert_error('pending_transfers_require_separate_review')
        self.assertNotIn('online',self.wallet.calls)

    def test_insufficient_rueda(self):
        for balance in [NS(settled=0,spendable=10),NS(settled=10,spendable=0)]:
            self.wallet.asset=balance
            self.assert_error('insufficient_spendable_rueda')

    def test_insufficient_bitcoin_and_vanilla_does_not_substitute(self):
        self.wallet.btc.colored=NS(settled=0,spendable=0)
        self.wallet.btc.vanilla=NS(settled=100000,spendable=100000)
        self.assert_error('insufficient_bitcoin_fee_funds')

    def test_fee_policy(self):
        for fee in [0,-1,11,float('nan'),float('inf'),True]:
            self.wallet.fee=fee
            self.assert_error('fee_policy_not_satisfied')
        self.wallet.fee=2
        with patch.dict(os.environ,{'RUEDA_RGB_FEE_RESERVE_SATS':'1000'}):
            self.assert_error('fee_policy_not_satisfied')

    def test_required_utxos_and_pending_allocations(self):
        original=self.wallet.utxos
        for utxos in [[],[unspent(10)],[unspent()], [unspent(0),unspent()],
                      [unspent(10),unspent(btc=1000)]]:
            self.wallet.utxos=utxos;self.assert_error('required_utxos_unavailable')
        for change in ['pending_blinded','nonexistent','noncolorable','unsettled']:
            self.wallet.utxos=[unspent(10),unspent()]
            u=self.wallet.utxos[0]
            if change=='pending_blinded':u.pending_blinded=1
            elif change=='nonexistent':u.utxo.exists=False
            elif change=='noncolorable':u.utxo.colorable=False
            else:u.rgb_allocations[0].settled=False
            self.assert_error('required_utxos_unavailable')
        self.wallet.utxos=original

    def test_unconfirmed_or_wrong_block_utxos_fail_closed(self):
        for status in [{'confirmed':False},
                       {'confirmed':True,'block_height':1999,'block_hash':'4'*64},
                       {'confirmed':True,'block_height':1990,'block_hash':'5'*64}]:
            original=self.indexer_get
            with self.subTest(status=status),patch('payment_preflight._indexer_get',side_effect=lambda url:
                    json.dumps(status) if ('/tx/'+('a'*64)+'/status') in url else original(url)):
                self.assert_error('required_utxos_unavailable')

    def test_spent_or_unknown_outpoints_are_rejected(self):
        for status in [{'spent':True},{}, {'spent':'false'}]:
            original=self.indexer_get
            with self.subTest(status=status),patch('payment_preflight._indexer_get',side_effect=lambda url:
                    json.dumps(status) if '/outspend/' in url else original(url)):
                self.assert_error('required_utxos_unavailable')

    def test_invalid_utxo_status_response_fails_closed(self):
        original=self.indexer_get
        with patch('payment_preflight._indexer_get',side_effect=lambda url:
                   'invalid-json' if ('/tx/'+('a'*64)+'/status') in url else original(url)):
            self.assert_error('indexer_utxo_validation_failed')

    def test_network_rechecked_after_sync(self):
        calls=0
        def indexer(url):
            nonlocal calls
            if url.endswith('/block-height/1000'):
                calls+=1
                if calls>1:return '3'*64
            return self.indexer_get(url)
        with patch('payment_preflight._indexer_get',side_effect=indexer):
            self.assert_error('indexer_network_mismatch')

    def test_pending_transfer_appearing_during_sync_is_rejected(self):
        self.wallet.on_sync=lambda:setattr(self.wallet,'transfers',[NS(status=rgb.TransferStatus.WAITING_BROADCAST)])
        self.assert_error('pending_transfers_require_separate_review')
        self.assertNotIn('asset',self.wallet.calls)

    def test_shared_wallet_lock_serializes_and_releases(self):
        with patch('wallet_runtime.load_wallet',return_value=self.wallet) as loader:
            with wallet_runtime.wallet_session(self.root):
                with self.assertRaises(RuntimeError):
                    with wallet_runtime.wallet_session(self.root):pass
            with wallet_runtime.wallet_session(self.root):pass
            self.assertEqual(loader.call_count,2)

    def test_beta7_pending_asset_filters_cannot_bypass_guard(self):
        # Match beta.7: None only lists unknown-asset transfers, not RUEDA or other assets.
        self.wallet.transfers=[]
        for schema in ['nia','uda','cfa','ifa']:
            with self.subTest(schema=schema):
                other='other-'+schema
                setattr(self.wallet.assets,schema,[NS(asset_id=wallet_runtime.ASSET_ID),NS(asset_id=other)])
                for asset in [wallet_runtime.ASSET_ID,other]:
                    self.wallet.asset_transfers={asset:[NS(status=rgb.TransferStatus.WAITING_COUNTERPARTY)]}
                    self.assert_error('pending_transfers_require_separate_review')
        self.assertNotIn('online',self.wallet.calls)

    def test_missing_cached_chain_anchor_fails_before_online(self):
        for transactions in [[],[NS(txid='b'*64,confirmation_time=None)]]:
            self.wallet.transactions=transactions
            self.assert_error('wallet_chain_identity_unverified')
        self.assertNotIn('online',self.wallet.calls)

    def test_cached_wallet_history_must_match_pinned_chain(self):
        for cached in [NS(height=1499,timestamp=1234),NS(height=1500,timestamp=9999)]:
            self.wallet.transactions=[NS(txid='b'*64,confirmation_time=cached)]
            self.assert_error('wallet_chain_identity_mismatch')
        self.assertNotIn('online',self.wallet.calls)

    def test_cached_wallet_transaction_absent_from_indexer_fails_closed(self):
        original=self.indexer_get
        with patch('payment_preflight._indexer_get',side_effect=lambda url:
                   json.dumps({'confirmed':False}) if '/tx/'+('b'*64) in url else original(url)):
            self.assert_error('wallet_chain_identity_mismatch')
        self.assertNotIn('online',self.wallet.calls)

    def test_confirmation_depth_exact_boundary(self):
        config=preflight.configuration()
        tip=preflight.ChainTip(2000,'7'*64)
        for height,valid in [(1998,True),(1999,False),(2000,False),(2001,False),(0,False),(True,False)]:
            with self.subTest(height=height),patch('payment_preflight._indexer_get',side_effect=lambda url:
                    json.dumps({'confirmed':True,'block_height':height,'block_hash':'4'*64}) if url.endswith('/status')
                    else json.dumps({'spent':False}) if '/outspend/' in url else '4'*64):
                self.assertEqual(preflight._confirmed_utxo(unspent(),config,tip),valid)

    def test_same_height_reorg_rejected_after_funds_checks(self):
        original=self.indexer_get
        def indexer(url):
            if url.endswith('/block-height/2000') and 'utxos' in self.wallet.calls:
                return '8'*64
            return original(url)
        with patch('payment_preflight._indexer_get',side_effect=indexer):
            self.assert_error('indexer_chain_changed')

    def test_indexer_tip_extension_on_same_chain_is_allowed(self):
        original=self.indexer_get
        def indexer(url):
            if 'utxos' in self.wallet.calls:
                if url.endswith('/blocks/tip/height'):return '2001'
                if url.endswith('/block-height/2001'):return '8'*64
            return original(url)
        with patch('payment_preflight._indexer_get',side_effect=indexer):
            self.assertTrue(self.run_preflight()['preflight_passed'])

    def test_indexer_status_http_failure_propagates_sanitized(self):
        original=self.indexer_get
        def indexer(url):
            if '/outspend/' in url:raise preflight.PreflightError('indexer_verification_failed')
            return original(url)
        with patch('payment_preflight._indexer_get',side_effect=indexer):
            self.assert_error('indexer_verification_failed')

    def test_installed_beta7_signature_contract(self):
        import importlib.metadata
        self.assertEqual(importlib.metadata.version('rgb-lib'),'0.3.0b7')
        # Read generated installed signatures without constructing a real wallet.
        source=Path(rgb.__file__).parent/'rgb_lib.py'
        import ast
        tree=ast.parse(source.read_text())
        wallet=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Wallet')
        signatures={n.name:[a.arg for a in n.args.args] for n in wallet.body if isinstance(n,ast.FunctionDef)}
        self.assertEqual(signatures['list_transfers'],['self','asset_id'])
        self.assertEqual(signatures['sync'],['self','online','options'])
        self.assertEqual(signatures['get_btc_balance'],['self','online','skip_sync'])
        self.assertEqual(signatures['list_unspents'],['self','online','settled_only','skip_sync'])

    def test_operator_endpoint_auth_and_sanitized_responses(self):
        import main
        async def call(headers):
            sent=[]
            body=json.dumps({'approval_digest':self.row['approval_digest']}).encode()
            scope={'type':'http','asgi':{'version':'3.0'},'http_version':'1.1',
                   'method':'POST','scheme':'http','path':f"/payments/requests/{self.row['request_id']}/preflight",
                   'raw_path':b'/','query_string':b'','root_path':'',
                   'headers':[(b'content-type',b'application/json'),*headers],
                   'client':('127.0.0.1',1),'server':('test',80)}
            async def receive():return {'type':'http.request','body':body,'more_body':False}
            async def send(message):sent.append(message)
            await main.app(scope,receive,send)
            return sent[0]['status'],json.loads(b''.join(m.get('body',b'') for m in sent[1:]))
        for headers in [[],[(b'x-payment-api-key',b'concierge-test-only')],
                        [(b'x-payment-operator-key',b'concierge-test-only')]]:
            status,_=asyncio.run(call(headers));self.assertEqual(status,401)
        self.assertEqual(self.sessions,0)
        status,result=asyncio.run(call([(b'x-payment-operator-key',b'operator-test-only')]))
        self.assertEqual(status,200);self.assertFalse(result['payments_enabled'])
        self.wallet.fail='sync_colored'
        status,result=asyncio.run(call([(b'x-payment-operator-key',b'operator-test-only')]))
        self.assertEqual(status,503);self.assertEqual(result,{'detail':'wallet_preflight_failed'})


if __name__=='__main__':unittest.main()
