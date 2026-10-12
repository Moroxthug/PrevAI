// Compliance.dc.html (QuoteAI 127.4): il calendario delle scadenze fatto con le scadenze fiscali dello scadenzario (F24 dell'imposta e dei
// contributi, bollo, dichiarazione) e i promemoria dell'impresa (DURC, assicurazione, formazione…), ordinati in In ritardo / Prossimi 90 giorni /
// Più avanti / Versate, la striscia dei 90 giorni, i numeri in alto e le righe «Come versi». Pure, quindi provate (compliance.test.ts).
// Le forme del server sono quelle di fiscale/calendario.ts (`GET /api/fiscale/calendario`).

export type DeadlineKind = "imposta" | "contributi" | "bollo" | "dichiarazione";
export type DeadlineDto = {
  key: string; anno: number; chiave: string; kind: DeadlineKind; label: string; description: string; amountCents: number; authority: string;
  dueDate: string; filedAt: string | null; daysLeft: number; state: "filed" | "overdue" | "due_soon" | "upcoming"; hasF24: boolean;
  lines: { label: string; cents: number }[]; versatoCents: number; notReviewed: boolean;
};
export type ReminderKind = "insurance" | "licence" | "safety" | "other";
export type Recurrence = "none" | "monthly" | "quarterly" | "annual";
export type ReminderDto = {
  id: string; kind: ReminderKind; preset: string | null; title: string; authority: string; dueDate: string; recurrence: Recurrence; remindDaysBefore: number;
  notes: string; lastDoneAt: string | null; daysLeft: number; state: "overdue" | "due_soon" | "upcoming";
};
export type PresetDto = { id: string; kind: ReminderKind; title: string; authority: string; recurrence: Recurrence };
export type ComplianceOverview = {
  enabled: true; today: string; deadlines: DeadlineDto[]; filed: DeadlineDto[]; filedThisYear: { count: number; onTime: number };
  reminders: ReminderDto[]; presets: PresetDto[]; profile: { regime: string; gestione: string; riduzione: string; completo: boolean };
};

// ── Giorni ──────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const utc = (day: string): number => Date.parse(`${day}T00:00:00Z`);
export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / DAY_MS);
export const addDays = (day: string, n: number): string => new Date(utc(day) + n * DAY_MS).toISOString().slice(0, 10);
/** Un giorno del calendario come data a mezzogiorno sull'orologio del telefono (così la data breve stampa il giorno giusto). */
export function dayDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

// ── Voci ────────────────────────────────────────────────────────────────────

export type Look = "overdue" | "due" | "later" | "filed";
export type ItemIcon = { icon: "percent" | "receipt" | "users" | "shield" | "doc" | "cal"; tone: "violet" | "amber" | "indigo" | "teal" | "azure" | "sky" };
export type Item = {
  id: string;
  source: "deadline" | "reminder";
  kind: DeadlineKind | ReminderKind;
  /** Per una scadenza è l'etichetta dello scadenzario, per un promemoria il suo titolo. */
  title: string;
  /** Un testo breve sotto il titolo (cos'è, o di chi). */
  detail: string;
  due: string;
  daysLeft: number;
  look: Look;
  /** Versata o fatta in questo giorno (solo le scadenze). */
  filedOn: string | null;
  filedToday: boolean;
  amountCents: number;
  /** Per aprire l'F24 e segnare il versamento. */
  anno: number | null;
  chiave: string | null;
  hasF24: boolean;
  lines: { label: string; cents: number }[];
  versatoCents: number;
  authority: string;
  recurrence: Recurrence | null;
  icon: ItemIcon;
};

/** Quanto avanti guarda «Prossimi 90 giorni». */
export const HORIZON = 90;
/** Le aperte più lontane di così restano fuori dall'elenco (il server ne calcola per più di un anno e una data senza anno sembrerebbe di quest'anno). */
export const LATER_MAX = 300;

export function lookOf(daysLeft: number, filed: boolean): Look {
  if (filed) return "filed";
  if (daysLeft < 0) return "overdue";
  return daysLeft <= HORIZON ? "due" : "later";
}

const DEADLINE_ICON: Record<DeadlineKind, ItemIcon> = {
  imposta: { icon: "percent", tone: "violet" }, contributi: { icon: "users", tone: "indigo" }, bollo: { icon: "receipt", tone: "amber" }, dichiarazione: { icon: "doc", tone: "azure" },
};
const REMINDER_ICON: Record<ReminderKind, ItemIcon> = {
  insurance: { icon: "shield", tone: "azure" }, licence: { icon: "doc", tone: "amber" }, safety: { icon: "shield", tone: "teal" }, other: { icon: "cal", tone: "sky" },
};

