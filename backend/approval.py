from dataclasses import dataclass
from typing import Literal
from uuid import uuid4

from pricing import RideType, calculate_quote

ApprovalStatus = Literal["awaiting_approval", "approved"]

@dataclass
class BookingApproval:
    booking_id: str
    ride_type: RideType
    amount: int
    asset: str
    status: ApprovalStatus
    payment_status: str = "not_started"

def create_booking(ride_type: RideType) -> BookingApproval:
    quote = calculate_quote(ride_type)
    return BookingApproval(
        booking_id=str(uuid4()),
        ride_type=ride_type,
        amount=quote.amount,
        asset=quote.asset,
        status="awaiting_approval",
    )
