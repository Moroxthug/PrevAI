import { Router } from "express";
import { z } from "zod";
import { INTERVALLI_ADDON } from "@workspace/config";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { requireAdmin } from "./admin.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { logger } from "../lib/logger.js";
import { ErroreAddon, creaCheckout, registraEventoUtente, riepilogo, risultatiTestPrezzo } from "../addons/amministrazione.js";

// ── A-5: add-on Amministrazione ──────────────────────────────────────────────
// Paywall, test di prezzo e checkout. Chi vede l'offerta è chi può vedere la
// fatturazione dell'impresa (`settings: view`); chi compra è chi la gestisce
// (`settings: full`), come per il piano.

const router = Router();
const checkoutLimiter = userRateLimiter({ windowMs: 60 * 60_000, max: 20, message: "Troppi tentativi di pagamento in un'ora" });

function errore(err: unknown, res: import("express").Response, cosa: string): void {
  if (err instanceof ErroreAddon) {
    res.status(err.status).json({ error: err.codice, message: err.message });
    return;
  }
  logger.error({ err }, cosa);
  res.status(500).json({ error: "Internal server error" });
}

router.get("/addons/amministrazione", requireAuth, requirePermission("settings", "view"), async (_req, res) => {
  try {
    res.json(await riepilogo(getUserId(res)));
  } catch (err) {
    errore(err, res, "Errore nel riepilogo dell'add-on");
  }
});

const eventoSchema = z.object({
  tipo: z.enum(["vista", "interesse"]),
  /** Il `?v=` della landing, se l'utente è arrivato da una campagna. */
  campagna: z.string().trim().max(8).optional().nullable(),
});

router.post("/addons/amministrazione/eventi", requireAuth, requirePermission("settings", "view"), async (req, res) => {
  const parsed = eventoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    res.json(await registraEventoUtente(getUserId(res), parsed.data.tipo, parsed.data.campagna));
  } catch (err) {
    errore(err, res, "Errore nella registrazione dell'evento add-on");
  }
});

const checkoutSchema = z.object({ intervallo: z.enum(INTERVALLI_ADDON) });

router.post("/addons/amministrazione/checkout", requireAuth, requirePermission("settings", "full"), checkoutLimiter, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  try {
    res.json(await creaCheckout({ userId: getUserId(res), intervallo: parsed.data.intervallo, twoFactorEnabled: Boolean(res.locals.twoFactorEnabled) }));
  } catch (err) {
    errore(err, res, "Errore nel checkout dell'add-on");
  }
});

// Solo staff PrevAI (ADMIN_EMAIL): i numeri del test di prezzo per variante.
router.get("/admin/addons/test-prezzo", requireAdmin, async (_req, res) => {
  try {
    res.json(await risultatiTestPrezzo());
  } catch (err) {
    errore(err, res, "Errore nei risultati del test di prezzo");
  }
});

export default router;
