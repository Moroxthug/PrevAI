// Le regole della schermata Ore e costo del lavoro (Pay.dc.html, QuoteAI 127.2): lo stato del periodo, cosa va guardato prima di esportare,
// i totali, le righe di un operaio, il costo per cantiere e le modifiche alle regole che la scheda «Regole» salva. Pure, quindi provate (pay.test.ts).
// Le forme del server sono quelle di routes/pay.ts e pay/service.ts. Non è un motore di paghe: niente cedolino, niente ferie, niente festività
// e niente trasferte (PrevAI non li ha); le buste le fa il consulente del lavoro e qui ci sono le ore e il costo.

export const PAY_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];
export type EarningKind = "regular" | "overtime";

export type Effective = { frequency: PayFrequency; anchorDate: string; overtimeWeeklyHours: number | null; overtimeMultiplier: number; payrollCodes: Record<string, string> };
/** Le regole dell'impresa come salvate (il PUT le sostituisce intere: una modifica rimanda tutto). */
export type RawSettings = { frequency?: PayFrequency; anchorDate?: string; overtimeWeeklyHours?: number | null; overtimeMultiplier?: number; payrollCodes?: Record<string, string> };
export type PaySettingsPayload = { enabled: true; settings: RawSettings; effective: Effective; today: string };

export type EarningLine = { kind: EarningKind; hours: number | null; quantity: number | null; rateCents: number; amountCents: number };
export type WorkerPay = { workerId: string; name: string; payrollId: string | null; hours: number; lines: EarningLine[]; grossCents: number; jobs: string[] };
export type JobPay = { projectId: string | null; name: string | null; hours: number; overtimeHours: number; straightCents: number; premiumCents: number; burdenCents: number; allowanceCents: number; totalCents: number };
export type PayReport = {
  period: { start: string; end: string }; today: string; isCurrent: boolean; employees: WorkerPay[];
  subcontractors: { workerId: string; name: string; hours: number; amountCents: number }[]; jobs: JobPay[];
  totals: { hours: number; overtimeHours: number; grossCents: number; burdenCents: number; costCents: number; premiumCents: number };
  pending: { count: number; hours: number }; warnings: { missingPayrollId: string[]; zeroRate: string[] };
  exports: { id: string; format: string; exportedAt: string; exportedByName: string | null }[]; changedSinceExport: string[]; settings: Effective; previousStart: string; nextStart: string;
};

// ── Giorni ──────────────────────────────────────────────────────────────────

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** Un giorno del calendario a mezzogiorno sull'orologio del telefono, per Intl. */
export function dayAt(day: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

// ── Il periodo ──────────────────────────────────────────────────────────────

export type PeriodStatus = { kind: "exported"; at: string } | { kind: "ready" } | { kind: "progress" };
/** Esportato (e quando), pronto da esportare (il periodo è finito) o ancora in corso. */
export function periodStatus(r: Pick<PayReport, "exports" | "isCurrent" | "period" | "today">): PeriodStatus {
  if (r.exports.length > 0) return { kind: "exported", at: r.exports[0]!.exportedAt };
  if (r.isCurrent || r.period.end >= r.today) return { kind: "progress" };
  return { kind: "ready" };
}
/** Si può andare avanti solo fino a un periodo già iniziato. */
export const canGoNext = (r: Pick<PayReport, "nextStart" | "today">): boolean => r.nextStart <= r.today;

export type PayTotals = { wages: number; hours: number; overtime: number; burden: number; cost: number; employees: number };
export function totalsOf(r: PayReport): PayTotals {
  return { wages: r.totals.grossCents, hours: r.totals.hours, overtime: r.totals.overtimeHours, burden: r.totals.burdenCents, cost: r.totals.costCents, employees: r.employees.length };
}
/** Gli oneri come percentuale delle retribuzioni, se ce ne sono. */
export const burdenShare = (t: Pick<PayTotals, "wages" | "burden">): number | null => (t.burden > 0 && t.wages > 0 ? Math.round((t.burden / t.wages) * 100) : null);

// ── Cosa va guardato ────────────────────────────────────────────────────────

export type WarningKey = "approve" | "changed" | "payroll" | "rate";
export type Warning = { key: WarningKey; tone: "warn" | "bad"; count: number; names: string[]; hours?: number };

/** Le righe della scheda sotto il periodo, nell'ordine del disegno; vuota quando non c'è niente da guardare. */
export function warnings(r: PayReport, ctx: { pendingNames: string[] }): Warning[] {
  const out: Warning[] = [];
  if (r.pending.count > 0) out.push({ key: "approve", tone: "warn", count: r.pending.count, names: ctx.pendingNames, hours: r.pending.hours });
  if (r.changedSinceExport.length > 0) out.push({ key: "changed", tone: "warn", count: r.changedSinceExport.length, names: r.changedSinceExport });
  if (r.warnings.missingPayrollId.length > 0) out.push({ key: "payroll", tone: "bad", count: r.warnings.missingPayrollId.length, names: r.warnings.missingPayrollId });
  if (r.warnings.zeroRate.length > 0) out.push({ key: "rate", tone: "bad", count: r.warnings.zeroRate.length, names: r.warnings.zeroRate });
  return out;
}

/** Nomi per una frase: i nomi di battesimo, «Luca, Amara, Dev». */
export function firstNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) { const f = n.trim().split(/\s+/)[0] ?? ""; if (f && !seen.has(f)) { seen.add(f); out.push(f); } }
  return out;
}

