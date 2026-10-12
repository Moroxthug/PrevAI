// Le regole della schermata Libri (Books.dc.html, QuoteAI 127.1): i mesi, la lista di controllo con i suoi «non serve», quando
// il mese si può chiudere e i movimenti dell'estratto conto con ciò che ciascuno potrebbe essere. Pure, quindi provate (books.test.ts).
// Le forme del server sono quelle di routes/primanota.ts (`/fiscale/libri`, `/fiscale/banca`).

export type CheckKey = "bank_unmatched" | "payments_unbanked" | "costs_pending" | "sdi_open" | "invoices_draft" | "time_unapproved";
export type CheckRow = { id: string; label: string; date: string; cents: number };
export type CheckItem = { key: CheckKey; applies: boolean; count: number; cents: number; rows: CheckRow[] };
export type CloseDto = { month: string; closedAt: string; closedByName: string | null; note: string; snapshot: Record<string, { count: number; cents: number }> };
export type MonthChecklist = {
  month: string; first: string; last: string; bankFeed: boolean; items: CheckItem[]; open: number;
  closed: CloseDto | null; changedSinceClose: CheckKey[]; closedMonths: string[];
};
/** `GET /api/fiscale/libri`: la panoramica e la lista del mese chiesto (o dell'ultimo finito). */
export type BooksOverview = {
  today: string;
  bank: { connected: boolean; account: string | null; lastImportAt: string | null };
} & MonthChecklist;

// ── Movimenti dell'estratto conto ───────────────────────────────────────────

export type MatchKind = "incasso" | "costo" | "versamento" | "movimento";
export type Suggerimento =
  | { azione: "abbina"; tipo: MatchKind; id: string; etichetta: string; certezza: "alta" | "media" }
  | { azione: "registra_incasso"; invoiceId: string; etichetta: string; certezza: "alta" | "media" }
  | { azione: "registra_costo"; etichetta: string; categoria: string }
  | { azione: "registra_movimento"; etichetta: string; categoria: string }
  | { azione: "scadenzario"; etichetta: string };
export type MovimentoDto = {
  id: string; data: string; importoCents: number; descrizione: string; controparte: string;
  stato: "da_abbinare" | "abbinato" | "ignorato"; abbinamento: { tipo: MatchKind; id: string } | null; suggerimenti: Suggerimento[];
};
export type BankLine = {
  id: string; date: string; description: string; amountCents: number; status: "unmatched" | "matched" | "ignored";
  match: MatchKind | null; suggestions: Suggerimento[];
};

export function lineOf(m: MovimentoDto): BankLine {
  return {
    id: m.id, date: m.data, description: m.controparte && !m.descrizione.includes(m.controparte) ? `${m.controparte} · ${m.descrizione}`.slice(0, 120) : m.descrizione || m.controparte,
    amountCents: m.importoCents, status: m.stato === "da_abbinare" ? "unmatched" : m.stato === "ignorato" ? "ignored" : "matched",
    match: m.abbinamento?.tipo ?? null, suggestions: m.suggerimenti,
  };
}

// ── Mesi ────────────────────────────────────────────────────────────────────

export const monthOf = (day: string): string => day.slice(0, 7);

/** `AAAA-MM` spostato di `by` mesi. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

/** Le schede dei mesi: gli ultimi quattro, dal più vecchio, fino a quello in corso. */
export function monthChips(today: string, closedMonths: string[]): { month: string; closed: boolean }[] {
  const now = monthOf(today);
  return [-3, -2, -1, 0].map((d) => shiftMonth(now, d)).map((month) => ({ month, closed: closedMonths.includes(month) }));
}

/** Il mese su cui aprire: quello appena finito (quello da chiudere), come fa anche il server. */
export const defaultMonth = (today: string): string => shiftMonth(monthOf(today), -1);

/** Un mese si può chiudere solo quando è finito. */
export const monthIsOver = (month: string, today: string): boolean => month < monthOf(today);

/** Il primo del mese a mezzogiorno sull'orologio del telefono, per i nomi dei mesi di Intl. */
export function monthDate(month: string): Date {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1, 12);
}

// ── La lista di controllo ───────────────────────────────────────────────────

export type CheckState = { key: CheckKey; count: number; na: boolean; open: boolean; rows: CheckRow[] };

