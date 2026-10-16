/**
 * Structured place data — provider-agnostic shape for concierge + market logic.
 */

export type StructuredPlace = {
  placeId: string;
  /** Primary line shown in the input */
  label: string;
  formattedAddress: string;
  city?: string;
  /** Region / state / department (short code when available, e.g. FL, NY) */
  region?: string;
  /** ISO 3166-1 alpha-2 */
  country?: string;
  lat: number;
  lng: number;
  types?: string[];
};

export type PlacePrediction = {
  placeId: string;
  /** Resource name for Google Places v1, e.g. `places/ChIJ…` */
  resourceName: string;
  primaryText: string;
  secondaryText: string;
  types?: string[];
};