// ── Un operaio ──────────────────────────────────────────────────────────────

export type LineQty = { kind: "hours"; value: number; rateCents: number } | { kind: "amount" };
/** Come si legge una riga sotto la sua etichetta: «80,0 h × 12,00 €», o solo l'importo. */
export function lineQty(l: EarningLine): LineQty {
  return l.hours != null && l.hours > 0 ? { kind: "hours", value: l.hours, rateCents: l.rateCents } : { kind: "amount" };
}
/** Il costo orario della riga ordinaria, per la riga «Muratore · 12,00 €/h». */
export const hourlyRate = (w: WorkerPay): number | null => w.lines.find((l) => l.kind === "regular")?.rateCents ?? null;

export type EmployeeFlag = "noPayroll" | "noRate";
export function employeeFlag(w: WorkerPay): EmployeeFlag | null {
  if (!w.payrollId) return "noPayroll";
  return hourlyRate(w) === 0 ? "noRate" : null;
}

// ── Costo per cantiere ──────────────────────────────────────────────────────

export type JobCard = JobPay & { share: number; key: string };
/** I cantieri dal più caro, ognuno con la sua quota del totale per la barra. */
export function jobCards(jobs: JobPay[]): JobCard[] {
  const total = jobs.reduce((n, j) => n + j.totalCents, 0);
  return [...jobs].sort((a, b) => b.totalCents - a.totalCents).map((j) => ({ ...j, key: j.projectId ?? "none", share: total > 0 ? j.totalCents / total : 0 }));
}
export const labourTotal = (jobs: JobPay[]): number => jobs.reduce((n, j) => n + j.totalCents, 0);
/** Gli oneri come percentuale delle retribuzioni, se i cantieri ne hanno. */
export function burdenPercent(jobs: JobPay[]): number | null {
  const burden = jobs.reduce((n, j) => n + j.burdenCents, 0);
  const wages = jobs.reduce((n, j) => n + j.straightCents + j.premiumCents, 0);
  return burden > 0 && wages > 0 ? Math.round((burden / wages) * 100) : null;
}

// ── Regole ──────────────────────────────────────────────────────────────────

/** Le frequenze del controllo a segmenti. */
export const frequencyOptions = (): PayFrequency[] => ["monthly", "biweekly", "weekly"];

/** Un numero di ore a settimana scritto in un campo (1–80), o null. */
export function hoursFrom(text: string): number | null {
  const n = Number(text.replace(",", ".").replace(/[^0-9.]/g, ""));
  return text.trim() !== "" && Number.isFinite(n) && n >= 1 && n <= 80 ? Math.round(n * 100) / 100 : null;
}
/** Una maggiorazione scritta in un campo in percento (0–200), come coefficiente (25 → 1,25), o null. */
export function multiplierFrom(text: string): number | null {
  const n = Number(text.replace(",", ".").replace(/[^0-9.]/g, ""));
  return text.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 200 ? Math.round((1 + n / 100) * 1000) / 1000 : null;
}
/** Il coefficiente come percentuale di maggiorazione (1,25 → 25). */
export const premiumPercent = (multiplier: number): number => Math.round((multiplier - 1) * 1000) / 10;

export const withFrequency = (raw: RawSettings, frequency: PayFrequency): RawSettings => ({ ...raw, frequency });
export const withOvertimeFrom = (raw: RawSettings, hours: number | null): RawSettings => ({ ...raw, overtimeWeeklyHours: hours });
export const withMultiplier = (raw: RawSettings, multiplier: number): RawSettings => ({ ...raw, overtimeMultiplier: multiplier });
/** I codici dipendente: restano solo quelli scritti. */
export function withCodes(raw: RawSettings, codes: Record<string, string>): RawSettings {
  return { ...raw, payrollCodes: Object.fromEntries(Object.entries(codes).map(([k, v]) => [k, v.trim()] as const).filter(([, v]) => v)) };
}
