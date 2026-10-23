// POCKET-5 (riga 62, QuoteAI 128.1): l'assistente d'impresa dell'app. Guarda i conti e propone (un promemoria per una
// fattura scaduta, un sollecito per un preventivo senza risposta, un ordine per ciò che sta finendo), aspetta un sì, lo
// fa, e scrive cosa ha fatto così che si possa annullare. Quanto può fare da solo sono i Permessi dell'impresa
// (assistant_settings). Le parti pure sono in companyRules.ts.
//
// In PrevAI: solo email (niente SMS); le bozze sono in italiano; l'Attività unisce le righe scritte qui (le regole
// automatiche e le proposte approvate) con quelle dell'assistente dei cantieri (assistant_actions, APP-8h), che si
// annullano dalla loro scheda e qui restano da leggere. Il Magazzino non è legato a un piano: gli ordini si propongono
// a chi ha materiali sotto scorta con un prezzo noto di un fornitore.
import { createHash } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import {
  assistantActivityTable,
  assistantProposalsTable,
  assistantSettingsTable,
  assistantSuggestionsTable,
  businessProfilesTable,
  costEntriesTable,
  db,
  hasFeature,
  inventoryItemsTable,
  invoicesTable,
  projectsTable,
  quotesTable,
  scheduleBlocksTable,
  suppliersTable,
  supplierOrdersTable,
  type ActivityUndoData,
  type AssistantActivityRow,
  type AssistantActivityUndo,
  type AssistantSuggestion,
  type BusinessProfile,
  type CompanyAssistantSettings,
  type SuggestionPayload,
} from "@workspace/db";
import { balanceCents } from "../invoices/math.js";
import { invoiceToken, logInvoiceEvent, publicInvoiceUrl, invoicePdfBuffer } from "../invoices/service.js";
import { sendInvoiceReminderEmail } from "../lib/emailInvoices.js";
import { sendQuoteFollowup } from "../lib/quoteMessaging.js";
import { publicQuoteLink } from "../quotes/publicLink.js";
import { localMidnight } from "../today/business.js";
import { latestPrice, priceSeries, stockLevel, suggestedQty, vendorMatches, type ReceiptLines } from "../materials/suppliers.js";
import { listActivity } from "./activity.js";
import { voiceMinutesIncluded, voiceMinutesUsed } from "./speech.js";
import {
  FOLLOWUP_DRAFT_DAYS,
  REMINDER_DRAFT_DAYS,
  ZONE,
  daysBetween,
  followupDraft,
  isQuiet,
  levelsOf,
  localClock,
  localDay,
  nextMonthStart,
  overLimit,
  reminderDraft,
  ruleOf,
  type Quiet,
  type Rule,
  type RuleKey,
} from "./companyRules.js";

/** PrevAI: l'assistente è del piano Elite (feature "assistant"). */
export const assistantEnabled = (profile: BusinessProfile | null | undefined): boolean => hasFeature(profile, "assistant");

// ── Permessi ─────────────────────────────────────────────────────────────────

export type PermissionsDto = { levels: ReturnType<typeof levelsOf>; spendLimitCents: number; quiet: Quiet; readBack: boolean };

export async function settingsFor(userId: string): Promise<PermissionsDto> {
  const [row] = await db.select().from(assistantSettingsTable).where(eq(assistantSettingsTable.userId, userId));
  return permissionsOf(row);
}

export function permissionsOf(row: CompanyAssistantSettings | undefined): PermissionsDto {
  return {
    levels: levelsOf(row?.levels),
    spendLimitCents: row?.spendLimitCents ?? 30000,
    quiet: { on: (row?.quietHours ?? "on") === "on", from: row?.quietFrom ?? 20 * 60, until: row?.quietUntil ?? 7 * 60, sunday: (row?.quietSunday ?? "on") === "on" },
    readBack: (row?.readBack ?? "on") === "on",
  };
}

export type PermissionsPatch = Partial<{ levels: Partial<PermissionsDto["levels"]>; spendLimitCents: number; quiet: Partial<Quiet>; readBack: boolean }>;

