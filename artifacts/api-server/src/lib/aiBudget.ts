// SEC-2 (riga 43) — tetto mensile ai costi IA per impresa (lib/config tetto-ia.ts).
//
// La spesa del mese è la somma di usage_events di tipo IA (centesimi di
// dollaro). Si rilegge al massimo ogni 30 secondi per impresa e istanza, e
// ogni chiamata registrata qui la aggiunge subito al conto in memoria, quindi
// nel caso peggiore il tetto si supera di qualche chiamata, non di migliaia.
//
// - requireAiBudget: middleware per le rotte autenticate che chiamano l'IA
//   (dopo requireAuth) → 429 AI_BUDGET sopra il tetto.
// - aiBudgetExceeded: per il widget pubblico, che sopra il tetto salva la
//   richiesta senza stima invece di rifiutarla.
// - runAiBudgetAlerts: cron giornaliero, avvisa lo staff il giorno in cui
//   un'impresa passa l'80 % del tetto.
import type { Request, Response, NextFunction } from "express";
import { db, businessProfilesTable, usageEventsTable, effectivePlan } from "@workspace/db";
import { MESSAGGIO_TETTO_IA, TETTO_IA_AVVISO_QUOTA, monthStartUtc, statoTettoIa, tettoIaEurCents, type StatoTettoIa } from "@workspace/config";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { tableReady } from "../assistant/ready.js";
import { logger } from "./logger.js";
import { sendOpsAlert } from "./ops.js";

/** Tipi di usage_events che sono costi di modelli IA. */
export const AI_USAGE_KINDS = ["ai_text", "ai_vision", "ai_speech"] as const;

const CACHE_MS = 30_000;
type Entry = { month: number; spentUsdCents: number; capEurCents: number | null; at: number };
const cache = new Map<string, Entry>();

async function spentUsdCents(orgId: string, from: Date, until?: Date): Promise<number> {
  const r = await db
    .select({ cents: sql<string>`coalesce(sum(${usageEventsTable.quantity} * ${usageEventsTable.unitCostCents}), 0)` })
    .from(usageEventsTable)
    .where(and(eq(usageEventsTable.userId, orgId), inArray(usageEventsTable.kind, [...AI_USAGE_KINDS]), gte(usageEventsTable.createdAt, from), ...(until ? [lt(usageEventsTable.createdAt, until)] : [])));
  return Number(r[0]?.cents ?? 0);
}

/** undefined = nessuna riga (vale il piano), null = nessun tetto, numero = tetto deciso dallo staff. */
async function overrideCap(orgId: string): Promise<number | null | undefined> {
  if (!(await tableReady("ai_budgets"))) return undefined;
  const r = await db.execute<{ cap: number | null }>(sql`select monthly_cap_eur_cents as cap from ai_budgets where user_id = ${orgId}`);
  return r.rows.length ? (r.rows[0]!.cap === null ? null : Number(r.rows[0]!.cap)) : undefined;
}

async function capFor(orgId: string): Promise<number | null> {
  const [profile] = await db
    .select({ subscriptionPlan: businessProfilesTable.subscriptionPlan, subscriptionStatus: businessProfilesTable.subscriptionStatus })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, orgId));
  return tettoIaEurCents(effectivePlan(profile), await overrideCap(orgId));
}

export async function aiBudgetState(orgId: string, now = new Date()): Promise<StatoTettoIa> {
  const month = monthStartUtc(now).getTime();
  let e = cache.get(orgId);
  if (!e || e.month !== month || Date.now() - e.at > CACHE_MS) {
    const [spent, cap] = await Promise.all([spentUsdCents(orgId, new Date(month)), capFor(orgId)]);
    e = { month, spentUsdCents: spent, capEurCents: cap, at: Date.now() };
    cache.set(orgId, e);
  }
  return statoTettoIa(e.spentUsdCents, e.capEurCents);
}

/** Rilegge al prossimo controllo (test, e dopo che lo staff ha cambiato ai_budgets da uno script). */
export function forgetAiBudget(orgId?: string): void {
  if (orgId) cache.delete(orgId);
  else cache.clear();
}

/** Chiamato da recordUsageEvent: la spesa appena registrata conta subito, senza aspettare la rilettura. */
export function noteAiSpend(orgId: string, usdCents: number): void {
  const e = cache.get(orgId);
  if (e && e.month === monthStartUtc(new Date()).getTime()) e.spentUsdCents += usdCents;
}

/** true = sopra il tetto. Se il conto non si riesce a fare, non si blocca nessuno. */
export async function aiBudgetExceeded(orgId: string): Promise<boolean> {
  try {
    const s = await aiBudgetState(orgId);
    if (s.superato) logger.warn({ orgId, spesaEurCents: s.spesaEurCents, tettoEurCents: s.tettoEurCents }, "Monthly AI cap reached");
    return s.superato;
  } catch (err) {
    logger.warn({ err, orgId }, "AI budget check failed, allowing the call");
    return false;
  }
}

// Same shape as a rate-limit block: the app's fetch helpers show `error` or `message` as they are.
const AI_BUDGET_ERROR = { error: MESSAGGIO_TETTO_IA, message: MESSAGGIO_TETTO_IA, code: "AI_BUDGET" } as const;

/** Dopo requireAuth: sopra il tetto del mese le rotte con l'IA rispondono 429 AI_BUDGET. */
export async function requireAiBudget(_req: Request, res: Response, next: NextFunction): Promise<void> {
  const orgId = res.locals.userId as string | undefined;
  if (orgId && (await aiBudgetExceeded(orgId))) {
    res.status(429).json(AI_BUDGET_ERROR);
    return;
  }
  next();
}

/**
 * Cron: le imprese che da ieri a oggi hanno passato l'80 % del tetto del mese
 * (ieri sotto, oggi sopra) → un avviso allo staff. Nessuna tabella per
 * ricordarlo, come per i costi dell'assistente.
 */
export async function runAiBudgetAlerts(now = new Date()): Promise<{ companies: number; alerted: number }> {
  const from = monthStartUtc(now);
  const yesterday = new Date(now.getTime() - 24 * 3_600_000);
  const rows = await db
    .select({ userId: usageEventsTable.userId })
    .from(usageEventsTable)
    .where(and(inArray(usageEventsTable.kind, [...AI_USAGE_KINDS]), gte(usageEventsTable.createdAt, yesterday > from ? yesterday : from)))
    .groupBy(usageEventsTable.userId);
  const crossed: { orgId: string; today: StatoTettoIa }[] = [];
  for (const { userId } of rows) {
    const cap = await capFor(userId);
    if (cap === null) continue;
    const today = statoTettoIa(await spentUsdCents(userId, from), cap);
    const before = yesterday > from ? statoTettoIa(await spentUsdCents(userId, from, yesterday), cap) : null;
    if (today.avviso && !before?.avviso) crossed.push({ orgId: userId, today });
  }
  if (crossed.length) {
    const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
    await sendOpsAlert(`IA: ${crossed.length} impresa/e oltre l'${Math.round(TETTO_IA_AVVISO_QUOTA * 100)} % del tetto mensile`, [
      `Dal ${from.toISOString().slice(0, 10)}:`,
      "",
      ...crossed.map(({ orgId, today: t }) => `- ${orgId}: ${eur(t.spesaEurCents)} su ${eur(t.tettoEurCents ?? 0)}${t.superato ? " — BLOCCATA fino al primo del mese" : ""}`),
      "",
      "Alzare il tetto a una sola impresa: tabella ai_budgets (docs/RUNBOOKS.md §26).",
    ]);
  }
  return { companies: rows.length, alerted: crossed.length };
}
