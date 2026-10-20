import { Router } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, appFeedbackTable, businessProfilesTable, FEEDBACK_KINDS } from "@workspace/db";
import { requireAuth, getUserId, getActorUserId, getUserEmail } from "../middlewares/authMiddleware.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { sendOpsAlert } from "../lib/ops.js";

// ── POCKET-5 (riga 62, QuoteAI 128.6): «Invia un parere» dall'app ────────────
// POST /api/feedback — multipart { kind, note, replyOk, includeLogs, appVersion, device, screen, markup, screenshot? }. Finisce nella stessa tabella
// delle segnalazioni della beta (app_feedback, APP-5) e nel suo pannello per lo staff, e arriva allo staff con l'avviso ops; la persona vede il
// riferimento corto (FB-…). I «dati tecnici» sono la versione dell'app, il telefono e la schermata: mai dati dei clienti.

const router = Router();
const storage = new ObjectStorageService();
const limiter = userRateLimiter({ name: "feedback.limiter", windowMs: 60 * 60 * 1000, max: 20, message: "Troppi messaggi in un'ora. Riprova più tardi." });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype) ? cb(null, true) : cb(new Error("Usa una schermata JPG, PNG o WebP."))),
});

const Fields = z.object({
  kind: z.enum(FEEDBACK_KINDS).default("wrong"),
  note: z.string().trim().max(4000).default(""),
  replyOk: z.enum(["true", "false"]).default("true"),
  includeLogs: z.enum(["true", "false"]).default("true"),
  appVersion: z.string().max(40).optional(),
  device: z.string().max(120).optional(),
  screen: z.string().max(120).optional(),
  markup: z.string().max(40_000).optional(),
});

const Strokes = z.array(z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).max(2000)).max(50);

/** The short reference the person is shown: the first six characters of the row's id. */
export const feedbackRef = (id: string): string => `FB-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

router.post(
  "/feedback",
  requireAuth,
  limiter,
  (req, res, next) => {
    upload.single("screenshot")(req, res, (err) => {
      if (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Invalid upload" }); return; }
      next();
    });
  },
  async (req, res) => {
    try {
      const f = Fields.safeParse(req.body ?? {});
      if (!f.success) { res.status(400).json({ error: "Invalid feedback" }); return; }
      if (!f.data.note && !req.file) { res.status(400).json({ error: "Scrivi una nota o aggiungi una schermata." }); return; }
      let markup: number[][][] | null = null;
      if (f.data.markup) {
        try { const p = Strokes.safeParse(JSON.parse(f.data.markup)); if (p.success) markup = p.data as unknown as number[][][]; } catch { /* not JSON: dropped */ }
      }
      const userId = getUserId(res);
      let path: string | null = null;
      if (req.file) {
        const ext = req.file.mimetype === "image/png" ? "png" : req.file.mimetype === "image/webp" ? "webp" : "jpg";
        const sub = `feedback/${userId}/${randomUUID()}.${ext}`;
        await storage.uploadObjectBuffer({ subPath: sub, buffer: req.file.buffer, contentType: req.file.mimetype });
        path = sub;
      }
      const logs = f.data.includeLogs === "true";
      const device = logs ? f.data.device ?? null : null;
      const surface = /ios|iphone|ipad/i.test(device ?? "") ? "ios" : "android";
      const email = getUserEmail(res);
      const [row] = await db.insert(appFeedbackTable).values({
        userId, actorUserId: getActorUserId(res), actorEmail: email, message: f.data.note || "(solo la schermata)", route: logs ? f.data.screen ?? "" : "", surface, viewport: "mobile",
        appVersion: logs ? f.data.appVersion ?? null : null, userAgent: String(req.headers["user-agent"] ?? "").slice(0, 400),
        kind: f.data.kind, replyOk: f.data.replyOk === "true", includeLogs: logs, device, screenshotPath: path, markup,
      }).returning({ id: appFeedbackTable.id });
      const ref = feedbackRef(row!.id);
      const [profile] = await db.select({ companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
      void sendOpsAlert(`Parere dall'app ${ref} (${f.data.kind}): ${profile?.companyName || email}`, [
        f.data.note || "(solo la schermata)",
        "",
        `Da: ${email}${f.data.replyOk === "true" ? " (si può rispondere)" : " (non vuole risposta)"}`,
        logs ? `App ${f.data.appVersion ?? "?"} · ${f.data.device ?? "?"} · schermata ${f.data.screen ?? "?"}` : "Dati tecnici non inclusi",
        path ? `Schermata: ${path}` : "Nessuna schermata",
        `Pannello: https://prevai.it/dashboard/admin → Beta app (id ${row!.id})`,
      ]);
      res.status(201).json({ ref, screenshot: !!path });
    } catch (err) {
      req.log.error({ err }, "Error saving feedback");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
