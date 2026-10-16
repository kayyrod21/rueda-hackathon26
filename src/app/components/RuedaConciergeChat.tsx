"use client";

import { FormEvent, useState } from "react";
import { Bot, Send } from "lucide-react";

type Booking = {
  booking_id: string;
  ride_type: string;
  amount: number;
  asset: string;
  status: string;
  payment_status: string;
};

type ChatResponse = {
  conversation_id: string;
  reply: string;
  booking: Booking | null;
  payments_enabled: boolean;
  demo_only: boolean;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function RuedaConciergeChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "¡Hola! Welcome to Rueda. Tell me where you need to go, in English or Spanish.",
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();
    if (!message || loading) return;

    setInput("");
    setMessages((previous) => [
      ...previous,
      { role: "user", content: message },
    ]);
    setLoading(true);

    try {
      const response = await fetch("/api/concierge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error("The concierge is temporarily unavailable.");
      }

      const data: ChatResponse = await response.json();

      setConversationId(data.conversation_id);
      setBooking(data.booking);
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "I couldn't connect to the local concierge. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[380px] flex-col gap-4">
      <div
        className="flex max-h-[380px] min-h-[240px] flex-col gap-3 overflow-y-auto"
        role="log"
        aria-label="Rueda concierge conversation"
        aria-live="polite"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm text-black"
                : "mr-auto max-w-[85%] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-relaxed text-white/85"
            }
          >
            {message.role === "assistant" && (
              <Bot className="mb-2 h-4 w-4 text-white/50" />
            )}
            {message.content}
          </div>
        ))}
        {loading && (
          <p className="text-xs text-white/40">Rueda is responding…</p>
        )}
      </div>

      {booking && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-wider text-white/40">
            Demo booking
          </p>
          <p className="mt-1 text-lg text-white">
            {booking.amount} {booking.asset}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {booking.status === "approved"
              ? "Quote approved"
              : "Awaiting your approval"}
            {" · "}
            Payment not started
          </p>
          {booking.status === "awaiting_approval" && (
            <p className="mt-2 text-xs text-white/50">
              To approve, type: Apruebo {booking.amount} RUEDA
            </p>
          )}
        </div>
      )}

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Where would you like to go?"
          aria-label="Message Rueda concierge"
          maxLength={2000}
          disabled={loading}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="rounded-xl bg-white px-4 text-black disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      <p className="text-center text-[0.65rem] text-white/35">
        Local demo · No real payment or driver dispatch
      </p>
    </div>
  );
}
