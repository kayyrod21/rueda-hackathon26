import re
import unicodedata
from datetime import datetime
from datetime import date, timedelta
from zoneinfo import ZoneInfo

BOGOTA = ZoneInfo("America/Bogota")

MONTHS = {
    "january": 1, "enero": 1,
    "february": 2, "febrero": 2,
    "march": 3, "marzo": 3,
    "april": 4, "abril": 4,
    "may": 5, "mayo": 5,
    "june": 6, "junio": 6,
    "july": 7, "julio": 7,
    "august": 8, "agosto": 8,
    "september": 9, "septiembre": 9, "setiembre": 9,
    "october": 10, "octubre": 10,
    "november": 11, "noviembre": 11,
    "december": 12, "diciembre": 12,
}

WEEKDAYS = {
    "monday": 0, "lunes": 0,
    "tuesday": 1, "martes": 1,
    "wednesday": 2, "miercoles": 2,
    "thursday": 3, "jueves": 3,
    "friday": 4, "viernes": 4,
    "saturday": 5, "sabado": 5,
    "sunday": 6, "domingo": 6,
}

FORMAT_HELP = (
    "Please enter a date and time such as "
    "'October 18 at 4 PM' or '18 de octubre a las 4 PM'."
)
INVALID_DATE = "That calendar date is invalid. Please try again."
INVALID_TIME = "Please enter a valid time, such as 4 PM, 4:30 PM or 16:30."
PAST = (
    "That date and time have already passed in Medellín. "
    "Please choose a future departure date and time."
)
# Spanish equivalents of the user-facing errors above (shown when the conversation is in Spanish).
ES_ERRORS = {
    PAST: "Esa fecha y hora ya pasaron en Medellín. Elige una fecha y hora de salida futuras.",
    INVALID_DATE: "Esa fecha del calendario no es válida. Inténtalo de nuevo.",
    INVALID_TIME: "Ingresa una hora válida, por ejemplo 4 PM, 4:30 PM o 16:30.",
}

_MONTH_RE = "|".join(sorted(MONTHS, key=len, reverse=True))
_WEEKDAY_RE = "|".join(WEEKDAYS)


def now() -> datetime:
    """Current Bogotá time. Other modules must use this so tests can mock it."""
    return datetime.now(BOGOTA)


def normalize(value: str) -> str:
    """Lowercase and strip accents while keeping a 1:1 character mapping."""
    return "".join(
        unicodedata.normalize("NFD", ch)[0] for ch in value
    ).lower()


class DateError(ValueError):
    pass


def find_date(text: str, today: date):
    """Search normalized text for a calendar day. Returns (date|None, span|None).
    Raises DateError for an invalid calendar date."""
    patterns = [
        ("md", rf"\b({_MONTH_RE})\s+(\d{{1,2}})(?:st|nd|rd|th)?\b(?:,?\s+(\d{{4}})\b)?"),
        ("dm", rf"\b(\d{{1,2}})\s+(?:de\s+)?({_MONTH_RE})\b(?:,?\s+(?:de\s+|del\s+)?(\d{{4}})\b)?"),
        ("num", r"\b(\d{1,2})/(\d{1,2})(?:/(\d{4}|\d{2}))?\b"),
        ("tomorrow", r"\btomorrow\b|(?<!de la )(?<!por la )(?<!pasado )\bmanana\b"),
        ("today", r"\btoday\b|\bhoy\b|\btonight\b|\besta noche\b"),
        ("weekday", rf"\b({_WEEKDAY_RE})\b"),
    ]
    for kind, pattern in patterns:
        m = re.search(pattern, text)
        if not m:
            continue
        if kind == "tomorrow":
            return today + timedelta(days=1), m.span()
        if kind == "today":
            return today, m.span()
        if kind == "weekday":
            ahead = (WEEKDAYS[m.group(1)] - today.weekday()) % 7 or 7
            return today + timedelta(days=ahead), m.span()
        if kind == "md":
            month, day, year = MONTHS[m.group(1)], int(m.group(2)), m.group(3)
        elif kind == "dm":
            day, month, year = int(m.group(1)), MONTHS[m.group(2)], m.group(3)
        else:  # D/M numeric (Colombian order)
            day, month, year = int(m.group(1)), int(m.group(2)), m.group(3)
            if year and len(year) == 2:
                year = "20" + year
        explicit = year is not None
        y = int(year) if explicit else today.year
        try:
            found = date(y, month, day)
        except ValueError:
            # Feb 29 may exist next year when no year was given.
            try:
                if explicit:
                    raise
                found = date(y + 1, month, day)
                if found < today:
                    raise ValueError
            except ValueError:
                raise DateError(INVALID_DATE)
        if not explicit and found < today:
            try:
                found = date(y + 1, month, day)  # year rollover
            except ValueError:
                raise DateError(INVALID_DATE)
        return found, m.span()
    return None, None


