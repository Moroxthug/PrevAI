// POCKET-2 (QuoteAI Phase 125): la scheda Clienti e la schermata Cliente dell'app. Una lettura ciascuna che
// unisce preventivi, pro-forma/fatture e cantieri del cliente, così il telefono non fa quattro chiamate a riga.
// Derivata e di sola lettura: i numeri vengono dalle stesse tabelle delle pagine web.
//
// Stato (Attivo / Contatto dei pannelli): un cliente è attivo quando con lui c'è qualcosa di concreto (un
// preventivo accettato, un cantiere, un documento inviato); altrimenti è un contatto.

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { clientsTable, db, hasFeature, invoicesTable, projectsTable, quotesTable, type BusinessProfile, type TeamMemberRole } from "@workspace/db";
import { roleCan } from "../middlewares/requirePermission.js";

const DAY = 86_400_000;
const OPEN_INVOICE = new Set(["sent", "viewed", "pending_confirmation", "partially_paid", "overdue"]);

export type QuoteFacts = {
  id: string; clientId: string | null; status: string; totalCents: number; title: string | null; number: string | null;
  createdAt: Date; sentAt: Date | null; firstViewedAt: Date | null; acceptedAt: Date | null; declinedAt: Date | null; description: string;
};
export type InvoiceFacts = {
  id: string; clientId: string | null; number: string; type: string; status: string; totalCents: number; paidCents: number;
  issueDate: Date; dueDate: Date; sentAt: Date | null; paidAt: Date | null; lastReminderAt: Date | null; customerEmail: string | null; projectName: string | null;
};
export type JobFacts = {
  id: string; clientId: string | null; name: string; status: string; address: string; progressPercent: number;
  contractValueCents: number; plannedStart: Date | null; plannedEnd: Date | null; completedAt: Date | null; createdAt: Date;
};
export type ClientFacts = {
  id: string; type: string; name: string; email: string | null; phone: string | null; address: string | null; city: string | null;
  province: string | null; postalCode: string | null; businessNumber: string | null; codiceFiscale: string | null; preferredLanguage: string; notes: string; createdAt: Date;
};

type ActivityKind = "quote_drafted" | "quote_sent" | "quote_viewed" | "quote_accepted" | "quote_declined" | "invoice_sent" | "invoice_reminded" | "invoice_paid" | "job_started";
export type LastActivity = { kind: ActivityKind; at: string; ref: string | null };

export type ClientRow = {
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  status: "active" | "prospect";
  createdAt: string;
  quoteCount: number;
  jobCount: number;
  activeJobs: number;
  /** Preventivi accettati, in centesimi: quanto hanno comprato. */
  lifetimeCents: number;
  /** Residuo dei documenti aperti e quanto è scaduto. Null quando questa persona non vede le fatture. */
  owedCents: number | null;
  overdueCount: number | null;
  overdueCents: number | null;
  lastActivity: LastActivity | null;
};

export type ClientsStats = {
  total: number;
  active: number;
  activeJobs: number;
  lifetimeCents: number;
  lifetimeThisYearCents: number;
  lifetimeLastYearCents: number;
  owedCents: number | null;
  overdueCount: number | null;
};

const balance = (i: Pick<InvoiceFacts, "totalCents" | "paidCents">) => Math.max(0, i.totalCents - i.paidCents);
const isCredit = (i: InvoiceFacts) => i.type === "credit_note";

/** L'ultima cosa successa fra l'impresa e questo cliente. */
export function lastActivityOf(quotes: QuoteFacts[], invoices: InvoiceFacts[], jobs: JobFacts[]): LastActivity | null {
  let best: LastActivity | null = null;
  const take = (kind: ActivityKind, at: Date | null, ref: string | null) => {
    if (!at) return;
    if (!best || at.getTime() > new Date(best.at).getTime()) best = { kind, at: at.toISOString(), ref };
  };
  for (const q of quotes) {
    const ref = q.number ?? q.title ?? null;
    take("quote_drafted", q.createdAt, ref);
    take("quote_sent", q.sentAt, ref);
    take("quote_viewed", q.firstViewedAt, ref);
    take("quote_accepted", q.acceptedAt, ref);
    take("quote_declined", q.declinedAt, ref);
  }
  for (const i of invoices) {
    take("invoice_sent", i.sentAt, i.number);
    take("invoice_reminded", i.lastReminderAt, i.number);
    take("invoice_paid", i.paidAt, i.number);
  }
  for (const j of jobs) take("job_started", j.createdAt, j.name);
  return best;
}

