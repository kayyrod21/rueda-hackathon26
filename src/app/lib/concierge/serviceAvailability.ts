import type { ServiceAvailability, ServiceTier } from "../serviceTiers";

export type TierChipKind = "managed" | "marketplace";

export type TierAvailabilityChip = {
  tier: ServiceTier;
  /** Short label for UI */
  label: string;
  available: boolean;
  kind: TierChipKind;
};

const CHIP_META: Record<
  ServiceTier,
  { label: string; kind: TierChipKind }
> = {
  executive: { label: "Executive", kind: "managed" },
  black: { label: "Black", kind: "managed" },
  mobility: { label: "Mobility", kind: "marketplace" },
};

/** One row per tier, in product order — for summary chips. */
export function tierAvailabilityChips(
  availability: ServiceAvailability,
): TierAvailabilityChip[] {
  const order: ServiceTier[] = ["executive", "black", "mobility"];
  return order.map((tier) => ({
    tier,
    label: CHIP_META[tier].label,
    available: availability[tier],
    kind: CHIP_META[tier].kind,
  }));
}

/** Readable list of available tier names, e.g. "Executive, Black, and Mobility". */
export function formatAvailableServicesList(
  availability: ServiceAvailability,
): string {
  const names: string[] = [];
  if (availability.executive) names.push("Executive");
  if (availability.black) names.push("Black");
  if (availability.mobility) names.push("Mobility");
  if (names.length === 0) return "none at this time";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
