from __future__ import annotations
import re
from dataclasses import dataclass, field
from uuid import uuid4
from trip_details import TripDetails
import extraction
import trip_dates
from datetime import datetime
from datetime import date, timedelta
from trip_dates import parse_trip_date

@dataclass
class Conversation:
    conversation_id: str
    ride_type: str | None = None
    trip: TripDetails = field(default_factory=TripDetails)
    stage: str = "ride"
    payment_category: str | None = None
    currency: str | None = None
    network: str | None = None
    messages: list[dict] = field(default_factory=list)
    language: str = "en"          # reply language; "en" until something is detected
    language_detected: bool = False
    pending_date: date | None = None
    pending_clock: tuple[int, int] | None = None
    awaiting_luggage: bool = False
    confirmed: bool = False
    pending_hour: int | None = None          # bare 1-12 hour awaiting am/pm
    pending_hour_day: date | None = None
    # Flight time lacking am/pm: (hour, minute, direction, day) awaiting clarification.
    pending_flight: tuple | None = None
    pending_minute: int = 0

# Local prototype only. Sessions reset when FastAPI restarts.
conversations: dict[str, Conversation] = {}

FLAG_VEHICLE = "vehicle_suitability_requires_approved_rule"
FLAG_AIRPORT_BUFFER = "airport_pickup_buffer_requires_approved_rule"
# Departing-flight pickups: only "pickup before flight" is enforced. Any gap/buffer
# is Rueda policy (not yet approved), so we only add a notice; no validation or adjustment.
TRIP_STAGES = ("ride", "trip_confirmation")


def detect_ride_type(message: str) -> str | None:
    return extraction.detect_ride_type(trip_dates.normalize(message))[0]


QUESTIONS = {
    "en": {
        "ride_type": "Hi! Welcome to Rueda. How can we help with your ride?",
        "pickup": "Great! Where should we pick you up?",
        "destination": "Where would you like to go?",
        "departure_time": "What date and time do you need the ride?",
        "passengers": "How many passengers will be traveling?",
    },
    "es": {
        "ride_type": "¡Hola! Bienvenido a Rueda. ¿En qué te podemos ayudar con tu viaje?",
        "pickup": "¡Perfecto! ¿Dónde te recogemos?",
        "destination": "¿A dónde quieres ir?",
        "departure_time": "¿Qué fecha y hora necesitas el viaje?",
        "passengers": "¿Cuántos pasajeros viajan?",
    },
}
RIDE_NAMES = {
    "en": {"airport_transfer": "airport transfer", "city_ride": "city ride",
           "executive_ride": "executive ride"},
    "es": {"airport_transfer": "traslado al aeropuerto", "city_ride": "viaje por la ciudad",
           "executive_ride": "viaje ejecutivo"},
}


def _fmt(iso: str) -> str:
    return datetime.fromisoformat(iso).strftime("%Y-%m-%d %H:%M")


def _flight(conversation) -> datetime | None:
    ft = conversation.trip.flight_time
    return datetime.fromisoformat(ft) if ft else None


def _departing_flight(conversation) -> datetime | None:
    if conversation.trip.flight_direction == "departure":
        return _flight(conversation)
    return None


def _minutes_before_flight(conversation) -> float | None:
    flight = _departing_flight(conversation)
    dep = conversation.trip.departure_time
    if not flight or not dep:
        return None
    return (flight - datetime.fromisoformat(dep)).total_seconds() / 60


FIELD_NAMES = {
    "en": {"departure_time": "the time", "passengers": "passengers", "luggage": "luggage"},
    "es": {"departure_time": "la hora", "passengers": "pasajeros", "luggage": "maletas"},
}


def _ask_missing(conversation, lang: str) -> str:
    missing = conversation.trip.missing_fields()
    name = missing[0]
    t = conversation.trip
    if name == "departure_time" and t.flight_time and t.flight_direction == "arrival":
        flight = _fmt(t.flight_time)
        if lang == "es":
            return (f"Tu vuelo aterriza el {flight} (hora de Medellín). ¿Quieres que te "
                    f"recojamos a esa hora? Responde sí o indícanos otra hora de recogida.")
        return (f"Your flight lands {flight} (Medellín time). Should we schedule the "
                "pickup for that time? Reply yes, or tell us a different pickup time.")
    if name == "departure_time" and t.flight_time:
        flight = _fmt(t.flight_time)
        if lang == "es":
            return (f"Tu vuelo sale el {flight} (hora de Medellín). ¿A qué hora "
                    "quieres que te recojamos? Debe ser antes de la salida del vuelo. "
                    "Rueda aún no tiene una política aprobada de anticipación para "
                    "aeropuerto, así que no calculamos la hora por ti.")
        return (f"Your flight departs {flight} (Medellín time). What pickup time "
                "would you like? It must be before your flight. Rueda has no "
                "approved airport buffer policy yet, so we won't calculate one for you.")
    if name == "departure_time" and conversation.pending_date and not conversation.pending_clock:
        return ("¿A qué hora necesitas el viaje?" if lang == "es"
                else "What time do you need the ride?")
    return QUESTIONS[lang][name]


