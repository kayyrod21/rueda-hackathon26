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

type RidePaymentQuote = {
  ride_reference: string;
  payment_booking_id: string;
  ride_type: string;
  amount: number;
  asset: string;
  network: string;
  approval_status: string;
  payment_status: string;
};

type TestInvoice = {
  invoice: string;
  amount: number;
  asset: string;
  network: string;
  status: string;
  expiration_timestamp: number;
  payment_verified: boolean;
  demo_only: boolean;
};

type DemoRide = {
  booking_id: string;
  provider: string;
  status: string;
  driver_status: string;
  simulated: boolean;
};

type ChatResponse = {
  demo_ride?: DemoRide | null;

  trip_confirmed?: boolean;
  payment_selection?: { currency?: string | null };

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
  const [demoRide, setDemoRide] = useState<DemoRide | null>(null);

  const [ruedaSelected, setRuedaSelected] = useState(false);
  const [ridePaymentQuote, setRidePaymentQuote] = useState<RidePaymentQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState(false);
  async function generateRideInvoice() {
    const quote = ridePaymentQuote;
    if (!quote || quote.approval_status !== "approved") return;

    setInvoiceLoading(true);
    setInvoiceError(false);

    try {
      const response = await fetch("/api/rueda/ride-payment-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ride_reference: quote.ride_reference,
          payment_booking_id: quote.payment_booking_id,
          ride_type: quote.ride_type,
          amount: quote.amount,
        }),
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Invoice unavailable");

      const invoice = await response.json();

      if (
        invoice.ride_reference !== quote.ride_reference ||
        invoice.payment_booking_id !== quote.payment_booking_id ||
        invoice.amount !== quote.amount ||
        invoice.asset !== "RUEDA" ||
        typeof invoice.invoice !== "string" ||
        !invoice.invoice
      ) {
        throw new Error("Invoice mismatch");
      }

      setTestInvoice(invoice);
    } catch {
      setInvoiceError(true);
    } finally {
      setInvoiceLoading(false);
    }
  }


  async function approveRidePayment() {
    const quote = ridePaymentQuote;
    if (!quote || quote.approval_status !== "awaiting_approval") return;

    setApprovalLoading(true);
    setApprovalError(false);

    try {
      const response = await fetch("/api/rueda/ride-payment-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ride_reference: quote.ride_reference,
          payment_booking_id: quote.payment_booking_id,
          amount: quote.amount,
          customer_approved: true,
        }),
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Approval rejected");

      const result = await response.json();
      if (
        result.ride_reference !== quote.ride_reference ||
        result.payment_booking_id !== quote.payment_booking_id ||
        result.amount !== quote.amount ||
        result.asset !== "RUEDA" ||
        result.approval_status !== "approved" ||
        result.payment_verified !== false
      ) {
        throw new Error("Approval response mismatch");
      }

      setRidePaymentQuote({
        ...quote,
        approval_status: "approved",
        payment_status: result.payment_status,
      });
    } catch {
      setApprovalError(true);
    } finally {
      setApprovalLoading(false);
    }
  }


  async function loadRidePaymentQuote(rideReference: string, rideType: string) {
    setQuoteLoading(true);
    setQuoteError(false);
    setRidePaymentQuote(null);

    try {
      const response = await fetch("/api/rueda/ride-payment-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ride_reference: rideReference,
          ride_type: rideType,
        }),
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Payment quote unavailable");

      const quote: RidePaymentQuote = await response.json();
      if (quote.ride_reference !== rideReference || quote.asset !== "RUEDA") {
        throw new Error("Payment quote mismatch");
      }

      setRidePaymentQuote(quote);
    } catch {
      setQuoteError(true);
    } finally {
      setQuoteLoading(false);
    }
  }

  const [testInvoice, setTestInvoice] = useState<TestInvoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<{
    status: string;
    payment_verified: boolean;
    blockchain_sync_performed: boolean;
  } | null>(null);
  const [paymentStatusLoading, setPaymentStatusLoading] = useState(false);
  const [paymentStatusError, setPaymentStatusError] = useState(false);

  async function checkPaymentStatus() {
    const quote = ridePaymentQuote;
    if (
      paymentStatusLoading ||
      !quote ||
      quote.approval_status !== "approved" ||
      !testInvoice
    ) return;

    setPaymentStatusLoading(true);
    setPaymentStatusError(false);
    setPaymentStatus(null);

    try {
      const response = await fetch("/api/rueda/ride-payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ride_reference: quote.ride_reference,
          payment_booking_id: quote.payment_booking_id,
          ride_type: quote.ride_type,
        }),
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Payment status unavailable");

      const data = await response.json();

      if (
        data.ride_reference !== quote.ride_reference ||
        data.payment_booking_id !== quote.payment_booking_id ||
        data.payment_verified !== false ||
        data.blockchain_sync_performed !== false
      ) {
        throw new Error("Unexpected payment status");
      }

      setPaymentStatus(data);
    } catch {
      setPaymentStatusError(true);
    } finally {
      setPaymentStatusLoading(false);
    }
  }


  async function loadTestInvoice() {
    if (invoiceLoading) return;
    setInvoiceLoading(true);
    setInvoiceError(false);
    try {
      const response = await fetch("/api/rueda/test-invoice", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Invoice unavailable");
      const data: TestInvoice = await response.json();
      setTestInvoice(data);
    } catch {
      setInvoiceError(true);
    } finally {
      setInvoiceLoading(false);
    }
  }

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
      setDemoRide(data.demo_ride ?? null);
      setRidePaymentQuote(null);
      setQuoteError(false);
      if (
        data.demo_ride?.booking_id &&
        data.trip_confirmed === true &&
        data.payment_selection?.currency === "RUEDA"
      ) {
        const rideType = (data as ChatResponse & {
          trip?: { ride_type?: string };
        }).trip?.ride_type;

        if (rideType) {
          void loadRidePaymentQuote(data.demo_ride.booking_id, rideType);
        }
      }
      const selected = data.trip_confirmed === true &&
        data.payment_selection?.currency === "RUEDA";
      setRuedaSelected(selected);
      setTestInvoice(null);
      setInvoiceError(false);
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

      {demoRide && (
        <div className="rounded-xl border border-sky-400/40 bg-sky-400/10 p-4 space-y-2">
          <p className="font-semibold">
            {es ? "Estado del viaje" : "Ride Status"}
          </p>
          <p className="text-sm">
            {es ? "Reserva" : "Booking"}: {demoRide.booking_id}
          </p>
          <p className="text-sm">
            {es ? "Estado" : "Status"}: {(
              demoRide.status === "awaiting_test_checkout"
                ? (es ? "Pendiente de pago" : "Awaiting payment")
                : demoRide.status === "demo_confirmed"
                  ? (es ? "Solicitud recibida" : "Request received")
                  : demoRide.status.replaceAll("_", " ")
            )}
          </p>
          <p className="text-sm">
            {es ? "Conductor" : "Driver"}: {(
              demoRide.driver_status === "not_assigned"
                ? (es ? "Pendiente de asignación" : "Awaiting assignment")
                : (es ? "Pendiente de confirmación" : "Awaiting confirmation")
            )}
          </p>
          <p className="text-xs opacity-75">
            {es
              ? "La asignación del conductor estará disponible tras confirmar el pago."
              : "Driver assignment will be available after payment confirmation."}
          </p>
          <p className="text-sm font-medium">
            {es
              ? "Pago pendiente. La reserva se confirmará cuando se verifique la transferencia."
              : "Payment pending. Your booking will be confirmed after the transfer is verified."}
          </p>
          <p className="text-xs opacity-75">
            {es
              ? "La confirmación del pago requiere una transferencia RGB liquidada."
              : "Payment confirmation requires a settled RGB transfer."}
          </p>
        </div>
      )}
      {ruedaSelected && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 space-y-3">
          <p className="font-semibold">
            {es ? "Pago RUEDA" : "RUEDA Checkout"}
          </p>
          <p className="text-sm">
            {quoteLoading
              ? (es ? "Preparando cotización RUEDA..." : "Preparing RUEDA quote...")
              : ridePaymentQuote
                ? `${ridePaymentQuote.amount} RUEDA · Mutinynet · ${
                    ridePaymentQuote.approval_status === "approved"
                      ? (es ? "Importe aprobado" : "Amount approved")
                      : (es ? "Cotización pendiente de aprobación" : "Quote awaiting approval")
                  }`
                : (es ? "Cotización RUEDA pendiente" : "RUEDA quote pending")}
          </p>
          {ridePaymentQuote && (
            <p className="text-xs opacity-75">
              {es
                ? "Este importe en RUEDA es independiente de la tarifa estimada en USD. Aún no se ha aprobado ningún pago."
                : "This RUEDA amount is separate from the USD fare estimate. Approval of the amount does not mean a transfer has been made or verified."}
            </p>
          )}
          {ridePaymentQuote?.approval_status === "awaiting_approval" && (
            <button
              type="button"
              onClick={() => void approveRidePayment()}
              disabled={approvalLoading}
              className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {approvalLoading
                ? (es ? "Aprobando..." : "Approving...")
                : (es
                    ? `Aprobar ${ridePaymentQuote.amount} RUEDA`
                    : `Approve ${ridePaymentQuote.amount} RUEDA`)}
            </button>
          )}
          {ridePaymentQuote?.approval_status === "approved" && (
            <p role="status" className="text-sm">
              {es
                ? "Importe aprobado. Transferencia RGB aún no realizada ni verificada."
                : "Amount approved. RGB transfer not yet made or verified."}
            </p>
          )}
          {approvalError && (
            <p role="alert" className="text-sm">
              {es
                ? "No se pudo aprobar el importe RUEDA."
                : "Could not approve the RUEDA amount."}
            </p>
          )}
          {quoteError && (
            <p role="alert" className="text-sm">
              {es ? "No se pudo obtener la cotización RUEDA." : "Could not retrieve the RUEDA quote."}
            </p>
          )}
          {ridePaymentQuote?.approval_status === "approved" && !testInvoice && (
            <button
              type="button"
              onClick={() => void generateRideInvoice()}
              disabled={invoiceLoading}
              className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {invoiceLoading
                ? (es ? "Generando factura..." : "Generating invoice...")
                : (es ? "Generar factura RGB" : "Generate RGB Invoice")}
            </button>
          )}
          {invoiceError && (
            <p role="alert" className="text-sm">
              {es ? "No se pudo cargar la factura de prueba." : "Could not generate the RGB invoice."}
            </p>
          )}
          {testInvoice && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {es ? "Pendiente de pago · No verificado" : "Awaiting payment · Not verified"}
              </p>
              <button
                type="button"
                onClick={checkPaymentStatus}
                disabled={paymentStatusLoading}
                className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {paymentStatusLoading
                  ? (es ? "Verificando..." : "Checking...")
                  : (es ? "Consultar estado del pago RGB" : "Check RGB Payment Status")}
              </button>
              {paymentStatusError && (
                <p role="alert" className="text-sm">
                  {es ? "No se pudo consultar el estado del pago." : "Could not check payment status."}
                </p>
              )}
              {paymentStatus && (
                <p className="text-sm" role="status">
                  {paymentStatus.payment_verified
                    ? (es ? "Transferencia RGB liquidada." : "RGB transfer settled.")
                    : (es ? "Pago aún no verificado." : "Payment not yet verified.")}
                  {!paymentStatus.blockchain_sync_performed && (
                    <span className="block text-xs opacity-75">
                      {es
                        ? "Estado basado en registros locales; no se realizó sincronización en vivo."
                        : "Based on local wallet records; no live blockchain synchronization performed."}
                    </span>
                  )}
                </p>
              )}
              <textarea
                readOnly
                aria-label="RGB invoice"
                value={testInvoice.invoice}
                rows={3}
                className="w-full rounded-lg border p-2 text-xs text-black"
              />
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(testInvoice.invoice)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {es ? "Copiar factura" : "Copy invoice"}
              </button>
              <p className="text-xs">
                {es
                  ? "Solo demostración local. El transporte RGB usa un proxy localhost; no funciona desde billeteras remotas."
                  : "Local demo only. RGB transport uses a localhost proxy and is not reachable by remote wallets."}
              </p>
            </div>
          )}
        </div>
      )}
      {booking && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-wider text-white/40">
            {es ? "Resumen del viaje" : "Trip summary"}
          </p>
          <p className="mt-1 text-lg text-white">
            {booking.amount} {booking.asset}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {booking.status === "approved"
              ? (es ? "Detalles revisados" : "Details reviewed")
              : (es ? "Pendiente de confirmación" : "Awaiting confirmation")}
            {" · "}
            {es ? "Pago no iniciado" : "Payment not started"}
          </p>
          <p className="mt-2 text-xs text-white/50">
            {es ? "Te avisaremos cuando esté disponible el siguiente paso."
              : "We’ll let you know when the next step is available."}
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
        Rueda Mobility · Ride concierge
      </p>
    </div>
  );
}
