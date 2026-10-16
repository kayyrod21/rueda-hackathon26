import json
from pathlib import Path

import rgb_lib as rgb
from fastapi import FastAPI, HTTPException, Header

app = FastAPI(
    title="Rueda RGB Payment API",
    version="0.2.0",
)

WALLET_DIR = Path.home() / "dev/rueda-rgb/rueda-test-wallet"
ASSET_ID = "rgb:Jf~5_Vys-BJN7Gdj-UGcxEcR-FutiMwF-v~38rxx-2vYwt00"


def load_wallet():
    with (WALLET_DIR / "recovery.json").open() as f:
        saved = json.load(f)

    keys = rgb.SinglesigKeys(
        account_xpub_vanilla=saved["account_xpub_vanilla"],
        account_xpub_colored=saved["account_xpub_colored"],
        vanilla_keychain=None,
        master_fingerprint=saved["master_fingerprint"],
        mnemonic=saved["mnemonic"],
        witness_version=rgb.WitnessVersion.SEG_WIT_V0,
    )

    return rgb.Wallet(
        rgb.WalletData(
            data_dir=str(WALLET_DIR / "data"),
            bitcoin_network=rgb.BitcoinNetwork.SIGNET_CUSTOM,
            database_type=rgb.DatabaseType.SQLITE,
            max_allocations_per_utxo=5,
            supported_schemas=[rgb.AssetSchema.NIA],
        ),
        keys,
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "rueda-rgb-payment-api",
        "network": "mutinynet",
    }


@app.get("/wallet/status")
def wallet_status(
    x_payment_operator_key: str | None = Header(default=None),
):
    require_payment_operator_key(x_payment_operator_key)
    try:
        wallet = load_wallet()

        for asset in wallet.list_assets([]).nia:
            if asset.asset_id == ASSET_ID:
                return {
                    "network": "mutinynet",
                    "asset": {
                        "ticker": asset.ticker,
                        "asset_id": asset.asset_id,
                        "schema": "NIA",
                    },
                    "balance": {
                        "settled": asset.balance.settled,
                        "future": asset.balance.future,
                        "spendable": asset.balance.spendable,
                    },
                    "balance_source": "local_wallet_cache",
                    "blockchain_sync_performed": False,
                    "payments_enabled": False,
                }

        raise HTTPException(status_code=404, detail="RUEDA asset not found")

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Unable to read local RGB wallet state",
        )

from dataclasses import asdict
from typing import Literal
from pricing import calculate_quote

@app.get("/quote")
def get_quote(
    ride_type: Literal[
        "airport_transfer",
        "city_ride",
        "executive_ride",
    ]
):
    quote = calculate_quote(ride_type)
    return {
        **asdict(quote),
        "approval_required": True,
        "payment_status": "not_started",
    }

from dataclasses import asdict
from typing import Literal
from pricing import calculate_quote

@app.get("/quote")
def get_quote(
    ride_type: Literal[
        "airport_transfer",
        "city_ride",
        "executive_ride",
    ]
):
    quote = calculate_quote(ride_type)
    return {
        **asdict(quote),
        "approval_required": True,
        "payment_status": "not_started",
    }

from dataclasses import asdict
from typing import Literal
from pricing import calculate_quote

@app.get("/quote")
def get_quote(
    ride_type: Literal[
        "airport_transfer",
        "city_ride",
        "executive_ride",
    ]
):
    quote = calculate_quote(ride_type)
    return {
        **asdict(quote),
        "approval_required": True,
        "payment_status": "not_started",
    }

from dataclasses import asdict as booking_asdict
from approval import create_booking

from fastapi import Depends
from payment_auth import require_payment_api_key

@app.post("/bookings")
def create_booking_endpoint(
    ride_type: Literal[
        "airport_transfer",
        "city_ride",
        "executive_ride",
    ],
    authenticated: bool = Depends(require_payment_api_key),
):
    booking = save_booking(ride_type)
    return {
        **booking,
        "demo_only": True,
        "message": "Quote created. Customer approval is required.",
    }

from booking_store import save_booking

from booking_store import approve_booking, get_booking

@app.post("/bookings/{booking_id}/approve")
def approve_booking_endpoint(
    booking_id: str,
    x_payment_operator_key: str | None = Header(default=None),
):
    require_payment_operator_key(x_payment_operator_key)

    booking = get_booking(booking_id)

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    if booking["status"] not in ("awaiting_approval", "approved"):
        raise HTTPException(
            status_code=409,
            detail="Booking cannot be approved",
        )

    approved = approve_booking(booking_id)

    return {
        **approved,
        "demo_only": True,
        "message": "Quote approved. No RGB payment has been initiated.",
    }


# Local development chat endpoint. Do not expose publicly without authentication.
from pydantic import BaseModel, Field
from conversation import respond
from qvac_welcome import welcome_reply

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None

@app.post("/chat")
def chat_endpoint(
    request: ChatRequest,
    authenticated: bool = Depends(require_payment_api_key),
):
    try:
        result = respond(request.message, request.conversation_id)
        if (
            result["trip"]["ride_type"] is None
            and result["payment_selection"]["category"] is None
        ):
            result["reply"] = result["reply"]  # Preserve validated bilingual response
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# QVAC payment requests: authentication required, no token transfers.
from fastapi import Depends
from payment_auth import require_payment_api_key
from payment_store import create_payment_request
import sqlite3


class PaymentRequestInput(BaseModel):
    booking_id: str = Field(min_length=1, max_length=100)
    recipient_id: str = Field(min_length=1, max_length=500)


@app.post("/payments/requests", status_code=201)
def propose_payment(
    request: PaymentRequestInput,
    authenticated: bool = Depends(require_payment_api_key),
):
    try:
        return create_payment_request(
            request.booking_id,
            request.recipient_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="A payment request already exists for this booking",
        )


# Operator-only approval. Does not initiate RGB transfers.
from payment_auth import require_payment_operator_key
from payment_store import approve_payment_request


@app.post("/payments/requests/{request_id}/approve")
def approve_rgb_payment_request(
    request_id: str,
    authenticated: bool = Depends(require_payment_operator_key),
):
    try:
        return approve_payment_request(request_id)
    except ValueError as exc:
        message = str(exc)
        raise HTTPException(
            status_code=404 if message == "Payment request not found" else 409,
            detail=message,
        )
