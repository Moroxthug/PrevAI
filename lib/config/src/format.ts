import { MARKET } from "./market";

/** "1.234,56 €" — formato valuta italiano. */
export function fmtEur(amount: number, opts: { decimals?: number } = {}): string {
  const d = opts.decimals ?? 2;
  return new Intl.NumberFormat(MARKET.locale, { style: "currency", currency: MARKET.currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(amount);
}

/** "1.234,56 €" a partire da centesimi (fatture). */
export function fmtEurCents(cents: number): string {
  return fmtEur(cents / 100);
}

/** "1.234,56" senza simbolo (celle di tabella dove il € è in intestazione). */
export function fmtNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat(MARKET.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

/** "22 %" / "9,975 %" — percentuale con spazio prima del simbolo (norma tipografica italiana). */
export function fmtPercent(rate: number): string {
  return `${new Intl.NumberFormat(MARKET.locale, { maximumFractionDigits: 3 }).format(rate)} %`;
}

/** "21/09/2026" */
export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(MARKET.locale, { timeZone: MARKET.timeZone });
}

/** "21 settembre 2026" */
export function fmtDateLong(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(MARKET.locale, { dateStyle: "long", timeZone: MARKET.timeZone });
}

/** "21 settembre 2026, 09:30" */
export function fmtDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(MARKET.locale, { dateStyle: "long", timeStyle: "short", timeZone: MARKET.timeZone });
}

/** Data "civile" YYYY-MM-DD (senza orario) → "21 settembre 2026". */
export function fmtIsoDateLong(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(MARKET.locale, { dateStyle: "long" });
}
