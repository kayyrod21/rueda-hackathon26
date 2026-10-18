import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unavailable" }, { status: 403 });
  }

  const apiUrl = process.env.RUEDA_PAYMENT_API_URL;
  const keyFile = process.env.RUEDA_PAYMENT_OPERATOR_KEY_FILE;

  if (apiUrl !== "http://127.0.0.1:8001" || !keyFile) {
    return NextResponse.json(
      { error: "Local payment API not configured" },
      { status: 503 },
    );
  }

  let input: Record<string, unknown>;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Invalid body");
    }
    input = body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const rideReference = input.ride_reference;
  const bookingId = input.payment_booking_id;
  const rideType = input.ride_type;

  if (
    typeof rideReference !== "string" ||
    !/^RDA-[A-F0-9]{8}$/.test(rideReference) ||
    typeof bookingId !== "string" ||
    !/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(bookingId) ||
    !["airport_transfer", "city_ride", "executive_ride"].includes(
      String(rideType),
    )
  ) {
    return NextResponse.json(
      { error: "Invalid ride payment details" },
      { status: 422 },
    );
  }

  try {
    const operatorKey = (await readFile(keyFile, "utf8")).trim();
    if (!operatorKey) throw new Error("Missing operator key");

    const headers = { "X-Payment-Operator-Key": operatorKey };

    const lookupUrl = new URL(
      `/rides/${rideReference}/payment-booking`,
      apiUrl,
    );
    lookupUrl.searchParams.set("ride_type", String(rideType));

    const lookupResponse = await fetch(lookupUrl, {
      method: "POST",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!lookupResponse.ok) {
      return NextResponse.json(
        { error: "Unable to validate ride payment" },
        { status: 502 },
      );
    }

    const booking = await lookupResponse.json();

    if (
      booking.ride_reference !== rideReference ||
      booking.booking_id !== bookingId ||
      booking.ride_type !== rideType ||
      booking.asset !== "RUEDA"
    ) {
      return NextResponse.json(
        { error: "Ride payment booking mismatch" },
        { status: 409 },
      );
    }

    const statusResponse = await fetch(
      new URL(`/bookings/${bookingId}/payment-status`, apiUrl),
      {
        method: "GET",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!statusResponse.ok) {
      return NextResponse.json(
        { error: "Unable to retrieve payment status" },
        { status: 502 },
      );
    }

    const status = await statusResponse.json();

    // This wallet currently reads cached records without live blockchain sync.
    // Do not report payment as blockchain-verified.
    return NextResponse.json(
      {
        ride_reference: rideReference,
        payment_booking_id: bookingId,
        status: status.status,
        payment_verified: false,
        blockchain_sync_performed: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Ride payment status unavailable" },
      { status: 503 },
    );
  }
}
