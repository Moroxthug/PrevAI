import {
  db,
  businessProfilesTable,
  organizationMembersTable,
  companyGroupsTable,
  companyGroupMembersTable,
  invoicesTable,
  costEntriesTable,
  type CompanyGroup,
  type CompanyGroupMember,
  type TeamMemberRole,
} from "@workspace/db";
import { roleCan } from "@workspace/config";
import { and, eq, gte, inArray } from "drizzle-orm";
import { companyAnalytics, type CompanyAnalytics } from "../analytics/service.js";
import { matchGroupCompany, type GroupCompanyKey } from "./intercompany.js";

// ── POCKET-4 (riga 61, QuoteAI 127.8): più imprese in un gruppo ──────────────
// Un gruppo non fonde mai i dati. Ogni lettura qui sotto gira per impresa, con l'id di quell'impresa, e solo per le imprese dove chi chiede ha un
// ruolo che potrebbe già leggere la stessa cosa passando a quell'impresa: il gruppo è una scorciatoia fra imprese, mai un modo per entrarci.

export class GroupError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Il ruolo che `actorId` ha nell'impresa `orgId`, o null. Il titolare è l'accesso del profilo stesso. */
export async function roleIn(actorId: string, orgId: string): Promise<TeamMemberRole | null> {
  if (actorId === orgId) {
    const [p] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
    return p ? "owner" : null;
  }
  const [m] = await db
    .select({ role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.userId, actorId), eq(organizationMembersTable.ownerId, orgId), eq(organizationMembersTable.status, "active")));
  return m?.role ?? null;
}

type GroupCompany = CompanyGroupMember & { companyName: string; province: string | null };
export type GroupState = { group: CompanyGroup; self: CompanyGroupMember; members: GroupCompany[] };

/** Il gruppo di un'impresa (o l'invito a uno), con tutte le imprese che ci sono. */
export async function groupStateFor(orgId: string): Promise<GroupState | null> {
  const [self] = await db.select().from(companyGroupMembersTable).where(eq(companyGroupMembersTable.userId, orgId));
  if (!self) return null;
  const [group] = await db.select().from(companyGroupsTable).where(eq(companyGroupsTable.id, self.groupId));
  if (!group) return null;
  const rows = await db.select().from(companyGroupMembersTable).where(eq(companyGroupMembersTable.groupId, group.id));
  const profiles = rows.length
    ? await db.select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName, province: businessProfilesTable.province }).from(businessProfilesTable).where(inArray(businessProfilesTable.userId, rows.map((r) => r.userId)))
    : [];
  const byId = new Map(profiles.map((p) => [p.userId, p]));
  const members = rows
    .map((r) => ({ ...r, companyName: byId.get(r.userId)?.companyName || "Impresa", province: byId.get(r.userId)?.province ?? null }))
    .sort((a, b) => (a.userId === group.userId ? -1 : b.userId === group.userId ? 1 : a.createdAt.getTime() - b.createdAt.getTime()));
  return { group, self, members };
}

export const activeMembers = (s: GroupState) => s.members.filter((m) => m.status === "active");

/** Le imprese del gruppo dell'impresa in uso dove la persona ha un ruolo che passa `check`. */
async function companiesWhere(actorId: string, state: GroupState, check: (role: TeamMemberRole) => boolean): Promise<{ included: (GroupCompany & { role: TeamMemberRole })[]; excluded: { orgId: string; companyName: string; role: TeamMemberRole | null }[] }> {
  const included: (GroupCompany & { role: TeamMemberRole })[] = [];
  const excluded: { orgId: string; companyName: string; role: TeamMemberRole | null }[] = [];
  for (const m of activeMembers(state)) {
    const role = await roleIn(actorId, m.userId);
    if (role && check(role)) included.push({ ...m, role });
    else excluded.push({ orgId: m.userId, companyName: m.companyName, role });
  }
  return { included, excluded };
}