def _bilingual_welcome(conversation) -> str:
    """Language unknown so far: one English line, then one Spanish line."""
    en = _ask_missing(conversation, "en")
    es = _ask_missing(conversation, "es")
    if conversation.trip.missing_fields()[0] != "ride_type":
        en = "Hi! Welcome to Rueda. " + en.replace("Great! ", "")
        es = "¡Hola! Bienvenido a Rueda. " + es.replace("¡Perfecto! ", "")
    return en + "\n" + es


def _summary(conversation, lang: str) -> str:
    t = conversation.trip
    ride = RIDE_NAMES[lang].get(t.ride_type, t.ride_type)
    close = _minutes_before_flight(conversation)
    es = lang == "es"
    if es:
        text = (f"Por favor confirma tu {ride}: recogida en {t.pickup}, destino "
                f"{t.destination}, salida {_fmt(t.departure_time)} (hora de Medellín), "
                f"{t.passengers} pasajeros")
        if t.luggage is not None:
            text += f", {t.luggage} maletas"
        if t.flight_time:
            kind = "llegada del vuelo" if t.flight_direction == "arrival" else "vuelo"
            text += f", {kind} {_fmt(t.flight_time)}"
        text += (f". La idoneidad del vehículo para {t.passengers} pasajeros"
                 + (f" y {t.luggage} maletas" if t.luggage is not None else "")
                 + " requiere una regla aprobada de Rueda.")
        if close is not None:
            text += (" El horario del traslado al aeropuerto está sujeto a la "
                     "política de Rueda.")
        return text + (" ¿Todo está correcto? Responde sí para confirmar los "
                       "detalles del viaje. Esto no autoriza ningún pago.")
    text = (f"Please confirm your {ride}: pickup at {t.pickup}, destination "
            f"{t.destination}, departure {_fmt(t.departure_time)} (Medellín time), "
            f"{t.passengers} passengers")
    if t.luggage is not None:
        text += f", {t.luggage} suitcases"
    if t.flight_time:
        kind = "flight arrival" if t.flight_direction == "arrival" else "flight"
        text += f", {kind} {_fmt(t.flight_time)}"
    text += (f". Vehicle suitability for {t.passengers} passengers"
             + (f" and {t.luggage} suitcases" if t.luggage is not None else "")
             + " needs an approved Rueda rule.")
    if close is not None:
        text += " Airport-transfer timing is subject to Rueda's policy."
    return text + (" Is everything correct? Reply yes or sí to confirm the trip "
                   "details. This does not authorize payment.")


def _set_departure(conversation, when: datetime, lang: str) -> str | None:
    """Validate and store a departure. Returns an error message or None."""
    if when <= trip_dates.now():
        return _localize_error(trip_dates.PAST, lang)
    flight = _departing_flight(conversation)
    if flight and when >= flight:
        if lang == "es":
            return (f"La hora de recogida debe ser antes de tu vuelo ({_fmt(flight.isoformat())}). "
                    "¿A qué hora te recogemos?")
        return (f"The pickup time must be before your flight ({_fmt(flight.isoformat())}). "
                "What pickup time would you like?")
    conversation.trip.departure_time = when.isoformat()
    conversation.pending_date = None
    conversation.pending_clock = None
    return None


def _ambiguous_question(hour: int, lang: str, conversation, minute: int = 0) -> str:
    keep = ""
    if conversation.trip.departure_time:
        cur = _fmt(conversation.trip.departure_time)
        keep = (f" La hora actual ({cur}) no cambia hasta que lo aclares." if lang == "es"
                else f" The current time ({cur}) stays unchanged until you clarify.")
    if minute:
        hour = f"{hour}:{minute:02d}"
    if lang == "es":
        return f"¿Te refieres a las {hour} de la mañana o a las {hour} de la tarde/noche?" + keep
    return f"Did you mean {hour} AM or {hour} PM?" + keep


