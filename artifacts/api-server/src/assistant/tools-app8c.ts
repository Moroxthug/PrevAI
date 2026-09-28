// APP-8c (docs/PIANO-AZIONE.md riga 34, docs/ASSISTENTE-PLAN.md) — gli strumenti nuovi.
//
// Reads: brief_me (the day, the week or one job), find (clients, jobs, quotes,
// invoices, leads, contracts by name, address or number), get_quote and
// open_screen (takes the app to a page; the turn sends a `navigate` event).
// Cards: a quote draft, the customer-facing sends (quote, contract, lead reply,
// a free email), a client's contact details and a job note. Like every propose_*
// tool these only validate and describe; apply-app8c.ts carries them out.
//
// Customer-facing sends can never run by themselves (lib/config assistente.ts
// max "ask"), and every text read from customers (a lead's message, a quote's
// description) reaches the model as data — the prompt says so.
import { z } from "zod";
import { voiceFacts } from "@workspace/config";
import type { OpenAI } from "@workspace/integrations-openai-ai-server";
import {
  db,
  projectsTable,
  milestonesTable,
  projectTasksTable,
  quotesTable,
  quoteVariantsTable,
  invoicesTable,
  leadsTable,
  clientsTable,
  contractsTable,
  suppliersTable,
  businessProfilesTable,
  clientDedupKey,
  normalizeProvince,
  type ProposalKind,
  type QuoteClientData,
  type QuoteChapter,
  type TeamMemberRole,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { roleCan, type PermissionArea } from "../middlewares/requirePermission.js";
import { needsYou, todayStats, localDay } from "../today/service.js";
import { companyAnalytics } from "../analytics/service.js";
import { toIsoDate } from "../jobs/dates.js";
// The quote, contract and billing services pull in PDF, email and payment clients: loaded on first use.
const services = () => Promise.all([import("../quotes/send.js"), import("../contracts/service.js"), import("../routes/payments.js")]).then(([q, c, p]) => ({ ...q, loadContract: c.loadContract, getTrialStatus: p.getTrialStatus }));
import { jobNotesReady } from "./ready.js";

/** What every tool knows about the turn (tools.ts ToolContext). */
export type App8cContext = { userId: string; projectId: string | null; province: string | null; now: Date; role: TeamMemberRole; actorId: string };

const money = (euros: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(euros);
const cents = (c: number) => money(c / 100);

// ── Definitions ──────────────────────────────────────────────────────────────

const str = (description?: string) => ({ type: "string", ...(description ? { description } : {}) }) as const;

export const SCREENS = {
  home: { path: "/dashboard", label: "Oggi" },
  quotes: { path: "/dashboard/quotes", label: "Preventivi" },
  new_quote: { path: "/dashboard/new", label: "Nuovo preventivo" },
  jobs: { path: "/dashboard/jobs", label: "Cantieri" },
  invoices: { path: "/dashboard/invoices", label: "Fatture" },
  clients: { path: "/dashboard/clients", label: "Clienti" },
  leads: { path: "/dashboard/leads", label: "Richieste" },
  contracts: { path: "/dashboard/contracts", label: "Contratti" },
  team: { path: "/dashboard/team", label: "Squadra" },
  analytics: { path: "/dashboard/analytics", label: "Analisi" },
  catalog: { path: "/dashboard/catalog", label: "Listino" },
  fisco: { path: "/dashboard/fisco", label: "Fisco" },
  settings: { path: "/dashboard/settings", label: "Impostazioni" },
  assistant_settings: { path: "/dashboard/settings/assistant", label: "Impostazioni dell'assistente" },
} as const;
type ScreenKey = keyof typeof SCREENS;
const SCREEN_KEYS = Object.keys(SCREENS) as [ScreenKey, ...ScreenKey[]];
/** The area a screen needs (fisco is closed to most roles since A-2). */
const SCREEN_AREA: Partial<Record<ScreenKey, PermissionArea>> = { fisco: "fiscale", leads: "leads", contracts: "contracts", invoices: "invoicing", team: "team", analytics: "analytics" };

// APP-8g adds the supplier book (Squadra → Fornitori).
const FIND_TYPES = ["client", "job", "quote", "invoice", "lead", "contract", "supplier"] as const;

export const APP8C_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  { type: "function", function: { name: "brief_me", description: "A short briefing: for 'today' or 'week' what needs the user (transfers to confirm, overdue invoices, hours to approve, leads to call back, quotes with no answer), the period's numbers, milestones and tasks due, jobs at risk; for 'job' the state of one job. Use it for 'com'è la giornata', 'cosa ho questa settimana', 'come va il cantiere'.", parameters: { type: "object", properties: { scope: { type: "string", enum: ["today", "week", "job"] }, job_id: str("For scope job; omit to use the current job") }, required: ["scope"], additionalProperties: false } } },
  { type: "function", function: { name: "find", description: "Search the company's clients, jobs, quotes, invoices, leads, contracts and suppliers by name, email, phone, address or number. Returns ids and the page of each result. Use it before any tool that needs an id the user described by name.", parameters: { type: "object", properties: { query: str("Name, email, phone, address fragment or document number"), types: { type: "array", items: { type: "string", enum: [...FIND_TYPES] } } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "get_quote", description: "One quote in detail: client and contacts, chapters and line items, discount, VAT, total, status, when it was sent or accepted, variants, contract and job linked to it.", parameters: { type: "object", properties: { quote_id: str() }, required: ["quote_id"], additionalProperties: false } } },
  { type: "function", function: { name: "open_screen", description: "Take the app to a page: a job, quote, invoice, client or contract by id (from find), or a section. Use it when the user says 'fammi vedere', 'apri', 'portami a'.", parameters: { type: "object", properties: { target: { type: "string", enum: ["job", "quote", "invoice", "client", "contract", "screen"] }, id: str("For job / quote / invoice / client / contract"), screen: { type: "string", enum: SCREEN_KEYS } }, required: ["target"], additionalProperties: false } } },
  { type: "function", function: { name: "propose_draft_quote", description: "Prepare a new quote draft from a description of the work, with the same generator as Nuovo preventivo (it takes up to half a minute). Nothing is sent; the user reviews the draft.", parameters: { type: "object", properties: { description: str("The work, as the user described it: rooms, quantities, materials, place"), client_name: str(), client_address: str(), client_email: str(), client_phone: str() }, required: ["description"], additionalProperties: false } } },
  { type: "function", function: { name: "propose_send_quote", description: "Propose emailing a quote (PDF + online accept link) to the customer. Uses the quote's client email unless to_email is given. The user must confirm.", parameters: { type: "object", properties: { quote_id: str(), to_email: str() }, required: ["quote_id"], additionalProperties: false } } },
  { type: "function", function: { name: "propose_send_contract", description: "Propose emailing a contract to the customer for signature (or re-sending the signing link). The company must have signed it first. The user must confirm.", parameters: { type: "object", properties: { contract_id: str(), message: str("Optional note in the email") }, required: ["contract_id"], additionalProperties: false } } },
  { type: "function", function: { name: "propose_reply_lead", description: "Propose sending a lead the next message of the standard follow-up sequence now (the company's template with unsubscribe link, by email or WhatsApp as the lead prefers). Not free text: for a personal message use propose_message_client. The user must confirm.", parameters: { type: "object", properties: { lead_id: str() }, required: ["lead_id"], additionalProperties: false } } },
  { type: "function", function: { name: "propose_message_client", description: "Propose a personal email to a client or lead, written by you from what the user asked. Only to an address the company already has (client, quote, lead, invoice); WhatsApp is not available. The user must confirm.", parameters: { type: "object", properties: { to_email: str(), name: str("Recipient's name"), subject: str(), body: str("Plain text, in Italian, signed with the company name") }, required: ["to_email", "subject", "body"], additionalProperties: false } } },
  { type: "function", function: { name: "propose_update_client", description: "Propose changing a client's contact or billing details (email, phone, address, P. IVA, C.F., PEC, codice SDI). Also fills the details on the client's quotes not yet accepted.", parameters: { type: "object", properties: { client_id: str("Client record id (find type client)"), email: str(), phone: str(), address: str(), city: str(), postal_code: str(), province: str("Sigla, e.g. MI"), partita_iva: str(), codice_fiscale: str(), pec: str(), codice_sdi: str() }, required: ["client_id"], additionalProperties: false } } },
  { type: "function", function: { name: "propose_job_note", description: "Propose writing a note on a job ('il cliente vuole il battiscopa bianco'). Stays inside the company.", parameters: { type: "object", properties: { job_id: str("Omit to use the current job"), text: str() }, required: ["text"], additionalProperties: false } } },
];

export const APP8C_PROPOSAL_TOOLS: Record<string, ProposalKind> = {
  propose_draft_quote: "draft_quote",
  propose_send_quote: "send_quote",
  propose_send_contract: "send_contract",
  propose_reply_lead: "reply_lead",
  propose_message_client: "message_client",
  propose_update_client: "update_client",
  propose_job_note: "job_note",
};

export const APP8C_READ_TOOLS = new Set(["brief_me", "find", "get_quote", "open_screen"]);

// ── Pure helpers (tested in tools-app8c.test.ts) ─────────────────────────────

/** A LIKE pattern that matches `q` literally anywhere (% and _ typed by the user are not wildcards). */
export function likePattern(q: string): string {
  return `%${q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

/** The page of one thing, or of a section; null when the role can't open it. */
export function screenPath(target: "job" | "quote" | "invoice" | "client" | "contract" | "screen", id: string | undefined, screen: ScreenKey | undefined, role: TeamMemberRole): { path: string; label: string } | { error: string } {
  if (target === "screen") {
    if (!screen) return { error: "Pass screen." };
    const area = SCREEN_AREA[screen];
    if (area && !roleCan(role, area, "view")) return { error: "This person's role can't open that page." };
    return SCREENS[screen];
  }
  if (!id || !/^[\w-]{6,64}$/.test(id)) return { error: "Pass the id (see find)." };
  const base = { job: "/dashboard/jobs/", quote: "/dashboard/quotes/", invoice: "/dashboard/invoices/", client: "/dashboard/clients/", contract: "/dashboard/contracts/" }[target];
  return { path: `${base}${id}`, label: "" };
}

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
export function cleanEmail(v: string | undefined | null): string | null {
  const e = (v ?? "").trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

/** The "Rimini, 3 → 5" lines of an update_client card. */
const CLIENT_FIELD_LABEL: Record<string, string> = { email: "email", phone: "telefono", address: "indirizzo", city: "città", postalCode: "CAP", province: "provincia", businessNumber: "P. IVA", codiceFiscale: "C.F.", pec: "PEC", codiceSdi: "codice SDI" };

export function clientChanges(before: Record<string, string | null>, wanted: Record<string, string | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(wanted)) {
    if (v === undefined || v === null) continue;
    const next = v.trim();
    if (!next || (before[k] ?? "").trim() === next) continue;
    out[k] = next;
  }
  return out;
}

const QUOTE_STATUS_IT: Record<string, string> = { draft: "bozza", unlocked: "pronto", pending_payment: "in attesa di pagamento", accepted: "accettato dal cliente" };
const LEAD_STATUS_IT: Record<string, string> = { new: "nuova", contacted: "contattata", quoted: "preventivo fatto", won: "vinta", lost: "persa", unsubscribed: "disiscritta" };

/** Midnight in Italy of the day `now` falls on (Rome is UTC+1 or +2). */
export function romeMidnight(now: Date): Date {
  const day = localDay(now);
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hour12: false }).format(new Date(utcMidnight)));
  return new Date(utcMidnight - hour * 3_600_000);
}

// ── Read tools ───────────────────────────────────────────────────────────────

const ReadArgs = {
  brief_me: z.object({ scope: z.enum(["today", "week", "job"]), job_id: z.string().optional() }),
  find: z.object({ query: z.string().trim().min(2).max(120), types: z.array(z.enum(FIND_TYPES)).optional() }),
  get_quote: z.object({ quote_id: z.string().uuid() }),
  open_screen: z.object({ target: z.enum(["job", "quote", "invoice", "client", "contract", "screen"]), id: z.string().optional(), screen: z.enum(SCREEN_KEYS).optional() }),
};

type BaseRead = (name: string, args: unknown, ctx: App8cContext) => Promise<unknown>;

export async function runApp8cReadTool(name: string, rawArgs: unknown, ctx: App8cContext, baseRead: BaseRead): Promise<unknown> {
  switch (name) {
    case "brief_me": return briefMe(ReadArgs.brief_me.parse(rawArgs), ctx, baseRead);
    case "find": return find(ReadArgs.find.parse(rawArgs), ctx);
    case "get_quote": return getQuote(ReadArgs.get_quote.parse(rawArgs).quote_id, ctx);
    case "open_screen": return openScreen(ReadArgs.open_screen.parse(rawArgs), ctx);
    default: return { error: `Unknown tool ${name}` };
  }
}

async function briefMe(a: z.infer<typeof ReadArgs.brief_me>, ctx: App8cContext, baseRead: BaseRead) {
  if (a.scope === "job") {
    const [summary, risks] = await Promise.all([baseRead("get_job_summary", { job_id: a.job_id }, ctx), baseRead("get_schedule_risks", { job_id: a.job_id ?? ctx.projectId ?? undefined }, ctx)]);
    return { summary, risks };
  }
  const days = a.scope === "today" ? 1 : 7;
  const midnight = romeMidnight(ctx.now);
  const from = a.scope === "today" ? midnight : new Date(midnight.getTime() - 6 * 86_400_000);
  const to = new Date(midnight.getTime() + 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);
  const horizon = new Date(midnight.getTime() + (a.scope === "today" ? 1 : 7) * 86_400_000);
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, ctx.userId));
  const canJobs = roleCan(ctx.role, "jobs", "view");
  const [items, stats, milestones, tasks, analytics] = await Promise.all([
    needsYou(ctx.userId, ctx.role, profile, ctx.now),
    todayStats(ctx.userId, ctx.role, from, to, prevFrom, ctx.now),
    canJobs
      ? db.select({ id: milestonesTable.id, title: milestonesTable.title, status: milestonesTable.status, end: milestonesTable.plannedEnd, jobId: projectsTable.id, job: projectsTable.name })
          .from(milestonesTable).innerJoin(projectsTable, eq(projectsTable.id, milestonesTable.projectId))
          .where(and(eq(projectsTable.userId, ctx.userId), eq(projectsTable.status, "active"), inArray(milestonesTable.status, ["planned", "in_progress"]), lte(milestonesTable.plannedEnd, horizon)))
          .orderBy(asc(milestonesTable.plannedEnd)).limit(15)
      : Promise.resolve([]),
    canJobs
      ? db.select({ id: projectTasksTable.id, title: projectTasksTable.title, due: projectTasksTable.dueDate, jobId: projectsTable.id, job: projectsTable.name })
          .from(projectTasksTable).innerJoin(projectsTable, eq(projectsTable.id, projectTasksTable.projectId))
          .where(and(eq(projectsTable.userId, ctx.userId), ne(projectTasksTable.status, "done"), lte(projectTasksTable.dueDate, horizon)))
          .orderBy(asc(projectTasksTable.dueDate)).limit(15)
      : Promise.resolve([]),
    canJobs && roleCan(ctx.role, "analytics", "view") ? companyAnalytics(ctx.userId, { months: 3, now: ctx.now }).catch(() => null) : Promise.resolve(null),
  ]);
  const late = (d: Date | null) => (d && d.getTime() < midnight.getTime() ? "in ritardo" : null);
  return {
    period: a.scope === "today" ? `oggi ${localDay(ctx.now)}` : `ultimi 7 giorni e prossimi 7 (da ${localDay(from)})`,
    needs_you: items.slice(0, 12).map((i) => ({ kind: i.kind, title: i.title, detail: i.subtitle, amount: i.amountCents != null ? cents(i.amountCents) : undefined, days: i.days, hours: i.hours, page: i.href })),
    numbers: {
      quotes_created: stats.quotes ? { now: stats.quotes.current, before: stats.quotes.previous } : "not visible for this role",
      quotes_won: stats.won ? { now: stats.won.current, before: stats.won.previous, value: cents(stats.won.valueCents) } : "not visible for this role",
      collected: stats.collected ? { now: cents(stats.collected.currentCents), before: cents(stats.collected.previousCents) } : "not visible for this role",
      open_invoices_today: stats.outstanding ? { count: stats.outstanding.count, balance: cents(stats.outstanding.balanceCents), overdue: cents(stats.outstanding.overdueCents) } : "not visible for this role",
    },
    milestones_due: milestones.map((m) => ({ job: m.job, job_id: m.jobId, milestone: m.title, milestone_id: m.id, status: m.status, planned_end: toIsoDate(m.end), late: late(m.end) })),
    tasks_due: tasks.map((t) => ({ job: t.job, job_id: t.jobId, task: t.title, due: toIsoDate(t.due), late: late(t.due) })),
    jobs_at_risk: analytics ? analytics.jobs.risks.slice(0, 6).map((r) => ({ job: r.name, job_id: r.id, flags: r.flags })) : [],
  };
}

async function find(a: z.infer<typeof ReadArgs.find>, ctx: App8cContext) {
  const pat = likePattern(a.query);
  const want = new Set(a.types?.length ? a.types : FIND_TYPES);
  const ilike = (col: SQL | unknown) => sql`${col} ilike ${pat}`;
  const tasks: Promise<unknown[]>[] = [];
  const out: Record<string, unknown[]> = {};
  const add = (key: string, p: Promise<unknown[]>) => tasks.push(p.then((rows) => { if (rows.length) out[key] = rows; return rows; }));

  if (want.has("client")) {
    add("clients", db.select({
      id: clientsTable.id, name: clientsTable.name, email: clientsTable.email, phone: clientsTable.phone, address: clientsTable.address, city: clientsTable.city,
      page: sql<string>`md5(concat_ws('|', lower(trim(${clientsTable.name})), coalesce(lower(trim(${clientsTable.email})), ''), coalesce(lower(trim(${clientsTable.phone})), '')))`,
    }).from(clientsTable).where(and(eq(clientsTable.userId, ctx.userId), or(ilike(clientsTable.name), ilike(clientsTable.email), ilike(clientsTable.phone), ilike(clientsTable.address), ilike(clientsTable.city)))).limit(6)
      .then((rows) => rows.map((r) => ({ type: "client", id: r.id, name: r.name, email: r.email, phone: r.phone, address: [r.address, r.city].filter(Boolean).join(", ") || null, page: `/dashboard/clients/${r.page}` }))));
  }
  if (want.has("job") && roleCan(ctx.role, "jobs", "view")) {
    add("jobs", db.select({ id: projectsTable.id, name: projectsTable.name, status: projectsTable.status, address: projectsTable.address, progress: projectsTable.progressPercent })
      .from(projectsTable).where(and(eq(projectsTable.userId, ctx.userId), or(ilike(projectsTable.name), ilike(projectsTable.address)))).orderBy(desc(projectsTable.createdAt)).limit(6)
      .then((rows) => rows.map((r) => ({ type: "job", id: r.id, name: r.name, status: r.status, address: r.address, progress_percent: r.progress, page: `/dashboard/jobs/${r.id}` }))));
  }
  if (want.has("quote")) {
    add("quotes", db.select({ id: quotesTable.id, numero: quotesTable.numeroPreventivoData, client: quotesTable.clientData, totale: quotesTable.totale, status: quotesTable.status, title: quotesTable.titoloPreventivoRiga1, createdAt: quotesTable.createdAt })
      .from(quotesTable).where(and(eq(quotesTable.userId, ctx.userId), isNull(quotesTable.archivedAt), or(ilike(quotesTable.numeroPreventivoData), sql`${quotesTable.clientData}->>'nome' ilike ${pat}`, sql`${quotesTable.clientData}->>'email' ilike ${pat}`, sql`${quotesTable.clientData}->>'indirizzo' ilike ${pat}`, ilike(quotesTable.titoloPreventivoRiga1), ilike(quotesTable.descrizioneGenerale))))
      .orderBy(desc(quotesTable.createdAt)).limit(6)
      .then((rows) => rows.map((r) => ({ type: "quote", id: r.id, number: r.numero, client: (r.client as QuoteClientData | null)?.nome || null, title: r.title, total_incl_vat: money(Number(r.totale)), status: QUOTE_STATUS_IT[r.status] ?? r.status, created: toIsoDate(r.createdAt), page: `/dashboard/quotes/${r.id}` }))));
  }
  if (want.has("invoice")) {
    add("invoices", db.select({ id: invoicesTable.id, number: invoicesTable.number, customer: invoicesTable.customer, total: invoicesTable.totalCents, status: invoicesTable.status, due: invoicesTable.dueDate })
      .from(invoicesTable).where(and(eq(invoicesTable.userId, ctx.userId), or(ilike(invoicesTable.number), sql`${invoicesTable.customer}->>'name' ilike ${pat}`, sql`${invoicesTable.customer}->>'email' ilike ${pat}`)))
      .orderBy(desc(invoicesTable.issueDate)).limit(6)
      .then((rows) => rows.map((r) => ({ type: "invoice", id: r.id, number: r.number, customer: r.customer?.name ?? null, total: cents(r.total), status: r.status, due: toIsoDate(r.due), page: `/dashboard/invoices/${r.id}` }))));
  }
  if (want.has("lead") && roleCan(ctx.role, "leads", "view")) {
    add("leads", db.select({ id: leadsTable.id, name: leadsTable.name, email: leadsTable.email, phone: leadsTable.phone, status: leadsTable.status, channel: leadsTable.preferredChannel, stage: leadsTable.followUpStage, unsubscribed: leadsTable.unsubscribedAt })
      .from(leadsTable).where(and(eq(leadsTable.userId, ctx.userId), or(ilike(leadsTable.name), ilike(leadsTable.email), ilike(leadsTable.phone)))).orderBy(desc(leadsTable.createdAt)).limit(6)
      .then((rows) => rows.map((r) => ({ type: "lead", id: r.id, name: r.name, email: r.email, phone: r.phone, status: LEAD_STATUS_IT[r.status] ?? r.status, channel: r.channel, messages_sent: r.stage, unsubscribed: Boolean(r.unsubscribed), page: "/dashboard/leads" }))));
  }
  if (want.has("contract") && roleCan(ctx.role, "contracts", "view")) {
    add("contracts", db.select({ id: contractsTable.id, number: contractsTable.contractNumber, status: contractsTable.status, kind: contractsTable.kind, variables: contractsTable.variables, value: contractsTable.contractValueCents })
      .from(contractsTable).where(and(eq(contractsTable.userId, ctx.userId), isNull(contractsTable.archivedAt), or(ilike(contractsTable.contractNumber), sql`${contractsTable.variables}->'customer'->>'name' ilike ${pat}`, sql`${contractsTable.variables}->>'projectTitle' ilike ${pat}`)))
      .orderBy(desc(contractsTable.createdAt)).limit(6)
      .then((rows) => rows.map((r) => ({ type: "contract", id: r.id, number: r.number, kind: r.kind, customer: r.variables?.customer?.name ?? null, title: r.variables?.projectTitle ?? null, value: cents(r.value), status: r.status, page: `/dashboard/contracts/${r.id}` }))));
  }
  if (want.has("supplier") && roleCan(ctx.role, "jobs", "view")) {
    add("suppliers", db.select({ id: suppliersTable.id, name: suppliersTable.name, category: suppliersTable.category, info: suppliersTable.contactInfo, email: suppliersTable.email, phone: suppliersTable.phone })
      .from(suppliersTable).where(and(eq(suppliersTable.userId, ctx.userId), or(ilike(suppliersTable.name), ilike(suppliersTable.category), ilike(suppliersTable.contactInfo), ilike(suppliersTable.email), ilike(suppliersTable.phone)))).limit(6)
      .then((rows) => rows.map((r) => ({ type: "supplier", id: r.id, name: r.name, trade: r.category || null, referente_and_notes: r.info || null, email: r.email, phone: r.phone, page: "/dashboard/team?tab=suppliers" }))));
  }
  await Promise.all(tasks);
  return Object.keys(out).length ? out : { results: [], note: `Nothing matches "${a.query}". Try a shorter part of the name.` };
}

async function getQuote(id: string, ctx: App8cContext) {
  const [q] = await db.select().from(quotesTable).where(and(eq(quotesTable.id, id), eq(quotesTable.userId, ctx.userId)));
  if (!q) return { error: "Quote not found (use find)." };
  const [variants, contracts, jobs] = await Promise.all([
    db.select({ id: quoteVariantsTable.id, label: quoteVariantsTable.label, totale: quoteVariantsTable.totale }).from(quoteVariantsTable).where(eq(quoteVariantsTable.quoteId, q.id)),
    db.select({ id: contractsTable.id, number: contractsTable.contractNumber, status: contractsTable.status }).from(contractsTable).where(and(eq(contractsTable.quoteId, q.id), eq(contractsTable.userId, ctx.userId))),
    db.select({ id: projectsTable.id, name: projectsTable.name, status: projectsTable.status }).from(projectsTable).where(and(eq(projectsTable.quoteId, q.id), eq(projectsTable.userId, ctx.userId))),
  ]);
  const c = (q.clientData ?? {}) as QuoteClientData;
  const chapters = (Array.isArray(q.capitoli) ? q.capitoli : []) as QuoteChapter[];
  return {
    id: q.id,
    number: q.numeroPreventivoData,
    title: [q.titoloPreventivoRiga1, q.titoloPreventivoRiga2].filter(Boolean).join(" — ") || null,
    status: QUOTE_STATUS_IT[q.status] ?? q.status,
    archived: Boolean(q.archivedAt),
    client: { name: c.nome || null, email: c.email || null, phone: c.phone || null, address: [c.indirizzo, c.city, c.province].filter(Boolean).join(", ") || null },
    description: q.descrizioneGenerale?.slice(0, 600) ?? null,
    chapters: chapters.slice(0, 12).map((ch) => ({ letter: ch.lettera, title: ch.titolo, subtotal: money(ch.subtotale), items: ch.voci.slice(0, 15).map((v) => ({ description: v.descrizione.slice(0, 160), unit: v.um, quantity: v.quantita, unit_price: money(v.prezzoUnitario), total: money(v.totale) })), more_items: Math.max(0, ch.voci.length - 15) })),
    more_chapters: Math.max(0, chapters.length - 12),
    discount: q.sconto ? { percent: (q.sconto as { percentuale: number }).percentuale } : null,
    subtotal_pre_vat: money(Number(q.subtotale)),
    vat_percent: Number(q.ivaPercentuale),
    vat: money(Number(q.ivaValore)),
    total_incl_vat: money(Number(q.totale)),
    payment_terms: q.condizioniPagamento ?? [],
    created: toIsoDate(q.createdAt),
    sent: toIsoDate(q.sentAt),
    reminders_sent: q.followUpStage,
    accepted: q.acceptedAt ? { on: toIsoDate(q.acceptedAt), by: q.acceptedByName } : null,
    variants: variants.map((v) => ({ id: v.id, label: v.label, total: money(Number(v.totale)) })),
    contracts: contracts.map((k) => ({ id: k.id, number: k.number, status: k.status })),
    jobs: jobs.map((j) => ({ id: j.id, name: j.name, status: j.status })),
    page: `/dashboard/quotes/${q.id}`,
  };
}

async function openScreen(raw: z.infer<typeof ReadArgs.open_screen>, ctx: App8cContext) {
  // "target: invoice, screen: invoices" with no id means the section.
  const a = raw.target !== "screen" && !raw.id && raw.screen ? { ...raw, target: "screen" as const } : raw;
  const target = screenPath(a.target, a.id, a.screen, ctx.role);
  if ("error" in target) return target;
  if (a.target === "screen") return { navigate: target.path, label: target.label };
  const id = a.id!;
  // Only the company's own things: a crafted id opens nothing.
  const own = async (): Promise<string | null> => {
    const uuidOk = z.string().uuid().safeParse(id).success;
    switch (a.target) {
      case "job": return uuidOk ? (await db.select({ n: projectsTable.name }).from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, ctx.userId))))[0]?.n ?? null : null;
      case "quote": {
        if (!uuidOk) return null;
        const [r] = await db.select({ n: quotesTable.numeroPreventivoData }).from(quotesTable).where(and(eq(quotesTable.id, id), eq(quotesTable.userId, ctx.userId)));
        return r ? (r.n ?? "") : null;
      }
      case "invoice": return uuidOk ? (await db.select({ n: invoicesTable.number }).from(invoicesTable).where(and(eq(invoicesTable.id, id), eq(invoicesTable.userId, ctx.userId))))[0]?.n ?? null : null;
      case "contract": return uuidOk ? (await db.select({ n: contractsTable.contractNumber }).from(contractsTable).where(and(eq(contractsTable.id, id), eq(contractsTable.userId, ctx.userId))))[0]?.n ?? null : null;
      case "client": {
        // A client record id (from find) opens the client's page, keyed like /dashboard/clients.
        if (!uuidOk) return null;
        const [r] = await db.select({ name: clientsTable.name, page: sql<string>`md5(concat_ws('|', lower(trim(${clientsTable.name})), coalesce(lower(trim(${clientsTable.email})), ''), coalesce(lower(trim(${clientsTable.phone})), '')))` }).from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, ctx.userId)));
        if (!r) return null;
        return `${r.name}\u0000${r.page}`;
      }
      default: return null;
    }
  };
  const found = await own();
  if (found === null) return { error: `No ${a.target} with that id in this company (use find).` };
  if (a.target === "client") {
    const [name, page] = found.split("\u0000");
    return { navigate: `/dashboard/clients/${page}`, label: name };
  }
  return { navigate: target.path, label: found || "" };
}

// ── Proposals ────────────────────────────────────────────────────────────────

type App8cValidated = { kind: ProposalKind; projectId: string | null; summary: string; payload: Record<string, unknown> };
type Result = { ok: true; proposal: App8cValidated } | { ok: false; error: string };

const ProposeArgs = {
  propose_draft_quote: z.object({ description: z.string().trim().min(10).max(4000), client_name: z.string().trim().max(200).optional(), client_address: z.string().trim().max(300).optional(), client_email: z.string().trim().max(254).optional(), client_phone: z.string().trim().max(40).optional() }),
  propose_send_quote: z.object({ quote_id: z.string().uuid(), to_email: z.string().trim().max(254).optional() }),
  propose_send_contract: z.object({ contract_id: z.string().uuid(), message: z.string().max(1000).optional() }),
  propose_reply_lead: z.object({ lead_id: z.string().uuid() }),
  propose_message_client: z.object({ to_email: z.string().trim().max(254), name: z.string().trim().max(200).optional(), subject: z.string().trim().min(2).max(150), body: z.string().trim().min(5).max(4000) }),
  propose_update_client: z.object({ client_id: z.string().uuid(), email: z.string().max(254).optional(), phone: z.string().max(40).optional(), address: z.string().max(300).optional(), city: z.string().max(120).optional(), postal_code: z.string().max(10).optional(), province: z.string().max(40).optional(), partita_iva: z.string().max(20).optional(), codice_fiscale: z.string().max(20).optional(), pec: z.string().max(254).optional(), codice_sdi: z.string().max(7).optional() }),
  propose_job_note: z.object({ job_id: z.string().optional(), text: z.string().trim().min(1).max(4000) }),
};

/** Whether an address is already one of the company's contacts (a client, a quote, a lead, an invoice). */
async function isKnownContact(userId: string, email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const r = await db.execute<{ known: boolean }>(sql`select (
    exists(select 1 from ${clientsTable} where ${clientsTable.userId} = ${userId} and lower(${clientsTable.email}) = ${e})
    or exists(select 1 from ${quotesTable} where ${quotesTable.userId} = ${userId} and lower(${quotesTable.clientData}->>'email') = ${e})
    or exists(select 1 from ${leadsTable} where ${leadsTable.userId} = ${userId} and lower(${leadsTable.email}) = ${e})
    or exists(select 1 from ${invoicesTable} where ${invoicesTable.userId} = ${userId} and lower(${invoicesTable.customer}->>'email') = ${e})
  ) as known`);
  return Boolean(r.rows[0]?.known);
}

async function resolveJob(ctx: App8cContext, jobId?: string) {
  const id = jobId || ctx.projectId;
  if (!id || !z.string().uuid().safeParse(id).success) return null;
  const [p] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, ctx.userId)));
  return p ?? null;
}

export async function validateApp8cProposal(name: string, rawArgs: unknown, ctx: App8cContext): Promise<Result> {
  const { quoteQuotaExceeded, sendUnlockNote, loadContract, getTrialStatus } = await services();
  switch (name) {
    case "propose_draft_quote": {
      const a = ProposeArgs.propose_draft_quote.parse(rawArgs);
      const quota = await quoteQuotaExceeded(ctx.userId, ctx.now);
      if (quota) return { ok: false, error: "The plan's monthly quota of quotes is used up; the user can upgrade from Abbonamento." };
      const email = a.client_email ? cleanEmail(a.client_email) : null;
      if (a.client_email && !email) return { ok: false, error: "client_email is not a valid address." };
      const client = a.client_name ? ` per ${a.client_name}` : "";
      const short = a.description.length > 90 ? `${a.description.slice(0, 90)}…` : a.description;
      return { ok: true, proposal: { kind: "draft_quote", projectId: null, summary: `Bozza di preventivo${client}: "${short}"`, payload: { rawInput: a.description, clientName: a.client_name ?? "", clientAddress: a.client_address ?? "", clientEmail: email ?? "", clientPhone: a.client_phone ?? "" } } };
    }
    case "propose_send_quote": {
      const a = ProposeArgs.propose_send_quote.parse(rawArgs);
      const [q] = await db.select().from(quotesTable).where(and(eq(quotesTable.id, a.quote_id), eq(quotesTable.userId, ctx.userId)));
      if (!q) return { ok: false, error: "Quote not found (use find)." };
      if (q.archivedAt) return { ok: false, error: "That quote is archived; restore it from the Archivio first." };
      const c = (q.clientData ?? {}) as QuoteClientData;
      const to = a.to_email ? cleanEmail(a.to_email) : cleanEmail(c.email);
      if (a.to_email && !to) return { ok: false, error: "to_email is not a valid address." };
      if (!to) return { ok: false, error: "The quote has no client email. Ask the user for the address, then pass to_email." };
      const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, ctx.userId));
      const unlock = sendUnlockNote(q, profile);
      if (unlock === "trial" && !getTrialStatus(profile ?? null).isTrialActive) return { ok: false, error: "The quote is still locked and the free trial is over: the user must unlock it (or subscribe) before it can be sent." };
      const known = await isKnownContact(ctx.userId, to);
      const who = c.nome ? `${c.nome} ` : "";
      return { ok: true, proposal: { kind: "send_quote", projectId: null, summary: `Invia il preventivo ${q.numeroPreventivoData || q.id.slice(0, 8)} (${money(Number(q.totale))}) a ${who}<${to}> per email`, payload: { ...voiceFacts(Number(q.totale) * 100, q.numeroPreventivoData, c.nome), quoteId: q.id, toEmail: to, clientName: c.nome ?? "", newAddress: !known, unlock, followUps: q.status !== "accepted" } } };
    }
    case "propose_send_contract": {
      const a = ProposeArgs.propose_send_contract.parse(rawArgs);
      const loaded = await loadContract(a.contract_id);
      if (!loaded || loaded.contract.userId !== ctx.userId) return { ok: false, error: "Contract not found (use find)." };
      const { contract, signers } = loaded;
      if (!["draft", "sent", "viewed"].includes(contract.status)) return { ok: false, error: `Contract ${contract.contractNumber} is ${contract.status}; it cannot be sent.` };
      const contractor = signers.find((s) => s.role === "contractor");
      if (!contractor || contractor.status !== "signed") return { ok: false, error: `The company has not signed contract ${contract.contractNumber} yet: the user signs it on its page first.` };
      const to = cleanEmail(contract.variables.customer.email || signers.find((s) => s.role === "customer")?.email);
      if (!to) return { ok: false, error: "The contract has no customer email: the user adds it on the contract page (or update the client first)." };
      const again = contract.status === "draft" ? "" : "di nuovo ";
      return { ok: true, proposal: { kind: "send_contract", projectId: contract.projectId, summary: `Invia ${again}il contratto ${contract.contractNumber} (${cents(contract.contractValueCents)}) a ${contract.variables.customer.name} <${to}> da firmare`, payload: { contractId: contract.id, toEmail: to, message: a.message ?? "", ...voiceFacts(contract.contractValueCents, contract.contractNumber, contract.variables.customer.name) } } };
    }
    case "propose_reply_lead": {
      const a = ProposeArgs.propose_reply_lead.parse(rawArgs);
      const [lead] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, a.lead_id), eq(leadsTable.userId, ctx.userId)));
      if (!lead) return { ok: false, error: "Lead not found (use find)." };
      if (lead.unsubscribedAt) return { ok: false, error: `${lead.name} unsubscribed: no more messages can be sent.` };
      if (lead.status === "won" || lead.status === "lost") return { ok: false, error: `This lead is already ${LEAD_STATUS_IT[lead.status]}.` };
      if (lead.preferredChannel === "email" && !cleanEmail(lead.email)) return { ok: false, error: `${lead.name} has no email address.` };
      const channel = lead.preferredChannel === "whatsapp" ? "WhatsApp (o email se WhatsApp non è attivo)" : "email";
      return { ok: true, proposal: { kind: "reply_lead", projectId: null, summary: `Manda a ${lead.name} il messaggio di ricontatto n. ${lead.followUpStage + 1} per ${channel}`, payload: { leadId: lead.id, stage: lead.followUpStage, recipientName: lead.name } } };
    }
    case "propose_message_client": {
      const a = ProposeArgs.propose_message_client.parse(rawArgs);
      const to = cleanEmail(a.to_email);
      if (!to) return { ok: false, error: "to_email is not a valid address." };
      if (!(await isKnownContact(ctx.userId, to))) return { ok: false, error: "That address is not one of the company's contacts. Only existing clients or leads can be written to: add the email to the client first (propose_update_client) or ask the user." };
      const [unsub] = await db.select({ id: leadsTable.id }).from(leadsTable).where(and(eq(leadsTable.userId, ctx.userId), sql`lower(${leadsTable.email}) = ${to}`, sql`${leadsTable.unsubscribedAt} is not null`)).limit(1);
      if (unsub) return { ok: false, error: "This person unsubscribed from the company's messages: do not write to them." };
      return { ok: true, proposal: { kind: "message_client", projectId: null, summary: `Email a ${a.name ? `${a.name} ` : ""}<${to}>: "${a.subject}"`, payload: { toEmail: to, name: a.name ?? "", subject: a.subject, body: a.body } } };
    }
    case "propose_update_client": {
      const a = ProposeArgs.propose_update_client.parse(rawArgs);
      const [c] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, a.client_id), eq(clientsTable.userId, ctx.userId)));
      if (!c) return { ok: false, error: "Client not found (use find with type client)." };
      if (a.email !== undefined && a.email.trim() && !cleanEmail(a.email)) return { ok: false, error: "email is not a valid address." };
      if (a.pec !== undefined && a.pec.trim() && !cleanEmail(a.pec)) return { ok: false, error: "pec is not a valid address." };
      if (a.codice_sdi && !/^[A-Za-z0-9]{6,7}$/.test(a.codice_sdi.trim())) return { ok: false, error: "codice_sdi has 7 characters (6 for public bodies)." };
      const province = a.province ? normalizeProvince(a.province) : undefined;
      if (a.province && !province) return { ok: false, error: "province must be an Italian province (sigla, e.g. MI)." };
      const before = { email: c.email, phone: c.phone, address: c.address, city: c.city, postalCode: c.postalCode, province: c.province, businessNumber: c.businessNumber, codiceFiscale: c.codiceFiscale, pec: c.pec, codiceSdi: c.codiceSdi };
      const changes = clientChanges(before, {
        email: a.email ? cleanEmail(a.email) : undefined, phone: a.phone, address: a.address, city: a.city, postalCode: a.postal_code, province: province ?? undefined,
        businessNumber: a.partita_iva?.replace(/\s/g, ""), codiceFiscale: a.codice_fiscale?.replace(/\s/g, "").toUpperCase(), pec: a.pec ? cleanEmail(a.pec) : undefined, codiceSdi: a.codice_sdi?.trim().toUpperCase(),
      });
      if (!Object.keys(changes).length) return { ok: false, error: "Nothing to change: the client already has these details." };
      if (changes.email !== undefined || changes.phone !== undefined) {
        const key = clientDedupKey({ name: c.name, email: changes.email ?? c.email, phone: changes.phone ?? c.phone });
        const [clash] = await db.select({ id: clientsTable.id }).from(clientsTable).where(and(eq(clientsTable.userId, ctx.userId), eq(clientsTable.dedupKey, key), ne(clientsTable.id, c.id)));
        if (clash) return { ok: false, error: "Another client record already has this name with these contacts; the user should merge them from the Clienti page." };
      }
      const open = await db.select({ id: quotesTable.id, clientData: quotesTable.clientData }).from(quotesTable).where(and(eq(quotesTable.userId, ctx.userId), eq(quotesTable.clientId, c.id), inArray(quotesTable.status, ["draft", "unlocked", "pending_payment"]))).limit(50);
      const lines = Object.entries(changes).map(([k, v]) => `${CLIENT_FIELD_LABEL[k] ?? k} ${v}`);
      return { ok: true, proposal: { kind: "update_client", projectId: null, summary: `Aggiorna ${c.name}: ${lines.join(", ")}`, payload: { clientId: c.id, changes, before: Object.fromEntries(Object.keys(changes).map((k) => [k, before[k as keyof typeof before] ?? null])), quotesBefore: open.map((q) => ({ id: q.id, clientData: q.clientData })) } } };
    }
    case "propose_job_note": {
      const a = ProposeArgs.propose_job_note.parse(rawArgs);
      if (!(await jobNotesReady())) return { ok: false, error: "Job notes are not active yet for this company." };
      const p = await resolveJob(ctx, a.job_id);
      if (!p) return { ok: false, error: "Job not found — pass job_id (see find)." };
      const short = a.text.length > 90 ? `${a.text.slice(0, 90)}…` : a.text;
      return { ok: true, proposal: { kind: "job_note", projectId: p.id, summary: `Nota su ${p.name}: "${short}"`, payload: { projectId: p.id, body: a.text } } };
    }
    default:
      return { ok: false, error: `Unknown tool ${name}` };
  }
}