export async function savePermissions(userId: string, patch: PermissionsPatch): Promise<PermissionsDto> {
  const now = await settingsFor(userId);
  const next: PermissionsDto = {
    levels: { ...now.levels, ...(patch.levels ?? {}) },
    spendLimitCents: patch.spendLimitCents ?? now.spendLimitCents,
    quiet: { ...now.quiet, ...(patch.quiet ?? {}) },
    readBack: patch.readBack ?? now.readBack,
  };
  const values = {
    userId,
    levels: next.levels,
    spendLimitCents: next.spendLimitCents,
    quietHours: next.quiet.on ? "on" : "off",
    quietFrom: next.quiet.from,
    quietUntil: next.quiet.until,
    quietSunday: next.quiet.sunday ? "on" : "off",
    readBack: next.readBack ? "on" : "off",
  } as const;
  await db.insert(assistantSettingsTable).values(values).onConflictDoUpdate({ target: assistantSettingsTable.userId, set: values });
  return next;
}

/**
 * Quanto può fare da solo l'assistente per un'impresa: "ask" lo prepara per un sì, "send" lo fa e lo dice, "off" lo
 * lascia. Un'impresa senza assistente nel piano tiene ciò che le automazioni hanno sempre fatto ("send"); se la
 * tabella non c'è ancora (migrazione 0026 non eseguita) anche.
 */
export async function ruleFor(userId: string, key: RuleKey, profile?: BusinessProfile | null): Promise<Rule> {
  const p = profile ?? (await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)))[0];
  if (!assistantEnabled(p)) return "send";
  try {
    return ruleOf((await settingsFor(userId)).levels[key]);
  } catch {
    return "send";
  }
}

/** Se un messaggio automatico può partire adesso, nel giorno dell'impresa. */
export async function quietNow(userId: string, at = new Date()): Promise<boolean> {
  const { quiet } = await settingsFor(userId);
  const { day, minute } = localClock(at, ZONE);
  return isQuiet(quiet, day, minute);
}

// ── Attività ─────────────────────────────────────────────────────────────────

export type ActivityInput = {
  userId: string; kind: string; title: string; detail?: string; params?: Record<string, string | number>;
  /** Il nome di una persona, o la regola ("reminders"). */
  who: string; whoKind: "you" | "auto"; category: "msg" | "money" | "jobs";
  undo?: AssistantActivityUndo; undoData?: ActivityUndoData; word?: string; entityType?: string; entityId?: string; at?: Date;
};

export async function logActivity(a: ActivityInput): Promise<string | null> {
  try {
    const [row] = await db
      .insert(assistantActivityTable)
      .values({
        userId: a.userId, kind: a.kind, title: a.title, detail: a.detail ?? "", params: a.params ?? {}, who: a.who, whoKind: a.whoKind, category: a.category,
        undo: a.undo ?? "none", undoData: a.undoData ?? {}, word: a.word ?? "", entityType: a.entityType ?? null, entityId: a.entityId ?? null, ...(a.at ? { at: a.at } : {}),
      })
      .returning({ id: assistantActivityTable.id });
    return row?.id ?? null;
  } catch {
    // Ciò che l'assistente ha fatto non si disfa perché non si è riuscito a scriverlo.
    return null;
  }
}

export type ActivityDto = {
  id: string; at: string; kind: string; title: string; detail: string; params: Record<string, string | number>; who: string; whoKind: "you" | "auto"; category: "msg" | "money" | "jobs";
  undo: AssistantActivityUndo; word: string; undone: boolean; invoiceId: string | null;
};

const activityDto = (r: AssistantActivityRow): ActivityDto => ({
  id: r.id, at: r.at.toISOString(), kind: r.kind, title: r.title, detail: r.detail, params: r.params, who: r.who, whoKind: r.whoKind, category: r.category,
  undo: r.undo, word: r.word, undone: !!r.undoneAt, invoiceId: r.entityType === "invoice" ? r.entityId : null,
});