def find_time(text: str):
    """Search normalized text for a clock time. Returns ((hour, minute)|None, span|None).
    Raises DateError for an impossible time."""
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m|p\.?\s?m)\b\.?", text)
    if m:
        hour, minute = int(m.group(1)), int(m.group(2) or 0)
        if not 1 <= hour <= 12 or minute > 59:
            raise DateError(INVALID_TIME)
        pm = m.group(3).startswith("p")
        return (hour % 12 + (12 if pm else 0), minute), m.span()
    m = re.search(
        r"\b(\d{1,2})(?::(\d{2}))?\s+(?:de la|en la|por la|in the|at|this)\s+(manana|madrugada|tarde|noche|morning|afternoon|evening|night)\b",
        text,
    )
    if m:
        hour, minute = int(m.group(1)), int(m.group(2) or 0)
        if not 1 <= hour <= 12 or minute > 59:
            raise DateError(INVALID_TIME)
        part = m.group(3)
        if part in ("tarde", "noche", "afternoon", "evening", "night") and hour != 12:
            hour += 12
        elif part in ("manana", "madrugada", "morning", "noche", "night") and hour == 12:
            hour = 0  # '12 de la noche' / '12 at night' = midnight
        return (hour, minute), m.span()
    # Explicit 24h only: zero-padded hours (00-09, incl. '0:30') or 13-23.
    # '5:30', '10:30', '12:30' without am/pm are ambiguous (see find_ambiguous_clock).
    m = re.search(r"\b(0\d?|1[3-9]|2[0-3]):(\d{2})\b", text)
    if m:
        hour, minute = int(m.group(1)), int(m.group(2))
        if hour > 23 or minute > 59:
            raise DateError(INVALID_TIME)
        return (hour, minute), m.span()
    m = re.search(r"\b(?:midnight|medianoche)\b", text)
    if m:
        return (0, 0), m.span()  # 00:00 at the start of the given (or default) date
    m = re.search(r"\b(?:noon|mediodia)\b", text)
    if m:
        return (12, 0), m.span()
    return None, None


def find_ambiguous_clock(text: str):
    """Hour 1-12 with minutes, no leading zero and no am/pm: ((h, m)|None, span|None)."""
    m = re.search(r"\b([1-9]|1[0-2]):([0-5]\d)\b", text)
    if m:
        return (int(m.group(1)), int(m.group(2))), m.span()
    return None, None


def combine(day: date, clock: tuple[int, int]) -> datetime:
    return datetime(day.year, day.month, day.day, clock[0], clock[1], tzinfo=BOGOTA)


def parse_trip_date(value: str) -> tuple[str | None, str | None]:
    text = normalize(value.strip())
    current = now()
    try:
        day, _ = find_date(text, current.date())
        clock, _ = find_time(text)
    except DateError as exc:
        return None, str(exc)
    if day is None or clock is None:
        return None, FORMAT_HELP
    departure = combine(day, clock)
    if departure <= current:
        return None, PAST
    return departure.isoformat(), None
