"""Operator preflight only: sync/read APIs, never execution or transfer refresh."""
from dataclasses import dataclass
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import time
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, build_opener, ProxyHandler, Request
import rgb_lib as rgb
import payment_store
from wallet_runtime import ASSET_ID, wallet_session


class PreflightError(Exception):
    def __init__(self, code, http_status=503):
        self.code = code
        self.http_status = http_status
        super().__init__(code)


@dataclass(frozen=True)
class Config:
    indexer_url: str
    genesis_hash: str
    checkpoint_height: int
    checkpoint_hash: str
    wallet_dir: Path
    fee_reserve: int
    max_fee_rate: int
    estimated_vbytes: int


def configuration():
    try:
        if importlib.metadata.version('rgb-lib') != '0.3.0b7':
            raise ValueError()
        if os.environ['RUEDA_RGB_NETWORK'] != 'mutinynet':
            raise ValueError()
        url = os.environ['RUEDA_RGB_INDEXER_URL']
        parsed = urlsplit(url)
        if (parsed.scheme != 'https' or not parsed.hostname or parsed.username
                or parsed.password or parsed.query or parsed.fragment
                or any(c.isspace() for c in url)):
            raise ValueError()
        genesis = os.environ['RUEDA_MUTINYNET_GENESIS_HASH']
        checkpoint = os.environ['RUEDA_MUTINYNET_CHECKPOINT_HASH']
        if not all(re.fullmatch('[0-9a-f]{64}', h) and h != '0'*64 for h in (genesis, checkpoint)):
            raise ValueError()
        def integer(name, low, high):
            value = os.environ[name]
            if not re.fullmatch('[1-9][0-9]*', value):
                raise ValueError()
            value = int(value)
            if not low <= value <= high:
                raise ValueError()
            return value
        height = integer('RUEDA_MUTINYNET_CHECKPOINT_HEIGHT', 1, 100_000_000)
        reserve = integer('RUEDA_RGB_FEE_RESERVE_SATS', 1000, 1_000_000)
        fee_rate = integer('RUEDA_RGB_MAX_FEE_RATE_SAT_VB', 1, 1000)
        vbytes = integer('RUEDA_RGB_PREFLIGHT_VBYTES', 1000, 10000)
        directory = Path(os.environ['RUEDA_RGB_WALLET_DIR'])
        if not directory.is_absolute():
            raise ValueError()
        if not os.environ.get('RUEDA_RGB_ALLOWED_TRANSPORTS', '').strip():
            raise ValueError()
        return Config(url.rstrip('/'), genesis, height, checkpoint, directory, reserve, fee_rate, vbytes)
    except (KeyError, ValueError, importlib.metadata.PackageNotFoundError):
        raise PreflightError('preflight_configuration_required') from None


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise PreflightError('indexer_verification_failed')


def _indexer_get(url):
    # Fixed GET-only Esplora endpoints; no credentials, proxies or redirect following.
    opener = build_opener(ProxyHandler({}), _NoRedirect())
    try:
        with opener.open(Request(url, method='GET'), timeout=10) as response:
            data = response.read(257)
            if response.status != 200 or len(data) > 256:
                raise ValueError()
            return data.decode('ascii').strip()
    except Exception:
        raise PreflightError('indexer_verification_failed') from None


@dataclass(frozen=True)
class ChainTip:
    height: int
    block_hash: str


def verify_indexer(config):
    genesis = _indexer_get(config.indexer_url + '/block-height/0')
    checkpoint = _indexer_get(config.indexer_url + f'/block-height/{config.checkpoint_height}')
    tip = _indexer_get(config.indexer_url + '/blocks/tip/height')
    if (genesis != config.genesis_hash or checkpoint != config.checkpoint_hash
            or not re.fullmatch('[0-9]{1,9}', tip) or int(tip) < config.checkpoint_height):
        raise PreflightError('indexer_network_mismatch')
    tip_hash = _indexer_get(config.indexer_url + f'/block-height/{int(tip)}')
    if not re.fullmatch('[0-9a-f]{64}', tip_hash):
        raise PreflightError('indexer_network_mismatch')
    return ChainTip(int(tip), tip_hash)


