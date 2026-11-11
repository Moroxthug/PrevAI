// EMAIL-2: campaigns to PrevAI's own users — compose, test, send in batches.
//
// Sending model (Vercel functions live ≤ 60 s, cron runs twice a day):
//  1. start → the audience is frozen into email_campaign_recipients (one row
//     per person, unique per campaign, so nobody gets it twice).
//  2. process → claims up to 100 queued rows (FOR UPDATE SKIP LOCKED, so the
//     admin page and the cron can never claim the same row), sends them with
//     one Resend batch call, marks them sent/failed. Repeats until the time
//     budget runs out. The admin page calls it again until nothing is left;
//     the daily cron finishes any campaign left half-way.
//  3. A batch that dies mid-call leaves rows 'in_corso'. After 15 minutes
//     they become 'fallita' (never re-sent: we can't know whether Resend
//     delivered them, and a double email is worse than a missing one).

import { z } from "zod/v4";
import { db, emailCampaignsTable, emailCampaignRecipientsTable, marketingPreferencesTable, settingsTable, type EmailCampaign } from "@workspace/db";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import { MARKET } from "@workspace/config";
import { resendOrThrow } from "../lib/emailUtils.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { logger } from "../lib/logger.js";
import { buildCampaignEmail, campaignHeaders, type CampaignContent } from "../lib/emailCampaign.js";
import { audienceMembers, isAudienceId, type AudienceId } from "./audiences.js";

export const CAMPAIGN_FROM = `${MARKET.brand} <novita@${MARKET.domain}>`;
export const SENDER_IDENTITY_KEY = "campaign_sender_identity";
const BATCH = 100;
const STALE_MS = 15 * 60_000;
const PAUSE_MS = 600; // Resend: 2 requests/second per team by default

export class CampaignError extends Error {
  constructor(public code: "NOT_FOUND" | "NOT_DRAFT" | "NO_TEST" | "NO_IDENTITY" | "INVALID" | "EMPTY_AUDIENCE", message: string) {
    super(message);
  }
}

// ── Content validation ──────────────────────────────────────────────────────

const tone = z.enum(["brand", "success", "warning", "danger", "info"]);
const url = z.string().url().max(2000).refine((u) => /^https:\/\//.test(u), "Solo link https");
const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1).max(5000) }),
  z.object({ type: z.literal("heading"), text: z.string().min(1).max(200) }),
  z.object({ type: z.literal("image"), src: url, alt: z.string().max(200), href: url.optional() }),
  z.object({ type: z.literal("checklist"), items: z.array(z.string().min(1).max(300)).min(1).max(12) }),
  z.object({ type: z.literal("features"), items: z.array(z.object({ title: z.string().min(1).max(80), text: z.string().max(300) })).min(1).max(8) }),
  z.object({ type: z.literal("callout"), text: z.string().min(1).max(1000), tone: tone.optional() }),
  z.object({ type: z.literal("quote"), text: z.string().min(1).max(1000), author: z.string().max(100).optional() }),
  z.object({ type: z.literal("button"), label: z.string().min(1).max(60), href: url, variant: z.enum(["primary", "dark", "ghost"]).optional() }),
  z.object({ type: z.literal("divider") }),
]);
export const campaignContentSchema = z.object({
  subject: z.string().min(1).max(150),
  preheader: z.string().max(200).default(""),
  eyebrow: z.object({ text: z.string().min(1).max(40), tone: tone.optional() }).optional(),
  heading: z.string().min(1).max(150),
  lead: z.string().max(500).optional(),
  blocks: z.array(block).max(30),
  cta: z.object({ label: z.string().min(1).max(60), href: url }).optional(),
});

export const campaignInputSchema = z.object({
  name: z.string().min(1).max(120),
  audience: z.string().refine(isAudienceId, "Pubblico sconosciuto"),
  content: campaignContentSchema,
});
export type CampaignInput = z.infer<typeof campaignInputSchema>;

// ── Settings and tokens ─────────────────────────────────────────────────────

export async function getSenderIdentity(): Promise<string | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, SENDER_IDENTITY_KEY));
  return row?.value.trim() || null;
}

