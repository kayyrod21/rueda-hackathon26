"""Demo ride-provider adapter. Replace with an authorized provider API later.

No external ride is booked, no driver is contacted, and no payment is verified.
"""
from dataclasses import dataclass, asdict
from uuid import uuid4


@dataclass
class DemoRide:
    booking_id: str
    provider: str
    status: str
    driver_status: str
    simulated: bool


class DemoRideProvider:
    """Stable interface for a future real ride-provider integration."""

    def create_booking(self, trip: dict) -> dict:
        if not trip:
            raise ValueError("Trip details are required")

        ride = DemoRide(
            booking_id=f"RDA-{uuid4().hex[:8].upper()}",
            provider="rueda-demo",
            status="awaiting_payment",
            driver_status="not_assigned",
            simulated=True,
        )
        return asdict(ride)

    def simulate_dispatch(self, booking: dict) -> dict:
        if booking.get("provider") != "rueda-demo":
            raise ValueError("Only demo bookings can be simulated")

        return {
            **booking,
            "status": "demo_confirmed",
            "driver_status": "simulated_driver_assigned",
            "simulated": True,
        }


ride_provider = DemoRideProvider()
