// EMAIL-2: campaigns to PrevAI's own users.
//
// Admin (staff only, requireAdmin):
//   GET    /api/admin/campaigns                → { campaigns, audiences, senderIdentity, examples }
//   GET    /api/admin/campaigns/audiences/:id  → { count }
//   POST   /api/admin/campaigns                → create draft
//   PUT    /api/admin/campaigns/:id            → edit draft (resets the test)
//   DELETE /api/admin/campaigns/:id            → delete draft
//   POST   /api/admin/campaigns/preview        → { html } for unsaved content
//   POST   /api/admin/campaigns/:id/test       → send "[PROVA]" to the admin
//   POST   /api/admin/campaigns/:id/start      → freeze audience, status in_invio
//   POST   /api/admin/campaigns/:id/process    → send the next batches (call again while remaining > 0)
//   POST   /api/admin/campaigns/:id/cancel
//   PUT    /api/admin/campaigns/sender-identity { value }
// Public (the token is the credential):
//   GET  /api/public/prevai/unsubscribe?token=  → unsubscribes at once, shows the page
//   POST /api/public/prevai/unsubscribe?token=  → RFC 8058 one-click (mail clients)
//   POST /api/public/prevai/resubscribe?token=
// Person (logged in):
//   GET/PUT /api/me/marketing { subscribed }

import { Router, type Request } from "express";
import { z } from "zod/v4";
import { fromNodeHeaders } from "better-auth/node";
import { db, settingsTable } from "@workspace/db";
import { auth } from "../lib/auth";
import { logger } from "../lib/logger.js";
import { requireAdmin } from "./admin.js";
import { requireAuth, getActorUserId } from "../middlewares/authMiddleware.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { resubscribedPage, unsubscribeDonePage, unsubscribeMessagePage } from "../lib/unsubscribePage.js";
import { CAMPAIGN_EXAMPLES, buildCampaignEmail } from "../lib/emailCampaign.js";
import { AUDIENCES, audienceCount, isAudienceId } from "../campaigns/audiences.js";
import {
  CampaignError,
  SENDER_IDENTITY_KEY,
  campaignContentSchema,
  campaignInputSchema,
  campaignStats,
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  getCampaign,
  getSenderIdentity,
  getSubscribed,
  listCampaigns,
  processCampaign,
  sendTest,
  setSubscribed,
  setSubscribedByToken,
  startCampaign,
  updateCampaign,
} from "../campaigns/service.js";

const router = Router();

async function sessionUser(req: Request<Record<string, string>>): Promise<{ id: string; email: string; name: string }> {
  const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return { id: s!.user.id, email: s!.user.email, name: s!.user.name };
}

function fail(res: import("express").Response, err: unknown): void {
  if (err instanceof CampaignError) {
    res.status(err.code === "NOT_FOUND" ? 404 : 409).json({ error: err.code, message: err.message });
    return;
  }
  logger.error({ err }, "Campaign route failed");
  res.status(500).json({ error: "INTERNAL", message: err instanceof Error ? err.message : "Errore" });
}

// ── Admin ───────────────────────────────────────────────────────────────────

router.use("/admin/campaigns", requireAdmin);

router.get("/admin/campaigns", async (_req, res) => {
  try {
    res.json({ campaigns: await listCampaigns(), audiences: AUDIENCES, senderIdentity: await getSenderIdentity(), examples: CAMPAIGN_EXAMPLES });
  } catch (err) {
    fail(res, err);
  }
});

router.get("/admin/campaigns/audiences/:id", async (req, res) => {
  if (!isAudienceId(req.params.id)) {
    res.status(400).json({ error: "INVALID" });
    return;
  }
  try {
    res.json({ count: await audienceCount(req.params.id) });
  } catch (err) {
    fail(res, err);
  }
});

router.put("/admin/campaigns/sender-identity", async (req, res) => {
  const parsed = z.object({ value: z.string().trim().min(10).max(300) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Scrivi ragione sociale, sede e P.IVA (almeno 10 caratteri)." });
    return;
  }
  await db.insert(settingsTable).values({ key: SENDER_IDENTITY_KEY, value: parsed.data.value }).onConflictDoUpdate({ target: settingsTable.key, set: { value: parsed.data.value } });
  res.json({ ok: true });
});

router.post("/admin/campaigns/preview", async (req, res) => {
  const parsed = campaignContentSchema.safeParse(req.body?.content);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", issues: parsed.error.issues });
    return;
  }
  const html = buildCampaignEmail({ ...parsed.data, firstName: "Mario" }, { unsubscribeUrl: "#", campaignId: "anteprima", senderIdentity: await getSenderIdentity() });
  res.json({ html });
});

