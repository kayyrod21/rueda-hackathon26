"""Immutable Phase 1 proposals and approvals. No wallet or transfer operations.

Legacy payment_requests rows remain untouched and are never accepted here.
"""
import hashlib
import hmac
import json
from pathlib import Path
import sqlite3
from uuid import uuid4
import booking_store
from rgb_payments import ASSET_ID, NETWORK, validate_amount, validate_invoice

DB_PATH = Path(__file__).resolve().parent / "bookings.sqlite3"
TABLE = "payment_requests_v1"


def initialize_payment_database():
    if Path(DB_PATH) != Path(booking_store.DB_PATH):
        raise ValueError("Booking and payment database configuration differs")
    booking_store.initialize_database()
    with sqlite3.connect(DB_PATH) as c:
        c.executescript("""
            CREATE TABLE IF NOT EXISTS payment_requests_v1 (
                request_id TEXT PRIMARY KEY,
                booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(booking_id),
                invoice TEXT NOT NULL UNIQUE,
                recipient_id TEXT NOT NULL UNIQUE,
                amount INTEGER NOT NULL CHECK(typeof(amount) = 'integer' AND amount BETWEEN 1 AND 10),
                asset TEXT NOT NULL CHECK(asset = 'RUEDA'),
                asset_id TEXT NOT NULL,
                network TEXT NOT NULL CHECK(network = 'mutinynet'),
                booking_snapshot TEXT NOT NULL,
                approval_digest TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending_approval'
                    CHECK(status IN ('pending_approval', 'approved')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                approved_at TEXT
            );
            CREATE TRIGGER IF NOT EXISTS payment_v1_immutable
            BEFORE UPDATE ON payment_requests_v1
            WHEN NEW.request_id IS NOT OLD.request_id
              OR NEW.booking_id IS NOT OLD.booking_id OR NEW.invoice IS NOT OLD.invoice
              OR NEW.recipient_id IS NOT OLD.recipient_id OR NEW.amount IS NOT OLD.amount
              OR NEW.asset IS NOT OLD.asset OR NEW.asset_id IS NOT OLD.asset_id
              OR NEW.network IS NOT OLD.network OR NEW.booking_snapshot IS NOT OLD.booking_snapshot
              OR NEW.approval_digest IS NOT OLD.approval_digest OR NEW.created_at IS NOT OLD.created_at
              OR NOT (OLD.status = 'pending_approval' AND NEW.status = 'approved'
                      AND NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL)
            BEGIN SELECT RAISE(ABORT, 'Payment details are immutable'); END;
            CREATE TRIGGER IF NOT EXISTS payment_v1_no_delete
            BEFORE DELETE ON payment_requests_v1
            BEGIN SELECT RAISE(ABORT, 'Payment requests cannot be deleted'); END;
            CREATE TRIGGER IF NOT EXISTS payment_v1_booking_immutable
            BEFORE UPDATE ON bookings
            WHEN EXISTS (SELECT 1 FROM payment_requests_v1 WHERE booking_id = OLD.booking_id)
             AND (NEW.booking_id IS NOT OLD.booking_id OR NEW.ride_type IS NOT OLD.ride_type
               OR NEW.amount IS NOT OLD.amount OR NEW.asset IS NOT OLD.asset
               OR NEW.status IS NOT OLD.status OR NEW.payment_status IS NOT OLD.payment_status)
            BEGIN SELECT RAISE(ABORT, 'Booking bound to payment request'); END;
            CREATE TRIGGER IF NOT EXISTS payment_v1_booking_no_delete
            BEFORE DELETE ON bookings
            WHEN EXISTS (SELECT 1 FROM payment_requests_v1 WHERE booking_id = OLD.booking_id)
            BEGIN SELECT RAISE(ABORT, 'Booking bound to payment request'); END;
        """)


def _booking(c, booking_id):
    row = c.execute("SELECT * FROM bookings WHERE booking_id = ?", (booking_id,)).fetchone()
    if row is None:
        raise ValueError("Booking not found")
    booking = dict(row)
    if booking["status"] != "approved" or booking["payment_status"] != "not_started":
        raise ValueError("Booking must be approved and unpaid")
    validate_amount(booking["amount"])
    if booking["asset"] != "RUEDA":
        raise ValueError("Unsupported booking asset")
    return booking


def _snapshot(booking):
    return json.dumps(booking, sort_keys=True, separators=(",", ":"))