export function unsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/public/prevai/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Makes sure each user has a preferences row (and so a token); returns userId → token / unsubscribed. */
export async function preferencesFor(userIds: string[]): Promise<Map<string, { token: string; unsubscribed: boolean }>> {
  const out = new Map<string, { token: string; unsubscribed: boolean }>();
  if (userIds.length === 0) return out;
  await db.insert(marketingPreferencesTable).values(userIds.map((userId) => ({ userId }))).onConflictDoNothing();
  const rows = await db.select().from(marketingPreferencesTable).where(inArray(marketingPreferencesTable.userId, userIds));
  for (const r of rows) out.set(r.userId, { token: r.unsubscribeToken, unsubscribed: !!r.unsubscribedAt });
  return out;
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listCampaigns(): Promise<EmailCampaign[]> {
  return db.select().from(emailCampaignsTable).orderBy(desc(emailCampaignsTable.createdAt)).limit(100);
}

export async function getCampaign(id: string): Promise<EmailCampaign> {
  const [c] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id));
  if (!c) throw new CampaignError("NOT_FOUND", "Campagna non trovata.");
  return c;
}

export async function createCampaign(input: CampaignInput, createdBy: string | null): Promise<EmailCampaign> {
  const [c] = await db
    .insert(emailCampaignsTable)
    .values({ name: input.name, subject: input.content.subject, audience: input.audience, content: input.content as unknown as Record<string, unknown>, createdBy })
    .returning();
  return c!;
}

export async function updateCampaign(id: string, input: CampaignInput): Promise<EmailCampaign> {
  const c = await getCampaign(id);
  if (c.status !== "bozza") throw new CampaignError("NOT_DRAFT", "Si può modificare solo una bozza.");
  const [u] = await db
    .update(emailCampaignsTable)
    // Any edit invalidates the test: the owner must look at what will really go out.
    .set({ name: input.name, subject: input.content.subject, audience: input.audience, content: input.content as unknown as Record<string, unknown>, testSentAt: null, updatedAt: new Date() })
    .where(eq(emailCampaignsTable.id, id))
    .returning();
  return u!;
}

export async function deleteCampaign(id: string): Promise<void> {
  const c = await getCampaign(id);
  if (c.status !== "bozza") throw new CampaignError("NOT_DRAFT", "Si può eliminare solo una bozza.");
  await db.delete(emailCampaignsTable).where(eq(emailCampaignsTable.id, id));
}

// ── Rendering ───────────────────────────────────────────────────────────────

export function renderCampaign(c: Pick<EmailCampaign, "id" | "content">, opts: { firstName?: string | null; token: string; senderIdentity: string | null }): string {
  const content = c.content as unknown as CampaignContent;
  return buildCampaignEmail({ ...content, firstName: opts.firstName ?? null }, { unsubscribeUrl: unsubscribeUrl(opts.token), campaignId: c.id, senderIdentity: opts.senderIdentity });
}

export function firstName(name: string | null | undefined): string | null {
  const f = (name ?? "").trim().split(/\s+/)[0] ?? "";
  // "mario.rossi@…" style placeholders and very long strings are not names.
  return f && f.length <= 30 && !/[@\d]/.test(f) ? f.charAt(0).toUpperCase() + f.slice(1) : null;
}

// ── Test send ───────────────────────────────────────────────────────────────

export async function sendTest(id: string, to: string[], adminUserId: string, adminName: string): Promise<void> {
  const c = await getCampaign(id);
  const identity = await getSenderIdentity();
  const prefs = await preferencesFor([adminUserId]);
  const html = renderCampaign(c, { firstName: firstName(adminName), token: prefs.get(adminUserId)!.token, senderIdentity: identity ?? "⚠ Manca l'identità del mittente (ragione sociale e sede): impostala prima di inviare." });
  const { error } = await resendOrThrow().emails.send({ from: CAMPAIGN_FROM, to: to.slice(0, 5), replyTo: MARKET.supportEmail, subject: `[PROVA] ${c.subject}`, html });
  if (error) throw new Error(error.message);
  await db.update(emailCampaignsTable).set({ testSentAt: new Date() }).where(eq(emailCampaignsTable.id, id));
}

// ── Start + process ─────────────────────────────────────────────────────────