export type Inputs = {
  clients: ClientFacts[];
  quotes: QuoteFacts[];
  /** null: questa persona non vede le fatture (ruolo o piano). */
  invoices: InvoiceFacts[] | null;
  /** null: questa persona non vede i cantieri. */
  jobs: JobFacts[] | null;
  now: Date;
};

function group<T extends { clientId: string | null }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.clientId) continue;
    (m.get(r.clientId) ?? m.set(r.clientId, []).get(r.clientId)!).push(r);
  }
  return m;
}

function rowFor(c: ClientFacts, quotes: QuoteFacts[], invoices: InvoiceFacts[] | null, jobs: JobFacts[] | null, now: Date): ClientRow {
  const accepted = quotes.filter((q) => q.acceptedAt || q.status === "accepted");
  const open = (invoices ?? []).filter((i) => OPEN_INVOICE.has(i.status) && !isCredit(i));
  const overdue = open.filter((i) => i.dueDate.getTime() < now.getTime());
  const activeJobs = (jobs ?? []).filter((j) => !j.completedAt && j.status !== "completed" && j.status !== "cancelled" && j.status !== "archived");
  const booked = accepted.length > 0 || (jobs ?? []).length > 0 || (invoices ?? []).some((i) => i.status !== "draft" && i.status !== "void");
  return {
    id: c.id, name: c.name, type: c.type, email: c.email, phone: c.phone, address: c.address, city: c.city, province: c.province,
    status: booked ? "active" : "prospect",
    createdAt: c.createdAt.toISOString(),
    quoteCount: quotes.length,
    jobCount: (jobs ?? []).length,
    activeJobs: activeJobs.length,
    lifetimeCents: accepted.reduce((n, q) => n + q.totalCents, 0),
    owedCents: invoices ? open.reduce((n, i) => n + balance(i), 0) : null,
    overdueCount: invoices ? overdue.length : null,
    overdueCents: invoices ? overdue.reduce((n, i) => n + balance(i), 0) : null,
    lastActivity: lastActivityOf(quotes, invoices ?? [], jobs ?? []),
  };
}

/** Prima l'attività più recente (un cliente senza niente in corso va in fondo, poi per nome). */
export function buildOverview(inp: Inputs): { items: ClientRow[]; stats: ClientsStats } {
  const q = group(inp.quotes), i = group(inp.invoices ?? []), j = group(inp.jobs ?? []);
  const items = inp.clients.map((c) => rowFor(c, q.get(c.id) ?? [], inp.invoices ? i.get(c.id) ?? [] : null, inp.jobs ? j.get(c.id) ?? [] : null, inp.now));
  items.sort((a, b) => (b.lastActivity?.at ?? "").localeCompare(a.lastActivity?.at ?? "") || a.name.localeCompare(b.name));

  const year = inp.now.getFullYear();
  const accepted = inp.quotes.filter((x) => x.acceptedAt && x.clientId);
  const yearOf = (d: Date | null) => d?.getFullYear();
  const stats: ClientsStats = {
    total: items.length,
    active: items.filter((r) => r.status === "active").length,
    activeJobs: items.reduce((n, r) => n + r.activeJobs, 0),
    lifetimeCents: items.reduce((n, r) => n + r.lifetimeCents, 0),
    lifetimeThisYearCents: accepted.filter((x) => yearOf(x.acceptedAt) === year).reduce((n, x) => n + x.totalCents, 0),
    lifetimeLastYearCents: accepted.filter((x) => yearOf(x.acceptedAt) === year - 1).reduce((n, x) => n + x.totalCents, 0),
    owedCents: inp.invoices ? items.reduce((n, r) => n + (r.owedCents ?? 0), 0) : null,
    overdueCount: inp.invoices ? items.reduce((n, r) => n + (r.overdueCount ?? 0), 0) : null,
  };
  return { items, stats };
}

export type ClientDetail = {
  client: ClientRow & { notes: string; businessNumber: string | null; codiceFiscale: string | null; postalCode: string | null };
  quotes: { id: string; number: string | null; title: string | null; description: string; totalCents: number; status: string; createdAt: string; sentAt: string | null; firstViewedAt: string | null; acceptedAt: string | null; declinedAt: string | null }[];
  invoices: { id: string; number: string; type: string; status: string; totalCents: number; paidCents: number; balanceCents: number; issueDate: string; dueDate: string; projectName: string | null; daysLate: number }[] | null;
  jobs: { id: string; name: string; status: string; address: string; progressPercent: number; contractValueCents: number; plannedStart: string | null; plannedEnd: string | null; completedAt: string | null }[] | null;
  invoicedCents: number | null;
  /** Il documento aperto più scaduto, per il banner (null se niente è in ritardo). */
  worstOverdue: { id: string; number: string; balanceCents: number; daysLate: number; canRemind: boolean } | null;
};

