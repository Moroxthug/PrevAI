import { Router } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { companyNameForUser, resubscribedPage, unsubscribeDonePage, unsubscribeMessagePage } from "../lib/unsubscribePage.js";

const router = Router();
const unsubscribeLimiter = ipRateLimiter({ name: "public-reviews.unsubscribeLimiter", windowMs: 60_000, max: 30, message: "Too many requests" });

// GDPR art. 21 / art. 130 Codice Privacy: link di disiscrizione efficace subito,
// same pattern as public-leads.ts. No auth — the token itself (a random uuid,
// never the client id) is the credential. Only stops marketing-type sends
// (review requests, shared photos) — never transactional messages.
router.get("/public/clients/unsubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) {
    res.status(400).send(unsubscribeMessagePage("missing"));
    return;
  }

  try {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.marketingUnsubscribeToken, token));
    if (!client) {
      res.status(404).send(unsubscribeMessagePage("invalid"));
      return;
    }

    if (!client.marketingUnsubscribedAt) {
      await db.update(clientsTable).set({ marketingUnsubscribedAt: new Date() }).where(eq(clientsTable.id, client.id));
    }

    res.status(200).send(unsubscribeDonePage({ kind: "marketing", company: await companyNameForUser(client.userId), resubscribe: { action: `resubscribe?token=${encodeURIComponent(token)}` } }));
  } catch (err) {
    logger.error({ err }, "Client marketing unsubscribe failed");
    res.status(500).send(unsubscribeMessagePage("error"));
  }
});

// POCKET-5 (QuoteAI 128.10): changed their mind — review requests and shared photos can reach this client again.
router.post("/public/clients/resubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) { res.status(400).send(unsubscribeMessagePage("missing")); return; }
  try {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.marketingUnsubscribeToken, token));
    if (!client) { res.status(404).send(unsubscribeMessagePage("invalid")); return; }
    if (client.marketingUnsubscribedAt) await db.update(clientsTable).set({ marketingUnsubscribedAt: null }).where(eq(clientsTable.id, client.id));
    res.status(200).send(resubscribedPage({ company: await companyNameForUser(client.userId) }));
  } catch (err) {
    logger.error({ err }, "Client marketing resubscribe failed");
    res.status(500).send(unsubscribeMessagePage("error"));
  }
});

export default router;
