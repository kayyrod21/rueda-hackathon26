import type { StructuredPlace } from "../location/placeTypes";
import type { ServiceAvailability } from "../serviceTiers";
import {
  getKeywordMarketDisplayName,
  inferMarketFromRoute,
  KEYWORD_MARKET_AVAILABILITY,
} from "./keywordMarkets";
import {
  LAUNCH_MARKET_AVAILABILITY,
  MOBILITY_COUNTRY_CODES,
  MOBILITY_ONLY_FALLBACK,
  UNSUPPORTED_AVAILABILITY,
} from "./marketAvailability";

export type MarketCoverageKind =
  | "launch_market"
  | "nyc_mobility"
  | "country_mobility"
  | "keyword_fallback"
  | "unsupported"
  | "incomplete_place";

export type ResolvedPickupMarket = {
  marketLabel: string;
  availability: ServiceAvailability;
  coverageKind: MarketCoverageKind;
  /** Matched internal launch key when applicable */
  launchKey?: keyof typeof LAUNCH_MARKET_AVAILABILITY;
};

function norm(s: string | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isTampaMetro(place: StructuredPlace): boolean {
  if (place.country !== "US") return false;
  const region = (place.region || "").toUpperCase();
  if (region !== "FL") return false;
  const city = norm(place.city);
  const hay = norm(`${place.city} ${place.formattedAddress} ${place.label}`);
  if (
    city.includes("tampa") ||
    hay.includes("tampa") ||
    hay.includes("tpa") ||
    hay.includes("st. petersburg") ||
    hay.includes("st petersburg") ||
    hay.includes("clearwater") ||
    hay.includes("brandon") ||
    hay.includes("ybor")
  ) {
    return true;
  }
  return false;
}

function isMedellin(place: StructuredPlace): boolean {
  if (place.country !== "CO") return false;
  const city = norm(place.city);
  const hay = norm(`${place.city} ${place.formattedAddress} ${place.label}`);
  return (
    city.includes("medellin") ||
    hay.includes("medellin") ||
    hay.includes("envigado") ||
    hay.includes("el poblado")
  );
}

function isSanSalvador(place: StructuredPlace): boolean {
  if (place.country !== "SV") return false;
  const city = norm(place.city);
  const hay = norm(`${place.city} ${place.formattedAddress} ${place.label}`);
  return city.includes("san salvador") || hay.includes("san salvador");
}

const NYC_CITY_FRAGMENTS = [
  "new york",
  "brooklyn",
  "queens",
  "bronx",
  "staten island",
  "manhattan",
];

function isNyc(place: StructuredPlace): boolean {
  if (place.country !== "US") return false;
  const region = (place.region || "").toUpperCase();
  if (region !== "NY" && region !== "NJ") return false;
  const city = norm(place.city);
  const hay = norm(`${place.city} ${place.formattedAddress} ${place.label}`);
  if (NYC_CITY_FRAGMENTS.some((f) => city.includes(f) || hay.includes(f))) {
    return true;
  }
  if (hay.includes("jfk") || hay.includes("laguardia") || hay.includes("newark")) {
    return true;
  }
  return false;
}

function cityCountryLabel(place: StructuredPlace): string {
  const parts = [place.city, place.region, place.country].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return place.formattedAddress || place.label;
}

/**
 * Primary market rule: pickup structured place determines service availability.
 */
export function resolvePickupMarket(place: StructuredPlace): ResolvedPickupMarket {
  const cc = place.country?.toUpperCase();
  if (!cc) {
    return {
      marketLabel: place.label,
      availability: { ...UNSUPPORTED_AVAILABILITY },
      coverageKind: "incomplete_place",
    };
  }

  if (!MOBILITY_COUNTRY_CODES.has(cc)) {
    return {
      marketLabel: cityCountryLabel(place),
      availability: { ...UNSUPPORTED_AVAILABILITY },
      coverageKind: "unsupported",
    };
  }

  if (isTampaMetro(place)) {
    const m = LAUNCH_MARKET_AVAILABILITY.tampa;
    return {
      marketLabel: m.label,
      availability: { ...m.availability },
      coverageKind: "launch_market",
      launchKey: "tampa",
    };
  }
  if (isMedellin(place)) {
    const m = LAUNCH_MARKET_AVAILABILITY.medellin;
    return {
      marketLabel: m.label,
      availability: { ...m.availability },
      coverageKind: "launch_market",
      launchKey: "medellin",
    };
  }
  if (isSanSalvador(place)) {
    const m = LAUNCH_MARKET_AVAILABILITY.san_salvador;
    return {
      marketLabel: m.label,
      availability: { ...m.availability },
      coverageKind: "launch_market",
      launchKey: "san_salvador",
    };
  }
  if (isNyc(place)) {
    const m = LAUNCH_MARKET_AVAILABILITY.nyc;
    return {
      marketLabel: m.label,
      availability: { ...m.availability },
      coverageKind: "nyc_mobility",
      launchKey: "nyc",
    };
  }

  return {
    marketLabel: cityCountryLabel(place),
    availability: { ...MOBILITY_ONLY_FALLBACK },
    coverageKind: "country_mobility",
  };
}

/**
 * Pickup place wins when present; otherwise coarse keyword inference from typed text.
 */
export function resolveConciergeMarketFromPickup(
  pickupPlace: StructuredPlace | null,
  pickupText: string,
  destinationText: string,
): ResolvedPickupMarket {
  if (pickupPlace) {
    return resolvePickupMarket(pickupPlace);
  }
  const id = inferMarketFromRoute(pickupText, destinationText);
  return {
    marketLabel: getKeywordMarketDisplayName(id),
    availability: { ...KEYWORD_MARKET_AVAILABILITY[id] },
    coverageKind: "keyword_fallback",
  };
}
