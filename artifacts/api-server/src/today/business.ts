// POCKET-2 (QuoteAI Phase 146) — la scheda «Andamento» della Home dell'app: Settimana / Mese / Trimestre;
// «Incassato nel periodo» col confronto con il periodo prima e la linea delle ultime 8 settimane / 6 mesi /
// 4 trimestri; poi preventivi vinti, da incassare (e quanto è scaduto) e margine dopo i costi. I periodi
// seguono il calendario di Roma (le settimane cominciano di lunedì).

import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { costEntriesTable, db, invoicePaymentsTable, invoicesTable, OPEN_INVOICE_STATUSES, quotesTable, type TeamMemberRole } from "@workspace/db";
import { MARKET } from "@workspace/config";
import { roleCan } from "../middlewares/requirePermission.js";

export type BusinessPeriod = "W" | "M" | "Q";
export type BusinessCard = {
  period: BusinessPeriod;
  /** Dal più vecchio; l'ultimo è il periodo in corso. `start`: il suo primo giorno locale (AAAA-MM-GG). */
  buckets: { start: string; collectedCents: number }[] | null;
  /** Dei preventivi inviati nel periodo, quanti sono stati accettati (null: nessuno inviato, o il ruolo non vede i preventivi). */
  winPercent: number | null;
  outstanding: { balanceCents: number; overdueCents: number } | null;
  /** (Fatturato al netto dell'IVA − costi confermati) ÷ fatturato, nel periodo. */
  marginPercent: number | null;
};

const COUNT: Record<BusinessPeriod, number> = { W: 8, M: 6, Q: 4 };

/** Lo scarto del fuso dall'UTC in un istante, in ms. */
function offsetAt(instant: number, zone: string): number {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - instant;
}

/** La mezzanotte locale di un giorno (AAAA-MM-GG) in un fuso, come istante. */
export function localMidnight(day: string, zone: string): Date {
  const guess = Date.parse(`${day}T00:00:00Z`);
  const first = guess - offsetAt(guess, zone);
  return new Date(guess - offsetAt(first, zone));
}

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/** Il primo giorno locale del periodo in corso e di ciascuno dei `n − 1` prima, dal più vecchio, più il giorno in cui finisce quello in corso. */
export function periodStarts(period: BusinessPeriod, today: string, n = COUNT[period]): { starts: string[]; end: string } {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  if (period === "W") {
    const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
    const monday = Date.UTC(y, m - 1, d - dow);
    const starts = Array.from({ length: n }, (_, i) => new Date(monday - (n - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10));
    return { starts, end: new Date(monday + 7 * 86_400_000).toISOString().slice(0, 10) };
  }
  const len = period === "M" ? 1 : 3;
  const first = period === "M" ? m - 1 : Math.floor((m - 1) / 3) * 3;
  const starts = Array.from({ length: n }, (_, i) => iso(y, first - (n - 1 - i) * len, 1));
  return { starts, end: iso(y, first + len, 1) };
}

export async function businessCard(userId: string, role: TeamMemberRole, period: BusinessPeriod, now = new Date()): Promise<BusinessCard> {
  const zone = MARKET.timeZone;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const { starts, end } = periodStarts(period, today);
  const edges = [...starts, end].map((day) => localMidnight(day, zone));
  const from = edges[0]!, curFrom = edges[edges.length - 2]!, to = edges[edges.length - 1]!;
  const out: BusinessCard = { period, buckets: null, winPercent: null, outstanding: null, marginPercent: null };

  if (roleCan(role, "invoicing", "view")) {
    // Soldi entrati, non note di credito applicate a un documento.
    const cases = edges.slice(0, -1).map((a, i) => sql`coalesce(sum(${invoicePaymentsTable.amountCents}) filter (where ${invoicePaymentsTable.date} >= ${a.toISOString()} and ${invoicePaymentsTable.date} < ${edges[i + 1]!.toISOString()}), 0)`);
    const [row] = await db
      .select({ v: sql<string[]>`array[${sql.join(cases, sql`, `)}]` })
      .from(invoicePaymentsTable)
      .where(and(eq(invoicePaymentsTable.userId, userId), isNull(invoicePaymentsTable.creditNoteId), gte(invoicePaymentsTable.date, from), lt(invoicePaymentsTable.date, to)));
    const vals = (row?.v ?? []).map(Number);
    out.buckets = starts.map((start, i) => ({ start, collectedCents: vals[i] ?? 0 }));

    const [o] = await db
      .select({
        balance: sql<string>`coalesce(sum(greatest(${invoicesTable.totalCents} - ${invoicesTable.paidCents}, 0)), 0)`,
        overdue: sql<string>`coalesce(sum(greatest(${invoicesTable.totalCents} - ${invoicesTable.paidCents}, 0)) filter (where ${invoicesTable.dueDate} < ${now.toISOString()}), 0)`,
      })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.userId, userId), isNull(invoicesTable.archivedAt), inArray(invoicesTable.status, [...OPEN_INVOICE_STATUSES])));
    out.outstanding = { balanceCents: Number(o?.balance ?? 0), overdueCents: Number(o?.overdue ?? 0) };

    if (roleCan(role, "costs", "view")) {
      const [inv] = await db
        .select({ cents: sql<string>`coalesce(sum(case when ${invoicesTable.type} = 'credit_note' then -abs(${invoicesTable.subtotalCents}) else ${invoicesTable.subtotalCents} end), 0)` })
        .from(invoicesTable)
        .where(and(eq(invoicesTable.userId, userId), sql`${invoicesTable.status} not in ('void', 'draft')`, gte(invoicesTable.issueDate, curFrom), lt(invoicesTable.issueDate, to)));
      const [cost] = await db
        .select({ cents: sql<string>`coalesce(sum(${costEntriesTable.totalCents}), 0)` })
        .from(costEntriesTable)
        .where(and(eq(costEntriesTable.userId, userId), eq(costEntriesTable.status, "confirmed"), gte(costEntriesTable.date, curFrom), lt(costEntriesTable.date, to)));
      const invoiced = Number(inv?.cents ?? 0), spent = Number(cost?.cents ?? 0);
      out.marginPercent = invoiced > 0 ? Math.round(((invoiced - spent) / invoiced) * 100) : null;
    }
  }

  if (roleCan(role, "quotes", "view")) {
    const [q] = await db
      .select({ sent: sql<number>`count(*)::int`, won: sql<number>`count(*) filter (where ${quotesTable.status} = 'accepted')::int` })
      .from(quotesTable)
      .where(and(eq(quotesTable.userId, userId), isNull(quotesTable.archivedAt), isNotNull(quotesTable.sentAt), gte(quotesTable.sentAt, curFrom), lt(quotesTable.sentAt, to)));
    out.winPercent = q && q.sent > 0 ? Math.round((q.won / q.sent) * 100) : null;
  }

  return out;
}
