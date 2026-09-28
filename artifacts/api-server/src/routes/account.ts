import { Router } from "express";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { requireAuth, getUserId, getActorUserId, getUserEmail, getUserName } from "../middlewares/authMiddleware.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { GRACE_DAYS, cancelDeletion, deletionAvailable, deletionBlocker, pendingDeletionFor, requestDeletion } from "../account/deletion.js";
import { db, businessProfilesTable, type AccountDeletion } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── APP-1c: cancellazione dell'account in autonomia ─────────────────────────
// - GET    /api/account/deletion  stato: la propria richiesta e quella del titolare dell'impresa in cui si lavora
// - POST   /api/account/deletion  chiede la cancellazione (password + "ELIMINA")
// - DELETE /api/account/deletion  annulla durante i 30 giorni
//
// Riguarda sempre la PERSONA (actor), non l'impresa in cui sta lavorando: un
// membro della squadra cancella il proprio accesso, il titolare anche l'impresa.
// Nessun permesso di ruolo: è un diritto di ognuno sul proprio account
// (route-matrix.test → PERMISSIONLESS_MUTATIONS).

const router = Router();

const dto = (r: AccountDeletion) => ({
  id: r.id,
  requestedAt: r.requestedAt.toISOString(),
  scheduledFor: r.scheduledFor.toISOString(),
  ownsOrg: r.ownsOrg,
});

router.get("/account/deletion", requireAuth, async (req, res) => {
  try {
    if (!(await deletionAvailable())) {
      res.json({ available: false, graceDays: GRACE_DAYS, ownsOrg: false, own: null, org: null });
      return;
    }
    const actorId = getActorUserId(res);
    const orgId = getUserId(res);
    const own = await pendingDeletionFor(actorId);
    const org = orgId !== actorId ? await pendingDeletionFor(orgId) : null;
    // Titolare di un'impresa? Allora con l'account se ne va anche l'impresa (la pagina lo dice prima).
    const [profile] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, actorId));
    res.json({ available: true, graceDays: GRACE_DAYS, ownsOrg: Boolean(profile), own: own ? dto(own) : null, org: org ? { scheduledFor: org.scheduledFor.toISOString() } : null });
  } catch (err) {
    req.log.error({ err }, "Error loading account deletion status");
    res.status(500).json({ error: "Failed to load account deletion status" });
  }
});

const passwordLimiter = userRateLimiter({ name: "account.passwordLimiter", windowMs: 15 * 60_000, max: 5, message: "Troppi tentativi: riprova tra un quarto d'ora." });

const requestSchema = z.object({
  password: z.string().min(1).max(200),
  confirm: z.literal("ELIMINA"),
  reason: z.string().max(500).optional(),
});

router.post("/account/deletion", requireAuth, passwordLimiter, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", message: "Scrivi ELIMINA e la tua password per confermare." });
    return;
  }
  try {
    if (!(await deletionAvailable())) {
      res.status(503).json({ error: "not_available", message: "La cancellazione dall'app non è ancora attiva: scrivi a privacy@prevai.it e la facciamo noi." });
      return;
    }
    const actorId = getActorUserId(res);
    if (await pendingDeletionFor(actorId)) {
      res.status(409).json({ error: "already_requested", message: "La cancellazione è già stata chiesta." });
      return;
    }
    const blocker = await deletionBlocker(actorId);
    if (blocker) {
      res.status(409).json({ error: "blocked", message: blocker });
      return;
    }
    const headers = fromNodeHeaders(req.headers);
    try {
      await auth.api.verifyPassword({ body: { password: parsed.data.password }, headers });
    } catch {
      res.status(403).json({ error: "wrong_password", message: "Password sbagliata." });
      return;
    }
    const session = await auth.api.getSession({ headers });
    const row = await requestDeletion({
      subjectUserId: actorId,
      email: getUserEmail(res),
      name: getUserName(res),
      keepSessionId: session?.session.id ?? null,
      reason: parsed.data.reason ?? null,
    });
    res.status(201).json({ own: dto(row) });
  } catch (err) {
    req.log.error({ err }, "Error requesting account deletion");
    res.status(500).json({ error: "Failed to request account deletion" });
  }
});

router.delete("/account/deletion", requireAuth, async (req, res) => {
  try {
    if (!(await deletionAvailable())) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const row = await cancelDeletion({ subjectUserId: getActorUserId(res), name: getUserName(res) });
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Non c'è nessuna cancellazione da annullare." });
      return;
    }
    res.json({ own: null });
  } catch (err) {
    req.log.error({ err }, "Error cancelling account deletion");
    res.status(500).json({ error: "Failed to cancel account deletion" });
  }
});

export default router;