/** Il tipo di riga per un'azione dell'assistente dei cantieri (APP-8h). */
const JOB_KIND: Record<string, string> = { cost_entry: "cost", record_payment: "payment", invoice: "invoice", send_invoice: "invoice", task: "task", milestone_update: "job", job_note: "doc", draft_quote: "quote", send_quote: "quote", send_contract: "doc", reply_lead: "crew", message_client: "crew", update_client: "doc", call: "crew" };
const MONEY_KINDS = new Set(["cost_entry", "invoice", "send_invoice", "record_payment"]);

export type ActivityOverview = {
  today: number; todayYou: number; month: number; undoneMonth: number; voice: { used: number; included: number | null; resets: string };
  rows: ActivityDto[];
};

export async function activityOverview(userId: string, actorId: string, everyone: boolean, now = new Date()): Promise<ActivityOverview> {
  const todayKey = localDay(now, ZONE);
  const dayStart = localMidnight(todayKey, ZONE);
  const monthStart = localMidnight(`${todayKey.slice(0, 7)}-01`, ZONE);
  const since = new Date(Math.min(monthStart.getTime(), now.getTime() - 14 * 86_400_000));
  const own = await db.select().from(assistantActivityTable).where(and(eq(assistantActivityTable.userId, userId), gte(assistantActivityTable.at, since))).orderBy(desc(assistantActivityTable.at)).limit(400);
  // What the job assistant did (confirmed or by itself), as Activity rows: undone from its own card, so here without Undo (an invoice still opens).
  const jobs = await listActivity({ orgId: userId, actorId, everyone, before: null, limit: 100 }).catch((): Awaited<ReturnType<typeof listActivity>> => ({ available: false, items: [], next: null }));
  const jobRows: ActivityDto[] = jobs.items.filter((i) => new Date(i.executedAt) >= since).map((i) => ({
    id: `job:${i.id}`, at: i.executedAt, kind: JOB_KIND[i.kind] ?? "doc", title: i.summary, detail: i.label, params: {}, who: i.actor.name, whoKind: i.level === "auto" ? "auto" : "you",
    category: MONEY_KINDS.has(i.kind) ? "money" : "jobs", undo: "none", word: i.status === "undone" ? "Undone" : "", undone: i.status === "undone",
    invoiceId: i.link?.startsWith("/dashboard/invoices/") ? i.link.slice("/dashboard/invoices/".length) : null,
  }));
  const rows = [...own.map(activityDto), ...jobRows].sort((a, b) => b.at.localeCompare(a.at));
  const inMonth = rows.filter((r) => r.at >= monthStart.toISOString());
  const today = rows.filter((r) => r.at >= dayStart.toISOString());
  return {
    today: today.length,
    todayYou: today.filter((r) => r.whoKind === "you").length,
    month: inMonth.length,
    undoneMonth: inMonth.filter((r) => r.undone).length,
    voice: { used: Math.round(await voiceMinutesUsed(userId, now)), included: voiceMinutesIncluded(), resets: nextMonthStart(todayKey) },
    rows,
  };
}

/** Annulla un'azione. Restituisce la riga, o perché no. */
export async function undoActivity(userId: string, id: string): Promise<{ ok: true; row: ActivityDto; toast: string } | { ok: false; status: number; message: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, status: 404, message: "Non trovato" };
  const [row] = await db.select().from(assistantActivityTable).where(and(eq(assistantActivityTable.id, id), eq(assistantActivityTable.userId, userId)));
  if (!row) return { ok: false, status: 404, message: "Non trovato" };
  if (row.undoneAt) return { ok: false, status: 409, message: "Già annullato" };
  if (row.undo !== "undo" && row.undo !== "void") return { ok: false, status: 400, message: "Questo non si può annullare" };
  const d = row.undoData;
  let toast: string;
  if (d.entity === "cost" && d.id) {
    await db.delete(costEntriesTable).where(and(eq(costEntriesTable.id, d.id), eq(costEntriesTable.userId, userId)));
    toast = "cost";
  } else if (d.entity === "order" && d.id) {
    // Solo ciò che è ancora in lista: un ordine già fatto è del fornitore.
    const ids = d.id.split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x));
    if (ids.length) await db.delete(supplierOrdersTable).where(and(inArray(supplierOrdersTable.id, ids), eq(supplierOrdersTable.userId, userId), eq(supplierOrdersTable.status, "listed")));
    toast = "order";
  } else if (d.entity === "block" && d.id && d.was) {
    const was = JSON.parse(d.was) as { startsAt: string; endsAt: string };
    await db.update(scheduleBlocksTable).set({ startsAt: new Date(was.startsAt), endsAt: new Date(was.endsAt), reminderSentAt: null }).where(and(eq(scheduleBlocksTable.id, d.id), eq(scheduleBlocksTable.userId, userId)));
    toast = "block";
  } else {
    return { ok: false, status: 400, message: "Questo non si può annullare" };
  }
  const [after] = await db
    .update(assistantActivityTable)
    .set({ undoneAt: new Date(), word: row.undo === "void" ? "Voided" : "Undone", undo: "none" })
    .where(eq(assistantActivityTable.id, id))
    .returning();
  return { ok: true, row: activityDto(after!), toast };
}

