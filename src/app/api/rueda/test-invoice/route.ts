import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_BOOKING_ID = "64694918-09bb-4289-81f4-abc3cec69dc8";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Development only" }, { status: 403 });
  }

  const apiUrl = process.env.RUEDA_PAYMENT_API_URL;
  const keyFile = process.env.RUEDA_PAYMENT_OPERATOR_KEY_FILE;

  if (apiUrl !== "http://127.0.0.1:8001" || !keyFile) {
    return NextResponse.json(
      { error: "Local payment API is not configured" },
      { status: 503 },
    );
  }

  try {
    const operatorKey = (await readFile(keyFile, "utf8")).trim();
    if (!operatorKey) {
      throw new Error("Missing operator key");
    }

    const response = await fetch(
      `${apiUrl}/bookings/${DEMO_BOOKING_ID}/receive-invoice`,
      {
        method: "POST",
        headers: { "X-Payment-Operator-Key": operatorKey },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Test invoice unavailable" },
        { status: 502 },
      );
    }

    const data = await response.json();

    if (data.amount !== 5 || data.asset !== "RUEDA") {
      throw new Error("Unexpected test invoice");
    }

    return NextResponse.json(
      {
        invoice: data.invoice,
        amount: data.amount,
        asset: data.asset,
        network: "mutinynet",
        status: data.status,
        expiration_timestamp: data.expiration_timestamp,
        payment_verified: false,
        demo_only: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve test invoice" },
      { status: 503 },
    );
  }
}
