import { Router } from "express";
import { db, leadsTable, leadEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { companyNameForUser, resubscribedPage, unsubscribeDonePage, unsubscribeMessagePage } from "../lib/unsubscribePage.js";

const router = Router();
const unsubscribeLimiter = ipRateLimiter({ name: "public-leads.unsubscribeLimiter", windowMs: 60_000, max: 30, message: "Too many requests" });

// GDPR art. 21 / art. 130 Codice Privacy: link di disiscrizione funzionante ed efficace subito.
// No auth — the token itself (a random uuid, never the lead id) is the
// credential, exactly like an invoice/contract share link.
router.get("/public/leads/unsubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) {
    res.status(400).send(unsubscribeMessagePage("missing"));
    return;
  }

  try {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.unsubscribeToken, token));
    if (!lead) {
      res.status(404).send(unsubscribeMessagePage("invalid"));
      return;
    }

    if (!lead.unsubscribedAt) {
      await db
        .update(leadsTable)
        .set({ status: "unsubscribed", unsubscribedAt: new Date(), nextFollowUpAt: null })
        .where(eq(leadsTable.id, lead.id));
      await db.insert(leadEventsTable).values({ leadId: lead.id, userId: lead.userId, type: "unsubscribed", payload: {} });
    }

    res.status(200).send(unsubscribeDonePage({ kind: "followups", company: await companyNameForUser(lead.userId), resubscribe: { action: `resubscribe?token=${encodeURIComponent(token)}` } }));
  } catch (err) {
    logger.error({ err }, "Lead unsubscribe failed");
    res.status(500).send(unsubscribeMessagePage("error"));
  }
});

// POCKET-5 (QuoteAI 128.10): changed their mind — the same token turns the follow-ups back on (a form POST, so a mail scanner cannot undo it).
router.post("/public/leads/resubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) { res.status(400).send(unsubscribeMessagePage("missing")); return; }
  try {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.unsubscribeToken, token));
    if (!lead) { res.status(404).send(unsubscribeMessagePage("invalid")); return; }
    if (lead.unsubscribedAt) {
      await db.update(leadsTable).set({ status: lead.status === "unsubscribed" ? "new" : lead.status, unsubscribedAt: null }).where(eq(leadsTable.id, lead.id));
      await db.insert(leadEventsTable).values({ leadId: lead.id, userId: lead.userId, type: "note_added", payload: { note: "Si è iscritto di nuovo ai messaggi" } });
    }
    res.status(200).send(resubscribedPage({ company: await companyNameForUser(lead.userId) }));
  } catch (err) {
    logger.error({ err }, "Lead resubscribe failed");
    res.status(500).send(unsubscribeMessagePage("error"));
  }
});

export default router;
