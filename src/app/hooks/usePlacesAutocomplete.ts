import { useEffect, useState } from "react";
import type { LocationAutocompleteProvider } from "../lib/location/locationProvider";
import type { PlacePrediction } from "../lib/location/placeTypes";

const DEBOUNCE_MS = 300;

export function usePlacesAutocomplete(
  provider: LocationAutocompleteProvider,
  sessionToken: string,
  query: string,
): {
  predictions: PlacePrediction[];
  loading: boolean;
  error: string | null;
} {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!provider.isConfigured()) {
      setPredictions([]);
      setError(null);
      setLoading(false);
      return;
    }

    const q = query.trim();
    if (q.length < 2) {
      setPredictions([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void provider.fetchPredictions(q, sessionToken).then((res) => {
        if (cancelled) return;
        setLoading(false);
        if (res.ok) {
          setPredictions(res.predictions);
          setError(null);
          return;
        }
        setPredictions([]);
        if (res.reason === "missing_key" || res.reason === "empty_input") {
          setError(null);
          return;
        }
        setError(
          res.message?.trim() ||
            (res.reason === "network"
              ? "Couldn’t reach Places. Check your connection."
              : "Couldn’t load suggestions."),
        );
      });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [provider, sessionToken, query]);

  return { predictions, loading, error };
}