/** Toglie un'impresa dal suo gruppo. Se il gruppo resta senza impresa che lo gestisce passa alla più vecchia fra le attive, o finisce. */
export async function removeFromGroup(state: GroupState, orgId: string): Promise<void> {
  const member = state.members.find((m) => m.userId === orgId);
  if (!member) return;
  const { group } = state;
  await db.delete(companyGroupMembersTable).where(eq(companyGroupMembersTable.id, member.id));
  const left = await db.select({ id: companyGroupMembersTable.id }).from(companyGroupMembersTable).where(eq(companyGroupMembersTable.groupId, group.id));
  if (!left.length || orgId === group.userId) {
    const [next] = (await db.select().from(companyGroupMembersTable).where(and(eq(companyGroupMembersTable.groupId, group.id), eq(companyGroupMembersTable.status, "active")))).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (next) await db.update(companyGroupsTable).set({ userId: next.userId }).where(eq(companyGroupsTable.id, group.id));
    else await db.delete(companyGroupsTable).where(eq(companyGroupsTable.id, group.id));
  }
}

// ── La vista di insieme ──────────────────────────────────────────────────────

type Totals = CompanyAnalytics["totals"];

export type GroupOverview = {
  months: number;
  companies: { orgId: string; companyName: string; province: string | null; totals: Totals; aging: CompanyAnalytics["aging"]; activeJobs: number; series: { month: string; invoicedCents: number; costCents: number }[] }[];
  excluded: { orgId: string; companyName: string; role: TeamMemberRole | null }[];
  consolidated: { invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null; outstandingCents: number; overdueCents: number; pipelineCents: number; activeJobs: number };
  intercompany: { invoicedCents: number; costCents: number; byMonth: { month: string; invoicedCents: number; costCents: number }[]; lines: { fromOrgId: string; toOrgId: string; kind: "invoice" | "cost"; count: number; cents: number }[] };
  series: { month: string; invoicedCents: number; collectedCents: number; costCents: number }[];
  aging: CompanyAnalytics["aging"];
  cashFlow: { week: string; netCents: number; cumulativeCents: number }[];
};

/**
 * Le analisi di ogni impresa inclusa, sommate, col lavoro fra le imprese del gruppo tolto dalle somme (fatturato da una, costo per l'altra).
 * I soldi si vedono solo per le imprese dove la persona è titolare o amministratore.
 */