router.post("/admin/campaigns", async (req, res) => {
  const parsed = campaignInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", issues: parsed.error.issues });
    return;
  }
  try {
    const me = await sessionUser(req);
    res.status(201).json({ campaign: await createCampaign(parsed.data, me.id) });
  } catch (err) {
    fail(res, err);
  }
});

router.get("/admin/campaigns/:id", async (req, res) => {
  try {
    res.json({ campaign: await getCampaign(req.params.id), stats: await campaignStats(req.params.id) });
  } catch (err) {
    fail(res, err);
  }
});

router.put("/admin/campaigns/:id", async (req, res) => {
  const parsed = campaignInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", issues: parsed.error.issues });
    return;
  }
  try {
    res.json({ campaign: await updateCampaign(req.params.id, parsed.data) });
  } catch (err) {
    fail(res, err);
  }
});

router.delete("/admin/campaigns/:id", async (req, res) => {
  try {
    await deleteCampaign(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

router.post("/admin/campaigns/:id/test", async (req, res) => {
  try {
    const me = await sessionUser(req);
    await sendTest(req.params.id, [me.email], me.id, me.name);
    res.json({ ok: true, to: me.email });
  } catch (err) {
    fail(res, err);
  }
});

router.post("/admin/campaigns/:id/start", async (req, res) => {
  try {
    const campaign = await startCampaign(req.params.id);
    // First batches right away; the page keeps calling /process for the rest.
    const progress = await processCampaign(campaign.id, 35_000);
    res.json({ campaign: await getCampaign(campaign.id), progress });
  } catch (err) {
    fail(res, err);
  }
});

router.post("/admin/campaigns/:id/process", async (req, res) => {
  try {
    const progress = await processCampaign(req.params.id, 45_000);
    res.json({ campaign: await getCampaign(req.params.id), progress });
  } catch (err) {
    fail(res, err);
  }
});

router.post("/admin/campaigns/:id/cancel", async (req, res) => {
  try {
    await cancelCampaign(req.params.id);
    res.json({ campaign: await getCampaign(req.params.id) });
  } catch (err) {
    fail(res, err);
  }
});

// ── Public unsubscribe ──────────────────────────────────────────────────────

const unsubscribeLimiter = ipRateLimiter({ name: "campaigns.unsubscribeLimiter", windowMs: 60_000, max: 30, message: "Too many requests" });

router.get("/public/prevai/unsubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) {
    res.status(400).send(unsubscribeMessagePage("missing"));
    return;
  }
  try {
    const done = await setSubscribedByToken(token, false, "link");
    if (!done) {
      res.status(404).send(unsubscribeMessagePage("invalid"));
      return;
    }
    res.status(200).send(unsubscribeDonePage({ kind: "prevai", resubscribe: { action: `resubscribe?token=${encodeURIComponent(token)}` } }));
  } catch (err) {
    logger.error({ err }, "PrevAI unsubscribe failed");
    res.status(500).send(unsubscribeMessagePage("error"));
  }
});

// RFC 8058: the mail client POSTs "List-Unsubscribe=One-Click" — no page, just 200.
router.post("/public/prevai/unsubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  try {
    const done = token ? await setSubscribedByToken(token, false, "one_click") : null;
    res.status(done ? 200 : 404).send(done ? "ok" : "not found");
  } catch (err) {
    logger.error({ err }, "PrevAI one-click unsubscribe failed");
    res.status(500).send("error");
  }
});

router.post("/public/prevai/resubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) {
    res.status(400).send(unsubscribeMessagePage("missing"));
    return;
  }
  try {
    const done = await setSubscribedByToken(token, true, "link");
    if (!done) {
      res.status(404).send(unsubscribeMessagePage("invalid"));
      return;
    }
    res.status(200).send(resubscribedPage({}));
  } catch (err) {
    logger.error({ err }, "PrevAI resubscribe failed");
    res.status(500).send(unsubscribeMessagePage("error"));
  }
});

// ── The person's own choice (Impostazioni → Accesso) ────────────────────────

router.get("/me/marketing", requireAuth, async (_req, res) => {
  try {
    res.json({ subscribed: await getSubscribed(getActorUserId(res)) });
  } catch (err) {
    fail(res, err);
  }
});

router.put("/me/marketing", requireAuth, async (req, res) => {
  const parsed = z.object({ subscribed: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID" });
    return;
  }
  try {
    await setSubscribed(getActorUserId(res), parsed.data.subscribed);
    res.json({ subscribed: parsed.data.subscribed });
  } catch (err) {
    fail(res, err);
  }
});

export default router;