export async function startCampaign(id: string): Promise<EmailCampaign> {
  const c = await getCampaign(id);
  if (c.status !== "bozza") throw new CampaignError("NOT_DRAFT", "Questa campagna è già partita.");
  if (!c.testSentAt) throw new CampaignError("NO_TEST", "Prima manda una prova a te stesso e controllala.");
  if (!(await getSenderIdentity())) throw new CampaignError("NO_IDENTITY", "Manca l'identità del mittente (ragione sociale, sede, P.IVA): è obbligatoria nelle email promozionali.");
  if (!isAudienceId(c.audience)) throw new CampaignError("INVALID", "Pubblico sconosciuto.");

  const members = await audienceMembers(c.audience as AudienceId);
  if (members.length === 0) throw new CampaignError("EMPTY_AUDIENCE", "Nessun destinatario in questo pubblico.");

  // Claim the campaign first, so two clicks can't start it twice.
  const [claimed] = await db
    .update(emailCampaignsTable)
    .set({ status: "in_invio", startedAt: new Date(), recipientsTotal: members.length, updatedAt: new Date() })
    .where(and(eq(emailCampaignsTable.id, id), eq(emailCampaignsTable.status, "bozza")))
    .returning();
  if (!claimed) throw new CampaignError("NOT_DRAFT", "Questa campagna è già partita.");

  for (let i = 0; i < members.length; i += 500) {
    const chunk = members.slice(i, i + 500);
    await db
      .insert(emailCampaignRecipientsTable)
      .values(chunk.map((m) => ({ campaignId: id, userId: m.userId, email: m.email, firstName: firstName(m.name) })))
      .onConflictDoNothing();
  }
  logger.info({ campaignId: id, recipients: members.length }, "Campaign started");
  return claimed;
}

export async function cancelCampaign(id: string): Promise<void> {
  await db.update(emailCampaignsTable).set({ status: "annullata", finishedAt: new Date(), updatedAt: new Date() }).where(and(eq(emailCampaignsTable.id, id), inArray(emailCampaignsTable.status, ["bozza", "in_invio"])));
  await db.update(emailCampaignRecipientsTable).set({ status: "saltata", error: "campagna annullata" }).where(and(eq(emailCampaignRecipientsTable.campaignId, id), eq(emailCampaignRecipientsTable.status, "in_coda")));
}

type Claimed = { id: string; userId: string; email: string; firstName: string | null };

async function claimBatch(campaignId: string): Promise<Claimed[]> {
  const res = await db.execute(sql`
    update email_campaign_recipients set status = 'in_corso', claimed_at = now()
    where id in (
      select id from email_campaign_recipients
      where campaign_id = ${campaignId} and status = 'in_coda'
      order by created_at, id
      limit ${BATCH}
      for update skip locked
    )
    returning id, user_id as "userId", email, first_name as "firstName"`);
  return res.rows as Claimed[];
}

async function refreshCounters(campaignId: string): Promise<{ queued: number }> {
  const res = await db.execute(sql`
    select
      count(*) filter (where status = 'inviata')::int as sent,
      count(*) filter (where status = 'fallita')::int as failed,
      count(*) filter (where status in ('in_coda', 'in_corso'))::int as queued
    from email_campaign_recipients where campaign_id = ${campaignId}`);
  const r = res.rows[0] as { sent: number; failed: number; queued: number };
  const done = r.queued === 0;
  await db
    .update(emailCampaignsTable)
    .set({ sentCount: r.sent, failedCount: r.failed, updatedAt: new Date(), ...(done ? { status: "inviata" as const, finishedAt: new Date() } : {}) })
    .where(and(eq(emailCampaignsTable.id, campaignId), eq(emailCampaignsTable.status, "in_invio")));
  return { queued: r.queued };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends queued rows until the queue is empty or `budgetMs` is spent. */
export async function processCampaign(campaignId: string, budgetMs = 40_000): Promise<{ sentNow: number; failedNow: number; remaining: number }> {
  const deadline = Date.now() + budgetMs;
  const c = await getCampaign(campaignId);
  if (c.status !== "in_invio") return { sentNow: 0, failedNow: 0, remaining: 0 };

  await db
    .update(emailCampaignRecipientsTable)
    .set({ status: "fallita", error: "invio interrotto (non ripetuto per evitare doppioni)" })
    .where(and(eq(emailCampaignRecipientsTable.campaignId, campaignId), eq(emailCampaignRecipientsTable.status, "in_corso"), sql`claimed_at < now() - ${sql.raw(`interval '${STALE_MS / 1000} seconds'`)}`));

  const identity = await getSenderIdentity();
  const resend = resendOrThrow();
  let sentNow = 0;
  let failedNow = 0;

  while (Date.now() < deadline) {
    // Stopped from the admin page in the meantime?
    const [now] = await db.select({ status: emailCampaignsTable.status }).from(emailCampaignsTable).where(eq(emailCampaignsTable.id, campaignId));
    if (now?.status !== "in_invio") break;

    const rows = await claimBatch(campaignId);
    if (rows.length === 0) break;

    const prefs = await preferencesFor(rows.map((r) => r.userId));
    const skip = rows.filter((r) => prefs.get(r.userId)?.unsubscribed);
    const go = rows.filter((r) => !prefs.get(r.userId)?.unsubscribed);
    if (skip.length) {
      await db.update(emailCampaignRecipientsTable).set({ status: "saltata", error: "disiscritto" }).where(inArray(emailCampaignRecipientsTable.id, skip.map((r) => r.id)));
    }
    if (go.length === 0) continue;

    const emails = go.map((r) => {
      const token = prefs.get(r.userId)!.token;
      return {
        from: CAMPAIGN_FROM,
        to: [r.email],
        replyTo: MARKET.supportEmail,
        subject: c.subject,
        html: renderCampaign(c, { firstName: r.firstName, token, senderIdentity: identity }),
        headers: campaignHeaders(unsubscribeUrl(token)),
        tags: [{ name: "campaign", value: campaignId.replace(/[^A-Za-z0-9_-]/g, "") }],
      };
    });

    try {
      const { data, error } = await resend.batch.send(emails, { idempotencyKey: `campaign-${campaignId}-${go[0]!.id}` });
      if (error) throw new Error(error.message);
      const ids = data?.data ?? [];
      const sentAt = new Date();
      // One update per row only when we have ids to store; Resend returns them in order.
      await Promise.all(go.map((r, i) => db.update(emailCampaignRecipientsTable).set({ status: "inviata", resendId: ids[i]?.id ?? null, sentAt }).where(eq(emailCampaignRecipientsTable.id, r.id))));
      sentNow += go.length;
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 500) : "errore sconosciuto";
      logger.error({ err, campaignId }, "Campaign batch failed");
      await db.update(emailCampaignRecipientsTable).set({ status: "fallita", error: message }).where(inArray(emailCampaignRecipientsTable.id, go.map((r) => r.id)));
      failedNow += go.length;
    }
    await sleep(PAUSE_MS);
  }

  const { queued } = await refreshCounters(campaignId);
  return { sentNow, failedNow, remaining: queued };
}

