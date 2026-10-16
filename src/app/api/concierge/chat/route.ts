import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Concierge API is not enabled in production." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("message" in body) ||
    typeof body.message !== "string" ||
    !body.message.trim() ||
    body.message.length > 2000
  ) {
    return NextResponse.json(
      { error: "A message between 1 and 2000 characters is required." },
      { status: 400 },
    );
  }

  const conversationId =
    "conversation_id" in body && typeof body.conversation_id === "string"
      ? body.conversation_id
      : null;

  const apiKey = process.env.RUEDA_QVAC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Concierge authentication is not configured." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Payment-API-Key": apiKey,
      },
      body: JSON.stringify({
        message: body.message,
        conversation_id: conversationId,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Local concierge backend is unavailable." },
      { status: 503 },
    );
  }
}