export function deadlineItem(d: DeadlineDto, today: string): Item {
  const filed = d.state === "filed" || !!d.filedAt;
  const filedOn = d.filedAt ? d.filedAt.slice(0, 10) : null;
  const daysLeft = daysBetween(today, d.dueDate);
  return {
    id: d.key, source: "deadline", kind: d.kind, title: d.label, detail: d.description, due: d.dueDate, daysLeft, look: lookOf(daysLeft, filed), filedOn, filedToday: filed && filedOn === today,
    amountCents: d.amountCents, anno: d.anno, chiave: d.chiave, hasF24: d.hasF24, lines: d.lines, versatoCents: d.versatoCents, authority: d.authority, recurrence: null, icon: DEADLINE_ICON[d.kind],
  };
}

export function reminderItem(r: ReminderDto, today: string): Item {
  const daysLeft = daysBetween(today, r.dueDate);
  return {
    id: `reminder:${r.id}`, source: "reminder", kind: r.kind, title: r.title, detail: r.notes, due: r.dueDate, daysLeft, look: lookOf(daysLeft, false), filedOn: null, filedToday: false,
    amountCents: 0, anno: null, chiave: null, hasF24: false, lines: [], versatoCents: 0, authority: r.authority, recurrence: r.recurrence, icon: REMINDER_ICON[r.kind],
  };
}

/** Tutte le scadenze e i promemoria in un elenco: le aperte per data, poi le versate, dalla più recente. */
export function buildItems(ov: ComplianceOverview): Item[] {
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const d of [...ov.deadlines, ...ov.filed]) {
    if (seen.has(d.key)) continue;
    seen.add(d.key);
    items.push(deadlineItem(d, ov.today));
  }
  for (const r of ov.reminders) items.push(reminderItem(r, ov.today));
  const open = items.filter((i) => i.look !== "filed" && i.daysLeft <= LATER_MAX).sort((a, b) => (a.due === b.due ? a.id.localeCompare(b.id) : a.due < b.due ? -1 : 1));
  const done = items.filter((i) => i.look === "filed").sort((a, b) => ((b.filedOn ?? b.due) < (a.filedOn ?? a.due) ? -1 : (b.filedOn ?? b.due) > (a.filedOn ?? a.due) ? 1 : 0));
  return [...open, ...done];
}

export const isOpen = (i: Item): boolean => i.look !== "filed";

/** Il verbo del pulsante: un F24 si versa, la dichiarazione si presenta, un'assicurazione o un DURC si rinnovano, il resto si fa. */
export type DoneVerb = "markFiled" | "markPaid" | "markRenewed" | "markDone";
export function doneVerb(i: Pick<Item, "source" | "kind">): DoneVerb {
  if (i.source === "deadline") return i.kind === "dichiarazione" ? "markFiled" : "markPaid";
  return i.kind === "licence" || i.kind === "insurance" ? "markRenewed" : "markDone";
}

/** Cosa dice la parola dello stato di una voce, come la word() del disegno: «3 giorni di ritardo», «Scade il 30 giu», «Versata», «Versata oggi». */
export type Word =
  | { kind: "late"; days: number } | { kind: "due"; verb: "due" | "renews" } | { kind: "filed" } | { kind: "paid" }
  | { kind: "filedToday" } | { kind: "paidToday" } | { kind: "renewedToday" };
export function wordOf(i: Item): Word {
  if (i.look === "overdue") return { kind: "late", days: -i.daysLeft };
  if (i.look === "filed") {
    const paid = i.source === "deadline" && doneVerb(i) === "markPaid";
    if (i.filedToday) return paid ? { kind: "paidToday" } : { kind: "filedToday" };
    return paid ? { kind: "paid" } : { kind: "filed" };
  }
  return { kind: "due", verb: i.source === "reminder" && i.kind === "insurance" ? "renews" : "due" };
}

export type StatusLook = { tone: "bad" | "warn" | "mute" | "ok"; shape: "alert" | "clock" | "check" };
export const statusOf = (look: Look): StatusLook => (look === "overdue" ? { tone: "bad", shape: "alert" } : look === "due" ? { tone: "warn", shape: "clock" } : look === "later" ? { tone: "mute", shape: "clock" } : { tone: "ok", shape: "check" });

// ── I numeri, i gruppi, i filtri ────────────────────────────────────────────

export type Kpis = { late: number; next30: number; filedYear: number; onTimeYear: number; lateFirst: Item | null; nextTwo: Item[] };
export function kpis(items: Item[], filedThisYear: { count: number; onTime: number }): Kpis {
  const open = items.filter(isOpen);
  const late = open.filter((i) => i.look === "overdue");
  const next = open.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 30);
  return { late: late.length, next30: next.length, filedYear: filedThisYear.count, onTimeYear: filedThisYear.onTime, lateFirst: late[0] ?? null, nextTwo: next.slice(0, 2) };
}

