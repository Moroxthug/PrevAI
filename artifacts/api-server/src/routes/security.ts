import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, businessProfilesTable } from "@workspace/db";
import { requireAuth, getUserId, getActorUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { listSecurityAuditEvents, recordSecurityAuditEvent } from "../lib/auditLog.js";

const router = Router();

// A-0 — org security policy. GET is exempt from the 2FA gate in requireAuth so
// the dashboard can explain the block; PATCH is owner-only (security: full).
router.get("/security/policy", requireAuth, async (_req, res) => {
  res.json({
    twoFactorRequired: res.locals.twoFactorRequired,
    twoFactorEnabled: res.locals.twoFactorEnabled,
    // The Amministrazione module (A-5) will pin the policy on; until then the owner can toggle it.
    twoFactorLocked: false,
  });
});

const policySchema = z.object({ twoFactorRequired: z.boolean() });

router.patch("/security/policy", requireAuth, requirePermission("security", "full"), async (req, res) => {
  const parsed = policySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const orgId = getUserId(res);
  const { twoFactorRequired } = parsed.data;
  // Whoever switches the policy on must already satisfy it, or they lock themselves out.
  if (twoFactorRequired && !res.locals.twoFactorEnabled) {
    res.status(400).json({ error: "two_factor_not_enabled", message: "Attiva prima la verifica in due passaggi sul tuo account." });
    return;
  }
  try {
    const [updated] = await db.update(businessProfilesTable).set({ twoFactorRequired }).where(eq(businessProfilesTable.userId, orgId)).returning({ twoFactorRequired: businessProfilesTable.twoFactorRequired });
    if (!updated) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    await recordSecurityAuditEvent({ orgId, actorUserId: getActorUserId(res), action: twoFactorRequired ? "two_factor.policy_enabled" : "two_factor.policy_disabled" });
    res.json({ twoFactorRequired: updated.twoFactorRequired, twoFactorEnabled: res.locals.twoFactorEnabled, twoFactorLocked: false });
  } catch {
    res.status(500).json({ error: "Failed to update security policy" });
  }
});

// GET /api/security/audit-log — org-wide security events (login, 2FA, session
// revocation, permission changes). Read-only for every role, per the Phase 7
// matrix ("security": view for everyone, full only for owner/admin).
router.get("/security/audit-log", requireAuth, requirePermission("security", "view"), async (_req, res) => {
  try {
    const orgId = getUserId(res);
    const events = await listSecurityAuditEvents(orgId, { limit: 200 });
    res.json({
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        actorId: e.actorId,
        actorName: e.actorName,
        actorEmail: e.actorEmail,
        entityType: e.entityType,
        entityId: e.entityId,
        ip: e.ip,
        userAgent: e.userAgent,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to load audit log" });
  }
});

export default router;
