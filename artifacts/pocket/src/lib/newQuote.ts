// New quote's rules (NewQuote.dc.html), pure so they are tested (newQuote.test.ts): the three ways to build a quote
// (write with AI, manual, from the price list), the progress of the writing card, the manual quote's lines and totals,
// the price-list selection, and the bodies the server takes (POST /api/quotes/manual; the AI form goes through
// firstQuoteApi.create).
import { canBuild, parseBudget } from "./quoteBar.ts";
import { parseAmount } from "./quoteEditor.ts";
import { isFixed, recompute, round2, type Chapter } from "./quoteMath.ts";
import { isGenericTitle } from "./quotes.ts";

// ── Modes ─────────────────────────────────────────────────────────────────────

export const MODES = ["ai", "manual", "priceList"] as const;
export type Mode = (typeof MODES)[number];

/** The trades of "Start from an example", in the board's order; the sentence for each is in the strings. */
export const EXAMPLES = ["painting", "drywall", "flooring", "decks", "bathrooms", "kitchens", "basements"] as const;
export type ExampleId = (typeof EXAMPLES)[number];

/** PDF layouts in the board's order, and the server's template for each (the same ones the web editor offers). */
export const LAYOUTS = ["standard", "professional", "elegant"] as const;
export type Layout = (typeof LAYOUTS)[number];
export type TemplateId = "standard" | "arosio" | "mariagrazia";
const TEMPLATE: Record<Layout, TemplateId> = { standard: "standard", professional: "arosio", elegant: "mariagrazia" };
export const templateIdOf = (layout: Layout): TemplateId => TEMPLATE[layout];

/** A description is ready to write when it has something other than spaces. */
export const canWrite = canBuild;

/** The target total, as typed ("12,500", "$5 000") → whole dollars, or null when empty. */
export const parseTarget = parseBudget;

// ── The writing card ──────────────────────────────────────────────────────────

export const STEPS = ["reading", "measuring", "pricing", "tax", "layout"] as const;
export type StepState = "done" | "cur" | "todo";
export const DONE = STEPS.length + 1;

/**
 * Progress `w`: 0 not started, 1 to 5 working on that step, 6 all done. The steps are timing over the real request:
 * they tick forward while it is pending and wait on the last one; when the answer comes everything finishes.
 */
export function nextProgress(w: number, settled: boolean): number {
  if (settled) return DONE;
  return Math.min(Math.max(w, 0) + 1, STEPS.length);
}

export function stepStates(w: number): StepState[] {
  return STEPS.map((_, i) => (w > i + 1 ? "done" : w === i + 1 ? "cur" : "todo"));
}

export type Summary = { title: string; lines: number; chapters: number; number: string; total: number };
type QuoteShape = {
  titoloPreventivoRiga1?: string | null; titoloPreventivoRiga2?: string | null; descrizioneGenerale?: string; numeroPreventivoData?: string | null; totale?: number;
  capitoli?: { voci?: unknown[] }[]; items?: unknown[];
};

/** What the "ready" card says about the quote the server wrote: its name, the lines and chapters, its number and total. */
export function summaryOf(q: QuoteShape): Summary {
  const caps = q.capitoli ?? [];
  const lines = caps.length ? caps.reduce((n, c) => n + (c.voci?.length ?? 0), 0) : (q.items ?? []).length;
  const head = q.titoloPreventivoRiga1?.trim();
  const generic = isGenericTitle(head);
  const first = (q.descrizioneGenerale ?? "").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  const title = !generic ? (head ?? "") : (q.titoloPreventivoRiga2?.trim() || (first.length > 60 ? `${first.slice(0, 57).trimEnd()}…` : first));
  return { title, lines, chapters: caps.length, number: q.numeroPreventivoData?.trim() ?? "", total: q.totale ?? 0 };
}

// ── Province e IVA ────────────────────────────────────────────────────────────

/** Le province sono quelle italiane (lib/province.ts): qui servono solo la sigla e il controllo che esista. */
export type ProvinceCode = string;

/**
 * In Italia l'IVA non dipende dalla provincia: 22% ordinaria, 10% ridotta (ristrutturazioni e manutenzioni),
 * 4% agevolata (prima casa), 0 per i regimi senza IVA (esente, reverse charge, forfettario). Il server prende
 * l'aliquota in `ivaPercentuale`; non viene mai calcolata dal telefono.
 */
export const IVA_RATES = [22, 10, 4, 0] as const;
export type IvaRate = (typeof IVA_RATES)[number];
export const DEFAULT_IVA: IvaRate = 22;
export const ivaKey = (r: IvaRate): "iva22" | "iva10" | "iva4" | "iva0" => `iva${r}` as "iva22" | "iva10" | "iva4" | "iva0";
export function ivaRateOf(v: number | null | undefined): IvaRate {
  return (IVA_RATES as readonly number[]).includes(v ?? NaN) ? (v as IvaRate) : DEFAULT_IVA;
}

// ── Manual quote ──────────────────────────────────────────────────────────────

