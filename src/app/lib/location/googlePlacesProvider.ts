import type {
  LocationAutocompleteProvider,
  PlaceDetailsOutcome,
  PredictionsOutcome,
} from "./providerOutcomes";
import type { PlacePrediction, StructuredPlace } from "./placeTypes";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

function placeDetailsUrl(resourceName: string): string {
  const id = resourceName.replace(/^places\//, "").trim();
  return `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`;
}

type GoogleText = { text?: string };
type GoogleStructured = {
  mainText?: GoogleText;
  secondaryText?: GoogleText;
};
type GooglePlacePrediction = {
  place?: string;
  placeId?: string;
  text?: GoogleText;
  structuredFormat?: GoogleStructured;
  types?: string[];
};
type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: GooglePlacePrediction;
  }>;
  error?: { message?: string; status?: string };
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlaceDetails = {
  id?: string;
  displayName?: GoogleText;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: GoogleAddressComponent[];
  types?: string[];
  error?: { message?: string; status?: string };
};

function mapPrediction(p: GooglePlacePrediction): PlacePrediction | null {
  const placeId = p.placeId?.trim();
  const resourceName = (p.place ?? "").trim();
  if (!placeId || !resourceName) return null;
  const primary =
    p.structuredFormat?.mainText?.text?.trim() ||
    p.text?.text?.trim() ||
    placeId;
  const secondary =
    p.structuredFormat?.secondaryText?.text?.trim() || "";
  return {
    placeId,
    resourceName,
    primaryText: primary,
    secondaryText: secondary,
    types: p.types,
  };
}

function parseAddressComponents(
  components: GoogleAddressComponent[] | undefined,
): Pick<StructuredPlace, "city" | "country" | "region"> {
  let country: string | undefined;
  let region: string | undefined;
  let city: string | undefined;

  if (!components) return {};

  for (const c of components) {
    const types = c.types ?? [];
    if (types.includes("country")) {
      country = (c.shortText || c.longText || "").trim() || undefined;
    }
    if (types.includes("administrative_area_level_1")) {
      region = (c.shortText || c.longText || "").trim() || undefined;
    }
    if (types.includes("locality")) {
      city = (c.longText || c.shortText || "").trim() || undefined;
    }
  }
  if (!city) {
    for (const c of components) {
      const types = c.types ?? [];
      if (types.includes("postal_town") || types.includes("administrative_area_level_2")) {
        city = (c.longText || c.shortText || "").trim() || undefined;
        if (city) break;
      }
    }
  }
  if (!city) {
    for (const c of components) {
      const types = c.types ?? [];
      if (types.includes("sublocality") || types.includes("sublocality_level_1")) {
        city = (c.longText || c.shortText || "").trim() || undefined;
        if (city) break;
      }
    }
  }

  return { country, region, city };
}

function mapPlaceDetails(
  raw: GooglePlaceDetails,
  fallbackLabel: string,
): StructuredPlace | null {
  const placeId = raw.id?.replace(/^places\//, "").trim();
  const lat = raw.location?.latitude;
  const lng = raw.location?.longitude;
  if (!placeId || lat == null || lng == null) return null;

  const label =
    raw.displayName?.text?.trim() ||
    raw.formattedAddress?.trim() ||
    fallbackLabel;
  const formatted = raw.formattedAddress?.trim() || label;
  const { city, country, region } = parseAddressComponents(
    raw.addressComponents,
  );

  return {
    placeId,
    label,
    formattedAddress: formatted,
    city,
    country,
    region,
    lat,
    lng,
    types: raw.types,
  };
}

export function createGooglePlacesProvider(
  apiKey: string,
): LocationAutocompleteProvider {
  const configured = Boolean(apiKey);

  return {
    id: "google_places_v1",

    isConfigured() {
      return configured;
    },

    async fetchPredictions(
      input: string,
      sessionToken: string,
    ): Promise<PredictionsOutcome> {
      const q = input.trim();
      if (!configured) {
        return { ok: false, reason: "missing_key" };
      }
      if (q.length < 2) {
        return { ok: false, reason: "empty_input" };
      }

      const body: Record<string, unknown> = {
        input: q,
        languageCode: "en",
        sessionToken,
      };

      try {
        const res = await fetch(AUTOCOMPLETE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
          },
          body: JSON.stringify(body),
        });

        const json = (await res.json()) as GoogleAutocompleteResponse;

        if (!res.ok) {
          return {
            ok: false,
            reason: "invalid_response",
            message: json.error?.message || res.statusText,
          };
        }

        const raw = json.suggestions ?? [];
        const predictions: PlacePrediction[] = [];
        for (const s of raw) {
          const pp = s.placePrediction;
          if (!pp) continue;
          const mapped = mapPrediction(pp);
          if (mapped) predictions.push(mapped);
        }

        return { ok: true, predictions };
      } catch (e) {
        return {
          ok: false,
          reason: "network",
          message: e instanceof Error ? e.message : String(e),
        };
      }
    },

    async fetchPlaceDetails(
      resourceName: string,
      sessionToken: string,
    ): Promise<PlaceDetailsOutcome> {
      if (!configured) {
        return { ok: false, reason: "missing_key" };
      }

      const url = new URL(placeDetailsUrl(resourceName));
      url.searchParams.set("sessionToken", sessionToken);
      url.searchParams.set("languageCode", "en");

      try {
        const res = await fetch(url.href, {
          method: "GET",
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "id,displayName,formattedAddress,location,addressComponents,types",
          },
        });

        const json = (await res.json()) as GooglePlaceDetails;

        if (!res.ok) {
          return {
            ok: false,
            reason: "invalid_response",
            message: json.error?.message || res.statusText,
          };
        }

        const place = mapPlaceDetails(json, resourceName);
        if (!place) {
          return {
            ok: false,
            reason: "invalid_response",
            message: "Incomplete place payload",
          };
        }

        return { ok: true, place };
      } catch (e) {
        return {
          ok: false,
          reason: "network",
          message: e instanceof Error ? e.message : String(e),
        };
      }
    },
  };
}
