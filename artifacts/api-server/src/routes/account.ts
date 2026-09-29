import { Router } from "express";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { requireAuth, getUserId, getActorUserId, getUserEmail, getUserName } from "../middlewares/authMiddleware.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { GRACE_DAYS, cancelDeletion, deletionAvailable, deletionBlocker, pendingDeletionFor, requestDeletion } from "../account/deletion.js";
import { EXPORT_TTL_DAYS, advanceExport, createExport, exportAvailable, getExport, listExports, nextExportAllowedAt, ownsCompany, partDownloadUrl } from "../account/export.js";
import { storageConfigured } from "../account/storageFiles.js";
import { recordSecurityAuditEvent } from "../lib/auditLog.js";
import { db, businessProfilesTable, type AccountDeletion, type AccountExport } from "@workspace/db";
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

// ── GDPR-1: "Scarica i tuoi dati" (art. 20) ─────────────────────────────────
// - GET  /api/account/export                    stato: si può chiedere? le ultime 3 esportazioni
// - POST /api/account/export                    chiede l'esportazione (password), la prepara finché c'è tempo
// - POST /api/account/export/:id/continue       la pagina aperta la porta avanti (il cron fa lo stesso)
// - GET  /api/account/export/:id/parts/:n       link firmato di 5 minuti a una parte dello ZIP
//
// Solo il titolare che agisce come se stesso: l'esportazione è l'impresa
// intera (clienti, preventivi, file). Chi lavora in una squadra chiede i dati
// dell'impresa al titolare, i propri a privacy@.

const exportDto = (r: AccountExport) => ({
  id: r.id,
  stato: r.stato,
  createdAt: r.createdAt.toISOString(),
  readyAt: r.readyAt?.toISOString() ?? null,
  expiresAt: r.expiresAt?.toISOString() ?? null,
  parts: r.stato === "pronta" ? r.parts.map((p) => ({ n: p.n, kind: p.kind, bytes: p.bytes, files: p.files })) : [],
  fileCount: r.fileCount,
  filesDone: r.fileCount === null ? 0 : r.fileCount - (r.pendingFiles?.length ?? r.fileCount),
  tableCount: r.tableCount,
  rowCount: r.rowCount,
  totalBytes: r.totalBytes,
  skippedFiles: r.skippedFiles,
});

/** L'impresa da esportare, se chi chiede ne è il titolare e agisce come se stesso. */
async function exporter(res: Parameters<typeof getUserId>[0]): Promise<string | null> {
  const actorId = getActorUserId(res);
  return getUserId(res) === actorId && (await ownsCompany(actorId)) ? actorId : null;
}

const exportReady = async () => storageConfigured() && (await exportAvailable());

router.get("/account/export", requireAuth, async (req, res) => {
  try {
    const base = { available: false, canExport: false, ttlDays: EXPORT_TTL_DAYS, nextAllowedAt: null as string | null, exports: [] as ReturnType<typeof exportDto>[] };
    if (!(await exportReady())) {
      res.json(base);
      return;
    }
    const userId = await exporter(res);
    if (!userId) {
      res.json({ ...base, available: true });
      return;
    }
    const [next, rows] = await Promise.all([nextExportAllowedAt(userId), listExports(userId)]);
    res.json({ ...base, available: true, canExport: true, nextAllowedAt: next?.toISOString() ?? null, exports: rows.map(exportDto) });
  } catch (err) {
    req.log.error({ err }, "Error loading account export status");
    res.status(500).json({ error: "Failed to load account export status" });
  }
});

const exportPasswordLimiter = userRateLimiter({ name: "account.exportPasswordLimiter", windowMs: 15 * 60_000, max: 5, message: "Troppi tentativi: riprova tra un quarto d'ora." });

router.post("/account/export", requireAuth, exportPasswordLimiter, async (req, res) => {
  const parsed = z.object({ password: z.string().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", message: "Scrivi la tua password per confermare." });
    return;
  }
  try {
    if (!(await exportReady())) {
      res.status(503).json({ error: "not_available", message: "L'esportazione dall'app non è ancora attiva: scrivi a privacy@prevai.it e te la mandiamo noi." });
      return;
    }
    const userId = await exporter(res);
    if (!userId) {
      res.status(403).json({ error: "owner_only", message: "Solo il titolare può scaricare i dati dell'impresa. Per i tuoi dati personali scrivi a privacy@prevai.it." });
      return;
    }
    const next = await nextExportAllowedAt(userId);
    if (next) {
      const when = next.toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      res.status(429).json({ error: "too_soon", message: `Puoi chiedere una nuova esportazione dal ${when}.`, nextAllowedAt: next.toISOString() });
      return;
    }
    try {
      await auth.api.verifyPassword({ body: { password: parsed.data.password }, headers: fromNodeHeaders(req.headers) });
    } catch {
      res.status(403).json({ error: "wrong_password", message: "Password sbagliata." });
      return;
    }
    const row = await createExport({ userId, requestedByUserId: userId, email: getUserEmail(res) });
    await recordSecurityAuditEvent({ orgId: userId, actorUserId: userId, action: "account.export_requested", entityType: "account_export", entityId: row.id, ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null });
    // Una prima tranche qui (quasi sempre basta); il resto lo porta avanti la pagina aperta o il cron.
    const advanced = await advanceExport(row.id, 20_000);
    res.status(201).json({ export: exportDto(advanced ?? row) });
  } catch (err) {
    req.log.error({ err }, "Error requesting account export");
    res.status(500).json({ error: "Failed to request account export" });
  }
});

router.post("/account/export/:id/continue", requireAuth, async (req, res) => {
  try {
    const userId = (await exportReady()) ? await exporter(res) : null;
    const row = userId ? await getExport(userId, String(req.params.id)) : null;
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const current = row.stato === "in_preparazione" ? await advanceExport(row.id) : row;
    res.json({ export: exportDto(current ?? row) });
  } catch (err) {
    req.log.error({ err }, "Error advancing account export");
    res.status(500).json({ error: "Failed to advance account export" });
  }
});

router.get("/account/export/:id/parts/:n", requireAuth, async (req, res) => {
  try {
    const userId = (await exportReady()) ? await exporter(res) : null;
    const n = Number(req.params.n);
    const url = userId && Number.isInteger(n) ? await partDownloadUrl(userId, String(req.params.id), n) : null;
    if (!url) {
      res.status(404).json({ error: "not_found", message: "Questa esportazione non è più disponibile: chiedine una nuova." });
      return;
    }
    await recordSecurityAuditEvent({ orgId: userId!, actorUserId: userId, action: "account.export_downloaded", entityType: "account_export", entityId: String(req.params.id), ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null });
    res.json({ url });
  } catch (err) {
    req.log.error({ err }, "Error creating account export link");
    res.status(500).json({ error: "Failed to create download link" });
  }
});

export default router;