def _localize_error(error: str | None, lang: str) -> str | None:
    """Date/time validation errors from trip_dates are English; translate them for Spanish."""
    if error is not None and lang == "es":
        return trip_dates.ES_ERRORS.get(error, error)
    return error


def _conflict_question(name: str, values, lang: str) -> str:
    label = FIELD_NAMES[lang].get(name, name)
    vals = (" y " if lang == "es" else " and ").join(str(v) for v in values)
    if lang == "es":
        return f"Recibí valores distintos para {label}: {vals}. ¿Cuál es el correcto?"
    return f"I received different values for {label}: {vals}. Which one is correct?"


def _apply(conversation, ex, awaiting: str | None) -> tuple[str | None, list[str]]:
    """Merge extracted fields into the trip. Returns (error, questions)."""
    trip = conversation.trip
    lang = conversation.language
    error = _localize_error(ex.date_error, lang)
    questions: list[str] = []

    if ex.ride_type and (ex.ride_type_strong or trip.ride_type is None):
        trip.ride_type = ex.ride_type
        conversation.ride_type = ex.ride_type
    for name in ("pickup", "destination", "passengers", "luggage"):
        value = getattr(ex, name)
        if value is not None:
            setattr(trip, name, value)
    for name, values in ex.conflicts.items():
        questions.append(_conflict_question(name, values, lang))

    # Relative edits.
    if ex.passengers_delta is not None:
        if trip.passengers is None or trip.passengers + ex.passengers_delta < 1:
            questions.append("¿Cuántos pasajeros en total?" if lang == "es"
                             else "How many passengers in total?")
        else:
            trip.passengers += ex.passengers_delta
    if ex.luggage_delta is not None:
        if trip.luggage is None or trip.luggage + ex.luggage_delta < 0:
            questions.append("¿Cuántas maletas en total?" if lang == "es"
                             else "How many suitcases in total?")
        else:
            trip.luggage += ex.luggage_delta

    # Bare answers to the question we just asked.
    if not ex.has_content():
        bare = ex.bare_text or ""
        simple = extraction.simple_text(bare)
        if (awaiting in ("pickup", "destination") and bare
                and simple not in extraction.AFFIRMATIVES
                and simple not in extraction.NEGATIVES
                and ex.bare_number is None):
            setattr(trip, awaiting, bare)
        elif awaiting == "passengers" and ex.bare_number:
            trip.passengers = ex.bare_number

    if error is not None:
        return error, questions

    # Ambiguous FLIGHT time: ask am/pm for the flight, never for the pickup.
    if ex.flight_ambiguous is not None:
        h, mi = ex.flight_ambiguous
        conversation.pending_flight = (h, mi, ex.flight_direction,
                                       ex.date or conversation.pending_date)
        if ex.date:
            conversation.pending_date = ex.date
        label = f"{h}:{mi:02d}" if mi else f"{h}"
        questions.append(
            f"¿Tu vuelo es a las {label} de la mañana o de la tarde/noche?" if lang == "es"
            else f"Is your flight at {label} AM or {label} PM?")
        return None, questions
    if (conversation.pending_flight is not None and ex.period and ex.clock is None
            and ex.ambiguous_hour is None and ex.flight_clock is None):
        h, mi, direction, fday = conversation.pending_flight
        conversation.pending_flight = None
        ex.flight_clock = (h % 12 + (12 if ex.period == "pm" else 0), mi)
        ex.flight_direction = direction
        ex.date = ex.date or fday
        ex.period = None
    elif ex.flight_clock is not None:
        conversation.pending_flight = None

    # Resolve a pending bare hour with 'pm', 'de la mañana', ...
    clock, day_from_msg = ex.clock, ex.date
    if clock is None and ex.ambiguous_hour is None and conversation.pending_hour is not None and ex.period:
        h = conversation.pending_hour % 12 + (12 if ex.period == "pm" else 0)
        if conversation.pending_hour == 12 and ex.period_night:
            h = 0  # '12' + 'de la noche' = midnight
        clock = (h, conversation.pending_minute)
        day_from_msg = day_from_msg or conversation.pending_hour_day
    if clock is not None and conversation.pending_hour is not None:
        # Keep the date from the clarified message ('mañana a las 10:00' -> '10 de la mañana').
        day_from_msg = day_from_msg or conversation.pending_hour_day
    if clock is not None or ex.ambiguous_hour is not None:
        conversation.pending_hour = None
        conversation.pending_hour_day = None
    if ex.ambiguous_hour is not None:
        conversation.pending_hour = ex.ambiguous_hour
        conversation.pending_hour_day = ex.date
        conversation.pending_minute = ex.ambiguous_minute
        questions.append(_ambiguous_question(ex.ambiguous_hour, lang, conversation, ex.ambiguous_minute))
        return None, questions

    current_day = (datetime.fromisoformat(trip.departure_time).date()
                   if trip.departure_time else None)
    if ex.flight_clock:
        flight = _flight(conversation)
        fday = ex.date or (flight.date() if flight else None) or current_day or conversation.pending_date
        if fday:
            trip.flight_time = trip_dates.combine(fday, ex.flight_clock).isoformat()
            trip.flight_direction = ex.flight_direction
            dflight = _departing_flight(conversation)
            if dflight and trip.departure_time and datetime.fromisoformat(trip.departure_time) >= dflight:
                trip.departure_time = None
        if ex.date:
            conversation.pending_date = ex.date
    flight = _flight(conversation)
    day = day_from_msg if not ex.flight_clock else None
    if clock:
        day = day or current_day or (flight.date() if flight else None) or conversation.pending_date
        if day:
            error = _set_departure(conversation, trip_dates.combine(day, clock), lang)
        else:
            conversation.pending_clock = clock
    elif day:
        if current_day:  # new day, keep the previously given clock time
            old = datetime.fromisoformat(trip.departure_time)
            error = _set_departure(conversation, trip_dates.combine(day, (old.hour, old.minute)), lang)
        elif conversation.pending_clock:
            error = _set_departure(conversation, trip_dates.combine(day, conversation.pending_clock), lang)
        else:
            conversation.pending_date = day
    if ex.minutes_delta is not None and error is None:
        if trip.departure_time:
            new = datetime.fromisoformat(trip.departure_time) + timedelta(minutes=ex.minutes_delta)
            error = _set_departure(conversation, new, lang)
        else:
            questions.append(QUESTIONS[lang]["departure_time"])
    return error, questions


