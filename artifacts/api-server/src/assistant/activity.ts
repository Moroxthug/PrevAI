// APP-8h (docs/ASSISTENTE-PLAN.md) — fiducia: registro delle azioni e costi.
//
// Attività: ogni azione dell'assistente (assistant_actions, dalla migrazione
// 0013) con chi l'ha chiesta, cosa ha fatto, se l'ha fatta da sola ("Lo fa") o
// dopo una conferma, e se è stata annullata. Annulla resta quello della scheda
// (pochi secondi, solo chi l'ha chiesta): dopo, il registro porta alla schermata
// dove si cambia a mano. Il titolare (impostazioni "full") vede tutta
// l'impresa, gli altri le proprie.
//
// Costi: token dei turni (usage_events "assistant_turn") e voce del fornitore
// ("ai_speech") per impresa, in euro per posto; il cron avvisa lo staff il
// giorno in cui un'impresa supera la soglia (assistente-costi.ts).
import { db, assistantActionsTable, assistantProposalsTable, authUsersTable, usageEventsTable, organizationMembersTable, businessProfilesTable, type AssistantActionRow, type AssistantProposal } from "@workspace/db";
import { ASSISTANT_ACTION_DEFS, ASSISTANT_COST_ALERT_EUR_CENTS_PER_SEAT, assistantCostSummary, crossedCostAlert, monthStartUtc, type AssistantCostSummary, type AssistantUsageNumbers } from "@workspace/config";
import { and, desc, eq, gte, inArray, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { assistantV2Ready, undoDeadline } from "./permissions.js";
import { ASSISTANT_USAGE_ENTITY } from "./stream.js";
import { sendOpsAlert } from "../lib/ops.js";

// ── Attività ─────────────────────────────────────────────────────────────────

export type ActivityItem = {
  id: string;
  proposalId: string;
  kind: AssistantProposal["kind"];
  label: string;
  summary: string;
  level: AssistantActionRow["level"];
  status: "done" | "undone";
  executedAt: string;
  undoneAt: string | null;
  undoUntil: string | null;
  actor: { id: string; name: string; mine: boolean };
  link: string | null;
};

/** Where to change it by hand once Annulla is gone. Only pages that take the id (a client's page is keyed differently). */
export function activityLink(p: Pick<AssistantProposal, "kind" | "projectId" | "resultEntityType" | "resultEntityId">): string | null {
  const id = p.resultEntityId;
  switch (p.resultEntityType) {
    case "invoice": return id ? `/dashboard/invoices/${id}` : null;
    case "quote": return id ? `/dashboard/quotes/${id}` : null;
    case "contract": return id ? `/dashboard/contracts/${id}` : null;
    case "lead": return "/dashboard/leads";
    case "client": return "/dashboard/clients";
  }
  if (p.kind === "cost_entry") return p.projectId ? `/dashboard/jobs/${p.projectId}?tab=costs` : null;
  if (p.kind === "task" || p.kind === "milestone_update") return p.projectId ? `/dashboard/jobs/${p.projectId}?tab=schedule` : null;
  if (p.kind === "job_note") return p.projectId ? `/dashboard/jobs/${p.projectId}` : null;
  return null;
}

export async function listActivity(params: { orgId: string; actorId: string; everyone: boolean; before?: Date | null; limit: number }): Promise<{ available: boolean; items: ActivityItem[]; next: string | null }> {
  if (!(await assistantV2Ready())) return { available: false, items: [], next: null };
  const where: SQL[] = [eq(assistantActionsTable.userId, params.orgId)];
  if (!params.everyone) where.push(eq(assistantActionsTable.actorUserId, params.actorId));
  if (params.before) where.push(lt(assistantActionsTable.executedAt, params.before));
  const rows = await db
    .select({ a: assistantActionsTable, p: assistantProposalsTable })
    .from(assistantActionsTable)
    .innerJoin(assistantProposalsTable, eq(assistantProposalsTable.id, assistantActionsTable.proposalId))
    .where(and(...where))
    .orderBy(desc(assistantActionsTable.executedAt))
    .limit(params.limit + 1);
  const page = rows.slice(0, params.limit);
  const actorIds = [...new Set(page.map((r) => r.a.actorUserId))];
  const people = actorIds.length ? await db.select({ id: authUsersTable.id, name: authUsersTable.name, email: authUsersTable.email }).from(authUsersTable).where(inArray(authUsersTable.id, actorIds)) : [];
  const nameOf = new Map(people.map((u) => [u.id, u.name?.trim() || u.email]));
  const items = page.map(({ a, p }): ActivityItem => ({
    id: a.id,
    proposalId: p.id,
    kind: p.kind,
    label: ASSISTANT_ACTION_DEFS[p.kind]?.label ?? p.kind,
    summary: p.summary,
    level: a.level,
    status: a.undoneAt ? "undone" : "done",
    executedAt: a.executedAt.toISOString(),
    undoneAt: a.undoneAt?.toISOString() ?? null,
    // Annulla only for the person who asked, as on the card.
    undoUntil: a.actorUserId === params.actorId ? (undoDeadline(a)?.toISOString() ?? null) : null,
    actor: { id: a.actorUserId, name: nameOf.get(a.actorUserId) ?? "Persona rimossa", mine: a.actorUserId === params.actorId },
    link: activityLink(p),
  }));
  const next = rows.length > params.limit ? page[page.length - 1]!.a.executedAt.toISOString() : null;
  return { available: true, items, next };
}

// ── Costi ────────────────────────────────────────────────────────────────────

type UsageRow = { userId: string; turns: number; tokens: number; tokenCost: number; voiceSeconds: number; voiceCost: number };

/** Token e voce dell'assistente per impresa, dal `since` a `until` (escluso). */
async function usageByCompany(since: Date, until: Date, orgId?: string): Promise<UsageRow[]> {
  const isTurn = and(eq(usageEventsTable.kind, "ai_text"), eq(usageEventsTable.relatedEntityType, ASSISTANT_USAGE_ENTITY));
  const isVoice = eq(usageEventsTable.kind, "ai_speech");
  const cost = sql`${usageEventsTable.quantity} * ${usageEventsTable.unitCostCents}`;
  const rows = await db
    .select({
      userId: usageEventsTable.userId,
      turns: sql<string>`count(*) filter (where ${isTurn})`,
      tokens: sql<string>`coalesce(sum(${usageEventsTable.quantity}) filter (where ${isTurn}), 0)`,
      tokenCost: sql<string>`coalesce(sum(${cost}) filter (where ${isTurn}), 0)`,
      voiceSeconds: sql<string>`coalesce(sum(${usageEventsTable.quantity}) filter (where ${isVoice}), 0)`,
      voiceCost: sql<string>`coalesce(sum(${cost}) filter (where ${isVoice}), 0)`,
    })
    .from(usageEventsTable)
    .where(and(gte(usageEventsTable.createdAt, since), lt(usageEventsTable.createdAt, until), or(isTurn, isVoice), orgId ? eq(usageEventsTable.userId, orgId) : undefined))
    .groupBy(usageEventsTable.userId);
  return rows.map((r) => ({ userId: r.userId, turns: Number(r.turns), tokens: Number(r.tokens), tokenCost: Number(r.tokenCost), voiceSeconds: Number(r.voiceSeconds), voiceCost: Number(r.voiceCost) }));
}

/** Posti = il titolare + i membri non sospesi (come in Squadra). */
async function seatsOf(orgIds: string[]): Promise<Map<string, number>> {
  if (!orgIds.length) return new Map();
  const rows = await db
    .select({ ownerId: organizationMembersTable.ownerId, n: sql<string>`count(*)` })
    .from(organizationMembersTable)
    .where(and(inArray(organizationMembersTable.ownerId, orgIds), ne(organizationMembersTable.status, "suspended")))
    .groupBy(organizationMembersTable.ownerId);
  const byOrg = new Map(rows.map((r) => [r.ownerId, Number(r.n) + 1]));
  return new Map(orgIds.map((id) => [id, byOrg.get(id) ?? 1]));
}

function toNumbers(r: UsageRow, seats: number): AssistantUsageNumbers {
  return { turns: r.turns, tokens: r.tokens, tokenCostUsdCents: r.tokenCost, voiceSeconds: r.voiceSeconds, voiceCostUsdCents: r.voiceCost, seats };
}

export type CompanyAssistantCost = AssistantCostSummary & { userId: string; companyName: string | null; plan: string | null };

/** Il mese in corso (o quello che contiene `month`), un'impresa o tutte, le più care per posto prima. */
export async function assistantCosts(params: { month?: Date; orgId?: string } = {}): Promise<{ from: string; rows: CompanyAssistantCost[] }> {
  const from = monthStartUtc(params.month ?? new Date());
  const until = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const usage = await usageByCompany(from, until, params.orgId);
  const ids = params.orgId ? [params.orgId] : usage.map((u) => u.userId);
  const [seats, profiles] = await Promise.all([
    seatsOf(ids),
    ids.length ? db.select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName, plan: businessProfilesTable.subscriptionPlan }).from(businessProfilesTable).where(inArray(businessProfilesTable.userId, ids)) : Promise.resolve([]),
  ]);
  const profileOf = new Map(profiles.map((p) => [p.userId, p]));
  const byOrg = new Map(usage.map((u) => [u.userId, u]));
  const rows = ids.map((id) => {
    const u = byOrg.get(id) ?? { userId: id, turns: 0, tokens: 0, tokenCost: 0, voiceSeconds: 0, voiceCost: 0 };
    return { userId: id, companyName: profileOf.get(id)?.companyName ?? null, plan: profileOf.get(id)?.plan ?? null, ...assistantCostSummary(toNumbers(u, seats.get(id) ?? 1)) };
  });
  rows.sort((a, b) => b.perSeatEurCents - a.perSeatEurCents);
  return { from: from.toISOString().slice(0, 10), rows };
}

