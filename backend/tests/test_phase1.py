"""Offline tests. Public upstream blinded-recipient fixture; never a payment target."""
import concurrent.futures
import contextlib
import importlib
import io
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

import rgb_lib as rgb
import booking_store
import payment_auth
import payment_store as store
import rgb_payments as payments
import wallet_runtime
from fastapi import HTTPException

# Public recipient fixture from official RGB-Tools/rgb-lib tests, not a live wallet.
BLIND = 'utxob:tjVmHbI2-U0_umHn-bU4cmP6-l3VW00H-ewoi2uz-XZG6O3i-wUFBW'
ENDPOINT = 'rpcs://proxy.example.invalid'


def invoice(amount='ae', network='sbc', expiry=4102444800, endpoint=ENDPOINT):
    return (f'rgb:{wallet_runtime.ASSET_ID[4:]}/~/{amount}/{network}:{BLIND}'
            f'?assignment_name=assetOwner&expiry={expiry}&endpoints={endpoint}')


class ForbiddenWalletPath:
    def __truediv__(self, other):
        raise AssertionError("Live wallet secret access forbidden")


class Phase1Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for target in ['booking_store.DB_PATH', 'payment_store.DB_PATH']:
            self.enterContext(patch(target, self.root / 'test.sqlite3'))
        self.enterContext(patch.dict(os.environ, {'RUEDA_RGB_ALLOWED_TRANSPORTS': ENDPOINT}))
        self.enterContext(patch('rgb_lib.Wallet', side_effect=AssertionError('Live wallet forbidden')))
        self.enterContext(patch('wallet_runtime.WALLET_DIR', ForbiddenWalletPath()))
        self.api = self.root / 'api-test-key'
        self.operator = self.root / 'operator-test-key'
        # Synthetic, temporary test authentication values only.
        self.api.write_text('concierge-test-only')
        self.operator.write_text('operator-test-only')
        self.enterContext(patch('payment_auth.KEY_FILE', self.api))
        self.enterContext(patch('payment_auth.OPERATOR_KEY_FILE', self.operator))
        booking_store.initialize_database()

    def booking(self, amount=1, asset='RUEDA', status='approved'):
        import uuid
        key = str(uuid.uuid4())
        with sqlite3.connect(store.DB_PATH) as c:
            c.execute('INSERT INTO bookings VALUES (?, ?, ?, ?, ?, ?)',
                      (key, 'city_ride', amount, asset, status, 'not_started'))
        return key

    def proposal(self):
        return store.create_payment_request(self.booking(), invoice())

    def test_real_installed_invoice_parser(self):
        data = rgb.Invoice(invoice()).invoice_data()
        self.assertEqual(data.network, rgb.BitcoinNetwork.SIGNET_CUSTOM)
        self.assertEqual(data.assignment.amount, 1)
        self.assertEqual(data.asset_id, wallet_runtime.ASSET_ID)
        self.assertEqual(rgb.RecipientInfo(data.recipient_id).recipient_type(), rgb.RecipientType.BLIND)
        self.assertEqual(payments.validate_invoice(invoice(), 1).expires_at, 4102444800)

    def test_complete_approval_stays_disabled_and_private(self):
        row = self.proposal()
        self.assertEqual(row['status'], 'pending_approval')
        result = store.approve_payment_request(row['request_id'], row['approval_digest'])
        self.assertEqual(result['status'], 'approved')
        self.assertFalse(result['payments_enabled'])
        self.assertFalse(result['payment_sent'])
        self.assertNotIn('invoice', result)
        self.assertNotIn('recipient_id', result)

    def test_duplicate_approval_rejected(self):
        row = self.proposal()
        store.approve_payment_request(row['request_id'], row['approval_digest'])
        with self.assertRaises(ValueError):
            store.approve_payment_request(row['request_id'], row['approval_digest'])

    def test_wrong_digest_and_unknown_request(self):
        row = self.proposal()
        for digest in ['0'*64, '', 'é'*64]:
            with self.subTest(digest_length=len(digest)), self.assertRaises(ValueError):
                store.approve_payment_request(row['request_id'], digest)
        with self.assertRaises(ValueError):
            store.approve_payment_request('unknown', row['approval_digest'])

    def test_all_bound_payment_fields_immutable(self):
        row = self.proposal()
        changes = dict(request_id='other', booking_id='other', invoice='changed',
                       recipient_id='changed', amount=2, asset='OTHER', asset_id='changed',
                       network='other', booking_snapshot='changed', approval_digest='0'*64)
        for field, value in changes.items():
            with self.subTest(field=field), sqlite3.connect(store.DB_PATH) as c:
                with self.assertRaises(sqlite3.IntegrityError):
                    c.execute(f'UPDATE {store.TABLE} SET {field}=? WHERE request_id=?',
                              (value, row['request_id']))
        with sqlite3.connect(store.DB_PATH) as c, self.assertRaises(sqlite3.IntegrityError):
            c.execute(f'DELETE FROM {store.TABLE}')

    def test_booking_changes_and_deletion_rejected(self):
        row = self.proposal()
        for field,value in [('amount',2),('asset','OTHER'),('ride_type','other'),
                            ('status','awaiting_approval'),('payment_status','started'),('booking_id','other')]:
            with self.subTest(field=field), sqlite3.connect(store.DB_PATH) as c:
                with self.assertRaises(sqlite3.IntegrityError):
                    c.execute(f'UPDATE bookings SET {field}=? WHERE booking_id=?', (value,row['booking_id']))
        with sqlite3.connect(store.DB_PATH) as c, self.assertRaises(sqlite3.IntegrityError):
            c.execute('DELETE FROM bookings WHERE booking_id=?',(row['booking_id'],))

    def test_duplicate_booking_and_invoice(self):
        row = self.proposal()
        for booking_id, value in [(row['booking_id'], invoice(expiry=4102444801)),
                                  (self.booking(), invoice())]:
            with self.assertRaises(ValueError):
                store.create_payment_request(booking_id, value)

    def test_concurrent_approvals_only_one_wins(self):
        row = self.proposal()
        def approve(_):
            try:
                store.approve_payment_request(row['request_id'], row['approval_digest'])
                return True
            except ValueError:
                return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            self.assertEqual(sorted(executor.map(approve, range(2))), [False, True])

    def test_recipient_cannot_be_reused_with_different_invoice(self):
        self.proposal()
        with self.assertRaises(ValueError):
            store.create_payment_request(self.booking(), invoice(expiry=4102444801))

    def test_expiry_boundary_and_no_expiry(self):
        with patch('rgb_payments.time.time', return_value=4102444800):
            with self.assertRaises(ValueError):
                payments.validate_invoice(invoice(), 1)
        with self.assertRaises(ValueError):
            payments.validate_invoice(invoice().replace('&expiry=4102444800', ''), 1)

    def test_unsupported_schema_recipient_assignment_and_amount(self):
        original = rgb.Invoice(invoice()).invoice_data()
        for field,value in [('asset_schema',rgb.AssetSchema.UDA),
                            ('assignment',rgb.Assignment.NON_FUNGIBLE()),
                            ('assignment',rgb.Assignment.FUNGIBLE(11))]:
            with self.subTest(field=field):
                old=getattr(original,field)
                setattr(original,field,value)
                with patch('rgb_payments.rgb.Invoice',return_value=SimpleNamespace(invoice_data=lambda:original)):
                    with self.assertRaises(ValueError):payments.validate_invoice(invoice(),1)
                setattr(original,field,old)
        with patch('rgb_payments.rgb.RecipientInfo',return_value=SimpleNamespace(recipient_type=lambda:rgb.RecipientType.WITNESS)):
            with self.assertRaises(ValueError):payments.validate_invoice(invoice(),1)
        original.assignment=rgb.Assignment.FUNGIBLE(10)
        with patch('rgb_payments.rgb.Invoice',return_value=SimpleNamespace(invoice_data=lambda:original)):
            payments.validate_invoice(invoice(),10)

    def test_no_transfer_execution_or_refresh_calls_in_backend(self):
        import ast
        forbidden={'send','send_begin','send_end','send_init','send_btc','refresh',
                   'provide_out_of_band_ack','provide_out_of_band_consignment'}
        for path in Path(__file__).resolve().parents[1].glob('*.py'):
            for node in ast.walk(ast.parse(path.read_text())):
                if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute):
                    self.assertNotIn(node.func.attr,forbidden,path.name)

    def test_invoice_revalidated_at_approval(self):
        row = self.proposal()
        with patch('rgb_payments.time.time', return_value=4102444801), self.assertRaises(ValueError):
            store.approve_payment_request(row['request_id'], row['approval_digest'])
        with patch.dict(os.environ, {'RUEDA_RGB_ALLOWED_TRANSPORTS': ''}), self.assertRaises(ValueError):
            store.approve_payment_request(row['request_id'], row['approval_digest'])

    def test_modified_digest_detected_even_without_trigger(self):
        row = self.proposal()
        with sqlite3.connect(store.DB_PATH) as c:
            c.execute('DROP TRIGGER payment_v1_immutable')
            c.execute(f'UPDATE {store.TABLE} SET invoice=?', (invoice(expiry=4102444801),))
        with self.assertRaises(ValueError):
            store.approve_payment_request(row['request_id'], row['approval_digest'])

    def test_invalid_invoices(self):
        cases = ['placeholder', 'rgb:placeholder', invoice()+' ', invoice(network='bcrt'),
                 invoice(network='sb'), invoice(expiry=1), invoice(amount='~'),
                 invoice().replace(wallet_runtime.ASSET_ID[4:], '~'),
                 invoice(endpoint='rpcs://unapproved.example.invalid'),
                 invoice()+'&unknown=value']
        for value in cases:
            with self.subTest(case=cases.index(value)), self.assertRaises(ValueError):
                payments.validate_invoice(value, 1)
        with self.assertRaises(ValueError):
            payments.validate_invoice(invoice(), 2)

    def test_integer_cap_and_boundaries(self):
        for amount in [True, False, 0, -1, 11, 1.0, '1', None]:
            with self.subTest(amount_type=type(amount).__name__), self.assertRaises(ValueError):
                payments.validate_amount(amount)
        for amount in [1,10]:
            payments.validate_amount(amount)
        for amount in [0,11,1.5]:
            with self.assertRaises(ValueError):
                store.create_payment_request(self.booking(amount), invoice())

    def test_unapproved_unpaid_supported_booking_required(self):
        for key in ['missing',self.booking(status='awaiting_approval'),self.booking(asset='OTHER')]:
            with self.assertRaises(ValueError):
                store.create_payment_request(key, invoice())
        key=self.booking()
        with sqlite3.connect(store.DB_PATH) as c:
            c.execute("UPDATE bookings SET payment_status='settled' WHERE booking_id=?", (key,))
        with self.assertRaises(ValueError):
            store.create_payment_request(key, invoice())

    def test_fake_wallet_readiness_without_live_access(self):
        class FakeWallet:
            def get_asset_balance(self, asset_id):
                self.asserted_asset=asset_id
                return SimpleNamespace(settled=7,spendable=7)
            def __getattr__(self,name):
                raise AssertionError('Forbidden wallet method')
        with patch('rgb_payments.wallet_session',return_value=contextlib.nullcontext(FakeWallet())):
            result=payments.get_payment_readiness()
        self.assertFalse(result['payments_enabled'])
        self.assertFalse(result['blockchain_sync_performed'])

    def test_keys_remain_separate_and_fail_closed(self):
        self.assertTrue(payment_auth.require_payment_api_key('concierge-test-only'))
        self.assertTrue(payment_auth.require_payment_operator_key('operator-test-only'))
        for fn,value in [(payment_auth.require_payment_api_key,'operator-test-only'),
                         (payment_auth.require_payment_operator_key,'concierge-test-only'),
                         (payment_auth.require_payment_operator_key,None),
                         (payment_auth.require_payment_operator_key,'é')]:
            with self.assertRaises(HTTPException) as e:fn(value)
            self.assertEqual(e.exception.status_code,401)
        self.operator.write_text('')
        with self.assertRaises(HTTPException) as e:
            payment_auth.require_payment_operator_key('anything')
        self.assertEqual(e.exception.status_code,503)
        self.operator.unlink()
        with self.assertRaises(HTTPException) as e:
            payment_auth.require_payment_operator_key('anything')
        self.assertEqual(e.exception.status_code,503)

    def test_parser_errors_are_sanitized_and_not_printed(self):
        output=io.StringIO()
        with patch('rgb_payments.rgb.Invoice',side_effect=RuntimeError('sensitive-native-error')):
            with contextlib.redirect_stdout(output),contextlib.redirect_stderr(output):
                with self.assertRaisesRegex(ValueError,'^Invalid RGB invoice$'):
                    payments.validate_invoice(invoice(),1)
        self.assertEqual(output.getvalue(),'')

    def test_legacy_request_cannot_be_approved(self):
        store.initialize_payment_database()
        with sqlite3.connect(store.DB_PATH) as c:
            c.execute('CREATE TABLE payment_requests (request_id TEXT, status TEXT)')
            c.execute("INSERT INTO payment_requests VALUES ('legacy','approved')")
        with self.assertRaises(ValueError):
            store.approve_payment_request('legacy','0'*64)

    def test_imports_and_endpoint_auth_contract(self):
        from fastapi.routing import APIRoute
        main=importlib.import_module('main')
        routes={r.path:r for r in main.app.routes if isinstance(r,APIRoute)}
        for path,fn in [('/payments/requests',payment_auth.require_payment_api_key),
                        ('/payments/requests/{request_id}/approve',payment_auth.require_payment_operator_key)]:
            self.assertIn(fn,[d.call for d in routes[path].dependant.dependencies])
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            main.PaymentRequestInput(booking_id='test',recipient_id='placeholder')
        with self.assertRaises(ValidationError):
            main.PaymentApprovalInput(approval_digest='0'*64,amount=2)


if __name__=='__main__':unittest.main()
