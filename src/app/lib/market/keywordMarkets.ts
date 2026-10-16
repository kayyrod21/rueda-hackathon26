import type { ServiceAvailability } from "../serviceTiers";

export type KeywordMarketId =
  | "tampa"
  | "medellin"
  | "san_salvador"
  | "nyc"
  | "unknown";

const DISPLAY: Record<KeywordMarketId, string> = {
  tampa: "Tampa, FL",
  medellin: "Medellín",
  san_salvador: "San Salvador, El Salvador",
  nyc: "New York City",
  unknown: "this route",
};

/** Fallback when no structured pickup — coarse text hints only */
export const KEYWORD_MARKET_AVAILABILITY: Record<
  KeywordMarketId,
  ServiceAvailability
> = {
  tampa: { executive: true, black: true, mobility: true },
  medellin: { executive: true, black: true, mobility: true },
  san_salvador: { executive: true, black: true, mobility: true },
  nyc: { executive: false, black: false, mobility: true },
  unknown: { executive: false, black: false, mobility: true },
};

const MARKET_KEYWORDS: { id: KeywordMarketId; patterns: string[] }[] = [
  {
    id: "tampa",
    patterns: [
      "tampa",
      "tpa ",
      " tpa",
      "tampa airport",
      "downtown tampa",
      "st. pete",
      "st petersburg",
      "clearwater",
      "ybor",
    ],
  },
  {
    id: "medellin",
    patterns: [
      "medellín",
      "medellin",
      "mde ",
      " mde",
      "el poblado",
      "envigado",
    ],
  },
  {
    id: "san_salvador",
    patterns: [
      "san salvador",
      "el salvador",
      "salvador",
      "ssal",
    ],
  },
  {
    id: "nyc",
    patterns: [
      "new york",
      "nyc",
      "manhattan",
      "brooklyn",
      "queens",
      "bronx",
      "staten island",
      "jfk",
      "kennedy airport",
      "laguardia",
      " lga",
      "lga ",
      "newark",
      "ewr",
    ],
  },
];

export function inferMarketFromRoute(
  pickup: string,
  destination: string,
): KeywordMarketId {
  const hay = `${pickup} ${destination}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  let best: KeywordMarketId = "unknown";
  let bestScore = 0;

  for (const { id, patterns } of MARKET_KEYWORDS) {
    let score = 0;
    for (const p of patterns) {
      if (hay.includes(p)) score += p.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return bestScore > 0 ? best : "unknown";
}

export function getKeywordMarketDisplayName(id: KeywordMarketId): string {
  return DISPLAY[id];
}