def _same_chain(config, earlier, later):
    if (later.height < earlier.height or
            _indexer_get(config.indexer_url + f'/block-height/{earlier.height}') != earlier.block_hash):
        raise PreflightError('indexer_chain_changed')


def _approved(request_id, digest):
    try:
        return payment_store.get_approved_payment(request_id, digest)
    except ValueError:
        raise PreflightError('approved_payment_invalid', 409) from None
    except Exception:
        raise PreflightError('payment_validation_unavailable') from None


def _no_pending_transfers(wallet):
    # beta.7 None means unassigned asset, NOT all assets. Do not use newer API semantics.
    assets = wallet.list_assets([])
    asset_ids = {ASSET_ID}
    for schema in ('nia', 'uda', 'cfa', 'ifa'):
        asset_ids.update(a.asset_id for a in (getattr(assets, schema) or []))
    terminal = {rgb.TransferStatus.SETTLED, rgb.TransferStatus.FAILED}
    for asset_id in [None, *sorted(asset_ids)]:
        if any(t.status not in terminal for t in wallet.list_transfers(asset_id)):
            raise PreflightError('pending_transfers_require_separate_review', 409)


def _transaction_status(txid, config, tip, depth=3):
    try:
        status = json.loads(_indexer_get(config.indexer_url + f'/tx/{txid}/status'))
        height = status.get('block_height')
        block_hash = status.get('block_hash')
        if (status.get('confirmed') is not True or type(height) is not int
                or not 1 <= height <= tip.height - depth + 1
                or not isinstance(block_hash, str) or not re.fullmatch('[0-9a-f]{64}', block_hash)):
            return None
        if _indexer_get(config.indexer_url + f'/block-height/{height}') != block_hash:
            return None
        return status
    except (ValueError, TypeError, AttributeError):
        raise PreflightError('indexer_utxo_validation_failed') from None


def _verify_wallet_chain(wallet, config, tip):
    # WalletData has no signet challenge or chain checkpoint getter. Verify existing
    # cached confirmed wallet history against the pinned chain BEFORE go_online syncs it.
    anchor_found = False
    for transaction in wallet.list_transactions(None, True):
        cached = transaction.confirmation_time
        if cached is None:
            continue
        if (not isinstance(transaction.txid, str)
                or not re.fullmatch('[0-9a-f]{64}', transaction.txid)
                or type(cached.height) is not int or type(cached.timestamp) is not int):
            raise PreflightError('wallet_chain_identity_unverified', 409)
        status = _transaction_status(transaction.txid, config, tip, depth=1)
        if (status is None or status['block_height'] != cached.height
                or type(status.get('block_time')) is not int
                or status.get('block_time') != cached.timestamp):
            raise PreflightError('wallet_chain_identity_mismatch', 409)
        if cached.height <= tip.height - 2:
            anchor_found = True
    if not anchor_found:
        raise PreflightError('wallet_chain_identity_unverified', 409)


def _confirmed_utxo(unspent, config, tip):
    txid = unspent.utxo.outpoint.txid
    vout = unspent.utxo.outpoint.vout
    if (not isinstance(txid, str) or not re.fullmatch('[0-9a-f]{64}', txid)
            or type(vout) is not int or not 0 <= vout <= 0xffffffff):
        return False
    try:
        if _transaction_status(txid, config, tip) is None:
            return False
        outspend = json.loads(_indexer_get(config.indexer_url + f'/tx/{txid}/outspend/{vout}'))
        return outspend.get('spent') is False
    except (ValueError, TypeError, AttributeError):
        raise PreflightError('indexer_utxo_validation_failed') from None


