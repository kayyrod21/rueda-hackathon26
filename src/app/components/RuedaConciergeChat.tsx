"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { scrollChatToNewest } from "../lib/concierge/chatScroll";
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
  language?: "en" | "es";
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function RuedaConciergeChat() {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<string | null>(null);
  const es = (language ?? i18n.language).startsWith("es");
  const messageContainer = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    scrollChatToNewest(messageContainer.current);
  }, [messages, loading]);

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
      if (data.language) setLanguage(data.language);
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
            es ? "No pude conectar con el concierge local. Inténtalo de nuevo."
              : "I couldn't connect to the local concierge. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[380px] flex-col gap-4">
      <div
        ref={messageContainer}
        className="flex max-h-[380px] min-h-[240px] flex-col gap-3 overflow-y-auto overscroll-contain"
        role="log"
        aria-label={es ? "Conversación con Rueda" : "Rueda concierge conversation"}
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
            <span className="whitespace-pre-wrap">{message.content}</span>
          </div>
        ))}
        {loading && (
          <p className="text-xs text-white/40">{es ? "Rueda está respondiendo…" : "Rueda is responding…"}</p>
        )}
      </div>

      {booking && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-wider text-white/40">
            {es ? "Reserva de demostración" : "Demo booking"}
          </p>
          <p className="mt-1 text-lg text-white">
            {booking.amount} {booking.asset}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {booking.status === "approved"
              ? (es ? "Reserva de demostración aprobada; no es aprobación de pago" : "Demo booking approved; payment approval is separate")
              : (es ? "Pendiente de revisión del operador" : "Awaiting operator review")}
            {" · "}
            {es ? "Pago no iniciado" : "Payment not started"}
          </p>
          <p className="mt-2 text-xs text-white/50">
            {es ? "Checkout deshabilitado: requiere tarifa verificada y aprobación explícita del operador."
              : "Checkout disabled: a verified fare and explicit operator approval are required."}
          </p>
        </div>
      )}

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={es ? "¿A dónde quieres ir?" : "Where would you like to go?"}
          aria-label={es ? "Mensaje para Rueda" : "Message Rueda concierge"}
          maxLength={2000}
          disabled={loading}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label={es ? "Enviar mensaje" : "Send message"}
          className="rounded-xl bg-white px-4 text-black disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      <p className="text-center text-[0.65rem] text-white/35">
        {es ? "Demostración local · Sin pago real ni despacho de conductor" : "Local demo · No real payment or driver dispatch"}
      </p>
    </div>
  );
}
