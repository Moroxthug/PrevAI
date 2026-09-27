import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { and, eq, isNull, lte, ne, sql } from "drizzle-orm";
import {
  db,
  accountDeletionsTable,
  authSessionsTable,
  businessProfilesTable,
  professionistiTable,
  incarichiTable,
  type AccountDeletion,
  type AccountDeletionSummary,
} from "@workspace/db";
import { logger } from "../lib/logger.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { sendOpsAlert } from "../lib/ops.js";
import { recordSecurityAuditEvent } from "../lib/auditLog.js";
import { sendDeletionCancelledEmail, sendDeletionCompletedEmail, sendDeletionReminderEmail, sendDeletionRequestedEmail } from "../lib/emailAccount.js";

// ── APP-1c: cancellazione dell'account in autonomia (docs/APP-PLAN.md §5) ────
// Apple 5.1.1(v) la vuole dentro l'app, il GDPR (art. 17) la vuole comunque.
//
// 1. Richiesta (Impostazioni → Il tuo accesso → Elimina account, con password):
//    riga `in_attesa` con scadenza a 30 giorni, abbonamenti Stripe in disdetta
//    a fine periodo (niente più rinnovi), altre sessioni chiuse, email con il
//    link per annullare. L'account resta usabile: serve per scaricare i
//    documenti e per cambiare idea.
// 2. Annullamento: la riga diventa `annullata`, i rinnovi Stripe tornano.
// 3. Cancellazione (cron quotidiano, alla scadenza): abbonamenti chiusi
//    subito, ogni riga con `user_id` = persona cancellata tranne i documenti
//    che la legge ci fa conservare, file nello storage, accesso. Promemoria
//    7 giorni prima.
// 4. Fine conservazione (cron, dopo 10 anni): via anche i documenti trattenuti.
//
// Senza la migrazione 0010 tutto è inerte: `deletionAvailable()` è falso,
// l'API lo dice e la pagina rimanda a privacy@prevai.it; il cron salta.

export const GRACE_DAYS = 30;
export const REMINDER_DAYS_BEFORE = 7;
export const RETENTION_YEARS = 10;
const DAY = 24 * 3_600_000;

/**
 * Tabelle che la legge ci fa tenere (art. 2220 c.c. e norme fiscali: 10 anni).
 * Si cancellano solo le righe che non sono documenti: contratti mai firmati,
 * fatture in bozza, fatture elettroniche mai trasmesse. I figli (firmatari,
 * eventi, pagamenti) seguono il documento per cascata.
 */
export const RETAINED_TABLES = ["contracts", "invoices", "invoice_payments", "e_invoices", "e_invoice_events", "supplier_e_invoices"] as const;

/** Cartelle dello storage per persona/impresa: `<cartella>/<userId>/…`. */
export const RETAINED_STORAGE = ["contracts", "invoices", "sdi"] as const;
export const DELETED_STORAGE = ["logos", "receipts", "documents", "quietanze", "imports", "job-photos", "quote-pdfs", "capitolato-pdfs", "commercialista"] as const;

/** Postgres "relation does not exist": la migrazione 0010 non è ancora stata eseguita. */
function missingTable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

export async function deletionAvailable(): Promise<boolean> {
  try {
    await db.select({ id: accountDeletionsTable.id }).from(accountDeletionsTable).limit(1);
    return true;
  } catch (err) {
    if (missingTable(err)) return false;
    throw err;
  }
}

export const emailHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const settingsUrl = () => `${getBaseUrl()}/dashboard/settings/access`;

export async function pendingDeletionFor(subjectUserId: string): Promise<AccountDeletion | null> {
  const [row] = await db
    .select()
    .from(accountDeletionsTable)
    .where(and(eq(accountDeletionsTable.subjectUserId, subjectUserId), eq(accountDeletionsTable.stato, "in_attesa")));
  return row ?? null;
}

/**
 * Chi non può cancellarsi da solo: un commercialista con incarichi di altre
 * imprese (le pratiche sono delle imprese, non sue). Lo segue il supporto.
 */