export function buildDetail(c: ClientFacts, quotes: QuoteFacts[], invoices: InvoiceFacts[] | null, jobs: JobFacts[] | null, now: Date, canEditInvoices: boolean): ClientDetail {
  const row = rowFor(c, quotes, invoices, jobs, now);
  const late = (inv: InvoiceFacts) => Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / DAY));
  const open = (invoices ?? []).filter((i) => OPEN_INVOICE.has(i.status) && !isCredit(i) && i.dueDate.getTime() < now.getTime()).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const worst = open[0];
  const remindedLately = (i: InvoiceFacts) => !!i.lastReminderAt && now.getTime() - i.lastReminderAt.getTime() < 3 * DAY;
  return {
    client: { ...row, notes: c.notes, businessNumber: c.businessNumber, codiceFiscale: c.codiceFiscale, postalCode: c.postalCode },
    quotes: quotes.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((q) => ({
      id: q.id, number: q.number, title: q.title, description: q.description, totalCents: q.totalCents, status: q.status, createdAt: q.createdAt.toISOString(),
      sentAt: q.sentAt?.toISOString() ?? null, firstViewedAt: q.firstViewedAt?.toISOString() ?? null, acceptedAt: q.acceptedAt?.toISOString() ?? null, declinedAt: q.declinedAt?.toISOString() ?? null,
    })),
    invoices: invoices
      ? invoices.slice().sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime()).map((i) => ({
        id: i.id, number: i.number, type: i.type, status: i.status, totalCents: i.totalCents, paidCents: i.paidCents, balanceCents: balance(i),
        issueDate: i.issueDate.toISOString(), dueDate: i.dueDate.toISOString(), projectName: i.projectName, daysLate: OPEN_INVOICE.has(i.status) ? late(i) : 0,
      }))
      : null,
    jobs: jobs
      ? jobs.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((j) => ({
        id: j.id, name: j.name, status: j.status, address: j.address, progressPercent: j.progressPercent, contractValueCents: j.contractValueCents,
        plannedStart: j.plannedStart?.toISOString() ?? null, plannedEnd: j.plannedEnd?.toISOString() ?? null, completedAt: j.completedAt?.toISOString() ?? null,
      }))
      : null,
    invoicedCents: invoices ? invoices.filter((i) => i.status !== "draft" && i.status !== "void" && !isCredit(i)).reduce((n, i) => n + i.totalCents, 0) : null,
    worstOverdue: worst ? { id: worst.id, number: worst.number, balanceCents: balance(worst), daysLate: late(worst), canRemind: canEditInvoices && (worst.customerEmail ?? "").includes("@") && !remindedLately(worst) } : null,
  };
}

// ── Loading ──────────────────────────────────────────────────────────────────

const quoteFacts = (userId: string, clientIds?: string[]) =>
  db
    .select({
      id: quotesTable.id, clientId: quotesTable.clientId, status: quotesTable.status, total: quotesTable.totale, title: quotesTable.titoloPreventivoRiga1, number: quotesTable.numeroPreventivoData,
      createdAt: quotesTable.createdAt, updatedAt: quotesTable.updatedAt, sentAt: quotesTable.sentAt, firstViewedAt: quotesTable.firstViewedAt, acceptedAt: quotesTable.acceptedAt, declinedAt: quotesTable.declinedAt,
      description: quotesTable.descrizioneGenerale,
    })
    .from(quotesTable)
    .where(and(eq(quotesTable.userId, userId), isNull(quotesTable.archivedAt), clientIds ? inArray(quotesTable.clientId, clientIds) : undefined))
    .orderBy(desc(quotesTable.createdAt))
    .limit(2000)
    .then((rows): QuoteFacts[] => rows.map((r) => ({ id: r.id, clientId: r.clientId, status: r.status, totalCents: Math.round(Number(r.total) * 100), title: r.title ?? null, number: r.number?.trim() || null, createdAt: r.createdAt, sentAt: r.sentAt ?? (r.status === "unlocked" ? r.updatedAt : null), firstViewedAt: r.firstViewedAt, acceptedAt: r.acceptedAt, declinedAt: r.declinedAt, description: r.description })));