// ── Proposte ─────────────────────────────────────────────────────────────────

export type SuggestionDto = { id: string; kind: AssistantSuggestion["kind"]; payload: SuggestionPayload; createdAt: string };
/** Una riga di «Decise di recente»: una proposta dell'assistente d'impresa, o una dell'assistente dei cantieri. */
export type DecidedDto = {
  id: string; source: "suggestion" | "job"; kind: string; status: "approved" | "dismissed" | "failed"; at: string;
  payload?: SuggestionPayload; summary?: string; project?: string | null; invoiceId?: string | null;
};

const suggestionDto = (s: AssistantSuggestion): SuggestionDto => ({ id: s.id, kind: s.kind, payload: s.payload, createdAt: s.createdAt.toISOString() });

type Candidate = { key: string; kind: AssistantSuggestion["kind"]; payload: SuggestionPayload };

const hash = (parts: string[]) => createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 10);

async function reminderCandidates(userId: string, now: Date, who: string): Promise<Candidate[]> {
  const open = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.userId, userId), inArray(invoicesTable.status, ["sent", "viewed", "partially_paid", "overdue"]), lt(invoicesTable.dueDate, now), isNull(invoicesTable.creditNoteForId)))
    .orderBy(asc(invoicesTable.dueDate))
    .limit(60);
  const out: Candidate[] = [];
  for (const inv of open) {
    const bal = balanceCents(inv);
    const late = daysBetween(inv.dueDate, now);
    const need = REMINDER_DRAFT_DAYS[inv.reminderCount];
    if (bal <= 0 || need === undefined || late < need) continue;
    const email = (inv.customer.email ?? "").trim();
    if (!email.includes("@")) continue;
    out.push({
      key: `reminder:${inv.id}:${inv.reminderCount}`,
      kind: "reminder",
      payload: {
        channel: "email", to: email, toName: inv.customer.name, language: "it", invoiceId: inv.id, number: inv.number, balanceCents: bal, daysLate: late,
        subject: `Promemoria — pro-forma ${inv.number}`,
        draft: reminderDraft({ client: inv.customer.name, number: inv.number, balanceCents: bal, due: inv.dueDate, link: publicInvoiceUrl(invoiceToken(inv)), who }),
      },
    });
  }
  return out;
}

async function followupCandidates(userId: string, now: Date, who: string): Promise<Candidate[]> {
  const cutoff = new Date(now.getTime() - FOLLOWUP_DRAFT_DAYS * 86_400_000);
  const quotes = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.userId, userId), ne(quotesTable.status, "accepted"), isNull(quotesTable.archivedAt), isNull(quotesTable.declinedAt), isNull(quotesTable.unsubscribedAt), lt(quotesTable.sentAt, cutoff), eq(quotesTable.followUpStage, 0)))
    .orderBy(desc(quotesTable.sentAt))
    .limit(40);
  const out: Candidate[] = [];
  for (const q of quotes) {
    if (!q.sentAt) continue;
    const email = (q.clientData.email ?? "").trim();
    if (!email.includes("@")) continue;
    const number = q.numeroPreventivoData || `N° ${q.id.slice(0, 4).toUpperCase()}`;
    const title = (q.titoloPreventivoRiga2 ?? "").trim();
    // The link the client would get (SEC-4): read, not reopened; a revoked link makes no suggestion.
    const link = await publicQuoteLink(q, { share: false });
    if (link.revoked) continue;
    out.push({
      key: `followup:${q.id}`,
      kind: "followup",
      payload: {
        channel: "email", to: email, toName: q.clientData.nome, language: "it", quoteId: q.id, number, totalCents: Math.round(Number(q.totale) * 100), daysSent: daysBetween(q.sentAt, now),
        subject: `Il suo preventivo ${number}`,
        draft: followupDraft({ client: q.clientData.nome, title, link: link.url ?? "", who }),
      },
    });
  }
  return out;
}