export async function deletionBlocker(subjectUserId: string): Promise<string | null> {
  const [prof] = await db.select({ id: professionistiTable.id }).from(professionistiTable).where(eq(professionistiTable.userId, subjectUserId));
  if (!prof) return null;
  const [incarico] = await db
    .select({ id: incarichiTable.id })
    .from(incarichiTable)
    .where(and(eq(incarichiTable.professionistaId, prof.id), ne(incarichiTable.userId, subjectUserId)))
    .limit(1);
  return incarico
    ? "Segui pratiche di altre imprese come commercialista: per cancellare l'account scrivi a privacy@prevai.it, così passiamo le pratiche a un collega."
    : null;
}

// ── Stripe ───────────────────────────────────────────────────────────────────

const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);

async function stripeClient(): Promise<Stripe | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const { getUncachableStripeClient } = await import("../stripeClient.js");
  return getUncachableStripeClient();
}

/** Piano e add-on smettono di rinnovarsi. Ritorna gli abbonamenti toccati (per poterli ripristinare). */
async function stopRenewals(customerId: string | null): Promise<{ ids: string[]; error?: string }> {
  if (!customerId) return { ids: [] };
  try {
    const stripe = await stripeClient();
    if (!stripe) return { ids: [], error: "STRIPE_SECRET_KEY non impostata" };
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
    const ids: string[] = [];
    for (const s of subs.data) {
      if (!LIVE_STATUSES.has(s.status) || s.cancel_at_period_end) continue;
      await stripe.subscriptions.update(s.id, { cancel_at_period_end: true });
      ids.push(s.id);
    }
    return { ids };
  } catch (err) {
    logger.error({ err, customerId }, "Account deletion: could not stop Stripe renewals");
    return { ids: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function resumeRenewals(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const stripe = await stripeClient();
    if (!stripe) return;
    for (const id of ids) {
      const s = await stripe.subscriptions.retrieve(id);
      if (LIVE_STATUSES.has(s.status) && s.cancel_at_period_end) await stripe.subscriptions.update(id, { cancel_at_period_end: false });
    }
  } catch (err) {
    logger.error({ err, ids }, "Account deletion cancelled: could not resume Stripe renewals");
    await sendOpsAlert("Cancellazione annullata: rinnovi Stripe da ripristinare a mano", [`Abbonamenti: ${ids.join(", ")}`, err instanceof Error ? err.message : String(err)]);
  }
}

/** Alla cancellazione: ogni abbonamento ancora vivo si chiude subito. Il cliente Stripe resta (fatture di PrevAI, 10 anni). */
async function cancelSubscriptionsNow(customerId: string | null): Promise<AccountDeletionSummary["stripe"]> {
  if (!customerId) return { cancelled: [] };
  const stripe = await stripeClient();
  if (!stripe) return { cancelled: [], error: "STRIPE_SECRET_KEY non impostata" };
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  const cancelled: string[] = [];
  for (const s of subs.data) {
    if (!LIVE_STATUSES.has(s.status)) continue;
    await stripe.subscriptions.cancel(s.id);
    cancelled.push(s.id);
  }
  return { cancelled };
}

// ── Richiesta e annullamento ────────────────────────────────────────────────

export async function requestDeletion(p: {
  subjectUserId: string;
  email: string;
  name: string;
  keepSessionId: string | null;
  reason?: string | null;
  now?: Date;
}): Promise<AccountDeletion> {
  const now = p.now ?? new Date();
  const [profile] = await db
    .select({ stripeCustomerId: businessProfilesTable.stripeCustomerId })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, p.subjectUserId));
  const ownsOrg = Boolean(profile);
  const customerId = profile?.stripeCustomerId ?? null;
  const renewals = await stopRenewals(customerId);
  if (renewals.error && customerId) {
    await sendOpsAlert("Cancellazione account: rinnovi Stripe non fermati", [
      `Persona ${p.subjectUserId}, cliente Stripe ${customerId}.`,
      renewals.error,
      "La cancellazione chiude comunque gli abbonamenti alla scadenza dei 30 giorni; se prima c'è un rinnovo, rimborsarlo (RUNBOOKS §13).",
    ]);
  }

  const [row] = await db
    .insert(accountDeletionsTable)
    .values({
      subjectUserId: p.subjectUserId,
      ownsOrg,
      email: p.email,
      emailHash: emailHash(p.email),
      reason: p.reason?.trim().slice(0, 500) || null,
      requestedAt: now,
      scheduledFor: new Date(now.getTime() + GRACE_DAYS * DAY),
      stripeSubscriptions: renewals.ids,
      stripeCustomerId: customerId,
    })
    .returning();

  // Chi ha chiesto la cancellazione resta dentro su questo dispositivo; gli
  // altri dispositivi escono (se non era lui, lo scopre dall'email).
  if (p.keepSessionId) {
    await db.delete(authSessionsTable).where(and(eq(authSessionsTable.userId, p.subjectUserId), ne(authSessionsTable.id, p.keepSessionId)));
  }
  await recordSecurityAuditEvent({ orgId: p.subjectUserId, actorUserId: p.subjectUserId, action: "account.deletion_requested", entityType: "account", entityId: row!.id });
  await sendDeletionRequestedEmail({ to: p.email, name: p.name, scheduledFor: row!.scheduledFor, ownsOrg, cancelUrl: settingsUrl() });
  return row!;
}