/** Le voci che valgono per questa impresa (senza estratto conto niente voci di banca), ognuna aperta, a posto o «non serve». */
export function checklist(items: CheckItem[], na: ReadonlySet<string>): CheckState[] {
  return items.filter((i) => i.applies).map((i) => {
    const marked = na.has(i.key);
    return { key: i.key, count: i.count, rows: i.rows, na: marked, open: i.count > 0 && !marked };
  });
}

export const openCount = (list: CheckState[]): number => list.filter((i) => i.open).length;

export type CloseState = "closed" | "notOver" | "openItems" | "ready";
/** Cosa può fare il pulsante del mese: già chiuso, ancora in corso, voci aperte, pronto. */
export function closeState(month: string, today: string, list: CheckState[], closed: boolean): CloseState {
  if (closed) return "closed";
  if (!monthIsOver(month, today)) return "notOver";
  return openCount(list) > 0 ? "openItems" : "ready";
}

/** I «non serve» di un mese restano sul telefono, mese per mese. */
export const naKey = (month: string): string => `books.na.${month}`;
export function parseNa(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try { const v = JSON.parse(raw); return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []); } catch { return new Set(); }
}
export const serializeNa = (na: ReadonlySet<string>): string => JSON.stringify([...na].sort());

// ── Movimenti ───────────────────────────────────────────────────────────────

/** Un giorno `AAAA-MM-GG` come data a mezzogiorno sull'orologio del telefono (così la data breve stampa il giorno giusto). */
export function dayDate(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

export type BankFilter = "open" | "matched" | "ignored";
export const BANK_FILTERS: BankFilter[] = ["open", "matched", "ignored"];
const filterOf = (l: BankLine): BankFilter => (l.status === "unmatched" ? "open" : l.status === "ignored" ? "ignored" : "matched");

/** I movimenti del mese, dal più recente. */
export function monthLines(lines: BankLine[], month: string): BankLine[] {
  return lines.filter((l) => monthOf(l.date) === month).sort((a, b) => b.date.localeCompare(a.date));
}
export function filterCounts(lines: BankLine[]): Record<BankFilter, number> {
  const c: Record<BankFilter, number> = { open: 0, matched: 0, ignored: 0 };
  for (const l of lines) c[filterOf(l)] += 1;
  return c;
}
export const linesFor = (lines: BankLine[], filter: BankFilter): BankLine[] => lines.filter((l) => filterOf(l) === filter);

/** Il segno dei soldi come nel disegno: +2.340,00 € / −412,66 € (l'importo lo formatta chi chiama). */
export const signOf = (cents: number): "+" | "−" => (cents < 0 ? "−" : "+");

// ── Cosa potrebbe essere un movimento ───────────────────────────────────────

/** Abbinamenti con una riga che esiste già, o incasso di una fattura: ciò che si fa con un tocco solo. */
export type MatchSuggestion = Extract<Suggerimento, { azione: "abbina" | "registra_incasso" }>;
export const isMatch = (s: Suggerimento): s is MatchSuggestion => s.azione === "abbina" || s.azione === "registra_incasso";

/** Le proposte di abbinamento, le più sicure per prime. */
export function matches(l: BankLine): MatchSuggestion[] {
  return l.suggestions.filter(isMatch).sort((a, b) => Number(b.certezza === "alta") - Number(a.certezza === "alta"));
}

/** La cosa più probabile che un movimento sia, o nulla. */
export const suggestion = (l: BankLine): MatchSuggestion | null => matches(l)[0] ?? null;

/** Altro che si può fare del movimento: registrarlo come costo o come movimento di prima nota, o l'F24. */
export const otherActions = (l: BankLine): Suggerimento[] => l.suggestions.filter((s) => !isMatch(s));

/**
 * Un movimento per cui serve il foglio («Abbina…»): nessuna proposta, o più di una sicura. Una sola proposta (un abbinamento o
 * l'incasso di una fattura) si applica con un tocco.
 */
export function needsPicker(l: BankLine): boolean {
  const m = matches(l);
  if (m.length === 0) return true;
  const strong = m.filter((s) => s.certezza === "alta");
  if (strong.length > 0) return strong.length !== 1;
  return m.length !== 1;
}
