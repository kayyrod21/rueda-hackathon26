from dataclasses import dataclass
from typing import Literal

RideType = Literal["airport_transfer", "city_ride", "executive_ride"]

DEMO_PRICES = {
    "airport_transfer": 10,
    "city_ride": 5,
    "executive_ride": 15,
}

@dataclass(frozen=True)
class RideQuote:
    ride_type: RideType
    amount: int
    asset: str = "RUEDA"
    network: str = "mutinynet"
    demo_only: bool = True

def calculate_quote(ride_type: RideType) -> RideQuote:
    if ride_type not in DEMO_PRICES:
        raise ValueError("Unsupported ride type")

    return RideQuote(
        ride_type=ride_type,
        amount=DEMO_PRICES[ride_type],
    )