export async function cancelDeletion(p: { subjectUserId: string; name: string; now?: Date }): Promise<AccountDeletion | null> {
  const [row] = await db
    .update(accountDeletionsTable)
    .set({ stato: "annullata", cancelledAt: p.now ?? new Date() })
    .where(and(eq(accountDeletionsTable.subjectUserId, p.subjectUserId), eq(accountDeletionsTable.stato, "in_attesa")))
    .returning();
  if (!row) return null;
  await resumeRenewals(row.stripeSubscriptions);
  await recordSecurityAuditEvent({ orgId: p.subjectUserId, actorUserId: p.subjectUserId, action: "account.deletion_cancelled", entityType: "account", entityId: row.id });
  if (row.email) await sendDeletionCancelledEmail({ to: row.email, name: p.name });
  return row;
}

// ── Cancellazione vera ──────────────────────────────────────────────────────

type Exec = Pick<typeof db, "execute">;
const count = (r: { rowCount?: number | null }) => r.rowCount ?? 0;

async function tablesWithUserId(tx: Exec): Promise<string[]> {
  const rows = await tx.execute<{ table_name: string }>(sql`
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'user_id'
    order by table_name
  `);
  return rows.rows.map((r) => r.table_name);
}

/**
 * Cancella dal database tutto ciò che ha `user_id` = persona, tranne i
 * documenti da conservare. Una sola transazione: o tutto o niente, e il cron
 * riprova domani. L'ordine delle tabelle non è noto (qualche FK senza
 * cascata, es. incarichi → professionisti), quindi ogni DELETE sta in un
 * savepoint e chi fallisce riprova al giro dopo.
 */
