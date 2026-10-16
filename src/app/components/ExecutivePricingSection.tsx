import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EXECUTIVE_LAUNCH_PRICING,
  formatEstimateForView,
  getExecutiveLaunchPricing,
  type ExecutiveLaunchMarketId,
  type ExecutivePricingCurrencyView,
} from "../lib/pricing/executivePricing";
import {
  readExecutivePricingMarketHint,
  type ExecutivePricingSessionHint,
} from "../lib/pricing/executivePricingSession";
import { cn } from "./ui/utils";

const CURRENCY_TABS: {
  id: ExecutivePricingCurrencyView;
  label: string;
}[] = [
  { id: "local", label: "Local" },
  { id: "usdt", label: "USDT" },
  { id: "btc", label: "BTC" },
];

function isLaunchId(
  hint: ExecutivePricingSessionHint | null,
): hint is ExecutiveLaunchMarketId {
  return (
    hint === "tampa" || hint === "medellin" || hint === "san_salvador"
  );
}

type ExecutivePricingSectionProps = {
  /** Re-read session when service modal opens */
  modalOpen: boolean;
};

export function ExecutivePricingSection({
  modalOpen,
}: ExecutivePricingSectionProps) {
  const { t } = useTranslation();
  const [currencyView, setCurrencyView] =
    useState<ExecutivePricingCurrencyView>("local");
  const [selectedMarket, setSelectedMarket] =
    useState<ExecutiveLaunchMarketId>("tampa");
  const [sessionHint, setSessionHint] =
    useState<ExecutivePricingSessionHint | null>(null);

  useEffect(() => {
    if (!modalOpen) return;
    const hint = readExecutivePricingMarketHint();
    setSessionHint(hint);
    if (isLaunchId(hint)) {
      setSelectedMarket(hint);
    }
  }, [modalOpen]);

  const showNycUnavailable = sessionHint === "nyc";

  const row = getExecutiveLaunchPricing(selectedMarket);
  const displayLine = formatEstimateForView(row, currencyView);
  const localLabel =
    currencyView === "local"
      ? t("executivePricing.rangeLocal", { currency: row.localCurrencyCode })
      : currencyView === "usdt"
        ? t("executivePricing.rangeUsdt")
        : t("executivePricing.rangeBtc");

  return (
    <div className="mb-7 border border-white/[0.08] bg-[#141414] px-4 py-5 md:mb-8 md:px-5 md:py-6">
      <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white/35">
        {t("executivePricing.title")}
      </p>
      <p className="mb-4 text-xs leading-relaxed tracking-wide text-white/42">
        {t("executivePricing.disclaimer")}
      </p>

      {showNycUnavailable ? (
        <div className="mb-5 rounded-lg border border-white/[0.06] bg-[#0e0e0e] px-3.5 py-4">
          <p className="text-sm leading-relaxed tracking-wide text-white/72">
            {t("executivePricing.unavailableTitle")}
          </p>
          <p className="mt-2 text-xs leading-relaxed tracking-wide text-white/48">
            {t("executivePricing.unavailableBody")}
          </p>
        </div>
      ) : null}

      <p className="mb-2 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-white/32">
        {t("executivePricing.market")}
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {EXECUTIVE_LAUNCH_PRICING.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedMarket(m.id)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-xs font-medium tracking-wide transition-colors",
              selectedMarket === m.id
                ? "border-[#C47A2C]/45 bg-[#C47A2C]/[0.12] text-white/90"
                : "border-white/12 text-white/50 hover:border-white/20 hover:text-white/70",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="mb-2 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-white/32">
        {t("executivePricing.displayCurrency")}
      </p>
      <div
        className="mb-5 flex gap-1 rounded-xl border border-white/[0.08] bg-[#0e0e0e] p-1"
        role="tablist"
        aria-label={t("executivePricing.estimateCurrencyAria")}
      >
        {CURRENCY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={currencyView === tab.id}
            onClick={() => setCurrencyView(tab.id)}
            className={cn(
              "flex-1 rounded-lg py-2 text-[0.65rem] font-medium tracking-wide transition-all",
              currencyView === tab.id
                ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "text-white/45 hover:text-white/65",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-[#0e0e0e]/80 px-4 py-3.5">
        <p className="text-[0.6rem] uppercase tracking-[0.16em] text-white/35">
          {localLabel}
        </p>
        <p className="mt-1.5 font-normal tracking-wide text-white/88 md:text-[1.05rem]">
          {displayLine}
        </p>
        <p className="mt-2 text-[0.65rem] leading-relaxed tracking-wide text-white/38">
          {t("executivePricing.estimateFootnote")}
        </p>
      </div>
    </div>
  );
}