async function orderCandidates(userId: string, limitCents: number, now: Date): Promise<Candidate[]> {
  const [items, suppliers, listed, costs] = await Promise.all([
    db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.userId, userId)).orderBy(asc(inventoryItemsTable.name)),
    db.select().from(suppliersTable).where(and(eq(suppliersTable.userId, userId), isNull(suppliersTable.archivedAt))),
    db.select({ itemId: supplierOrdersTable.inventoryItemId }).from(supplierOrdersTable).where(and(eq(supplierOrdersTable.userId, userId), notInArray(supplierOrdersTable.status, ["delivered", "picked_up"]))),
    db
      .select({ supplierId: costEntriesTable.supplierId, vendor: costEntriesTable.vendor, date: costEntriesTable.date, ai: costEntriesTable.aiExtraction })
      .from(costEntriesTable)
      .where(and(eq(costEntriesTable.userId, userId), gte(costEntriesTable.date, new Date(now.getTime() - 190 * 86_400_000)), or(eq(costEntriesTable.category, "materials"), eq(costEntriesTable.category, "equipment"), eq(costEntriesTable.category, "misc"))))
      .orderBy(desc(costEntriesTable.date))
      .limit(3000),
  ]);
  if (!items.length || !suppliers.length) return [];
  const onList = new Set(listed.map((l) => l.itemId).filter(Boolean));
  const seriesBySupplier = suppliers.map((s) => {
    const mine: ReceiptLines[] = costs
      .filter((c) => c.supplierId === s.id || (!c.supplierId && vendorMatches(c.vendor, s.name)))
      .map((c) => ({ at: c.date, lines: Array.isArray(c.ai?.lines) ? c.ai!.lines.map((l) => ({ description: String(l.description ?? ""), unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : null })) : [] }));
    return { supplier: s, series: priceSeries(mine) };
  });
  type Line = NonNullable<SuggestionPayload["lines"]>[number];
  const bySupplier = new Map<string, { name: string; lines: Line[] }>();
  for (const i of items) {
    if (onList.has(i.id)) continue;
    const stock = { shopQty: Number(i.shopQty), truckQty: Number(i.truckQty), sites: i.sites ?? [], reserved: i.reserved ?? [], par: Number(i.par) };
    if (stockLevel(stock) === "ok") continue;
    // Il fornitore più conveniente che ha un prezzo; senza un prezzo noto non si propone niente.
    const best = seriesBySupplier
      .map(({ supplier, series }) => ({ supplier, p: latestPrice(series, i.name) }))
      .filter((x) => x.p)
      .sort((a, b) => a.p!.price - b.p!.price)[0];
    if (!best) continue;
    const cur = bySupplier.get(best.supplier.id) ?? { name: best.supplier.name, lines: [] };
    cur.lines.push({ itemId: i.id, name: i.name, unit: i.unit, qty: suggestedQty(stock), unitPriceCents: Math.round(best.p!.price * 100) });
    bySupplier.set(best.supplier.id, cur);
  }
  return [...bySupplier.entries()].map(([supplierId, v]) => {
    const total = v.lines.reduce((n, l) => n + Math.round(l.qty * (l.unitPriceCents ?? 0)), 0);
    return {
      key: `order:${supplierId}:${hash(v.lines.map((l) => `${l.itemId}:${l.qty}`).sort())}`,
      kind: "order" as const,
      payload: { supplierId, supplierName: v.name, lines: v.lines, totalCents: total, destination: "Shop", overLimit: overLimit(total, limitCents) },
    };
  });
}