export async function purgeDatabase(subjectUserId: string): Promise<Pick<AccountDeletionSummary, "deleted" | "retained">> {
  return db.transaction(async (tx) => {
    const deleted: Record<string, number> = {};
    const retained: Record<string, number> = {};
    const add = (k: string, n: number) => { if (n) deleted[k] = (deleted[k] ?? 0) + n; };

    // 1. Nei documenti da conservare, via solo ciò che non è un documento.
    add("e_invoices", count(await tx.execute(sql`delete from e_invoices where user_id = ${subjectUserId} and stato = 'bozza'`)));
    add("invoices", count(await tx.execute(sql`delete from invoices where user_id = ${subjectUserId} and status = 'draft' and not exists (select 1 from e_invoices e where e.invoice_id = invoices.id)`)));
    add("contracts", count(await tx.execute(sql`delete from contracts where user_id = ${subjectUserId} and status <> 'signed'`)));

    // 2. Tutto il resto con user_id.
    const retainedSet = new Set<string>(RETAINED_TABLES);
    const pending = new Set((await tablesWithUserId(tx)).filter((t) => !retainedSet.has(t)));
    let lastError = "";
    for (let pass = 0; pass < 6 && pending.size; pass++) {
      for (const table of [...pending]) {
        try {
          const r = await tx.transaction(async (sp) => sp.execute(sql`delete from ${sql.identifier(table)} where user_id = ${subjectUserId}`));
          add(table, count(r));
          pending.delete(table);
        } catch (err) {
          lastError = `${table}: ${(err as Error).message}`;
        }
      }
    }
    if (pending.size) throw new Error(`Tabelle non svuotate: ${[...pending].join(", ")} (${lastError})`);

    // 3. La squadra: chi era nella sua impresa perde l'accesso; lui esce dalle imprese altrui.
    add("organization_members", count(await tx.execute(sql`delete from organization_members where owner_id = ${subjectUserId} or user_id = ${subjectUserId}`)));

    // 4. L'accesso (sessioni, password, 2FA e collegamenti vanno per cascata).
    add("auth_user", count(await tx.execute(sql`delete from auth_user where id = ${subjectUserId}`)));

    for (const table of RETAINED_TABLES) {
      const r = await tx.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)} where user_id = ${subjectUserId}`);
      const n = r.rows[0]?.n ?? 0;
      if (n) retained[table] = n;
    }
    return { deleted, retained };
  });
}

/** Cancella (ricorsivamente) le cartelle `<cartella>/<userId>` nei due bucket. */
export async function purgeStorage(subjectUserId: string, folders: readonly string[]): Promise<{ deleted: number; error?: string }> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { deleted: 0, error: "storage non configurato" };
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const buckets = [process.env.SUPABASE_PRIVATE_BUCKET ?? "private-assets", process.env.SUPABASE_PUBLIC_BUCKET ?? "public-assets"];
  let deleted = 0;
  const errors: string[] = [];
  for (const bucketName of buckets) {
    const bucket = supabase.storage.from(bucketName);
    const collect = async (prefix: string, depth: number, out: string[]) => {
      const { data, error } = await bucket.list(prefix, { limit: 1000 });
      if (error) throw error;
      for (const entry of data ?? []) {
        const path = `${prefix}/${entry.name}`;
        // Nelle liste di Supabase una cartella non ha id.
        if (entry.id === null && depth < 5) await collect(path, depth + 1, out);
        else out.push(path);
      }
    };
    for (const folder of folders) {
      try {
        const paths: string[] = [];
        await collect(`${folder}/${subjectUserId}`, 0, paths);
        for (let i = 0; i < paths.length; i += 500) {
          const { error } = await bucket.remove(paths.slice(i, i + 500));
          if (error) throw error;
        }
        deleted += paths.length;
      } catch (err) {
        errors.push(`${bucketName}/${folder}: ${(err as Error).message}`);
      }
    }
  }
  return errors.length ? { deleted, error: errors.join("; ") } : { deleted };
}

/** Esegue una cancellazione arrivata a scadenza. */
export async function executeDeletion(row: AccountDeletion, now = new Date()): Promise<AccountDeletionSummary> {
  const [user] = await db.execute<{ name: string }>(sql`select name from auth_user where id = ${row.subjectUserId}`).then((r) => r.rows);
  const stripe = await cancelSubscriptionsNow(row.stripeCustomerId);
  const { deleted, retained } = await purgeDatabase(row.subjectUserId);
  const storage = await purgeStorage(row.subjectUserId, DELETED_STORAGE);
  const hasRetained = Object.keys(retained).length > 0;
  const summary: AccountDeletionSummary = {
    deleted,
    retained,
    storage: { deleted: storage.deleted, retainedPrefixes: hasRetained ? [...RETAINED_STORAGE] : [], ...(storage.error ? { error: storage.error } : {}) },
    stripe,
  };
  // Se non resta nulla da conservare, vanno anche le cartelle dei documenti (bozze di PDF).
  if (!hasRetained) {
    const extra = await purgeStorage(row.subjectUserId, RETAINED_STORAGE);
    summary.storage.deleted += extra.deleted;
  }
  if (row.email) await sendDeletionCompletedEmail({ to: row.email, name: user?.name ?? "", retained: hasRetained });
  const retainUntil = hasRetained ? new Date(now.getFullYear() + RETENTION_YEARS, 11, 31, 23, 59, 59) : null;
  await db
    .update(accountDeletionsTable)
    .set({ stato: "completata", completedAt: now, email: null, summary, retainUntil, lastError: null, attempts: row.attempts + 1 })
    .where(eq(accountDeletionsTable.id, row.id));
  if (storage.error) {
    await sendOpsAlert("Cancellazione account: file non cancellati", [`Richiesta ${row.id}.`, storage.error, "Cancellare a mano da Supabase Storage (RUNBOOKS §13)."]);
  }
  return summary;
}

/** Scaduti i 10 anni: via anche contratti firmati, fatture e fatture elettroniche. */
export async function clearRetention(row: AccountDeletion, now = new Date()): Promise<number> {
  const n = await db.transaction(async (tx) => {
    let total = 0;
    for (const table of ["e_invoice_events", "e_invoices", "invoice_payments", "invoices", "supplier_e_invoices", "contracts"]) {
      total += count(await tx.execute(sql`delete from ${sql.identifier(table)} where user_id = ${row.subjectUserId}`));
    }
    return total;
  });
  await purgeStorage(row.subjectUserId, RETAINED_STORAGE);
  await db.update(accountDeletionsTable).set({ retentionClearedAt: now }).where(eq(accountDeletionsTable.id, row.id));
  return n;
}

export type EsitoCancellazioni = { skipped?: "migrazione_0010_mancante"; promemoria: number; cancellati: number; conservazioneScaduta: number; errori: number };

/** Nel tick quotidiano del cron (routes/cron.ts). Un account che fallisce non ferma gli altri. */
export async function runAccountDeletionMaintenance(now = new Date()): Promise<EsitoCancellazioni> {
  const esito: EsitoCancellazioni = { promemoria: 0, cancellati: 0, conservazioneScaduta: 0, errori: 0 };
  if (!(await deletionAvailable())) return { ...esito, skipped: "migrazione_0010_mancante" };

  const soon = new Date(now.getTime() + REMINDER_DAYS_BEFORE * DAY);
  const reminders = await db
    .select()
    .from(accountDeletionsTable)
    .where(and(eq(accountDeletionsTable.stato, "in_attesa"), isNull(accountDeletionsTable.reminderSentAt), lte(accountDeletionsTable.scheduledFor, soon)));
  for (const row of reminders) {
    if (row.scheduledFor <= now) continue; // tocca direttamente alla cancellazione
    const [user] = await db.execute<{ name: string }>(sql`select name from auth_user where id = ${row.subjectUserId}`).then((r) => r.rows);
    if (row.email) await sendDeletionReminderEmail({ to: row.email, name: user?.name ?? "", scheduledFor: row.scheduledFor, cancelUrl: settingsUrl() });
    await db.update(accountDeletionsTable).set({ reminderSentAt: now }).where(eq(accountDeletionsTable.id, row.id));
    esito.promemoria++;
  }

  const due = await db
    .select()
    .from(accountDeletionsTable)
    .where(and(eq(accountDeletionsTable.stato, "in_attesa"), lte(accountDeletionsTable.scheduledFor, now)));
  for (const row of due) {
    try {
      await executeDeletion(row, now);
      esito.cancellati++;
    } catch (err) {
      esito.errori++;
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, deletionId: row.id }, "Account deletion failed");
      // Resta in_attesa: il tick di domani riprova. Dopo 3 tentativi serve una persona.
      await db.update(accountDeletionsTable).set({ attempts: row.attempts + 1, lastError: message.slice(0, 2000) }).where(eq(accountDeletionsTable.id, row.id));
      if (row.attempts + 1 >= 3) {
        await sendOpsAlert("Cancellazione account bloccata", [`Richiesta ${row.id} (persona ${row.subjectUserId}), ${row.attempts + 1} tentativi.`, message, "Vedi docs/RUNBOOKS.md §13."]);
      }
    }
  }

  const expired = await db
    .select()
    .from(accountDeletionsTable)
    .where(and(eq(accountDeletionsTable.stato, "completata"), isNull(accountDeletionsTable.retentionClearedAt), lte(accountDeletionsTable.retainUntil, now)));
  for (const row of expired) {
    try {
      await clearRetention(row, now);
      esito.conservazioneScaduta++;
    } catch (err) {
      esito.errori++;
      logger.error({ err, deletionId: row.id }, "Retention clearing failed");
    }
  }
  return esito;
}
