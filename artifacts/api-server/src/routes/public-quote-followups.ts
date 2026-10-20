import { Router } from "express";
import { db, quotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { resubscribedPage, unsubscribeDonePage, unsubscribeMessagePage } from "../lib/unsubscribePage.js";

const router = Router();
const unsubscribeLimiter = ipRateLimiter({ name: "public-quote-followups.unsubscribeLimiter", windowMs: 60_000, max: 30, message: "Too many requests" });

// Working unsubscribe link for Phase 21 quote follow-up reminders, same
// pattern as public-leads.ts. No auth — the token itself (a random uuid,
// never the quote id) is the credential. POCKET-5: the page is the designed
// one, in Italian, with "Riiscriviti".
router.get("/public/quotes/unsubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) {
    res.status(400).send(unsubscribeMessagePage("missing"));
    return;
  }

  try {
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.unsubscribeToken, token));
    if (!quote) {
      res.status(404).send(unsubscribeMessagePage("invalid"));
      return;
    }

    if (!quote.unsubscribedAt) {
      await db
        .update(quotesTable)
        .set({ unsubscribedAt: new Date(), nextFollowUpAt: null })
        .where(eq(quotesTable.id, quote.id));
    }

    res.status(200).send(unsubscribeDonePage({ kind: "reminders", company: quote.companySnapshot?.companyName ?? "", resubscribe: { action: `resubscribe?token=${encodeURIComponent(token)}` } }));
  } catch (err) {
    logger.error({ err }, "Quote follow-up unsubscribe failed");
    res.status(500).send(unsubscribeMessagePage("error"));
  }
});

// POCKET-5 (QuoteAI 128.10): changed their mind — the reminders on this quote can start again on the next stage
// the daily run schedules. A form POST, so a mail scanner opening the link cannot undo the unsubscribe.
router.post("/public/quotes/resubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) { res.status(400).send(unsubscribeMessagePage("missing")); return; }
  try {
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.unsubscribeToken, token));
    if (!quote) { res.status(404).send(unsubscribeMessagePage("invalid")); return; }
    if (quote.unsubscribedAt) await db.update(quotesTable).set({ unsubscribedAt: null }).where(eq(quotesTable.id, quote.id));
    res.status(200).send(resubscribedPage({ company: quote.companySnapshot?.companyName ?? "" }));
  } catch (err) {
    logger.error({ err }, "Quote follow-up resubscribe failed");
    res.status(500).send(unsubscribeMessagePage("error"));
  }
});

export default router;
