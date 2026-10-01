// COMPONENTS §1: soldi, numeri e date sempre con Intl, mai composti a mano. PrevAI usa
// it-IT come il sito (lib/money.ts): 4131,05 € · 18.000 € · 29 set · 14:30.
export type Locale = "it-IT";

export function money(amount: number, locale: Locale = "it-IT", opts: { cents?: boolean } = {}): string {
  const cents = opts.cents ?? true;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(amount);
}

export function number(n: number, locale: Locale = "it-IT", digits = 0): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function percent(n: number, locale: Locale = "it-IT", digits = 0): string {
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** "29 set" */
export function shortDate(d: Date, locale: Locale = "it-IT"): string {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(d);
}

/** "14:30" */
export function time(d: Date, locale: Locale = "it-IT"): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}
