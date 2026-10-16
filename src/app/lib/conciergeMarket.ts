/**
 * Concierge copy + tier resolution on top of `resolveConciergeMarketFromPickup`.
 */

import type { MarketCoverageKind } from "./market/marketResolver";
import { recommendTierForNotSure } from "./concierge/recommendationEngine";
import type { ServiceTier, ServiceAvailability, UserServicePreference } from "./serviceTiers";

export { recommendTierForNotSure };
export type { ServiceTier, ServiceAvailability, UserServicePreference } from "./serviceTiers";
export { tierDisplayName } from "./serviceTiers";
export { resolveConciergeMarketFromPickup, resolvePickupMarket } from "./market/marketResolver";
export type { ResolvedPickupMarket, MarketCoverageKind } from "./market/marketResolver";
export { inferMarketFromRoute, getKeywordMarketDisplayName } from "./market/keywordMarkets";
export {
  generateConciergeSummary,
  type ConciergeSummary,
  type ConciergeSummaryExtensions,
  type GenerateConciergeSummaryInput,
} from "./concierge/generateConciergeSummary";
export { tierAvailabilityChips, formatAvailableServicesList } from "./concierge/serviceAvailability";
export type { TierAvailabilityChip, TierChipKind } from "./concierge/serviceAvailability";

export type ConciergeResolution = {
  marketLabel: string;
  availability: ServiceAvailability;
  coverageKind: MarketCoverageKind;
  preference: UserServicePreference;
  recommendedTier: ServiceTier;
  requestedTier: ServiceTier | null;
  pivotedFromUnavailable: boolean;
};

function noLiveTier(av: ServiceAvailability): boolean {
  return !av.executive && !av.black && !av.mobility;
}

export function resolveConciergeBooking(
  resolved: {
    marketLabel: string;
    availability: ServiceAvailability;
    coverageKind: MarketCoverageKind;
  },
  preference: UserServicePreference,
): ConciergeResolution {
  const availability = { ...resolved.availability };
  const marketLabel = resolved.marketLabel;
  const coverageKind = resolved.coverageKind;

  let requestedTier: ServiceTier | null =
    preference === "not_sure" ? null : preference;

  let recommendedTier: ServiceTier;
  let pivotedFromUnavailable = false;

  if (noLiveTier(availability)) {
    recommendedTier = "mobility";
  } else if (preference === "not_sure") {
    recommendedTier = recommendTierForNotSure(availability);
  } else {
    if (availability[preference]) {
      recommendedTier = preference;
    } else {
      pivotedFromUnavailable = true;
      recommendedTier = availability.mobility
        ? "mobility"
        : recommendTierForNotSure(availability);
    }
  }

  return {
    marketLabel,
    availability,
    coverageKind,
    preference,
    recommendedTier,
    requestedTier,
    pivotedFromUnavailable,
  };
}
