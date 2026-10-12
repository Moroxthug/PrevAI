import { and, desc, eq, gte, lt } from "drizzle-orm";
import { collaboratorsTable, db, payExportsTable, paySettingsTable, projectsTable, timeEntriesTable, type PaySettingsRaw } from "@workspace/db";
import { oggiItalia } from "../primanota/mese.js";

// ── POCKET-4 (riga 61, QuoteAI 127.2 Pay): «Ore e costo del lavoro» ──────────
// Non è un cedolino né un motore di paghe: le buste le fa il consulente del lavoro. Qui ci sono le ore approvate del
// periodo, il costo (ore × costo orario, con la maggiorazione dello straordinario se l'impresa l'ha impostata, più gli
// oneri a carico dell'impresa) e il file di ore da mandare al consulente. Lo straordinario parte dopo N ore nella
// settimana di calendario (lunedì–domenica), contando per ultime le ore dell'ultimo giorno; se la settimana è a cavallo di
// due periodi, conta le ore del periodo. Le regole contrattuali (CCNL) le decide l'impresa: qui non c'è niente di precompilato.

type PayFrequency = "weekly" | "biweekly" | "monthly";
export type Effective = {
  frequency: PayFrequency;
  anchorDate: string;
  overtimeWeeklyHours: number | null;
  overtimeMultiplier: number;
  payrollCodes: Record<string, string>;
};

const DEFAULT_ANCHOR = "2026-01-05"; // un lunedì
export function effective(raw: PaySettingsRaw): Effective {
  return {
    frequency: raw.frequency ?? "monthly",
    anchorDate: raw.anchorDate ?? DEFAULT_ANCHOR,
    overtimeWeeklyHours: raw.overtimeWeeklyHours ?? null,
    overtimeMultiplier: raw.overtimeMultiplier && raw.overtimeMultiplier >= 1 ? raw.overtimeMultiplier : 1.25,
    payrollCodes: raw.payrollCodes ?? {},
  };
}

export async function loadSettings(userId: string): Promise<PaySettingsRaw> {
  const [row] = await db.select().from(paySettingsTable).where(eq(paySettingsTable.userId, userId));
  return row?.settings ?? {};
}

export async function saveSettings(userId: string, raw: PaySettingsRaw): Promise<void> {
  await db.insert(paySettingsTable).values({ userId, settings: raw }).onConflictDoUpdate({ target: paySettingsTable.userId, set: { settings: raw, updatedAt: new Date() } });
}

// ── Giorni ──────────────────────────────────────────────────────────────────

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const dayIndex = (day: string): number => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};
/** Il lunedì della settimana di `day`. */
export function weekStart(day: string): string {
  const dow = (dayIndex(day) + 3) % 7; // 1970-01-01 era un giovedì → lunedì = 0
  return addDays(day, -dow);
}

