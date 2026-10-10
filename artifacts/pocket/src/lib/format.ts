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

/** "mar 29 set" (campi data) */
export function dayDate(d: Date, locale: Locale = "it-IT"): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(d).replace(/,/g, "");
}

/** Una frase che finisce con un'abbreviazione ("… alle 9:12 a.m." + ".") tiene un solo punto. */
export function sentence(s: string): string {
  return s.replace(/\.\.$/, ".");
}

/** "ven" */
export function weekdayShort(d: Date, locale: Locale = "it-IT"): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
}

/** "settembre" */
export function monthLong(d: Date, locale: Locale = "it-IT"): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(d);
}

/** La data in cima alla Home: "mar 29 set" */
export function headerDate(d: Date, locale: Locale = "it-IT"): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(d).replace(/,/g, "");
}

/**
 * Quando è successo, come lo dicono i pannelli: "12 min fa", "2 h fa", "oggi", "lun" entro la settimana,
 * poi "12 set". `now` si passa da fuori per poterlo provare.
 */
export function relativeWhen(at: Date, now: Date, locale: Locale = "it-IT"): string {
  const mins = Math.round((now.getTime() - at.getTime()) / 60_000);
  const ago = (n: number, unit: "min" | "h") => `${n} ${unit} fa`;
  if (mins >= 0 && mins < 60) return ago(Math.max(1, mins), "min");
  const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
  if (sameDay && mins >= 0) return mins < 60 * 12 ? ago(Math.round(mins / 60), "h") : "oggi";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days === 1) return "ieri";
  if (days > 1 && days < 7) return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(at);
  return shortDate(at, locale);
}
