"""Restricted RGB Protocol on Bitcoin payment helpers.

Mutinynet test environment only.
No sending functionality is enabled in this module.
"""

import rgb_lib as rgb

from main import ASSET_ID, load_wallet


MAX_TEST_AMOUNT = 10


def get_payment_readiness():
    """Read local RUEDA wallet state without initiating a transfer."""
    wallet = load_wallet()
    balance = wallet.get_asset_balance(ASSET_ID)

    return {
        "network": "mutinynet",
        "asset": "RUEDA",
        "settled": balance.settled,
        "spendable": balance.spendable,
        "max_test_amount": MAX_TEST_AMOUNT,
        "payments_enabled": False,
        "approval_required": True,
    }
