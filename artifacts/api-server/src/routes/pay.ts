import { Router } from "express";
import { z } from "zod";
import { requireAuth, getUserId, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { oggiItalia } from "../primanota/mese.js";
import { effective, loadSettings, payCsv, periodReport, recordExport, saveSettings } from "../pay/service.js";

// ── POCKET-4 (riga 61, QuoteAI 127.2): ore e costo del lavoro ────────────────
// Le paghe di un dipendente (quanto costa, che tariffa ha) non sono per ufficio, capocantiere o ospite: stessa
// regola dell'area «team» a livello pieno (titolare e amministratore). Nessuna rotta paga o invia niente: il file
// di ore lo scarica il titolare e lo manda lui al consulente del lavoro.

const router = Router();

const settingsSchema = z.object({
  frequency: z.enum(["weekly", "biweekly", "monthly"]).optional(),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  overtimeWeeklyHours: z.number().min(1).max(80).nullable().optional(),
  overtimeMultiplier: z.number().min(1).max(3).optional(),
  payrollCodes: z.record(z.string().uuid(), z.string().trim().max(30)).optional(),
});

router.get("/pay/settings", requireAuth, requirePermission("team", "full"), async (_req, res) => {
  const settings = await loadSettings(getUserId(res));
  res.json({ enabled: true, settings, effective: effective(settings), today: oggiItalia() });
});

router.put("/pay/settings", requireAuth, requirePermission("team", "full"), async (req, res) => {
  const p = settingsSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: "INVALID", message: "Dati non validi", dettagli: p.error.issues });
    return;
  }
  const userId = getUserId(res);
  await saveSettings(userId, p.data);
  res.json({ enabled: true, settings: p.data, effective: effective(p.data), today: oggiItalia() });
});

router.get("/pay/period", requireAuth, requirePermission("team", "full"), async (req, res) => {
  res.json(await periodReport(getUserId(res), typeof req.query.date === "string" ? req.query.date : undefined));
});

router.get("/pay/export.csv", requireAuth, requirePermission("team", "full"), async (req, res) => {
  const userId = getUserId(res);
  const report = await periodReport(userId, typeof req.query.date === "string" ? req.query.date : undefined);
  await recordExport({ userId, periodStart: report.period.start, report, actorName: getUserName(res) });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ore-${report.period.start}.csv"`);
  res.send(payCsv(report));
});

export default router;
