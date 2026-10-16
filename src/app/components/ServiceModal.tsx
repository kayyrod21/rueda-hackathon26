import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { FleetChip } from "./FleetChip";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "./ui/dialog";
import { cn } from "./ui/utils";
import type { Service } from "../data/services";
import { ExecutivePricingSection } from "./ExecutivePricingSection";

type ServiceModalProps = {
  service: Service | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookNow?: () => void;
  /** Overrides footer CTA label (e.g. Executive → concierge handoff) */
  primaryCtaLabel?: string;
};

export function ServiceModal({
  service,
  open,
  onOpenChange,
  onBookNow,
  primaryCtaLabel,
}: ServiceModalProps) {
  const { t } = useTranslation();
  if (!service) return null;

  const handleBook = () => {
    if (onBookNow) {
      onBookNow();
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay
          className={cn(
            "bg-[#0b0b0b]/80 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col border border-white/10 bg-[#121212] shadow-2xl duration-300",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            /* Mobile: bottom sheet */
            "inset-x-0 bottom-0 top-auto max-h-[min(92vh,880px)] w-full max-w-full translate-x-0 translate-y-0 rounded-t-2xl",
            "max-md:data-[state=closed]:slide-out-to-bottom max-md:data-[state=open]:slide-in-from-bottom",
            /* Tablet/desktop: centered dialog */
            "md:inset-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[min(85vh,720px)] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl",
            "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Close
            type="button"
            className={cn(
              "absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0e0e0e]/95 text-white/80 transition-colors",
              "hover:border-white/20 hover:text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
            )}
            aria-label={t("services.modal.closeAria")}
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </DialogPrimitive.Close>

          <div className="flex min-h-0 flex-1 flex-col md:max-h-[min(85vh,720px)]">
            {/* Visual hero — always first; wide, image-forward */}
            <div className="relative order-1 aspect-[2/1] w-full shrink-0 overflow-hidden max-md:rounded-t-2xl md:aspect-[2.15/1] md:rounded-t-xl">
              <ImageWithFallback
                src={service.image}
                alt={t(service.imageAltKey)}
                className="h-full w-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121212]/95 via-[#121212]/20 to-transparent" />
            </div>

            <div className="order-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4 pt-5 md:px-8 md:pb-5 md:pt-6">
              <DialogTitle className="mb-1 text-left text-2xl font-normal tracking-tight text-white md:text-3xl">
                {service.title}
              </DialogTitle>
              <DialogDescription asChild>
                <p className="mb-5 text-left text-sm tracking-wide text-[#b8b8b8] md:text-base">
                  {t(service.subtitleKey)}
                </p>
              </DialogDescription>

              <p className="mb-5 text-sm leading-relaxed tracking-wide text-white/55 md:mb-6 md:text-[0.9375rem]">
                {t(service.descriptionKey)}
              </p>

              {service.clarityNotesKey ? (
                <div
                  className="mb-6 border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 md:mb-7"
                  aria-label={t("services.modal.notesAria")}
                >
                  <ul className="space-y-1.5">
                    {(t(service.clarityNotesKey, { returnObjects: true }) as string[]).map((note) => (
                      <li
                        key={note}
                        className="text-[0.7rem] leading-relaxed tracking-[0.12em] text-white/45 uppercase md:text-[0.72rem] md:tracking-[0.14em]"
                      >
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {service.tierFootnoteKey ? (
                <p className="mb-6 text-[0.7rem] leading-relaxed tracking-wide text-white/32 md:mb-7 md:text-[0.72rem]">
                  {t(service.tierFootnoteKey)}
                </p>
              ) : null}

              {service.id === "executive" ? (
                <ExecutivePricingSection modalOpen={open} />
              ) : null}

              <p className="mb-3 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white/35">
                {t("services.modal.highlights")}
              </p>
              <ul className="mb-8 space-y-2.5 border-l border-white/10 pl-4">
                {(t(service.featuresKey, { returnObjects: true }) as string[]).map((item) => (
                  <li
                    key={item}
                    className="text-sm leading-snug tracking-wide text-white/70"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              <p className="mb-3 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white/35">
                {t("services.modal.fleet")}
              </p>
              <div className="flex flex-wrap gap-2 pb-2">
                {service.fleet.map((name) => (
                  <FleetChip key={name} label={name} />
                ))}
              </div>
            </div>

            <div className="order-3 shrink-0 border-t border-white/[0.08] bg-[#0e0e0e]/95 px-6 py-4 md:rounded-b-xl md:px-8">
              {service.id === "executive" ? (
                <p className="mb-3 text-center text-[0.65rem] leading-relaxed tracking-wide text-white/38">
                  {t("services.modal.executiveHandoff")}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleBook}
                className="w-full py-3.5 text-sm font-medium tracking-wide text-[#0b0b0b] transition-colors bg-white hover:bg-[#c8c8c8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]"
              >
                {primaryCtaLabel ?? t("services.modal.bookNow")}
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
