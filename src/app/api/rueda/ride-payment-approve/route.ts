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
  const amount = input.amount;
  const consent = input.customer_approved;

  if (
    typeof rideReference !== "string" ||
    !/^RDA-[A-F0-9]{8}$/.test(rideReference) ||
    typeof paymentBookingId !== "string" ||
    !/^[0-9a-fA-F-]{36}$/.test(paymentBookingId) ||
    !Number.isInteger(amount) ||
    (amount as number) < 1 ||
    (amount as number) > 15 ||
    consent !== true
  ) {
    return NextResponse.json(
      { error: "Invalid approval details or missing consent" },
      { status: 422 },
    );
  }

  try {
    const operatorKey = (await readFile(keyFile, "utf8")).trim();
    if (!operatorKey) throw new Error("Missing operator key");

    const url = new URL(
      `/rides/${rideReference}/approve-payment`,
      apiUrl,
    );
    url.searchParams.set("payment_booking_id", paymentBookingId);
    url.searchParams.set("expected_amount", String(amount));

    const response = await fetch(url, {
      method: "POST",
      headers: { "X-Payment-Operator-Key": operatorKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Ride payment approval rejected" },
        { status: response.status === 409 ? 409 : 502 },
      );
    }

    const data = await response.json();

    if (
      data.ride_reference !== rideReference ||
      data.payment_booking_id !== paymentBookingId ||
      data.amount !== amount ||
      data.asset !== "RUEDA" ||
      data.approval_status !== "approved" ||
      data.payment_verified !== false
    ) {
      throw new Error("Unexpected approval response");
    }

    return NextResponse.json(
      {
        ride_reference: data.ride_reference,
        payment_booking_id: data.payment_booking_id,
        amount: data.amount,
        asset: data.asset,
        approval_status: data.approval_status,
        payment_status: data.payment_status,
        payment_verified: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Payment approval unavailable" },
      { status: 503 },
    );
  }
}
