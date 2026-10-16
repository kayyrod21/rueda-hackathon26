export type ServiceTier = "executive" | "black" | "mobility";

export type ServiceAvailability = Record<ServiceTier, boolean>;

export type UserServicePreference = ServiceTier | "not_sure";

const TIER_NAMES: Record<ServiceTier, string> = {
  executive: "Rueda Executive",
  black: "Rueda Black",
  mobility: "Rueda Mobility",
};

export function tierDisplayName(t: ServiceTier): string {
  return TIER_NAMES[t];
}
