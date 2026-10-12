// AccountantView.dc.html (QuoteAI 127.3): ciò che vede il contabile dell'impresa (sola lettura): un mese di conti e a che punto è ogni parte, i file che può
// scaricare, le prossime scadenze e il filo dei commenti. Pure, quindi le regole sono provate (accountant.test.ts).
// Le forme del server sono quelle di routes/accountant.ts. In PrevAI il contabile è un membro col ruolo «Contabile» (`bookkeeper`).
import type { OrgDto } from "./api";

export type AccountantOverview = {
  enabled: true; today: string;
  company: { name: string; ownerName: string };
  you: { name: string; role: string };
  fiscalYearEnd: string | null; province: string | null;
  month: string;
  months: { month: string; closed: { at: string; by: string | null } | null }[];
  bank: { total: number; matched: number } | null;
  receipts: { total: number; attached: number };
  invoices: { total: number; issued: number; issuedCents: number };
  payroll: { periods: { start: string; end: string; exported: boolean }[] } | null;
};

export type CommentDto = { id: string; month: string; authorName: string; authorRole: string; body: string; at: string; mine: boolean };

// ── Le parti del mese ───────────────────────────────────────────────────────

export type CheckKey = "bank" | "receipts" | "invoices" | "payroll";
export type Check = { key: CheckKey; done: number; total: number; pct: number; complete: boolean; cents?: number; periods?: { start: string; end: string }[]; drafts?: number };

const pct = (a: number, b: number): number => (b <= 0 ? 100 : Math.round((a / b) * 100));

/** Le parti che valgono per questa impresa questo mese, senza elencare quelle vuote (nessun movimento, nessun acquisto, nessuna fattura). */
export function checks(ov: AccountantOverview): Check[] {
  const out: Check[] = [];
  if (ov.bank && ov.bank.total > 0) out.push({ key: "bank", done: ov.bank.matched, total: ov.bank.total, pct: pct(ov.bank.matched, ov.bank.total), complete: ov.bank.matched >= ov.bank.total });
  if (ov.receipts.total > 0) out.push({ key: "receipts", done: ov.receipts.attached, total: ov.receipts.total, pct: pct(ov.receipts.attached, ov.receipts.total), complete: ov.receipts.attached >= ov.receipts.total });
  if (ov.invoices.total > 0) {
    const i = ov.invoices;
    out.push({ key: "invoices", done: i.issued, total: i.total, pct: pct(i.issued, i.total), complete: i.issued >= i.total, cents: i.issuedCents, drafts: i.total - i.issued });
  }
  if (ov.payroll && ov.payroll.periods.length > 0) {
    const p = ov.payroll.periods;
    const done = p.filter((x) => x.exported).length;
    out.push({ key: "payroll", done, total: p.length, pct: pct(done, p.length), complete: done >= p.length, periods: p.map((x) => ({ start: x.start, end: x.end })) });
  }
  return out;
}

export type MonthState = "closed" | "inProgress";
export const monthState = (m: { closed: unknown } | undefined): MonthState => (m?.closed ? "closed" : "inProgress");

export const monthDate = (month: string): Date => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1, 12);
};

// ── I file ──────────────────────────────────────────────────────────────────

export type ExportKey = "transactions" | "invoices";
export type ExportDef = { key: ExportKey; path: string; fallback: string };

/** I file di un mese: i movimenti (banca, costi, incassi) e le fatture emesse. */
export function exportsFor(month: string): ExportDef[] {
  const m = encodeURIComponent(month);
  return [
    { key: "transactions", path: `/api/accountant/export.csv?kind=transactions&month=${m}`, fallback: `movimenti-${month}.csv` },
    { key: "invoices", path: `/api/accountant/export.csv?kind=invoices&month=${m}`, fallback: `fatture-${month}.csv` },
  ];
}

// ── L'accesso ───────────────────────────────────────────────────────────────

/** L'impresa che il telefono ha aperto per ultima non è più nell'elenco: il titolare ha tolto l'accesso. */
export function accessEnded(current: Pick<OrgDto, "orgId">[], storedOrgId: string | null, known: { orgId: string; companyName: string; role: string }[]): { ended: boolean; company: string } {
  if (!storedOrgId || current.some((o) => o.orgId === storedOrgId)) return { ended: false, company: "" };
  const was = known.find((k) => k.orgId === storedOrgId);
  return was && was.role === "bookkeeper" ? { ended: true, company: was.companyName } : { ended: false, company: "" };
}

/** Le iniziali dell'impresa per il quadrato accanto al nome («Rossi Edilizia» → «RE»). */
export function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

// ── I commenti ──────────────────────────────────────────────────────────────

export const COMMENT_MAX = 2000;
export const canSend = (draft: string): boolean => draft.trim().length > 0 && draft.trim().length <= COMMENT_MAX;
