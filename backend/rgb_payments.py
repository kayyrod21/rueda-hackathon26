"""Phase 1: offline validation only. No sending, synchronization or refresh."""
from dataclasses import dataclass
import os
import time
from urllib.parse import urlsplit
import rgb_lib as rgb
from wallet_runtime import ASSET_ID, wallet_session

MAX_TEST_AMOUNT = 10
NETWORK = "mutinynet"


def validate_amount(amount):
    if type(amount) is not int or not 1 <= amount <= MAX_TEST_AMOUNT:
        raise ValueError("Amount must be an integer from 1 to 10 RUEDA")


@dataclass(frozen=True)
class ValidatedInvoice:
    recipient_id: str
    expires_at: int


def validate_invoice(invoice: str, amount: int) -> ValidatedInvoice:
    validate_amount(amount)
    if (not isinstance(invoice, str) or not 1 <= len(invoice) <= 4096
            or invoice != invoice.strip() or not invoice.startswith("rgb:")
            or any(c.isspace() for c in invoice)):
        raise ValueError("A complete RGB invoice is required")
    try:
        data = rgb.Invoice(invoice).invoice_data()
        recipient_type = rgb.RecipientInfo(data.recipient_id).recipient_type()
    except Exception:
        # Never return a native exception: it can contain the original invoice.
        raise ValueError("Invalid RGB invoice") from None
    if data.asset_id != ASSET_ID or data.asset_schema not in (None, rgb.AssetSchema.NIA):
        raise ValueError("Invoice must specify the configured RUEDA asset")
    if data.network != rgb.BitcoinNetwork.SIGNET_CUSTOM:
        raise ValueError("Invoice must use custom signet")
    if recipient_type != rgb.RecipientType.BLIND:
        raise ValueError("Only blinded RGB recipients are supported in Phase 1")
    if not isinstance(data.assignment, rgb.Assignment.FUNGIBLE):
        raise ValueError("Invoice must specify a fungible amount")
    validate_amount(data.assignment.amount)
    if data.assignment.amount != amount:
        raise ValueError("Invoice amount must match the approved booking")
    if data.assignment_name not in (None, "assetOwner") or data.unknown_query_params:
        raise ValueError("Unsupported invoice parameters")
    expiry = data.expiration_timestamp
    if type(expiry) is not int or expiry <= int(time.time()):
        raise ValueError("Invoice must have a future expiration")
    # Exact endpoint allowlist; no network requests or DNS lookups occur here.
    allowed = set(filter(None, os.environ.get("RUEDA_RGB_ALLOWED_TRANSPORTS", "").split(",")))
    if not data.transport_endpoints or len(data.transport_endpoints) > 3:
        raise ValueError("Invoice requires approved RGB transport endpoints")
    for endpoint in data.transport_endpoints:
        try:
            u = urlsplit(endpoint)
            valid = (u.scheme in ("rpc", "rpcs") and u.hostname
                     and not u.username and not u.password and not u.fragment
                     and endpoint in allowed)
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("Invoice transport endpoint is not approved")
    return ValidatedInvoice(data.recipient_id, expiry)


def get_payment_readiness():
    """Cached inspection only; callers must explicitly invoke this helper."""
    with wallet_session() as wallet:
        balance = wallet.get_asset_balance(ASSET_ID)
    return {
        "network": NETWORK, "asset": "RUEDA",
        "settled": balance.settled, "spendable": balance.spendable,
        "max_test_amount": MAX_TEST_AMOUNT, "payments_enabled": False,
        "approval_required": True, "blockchain_sync_performed": False,
    }