export async function groupOverview(actorId: string, state: GroupState, opts: { months: number; now?: Date }): Promise<GroupOverview> {
  const now = opts.now ?? new Date();
  const months = Math.min(24, Math.max(3, opts.months));
  const { included, excluded } = await companiesWhere(actorId, state, (role) => roleCan(role, "analytics", "full"));
  const perCompany = await Promise.all(included.map(async (c) => ({ c, a: await companyAnalytics(c.userId, { months, now }) })));

  // Fra imprese: ogni impresa del gruppo (non solo quelle incluse) è una controparte da riconoscere.
  const keys = await companyKeys(activeMembers(state).map((m) => m.userId));
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
  const lines = new Map<string, { fromOrgId: string; toOrgId: string; kind: "invoice" | "cost"; count: number; cents: number }>();
  const add = (fromOrgId: string, toOrgId: string, kind: "invoice" | "cost", cents: number) => {
    const k = `${kind}:${fromOrgId}:${toOrgId}`;
    const l = lines.get(k) ?? { fromOrgId, toOrgId, kind, count: 0, cents: 0 };
    l.count += 1;
    l.cents += cents;
    lines.set(k, l);
  };
  let icInvoiced = 0;
  let icCost = 0;
  const icMonths = new Map<string, { month: string; invoicedCents: number; costCents: number }>();
  const icMonth = (d: Date) => {
    const month = d.toISOString().slice(0, 7);
    let m = icMonths.get(month);
    if (!m) { m = { month, invoicedCents: 0, costCents: 0 }; icMonths.set(month, m); }
    return m;
  };
  if (included.length) {
    const ids = included.map((c) => c.userId);
    const [invoices, costs] = await Promise.all([
      db.select({ userId: invoicesTable.userId, type: invoicesTable.type, status: invoicesTable.status, totalCents: invoicesTable.totalCents, customer: invoicesTable.customer, issueDate: invoicesTable.issueDate }).from(invoicesTable).where(and(inArray(invoicesTable.userId, ids), gte(invoicesTable.issueDate, since))),
      db.select({ userId: costEntriesTable.userId, vendor: costEntriesTable.vendor, totalCents: costEntriesTable.totalCents, status: costEntriesTable.status, date: costEntriesTable.date }).from(costEntriesTable).where(and(inArray(costEntriesTable.userId, ids), gte(costEntriesTable.date, since))),
    ]);
    for (const i of invoices) {
      if (i.status === "void" || i.status === "draft") continue;
      const to = matchGroupCompany(i.customer ?? {}, keys, i.userId);
      if (!to) continue;
      const cents = i.type === "credit_note" ? -Math.abs(i.totalCents) : i.totalCents;
      icInvoiced += cents;
      icMonth(i.issueDate).invoicedCents += cents;
      add(i.userId, to, "invoice", cents);
    }
    for (const c of costs) {
      if (c.status !== "confirmed") continue;
      const from = matchGroupCompany({ name: c.vendor }, keys, c.userId);
      if (!from) continue;
      icCost += c.totalCents;
      icMonth(c.date).costCents += c.totalCents;
      add(from, c.userId, "cost", c.totalCents);
    }
  }

  const sum = (k: keyof Totals) => perCompany.reduce((s, p) => s + ((p.a.totals[k] as number | null) ?? 0), 0);
  const invoicedCents = sum("invoicedCents") - icInvoiced;
  const costCents = sum("costCents") - icCost;
  const marginCents = invoicedCents - costCents;

  const series = (perCompany[0]?.a.months ?? []).map((m, i) => ({
    month: m.month,
    invoicedCents: perCompany.reduce((s, p) => s + (p.a.months[i]?.invoicedCents ?? 0), 0),
    collectedCents: perCompany.reduce((s, p) => s + (p.a.months[i]?.collectedCents ?? 0), 0),
    costCents: perCompany.reduce((s, p) => s + (p.a.months[i]?.costCents ?? 0), 0),
  }));
  const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalCents: 0, overdueCents: 0 };
  for (const p of perCompany) for (const k of Object.keys(aging) as (keyof typeof aging)[]) aging[k] += p.a.aging[k];
  const weeks = new Map<string, number>();
  for (const p of perCompany) for (const w of p.a.cashFlow) weeks.set(w.week, (weeks.get(w.week) ?? 0) + w.netCents);
  let running = 0;
  const cashFlow = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, netCents]) => ({ week, netCents, cumulativeCents: (running += netCents) }));

  return {
    months,
    companies: perCompany.map(({ c, a }) => ({ orgId: c.userId, companyName: c.companyName, province: c.province, totals: a.totals, aging: a.aging, activeJobs: a.jobs.active, series: a.months.map((m) => ({ month: m.month, invoicedCents: m.invoicedCents, costCents: m.costCents })) })),
    excluded,
    consolidated: {
      invoicedCents,
      collectedCents: sum("collectedCents"),
      costCents,
      marginCents,
      marginPercent: invoicedCents > 0 ? Math.round((marginCents / invoicedCents) * 1000) / 10 : null,
      outstandingCents: sum("outstandingCents"),
      overdueCents: sum("overdueCents"),
      pipelineCents: sum("pipelineCents"),
      activeJobs: perCompany.reduce((s, p) => s + p.a.jobs.active, 0),
    },
    intercompany: { invoicedCents: icInvoiced, costCents: icCost, byMonth: [...icMonths.values()].sort((a, b) => a.month.localeCompare(b.month)), lines: [...lines.values()] },
    series,
    aging,
    cashFlow,
  };
}

async function companyKeys(orgIds: string[]): Promise<GroupCompanyKey[]> {
  if (!orgIds.length) return [];
  const rows = await db
    .select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName, email: businessProfilesTable.email, piva: businessProfilesTable.vatNumber })
    .from(businessProfilesTable)
    .where(inArray(businessProfilesTable.userId, orgIds));
  return rows.map((r) => ({ orgId: r.userId, name: r.companyName, email: r.email, businessNumber: r.piva }));
}
