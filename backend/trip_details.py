from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Literal

RideType = Literal[
    "airport_transfer",
    "city_ride",
    "executive_ride",
]

@dataclass
class TripDetails:
    ride_type: RideType | None = None
    pickup: str | None = None
    destination: str | None = None
    departure_time: str | None = None
    passengers: int | None = None
    luggage: int | None = None
    # Flight departure (ISO, Bogotá). Informational only: it is NOT the pickup
    # time. No airport buffer is applied until Rueda approves a policy.
    flight_time: str | None = None
    # 'departure' (pickup must be before it) or 'arrival' (informational only).
    flight_direction: str | None = None

    def missing_fields(self) -> list[str]:
        required = (
            "ride_type",
            "pickup",
            "destination",
            "departure_time",
            "passengers",
        )
        return [
            name for name in required
            if getattr(self, name) is None
        ]

    def is_complete(self) -> bool:
        return not self.missing_fields()

    def to_dict(self) -> dict:
        return asdict(self)
