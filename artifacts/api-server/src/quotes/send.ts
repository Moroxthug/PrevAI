// Sending a quote by email, shared by the Invia dialog (POST /api/quotes/:id/send-pdf-email)
// and the assistant (APP-8c, send_quote). Also the trial unlock both share with the PDF
// download, and the monthly quota check shared by the generator and draft_quote.
import { db, quotesTable, businessProfilesTable, type QuoteClientData, type QuoteCompanySnapshot } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { publicQuoteLink } from "./publicLink.js";
import { quoteLanguageFor, qt, fmtQuoteDate, fmtQty } from "./i18n.js";
import { generateQuotePdfBuffer, quoteProvenance } from "./pdf.js";
import { getTrialStatus, PLANS } from "../routes/payments.js";
import { sendQuotePdfEmail } from "../lib/email.js";
import { QUOTE_FOLLOWUP_CADENCE_DAYS } from "../lib/quoteMessaging.js";
import { linkQuoteToClient } from "../lib/clients.js";

type QuoteRow = typeof quotesTable.$inferSelect;
type Profile = typeof businessProfilesTable.$inferSelect;
type Log = { info: (obj: object, msg: string) => void };

export class QuoteSendError extends Error {
  constructor(public code: "NOT_FOUND" | "BAD_EMAIL" | "PAYMENT_REQUIRED", message: string) { super(message); }
}

/**
 * A draft quote of a non-subscriber is unlocked by the trial — once — the
 * first time it leaves the account (PDF download or email send). Each unlock
 * consumes one trial download. Returns false when the trial is over, so the
 * caller can answer 402. (Phase 66: email send used to require the quote to
 * be unlocked already, so trial users could not send before downloading.)
 */
export async function tryTrialUnlock(quote: QuoteRow, profile: Profile | null, log: Log): Promise<boolean> {
  const trial = getTrialStatus(profile);
  if (!trial.isTrialActive) return false;
  await Promise.all([
    db.update(quotesTable).set({ status: "unlocked", unlockedWithPlan: "trial" }).where(eq(quotesTable.id, quote.id)),
    db
      .update(businessProfilesTable)
      .set({ trialDownloadsUsed: (profile?.trialDownloadsUsed ?? 0) + 1 })
      .where(eq(businessProfilesTable.userId, quote.userId)),
  ]);
  log.info({ quoteId: quote.id, userId: quote.userId }, "Quote auto-unlocked via trial");
  return true;
}

/** What sending would do to a quote's lock, without doing it (the assistant's card says it). */
export function sendUnlockNote(quote: Pick<QuoteRow, "status">, profile: Pick<Profile, "subscriptionStatus"> | null | undefined): "none" | "plan" | "trial" {
  if (quote.status !== "draft" && quote.status !== "pending_payment") return "none";
  return profile?.subscriptionStatus === "active" ? "plan" : "trial";
}

/**
 * Emails the quote's PDF to `toEmail`. Sending is what makes a quote leave the
 * account, so it unlocks the quote exactly like a PDF download does:
 * subscribers unlock with their plan, trial users spend one trial download,
 * everyone else must pay (PAYMENT_REQUIRED). Only a draft is ever touched — an
 * accepted quote stays accepted. Starts the follow-up sequence (Phase 21).
 */
