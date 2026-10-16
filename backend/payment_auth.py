"""Authentication for RUEDA test payment requests."""

import hmac
from pathlib import Path

from fastapi import Header, HTTPException

KEY_FILE = Path(__file__).resolve().parent / ".payment_api_key"


def require_payment_api_key(
    x_payment_api_key: str | None = Header(default=None),
):
    expected = KEY_FILE.read_text().strip()

    if not x_payment_api_key or not hmac.compare_digest(
        x_payment_api_key, expected
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid payment API key",
        )

    return True


OPERATOR_KEY_FILE = Path(__file__).resolve().parent / ".payment_operator_key"


def require_payment_operator_key(
    x_payment_operator_key: str | None = Header(default=None),
):
    """Authenticate the payment operator, separately from QVAC."""
    expected = OPERATOR_KEY_FILE.read_text().strip()

    if not x_payment_operator_key or not hmac.compare_digest(
        x_payment_operator_key, expected
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid payment operator key",
        )

    return True