/** Il periodo (primo e ultimo giorno) che contiene `day`. */
export function periodOf(day: string, e: Pick<Effective, "frequency" | "anchorDate">): { start: string; end: string } {
  if (e.frequency === "weekly") {
    const start = weekStart(day);
    return { start, end: addDays(start, 6) };
  }
  if (e.frequency === "biweekly") {
    const offset = Math.floor((dayIndex(day) - dayIndex(weekStart(e.anchorDate))) / 14);
    const start = addDays(weekStart(e.anchorDate), offset * 14);
    return { start, end: addDays(start, 13) };
  }
  const [y, m] = day.split("-").map(Number) as [number, number];
  return { start: `${day.slice(0, 7)}-01`, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

// ── Il rapporto del periodo ─────────────────────────────────────────────────

type Entry = { id: string; workerId: string; projectId: string; date: string; hours: number; rate: number; burden: number };
type Split = Entry & { regular: number; overtime: number };

/** Divide ogni registrazione in ore ordinarie e straordinarie: oltre la soglia della settimana sono straordinario. */
export function splitOvertime(entries: readonly Entry[], weeklyHours: number | null): Split[] {
  const used = new Map<string, number>();
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((e) => {
      if (weeklyHours == null) return { ...e, regular: e.hours, overtime: 0 };
      const key = `${e.workerId}|${weekStart(e.date)}`;
      const before = used.get(key) ?? 0;
      used.set(key, before + e.hours);
      const room = Math.max(0, weeklyHours - before);
      const regular = Math.min(e.hours, room);
      return { ...e, regular: round2(regular), overtime: round2(e.hours - regular) };
    });
}
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function periodReport(userId: string, date: string | undefined) {
  const raw = await loadSettings(userId);
  const eff = effective(raw);
  const today = oggiItalia();
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const period = periodOf(day, eff);
  const from = new Date(`${period.start}T00:00:00.000Z`);
  const to = new Date(`${addDays(period.end, 1)}T00:00:00.000Z`);

  const rows = await db
    .select({
      id: timeEntriesTable.id, workerId: timeEntriesTable.workerId, projectId: timeEntriesTable.projectId, date: timeEntriesTable.date, hours: timeEntriesTable.hours,
      rate: timeEntriesTable.rateCentsSnapshot, burden: timeEntriesTable.burdenPercentSnapshot, status: timeEntriesTable.status,
      workerName: collaboratorsTable.name, workerType: collaboratorsTable.workerType, projectName: projectsTable.name,
    })
    .from(timeEntriesTable)
    .innerJoin(collaboratorsTable, eq(collaboratorsTable.id, timeEntriesTable.workerId))
    .leftJoin(projectsTable, eq(projectsTable.id, timeEntriesTable.projectId))
    .where(and(eq(timeEntriesTable.userId, userId), gte(timeEntriesTable.date, from), lt(timeEntriesTable.date, to)));

  const approved = rows.filter((r) => r.status === "approved");
  const pendingRows = rows.filter((r) => r.status === "submitted");
  const toEntry = (r: (typeof rows)[number]): Entry => ({ id: r.id, workerId: r.workerId, projectId: r.projectId, date: r.date.toISOString().slice(0, 10), hours: Number(r.hours), rate: r.rate, burden: Number(r.burden) });
  const names = new Map(rows.map((r) => [r.workerId, r.workerName]));
  const projectNames = new Map(rows.map((r) => [r.projectId, r.projectName]));

  const split = splitOvertime(approved.filter((r) => r.workerType === "employee").map(toEntry), eff.overtimeWeeklyHours);
  const m1 = eff.overtimeMultiplier;

  // Dipendenti
  const perWorker = new Map<string, Split[]>();
  for (const s of split) perWorker.set(s.workerId, [...(perWorker.get(s.workerId) ?? []), s]);
  const employees = [...perWorker.entries()]
    .map(([workerId, list]) => {
      const regH = round2(list.reduce((n, s) => n + s.regular, 0));
      const otH = round2(list.reduce((n, s) => n + s.overtime, 0));
      const regAmount = Math.round(list.reduce((n, s) => n + s.regular * s.rate, 0));
      const otAmount = Math.round(list.reduce((n, s) => n + s.overtime * s.rate * m1, 0));
      const lines = [
        ...(regH > 0 || otH === 0 ? [{ kind: "regular" as const, hours: regH, quantity: null, rateCents: regH > 0 ? Math.round(regAmount / regH) : 0, amountCents: regAmount }] : []),
        ...(otH > 0 ? [{ kind: "overtime" as const, hours: otH, quantity: null, rateCents: Math.round(otAmount / otH), amountCents: otAmount }] : []),
      ];
      return { workerId, name: names.get(workerId) ?? "", payrollId: eff.payrollCodes[workerId]?.trim() || null, hours: round2(regH + otH), lines, grossCents: regAmount + otAmount, allowances: [], jobs: [...new Set(list.map((s) => projectNames.get(s.projectId) ?? ""))].filter(Boolean) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "it"));

  // Collaboratori esterni: fatturano, non sono in busta
  const subs = new Map<string, { workerId: string; name: string; hours: number; amountCents: number }>();
  for (const r of approved.filter((x) => x.workerType !== "employee")) {
    const cur = subs.get(r.workerId) ?? { workerId: r.workerId, name: r.workerName, hours: 0, amountCents: 0 };
    cur.hours = round2(cur.hours + Number(r.hours));
    cur.amountCents += Math.round(Number(r.hours) * r.rate);
    subs.set(r.workerId, cur);
  }

  // Per cantiere (anche i collaboratori esterni sono costo del cantiere, senza oneri)
  const jobMap = new Map<string, { projectId: string; name: string | null; hours: number; overtimeHours: number; straightCents: number; premiumCents: number; burdenCents: number; allowanceCents: number; totalCents: number }>();
  const addJob = (projectId: string, hours: number, ot: number, rate: number, burdenPct: number) => {
    const j = jobMap.get(projectId) ?? { projectId, name: projectNames.get(projectId) ?? null, hours: 0, overtimeHours: 0, straightCents: 0, premiumCents: 0, burdenCents: 0, allowanceCents: 0, totalCents: 0 };
    const straight = Math.round(hours * rate);
    const premium = Math.round(ot * rate * (m1 - 1));
    const burden = Math.round((straight + premium) * (burdenPct / 100));
    j.hours = round2(j.hours + hours);
    j.overtimeHours = round2(j.overtimeHours + ot);
    j.straightCents += straight;
    j.premiumCents += premium;
    j.burdenCents += burden;
    j.totalCents += straight + premium + burden;
    jobMap.set(projectId, j);
  };
  for (const s of split) addJob(s.projectId, s.hours, s.overtime, s.rate, s.burden);
  for (const r of approved.filter((x) => x.workerType !== "employee")) addJob(r.projectId, Number(r.hours), 0, r.rate, 0);
  const jobs = [...jobMap.values()];

  const totalHours = round2(employees.reduce((n, e) => n + e.hours, 0));
  const overtimeHours = round2(split.reduce((n, s) => n + s.overtime, 0));
  const wages = employees.reduce((n, e) => n + e.grossCents, 0);
  const burdenCents = jobs.reduce((n, j) => n + j.burdenCents, 0);

  const exports = await db.select().from(payExportsTable).where(and(eq(payExportsTable.userId, userId), eq(payExportsTable.periodStart, period.start))).orderBy(desc(payExportsTable.exportedAt));
  const last = exports[0];
  const changedSinceExport = last
    ? employees.filter((e) => Math.abs((last.snapshot[e.workerId] ?? 0) - e.hours) > 0.004).map((e) => e.name)
    : [];

  const warningsRate = employees.filter((e) => e.lines.every((l) => l.rateCents === 0)).map((e) => e.name);
  const warningsPayroll = employees.filter((e) => !e.payrollId).map((e) => e.name);
  const next = addDays(period.end, 1);
  const prev = periodOf(addDays(period.start, -1), eff).start;

  return {
    period,
    today,
    isCurrent: period.start <= today && today <= period.end,
    holidays: [] as never[],
    employees,
    subcontractors: [...subs.values()],
    jobs,
    totals: { hours: totalHours, overtimeHours, grossCents: wages, burdenCents, costCents: wages + burdenCents, holidayCents: 0, allowanceCents: 0, premiumCents: jobs.reduce((n, j) => n + j.premiumCents, 0) },
    pending: { count: pendingRows.length, hours: round2(pendingRows.reduce((n, r) => n + Number(r.hours), 0)) },
    pendingAllowances: [] as never[],
    warnings: { missingPayrollId: warningsPayroll, zeroRate: warningsRate },
    exports: exports.map((x) => ({ id: x.id, format: x.format, exportedAt: x.exportedAt.toISOString(), exportedByName: x.exportedByName })),
    changedSinceExport,
    settings: eff,
    previousStart: prev,
    nextStart: next,
  };
}

/** Il file di ore per il consulente del lavoro: `;` e virgola decimale, con il BOM come lo vuole Excel in italiano. */
export function payCsv(report: Awaited<ReturnType<typeof periodReport>>): string {
  const cella = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const head = ["Codice dipendente", "Nome", "Periodo dal", "Periodo al", "Ore ordinarie", "Ore straordinarie", "Costo orario", "Importo ordinario", "Importo straordinario", "Totale"].join(";");
  const [y1, m1, d1] = report.period.start.split("-");
  const [y2, m2, d2] = report.period.end.split("-");
  const righe = report.employees.map((e) => {
    const reg = e.lines.find((l) => l.kind === "regular");
    const ot = e.lines.find((l) => l.kind === "overtime");
    return [e.payrollId ?? "", e.name, `${d1}/${m1}/${y1}`, `${d2}/${m2}/${y2}`, num(reg?.hours ?? 0), num(ot?.hours ?? 0), euro(reg?.rateCents ?? 0), euro(reg?.amountCents ?? 0), euro(ot?.amountCents ?? 0), euro(e.grossCents)].map((x) => cella(String(x))).join(";");
  });
  return String.fromCharCode(0xfeff) + [head, ...righe].join("\r\n") + "\r\n";
}

export async function recordExport(params: { userId: string; periodStart: string; report: Awaited<ReturnType<typeof periodReport>>; actorName: string }) {
  await db.insert(payExportsTable).values({
    userId: params.userId,
    periodStart: params.periodStart,
    format: "generic",
    exportedByName: params.actorName.slice(0, 120) || null,
    snapshot: Object.fromEntries(params.report.employees.map((e) => [e.workerId, e.hours])),
  });
}
