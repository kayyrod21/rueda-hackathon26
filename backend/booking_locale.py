"""Deterministic pickup-local context; no geocoding, fare or FX assumptions."""
from dataclasses import dataclass
import re
from trip_dates import normalize

@dataclass(frozen=True)
class PickupLocale:
    city: str
    time_zone: str
    currency: str

LOCALES = {
    'medellin': PickupLocale('Medellín', 'America/Bogota', 'COP'),
    'miami': PickupLocale('Miami', 'America/New_York', 'USD'),
    'tampa': PickupLocale('Tampa', 'America/New_York', 'USD'),
}


def resolve_pickup(value: str | None) -> PickupLocale | None:
    text = normalize(value or '')
    patterns = {
        'medellin': r'\b(medellin|mde|rionegro|jose maria cordova|el poblado)\b',
        'miami': r'\bmiami\b',
        'tampa': r'\b(tampa|tpa)\b',
    }
    found = [key for key, pattern in patterns.items() if re.search(pattern, text)]
    if re.search(r'\bMIA\b', value or '') and 'miami' not in found:
        found.append('miami')
    return LOCALES[found[0]] if len(found) == 1 else None
