import { Router } from "express";
import { z } from "zod";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { PUSH_KINDS, PUSH_KIND_DEFS } from "@workspace/config";
import { and, eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId, getActorRole } from "../middlewares/authMiddleware";
import { roleCan } from "../middlewares/requirePermission";
import { userRateLimiter } from "../lib/rateLimit";
import { isPushConfigured, pushPublicKey, pushReady, saveSubscription, removeSubscription, sendPushToCompany, readMuted, writeMuted } from "../lib/push";

// ── APP-2: notifiche push sul telefono (docs/APP-PLAN.md) ────────────────────
// The browser subscribes with the VAPID public key it reads here, then hands
// us its PushSubscription. Rows are per browser, per person and per acting
// company: a team member's phone receives the company they were acting as
// when they turned it on. Preferences are per person and company. Every route
// is the actor's own business (their browser, their switches) — any role.

const router = Router();
const testLimiter = userRateLimiter({ windowMs: 15 * 60_000, max: 10, message: "Troppe prove. Riprova fra qualche minuto." });
const writeLimiter = userRateLimiter({ windowMs: 15 * 60_000, max: 60, message: "Troppe richieste. Riprova fra qualche minuto." });

const NOT_CONFIGURED = { error: "NOT_CONFIGURED", message: "Le notifiche sul telefono non sono ancora attive su PrevAI." };
const NOT_READY = { error: "NOT_READY", message: "Le notifiche sul telefono si attivano con il prossimo aggiornamento." };

const SubscriptionBody = z.object({
  endpoint: z.string().url().max(2000).refine((u) => u.startsWith("https://"), "endpoint must be https"),
  keys: z.object({ p256dh: z.string().min(80).max(120), auth: z.string().min(16).max(32) }),
});

// GET /api/push/config — is push set up, the key to subscribe with, is this browser known, which kinds this person can get.
router.get("/push/config", requireAuth, async (req, res) => {
  try {
    const ready = await pushReady();
    const endpoint = typeof req.query.endpoint === "string" ? req.query.endpoint : null;
    let subscribed = false;
    if (ready && endpoint) {
      const [row] = await db
        .select({ id: pushSubscriptionsTable.id })
        .from(pushSubscriptionsTable)
        .where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.memberUserId, getActorUserId(res)), eq(pushSubscriptionsTable.userId, getUserId(res))));
      subscribed = !!row;
    }
    const role = getActorRole(res);
    const kinds = PUSH_KINDS.map((kind) => ({ kind, allowed: roleCan(role, PUSH_KIND_DEFS[kind].area, "view") }));
    const muted = ready ? await readMuted(getUserId(res), getActorUserId(res)) : [];
    res.json({ configured: isPushConfigured(), ready, publicKey: pushPublicKey(), subscribed, kinds, muted });
  } catch (err) {
    req.log.error({ err }, "Error reading push config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/push/subscriptions — turn this browser on (or refresh it).
router.post("/push/subscriptions", requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!isPushConfigured()) return void res.status(503).json(NOT_CONFIGURED);
    if (!(await pushReady())) return void res.status(503).json(NOT_READY);
    const body = SubscriptionBody.safeParse(req.body);
    if (!body.success) return void res.status(400).json({ error: "Invalid parameters", details: body.error });
    const row = await saveSubscription({ userId: getUserId(res), memberUserId: getActorUserId(res), subscription: body.data, userAgent: req.get("user-agent")?.slice(0, 300) ?? null });
    res.status(201).json({ id: row.id, createdAt: row.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error saving push subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/push/subscriptions — body { endpoint }: forget this browser.
router.delete("/push/subscriptions", requireAuth, writeLimiter, async (req, res) => {
  try {
    const body = z.object({ endpoint: z.string().url().max(2000) }).safeParse(req.body);
    if (!body.success) return void res.status(400).json({ error: "Invalid parameters", details: body.error });
    if (!(await pushReady())) return void res.json({ success: true, removed: false });
    const removed = await removeSubscription({ memberUserId: getActorUserId(res), endpoint: body.data.endpoint });
    res.json({ success: true, removed });
  } catch (err) {
    req.log.error({ err }, "Error removing push subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/push/test — a sample notification to the caller's own browsers in this company.
router.post("/push/test", requireAuth, testLimiter, async (req, res) => {
  try {
    if (!isPushConfigured()) return void res.status(503).json(NOT_CONFIGURED);
    if (!(await pushReady())) return void res.status(503).json(NOT_READY);
    const summary = await sendPushToCompany(
      getUserId(res),
      { title: "PrevAI — notifica di prova", body: "Le notifiche arrivano su questo dispositivo.", link: "/dashboard/settings/notifications", tag: "push-test" },
      { memberUserId: getActorUserId(res) },
    );
    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Error sending test push");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/push/preferences — body { muted: PushKind[] }: the kinds this person switched off in this company.
router.put("/push/preferences", requireAuth, writeLimiter, async (req, res) => {
  try {
    const body = z.object({ muted: z.array(z.enum(PUSH_KINDS)).max(PUSH_KINDS.length) }).safeParse(req.body);
    if (!body.success) return void res.status(400).json({ error: "Invalid parameters", details: body.error });
    if (!(await pushReady())) return void res.status(503).json(NOT_READY);
    const muted = await writeMuted(getUserId(res), getActorUserId(res), body.data.muted);
    res.json({ muted });
  } catch (err) {
    req.log.error({ err }, "Error saving push preferences");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
