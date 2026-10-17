import os
from types import SimpleNamespace
from unittest.mock import patch

from conversation import respond
from demo_fares import estimate


def trip(city, pickup, destination, currency):
    return SimpleNamespace(
        pickup_city=city,
        pickup=pickup,
        destination=destination,
        fare_currency=currency,
    )


def test_demo_fare_presets():
    routes = [
        ("Miami", "Miami Airport", "Miami Beach", "USD", "35.00"),
        ("Miami", "Miami Airport", "Downtown Miami", "USD", "28.00"),
        ("Medellín", "Medellín", "El Poblado", "COP", "25000"),
        ("Turin", "Turin Airport", "Turin city center", "EUR", "45.00"),
    ]

    with patch.dict(os.environ, {
        "RUEDA_FARE_MODE": "demo",
        "RUEDA_ENV": "development",
        "NODE_ENV": "development",
    }):
        for city, pickup, destination, currency, amount in routes:
            quote = estimate(trip(city, pickup, destination, currency))
            assert quote == {
                "amount": amount,
                "currency": currency,
                "source": "demo_preset",
                "verified": False,
            }


def test_unknown_route_has_no_invented_fare():
    with patch.dict(os.environ, {"RUEDA_FARE_MODE": "demo", "RUEDA_ENV": "development", "NODE_ENV": "development"}):
        assert estimate(trip("Miami", "Miami Airport", "Orlando", "USD")) is None


def test_demo_fares_disabled_by_default():
    with patch.dict(os.environ, {}, clear=True):
        assert estimate(trip("Miami", "Miami Airport", "Miami Beach", "USD")) is None


def test_demo_fares_blocked_in_production():
    for production_variable in ("NODE_ENV", "RUEDA_ENV"):
        with patch.dict(os.environ, {
            "RUEDA_FARE_MODE": "demo",
            "NODE_ENV": "development",
            "RUEDA_ENV": "development",
            production_variable: "production",
        }):
            assert estimate(trip("Miami", "Miami Airport", "Miami Beach", "USD")) is None


def test_fare_acceptance_and_rgb_payment_preference():
    with patch.dict(os.environ, {
        "RUEDA_FARE_MODE": "demo",
        "NODE_ENV": "development",
        "RUEDA_ENV": "development",
    }):
        messages = [
            "I need a ride from Miami Airport to Miami Beach tomorrow at 9 PM for 2 passengers",
            "yes",
            "yes",
            "digital",
            "USDT",
            "RGB on Bitcoin",
            "RUEDA",
        ]
        conversation_id = None
        results = []

        for message in messages:
            response = respond(message, conversation_id)
            conversation_id = response["conversation_id"]
            results.append(response)

            assert response["verified_fare"] is None
            assert response["booking"] is None
            assert response["checkout_enabled"] is False
            assert response["payments_enabled"] is False
            assert response["payment_selection"]["executed"] is False

        assert results[1]["fare_estimate"]["amount"] == "35.00"
        assert results[1]["fare_estimate"]["verified"] is False
        assert "pay" in results[2]["reply"].lower()
        assert results[-1]["payment_selection"]["currency"] == "RUEDA"


def test_demo_fares_require_explicit_development_environment():
    route = trip("Miami", "Miami Airport", "Miami Beach", "USD")

    with patch.dict(os.environ, {"RUEDA_FARE_MODE": "demo"}, clear=True):
        assert estimate(route) is None

    with patch.dict(os.environ, {
        "RUEDA_FARE_MODE": "demo",
        "RUEDA_ENV": "production",
    }, clear=True):
        assert estimate(route) is None

    with patch.dict(os.environ, {
        "RUEDA_FARE_MODE": "demo",
        "RUEDA_ENV": "development",
    }, clear=True):
        assert estimate(route)["amount"] == "35.00"
