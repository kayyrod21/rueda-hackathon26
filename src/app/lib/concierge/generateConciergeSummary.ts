import type { StructuredPlace } from "../location/placeTypes";
import type { ConciergeResolution } from "../conciergeMarket";
import { tierDisplayName, type ServiceTier } from "../serviceTiers";
import { formatAvailableServicesList, tierAvailabilityChips, type TierAvailabilityChip } from "./serviceAvailability";

/** Hook for future ETA, pricing guidance, fleet flags — unused in copy for now */
export type ConciergeSummaryExtensions = {
  etaMinutes?: number;
  pricingHint?: string;
  driverAvailable?: boolean;
  fleetAvailable?: boolean;
  contractRequired?: boolean;
};

export type ConciergeSummary = {
  requestSummary: string;
  marketInterpretation: string;
  recommendation: string;
  note: string | null;
  preview: string;
  tierChips: TierAvailabilityChip[];
};

export type GenerateConciergeSummaryInput = {
  pickupPlace: StructuredPlace | null;
  destinationPlace: StructuredPlace | null;
  pickupText: string;
  destinationText: string;
  whenDisplay: string;
  notesTrimmed: string;
  resolution: ConciergeResolution;
  /** Reserved for upcoming intelligence — does not affect strings yet */
  extensions?: ConciergeSummaryExtensions;
};

function lineFromPlace(
  place: StructuredPlace | null,
  fallback: string,
): string {
  const raw = fallback.trim();
  if (place) {
    return (
      place.label.trim() ||
      place.formattedAddress?.trim() ||
      raw ||
      "—"
    );
  }
  return raw || "—";
}

function destinationLine(
  place: StructuredPlace | null,
  fallback: string,
): string {
  const hasStructured = Boolean(place);
  const hasText = fallback.trim().length > 0;
  if (hasStructured || hasText) {
    return lineFromPlace(place, fallback);
  }
  return "your destination (to be confirmed)";
}

function noLiveTier(av: ConciergeResolution["availability"]): boolean {
  return !av.executive && !av.black && !av.mobility;
}

function mobOnly(av: ConciergeResolution["availability"]): boolean {
  return !av.executive && !av.black && av.mobility;
}

function recommendationDescriptor(tier: ServiceTier): string {
  if (tier === "executive") {
    return `${tierDisplayName(tier)}, our Rueda-managed chauffeur layer`;
  }
  if (tier === "black") {
    return `${tierDisplayName(tier)}, our Rueda-managed company fleet rental`;
  }
  return `${tierDisplayName(tier)}, the independent-provider marketplace layer`;
}

const PREVIEW =
  "This is currently a preview of the concierge workflow. Live coordination, policy-aware guidance, and booking follow-up will connect here next.";

export function generateConciergeSummary(
  input: GenerateConciergeSummaryInput,
): ConciergeSummary {
  void input.extensions;

  const pickup = lineFromPlace(input.pickupPlace, input.pickupText);
  const destination = destinationLine(
    input.destinationPlace,
    input.destinationText,
  );
  const { resolution, notesTrimmed, whenDisplay } = input;
  const { availability, marketLabel, coverageKind } = resolution;
  const tierChips = tierAvailabilityChips(availability);
  const list = formatAvailableServicesList(availability);

  const requestSummary = `Understood — your request is from ${pickup} to ${destination} ${whenDisplay}.`;

  const note = notesTrimmed ? `Trip note received: ${notesTrimmed}` : null;

  if (noLiveTier(availability)) {
    let marketInterpretation: string;
    let recommendation: string;
    if (coverageKind === "incomplete_place") {
      marketInterpretation = `I couldn’t confirm a country for this pickup from the place on file (${marketLabel}).`;
      recommendation =
        "Select a full suggested address from search so I can map managed Executive and Black layers versus the Mobility marketplace for your route.";
    } else if (coverageKind === "unsupported") {
      marketInterpretation = `For your pickup market (${marketLabel}), Rueda hasn’t launched Mobility or managed services yet.`;
      recommendation =
        "This region appears outside our current footprint (United States, Colombia, or El Salvador). Try a supported pickup location, or check back as we expand.";
    } else {
      marketInterpretation = `For your pickup market (${marketLabel}), we don’t have live service layers mapped from this input yet.`;
      recommendation =
        "If that seems off, choose a verified pickup in the United States, Colombia, or El Salvador — or watch for broader coverage soon.";
    }
    return {
      requestSummary,
      marketInterpretation,
      recommendation,
      note,
      preview: PREVIEW,
      tierChips,
    };
  }

  let marketInterpretation = "";
  if (coverageKind === "incomplete_place") {
    marketInterpretation = `For your pickup market (${marketLabel}), I need a verified address with a clear country to list managed and marketplace options accurately.`;
  } else if (coverageKind === "keyword_fallback") {
    marketInterpretation = `For your pickup market (${marketLabel}), typed locations suggest the following may apply: ${list}. A verified pickup from search will refine this.`;
  } else if (mobOnly(availability)) {
    marketInterpretation = `For your pickup market (${marketLabel}), the Mobility marketplace is available — independent providers on the Rueda network. Rueda-managed Executive and Black are not listed in this market.`;
  } else {
    marketInterpretation = `For your pickup market (${marketLabel}), the following options are currently available: ${list}. Executive and Black are Rueda-managed service layers; Mobility is the marketplace layer.`;
  }

  const {
    recommendedTier,
    requestedTier,
    pivotedFromUnavailable,
    preference,
  } = resolution;

  let recommendation = "";

  if (pivotedFromUnavailable && requestedTier) {
    const fallback = recommendationDescriptor(recommendedTier);
    if (recommendedTier === "mobility" && availability.mobility) {
      recommendation = `${tierDisplayName(requestedTier)} is not currently available in this market. I can continue with ${fallback}, which is available — your request can move forward through the Mobility network of independent providers.`;
    } else {
      recommendation = `${tierDisplayName(requestedTier)} is not currently available in this market. I can continue with ${fallback}, which is currently available.`;
    }
  } else if (preference === "not_sure") {
    const desc = recommendationDescriptor(recommendedTier);
    if (mobOnly(availability)) {
      recommendation = `Based on your route and timing, ${desc} appears to be the strongest fit here — marketplace coordination with independent providers.`;
    } else if (recommendedTier === "executive") {
      recommendation = `Based on your route and timing, ${desc} appears to be the strongest fit for a premium private trip — Rueda-managed chauffeur service with driver included.`;
    } else {
      recommendation = `Based on your route and timing, ${desc} appears to be the strongest fit among what’s open in this market.`;
    }
  } else if (preference === "mobility" && recommendedTier === "mobility") {
    recommendation = `Based on your preference and this market, ${recommendationDescriptor("mobility")} is the right path — independent hosts and drivers, coordinated through Rueda.`;
  } else if (
    requestedTier &&
    availability[requestedTier] &&
    recommendedTier === requestedTier
  ) {
    recommendation = `Based on your route and timing, ${recommendationDescriptor(recommendedTier)} appears to be a strong fit.`;
  } else {
    recommendation = `Based on your route and timing, ${recommendationDescriptor(recommendedTier)} appears to be a strong fit.`;
  }

  return {
    requestSummary,
    marketInterpretation,
    recommendation,
    note,
    preview: PREVIEW,
    tierChips,
  };
}
