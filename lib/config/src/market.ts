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
 * Numerazione preventivi: `N° n/aaaa del gg/mm/aaaa` (stile PrevAI v1).
 * `seq` è progressivo per anno solare.
 */
export function formatQuoteNumber(seq: number, date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `N° ${seq}/${yyyy} del ${dd}/${mm}/${yyyy}`;
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
