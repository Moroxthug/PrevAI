// PrevAI parla solo italiano (it-IT). QuoteAI qui sceglie en-CA o fr-CA dal telefono; da noi
// i testi passano comunque da i18next, così le schermate portate da QuoteAI restano uguali.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { it } from "./it";

export const LOCALE = "it-IT";

void i18n.use(initReactI18next).init({
  resources: { it: { translation: it } },
  lng: "it",
  fallbackLng: "it",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
