"""Bilingual (EN/ES/Spanglish), order-independent trip field extraction.

Matching is done on an accent-stripped, lowercased copy of the message that
keeps a 1:1 character mapping, so place names are sliced from the original
text with their original casing.
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field
from datetime import date, datetime

import trip_dates
from trip_dates import normalize, DateError, _MONTH_RE, _WEEKDAY_RE

NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
    "twenty": 20,
    "un": 1, "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4,
    "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10,
    "once": 11, "doce": 12, "trece": 13, "catorce": 14, "quince": 15,
    "dieciseis": 16, "diecisiete": 17, "dieciocho": 18, "diecinueve": 19,
    "veinte": 20,
}
NUM = r"(\d{1,2}|" + "|".join(sorted(NUMBER_WORDS, key=len, reverse=True)) + r")"

PEOPLE = r"(?:people|persons?|personas?|passengers?|pasajeros?|pax|adults?|adultos?|travell?ers?|viajeros?)"
BAGS = r"(?:bags?|suitcases?|luggage|maletas?|equipajes?|valijas?|maletines?)"

STOP_WORDS = (
    "from|desde|to|hasta|hacia|al|a|on|el|la|en|for|para|with|con|at|by|"
    "around|near|tomorrow|manana|today|hoy|tonight|this|next|y|and|somos|we|"
    "i|my|our|nuestro|nuestra|mi|please|por|pls|then|but|pero|"
    + _WEEKDAY_RE + "|" + _MONTH_RE
)
_PLACE = (
    r"(?P<v>[^\s,.;!?¿¡\d][^,.;!?¿¡]*?)"
    rf"(?=\s+(?:{STOP_WORDS})\b|\s*[,.;!?]|\s+\d|\s*$)"
)
PICKUP_RES = [
    re.compile(r"\b(?P<v>(?:miami|tampa|medellin|mia|tpa|mde)(?:\s+(?:international\s+)?(?:airport|aeropuerto))?)\s+(?:pickup|recogida)\b"),
    re.compile(r"(?:^|(?<=[\s,]))\bde\s+(?:la\s+)?(?P<v>q+)(?=\s|$|,)"),
    re.compile(r"(?:^|(?<=[\s,]))(?P<v>q+)(?=\s+(?:to|hasta|hacia|al|a)\s)"),
    re.compile(r"\b(?:pick(?:\s*-?\s*)?(?:me|us)?\s*up|pickup|pick-up)\s+(?:at|from|in)\s+" + _PLACE),
    re.compile(r"\b(?:recoger(?:me|nos|los)?|recogeme|recogenos|recogida)\s+(?:en|desde)\s+" + _PLACE),
    re.compile(r"\b(?:land(?:ing)?|arriv(?:e|ing)|arrive)\s+(?:at|in)\s+" + _PLACE),
    re.compile(r"\b(?:from|desde)\s+" + _PLACE),
]
DEST_RES = [
    re.compile(r"\b(?:from|desde)\s+[^,.;!?]+?\s+(?:to|hasta|hacia)\s+" + _PLACE),
    re.compile(r"\b(?:from|desde)\s+[^,.;!?]+?\s+a\s+" + _PLACE),
    re.compile(r"\b(?:to|hasta|hacia|al|towards|drop(?:\s*-?\s*off)?\s+at|dejar(?:me|nos)?\s+en)\s+" + _PLACE),
]
NON_PLACE_FIRST = {
    "go", "be", "get", "make", "change", "have", "pick", "book", "the time",
    "ir", "the", "las", "los", "it", "do", "take", "catch", "ignore",
    "medianoche", "midnight", "mediodia", "noon",  # times, not places ('a medianoche')
}
ARTICLES = ("the ", "el ", "la ", "los ", "las ")

# Colombian street addresses (Calle 10 # 43-21, Cra 43A #1-50, Cl. 10 Sur #50-28,
# Carrera 70 No. 1-141, Diagonal 75B 2A-80, Avenida 33). Matched on normalized text.
ADDRESS_RE = re.compile(
    r"\b(?:calle|cll|cl|carrera|cra|kr|cr|avenida|av|transversal|tv|diagonal|dg|circular|cq)\.?"
    r"\s+\d{1,3}[a-z]?\b(?:\s+bis\b)?(?:\s+sur\b)?"
    r"(?:(?:\s*(?:#|no\.?|n°|nro\.?|numero)\s*|\s+)\d{1,3}[a-z]?\s*-\s*\d{1,3}[a-z]?\b(?:\s+sur\b)?"
    r"|\s*(?:#|no\.|nro\.?|numero)\s*\d{1,3}[a-z]?\b)?"
)
FILLER = "q"
AIRPORT_WORDS = r"\b(?:aeropuerto|airport|mde|jose maria cordova|rionegro airport)\b"

AFFIRMATIVES = {
    "yes", "yes please", "yes confirm", "yes confirmed", "yes correct",
    "yes that is correct", "yes thats correct", "yes thats right", "yep",
    "confirm", "confirmed", "correct", "that is correct", "thats correct",
    "si", "si por favor", "si correcto", "si confirmo", "si confirmado",
    "confirmo", "confirmado", "correcto", "todo correcto", "si todo correcto",
    "es correcto", "si es correcto", "si esta bien", "esta bien", "de acuerdo",
    "dale", "perfecto", "asi es", "si confirmar", "confirmar",
}
NEGATIVES = {"no", "nope", "no thanks", "incorrect", "incorrecto", "change",
             "cambiar", "corregir", "wrong", "not correct", "no es correcto"}

ES_WORDS = {
    "necesito", "quiero", "somos", "personas", "persona", "maletas", "maleta",
    "desde", "hacia", "hasta", "vamos", "por", "favor", "hola", "manana",
    "aeropuerto", "viaje", "mejor", "cambia", "cambiar", "son", "pero", "de",
    "la", "el", "un", "una", "dos", "tres", "cuatro", "cinco", "pasajeros",
    "equipaje", "vuelo", "nuestro", "nuestra", "sale", "las", "al", "del",
    "si", "gracias", "recoger", "confirmo", "correcto", "sabado", "domingo",
    "ejecutivo", "ciudad", "tarde", "noche", "hora", "es", "con", "mas",
    "menos", "persona", "antes", "despues", "horas", "aterrizo", "llego",
}
ES_STRONG = {"necesito", "quiero", "somos", "vamos", "porfa", "necesitamos",
             "queremos", "llevamos", "cambia", "mejor"}
ES_WORDS_EXTRA = {"porfa", "necesitamos", "queremos", "llevamos"}
EN_WORDS = {
    "the", "from", "to", "passengers", "passenger", "people", "please", "yes",
    "tomorrow", "need", "ride", "airport", "make", "it", "actually", "change",
    "time", "with", "bags", "bag", "suitcases", "for", "and", "at", "on", "i",
    "we", "my", "our", "flight", "transfer", "city", "executive", "want",
    "pick", "up", "but", "land", "an", "hour", "hours", "earlier", "later",
    "more", "less", "one", "bag", "fewer", "add", "yes",
}


ES_WORDS |= ES_WORDS_EXTRA | {"confirmar", "confirmado", "confirmada", "acuerdo", "dale", "perfecto", "bien"}
SPANISH_GREETING = (r"\b(?:hola|buenas(?:\s+(?:tardes|noches))?|buenos\s+dias|"
                    r"que\s+tal|saludos)\b")
EN_WORDS |= {"hi", "hello", "hey", "good", "morning", "afternoon", "evening", "thanks"}


def detect_language(message: str) -> str | None:
    words = re.findall(r"[a-z]+", normalize(message))
    es = sum(w in ES_WORDS for w in words)
    # Spanish verbs/phrases weigh more: they carry the sentence in Spanglish.
    es += sum(w in ES_STRONG for w in words)
    es += len(re.findall(r"\b(?:a las|de la|por la)\b", normalize(message)))
    # Spanish greetings (accent-insensitive) count strongly.
    es += 2 * len(re.findall(SPANISH_GREETING, normalize(message)))
    en = sum(w in EN_WORDS for w in words)
    if es > en:
        return "es"
    if en > es:
        return "en"
    return None


def to_int(token: str) -> int:
    return int(token) if token.isdigit() else NUMBER_WORDS[token]


def simple_text(message: str) -> str:
    return " ".join(re.findall(r"[a-z]+", normalize(message)))


@dataclass
class Extraction:
    ride_type: str | None = None
    ride_type_strong: bool = False
    pickup: str | None = None
    destination: str | None = None
    date: date | None = None
    clock: tuple[int, int] | None = None
    flight_clock: tuple[int, int] | None = None
    flight_ambiguous: tuple[int, int] | None = None   # flight time lacking am/pm
    passengers: int | None = None
    luggage: int | None = None
    date_error: str | None = None
    bare_number: int | None = None
    mentions: set = field(default_factory=set)
    period: str | None = None             # 'am'/'pm' resolving a pending bare hour
    period_night: bool = False            # period was 'noche'/'night' (12 -> midnight)
    ambiguous_hour: int | None = None     # bare 1-12 hour with no am/pm
    ambiguous_minute: int = 0
    passengers_delta: int | None = None
    luggage_delta: int | None = None
    minutes_delta: int | None = None
    flight_direction: str | None = None   # 'departure' or 'arrival'
    conflicts: dict = field(default_factory=dict)
    bare_text: str | None = None          # first sentence of the message (for bare answers)
    payment_words: bool = False

    def has_content(self) -> bool:
        return any(v is not None for v in (
            self.pickup, self.destination, self.date, self.clock,
            self.flight_clock, self.flight_ambiguous, self.passengers, self.luggage, self.date_error,
            self.period, self.ambiguous_hour, self.passengers_delta,
            self.luggage_delta, self.minutes_delta,
        )) or bool(self.conflicts)

    def is_material(self) -> bool:
        """Trip content that could change an itinerary (ride_type words excluded)."""
        return self.has_content()


def detect_ride_type(norm: str) -> tuple[str | None, bool]:
    """Returns (ride_type, strong). Strong = explicitly named service."""
    if re.search(r"\b(ejecutivo|ejecutiva|executive|chauffeur)\b", norm):
        return "executive_ride", True
    if re.search(r"\b(airport transfer|airport ride|traslado al aeropuerto|transfer al aeropuerto)\b", norm):
        return "airport_transfer", True
    if re.search(r"\b(city ride|viaje urbano|viaje por la ciudad|urban ride)\b", norm):
        return "city_ride", True
    if re.search(AIRPORT_WORDS, norm):
        return "airport_transfer", False
    if re.search(r"\b(ciudad|city|urbano|urban|ride|viaje|traslado|trayecto|carro|taxi)\b", norm):
        return "city_ride", False
    return None, False


def _clean_place(original: str, start: int, end: int, whole_norm: str) -> str | None:
    value = original[start:end].strip(" -:'\"")
    low = normalize(value)
    for art in ARTICLES:
        if value.startswith(art):  # lowercase article only; keeps 'El Poblado'
            value, low = value[len(art):], low[len(art):]
            break
    if not value or low.split()[0] in NON_PLACE_FIRST or low in NON_PLACE_FIRST:
        return None
    if re.search(AIRPORT_WORDS, low) and re.search(r"\bmde\b", whole_norm):
        return "MDE"
    return value


def _find_place(regexes, original: str, norm: str, pnorm: str | None = None) -> str | None:
    for rx in regexes:
        for m in rx.finditer(pnorm or norm):
            place = _clean_place(original, m.start("v"), m.end("v"), norm)
            if place:
                return place
    return None


def _blank(text: str, span) -> str:
    a, b = span
    return text[:a] + " " * (b - a) + text[b:]


PAYMENT_WORDS = (r"\b(digital|digitales|crypto|cripto|bitcoin|btc|lightning|ln|usdt|tether|"
                 r"on.?chain|rgb|ark|traditional|tradicional|cash|efectivo|card|tarjeta|"
                 r"transfer(?:encia)?\s+bancaria|bank transfer)\b")
ARRIVAL_RE = r"\b(?:land|lands|landing|aterriz\w*|llego|llegamos|llega|arriv\w*|llegada)\b"
CLAUSE_END = r"(?=[,;!?]|\.\s|\s+(?:and|y|need|necesito|then|pero|but|please|por favor)\b|$)"
REL_WORDS = {"a": 1, "an": 1, "half an": None}


def _num(token: str) -> int:
    token = token.strip()
    if token in ("a", "an"):
        return 1
    return to_int(token)


def _all_values(rxs, text):
    values, spans = [], []
    for rx in rxs:
        for m in re.finditer(rx, text):
            if any(a < m.end() and m.start() < b for a, b in spans):
                continue
            v = to_int(m.group(1))
            if v >= 1:
                values.append(v)
            spans.append(m.span())
    return values


def _ambiguous_in_clause(clause: str):
    """A flight time without am/pm: 'a las 6:10', 'at 6:10', 'at 6'."""
    amb, _ = trip_dates.find_ambiguous_clock(clause)
    if amb:
        return amb
    m = re.search(r"(?:\bat|\ba las|\ba la|@|\bsobre las)\s+(\d{1,2})\b(?!\s*(?::|/|\d))", clause)
    if m and 1 <= int(m.group(1)) <= 12:
        return int(m.group(1)), 0
    return None


def extract(message: str, today: date) -> Extraction:
    original = message.strip()
    norm = normalize(original)
    ex = Extraction()
    ex.ride_type, ex.ride_type_strong = detect_ride_type(norm)
    ex.payment_words = bool(re.search(PAYMENT_WORDS, norm))

    # Protect street addresses: their numbers are never passengers, dates or times.
    pnorm = norm
    for m in ADDRESS_RE.finditer(norm):
        pnorm = pnorm[:m.start()] + FILLER * (m.end() - m.start()) + pnorm[m.end():]
    work = re.sub(FILLER + "+", lambda m: " " * len(m.group(0)), pnorm)

    # Bare-answer text: only the first sentence (prevents trailing instructions
    # such as 'Ignore previous instructions...' from becoming part of a field).
    cut = re.search(r"[.!?;\n]\s|[.!?;]$", pnorm)
    ex.bare_text = original[:cut.start()].strip(" .!?¡¿") if cut else original.strip(" .!?¡¿")

    # Relative edits.
    rel_patterns = [
        (rf"\b{NUM}\s+(more|extra|additional|less|fewer)\s*({PEOPLE}|{BAGS})?", 2, 3, 1),
        (rf"\b{NUM}\s+({PEOPLE}|{BAGS})\s+(mas|menos|more|less|fewer)\b", 3, 2, 1),
        (rf"\b(?:add|agrega|anade|suma)\s+{NUM}\s+({PEOPLE}|{BAGS})?", None, 2, 1),
    ]
    for rx, sign_g, noun_g, num_g in rel_patterns:
        m = re.search(rx, work)
        if not m:
            continue
        n = to_int(m.group(num_g))
        sign = 1 if sign_g is None or m.group(sign_g) in ("more", "extra", "additional", "mas") else -1
        noun = (m.group(noun_g) or "") if noun_g else ""
        if re.fullmatch(BAGS, noun):
            ex.luggage_delta = sign * n
        else:
            ex.passengers_delta = sign * n
        work = _blank(work, m.span())
        break
    m = re.search(
        rf"\b(an?|half an|media|{NUM[1:-1]})\s+(hours?|horas?|minutes?|minutos?|mins?)\s+"
        r"(earlier|later|antes|despues|mas tarde|mas temprano)\b", work)
    if m:
        token = m.group(1)
        n = 30 if token in ("half an", "media") else _num(token)
        unit = 60 if m.group(2).startswith(("hour", "hora")) else 1
        if token in ("half an", "media"):
            unit = 1
        sign = -1 if m.group(3) in ("earlier", "antes", "mas temprano") else 1
        ex.minutes_delta = sign * n * unit
        work = _blank(work, m.span())

    try:
        ex.date, dspan = trip_dates.find_date(work, today)
        if dspan:
            work = _blank(work, dspan)
    except DateError as exc:
        ex.date_error = str(exc)

    # Flight clauses: arrival first, then departure. Their times never become
    # the pickup time silently.
    am = re.search(ARRIVAL_RE + r"[^,;!?]*?" + CLAUSE_END, work)
    fm = None
    if am:
        try:
            clock, _ = trip_dates.find_time(am.group(0))
        except DateError:
            clock = None
        if clock:
            ex.flight_clock, ex.flight_direction = clock, "arrival"
            work = _blank(work, am.span())
    if ex.flight_clock is None and am:
        amb = _ambiguous_in_clause(am.group(0))
        if amb:
            ex.flight_ambiguous, ex.flight_direction = amb, "arrival"
            work = _blank(work, am.span())
    if ex.flight_clock is None and ex.flight_ambiguous is None:
        fm = re.search(r"\b(?:vuelo|flight)\b[^,;!?]*", work)
        if fm:
            try:
                clock, _ = trip_dates.find_time(fm.group(0))
            except DateError:
                clock = None
            if clock:
                ex.flight_clock, ex.flight_direction = clock, "departure"
                work = _blank(work, fm.span())
            else:
                amb = _ambiguous_in_clause(fm.group(0))
                if amb:
                    ex.flight_ambiguous, ex.flight_direction = amb, "departure"
                    work = _blank(work, fm.span())

    try:
        clocks = []
        while True:
            clock, tspan = trip_dates.find_time(work)
            if not clock:
                break
            clocks.append(clock)
            work = _blank(work, tspan)
        distinct = list(dict.fromkeys(clocks))
        if len(distinct) > 1:
            ex.conflicts["departure_time"] = [f"{h:02d}:{mi:02d}" for h, mi in distinct]
        elif distinct:
            ex.clock = distinct[0]
    except DateError as exc:
        ex.date_error = str(exc)

    if ex.clock is None and not ex.conflicts:
        amb, aspan = trip_dates.find_ambiguous_clock(work)
        if amb:
            ex.ambiguous_hour, ex.ambiguous_minute = amb
            work = _blank(work, aspan)
    if ex.clock is None and ex.ambiguous_hour is None and not ex.conflicts:
        m = re.search(
            r"(?:\bat|\ba las|\ba la|@|\bit to|\btime to|\bhora a|\bpara las|\bsobre las)\s+(\d{1,2})\b"
            rf"(?!\s*(?::|/|\d|{PEOPLE}|{BAGS}|de\s+(?:{_MONTH_RE})))", work)
        if m:
            hour = int(m.group(1))
            if 1 <= hour <= 12:
                ex.ambiguous_hour = hour
            elif 13 <= hour <= 23:
                ex.clock = (hour, 0)
            work = _blank(work, m.span())
    if re.search(r"(?<!\d)\s*\b(?:pm|p\.\s?m\.?|afternoon|evening|night|tarde|noche|de la tarde|de la noche)\b", work):
        ex.period = "pm"
        ex.period_night = bool(re.search(r"\b(?:night|noche)\b", work))
    elif re.search(r"\b(?:am|a\.\s?m\.?|morning|madrugada|de la manana|por la manana|en la manana)\b", work):
        ex.period = "am"

    ex.pickup = _find_place(PICKUP_RES, original, norm, pnorm)
    ex.destination = _find_place(DEST_RES, original, norm, pnorm)
    if ex.pickup and ex.destination and ex.pickup == ex.destination:
        ex.destination = None

    people = [
        rf"\b{NUM}\s+(?:[a-z]+\s+)?{PEOPLE}\b",
        rf"\b(?:somos|son|seremos|we are|we're|party of|pax)\s+{NUM}\b(?!\s*(?:{BAGS}))",
        rf"\bfor\s+{NUM}\b(?!\s*(?::|am|pm|a\.m|p\.m|/|de\b|{BAGS}|hours?|minutes?))",
    ]
    values = list(dict.fromkeys(_all_values(people, work)))

    # "2 for tomorrow at 9 pm": the leading number is the party size,
    # not part of the date or departure time.
    leading_party = re.match(
        rf"^\s*({NUM})\s+for\s+(?:tomorrow|today|tonight|manana|hoy|esta noche)\b",
        norm,
    )
    if leading_party:
        party_size = to_int(leading_party.group(1))
        if 1 <= party_size <= 20 and party_size not in values:
            values.append(party_size)

    if len(values) > 1:
        ex.conflicts["passengers"] = values
    elif values:
        ex.passengers = values[0]

    if re.search(rf"\b(?:no|sin|zero|cero|without)\s+(?:[a-z]+\s+)?{BAGS}\b", work):
        ex.luggage = 0
    bags = list(dict.fromkeys(
        to_int(m.group(1)) for m in re.finditer(rf"\b{NUM}\s+(?:[a-z]+\s+)?{BAGS}\b", work)))
    if len(bags) > 1:
        ex.conflicts["luggage"] = bags
    elif bags:
        ex.luggage = bags[0]

    m = re.fullmatch(rf"\s*{NUM}\s*[.!]?\s*", work)
    if m:
        ex.bare_number = to_int(m.group(1))

    for name, rx in {
        "departure_time": r"\b(time|hora|horario|when|cuando)\b",
        "pickup": r"\b(pickup|pick up|recogida|recoger|origen|origin)\b",
        "destination": r"\b(destination|destino|drop ?off)\b",
        "passengers": r"\b(passengers?|people|pasajeros?|personas?)\b",
        "luggage": r"\b(bags?|luggage|maletas?|equipaje)\b",
        "date": r"\b(date|day|fecha|dia)\b",
    }.items():
        if re.search(rx, norm):
            ex.mentions.add(name)
    return ex