const invoiceFacts = (userId: string, clientIds?: string[]) =>
  db
    .select({
      id: invoicesTable.id, clientId: invoicesTable.clientId, number: invoicesTable.number, type: invoicesTable.type, status: invoicesTable.status, totalCents: invoicesTable.totalCents, paidCents: invoicesTable.paidCents,
      issueDate: invoicesTable.issueDate, dueDate: invoicesTable.dueDate, sentAt: invoicesTable.sentAt, paidAt: invoicesTable.paidAt, lastReminderAt: invoicesTable.lastReminderAt, customer: invoicesTable.customer, projectId: invoicesTable.projectId,
    })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.userId, userId), isNull(invoicesTable.archivedAt), clientIds ? inArray(invoicesTable.clientId, clientIds) : undefined))
    .limit(3000)
    .then((rows): InvoiceFacts[] => rows.map((r) => ({ id: r.id, clientId: r.clientId, number: r.number, type: r.type, status: r.status, totalCents: r.totalCents, paidCents: r.paidCents, issueDate: r.issueDate, dueDate: r.dueDate, sentAt: r.sentAt, paidAt: r.paidAt, lastReminderAt: r.lastReminderAt, customerEmail: r.customer?.email ?? null, projectName: null })));

const jobFacts = (userId: string, clientIds?: string[]) =>
  db
    .select({
      id: projectsTable.id, clientId: projectsTable.clientId, name: projectsTable.name, status: projectsTable.status, address: projectsTable.address, progressPercent: projectsTable.progressPercent,
      contractValueCents: projectsTable.contractValueCents, plannedStart: projectsTable.plannedStart, plannedEnd: projectsTable.plannedEnd, completedAt: projectsTable.completedAt, createdAt: projectsTable.createdAt,
    })
    .from(projectsTable)
    .where(and(eq(projectsTable.userId, userId), isNull(projectsTable.archivedAt), clientIds ? inArray(projectsTable.clientId, clientIds) : undefined))
    .limit(2000);

const clientFacts = (userId: string, id?: string) =>
  db
    .select({
      id: clientsTable.id, type: clientsTable.type, name: clientsTable.name, email: clientsTable.email, phone: clientsTable.phone, address: clientsTable.address, city: clientsTable.city, province: clientsTable.province,
      postalCode: clientsTable.postalCode, businessNumber: clientsTable.businessNumber, codiceFiscale: clientsTable.codiceFiscale, preferredLanguage: clientsTable.preferredLanguage, notes: clientsTable.notes, createdAt: clientsTable.createdAt,
    })
    .from(clientsTable)
    .where(and(eq(clientsTable.userId, userId), isNull(clientsTable.archivedAt), id ? eq(clientsTable.id, id) : undefined))
    .orderBy(clientsTable.name)
    .limit(1000);

function access(role: TeamMemberRole, profile: BusinessProfile | undefined) {
  return {
    quotes: roleCan(role, "quotes", "view"),
    invoices: roleCan(role, "invoicing", "view") && hasFeature(profile ?? null, "invoicing"),
    jobs: roleCan(role, "jobs", "view") && hasFeature(profile ?? null, "jobs"),
    editInvoices: roleCan(role, "invoicing", "edit"),
  };
}

export async function loadOverview(userId: string, role: TeamMemberRole, profile: BusinessProfile | undefined, now = new Date()) {
  const a = access(role, profile);
  if (!a.quotes) return { items: [] as ClientRow[], stats: buildOverview({ clients: [], quotes: [], invoices: null, jobs: null, now }).stats };
  const [clients, quotes, invoices, jobs] = await Promise.all([clientFacts(userId), quoteFacts(userId), a.invoices ? invoiceFacts(userId) : Promise.resolve(null), a.jobs ? jobFacts(userId) : Promise.resolve(null)]);
  return buildOverview({ clients: clients.map((c) => ({ ...c })), quotes, invoices, jobs, now });
}

export async function loadDetail(userId: string, role: TeamMemberRole, profile: BusinessProfile | undefined, id: string, now = new Date()): Promise<ClientDetail | null> {
  const a = access(role, profile);
  if (!a.quotes) return null;
  const [client] = await clientFacts(userId, id);
  if (!client) return null;
  const [quotes, invoices, jobs] = await Promise.all([quoteFacts(userId, [id]), a.invoices ? invoiceFacts(userId, [id]) : Promise.resolve(null), a.jobs ? jobFacts(userId, [id]) : Promise.resolve(null)]);
  return buildDetail({ ...client }, quotes, invoices, jobs, now, a.editInvoices);
}
