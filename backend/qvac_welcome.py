"""Optional local QVAC wording for Rueda's welcome message."""

import json
import urllib.error
import urllib.request

QVAC_URL = "http://127.0.0.1:11434/v1/chat/completions"
QVAC_MODEL = "llama-3-2-1b-inst-q4-0"


def welcome_reply(original_reply: str, customer_message: str) -> str:
    """Generate a welcome only; fall back to the deterministic reply."""
    payload = {
        "model": QVAC_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Rueda Mobility's friendly concierge in Medellín. "
                    "Write exactly one short welcoming sentence in the same "
                    "language as the customer. Use simple, everyday language. Ask how you can help "
                    "with their ride. Do not list service categories. "
                    "Do not invent prices, bookings, availability, or payments."
                ),
            },
            {"role": "user", "content": customer_message},
        ],
        "max_tokens": 100,
        "temperature": 0.2,
        "stream": False,
    }

    request = urllib.request.Request(
        QVAC_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            result = json.load(response)

        reply = result["choices"][0]["message"]["content"].strip()

        if not reply or len(reply) > 350:
            return original_reply

        return reply
    except (OSError, ValueError, KeyError, IndexError, TypeError):
        return original_reply
