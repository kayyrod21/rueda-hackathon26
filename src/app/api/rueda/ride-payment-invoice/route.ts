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
      { error: "Payment API not configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const rideReference = input.ride_reference;
  const paymentBookingId = input.payment_booking_id;
  const expectedAmount = input.amount;

  if (
    typeof rideReference !== "string" ||
    !/^RDA-[A-F0-9]{8}$/.test(rideReference) ||
    typeof paymentBookingId !== "string" ||
    !/^[0-9a-fA-F-]{36}$/.test(paymentBookingId) ||
    !Number.isInteger(expectedAmount) ||
    (expectedAmount as number) < 1 ||
    (expectedAmount as number) > 15
  ) {
    return NextResponse.json(
      { error: "Invalid ride payment details" },
      { status: 422 },
    );
  }

  try {
    const operatorKey = (await readFile(keyFile, "utf8")).trim();
    if (!operatorKey) throw new Error("Missing operator key");

    // Resolve the authoritative payment booking linked to this ride.
    const lookupUrl = new URL(
      `/rides/${rideReference}/payment-booking`,
      apiUrl,
    );

    // The payment API requires a ride type for this lookup.
    const rideType = input.ride_type;
    if (
      rideType !== "airport_transfer" &&
      rideType !== "city_ride" &&
      rideType !== "executive_ride"
    ) {
      return NextResponse.json(
        { error: "Invalid ride type" },
        { status: 422 },
      );
    }

    lookupUrl.searchParams.set("ride_type", rideType);

    const lookupResponse = await fetch(lookupUrl, {
      method: "POST",
      headers: { "X-Payment-Operator-Key": operatorKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!lookupResponse.ok) {
      return NextResponse.json(
        { error: "Unable to validate ride payment booking" },
        { status: 502 },
      );
    }

    const booking = await lookupResponse.json();

    if (
      booking.ride_reference !== rideReference ||
      booking.booking_id !== paymentBookingId ||
      booking.ride_type !== rideType ||
      booking.amount !== expectedAmount ||
      booking.asset !== "RUEDA" ||
      booking.status !== "approved" ||
      booking.payment_status !== "not_started"
    ) {
      return NextResponse.json(
        { error: "Ride payment booking is not approved or does not match" },
        { status: 409 },
      );
    }

    const invoiceResponse = await fetch(
      new URL(`/bookings/${paymentBookingId}/receive-invoice`, apiUrl),
      {
        method: "POST",
        headers: { "X-Payment-Operator-Key": operatorKey },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!invoiceResponse.ok) {
      return NextResponse.json(
        { error: "Unable to generate ride-specific RGB invoice" },
        { status: 502 },
      );
    }

    const invoice = await invoiceResponse.json();

    if (
      invoice.amount !== expectedAmount ||
      invoice.asset !== "RUEDA" ||
      typeof invoice.invoice !== "string" ||
      !invoice.invoice
    ) {
      throw new Error("Unexpected RGB invoice");
    }

    return NextResponse.json(
      {
        ride_reference: rideReference,
        payment_booking_id: paymentBookingId,
        invoice: invoice.invoice,
        amount: invoice.amount,
        asset: invoice.asset,
        network: "mutinynet",
        status: invoice.status,
        expiration_timestamp: invoice.expiration_timestamp,
        payment_verified: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "RGB invoice unavailable" },
      { status: 503 },
    );
  }
}
