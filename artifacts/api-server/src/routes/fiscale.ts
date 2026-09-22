import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable, hasFeature, REGIMI_CONTABILI, FISCO_ONBOARDING_STEPS, TIPI_VERSAMENTO } from "@workspace/db";
import { anniDisponibili, coefficienteDiAteco, GESTIONI_PREVIDENZIALI, MESTIERI_ATECO, RIDUZIONI_CONTRIBUTIVE } from "@workspace/config";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import {
  AVVISO_NON_CONSULENZA,
  ErroreFiscale,
  VERSIONE_AVVISO,
  aggiornaProfilo,
  calcoloCorrente,
  eliminaVersamento,
  profiloOCrea,
  registraVersamento,
  serializzaProfilo,
  simulazione,
  statoRevisione,
  versamentiDi,
} from "../fiscale/service.js";

const router = Router();
const simulaLimiter = userRateLimiter({ windowMs: 60_000, max: 60, message: "Troppe simulazioni al minuto" });

// ── A-2: API del motore fiscale forfettario ──────────────────────────────────
// Stesso gate del modulo Fatture SDI, con una feature propria: chi compra
// l'add-on Amministrazione ottiene le fatture elettroniche (A-1) e il calcolo
// fiscale (A-2), ma le due si accendono separatamente perché un'impresa in
// regime ordinario vuole la prima e non la seconda.
//
// Nessuna rotta qui dentro dispone un pagamento, invia una dichiarazione o dà
// un consiglio personalizzato: restituiscono numeri con la loro formula. È la
// linea che tiene la fase 1 fuori dall'art. 348 c.p. (AMMINISTRAZIONE-PLAN §5).

async function moduloOForbidden(userId: string, res: import("express").Response): Promise<boolean> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "fiscal_engine")) return true;
  res.status(403).json({
    error: "FISCAL_MODULE_OFF",
    message: "Il calcolo fiscale non è attivo su questo account.",
  });
  return false;
}

function erroreFiscale(err: unknown, res: import("express").Response): void {
  if (err instanceof ErroreFiscale) {
    res.status(err.codice === "not_found" ? 404 : 400).json({ error: err.codice.toUpperCase(), message: err.message });
    return;
  }
  throw err;
}

function annoDi(req: import("express").Request): number {
  const grezzo = Number(req.query.anno);
  const corrente = new Date().getUTCFullYear();
  if (!Number.isFinite(grezzo)) return corrente;
  return Math.min(corrente + 1, Math.max(2015, Math.trunc(grezzo)));
}

// ── Profilo e onboarding ─────────────────────────────────────────────────────

router.get("/fiscale/profilo", requireAuth, requirePermission("fiscale", "view"), async (_req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const profilo = await profiloOCrea(userId);
  res.json({
    profilo: serializzaProfilo(profilo),
    avviso: { testo: AVVISO_NON_CONSULENZA, versione: VERSIONE_AVVISO },
    opzioni: {
      regimi: REGIMI_CONTABILI,
      gestioni: GESTIONI_PREVIDENZIALI,
      riduzioni: RIDUZIONI_CONTRIBUTIVE,
      passi: FISCO_ONBOARDING_STEPS,
      mestieri: MESTIERI_ATECO,
      anniRegole: anniDisponibili(),
    },
  });
});

const patchSchema = z.object({
  regime: z.enum(REGIMI_CONTABILI).optional(),
  codiceAteco: z.string().trim().max(20).optional(),
  coefficientePercent: z.number().int().min(0).max(100).optional(),
  gestione: z.enum(GESTIONI_PREVIDENZIALI).optional(),
  riduzione: z.enum(RIDUZIONI_CONTRIBUTIVE).optional(),
  annoInizioAttivita: z.number().int().nullable().optional(),
  requisitiStartup: z.boolean().optional(),
  ricaviAnnoPrecedenteCents: z.number().int().min(0).optional(),
  speseLavoroCents: z.number().int().min(0).optional(),
  redditoDipendenteCents: z.number().int().min(0).optional(),
  impostaAnnoPrecedenteCents: z.number().int().min(0).optional(),
  margineSicurezzaPercent: z.number().int().min(0).max(100).optional(),
  accettaAvviso: z.boolean().optional(),
  passoCompletato: z.enum(FISCO_ONBOARDING_STEPS).optional(),
});

