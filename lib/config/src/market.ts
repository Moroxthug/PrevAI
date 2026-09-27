/** Identità e parametri di mercato. Unica lingua: italiano. */
export const MARKET = {
  country: "IT",
  countryName: "Italia",
  currency: "EUR",
  currencySymbol: "€",
  locale: "it-IT",
  timeZone: "Europe/Rome",
  lang: "it",
  brand: "PrevAI",
  domain: "prevai.it",
  siteUrl: "https://prevai.it",
  supportEmail: "supporto@prevai.it",
  /** Prefisso telefonico internazionale. */
  phonePrefix: "+39",
  /** Validità predefinita di un preventivo (giorni). */
  quoteValidityDays: 30,
} as const;

export type Lang = typeof MARKET.lang;
export const LANGS: readonly Lang[] = ["it"] as const;

/**
 * Numerazione preventivi: `N° n.aaaa del gg/mm/aaaa`, identica a PrevAI v1
 * (i preventivi già in produzione hanno questo formato). Data in ora italiana.
 */
export function formatQuoteNumber(seq: number, date: Date = new Date()): string {
  const parti = new Intl.DateTimeFormat(MARKET.locale, { timeZone: MARKET.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const p = (tipo: string) => parti.find((x) => x.type === tipo)?.value ?? "";
  return `N° ${seq}.${p("year")} del ${p("day")}/${p("month")}/${p("year")}`;
}

export type PaymentPresetTerm = { label: string; percent: number };
export type PaymentPreset = { id: string; label: string; terms: readonly PaymentPresetTerm[] };

/** Preset di pagamento: acconto / SAL / saldo (il "Progress Billing" di QuoteAI era il SAL di PrevAI v1). */
export const PAYMENT_PRESETS: readonly PaymentPreset[] = [
  { id: "saldo_fine_lavori", label: "Saldo a fine lavori", terms: [{ label: "Saldo a fine lavori", percent: 100 }] },
  { id: "acconto_saldo", label: "30 % acconto · 70 % saldo", terms: [{ label: "Acconto alla firma", percent: 30 }, { label: "Saldo a fine lavori", percent: 70 }] },
  { id: "acconto_sal_saldo", label: "30 % acconto · 40 % SAL · 30 % saldo", terms: [{ label: "Acconto alla firma", percent: 30 }, { label: "SAL (stato avanzamento lavori)", percent: 40 }, { label: "Saldo a fine lavori", percent: 30 }] },
  { id: "terzi", label: "3 rate uguali", terms: [{ label: "Acconto alla firma", percent: 34 }, { label: "SAL a metà lavori", percent: 33 }, { label: "Saldo a fine lavori", percent: 33 }] },
];