def _what_to_change(ex, lang: str, simple: str) -> str:
    """Unconfirmed reply for 'no', 'yes but...', or unclear input. Never says 'confirmed'."""
    asks = {
        "departure_time": ("What new date or time would you like?", "¿Qué nueva fecha u hora prefieres?"),
        "pickup": ("What is the new pickup location?", "¿Cuál es el nuevo lugar de recogida?"),
        "destination": ("What is the new destination?", "¿Cuál es el nuevo destino?"),
        "passengers": ("How many passengers should it be?", "¿Cuántos pasajeros serán?"),
        "luggage": ("How many suitcases should it be?", "¿Cuántas maletas serán?"),
    }
    i = 1 if lang == "es" else 0
    for name in ("departure_time", "pickup", "destination", "passengers", "luggage"):
        if name in ex.mentions or (name == "departure_time" and "date" in ex.mentions):
            return asks[name][i]
    if simple in extraction.NEGATIVES or re.match(r"(yes|si|ok|sure|claro)\b", simple):
        return ("¿Qué te gustaría cambiar: recogida, destino, fecha y hora, pasajeros o maletas?"
                if lang == "es" else
                "What would you like to change: pickup, destination, date and time, passengers, or luggage?")
    return ("Responde sí para confirmar los datos del viaje "
            "o no para corregirlos. No se iniciará ningún pago." if lang == "es" else
            "Please reply yes or sí to confirm the trip details, "
            "or no to correct them. No payment will be initiated.")


def _flags(conversation) -> list[str]:
    flags = []
    t = conversation.trip
    if t.passengers is not None or t.luggage is not None:
        flags.append(FLAG_VEHICLE)
    if t.flight_time:
        flags.append(FLAG_AIRPORT_BUFFER)
    return flags


def _snapshot(conversation) -> dict:
    return conversation.trip.to_dict()


# Payment-choice tokens carry no language signal ('on' in 'on-chain' looks English).
PAYMENT_CHOICE_TOKENS = frozenset({
    "on", "chain", "onchain", "lightning", "ln", "rgb", "ark", "btc", "bitcoin",
    "usdt", "tether", "digital", "crypto", "traditional", "cash", "card",
})


