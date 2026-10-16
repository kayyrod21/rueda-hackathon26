import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { LocationAutocompleteProvider } from "../lib/location/locationProvider";
import type { PlacePrediction, StructuredPlace } from "../lib/location/placeTypes";
import { usePlacesAutocomplete } from "../hooks/usePlacesAutocomplete";
import { cn } from "./ui/utils";

export type PlaceAutocompleteFieldProps = {
  provider: LocationAutocompleteProvider;
  sessionToken: string;
  /** Call after a place is successfully resolved so a new billing session can start */
  onSessionConsumed: () => void;
  id: string;
  icon: ReactNode;
  placeholder: string;
  value: string;
  onChangeValue: (v: string) => void;
  selectedPlace: StructuredPlace | null;
  onPlaceChange: (place: StructuredPlace | null) => void;
  inputClassName: string;
  listboxId: string;
};

export function PlaceAutocompleteField({
  provider,
  sessionToken,
  onSessionConsumed,
  id,
  icon,
  placeholder,
  value,
  onChangeValue,
  selectedPlace,
  onPlaceChange,
  inputClassName,
  listboxId,
}: PlaceAutocompleteFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const activeId = useId();

  const configured = provider.isConfigured();
  const { predictions, loading, error } = usePlacesAutocomplete(
    provider,
    sessionToken,
    value,
  );

  const showList =
    open &&
    configured &&
    value.trim().length >= 2 &&
    (predictions.length > 0 || loading || resolving || !!error);

  const handleChange = useCallback(
    (v: string) => {
      onChangeValue(v);
      setDetailError(null);
      if (selectedPlace && v !== selectedPlace.label) {
        onPlaceChange(null);
      }
      setOpen(true);
      setActiveIdx(-1);
    },
    [onChangeValue, onPlaceChange, selectedPlace],
  );

  const pickPrediction = useCallback(
    async (p: PlacePrediction) => {
      if (!configured) return;
      setResolving(true);
      setOpen(false);
      const res = await provider.fetchPlaceDetails(p.resourceName, sessionToken);
      setResolving(false);
      if (res.ok) {
        setDetailError(null);
        onPlaceChange(res.place);
        onChangeValue(res.place.label);
        onSessionConsumed();
      } else {
        setDetailError(
          "Couldn’t load this place. Try another suggestion or check your API key.",
        );
        setOpen(true);
        onPlaceChange(null);
      }
    },
    [
      configured,
      provider,
      sessionToken,
      onPlaceChange,
      onChangeValue,
      onSessionConsumed,
    ],
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!configured || !open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) =>
        Math.min(i + 1, Math.max(0, predictions.length - 1)),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0 && predictions[activeIdx]) {
      e.preventDefault();
      void pickPrediction(predictions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-[calc(0.875rem+0.125rem)] text-white/35">
          {icon}
        </span>
        <input
          id={id}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => configured && setOpen(true)}
          onKeyDown={onKeyDown}
          role={configured ? "combobox" : undefined}
          aria-expanded={configured ? showList : undefined}
          aria-controls={configured ? listboxId : undefined}
          aria-autocomplete={configured ? "list" : undefined}
          aria-activedescendant={
            showList && activeIdx >= 0
              ? `${activeId}-opt-${activeIdx}`
              : undefined
          }
          className={inputClassName}
        />
      </div>

      {detailError ? (
        <p className="mt-1.5 pl-1 text-xs tracking-wide text-white/45">
          {detailError}
        </p>
      ) : null}

      {configured && showList ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-[80] mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-white/[0.12] bg-[#161616] py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
        >
          {loading || resolving ? (
            <li className="px-4 py-3 text-xs tracking-wide text-white/40">
              Searching places…
            </li>
          ) : error ? (
            <li className="px-4 py-3 text-xs tracking-wide text-white/50">
              {error}
            </li>
          ) : predictions.length === 0 ? (
            <li className="px-4 py-3 text-xs tracking-wide text-white/40">
              No matches found. Try a street or landmark.
            </li>
          ) : (
            predictions.map((p, idx) => (
              <li key={`${p.placeId}-${idx}`} role="presentation">
                <button
                  type="button"
                  id={`${activeId}-opt-${idx}`}
                  role="option"
                  aria-selected={idx === activeIdx}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors",
                    idx === activeIdx
                      ? "bg-white/[0.08]"
                      : "hover:bg-white/[0.05]",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pickPrediction(p)}
                >
                  <span className="text-sm tracking-wide text-white/90">
                    {p.primaryText}
                  </span>
                  {p.secondaryText ? (
                    <span className="text-[0.65rem] tracking-wide text-white/38">
                      {p.secondaryText}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
