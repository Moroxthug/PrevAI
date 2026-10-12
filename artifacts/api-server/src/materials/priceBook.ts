import type { PriceItemKind, QuoteChapter } from "@workspace/db";

// POCKET-4 (QuoteAI 127.6 Listino): di che tipo è una riga del listino e dove l'impresa l'ha usata.

/** Le unità che vogliono dire «una cosa che si compra»; il resto (ore, giorni, mq di posa, a corpo) è manodopera. Una stima, per le righe fatte prima che avessero un tipo. */
const MATERIAL_UNITS = new Set(["cad", "pz", "pezzo", "pezzi", "kg", "q", "t", "l", "lt", "litro", "litri", "sacco", "sacchi", "conf", "confezione", "scatola", "scatole", "rotolo", "rotoli", "lastra", "lastre", "barra", "barre", "bancale", "bancali"]);

export function kindOf(stored: PriceItemKind | null | undefined, um: string): PriceItemKind {
  if (stored) return stored;
  return MATERIAL_UNITS.has(um.trim().toLowerCase()) ? "material" : "labour";
}

export const itemKey = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, " ");

export type QuoteLines = { createdAt: Date; capitoli: QuoteChapter[] | null };
export type Usage = { lastUsedAt: string; usesThisMonth: number };

const linesOf = (q: QuoteLines): string[] =>
  (Array.isArray(q.capitoli) ? q.capitoli : []).flatMap((ch) => (Array.isArray(ch.voci) ? ch.voci : []).map((v) => v?.descrizione).filter((d): d is string => !!d)).map(itemKey);

const sameMonth = (a: Date, b: Date): boolean => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

/** For each description (lower-cased, spaces folded): the date of the newest quote with a line like it, and how many such lines this month's quotes hold. */
export function usageOf(quotes: QuoteLines[], now: Date): Map<string, Usage> {
  const out = new Map<string, Usage>();
  for (const q of quotes) {
    const at = q.createdAt.toISOString();
    const month = sameMonth(q.createdAt, now);
    for (const k of linesOf(q)) {
      const u = out.get(k) ?? { lastUsedAt: at, usesThisMonth: 0 };
      if (at > u.lastUsedAt) u.lastUsedAt = at;
      if (month) u.usesThisMonth++;
      out.set(k, u);
    }
  }
  return out;
}

/** How many lines of this month's quotes are price book items, and in how many quotes. */
export function monthUse(quotes: QuoteLines[], keys: Set<string>, now: Date): { lines: number; quotes: number } {
  let lines = 0;
  let inQuotes = 0;
  for (const q of quotes) {
    if (!sameMonth(q.createdAt, now)) continue;
    const n = linesOf(q).filter((k) => keys.has(k)).length;
    lines += n;
    if (n) inQuotes++;
  }
  return { lines, quotes: inQuotes };
}

/** The price changed this calendar month or the month before is too loose; the board counts "since the 1st", so the cut-off is the start of the month. */
export const startOfMonth = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/** The price when it changed (the old price is what the mark and the "was $x" line show). */
export function priceChange(oldPrice: number, newPrice: number, now: Date): { previousPrice: number; priceChangedAt: Date } | null {
  if (Math.abs(oldPrice - newPrice) < 0.005) return null;
  return { previousPrice: oldPrice, priceChangedAt: now };
}
