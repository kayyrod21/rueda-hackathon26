import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOOKING_ID = "64694918-09bb-4289-81f4-abc3cec69dc8";

export async function GET() {
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
    if (!operatorKey) throw new Error("Missing operator key");

    const response = await fetch(
      `${apiUrl}/bookings/${BOOKING_ID}/payment-status`,
      {
        headers: { "X-Payment-Operator-Key": operatorKey },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Payment status unavailable" },
        { status: 502 },
      );
    }

    const data = await response.json();

    return NextResponse.json(
      {
        status: data.status,
        payment_verified: data.payment_verified,
        blockchain_sync_performed: data.blockchain_sync_performed,
        asset: data.asset,
        network: data.network,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to check payment status" },
      { status: 503 },
    );
  }
}
