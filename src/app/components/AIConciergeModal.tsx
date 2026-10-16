import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowRight,
  Bot,
  Check,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  generateConciergeSummary,
  resolveConciergeBooking,
  resolveConciergeMarketFromPickup,
  type UserServicePreference,
} from "../lib/conciergeMarket";
import {
  createDefaultLocationProvider,
  type LocationAutocompleteProvider,
} from "../lib/location/locationProvider";
import type { StructuredPlace } from "../lib/location/placeTypes";
import { makePlaceSessionToken } from "../lib/location/sessionToken";
import { persistExecutivePricingMarketHint } from "../lib/pricing/executivePricingSession";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "./ui/dialog";
import { PlaceAutocompleteField } from "./PlaceAutocompleteField";
import { cn } from "./ui/utils";
import { RuedaConciergeChat } from "./RuedaConciergeChat";

type ServiceChoice = UserServicePreference;

type TimePreset = "now" | "30m" | "1h" | "schedule";

type ContactChannel = "text" | "whatsapp" | "email";

const SERVICE_OPTIONS: {
  id: ServiceChoice;
  label: string;
  hint: string;
}[] = [
  { id: "executive", label: "Executive", hint: "Rueda-managed chauffeur" },
  { id: "black", label: "Black", hint: "Company fleet rental" },
  {
    id: "mobility",
    label: "Mobility",
    hint: "Independent providers · marketplace",
  },
  { id: "not_sure", label: "Not sure", hint: "Let AI recommend" },
];

const TIME_CHIPS: { id: TimePreset; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "30m", label: "30 min" },
  { id: "1h", label: "1 hour" },
  { id: "schedule", label: "Schedule" },
];

const CONTACT_OPTIONS: {
  id: ContactChannel;
  label: string;
  Icon: typeof Smartphone;
}[] = [
  { id: "text", label: "Text", Icon: Smartphone },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  { id: "email", label: "Email", Icon: Mail },
];

/** Natural-language time fragment for narrative (no leading “on” for relative times). */
function formatWhenClause(
  preset: TimePreset | null,
  scheduledAt: string,
): string {
  if (preset === "now") return "with pickup as soon as possible";
  if (preset === "30m") return "with pickup in about 30 minutes";
  if (preset === "1h") return "with pickup in about 1 hour";
  if (preset === "schedule" && scheduledAt) {
    try {
      const s = new Date(scheduledAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      return `on ${s}`;
    } catch {
      return `on ${scheduledAt}`;
    }
  }
  if (preset === "schedule") return "at a time you’ll specify";
  return "when you’re ready";
}

function isPlausiblePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10;
}

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type AIConciergeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set as the modal opens, pre-selects this tier (e.g. Executive from detail) */
  initialServicePreference?: ServiceChoice;
  /** Product/analytics hook — e.g. executive_detail, black_detail, mobility_detail */
  conciergeEntrySource?: string;
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-sm tracking-wide text-white placeholder:text-white/35 outline-none transition-colors focus:border-white/25 focus:ring-1 focus:ring-white/15";

const CONFIRMATION_STATUS_LINES = [
  "Route received",
  "Market identified",
  "Service availability checked",
  "Follow-up channel confirmed",
] as const;

