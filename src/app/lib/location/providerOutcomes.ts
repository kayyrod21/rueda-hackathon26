import type { PlacePrediction, StructuredPlace } from "./placeTypes";

export type PredictionsOutcome =
  | { ok: true; predictions: PlacePrediction[] }
  | {
      ok: false;
      reason: "missing_key" | "network" | "invalid_response" | "empty_input";
      message?: string;
    };

export type PlaceDetailsOutcome =
  | { ok: true; place: StructuredPlace }
  | {
      ok: false;
      reason: "missing_key" | "network" | "invalid_response";
      message?: string;
    };

export interface LocationAutocompleteProvider {
  readonly id: string;
  isConfigured(): boolean;
  fetchPredictions(
    input: string,
    sessionToken: string,
  ): Promise<PredictionsOutcome>;
  fetchPlaceDetails(
    resourceName: string,
    sessionToken: string,
  ): Promise<PlaceDetailsOutcome>;
}
