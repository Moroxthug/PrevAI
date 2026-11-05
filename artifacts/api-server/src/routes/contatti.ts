// PREZZI-2: il modulo pubblico del piano Su misura (/contatti/#su-misura). Salva la richiesta, poi avvisa noi per email.
import { Router } from "express";
import { z } from "zod";
import { db, contattiSuMisuraTable } from "@workspace/db";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { logger } from "../lib/logger.js";
import { sendSuMisuraRequest } from "../lib/email.js";

const router = Router();
const limiter = ipRateLimiter({ name: "contatti.suMisura", windowMs: 60 * 60_000, max: 5, message: "Troppe richieste. Riprova tra un'ora o scrivici a info@prevai.it." });

const body = z.object({
  nome: z.string().trim().min(2).max(120),
  impresa: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200),
  telefono: z.string().trim().max(40).optional(),
  persone: z.string().trim().max(40).optional(),
  messaggio: z.string().trim().max(2000).optional(),
  /** Campo nascosto: lo riempiono solo i bot. */
  sitoWeb: z.string().optional(),
});

router.post("/contatti/su-misura", limiter, async (req, res) => {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Controlla nome, impresa ed email." });
    return;
  }
  const { sitoWeb, ...richiesta } = parsed.data;
  if (sitoWeb) {
    res.status(201).json({ ok: true });
    return;
  }
  try {
    await db.insert(contattiSuMisuraTable).values(richiesta);
    await sendSuMisuraRequest(richiesta).catch((err) => logger.error({ err }, "Su misura: email non partita, la richiesta è salvata"));
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Su misura: richiesta non salvata");
    res.status(500).json({ error: "Internal server error", message: "Non siamo riusciti a inviare. Scrivici a info@prevai.it." });
  }
});

export default router;
