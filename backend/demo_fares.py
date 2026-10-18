"""Local-only illustrative fare presets. Never a verified Uber quote."""
import os
import re
from decimal import Decimal


PRESETS = (
    ("Miami", "USD", ("miami airport", "mia", "miami international airport"),
     ("miami beach", "miami beahc"), Decimal("35.00")),
    ("Miami", "USD", ("miami airport", "mia", "miami international airport"),
     ("downtown miami", "downtown"), Decimal("28.00")),
    ("Medellín", "COP", ("medellin", "medellín"),
     ("el poblado",), Decimal("25000")),
    ("Turin", "EUR", ("turin airport", "torino airport", "aeroporto di torino", "caselle airport"),
     ("turin city center", "turin city centre", "centro torino", "centro di torino"), Decimal("45.00")),
)


def _normalize(value):
    return re.sub(r"\s+", " ", (value or "").casefold()).strip()


def _matches(value, aliases):
    normalized = _normalize(value)
    return any(
        re.search(r"(?<!\w)" + re.escape(_normalize(alias)) + r"(?!\w)", normalized)
        for alias in aliases
    )


def estimate(trip):
    """Return a demo quote or None. Production is always blocked."""
    # Fail closed: illustrative prices require explicit development mode.
    if os.getenv("RUEDA_ENV") != "development":
        return None
    if os.getenv("NODE_ENV") == "production":
        return None
    if os.getenv("RUEDA_FARE_MODE") != "demo":
        return None

    for city, currency, pickups, destinations, amount in PRESETS:
        if (
            _normalize(trip.pickup_city) == _normalize(city)
            and trip.fare_currency == currency
            and _matches(trip.pickup, pickups)
            and _matches(trip.destination, destinations)
        ):
            return {
                "amount": str(amount),
                "currency": currency,
                "source": "demo_preset",
                "verified": False,
            }
    return None