/**
 * Guarda i conti e fa le proposte dovute, una volta ciascuna. Una proposta il cui motivo è sparito (la fattura è stata
 * pagata) si toglie mentre aspetta. Ciò che un'impresa ha spento, o lascia fare da solo, non si propone.
 */
export async function refreshSuggestions(userId: string, who: string, now = new Date()): Promise<void> {
  const perm = await settingsFor(userId);
  const wanted: Candidate[] = [];
  if (ruleOf(perm.levels.reminders) === "ask") wanted.push(...(await reminderCandidates(userId, now, who)));
  if (ruleOf(perm.levels.followups) === "ask") wanted.push(...(await followupCandidates(userId, now, who)));
  wanted.push(...(await orderCandidates(userId, perm.spendLimitCents, now)));
  const keys = new Set(wanted.map((w) => w.key));
  const pending = await db.select().from(assistantSuggestionsTable).where(and(eq(assistantSuggestionsTable.userId, userId), eq(assistantSuggestionsTable.status, "pending")));
  const gone = pending.filter((p) => p.kind !== "move" && !keys.has(p.key)).map((p) => p.id);
  if (gone.length) await db.delete(assistantSuggestionsTable).where(inArray(assistantSuggestionsTable.id, gone));
  if (wanted.length) await db.insert(assistantSuggestionsTable).values(wanted.map((w) => ({ userId, key: w.key, kind: w.kind, payload: w.payload }))).onConflictDoNothing();
}

export async function proposalsOverview(userId: string, who: string): Promise<{ pending: SuggestionDto[]; recent: DecidedDto[]; spendLimitCents: number }> {
  await refreshSuggestions(userId, who);
  const rows = await db.select().from(assistantSuggestionsTable).where(eq(assistantSuggestionsTable.userId, userId)).orderBy(desc(assistantSuggestionsTable.createdAt)).limit(80);
  const pending = rows.filter((r) => r.status === "pending");
  const decided: DecidedDto[] = rows
    .filter((r) => r.status !== "pending")
    .map((r) => ({ id: r.id, source: "suggestion" as const, kind: r.kind, status: r.status as "approved" | "dismissed" | "failed", payload: r.payload, at: (r.decidedAt ?? r.createdAt).toISOString() }));
  const jobRows = await db
    .select({ p: assistantProposalsTable, project: projectsTable.name })
    .from(assistantProposalsTable)
    .leftJoin(projectsTable, eq(projectsTable.id, assistantProposalsTable.projectId))
    .where(and(eq(assistantProposalsTable.userId, userId), inArray(assistantProposalsTable.status, ["confirmed", "dismissed", "failed"])))
    .orderBy(desc(assistantProposalsTable.resolvedAt))
    .limit(8);
  for (const { p, project } of jobRows) {
    decided.push({
      id: p.id, source: "job", kind: p.kind, status: p.status === "confirmed" ? "approved" : p.status === "dismissed" ? "dismissed" : "failed", at: (p.resolvedAt ?? p.createdAt).toISOString(),
      summary: p.summary, project, invoiceId: p.resultEntityType === "invoice" ? p.resultEntityId : null,
    });
  }
  decided.sort((a, b) => b.at.localeCompare(a.at));
  return { pending: pending.map(suggestionDto), recent: decided.slice(0, 6), spendLimitCents: (await settingsFor(userId)).spendLimitCents };
}

export class SuggestionError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/**
 * Fa ciò che dice una proposta, una volta. `draft` sostituisce il testo che la persona ha corretto. Un errore la lascia
 * in attesa, con cosa è andato storto, così si può riprovare. Restituisce la riga d'Attività che dice cosa è stato fatto.
 */
