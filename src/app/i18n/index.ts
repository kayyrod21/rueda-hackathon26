import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";
import es from "./es";

export function createI18n() {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: "en",
    fallbackLng: "en",
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}
