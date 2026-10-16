import type { ServiceAvailability } from "../serviceTiers";

/** Countries where Rueda Mobility is offered (launch footprint). */
export const MOBILITY_COUNTRY_CODES = new Set<string>(["US", "CO", "SV"]);

export const LAUNCH_MARKET_AVAILABILITY = {
  tampa: {
    label: "Tampa, FL",
    availability: {
      executive: true,
      black: true,
      mobility: true,
    } satisfies ServiceAvailability,
  },
  medellin: {
    label: "Medellín",
    availability: {
      executive: true,
      black: true,
      mobility: true,
    } satisfies ServiceAvailability,
  },
  san_salvador: {
    label: "San Salvador, El Salvador",
    availability: {
      executive: true,
      black: true,
      mobility: true,
    } satisfies ServiceAvailability,
  },
  nyc: {
    label: "New York City",
    availability: {
      executive: false,
      black: false,
      mobility: true,
    } satisfies ServiceAvailability,
  },
} as const;

export type LaunchMarketKey = keyof typeof LAUNCH_MARKET_AVAILABILITY;

export const MOBILITY_ONLY_FALLBACK: ServiceAvailability = {
  executive: false,
  black: false,
  mobility: true,
};

export const UNSUPPORTED_AVAILABILITY: ServiceAvailability = {
  executive: false,
  black: false,
  mobility: false,
};