export async function approveSuggestion(args: { userId: string; id: string; actorName: string; profile: BusinessProfile; draft?: string; ip?: string }): Promise<{ suggestion: SuggestionDto; activityId: string | null }> {
  const { userId, id, actorName, profile } = args;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new SuggestionError(404, "NOT_FOUND", "Non trovata");
  const [s] = await db.select().from(assistantSuggestionsTable).where(and(eq(assistantSuggestionsTable.id, id), eq(assistantSuggestionsTable.userId, userId)));
  if (!s) throw new SuggestionError(404, "NOT_FOUND", "Non trovata");
  if (s.status !== "pending") throw new SuggestionError(409, "DECIDED", "È già stata decisa.");
  const p = { ...s.payload };
  if (args.draft !== undefined && (s.kind === "reminder" || s.kind === "followup")) p.draft = args.draft.trim().slice(0, 2000);
  const who = actorName || "Tu";
  const fail = async (message: string, code = "SEND_FAILED", status = 502): Promise<never> => {
    await db.update(assistantSuggestionsTable).set({ error: message }).where(eq(assistantSuggestionsTable.id, id));
    throw new SuggestionError(status, code, message);
  };
  let activityId: string | null = null;

  if (s.kind === "reminder") {
    const text = (p.draft ?? "").trim();
    if (!text || !p.invoiceId) return fail("Il messaggio è vuoto.", "EMPTY", 400);
    const [inv] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, p.invoiceId), eq(invoicesTable.userId, userId)));
    if (!inv) return fail("Quella fattura non c'è più.", "GONE", 404);
    try {
      const { buffer } = await invoicePdfBuffer(inv.id);
      await sendInvoiceReminderEmail({
        toEmail: p.to ?? inv.customer.email ?? "", userId, customerName: inv.customer.name, companyName: inv.contractor.name, number: inv.number, totalCents: inv.totalCents, balanceCents: balanceCents(inv),
        dueDate: inv.dueDate, publicUrl: publicInvoiceUrl(invoiceToken(inv)), language: "it", iban: inv.paymentInstructions.iban ?? null, daysOverdue: daysBetween(inv.dueDate, new Date()), pdfBuffer: buffer, replyTo: profile.email ?? null, message: text,
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : "L'email non è partita.");
    }
    await db.update(invoicesTable).set({ reminderCount: sql`${invoicesTable.reminderCount} + 1`, lastReminderAt: new Date() }).where(and(eq(invoicesTable.id, inv.id), eq(invoicesTable.userId, userId)));
    await logInvoiceEvent({ invoiceId: inv.id, type: "reminder_sent", actor: "contractor", detail: { via: "assistant", channel: "email" }, ip: args.ip });
    activityId = await logActivity({
      userId, kind: "reminder", title: `Promemoria a ${p.toName ?? ""} per ${p.number ?? ""}`, detail: "Email", params: { client: p.toName ?? "", number: p.number ?? "", channel: "email", amount: p.balanceCents ?? 0 },
      who, whoKind: "you", category: "msg", word: "Sent", entityType: "invoice", entityId: inv.id,
    });
  } else if (s.kind === "followup") {
    const text = (p.draft ?? "").trim();
    if (!text || !p.quoteId) return fail("Il messaggio è vuoto.", "EMPTY", 400);
    const [quote] = await db.select().from(quotesTable).where(and(eq(quotesTable.id, p.quoteId), eq(quotesTable.userId, userId)));
    if (!quote) return fail("Quel preventivo non c'è più.", "GONE", 404);
    if (quote.unsubscribedAt) return fail("Il cliente non vuole più solleciti.", "UNSUBSCRIBED", 409);
    const r = await sendQuoteFollowup({ quote, profile, stage: quote.followUpStage, text });
    if (!r.ok) return fail(r.reason === "link_revoked" ? "Il link del preventivo è stato ritirato." : `L'email non è partita (${r.reason}).`);
    // Un sollecito, poi la sequenza è finita: l'ha deciso la persona.
    await db.update(quotesTable).set({ followUpStage: sql`${quotesTable.followUpStage} + 1`, nextFollowUpAt: null }).where(and(eq(quotesTable.id, quote.id), eq(quotesTable.userId, userId)));
    activityId = await logActivity({
      userId, kind: "followup", title: `Sollecito a ${p.toName ?? ""} per ${p.number ?? ""}`, detail: "Email", params: { client: p.toName ?? "", number: p.number ?? "", channel: "email", amount: p.totalCents ?? 0 },
      who, whoKind: "you", category: "msg", word: "Sent", entityType: "quote", entityId: quote.id,
    });
  } else if (s.kind === "order") {
    const lines = p.lines ?? [];
    if (!lines.length || !p.supplierId) return fail("In quest'ordine non c'è niente.", "EMPTY", 400);
    const made = await db
      .insert(supplierOrdersTable)
      .values(lines.map((l) => ({ userId, supplierId: p.supplierId!, inventoryItemId: l.itemId, itemName: l.name, unit: l.unit, qty: String(l.qty), unitPriceCents: l.unitPriceCents, destination: p.destination ?? "Shop", status: "listed" as const })))
      .returning({ id: supplierOrdersTable.id });
    activityId = await logActivity({
      userId, kind: "order", title: `${lines.length === 1 ? "Aggiunto 1 articolo" : `Aggiunti ${lines.length} articoli`} alla lista d'ordine di ${p.supplierName ?? "fornitore"}`, detail: lines.map((l) => `${l.qty} × ${l.name}`).join(", "),
      params: { supplier: p.supplierName ?? "", count: lines.length, items: lines.map((l) => `${l.qty} × ${l.name}`).join(", ") },
      who, whoKind: "you", category: "money", undo: "undo", undoData: { entity: "order", id: made.map((m) => m.id).join(",") }, word: "", entityType: "supplier", entityId: p.supplierId,
    });
  } else if (s.kind === "move") {
    if (!p.blockId || !p.moveTo) return fail("Non c'è niente da spostare.", "EMPTY", 400);
    const [b] = await db.select().from(scheduleBlocksTable).where(and(eq(scheduleBlocksTable.id, p.blockId), eq(scheduleBlocksTable.userId, userId)));
    if (!b) return fail("Quella visita non c'è più.", "GONE", 404);
    const shift = new Date(p.moveTo).getTime() - b.startsAt.getTime();
    await db.update(scheduleBlocksTable).set({ startsAt: new Date(b.startsAt.getTime() + shift), endsAt: new Date(b.endsAt.getTime() + shift), reminderSentAt: null }).where(eq(scheduleBlocksTable.id, b.id));
    activityId = await logActivity({
      userId, kind: "move", title: `Spostato ${p.blockTitle ?? p.jobName ?? "una visita"}`, detail: p.jobName ?? "", params: { job: p.jobName ?? "", title: p.blockTitle ?? "" }, who, whoKind: "you", category: "jobs", undo: "undo",
      undoData: { entity: "block", id: b.id, was: JSON.stringify({ startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString() }) }, entityType: "block", entityId: b.id,
    });
  }
  const [done] = await db.update(assistantSuggestionsTable).set({ status: "approved", payload: p, decidedBy: who, decidedAt: new Date(), error: null }).where(eq(assistantSuggestionsTable.id, id)).returning();
  return { suggestion: suggestionDto(done!), activityId };
}