export type FilterKey = "all" | "due" | "overdue" | "filed";
export const FILTERS: FilterKey[] = ["all", "due", "overdue", "filed"];
export type GroupKey = "late" | "next" | "later" | "filed";
export type Group = { key: GroupKey; items: Item[] };

const FILED_SHOWN = 6;

/** L'elenco sotto le schede: In ritardo, Prossimi 90 giorni, Più avanti, Versate (le più recenti), ristretto dalla scheda scelta; i gruppi vuoti spariscono. */
export function groups(items: Item[], filter: FilterKey): Group[] {
  const by = (look: Look) => items.filter((i) => i.look === look);
  const all: Group[] = [
    ...(filter === "all" || filter === "overdue" ? [{ key: "late" as const, items: by("overdue") }] : []),
    ...(filter === "all" || filter === "due" ? [{ key: "next" as const, items: by("due") }, { key: "later" as const, items: by("later") }] : []),
    ...(filter === "all" || filter === "filed" ? [{ key: "filed" as const, items: by("filed").slice(0, FILED_SHOWN) }] : []),
  ];
  return all.filter((g) => g.items.length > 0);
}

export function filterCounts(items: Item[]): Record<FilterKey, number> {
  const n = (look: Look) => items.filter((i) => i.look === look).length;
  return { all: Math.min(items.length, items.filter(isOpen).length + Math.min(n("filed"), FILED_SHOWN)), due: n("due") + n("later"), overdue: n("overdue"), filed: Math.min(n("filed"), FILED_SHOWN) };
}

/** La voce scelta per prima: la prima in ritardo, altrimenti la prima in arrivo, altrimenti la prima. */
export function defaultSelection(items: Item[]): string | null {
  return (items.find((i) => i.look === "overdue") ?? items.find((i) => i.look === "due") ?? items[0])?.id ?? null;
}

// ── La striscia dei 90 giorni ───────────────────────────────────────────────

export type Mark = { id: string; pct: number; lane: "up" | "dn"; look: Look; due: string };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** Le aperte entro l'orizzonte (quelle in ritardo stanno al bordo sinistro), alternate sopra e sotto la linea. */
export function marks(items: Item[]): Mark[] {
  return items.filter((i) => isOpen(i) && i.daysLeft <= HORIZON).map((i, n) => ({ id: i.id, pct: Math.round(clamp((i.daysLeft / HORIZON) * 100, 3.5, 96) * 10) / 10, lane: n % 2 ? "dn" : "up", look: i.look, due: i.due }));
}
/** Il primo di ogni mese dentro l'orizzonte, come posto sulla striscia. */
export function monthTicks(today: string): { month: string; pct: number }[] {
  const out: { month: string; pct: number }[] = [];
  let [y, m] = today.split("-").map(Number) as [number, number];
  for (let guard = 0; guard < 5; guard++) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const d = daysBetween(today, first);
    if (d > HORIZON) break;
    out.push({ month: first.slice(0, 7), pct: Math.round((d / HORIZON) * 1000) / 10 });
  }
  return out;
}

// ── Il versamento in primo piano ────────────────────────────────────────────

/** Il versamento della scheda grande: il prossimo F24 non ancora versato, altrimenti l'ultimo versato. */
export function featuredReturn(items: Item[]): Item | null {
  const pays = items.filter((i) => i.source === "deadline" && i.amountCents > 0 && i.kind !== "dichiarazione");
  return pays.find(isOpen) ?? pays[0] ?? null;
}

/** Il percorso dell'F24 di una voce, o null (la dichiarazione e i promemoria non ce l'hanno). */
export function f24Path(i: Item): string | null {
  return i.source === "deadline" && i.hasF24 && i.chiave && i.anno ? `/api/fiscale/scadenzario/${encodeURIComponent(i.chiave)}/f24.pdf?anno=${i.anno}` : null;
}

// ── Come versi ──────────────────────────────────────────────────────────────

/** Ruoli che possono segnare un versamento: il titolare (l'area fiscale è chiusa agli altri, tranne il contabile che legge). */
export const canEditFiscale = (role: string | null | undefined): boolean => role === "owner";
export const canSeeFiscale = (role: string | null | undefined): boolean => role === "owner" || role === "admin" || role === "bookkeeper";

/** L'impresa non ha ancora niente in calendario: né scadenze né promemoria. */
export function isEmptyCalendar(ov: ComplianceOverview): boolean {
  return ov.deadlines.length === 0 && ov.filed.length === 0 && ov.reminders.length === 0;
}

/** Una data scelta come `AAAA-MM-GG` sull'orologio del telefono. */
export const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