export type ManualLine = { id: string; description: string; um: string; quantita: number; prezzoUnitario: number };
export type ManualChapter = { id: string; title: string; lines: ManualLine[] };

export const newManualLine = (id: string, o: Partial<ManualLine> = {}): ManualLine => ({ id, description: "", um: "cad", quantita: 1, prezzoUnitario: 0, ...o });
export const newManualChapter = (id: string, lineId: string, title = ""): ManualChapter => ({ id, title, lines: [newManualLine(lineId)] });

const letter = (i: number) => String.fromCharCode(65 + (i % 26));

function asChapters(chapters: ManualChapter[]): Chapter[] {
  return chapters.map((c, i) => ({ lettera: letter(i), titolo: c.title.trim(), subtotale: 0, voci: c.lines.map((l) => ({ descrizione: l.description.trim(), um: l.um.trim() || "cad", quantita: l.quantita, prezzoUnitario: l.prezzoUnitario, totale: 0 })) }));
}

/** Every line and chapter as the screen shows it, to the cent (blank lines included), and the totals at the tax rate. */
export function manualTotals(chapters: ManualChapter[], rate: number) {
  const r = recompute(asChapters(chapters), rate);
  return { lineTotals: r.capitoli.map((c) => c.voci.map((v) => v.totale)), chapterTotals: r.capitoli.map((c) => c.subtotale), subtotale: r.subtotale, ivaValore: r.ivaValore, totale: r.totale };
}

/** The chapters the server gets: lines with a description only, chapters with no line left dropped, lettered again. */
export function bodyChapters(chapters: ManualChapter[]): Chapter[] {
  const kept = chapters.map((c) => ({ ...c, lines: c.lines.filter((l) => l.description.trim()) })).filter((c) => c.lines.length > 0);
  return recompute(asChapters(kept), 0).capitoli;
}

/** A quote can be saved once at least one line says what the work is. */
export function canSaveManual(chapters: ManualChapter[]): boolean {
  return chapters.some((c) => c.lines.some((l) => l.description.trim()));
}

export function editManualLine(chapters: ManualChapter[], ci: number, li: number, field: "description" | "um" | "quantita" | "prezzoUnitario", value: string): ManualChapter[] {
  return chapters.map((c, i) => (i !== ci ? c : { ...c, lines: c.lines.map((l, j) => (j !== li ? l : { ...l, [field]: field === "quantita" || field === "prezzoUnitario" ? Math.max(0, parseAmount(value)) : value })) }));
}

export function addManualLine(chapters: ManualChapter[], ci: number, id: string): ManualChapter[] {
  return chapters.map((c, i) => (i !== ci ? c : { ...c, lines: [...c.lines, newManualLine(id)] }));
}

export function removeManualLine(chapters: ManualChapter[], ci: number, li: number): ManualChapter[] {
  return chapters.map((c, i) => (i !== ci ? c : { ...c, lines: c.lines.filter((_, j) => j !== li) }));
}

export function renameManualChapter(chapters: ManualChapter[], ci: number, title: string): ManualChapter[] {
  return chapters.map((c, i) => (i === ci ? { ...c, title } : c));
}

// ── Payment terms ─────────────────────────────────────────────────────────────

/** I quattro pagamenti dei pannelli. Le righe che arrivano al server sono quelle che il suo lettore capisce («30% di acconto alla firma»). */
export const TERMS = ["deposit30", "half", "completion", "net15"] as const;
export type TermId = (typeof TERMS)[number];
const TERM_LINES: Record<TermId, string[]> = {
  deposit30: ["30% di acconto alla firma", "70% a fine lavori"],
  half: ["50% alla firma", "50% a fine lavori"],
  completion: ["100% a fine lavori"],
  net15: ["100% a fine lavori, entro 15 giorni"],
};
export const termLines = (t: TermId): string[] => TERM_LINES[t].slice();

// ── Client ────────────────────────────────────────────────────────────────────

export type PickedClient = { id: string; name: string; data: Record<string, string> };
export type NewClientForm = { name: string; address: string; city: string; province: ProvinceCode | ""; postalCode: string; phone: string; email: string };
export const EMPTY_CLIENT: NewClientForm = { name: "", address: "", city: "", province: "", postalCode: "", phone: "", email: "" };

export const canAddNewClient = (c: NewClientForm): boolean => c.name.trim().length > 0;

/** Il CAP: cinque cifre. Quello che non lo è resta com'è stato scritto (spazi tolti ai lati). */
export function postalCode(v: string): string {
  const t = v.trim();
  const digits = t.replace(/\s/g, "");
  return /^\d{5}$/.test(digits) ? digits : t;
}

/** The new-client form → the quote's clientData (the server links or creates the client from it). */
export function newClientData(c: NewClientForm): Record<string, string> {
  const o: Record<string, string> = { nome: c.name.trim(), indirizzo: c.address.trim() };
  if (c.city.trim()) o.city = c.city.trim();
  if (c.province) o.province = c.province;
  if (c.postalCode.trim()) o.postalCode = postalCode(c.postalCode);
  if (c.phone.trim()) o.phone = c.phone.trim();
  if (c.email.trim()) o.email = c.email.trim();
  return o;
}

