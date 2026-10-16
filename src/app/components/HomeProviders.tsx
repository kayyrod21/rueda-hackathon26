"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "../i18n";
import type { UserServicePreference } from "../lib/conciergeMarket";
import { AIConciergeModal } from "./AIConciergeModal";

type Launch = { initialServicePreference: UserServicePreference; source: string };
const ConciergeContext = createContext<((launch?: Launch) => void) | null>(null);
export function useOpenConcierge() {
  const open = useContext(ConciergeContext);
  if (!open) throw new Error("Concierge controls require HomeProviders");
  return open;
}

/** Only the homepage's existing language and modal interactions live here. */
export function HomeProviders({ children }: { children: ReactNode }) {
  const [i18n] = useState(createI18n);
  const [open, setOpen] = useState(false);
  const [launch, setLaunch] = useState<Launch | null>(null);
  const openConcierge = useCallback((next?: Launch) => {
    setLaunch(next ?? null);
    setOpen(true);
  }, []);
  useEffect(() => {
    const syncLanguage = (language: string) => { document.documentElement.lang = language; };
    i18n.on("languageChanged", syncLanguage);
    return () => { i18n.off("languageChanged", syncLanguage); };
  }, [i18n]);
  return (
    <I18nextProvider i18n={i18n}>
      <ConciergeContext.Provider value={openConcierge}>
        {children}
        <AIConciergeModal open={open} onOpenChange={(value) => {
          setOpen(value);
          if (!value) setLaunch(null);
        }} initialServicePreference={launch?.initialServicePreference} conciergeEntrySource={launch?.source} />
      </ConciergeContext.Provider>
    </I18nextProvider>
  );
}
