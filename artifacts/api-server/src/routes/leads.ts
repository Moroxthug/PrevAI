import { Router } from "express";
import { z } from "zod";
import { db, leadsTable, leadEventsTable, LEAD_STATUSES, LEAD_CHANNELS } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { rejectStale } from "../lib/versioning.js";
import { FOLLOWUP_CADENCE_DAYS } from "../lib/leadMessaging.js";
import { sendLeadNow, LeadSendError } from "../leads/send-now.js";

const router = Router();

// GET /api/leads — the /dashboard/leads list, optionally filtered by status.
router.get("/leads", requireAuth, requirePermission("leads", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const status = z.enum(LEAD_STATUSES).optional().safeParse(req.query.status).data;
    const rows = await db
      .select()
      .from(leadsTable)
      .where(status ? and(eq(leadsTable.userId, userId), eq(leadsTable.status, status)) : eq(leadsTable.userId, userId))
      .orderBy(desc(leadsTable.createdAt))
      .limit(300);
    res.json({ items: rows });
  } catch (err) {
    req.log.error({ err }, "Error listing leads");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/leads — manual entry (phone call, walk-in, referral).
router.post("/leads", requireAuth, requirePermission("leads", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z
      .object({
        name: z.string().min(1).max(200),
        email: z.string().email().optional(),
        phone: z.string().max(30).optional(),
        preferredLanguage: z.enum(["it"]).optional(),
        preferredChannel: z.enum(LEAD_CHANNELS).optional(),
        notes: z.string().max(2000).optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const [lead] = await db
      .insert(leadsTable)
      .values({
        userId,
        name: d.name,
        email: d.email ?? null,
        phone: d.phone ?? null,
        preferredLanguage: "it",
        preferredChannel: d.preferredChannel ?? "email",
        source: "manual",
        status: "new",
        consentSource: "manual_entry",
        notes: d.notes ?? "",
        nextFollowUpAt: new Date(Date.now() + FOLLOWUP_CADENCE_DAYS[0]! * 86_400_000),
      })
      .returning();
    await db.insert(leadEventsTable).values({ leadId: lead!.id, userId, type: "created", payload: { source: "manual" } });
    await db.insert(leadEventsTable).values({ leadId: lead!.id, userId, type: "consent_recorded", payload: { consentSource: "manual_entry" } });
    res.status(201).json({ lead });
  } catch (err) {
    req.log.error({ err }, "Error creating lead");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/leads/:id — detail + event/message history.
router.get("/leads/:id", requireAuth, requirePermission("leads", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [lead] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, req.params.id as string), eq(leadsTable.userId, userId)));
    if (!lead) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const events = await db.select().from(leadEventsTable).where(eq(leadEventsTable.leadId, lead.id)).orderBy(desc(leadEventsTable.createdAt)).limit(200);
    res.json({ lead, events });
  } catch (err) {
    req.log.error({ err }, "Error loading lead");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/leads/:id — status, notes, or channel/language changes. Setting
// status to won/lost/unsubscribed stops the follow-up sequence.
router.patch("/leads/:id", requireAuth, requirePermission("leads", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z
      .object({
        status: z.enum(LEAD_STATUSES).optional(),
        notes: z.string().max(2000).optional(),
        preferredChannel: z.enum(LEAD_CHANNELS).optional(),
        preferredLanguage: z.enum(["it"]).optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const [existing] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, req.params.id as string), eq(leadsTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const stale = () => ({ id: existing.id, status: existing.status, notes: existing.notes, preferredChannel: existing.preferredChannel, preferredLanguage: existing.preferredLanguage, updatedAt: existing.updatedAt.toISOString() });
    if (rejectStale(req, res, existing.updatedAt, stale)) return;
    const d = body.data;
    const stopping = d.status && ["won", "lost", "unsubscribed"].includes(d.status);
    const [lead] = await db
      .update(leadsTable)
      .set({
        ...(d.status ? { status: d.status } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.preferredChannel ? { preferredChannel: d.preferredChannel } : {}),
        ...(d.preferredLanguage ? { preferredLanguage: d.preferredLanguage } : {}),
        ...(stopping ? { nextFollowUpAt: null } : {}),
        ...(d.status === "unsubscribed" ? { unsubscribedAt: new Date() } : {}),
      })
      .where(eq(leadsTable.id, existing.id))
      .returning();
    if (d.status && d.status !== existing.status) {
      await db.insert(leadEventsTable).values({ leadId: existing.id, userId, type: "status_changed", payload: { from: existing.status, to: d.status } });
    }
    res.json({ lead });
  } catch (err) {
    req.log.error({ err }, "Error updating lead");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/leads/:id/send — manual "send now" outside the automated sequence
// (e.g. the office wants to nudge a lead today instead of waiting for the
// next scheduled stage). Uses the same GDPR-compliant (unsubscribe link) template as the
// automated sequence and advances the sequence exactly like an automated send.
router.post("/leads/:id/send", requireAuth, requirePermission("leads", "edit"), async (req, res) => {
  try {
    const { lead, channel } = await sendLeadNow({ userId: getUserId(res), leadId: req.params.id as string, actorUserId: getActorUserId(res) });
    res.json({ lead, channel });
  } catch (err) {
    if (err instanceof LeadSendError) {
      if (err.code === "NOT_FOUND") res.status(404).json({ error: "Not found" });
      else if (err.code === "UNSUBSCRIBED") res.status(409).json({ error: "UNSUBSCRIBED", message: err.message });
      else if (err.code === "NO_PROFILE") res.status(500).json({ error: err.message });
      else res.status(502).json({ error: "SEND_FAILED", reason: err.reason });
      return;
    }
    req.log.error({ err }, "Error sending lead follow-up");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
