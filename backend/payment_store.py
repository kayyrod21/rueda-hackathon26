"""Persistent RUEDA payment requests. No wallet access or token transfers."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "bookings.sqlite3"


def initialize_payment_database():
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS payment_requests (
                request_id TEXT PRIMARY KEY,
                booking_id TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                amount INTEGER NOT NULL CHECK (amount > 0 AND amount <= 10),
                asset TEXT NOT NULL CHECK (asset = 'RUEDA'),
                network TEXT NOT NULL CHECK (network = 'mutinynet'),
                status TEXT NOT NULL DEFAULT 'pending_approval'
                    CHECK (status IN (
                        'pending_approval',
                        'approved',
                        'rejected',
                        'submitted',
                        'failed'
                    )),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)


def create_payment_request(booking_id: str, recipient_id: str):
    """Create a pending request; never authorize or send tokens."""
    from uuid import uuid4
    from booking_store import get_booking

    booking = get_booking(booking_id)
    if booking is None:
        raise ValueError("Booking not found")
    if booking["status"] != "approved":
        raise ValueError("Booking must be approved first")
    if booking["payment_status"] != "not_started":
        raise ValueError("Booking payment already started")
    if booking["asset"] != "RUEDA":
        raise ValueError("Unsupported payment asset")
    if not 0 < booking["amount"] <= 10:
        raise ValueError("Amount exceeds RUEDA test limit")
    if not recipient_id or not recipient_id.strip():
        raise ValueError("Recipient ID is required")

    initialize_payment_database()
    request_id = str(uuid4())

    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            INSERT INTO payment_requests
                (request_id, booking_id, recipient_id,
                 amount, asset, network, status)
            VALUES (?, ?, ?, ?, 'RUEDA', 'mutinynet', 'pending_approval')
            """,
            (request_id, booking_id, recipient_id.strip(), booking["amount"]),
        )

    return {
        "request_id": request_id,
        "booking_id": booking_id,
        "amount": booking["amount"],
        "asset": "RUEDA",
        "network": "mutinynet",
        "status": "pending_approval",
        "payment_sent": False,
    }


def approve_payment_request(request_id: str):
    """Approve a pending payment request without sending tokens."""
    initialize_payment_database()

    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row

        cursor = connection.execute(
            """
            UPDATE payment_requests
            SET status = 'approved'
            WHERE request_id = ?
              AND status = 'pending_approval'
            """,
            (request_id,),
        )

        row = connection.execute(
            """
            SELECT request_id, booking_id, amount, asset,
                   network, status
            FROM payment_requests
            WHERE request_id = ?
            """,
            (request_id,),
        ).fetchone()

        if row is None:
            raise ValueError("Payment request not found")

        if cursor.rowcount != 1:
            raise ValueError("Payment request is not pending approval")

        return {
            **dict(row),
            "payment_sent": False,
        }