/** Cron: finishes any campaign left half-way. */
export async function processActiveCampaigns(budgetMs = 30_000): Promise<number> {
  const active = await db.select({ id: emailCampaignsTable.id }).from(emailCampaignsTable).where(eq(emailCampaignsTable.status, "in_invio"));
  let sent = 0;
  const deadline = Date.now() + budgetMs;
  for (const a of active) {
    const left = deadline - Date.now();
    if (left < 3_000) break;
    sent += (await processCampaign(a.id, left)).sentNow;
  }
  return sent;
}

// ── Unsubscribe (public link, one-click, settings) ──────────────────────────

export async function setSubscribedByToken(token: string, subscribed: boolean, source: string): Promise<{ userId: string } | null> {
  const [row] = await db.select().from(marketingPreferencesTable).where(eq(marketingPreferencesTable.unsubscribeToken, token));
  if (!row) return null;
  if (subscribed ? row.unsubscribedAt : !row.unsubscribedAt) {
    await db
      .update(marketingPreferencesTable)
      .set({ unsubscribedAt: subscribed ? null : new Date(), unsubscribeSource: subscribed ? null : source, updatedAt: new Date() })
      .where(eq(marketingPreferencesTable.userId, row.userId));
  }
  return { userId: row.userId };
}

export async function getSubscribed(userId: string): Promise<boolean> {
  const [row] = await db.select().from(marketingPreferencesTable).where(eq(marketingPreferencesTable.userId, userId));
  return !row?.unsubscribedAt;
}

export async function setSubscribed(userId: string, subscribed: boolean): Promise<void> {
  await db
    .insert(marketingPreferencesTable)
    .values({ userId, unsubscribedAt: subscribed ? null : new Date(), unsubscribeSource: subscribed ? null : "settings" })
    .onConflictDoUpdate({
      target: marketingPreferencesTable.userId,
      set: { unsubscribedAt: subscribed ? null : new Date(), unsubscribeSource: subscribed ? null : "settings", updatedAt: new Date() },
    });
}

export async function campaignStats(id: string): Promise<Record<string, number>> {
  const res = await db.execute(sql`select status, count(*)::int as n from email_campaign_recipients where campaign_id = ${id} group by status`);
  const out: Record<string, number> = {};
  for (const r of res.rows as Array<{ status: string; n: number }>) out[r.status] = r.n;
  return out;
}