/**
 * Cron (una volta al giorno): le imprese il cui costo per posto del mese ha
 * superato la soglia dall'ultimo giro. Ieri sotto e oggi sopra → un avviso;
 * nessuna tabella per ricordarlo.
 */
export async function runAssistantCostAlerts(now = new Date()): Promise<{ companies: number; alerted: number }> {
  const from = monthStartUtc(now);
  const yesterday = new Date(now.getTime() - 24 * 3_600_000);
  const [today, before] = await Promise.all([usageByCompany(from, now), yesterday > from ? usageByCompany(from, yesterday) : Promise.resolve([] as UsageRow[])]);
  const seats = await seatsOf(today.map((u) => u.userId));
  const beforeOf = new Map(before.map((u) => [u.userId, u]));
  const crossed: { userId: string; summary: AssistantCostSummary }[] = [];
  for (const u of today) {
    const s = seats.get(u.userId) ?? 1;
    const summary = assistantCostSummary(toNumbers(u, s));
    const prev = beforeOf.get(u.userId);
    const prevPerSeat = prev ? assistantCostSummary(toNumbers(prev, s)).perSeatEurCents : 0;
    if (crossedCostAlert(prevPerSeat, summary.perSeatEurCents)) crossed.push({ userId: u.userId, summary });
  }
  if (crossed.length) {
    const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
    await sendOpsAlert(`Assistente: ${crossed.length} impresa/e oltre la soglia di costo per posto`, [
      `Dal ${from.toISOString().slice(0, 10)} queste imprese hanno superato ${eur(ASSISTANT_COST_ALERT_EUR_CENTS_PER_SEAT)} per posto (ASSISTANT_COST_ALERT_EUR_CENTS_PER_SEAT):`,
      "",
      ...crossed.map(({ userId, summary: c }) => `- ${userId}: ${eur(c.costEurCents)} in ${c.turns} turni (${c.tokens} token) + ${c.voiceMinutes} min di voce, ${c.seats} posti → ${eur(c.perSeatEurCents)} per posto`),
      "",
      "Dettaglio: /dashboard/admin → Assistente (docs/RUNBOOKS.md §24).",
    ]);
  }
  return { companies: today.length, alerted: crossed.length };
}
