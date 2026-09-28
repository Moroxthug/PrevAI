import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, homeLayoutsTable } from "@workspace/db";
import { HOME_KINDS, HOME_KIND_ROLE, normalizeHomeLayout, type HomeKind } from "@workspace/config";
import { requireAuth, getUserId, getActorUserId, getActorRole } from "../middlewares/authMiddleware.js";
import { requirePermission, roleCan } from "../middlewares/requirePermission.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { allowedSections, effectiveLayout, homeKindOf, saveHomeLayout, startingLayout } from "../home/service.js";

// ── APP-7: la home per ruolo e "Personalizza la home" (docs/PIANO-AZIONE.md riga 31) ──
// - GET    /api/home               this person's home: sections allowed, layout, where it came from
// - PUT    /api/home               save my own layout (only among what my role may see)
// - DELETE /api/home               back to my role's starting home
// - PUT    /api/home/roles/:kind   the owner sets a kind of role's starting home
// - DELETE /api/home/roles/:kind   …and puts it back to PrevAI's
//
// Inert until migrations/v2/0012_app7_home.sql runs: GET answers the built-in
// home with `available: false`, the writes answer 503.

const router = Router();

/** Postgres "relation does not exist": the 0012 migration has not run yet. */
function missingTable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

const writeLimiter = userRateLimiter({ name: "home.writeLimiter", windowMs: 60_000, max: 30, message: "Troppe modifiche alla home: riprova tra un minuto." });

const userSubject = (actorUserId: string) => `user:${actorUserId}`;
const roleSubject = (kind: HomeKind) => `role:${kind}`;

const layoutSchema = z.object({
  order: z.array(z.string().max(40)).max(20),
  needsYouCollapsed: z.boolean(),
  tabs: z.array(z.string().max(80)).max(10),
  period: z.string().max(4),
});

const NOT_AVAILABLE = { error: "NOT_AVAILABLE", message: "La home personalizzata non è ancora disponibile." };

// GET /api/home
router.get("/home", requireAuth, async (req, res) => {
  const userId = getUserId(res);
  const role = getActorRole(res);
  const kind = homeKindOf(role);
  try {
    const rows = await db.select({ subject: homeLayoutsTable.subject, layout: homeLayoutsTable.layout }).from(homeLayoutsTable).where(eq(homeLayoutsTable.userId, userId));
    const bySubject = new Map(rows.map((r) => [r.subject, r.layout]));
    const own = bySubject.get(userSubject(getActorUserId(res))) ?? null;
    const { layout, source } = effectiveLayout(role, own, bySubject.get(roleSubject(kind)) ?? null);
    res.json({
      available: true,
      role,
      kind,
      allowed: allowedSections(role),
      layout,
      source,
      // Only who manages the team sees (and edits) each role's starting home.
      roles: roleCan(role, "team", "full")
        ? HOME_KINDS.map((k) => ({ kind: k, allowed: allowedSections(HOME_KIND_ROLE[k]), layout: startingLayout(k, bySubject.get(roleSubject(k)) ?? null), custom: bySubject.has(roleSubject(k)) }))
        : null,
    });
  } catch (err) {
    if (!missingTable(err)) {
      req.log.error({ err }, "Error loading home layout");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    const { layout } = effectiveLayout(role, null, null);
    res.json({ available: false, role, kind, allowed: allowedSections(role), layout, source: "builtin", roles: null });
  }
});

// PUT /api/home — my own layout
router.put("/home", requireAuth, writeLimiter, async (req, res) => {
  const parsed = layoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid layout" });
    return;
  }
  const role = getActorRole(res);
  const { layout: start } = effectiveLayout(role, null, null);
  const layout = normalizeHomeLayout(parsed.data, allowedSections(role), start);
  try {
    await saveHomeLayout(getUserId(res), userSubject(getActorUserId(res)), layout);
    res.json({ layout });
  } catch (err) {
    if (missingTable(err)) {
      res.status(503).json(NOT_AVAILABLE);
      return;
    }
    req.log.error({ err }, "Error saving home layout");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/home — back to my role's starting home
router.delete("/home", requireAuth, writeLimiter, async (req, res) => {
  try {
    await db.delete(homeLayoutsTable).where(and(eq(homeLayoutsTable.userId, getUserId(res)), eq(homeLayoutsTable.subject, userSubject(getActorUserId(res)))));
    res.json({ success: true });
  } catch (err) {
    if (missingTable(err)) {
      res.json({ success: true });
      return;
    }
    req.log.error({ err }, "Error resetting home layout");
    res.status(500).json({ error: "Internal server error" });
  }
});

const kindParam = z.enum(HOME_KINDS);

// PUT /api/home/roles/:kind — the starting home of a kind of role
router.put("/home/roles/:kind", requireAuth, requirePermission("team", "full"), writeLimiter, async (req, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  const parsed = layoutSchema.safeParse(req.body);
  if (!kind.success || !parsed.success) {
    res.status(400).json({ error: "Invalid layout" });
    return;
  }
  const layout = normalizeHomeLayout(parsed.data, allowedSections(HOME_KIND_ROLE[kind.data]), startingLayout(kind.data, null));
  try {
    await saveHomeLayout(getUserId(res), roleSubject(kind.data), layout);
    res.json({ layout });
  } catch (err) {
    if (missingTable(err)) {
      res.status(503).json(NOT_AVAILABLE);
      return;
    }
    req.log.error({ err }, "Error saving role home layout");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/home/roles/:kind — back to PrevAI's starting home for that kind
router.delete("/home/roles/:kind", requireAuth, requirePermission("team", "full"), writeLimiter, async (req, res) => {
  const kind = kindParam.safeParse(req.params.kind);
  if (!kind.success) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  try {
    await db.delete(homeLayoutsTable).where(and(eq(homeLayoutsTable.userId, getUserId(res)), eq(homeLayoutsTable.subject, roleSubject(kind.data))));
    res.json({ success: true });
  } catch (err) {
    if (missingTable(err)) {
      res.json({ success: true });
      return;
    }
    req.log.error({ err }, "Error resetting role home layout");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
