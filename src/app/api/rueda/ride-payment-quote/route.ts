import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RIDE_TYPES = new Set([
  "airport_transfer",
  "city_ride",
  "executive_ride",
]);

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

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const rideReference = input.ride_reference;
  const rideType = input.ride_type;

  if (
    typeof rideReference !== "string" ||
    !/^RDA-[A-F0-9]{8}$/.test(rideReference) ||
    typeof rideType !== "string" ||
    !RIDE_TYPES.has(rideType)
  ) {
    return NextResponse.json(
      { error: "Invalid ride details" },
      { status: 422 },
    );
  }

  try {
    const operatorKey = (await readFile(keyFile, "utf8")).trim();
    if (!operatorKey) throw new Error("Missing operator key");

    const url = new URL(
      `/rides/${rideReference}/payment-booking`,
      apiUrl,
    );
    url.searchParams.set("ride_type", rideType);

    const response = await fetch(url, {
      method: "POST",
      headers: { "X-Payment-Operator-Key": operatorKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to retrieve ride payment quote" },
        { status: 502 },
      );
    }

    const data = await response.json();

    if (
      data.ride_reference !== rideReference ||
      data.ride_type !== rideType ||
      data.asset !== "RUEDA" ||
      !Number.isInteger(data.amount) ||
      data.amount < 1 ||
      data.amount > 15
    ) {
      throw new Error("Unexpected payment quote");
    }

    return NextResponse.json(
      {
        ride_reference: data.ride_reference,
        payment_booking_id: data.booking_id,
        ride_type: data.ride_type,
        amount: data.amount,
        asset: data.asset,
        network: "mutinynet",
        approval_status: data.status,
        payment_status: data.payment_status,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Payment quote unavailable" },
      { status: 503 },
    );
  }
}
