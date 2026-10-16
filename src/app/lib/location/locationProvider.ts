import { createGooglePlacesProvider } from "./googlePlacesProvider";
import type { LocationAutocompleteProvider } from "./providerOutcomes";

export type {
  LocationAutocompleteProvider,
  PlaceDetailsOutcome,
  PredictionsOutcome,
} from "./providerOutcomes";

let missingKeyWarned = false;

export function warnMissingGoogleMapsKeyOnce(): void {
  if (missingKeyWarned) return;
  missingKeyWarned = true;
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[Rueda Concierge] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Location autocomplete is disabled; " +
        "set the key in .env for live Places suggestions.",
    );
  }
}

export function getGoogleMapsApiKey(): string {
  const k = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return k ?? "";
}

export function createDefaultLocationProvider(): LocationAutocompleteProvider {
  const key = getGoogleMapsApiKey();
  if (!key) {
    warnMissingGoogleMapsKeyOnce();
  }
  return createGooglePlacesProvider(key);
}
