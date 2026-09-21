import { createContext, useCallback, useContext, useMemo, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { MARKET } from "@workspace/config";
import { type Lang } from "./translations";
import { lookup, subscribeTranslations, getTranslationsVersion } from "./registry";

// V2-2: PrevAI è monolingua (italiano). Il provider conserva la stessa API
// di QuoteAI (`lang`, `t`, `setLang`, `toggleLang`) così i ~200 consumatori
// non cambiano; `setLang`/`toggleLang` sono no-op e `lang` vale sempre "it".

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** `initialLang` è accettato per compatibilità con entry-server.tsx; è sempre "it". */
export function LanguageProvider({ children }: { children: ReactNode; initialLang?: Lang }) {
  const lang: Lang = MARKET.lang;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((_next: Lang) => {}, []);
  const toggleLang = useCallback(() => {}, []);

  // Re-create `t` when a lazy chunk registers more keys (dashboard dictionary).
  const dictVersion = useSyncExternalStore(subscribeTranslations, getTranslationsVersion, getTranslationsVersion);
  const t = useCallback(
    (key: string) => lookup(lang, key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, dictVersion]
  );

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

/** @deprecated V2-2: non esistono route /fr, vale sempre false. Da rimuovere in V2-2b con la nuova seo-data. */
export function isFrenchPath(_pathname: string): boolean {
  return false;
}