def _digest(row):
    fields = ["request_id", "booking_id", "invoice", "recipient_id", "amount",
              "asset", "asset_id", "network", "booking_snapshot"]
    payload = {k: row[k] for k in fields}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _public(row):
    return {**{k: row[k] for k in ("request_id", "booking_id", "amount", "asset",
                                   "asset_id", "network", "status", "approval_digest")},
            "payment_sent": False, "payments_enabled": False}


def create_payment_request(booking_id: str, invoice: str):
    initialize_payment_database()
    with sqlite3.connect(DB_PATH) as c:
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA foreign_keys = ON")
        c.execute("BEGIN IMMEDIATE")
        booking = _booking(c, booking_id)
        validated = validate_invoice(invoice, booking["amount"])
        row = dict(request_id=str(uuid4()), booking_id=booking_id, invoice=invoice,
                   recipient_id=validated.recipient_id, amount=booking["amount"], asset="RUEDA",
                   asset_id=ASSET_ID, network=NETWORK, booking_snapshot=_snapshot(booking),
                   status="pending_approval")
        row["approval_digest"] = _digest(row)
        columns = list(row)
        try:
            c.execute(f"INSERT INTO {TABLE} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})",
                      [row[k] for k in columns])
        except sqlite3.IntegrityError:
            raise ValueError("A payment request already exists for this booking, invoice or recipient") from None
        return _public(row)


def approve_payment_request(request_id: str, approval_digest: str):
    initialize_payment_database()
    with sqlite3.connect(DB_PATH) as c:
        c.row_factory = sqlite3.Row
        c.execute("BEGIN IMMEDIATE")
        found = c.execute(f"SELECT * FROM {TABLE} WHERE request_id = ?", (request_id,)).fetchone()
        if found is None:
            raise ValueError("Payment request not found")
        row = dict(found)
        if row["status"] != "pending_approval":
            raise ValueError("Payment request is not pending approval")
        if (not isinstance(approval_digest, str) or len(approval_digest) != 64
                or not approval_digest.isascii()
                or not hmac.compare_digest(approval_digest, row["approval_digest"])
                or not hmac.compare_digest(_digest(row), row["approval_digest"])):
            raise ValueError("Payment approval details do not match")
        if row["asset_id"] != ASSET_ID or row["network"] != NETWORK or row["asset"] != "RUEDA":
            raise ValueError("Payment configuration changed")
        booking = _booking(c, row["booking_id"])
        if _snapshot(booking) != row["booking_snapshot"] or booking["amount"] != row["amount"]:
            raise ValueError("Booking details changed")
        validated = validate_invoice(row["invoice"], row["amount"])
        if validated.recipient_id != row["recipient_id"]:
            raise ValueError("Invoice details changed")
        c.execute(f"UPDATE {TABLE} SET status='approved', approved_at=CURRENT_TIMESTAMP WHERE request_id=? AND status='pending_approval'",
                  (request_id,))
        row["status"] = "approved"
        return _public(row)


def get_approved_payment(request_id: str, approval_digest: str):
    """Revalidate an immutable approved snapshot; never update payment state."""
    initialize_payment_database()
    with sqlite3.connect(DB_PATH) as c:
        c.row_factory = sqlite3.Row
        c.execute("BEGIN")
        found = c.execute(f"SELECT * FROM {TABLE} WHERE request_id=?", (request_id,)).fetchone()
        if found is None:
            raise ValueError("Payment request not found")
        row = dict(found)
        if row["status"] != "approved" or not row["approved_at"]:
            raise ValueError("Explicit operator approval is required")
        if (not isinstance(approval_digest, str) or len(approval_digest) != 64
                or not approval_digest.isascii()
                or not hmac.compare_digest(approval_digest, row["approval_digest"])
                or not hmac.compare_digest(_digest(row), row["approval_digest"])):
            raise ValueError("Payment approval details do not match")
        if row["asset_id"] != ASSET_ID or row["asset"] != "RUEDA" or row["network"] != NETWORK:
            raise ValueError("Payment configuration changed")
        booking = _booking(c, row["booking_id"])
        if _snapshot(booking) != row["booking_snapshot"] or booking["amount"] != row["amount"]:
            raise ValueError("Booking details changed")
        validated = validate_invoice(row["invoice"], row["amount"])
        if validated.recipient_id != row["recipient_id"]:
            raise ValueError("Invoice details changed")
        return row