def _payment_choice_only(message: str) -> bool:
    words = extraction.simple_text(message).split()
    return bool(words) and all(w in PAYMENT_CHOICE_TOKENS for w in words)


def respond(message: str, conversation_id: str | None = None) -> dict:
    if not message.strip():
        raise ValueError("Message cannot be empty")

    conversation = conversations.get(conversation_id) if conversation_id else None
    if conversation is None:
        conversation = Conversation(conversation_id=str(uuid4()))
        conversations[conversation.conversation_id] = conversation

    text = message.casefold().strip()
    conversation.messages.append({"role": "user", "content": message})

    lang = extraction.detect_language(message)
    if _payment_choice_only(message):
        lang = None  # bare payment choices ('on-chain', 'btc', ...) are language-neutral
    if lang:  # undetermined messages keep the previous language
        conversation.language = lang
        conversation.language_detected = True
    lang = conversation.language
    ex = extraction.extract(message, trip_dates.now().date())
    simple = extraction.simple_text(message)
    in_trip = conversation.stage in TRIP_STAGES
    # After confirmation, only real trip content re-opens the itinerary; payment
    # words ('digital', 'bitcoin', 'lightning', ...) never count as corrections.
    use_trip = in_trip or ex.has_content()

    if use_trip:
        before = _snapshot(conversation)
        missing_before = conversation.trip.missing_fields()
        awaiting = missing_before[0] if (in_trip and missing_before) else None
        arrival_accept = (
            in_trip and awaiting == "departure_time"
            and conversation.trip.flight_direction == "arrival"
            and conversation.trip.flight_time and not ex.has_content()
            and simple in extraction.AFFIRMATIVES
        )
        if arrival_accept:  # user explicitly accepted the arrival time as pickup
            error, questions = _set_departure(
                conversation, datetime.fromisoformat(conversation.trip.flight_time), lang), []
        else:
            error, questions = _apply(conversation, ex, awaiting)
        changed = _snapshot(conversation) != before
        complete = conversation.trip.is_complete()
        reset_note = ""
        if changed and (conversation.confirmed or not in_trip):
            conversation.confirmed = False
            conversation.payment_category = None
            conversation.currency = None
            conversation.network = None
            conversation.stage = "trip_confirmation"
            reset_note = ("Tus datos del viaje cambiaron, así que se borraron la confirmación "
                          "anterior y la selección de pago. " if lang == "es" else
                          "Your trip details changed, so the previous confirmation and "
                          "payment selection were cleared. ")
        if questions or error:
            msgs = ([error] if error else []) + questions
            reply = reset_note + " ".join(msgs)
            if changed and complete:
                reply += " " + _summary(conversation, lang)
            if not complete and conversation.stage == "trip_confirmation":
                conversation.stage = "ride"
            elif changed and complete:
                conversation.stage = "trip_confirmation"
        elif not complete:
            conversation.stage = "ride"
            if not conversation.language_detected:
                reply = _bilingual_welcome(conversation)
            else:
                reply = reset_note + _ask_missing(conversation, lang)
        elif changed:
            conversation.stage = "trip_confirmation"
            reply = reset_note + _summary(conversation, lang)
        elif not in_trip:
            reply = ("Esos datos coinciden con tu viaje; no hubo cambios." if lang == "es"
                     else "Those details match your current trip; nothing changed.")
        elif conversation.stage == "trip_confirmation" and simple in extraction.AFFIRMATIVES:
            conversation.stage = "payment_category"
            conversation.confirmed = True
            if lang == "es":
                reply = (
                    "Detalles del viaje confirmados. Todavía no hay una tarifa verificada "
                    "en COP, así que el pago sigue deshabilitado. ¿Prefieres pagos "
                    "tradicionales o pagos digitales para esta demostración?"
                )
            else:
                reply = (
                    "Trip details confirmed. A verified fare in COP is not yet available, "
                    "so checkout remains disabled. Would you prefer traditional "
                    "payments or digital payments for this demo?"
                )
        else:
            conversation.stage = "trip_confirmation" if complete else "ride"
            reply = _what_to_change(ex, lang, simple)

    elif conversation.stage == "payment_category":
        es = lang == "es"
        if re.search(r"\b(digital|digitale|digitales|crypto|cripto)\b", text):
            conversation.payment_category = "digital"
            conversation.stage = "digital_currency"
            reply = ("Perfecto. ¿Prefieres Bitcoin (BTC) o USDT?" if es
                     else "Great. Would you prefer Bitcoin (BTC) or USDT?")
        elif re.search(r"\b(traditional|tradicional|cash|efectivo|card|tarjeta)\b", text):
            conversation.payment_category = "traditional"
            conversation.stage = "complete"
            reply = (
                "Seleccionaste pagos tradicionales. Efectivo, tarjeta y transferencia "
                "bancaria son opciones previstas, pero ninguna está conectada todavía. "
                "No se ha realizado ningún cobro." if es else
                "Traditional payment selected. Cash, card, and bank transfer "
                "are planned options; none is connected yet. No charge has been made."
            )
        else:
            reply = ("Elige pagos tradicionales o pagos digitales." if es
                     else "Please choose traditional payments or digital payments.")

    elif conversation.stage == "digital_currency":
        es = lang == "es"
        if re.search(r"\b(btc|bitcoin)\b", text):
            conversation.currency = "BTC"
            conversation.stage = "btc_network"
            reply = (
                "Bitcoin seleccionado. ¿Qué opción te interesa: on-chain, Lightning, "
                "RGB o Ark? Estas son opciones de demostración; los pagos no están "
                "habilitados." if es else
                "Bitcoin selected. Which route interests you: on-chain, "
                "Lightning, RGB, or Ark? These are demo selections, "
                "not enabled payment methods."
            )
        elif re.search(r"\b(usdt|tether)\b", text):
            conversation.currency = "USDT"
            conversation.stage = "usdt_network"
            reply = (
                "Seleccionaste USDT. La disponibilidad de redes y cualquier intercambio "
                "entre cadenas dependerán de las integraciones compatibles. Todavía no "
                "hay ninguna red USDT ni intercambio habilitado." if es else
                "USDT selected. Network availability and any cross-chain "
                "swap will depend on supported integrations. "
                "No USDT network or swap is enabled yet."
            )
        else:
            reply = "Elige BTC o USDT." if es else "Please choose BTC or USDT."

    elif conversation.stage == "btc_network":
        es = lang == "es"
        options = {
            "on-chain": r"\b(on.chain|onchain|cadena)\b",
            "lightning": r"\b(lightning|ln)\b",
            "rgb": r"\brgb\b",
            "ark": r"\bark\b",
        }
        selected = next(
            (name for name, pattern in options.items() if re.search(pattern, text)),
            None,
        )
        if selected:
            conversation.network = selected
            conversation.stage = "complete"
            display_network = "RGB" if selected == "rgb" else selected
            reply = (
                f"Seleccionaste BTC mediante {display_network}. Esta es solo una "
                "preferencia de demostración. No se ha generado ninguna dirección de "
                "pago, factura ni transacción." if es else
                f"You selected BTC via {display_network}. This is a demo preference "
                "only. No payment address, invoice, or transaction has been created."
            )
        else:
            reply = ("Elige on-chain, Lightning, RGB o Ark." if es
                     else "Please choose on-chain, Lightning, RGB, or Ark.")

    elif conversation.stage == "usdt_network":
        reply = (
            "Las integraciones de redes USDT e intercambios todavía no están disponibles "
            "en este prototipo. No se ha iniciado ningún pago." if lang == "es" else
            "USDT network and swap integrations are not available in this "
            "prototype yet. No payment has been initiated."
        )

    else:
        reply = (
            "Hemos registrado tu preferencia de pago para esta demostración local. "
            "No se ha enviado ninguna reserva ni se ha iniciado ningún pago."
            if lang == "es" else
            "Your payment preference has been noted for this local demo. "
            "No booking has been dispatched and no payment has been initiated."
        )

    conversation.messages.append({"role": "assistant", "content": reply})
    return {
        "conversation_id": conversation.conversation_id,
        "reply": reply,
        "booking": None,
        "trip": conversation.trip.to_dict(),
        "payment_selection": {
            "category": conversation.payment_category,
            "currency": conversation.currency,
            "network": conversation.network,
        },
        "payments_enabled": False,
        "demo_only": True,
        "flags": _flags(conversation),
        "missing_fields": conversation.trip.missing_fields(),
        "trip_confirmed": conversation.confirmed,
        "pending_clarification": (conversation.pending_hour is not None
                                  or conversation.pending_flight is not None),
        "pending_flight_clarification": conversation.pending_flight is not None,
    }
