/**
 * Static Executive tier estimates — replace with live pricing / FX when wired.
 * Not quotes; market-based guidance only.
 */

export type ExecutiveLaunchMarketId = "tampa" | "medellin" | "san_salvador";

export type ExecutivePricingCurrencyView = "local" | "usdt" | "btc";

export type ExecutiveEstimateStrings = {
  local: string;
  usdt: string;
  btc: string;
};

export type ExecutiveLaunchPricingRow = {
  id: ExecutiveLaunchMarketId;
  /** Short label for UI */
  label: string;
  /** ISO-style currency code for local column */
  localCurrencyCode: string;
  estimates: ExecutiveEstimateStrings;
};

/** Full-fare launch markets with Executive + illustrative ranges */
export const EXECUTIVE_LAUNCH_PRICING: ExecutiveLaunchPricingRow[] = [
  {
    id: "tampa",
    label: "Tampa, FL",
    localCurrencyCode: "USD",
    estimates: {
      local: "$95–$180",
      usdt: "95–180 USDT",
      btc: "0.0012–0.0023 BTC",
    },
  },
  {
    id: "medellin",
    label: "Medellín",
    localCurrencyCode: "COP",
    estimates: {
      local: "COP 180,000–350,000",
      usdt: "45–88 USDT",
      btc: "0.0006–0.0011 BTC",
    },
  },
  {
    id: "san_salvador",
    label: "San Salvador",
    localCurrencyCode: "USD",
    estimates: {
      local: "$85–$165",
      usdt: "85–165 USDT",
      btc: "0.0011–0.0021 BTC",
    },
  },
];

export function getExecutiveLaunchPricing(
  id: ExecutiveLaunchMarketId,
): ExecutiveLaunchPricingRow {
  const row = EXECUTIVE_LAUNCH_PRICING.find((r) => r.id === id);
  if (!row) throw new Error(`Unknown executive launch market: ${id}`);
  return row;
}

/** Future: ETA, surge, fleet class, contract — attach without changing row shape */
export type ExecutivePricingContext = {
  etaMinutes?: number;
  surgeFactor?: number;
  vehicleClass?: string;
};

export function formatEstimateForView(
  row: ExecutiveLaunchPricingRow,
  view: ExecutivePricingCurrencyView,
): string {
  if (view === "local") return row.estimates.local;
  if (view === "usdt") return row.estimates.usdt;
  return row.estimates.btc;
}
