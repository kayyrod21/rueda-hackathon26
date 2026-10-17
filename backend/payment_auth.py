"""Separate concierge and operator authentication. No secret logging."""
import hmac
from pathlib import Path
from fastapi import Header, HTTPException

KEY_FILE = Path(__file__).resolve().parent / ".payment_api_key"
OPERATOR_KEY_FILE = Path(__file__).resolve().parent / ".payment_operator_key"


def _require(path, supplied):
    try:
        expected = path.read_text().strip()
    except (OSError, UnicodeError):
        raise HTTPException(status_code=503, detail="Authentication is not configured") from None
    if not expected:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    if not isinstance(supplied, str) or not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid authentication key")
    return True


def require_payment_api_key(x_payment_api_key: str | None = Header(default=None)):
    return _require(KEY_FILE, x_payment_api_key)


def require_payment_operator_key(x_payment_operator_key: str | None = Header(default=None)):
    return _require(OPERATOR_KEY_FILE, x_payment_operator_key)