def _funds(wallet, online, amount, config, tip):
    asset = wallet.get_asset_balance(ASSET_ID)
    if (type(asset.spendable) is not int or type(asset.settled) is not int
            or min(asset.spendable, asset.settled) < amount):
        raise PreflightError('insufficient_spendable_rueda', 409)
    fee_rate = wallet.get_fee_estimation(online, 3)
    if (type(fee_rate) not in (int, float) or not math.isfinite(fee_rate)
            or not 0 < fee_rate <= config.max_fee_rate
            or math.ceil(fee_rate * config.estimated_vbytes) > config.fee_reserve):
        raise PreflightError('fee_policy_not_satisfied', 409)
    btc = wallet.get_btc_balance(online, True)
    # Require colorable fee funds; vanilla-only funds do not satisfy this policy.
    needed = config.fee_reserve + 1000  # conservative output/dust reserve, not exact coin selection
    if (type(btc.colored.spendable) is not int or type(btc.colored.settled) is not int
            or min(btc.colored.spendable, btc.colored.settled) < needed):
        raise PreflightError('insufficient_bitcoin_fee_funds', 409)
    # Keep all allocation statuses visible; settled_only=True could hide pending allocations.
    unspents = wallet.list_unspents(online, False, True)
    sources = []
    spare = []
    total = 0
    for u in unspents:
        if (not u.utxo.exists or not u.utxo.colorable or u.pending_blinded
                or any(not a.settled for a in u.rgb_allocations)):
            continue
        if not _confirmed_utxo(u, config, tip):
            continue
        if not u.rgb_allocations and u.utxo.btc_amount >= needed:
            spare.append(u)
        units = sum(a.assignment.amount for a in u.rgb_allocations
                    if a.asset_id == ASSET_ID and isinstance(a.assignment, rgb.Assignment.FUNGIBLE))
        if units > 0:
            sources.append(u)
            total += units
    if total < amount or not sources or not spare:
        raise PreflightError('required_utxos_unavailable', 409)
    return len(sources), len(spare)


def payment_preflight(request_id, approval_digest):
    config = configuration()
    approved = _approved(request_id, approval_digest)
    initial_tip = verify_indexer(config)  # Check pins before accessing wallet files.
    try:
        with wallet_session(config.wallet_dir) as wallet:
            if wallet.get_wallet_data().bitcoin_network != rgb.BitcoinNetwork.SIGNET_CUSTOM:
                raise PreflightError('wallet_network_mismatch', 409)
            _verify_wallet_chain(wallet, config, initial_tip)
            _no_pending_transfers(wallet)
            online = wallet.go_online(rgb.OnlineOptions(
                indexer_url=config.indexer_url, skip_consistency_check=False, vanilla_sync_lookback=100))
            for keychain in (rgb.SyncKeychain.COLORED(), rgb.SyncKeychain.VANILLA(100)):
                wallet.sync(online, rgb.SyncOptions(keychain=keychain, strategy=rgb.SyncStrategy.FULL_SCAN))
            _no_pending_transfers(wallet)
            tip = verify_indexer(config)
            _same_chain(config, initial_tip, tip)
            sources, spare = _funds(wallet, online, approved['amount'], config, tip)
            _same_chain(config, tip, verify_indexer(config))
            final = _approved(request_id, approval_digest)  # Catch expiry/config changes during sync.
            if final != approved:
                raise PreflightError('approved_payment_invalid', 409)
    except PreflightError:
        raise
    except Exception:
        # Never expose native exception messages, file paths, endpoints or wallet data.
        raise PreflightError('wallet_preflight_failed') from None
    return {
        'request_id': request_id, 'network': 'mutinynet', 'asset': 'RUEDA',
        'amount': approved['amount'], 'preflight_passed': True,
        'checked_at': int(time.time()), 'blockchain_sync_performed': True,
        'indexer_checkpoint_verified': True, 'wallet_cached_chain_verified': True,
        'approval_revalidated': True,
        'rueda_funds_sufficient': True, 'bitcoin_fee_reserve_sufficient': True,
        'eligible_asset_utxos': sources, 'eligible_spare_utxos': spare,
        'exact_transaction_fee_verified': False, 'utxos_reserved': False,
        'ready_to_execute': False, 'payments_enabled': False, 'payment_sent': False,
    }
