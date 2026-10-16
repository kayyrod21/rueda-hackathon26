import type { ResolvedPickupMarket } from "../market/marketResolver";
import { inferMarketFromRoute } from "../market/keywordMarkets";

const STORAGE_KEY = "rueda_executive_pricing_market_hint";

/** Persisted hint: launch market key or NYC (Executive unavailable there) */
export type ExecutivePricingSessionHint =
  | "tampa"
  | "medellin"
  | "san_salvador"
  | "nyc";

function isHint(v: string | null): v is ExecutivePricingSessionHint {
  return (
    v === "tampa" ||
    v === "medellin" ||
    v === "san_salvador" ||
    v === "nyc"
  );
}

/**
 * Call when the user advances past intake so the Executive detail can
 * prioritize estimates. Safe no-op without window.
 */
export function persistExecutivePricingMarketHint(
  resolved: ResolvedPickupMarket,
  pickupText: string,
  destinationText: string,
): void {
  if (typeof sessionStorage === "undefined") return;

  if (resolved.launchKey) {
    sessionStorage.setItem(STORAGE_KEY, resolved.launchKey);
    return;
  }

  if (resolved.coverageKind === "keyword_fallback") {
    const id = inferMarketFromRoute(pickupText, destinationText);
    if (id === "tampa" || id === "medellin" || id === "san_salvador" || id === "nyc") {
      sessionStorage.setItem(STORAGE_KEY, id);
    }
  }
}

export function readExecutivePricingMarketHint(): ExecutivePricingSessionHint | null {
  if (typeof sessionStorage === "undefined") return null;
  const v = sessionStorage.getItem(STORAGE_KEY);
  return isHint(v) ? v : null;
}

export function clearExecutivePricingMarketHint(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