router.patch("/fiscale/profilo", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Dati non validi", dettagli: parsed.error.issues });
    return;
  }
  try {
    const profilo = await aggiornaProfilo(userId, parsed.data);
    res.json({ profilo: serializzaProfilo(profilo) });
  } catch (err) {
    erroreFiscale(err, res);
  }
});

/** Coefficiente di un codice ATECO, senza salvare nulla: serve all'onboarding mentre si digita. */
router.get("/fiscale/ateco", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const codice = String(req.query.codice ?? "");
  res.json({ codice, ...coefficienteDiAteco(codice) });
});

// ── Calcolo ──────────────────────────────────────────────────────────────────

router.get("/fiscale/calcolo", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req);
  const { calcolo, dati, passiMancanti, requisiti } = await calcoloCorrente(userId, anno);
  res.json({
    anno,
    calcolo,
    dati,
    passiMancanti,
    requisiti,
    // Ripetuto a ogni risposta apposta: un client che dimentica di leggerlo
    // mostrerebbe numeri fiscali senza dire da dove vengono.
    revisione: statoRevisione(anno),
    avviso: { testo: AVVISO_NON_CONSULENZA, versione: VERSIONE_AVVISO },
  });
});

/** Stato della revisione professionale del motore, regola per regola. */
router.get("/fiscale/regole", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  res.json({ ...statoRevisione(annoDi(req)), anniDisponibili: anniDisponibili() });
});

const simulaSchema = z.object({
  importoCents: z.number().int().min(0).max(100_000_000),
  anno: z.number().int().optional(),
});

router.post("/fiscale/simula", requireAuth, requirePermission("fiscale", "view"), simulaLimiter, async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const parsed = simulaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Importo non valido", dettagli: parsed.error.issues });
    return;
  }
  const anno = parsed.data.anno ?? new Date().getUTCFullYear();
  const simulata = await simulazione(userId, anno, parsed.data.importoCents);
  res.json({
    importoCents: simulata.importoCents,
    deltaImpostaCents: simulata.deltaImpostaCents,
    deltaContributiCents: simulata.deltaContributiCents,
    nettoCents: simulata.nettoCents,
    nettoPercent: simulata.nettoPercent,
    cambiaLaSoglia: simulata.cambiaLaSoglia,
    avviso: simulata.avviso,
    sogliaPrima: simulata.attuale.soglia,
    sogliaDopo: simulata.conIlLavoro.soglia,
    revisione: statoRevisione(anno),
  });
});

// ── Versamenti ───────────────────────────────────────────────────────────────

router.get("/fiscale/versamenti", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req);
  const righe = await versamentiDi(userId, anno);
  res.json({
    anno,
    versamenti: righe.map((v) => ({
      id: v.id,
      anno: v.anno,
      tipo: v.tipo,
      data: v.data.toISOString(),
      importoCents: v.importoCents,
      codiceTributo: v.codiceTributo,
      riferimento: v.riferimento,
      note: v.note,
      origine: v.origine,
    })),
    tipi: TIPI_VERSAMENTO,
  });
});

const versamentoSchema = z.object({
  anno: z.number().int().min(2015).max(2100),
  tipo: z.enum(TIPI_VERSAMENTO),
  data: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  importoCents: z.number().int().min(1),
  codiceTributo: z.string().trim().max(10).optional(),
  riferimento: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

router.post("/fiscale/versamenti", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const parsed = versamentoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Dati non validi", dettagli: parsed.error.issues });
    return;
  }
  try {
    const data = new Date(parsed.data.data.length === 10 ? `${parsed.data.data}T12:00:00.000Z` : parsed.data.data);
    if (Number.isNaN(data.getTime())) {
      res.status(400).json({ error: "INVALID", message: "Data non valida" });
      return;
    }
    const riga = await registraVersamento({ ...parsed.data, userId, data });
    res.status(201).json({ id: riga.id });
  } catch (err) {
    erroreFiscale(err, res);
  }
});

router.delete("/fiscale/versamenti/:id", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  try {
    await eliminaVersamento(userId, req.params.id);
    res.status(204).end();
  } catch (err) {
    erroreFiscale(err, res);
  }
});

export default router;
