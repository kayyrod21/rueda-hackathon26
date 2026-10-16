import sqlite3
from dataclasses import asdict
from pathlib import Path

from approval import create_booking

DB_PATH = Path(__file__).resolve().parent / "bookings.sqlite3"


def initialize_database():
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                booking_id TEXT PRIMARY KEY,
                ride_type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                asset TEXT NOT NULL,
                status TEXT NOT NULL,
                payment_status TEXT NOT NULL
            )
        """)


def save_booking(ride_type):
    booking = create_booking(ride_type)
    data = asdict(booking)

    initialize_database()

    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            INSERT INTO bookings
            (booking_id, ride_type, amount, asset, status, payment_status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                booking.booking_id,
                booking.ride_type,
                booking.amount,
                booking.asset,
                booking.status,
                booking.payment_status,
            ),
        )

    return data


def get_booking(booking_id):
    initialize_database()

    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute(
            "SELECT * FROM bookings WHERE booking_id = ?",
            (booking_id,),
        ).fetchone()

    return dict(row) if row else None


def approve_booking(booking_id):
    initialize_database()

    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            UPDATE bookings
            SET status = 'approved'
            WHERE booking_id = ?
              AND status = 'awaiting_approval'
              AND payment_status = 'not_started'
            """,
            (booking_id,),
        )

    return get_booking(booking_id)
