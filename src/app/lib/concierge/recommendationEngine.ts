import type { ServiceAvailability, ServiceTier } from "../serviceTiers";

/**
 * “Not sure / let AI recommend”: prefer Rueda Executive when the managed
 * chauffeur layer is live in the market; otherwise default to the Mobility
 * marketplace layer. (Black remains selectable manually; future trip-intent
 * heuristics can extend this.)
 */
export function recommendTierForNotSure(
  availability: ServiceAvailability,
): ServiceTier {
  if (availability.executive) return "executive";
  return "mobility";
}