export async function dismissSuggestion(userId: string, id: string, actorName: string): Promise<SuggestionDto> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new SuggestionError(404, "NOT_FOUND", "Non trovata");
  const [s] = await db
    .update(assistantSuggestionsTable)
    .set({ status: "dismissed", decidedBy: actorName, decidedAt: new Date() })
    .where(and(eq(assistantSuggestionsTable.id, id), eq(assistantSuggestionsTable.userId, userId), eq(assistantSuggestionsTable.status, "pending")))
    .returning();
  if (!s) throw new SuggestionError(404, "NOT_FOUND", "Non trovata");
  return suggestionDto(s);
}

/** Rimette una proposta scartata (l'Annulla dopo Scarta). Una approvata è fatta: si annulla dall'Attività. */
export async function restoreSuggestion(userId: string, id: string): Promise<SuggestionDto> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new SuggestionError(404, "NOT_FOUND", "Non trovata");
  const [s] = await db
    .update(assistantSuggestionsTable)
    .set({ status: "pending", decidedBy: null, decidedAt: null })
    .where(and(eq(assistantSuggestionsTable.id, id), eq(assistantSuggestionsTable.userId, userId), eq(assistantSuggestionsTable.status, "dismissed")))
    .returning();
  if (!s) throw new SuggestionError(404, "NOT_FOUND", "Non trovata");
  return suggestionDto(s);
}