export function AIConciergeModal({
  open,
  onOpenChange,
  initialServicePreference,
  conciergeEntrySource,
}: AIConciergeModalProps) {
  const formId = useId();
  const providerRef = useRef<LocationAutocompleteProvider | null>(null);
  if (!providerRef.current) {
    providerRef.current = createDefaultLocationProvider();
  }
  const provider = providerRef.current;

  const [conciergeMode, setConciergeMode] = useState<"chat" | "classic">("chat");
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupPlace, setPickupPlace] = useState<StructuredPlace | null>(null);
  const [destinationPlace, setDestinationPlace] =
    useState<StructuredPlace | null>(null);
  const [pickupSession, setPickupSession] = useState(() =>
    makePlaceSessionToken(),
  );
  const [destinationSession, setDestinationSession] = useState(() =>
    makePlaceSessionToken(),
  );
  const [timePreset, setTimePreset] = useState<TimePreset | null>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [serviceType, setServiceType] = useState<ServiceChoice>("not_sure");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  const [contactChannel, setContactChannel] = useState<ContactChannel | null>(
    null,
  );
  const [contactValue, setContactValue] = useState("");
  const [contactError, setContactError] = useState("");

  const reset = useCallback(() => {
    setStage(1);
    setPickup("");
    setDestination("");
    setPickupPlace(null);
    setDestinationPlace(null);
    setPickupSession(makePlaceSessionToken());
    setDestinationSession(makePlaceSessionToken());
    setTimePreset("now");
    setScheduledAt("");
    setServiceType("not_sure");
    setNotes("");
    setFormError("");
    setContactChannel(null);
    setContactValue("");
    setContactError("");
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useLayoutEffect(() => {
    if (open && initialServicePreference) {
      setServiceType(initialServicePreference);
    }
  }, [open, initialServicePreference]);

  const resolvedMarket = useMemo(
    () =>
      resolveConciergeMarketFromPickup(
        pickupPlace,
        pickup,
        destination,
      ),
    [pickupPlace, pickup, destination],
  );

  const resolution = useMemo(
    () => resolveConciergeBooking(resolvedMarket, serviceType),
    [resolvedMarket, serviceType],
  );

  const conciergeSummary = useMemo(
    () =>
      generateConciergeSummary({
        pickupPlace,
        destinationPlace,
        pickupText: pickup,
        destinationText: destination,
        whenDisplay: formatWhenClause(timePreset, scheduledAt),
        notesTrimmed: notes.trim(),
        resolution,
      }),
    [
      pickupPlace,
      destinationPlace,
      pickup,
      destination,
      timePreset,
      scheduledAt,
      notes,
      resolution,
    ],
  );

  const handleContinue = () => {
    if (!pickup.trim() || !destination.trim()) {
      setFormError("Please add both pickup and destination.");
      return;
    }
    if (provider.isConfigured()) {
      if (!pickupPlace || !destinationPlace) {
        setFormError(
          "Choose both pickup and destination from the suggestions so we can verify your market.",
        );
        return;
      }
    }
    if (timePreset === "schedule" && !scheduledAt.trim()) {
      setFormError("Choose a date and time, or pick another time option.");
      return;
    }
    setFormError("");
    persistExecutivePricingMarketHint(resolvedMarket, pickup, destination);
    setStage(2);
  };

  const handleFollowUpSubmit = () => {
    setContactError("");
    if (!contactChannel) {
      setContactError("Choose how you’d like to be reached.");
      return;
    }
    const v = contactValue.trim();
    if (!v) {
      setContactError("Enter your contact details to continue.");
      return;
    }
    if (contactChannel === "email") {
      if (!isPlausibleEmail(v)) {
        setContactError("Please enter a valid email address.");
        return;
      }
    } else if (!isPlausiblePhone(v)) {
      setContactError("Please enter a valid phone number.");
      return;
    }
    setStage(3);
  };

  const contactChannelLabel =
    contactChannel === "text"
      ? "Text"
      : contactChannel === "whatsapp"
        ? "WhatsApp"
        : contactChannel === "email"
          ? "Email"
          : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay
          className={cn(
            "bg-[#0b0b0b]/82 backdrop-blur-[3px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-[60] flex max-h-[min(92vh,820px)] w-full flex-col border border-white/10 bg-[#121212] shadow-2xl duration-300",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "inset-x-0 bottom-0 top-auto max-w-full translate-x-0 translate-y-0 rounded-t-2xl",
            "max-md:data-[state=closed]:slide-out-to-bottom max-md:data-[state=open]:slide-in-from-bottom",
            "md:inset-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[min(88vh,760px)] md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl",
            "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Close
            type="button"
            className={cn(
              "absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0e0e0e]/95 text-white/75 transition-colors",
              "hover:border-white/20 hover:text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
            )}
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </DialogPrimitive.Close>

          <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-5 pb-4 pt-5 md:rounded-t-2xl md:px-6 md:pt-6">
            <Bot className="h-5 w-5 text-white/55" strokeWidth={1.5} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium tracking-wide text-white/90">
                AI Concierge
              </span>
              {conciergeEntrySource === "executive_detail" ? (
                <span className="text-[0.65rem] tracking-wide text-[#C47A2C]/80">
                  Executive · from service detail
                </span>
              ) : conciergeEntrySource === "black_detail" ? (
                <span className="text-[0.65rem] tracking-wide text-white/55">
                  Black · from service detail
                </span>
              ) : conciergeEntrySource === "mobility_detail" ? (
                <span className="text-[0.65rem] tracking-wide text-[#3FAF7A]/80">
                  Mobility · from service detail
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2 border-b border-white/10 px-5 py-3 md:px-6">
            <button
              type="button"
              onClick={() => setConciergeMode("chat")}
              aria-pressed={conciergeMode === "chat"}
              className={cn(
                "rounded-lg px-4 py-2 text-xs transition-colors",
                conciergeMode === "chat"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white",
              )}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setConciergeMode("classic")}
              aria-pressed={conciergeMode === "classic"}
              className={cn(
                "rounded-lg px-4 py-2 text-xs transition-colors",
                conciergeMode === "classic"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white",
              )}
            >
              Classic booking
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6 md:py-6">
            {conciergeMode === "chat" ? (
              <RuedaConciergeChat />
            ) : (
              <>
            {stage === 1 ? (
              <>
                <DialogTitle className="mb-2 text-left text-2xl font-normal tracking-tight text-white md:text-[1.65rem]">
                  Where are you headed?
                </DialogTitle>
                <DialogDescription className="mb-8 text-left text-sm leading-relaxed tracking-wide text-white/45">
                  Share your route and timing. We’ll check managed service and
                  marketplace availability for your pickup and suggest the best
                  fit — Executive and Black are Rueda-operated layers; Mobility
                  connects you with independent providers in the network.
                </DialogDescription>

                <form
                  id={formId}
                  className="space-y-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleContinue();
                  }}
                >
                  <div className="space-y-3">
                    <label className="sr-only" htmlFor={`${formId}-pickup`}>
                      Pickup location
                    </label>
                    <PlaceAutocompleteField
                      provider={provider}
                      sessionToken={pickupSession}
                      onSessionConsumed={() =>
                        setPickupSession(makePlaceSessionToken())
                      }
                      id={`${formId}-pickup`}
                      listboxId={`${formId}-pickup-suggest`}
                      icon={<MapPin className="h-4 w-4" strokeWidth={1.5} />}
                      placeholder="Pickup — address or landmark"
                      value={pickup}
                      onChangeValue={setPickup}
                      selectedPlace={pickupPlace}
                      onPlaceChange={setPickupPlace}
                      inputClassName={cn(inputClass, "pl-11")}
                    />
                    <p className="pl-1 text-[0.65rem] tracking-wide text-white/28">
                      {provider.isConfigured()
                        ? "Select a suggested place to lock coordinates, place ID, and market eligibility."
                        : "Set VITE_GOOGLE_MAPS_API_KEY for live Google Places search; you can still type addresses and we’ll estimate coverage from text."}
                    </p>
                    <label className="sr-only" htmlFor={`${formId}-destination`}>
                      Destination
                    </label>
                    <PlaceAutocompleteField
                      provider={provider}
                      sessionToken={destinationSession}
                      onSessionConsumed={() =>
                        setDestinationSession(makePlaceSessionToken())
                      }
                      id={`${formId}-destination`}
                      listboxId={`${formId}-destination-suggest`}
                      icon={
                        <Navigation className="h-4 w-4" strokeWidth={1.5} />
                      }
                      placeholder="Destination — address or landmark"
                      value={destination}
                      onChangeValue={setDestination}
                      selectedPlace={destinationPlace}
                      onPlaceChange={setDestinationPlace}
                      inputClassName={cn(inputClass, "pl-11")}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[0.65rem] font-medium uppercase tracking-[0.18em] text-white/35">
                      When
                    </label>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {TIME_CHIPS.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => {
                            setTimePreset(chip.id);
                            if (chip.id !== "schedule") setScheduledAt("");
                          }}
                          className={cn(
                            "rounded-full border px-3.5 py-2 text-xs tracking-wide transition-colors",
                            timePreset === chip.id
                              ? "border-white/25 bg-white/[0.1] text-white"
                              : "border-white/12 text-white/55 hover:border-white/20 hover:text-white/75",
                          )}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                    {timePreset === "schedule" ? (
                      <div className="relative">
                        <Clock
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                          strokeWidth={1.5}
                        />
                        <input
                          id={`${formId}-datetime`}
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className={cn(
                            inputClass,
                            "pl-11 text-white/90 [color-scheme:dark]",
                          )}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-[0.65rem] font-medium uppercase tracking-[0.18em] text-white/35">
                      Service preference
                      <span className="ml-1 font-normal normal-case tracking-normal text-white/25">
                        (optional)
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SERVICE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setServiceType(opt.id)}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-left transition-all",
                            serviceType === opt.id
                              ? "border-white/25 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                              : "border-white/10 bg-white/[0.03] hover:border-white/18",
                          )}
                        >
                          <span className="block text-sm tracking-tight text-white">
                            {opt.label}
                          </span>
                          <span className="mt-0.5 block text-[0.65rem] tracking-wide text-white/40">
                            {opt.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-[0.65rem] font-medium uppercase tracking-[0.18em] text-white/35"
                      htmlFor={`${formId}-notes`}
                    >
                      Notes{" "}
                      <span className="font-normal text-white/25">(optional)</span>
                    </label>
                    <textarea
                      id={`${formId}-notes`}
                      rows={3}
                      placeholder="Stops, passengers, vehicle preference…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className={cn(inputClass, "resize-none")}
                    />
                  </div>

                  {formError ? (
                    <p className="text-xs tracking-wide text-white/50">
                      {formError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-medium tracking-wide text-[#0b0b0b] transition-colors hover:bg-[#c8c8c8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
                  >
                    <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                    Continue with AI
                    <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </form>
              </>
            ) : null}

            {stage === 2 ? (
              <div className="animate-in fade-in duration-300">
                <DialogTitle className="sr-only">Concierge response</DialogTitle>
                <DialogDescription className="sr-only">
                  Summary of your request, market availability, and follow-up
                  preferences.
                </DialogDescription>

                <div className="mb-6 space-y-4 rounded-xl border border-white/[0.08] bg-[#161616] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-2 text-white/45">
                    <Bot className="h-4 w-4" strokeWidth={1.5} />
                    <span className="text-[0.65rem] font-medium uppercase tracking-[0.16em]">
                      Concierge
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed tracking-wide text-white/82">
                    {conciergeSummary.requestSummary}
                  </p>
                  <p className="text-sm leading-relaxed tracking-wide text-white/72">
                    {conciergeSummary.marketInterpretation}
                  </p>
                  <div className="space-y-2">
                    <p className="text-[0.6rem] font-medium uppercase tracking-[0.18em] text-white/32">
                      Availability in this market
                    </p>
                    <div
                      className="flex flex-wrap gap-2"
                      role="list"
                      aria-label="Service availability for pickup market"
                    >
                      {conciergeSummary.tierChips.map((chip) => (
                        <span
                          key={chip.tier}
                          role="listitem"
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-[0.65rem] font-medium tracking-wide transition-colors",
                            chip.available
                              ? chip.kind === "marketplace"
                                ? "border-[#3FAF7A]/28 bg-[#3FAF7A]/[0.07] text-white/85"
                                : "border-white/18 bg-white/[0.05] text-white/82"
                              : "border-white/[0.07] bg-transparent text-white/28",
                          )}
                        >
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed tracking-wide text-white/78">
                    {conciergeSummary.recommendation}
                  </p>
                  {conciergeSummary.note ? (
                    <p className="text-sm leading-relaxed tracking-wide text-white/62">
                      {conciergeSummary.note}
                    </p>
                  ) : null}
                  <p className="border-t border-white/[0.06] pt-4 text-[0.7rem] leading-relaxed tracking-wide text-white/38">
                    {conciergeSummary.preview}
                  </p>
                </div>

                <div className="mb-6 rounded-xl border border-white/[0.07] bg-[#141414] p-5">
                  <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-white/38">
                    Follow-up
                  </p>
                  <p className="mb-4 text-sm tracking-wide text-white/75">
                    How would you like the concierge to continue with you?
                  </p>
                  <div
                    className="mb-4 flex gap-2 rounded-xl border border-white/[0.08] bg-[#0e0e0e] p-1"
                    role="group"
                    aria-label="Contact method"
                  >
                    {CONTACT_OPTIONS.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setContactChannel(id);
                          setContactValue("");
                          setContactError("");
                        }}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium tracking-wide transition-all",
                          contactChannel === id
                            ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                            : "text-white/45 hover:text-white/70",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {contactChannel ? (
                    <div className="space-y-2">
                      <label
                        className="block text-[0.65rem] font-medium uppercase tracking-[0.16em] text-white/35"
                        htmlFor={`${formId}-contact`}
                      >
                        {contactChannel === "email"
                          ? "Email address"
                          : contactChannel === "whatsapp"
                            ? "WhatsApp number"
                            : "Mobile number for SMS"}
                      </label>
                      <input
                        id={`${formId}-contact`}
                        type={contactChannel === "email" ? "email" : "tel"}
                        autoComplete={
                          contactChannel === "email" ? "email" : "tel"
                        }
                        placeholder={
                          contactChannel === "email"
                            ? "you@example.com"
                            : "+1 (555) 000-0000"
                        }
                        value={contactValue}
                        onChange={(e) => setContactValue(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  ) : (
                    <p className="text-xs tracking-wide text-white/30">
                      Select a channel to enter your details.
                    </p>
                  )}

                  {contactError ? (
                    <p className="mt-3 text-xs tracking-wide text-white/50">
                      {contactError}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleFollowUpSubmit}
                    className="w-full rounded-xl bg-white py-4 text-sm font-medium tracking-wide text-[#0b0b0b] transition-colors hover:bg-[#c8c8c8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
                  >
                    Have concierge follow up
                  </button>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStage(1);
                        setContactError("");
                      }}
                      className="flex-1 rounded-xl border border-white/12 py-3.5 text-sm tracking-wide text-white/75 transition-colors hover:border-white/22 hover:bg-white/[0.04] hover:text-white"
                    >
                      Edit details
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="flex-1 rounded-xl py-3.5 text-sm tracking-wide text-white/45 transition-colors hover:text-white/65"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {stage === 3 ? (
              <div className="animate-in fade-in duration-300">
                <DialogDescription className="sr-only">
                  Your concierge request is in review. Follow-up channel and
                  route details are recorded for when live coordination is
                  active.
                </DialogDescription>
                <div className="mb-6 rounded-xl border border-white/[0.08] bg-[#161616] px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:px-7 md:py-8">
                  <Sparkles
                    className="mx-auto mb-5 h-8 w-8 text-white/45"
                    strokeWidth={1.5}
                  />
                  <DialogTitle className="mb-3 text-center text-lg font-normal tracking-tight text-white md:text-xl">
                    Concierge request received
                  </DialogTitle>
                  <p className="mb-4 text-center text-sm leading-relaxed tracking-wide text-white/78">
                    We’re reviewing your request now — matching it against
                    current availability for Rueda-managed services and the
                    Mobility marketplace.
                  </p>
                  <p className="mb-6 text-center text-sm leading-relaxed tracking-wide text-white/52">
                    We’ll confirm the best available option from your route,
                    timing, and service preference, then continue with you on
                    the channel below once live routing is connected.
                  </p>

                  <div className="mb-6 border-t border-white/[0.06] pt-5">
                    <p className="mb-3 text-center text-[0.6rem] font-medium uppercase tracking-[0.2em] text-white/32">
                      In review
                    </p>
                    <ul
                      className="mx-auto max-w-[240px] space-y-2.5"
                      aria-label="Request review status"
                    >
                      {CONFIRMATION_STATUS_LINES.map((line) => (
                        <li
                          key={line}
                          className="flex items-start gap-2.5 text-left text-xs leading-snug tracking-wide text-white/48"
                        >
                          <Check
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/32"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-white/[0.07] bg-[#141414] px-4 py-3.5">
                    <p className="mb-1 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-white/35">
                      We’ll continue on
                    </p>
                    <p className="text-sm font-normal tracking-wide text-white/88">
                      {contactChannelLabel}
                      <span className="mx-2 text-white/25" aria-hidden>
                        ·
                      </span>
                      <span className="text-white/80">{contactValue.trim()}</span>
                    </p>
                  </div>

                  <p className="mt-5 text-center text-[0.7rem] leading-relaxed tracking-wide text-white/34">
                    Preview only — no live outreach has been sent yet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-full rounded-xl bg-white py-4 text-sm font-medium tracking-wide text-[#0b0b0b] transition-colors hover:bg-[#c8c8c8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="mt-1 w-full py-3 text-sm tracking-wide text-white/38 transition-colors hover:text-white/58 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212] rounded-lg"
                >
                  Edit request
                </button>
              </div>
            ) : null}
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