/** The new-client form → POST /api/clients (the Clients tab's fields). */
export function newClientBody(c: NewClientForm): Record<string, string> {
  const o: Record<string, string> = { name: c.name.trim() };
  if (c.address.trim()) o.address = c.address.trim();
  if (c.city.trim()) o.city = c.city.trim();
  if (c.province) o.province = c.province;
  if (c.postalCode.trim()) o.postalCode = postalCode(c.postalCode);
  if (c.phone.trim()) o.phone = c.phone.trim();
  if (c.email.trim()) o.email = c.email.trim();
  return o;
}

/** Whoever the quote is for: a client picked from the list (its saved details), or the one just typed, or nobody yet. */
export function clientDataFor(picked: PickedClient | null, form: NewClientForm | null): Record<string, string> | undefined {
  if (form && canAddNewClient(form)) return newClientData(form);
  if (picked) return { indirizzo: "", ...picked.data, nome: picked.data.nome || picked.name };
  return undefined;
}

// ── The manual quote's body ───────────────────────────────────────────────────

export type ManualBodyInput = {
  title: string; chapters: ManualChapter[]; clientData?: Record<string, string>; iva: IvaRate; terms: TermId; notes: string; templateId?: TemplateId;
};

/** POST /api/quotes/manual: the server recalculates the totals, so the lines carry the same ones the screen showed. */
export function manualBody(i: ManualBodyInput) {
  const title = i.title.trim();
  return {
    capitoli: bodyChapters(i.chapters),
    ...(i.clientData ? { clientData: i.clientData } : null),
    ...(title ? { titoloPreventivoRiga1: title, descrizioneGenerale: title } : null),
    // L'aliquota la sceglie la persona; 0 è senza IVA (esente, reverse charge, forfettario).
    ivaPercentuale: i.iva,
    condizioniPagamento: termLines(i.terms),
    ...(i.notes.trim() ? { note: i.notes.trim() } : null),
    ...(i.templateId ? { templateId: i.templateId } : null),
  };
}

// ── Price list ────────────────────────────────────────────────────────────────

export type CatalogRow = { id: string; nome: string; categoria: string | null; um: string; prezzoUnitario: number };
export type Chosen = { id: string; qty: number };

/** The category chips: each category once, in the list's own order of first appearance, case kept as the first row had it. */
export function categoriesOf(rows: CatalogRow[]): string[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const c = (r.categoria ?? "").trim();
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function filterCatalog(rows: CatalogRow[], term: string, category: string | null): CatalogRow[] {
  const t = term.trim().toLowerCase();
  return rows.filter((r) => (!category || (r.categoria ?? "").trim().toLowerCase() === category.toLowerCase()) && (!t || `${r.nome} ${r.categoria ?? ""}`.toLowerCase().includes(t)));
}

const MEASURED = /\b(mq|m2|m²|mc|m3|m³|ml|m|kg|q)\b/i;
/** Una superficie o una lunghezza parte da 20 e si muove di 5; un corpo o una cosa sola parte da 1 e si muove di 1. */
export function defaultQty(um: string): number {
  return isFixed({ um, quantita: 1 }) || !MEASURED.test(um) ? 1 : 20;
}
export function qtyStep(um: string): number {
  return defaultQty(um) === 1 ? 1 : 5;
}

export const isChosen = (sel: Chosen[], id: string) => sel.some((p) => p.id === id);

export function toggleChosen(sel: Chosen[], row: CatalogRow): Chosen[] {
  return isChosen(sel, row.id) ? sel.filter((p) => p.id !== row.id) : [...sel, { id: row.id, qty: defaultQty(row.um) }];
}

/** One tap of the stepper: up by a step, or down by one but never below a single step. */
export function stepChosen(sel: Chosen[], row: CatalogRow, dir: 1 | -1): Chosen[] {
  const s = qtyStep(row.um);
  return sel.map((p) => (p.id !== row.id ? p : { ...p, qty: dir > 0 ? round2(p.qty + s) : Math.max(s, round2(p.qty - s)) }));
}

export type SelRow = { row: CatalogRow; qty: number; total: number };
/** The selection as rows (an item the list no longer has is dropped) and the total before tax. */
export function selectionOf(sel: Chosen[], rows: CatalogRow[]): { rows: SelRow[]; subtotal: number } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: SelRow[] = [];
  for (const p of sel) {
    const row = byId.get(p.id);
    if (row) out.push({ row, qty: p.qty, total: round2(p.qty * Number(row.prezzoUnitario)) });
  }
  return { rows: out, subtotal: round2(out.reduce((s, r) => s + r.total, 0)) };
}

/** The selected items as the one chapter of a quote. */
export function selectionChapter(sel: SelRow[], title: string, id: string): ManualChapter {
  return { id, title, lines: sel.map((s) => newManualLine(s.row.id, { description: s.row.nome, um: s.row.um, quantita: s.qty, prezzoUnitario: Number(s.row.prezzoUnitario) })) };
}