export async function sendQuoteByEmail(params: { userId: string; quoteId: string; toEmail: string; clientName?: string; /** TEAM-1: la persona che preme «Invia» (non l'impresa). */ actorId?: string; log: Log }): Promise<{ quote: QuoteRow }> {
  const { userId, log } = params;
  const toEmail = params.toEmail.trim();
  if (!toEmail || !toEmail.includes("@")) throw new QuoteSendError("BAD_EMAIL", "Recipient email address is required");

  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, params.quoteId));
  if (!quote || quote.userId !== userId) throw new QuoteSendError("NOT_FOUND", "Not found");

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));

  if (quote.status === "draft" || quote.status === "pending_payment") {
    if (profile?.subscriptionStatus === "active") {
      await db
        .update(quotesTable)
        .set({ status: "unlocked", unlockedWithPlan: profile.subscriptionPlan ?? null })
        .where(eq(quotesTable.id, quote.id));
      quote.status = "unlocked";
    } else if (await tryTrialUnlock(quote, profile ?? null, log)) {
      quote.status = "unlocked";
    } else {
      throw new QuoteSendError("PAYMENT_REQUIRED", "Unlock the quote to send it via email");
    }
  } else if (quote.status !== "unlocked" && quote.status !== "accepted") {
    throw new QuoteSendError("PAYMENT_REQUIRED", "Unlock the quote to send it via email");
  }

  // Generate clean PDF (never watermark for email)
  const pdfBuffer = await generateQuotePdfBuffer(quote, profile ?? null, false);
  const lang = await quoteLanguageFor(quote);

  const companyName = (quote.companySnapshot as QuoteCompanySnapshot | null)?.companyName || profile?.companyName || "La tua impresa";
  const numeroData = quote.numeroPreventivoData || `${qt("quoteNo", lang)} ${quote.id.slice(0, 4).toUpperCase()} - ${fmtQuoteDate(new Date(), lang)}`;
  const totaleFormatted = fmtQty(Number(quote.totale), lang);
  const filename = `Preventivo ${numeroData.replace(/\//g, "_")}.pdf`;

  await sendQuotePdfEmail({
    toEmail,
    userId,
    companyName,
    clientName: params.clientName || (quote.clientData as QuoteClientData)?.nome || "",
    lang,
    quoteNumber: numeroData,
    totale: totaleFormatted,
    pdfBuffer,
    filename,
    companyLogoUrl: profile?.logoUrl ?? null,
    replyTo: profile?.email ?? null,
    // SEC-4: sending the quote is sharing its link (a new one if it had been revoked).
    publicUrl: quote.status === "unlocked" || quote.status === "accepted" ? (await publicQuoteLink(quote, { share: true })).url : null,
    aiGenerated: quoteProvenance(quote) === "ai",
  });

  // Phase 21: start the follow-up reminder sequence, unless the quote is
  // already accepted or the client has unsubscribed from reminders.
  if (quote.status !== "accepted" && !quote.unsubscribedAt) {
    // The follow-ups go to clientData.email, which the quote forms never
    // collect — remember the address the contractor just typed, or the
    // whole sequence dies with `no_email` (Phase 66).
    const existingClient = (quote.clientData as QuoteClientData | null) ?? null;
    const clientData = existingClient && !existingClient.email ? { ...existingClient, email: toEmail } : existingClient;
    await db
      .update(quotesTable)
      .set({
        sentAt: quote.sentAt ?? new Date(),
        // TEAM-1: vale il primo invio; un collega che lo rimanda non lo ruba.
        ...(params.actorId && !quote.sentByUserId ? { sentByUserId: params.actorId } : {}),
        followUpStage: 0,
        nextFollowUpAt: new Date(Date.now() + QUOTE_FOLLOWUP_CADENCE_DAYS[0] * 86_400_000),
        ...(clientData && clientData !== existingClient ? { clientData } : {}),
      })
      .where(eq(quotesTable.id, quote.id));
    if (clientData !== existingClient) await linkQuoteToClient({ ...quote, clientData }, profile?.province ?? null, { applyDefaultTerms: false });
  }
  return { quote };
}

/** The plan's monthly quota of new quotes, when this month's is used up: the message to show, else null. */
export async function quoteQuotaExceeded(userId: string, now = new Date()): Promise<string | null> {
  const [profile] = await db
    .select({ subscriptionPlan: businessProfilesTable.subscriptionPlan, subscriptionStatus: businessProfilesTable.subscriptionStatus })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, userId));
  if (profile?.subscriptionStatus !== "active" || !profile.subscriptionPlan) return null;
  const plan = PLANS.find((p) => p.id === profile.subscriptionPlan);
  if (plan?.quotaPerMonth == null) return null;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(quotesTable)
    .where(sql`${quotesTable.userId} = ${userId} AND ${quotesTable.createdAt} >= ${monthStart.toISOString()} AND ${quotesTable.createdAt} < ${nextMonth.toISOString()}`);
  if (cnt < plan.quotaPerMonth) return null;
  return `Monthly quota reached. You've used all ${plan.quotaPerMonth} quotes included in the ${plan.name} plan this month. Upgrade to a higher plan to continue.`;
}
