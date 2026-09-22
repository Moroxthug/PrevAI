import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { z } from "zod";
import { db, businessProfilesTable, hasFeature, REGIMI_CONTABILI, FISCO_ONBOARDING_STEPS, TIPI_VERSAMENTO } from "@workspace/db";
import { anniDisponibili, coefficienteDiAteco, GESTIONI_PREVIDENZIALI, MESTIERI_ATECO, motoreRevisionato, regoleDiAnno, RIDUZIONI_CONTRIBUTIVE } from "@workspace/config";
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
import {
  allegaQuietanza,
  annullaVersamento,
  contribuenteDi,
  quietanzaDi,
  riconcilia,
  rimuoviQuietanza,
  scadenzeCalcolate,
  segnaVersata,
} from "../fiscale/scadenzario.js";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage.js";
import { whatsappPromemoriaDisponibile } from "../fiscale/promemoria.js";
import { buildF24Pdf } from "../fiscale/f24pdf.js";
import { prospettoF24 } from "@workspace/config";

const router = Router();
const simulaLimiter = userRateLimiter({ windowMs: 60_000, max: 60, message: "Troppe simulazioni al minuto" });
const objectStorage = new ObjectStorageService();

/** A-3: una quietanza è un PDF o la foto della ricevuta dell'home banking. */
const MIME_QUIETANZA = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
const quietanzaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((MIME_QUIETANZA as readonly string[]).includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Tipo di file non supportato: ${file.mimetype}. Carica un PDF o una foto (JPG, PNG, WEBP).`));
  },
});

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
      // A-3: il canale WhatsApp esiste nel codice ma resta spento finché non
      // c'è un template Meta approvato (D10). L'interfaccia lo dice invece di
      // offrire un interruttore che non accende nulla.
      whatsappDisponibile: whatsappPromemoriaDisponibile(),
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
  // A-3
  matricolaInps: z.string().trim().max(40).optional(),
  sedeInps: z.string().trim().max(10).optional(),
  promemoriaEmail: z.boolean().optional(),
  promemoriaWhatsapp: z.boolean().optional(),
  promemoriaTelefono: z.string().trim().max(30).optional(),
  promemoriaGiorni: z.array(z.number().int().min(0).max(90)).max(8).optional(),
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

// ── A-3: scadenzario ─────────────────────────────────────────────────────────
// Un calendario solo per imposta, contributi, bollo e dichiarazione. Le
// scadenze si ricalcolano a ogni lettura: quello che si conserva è soltanto
// lo stato (versata, quietanza, promemoria già partiti).

router.get("/fiscale/scadenzario", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req);
  const scadenzario = await riconcilia(userId, anno);
  const profilo = await profiloOCrea(userId);
  res.json({
    ...scadenzario,
    promemoria: {
      email: profilo.promemoriaEmail,
      whatsapp: profilo.promemoriaWhatsapp,
      telefono: profilo.promemoriaTelefono,
      giorni: profilo.promemoriaGiorni,
      whatsappDisponibile: whatsappPromemoriaDisponibile(),
    },
    revisione: statoRevisione(anno),
    avviso: { testo: AVVISO_NON_CONSULENZA, versione: VERSIONE_AVVISO },
  });
});

const versataSchema = z.object({
  anno: z.number().int().min(2015).max(2100),
  data: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  importoCents: z.number().int().min(0).optional(),
  riferimento: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

router.post("/fiscale/scadenzario/:chiave/versata", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const parsed = versataSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Dati non validi", dettagli: parsed.error.issues });
    return;
  }
  const data = new Date(parsed.data.data.length === 10 ? `${parsed.data.data}T12:00:00.000Z` : parsed.data.data);
  if (Number.isNaN(data.getTime())) {
    res.status(400).json({ error: "INVALID", message: "Data non valida" });
    return;
  }
  try {
    const esito = await segnaVersata({ userId, anno: parsed.data.anno, chiave: req.params.chiave, data, importoCents: parsed.data.importoCents, riferimento: parsed.data.riferimento, note: parsed.data.note });
    res.json(esito);
  } catch (err) {
    erroreFiscale(err, res);
  }
});

router.post("/fiscale/scadenzario/:chiave/riapri", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req);
  await annullaVersamento({ userId, anno, chiave: req.params.chiave });
  res.status(204).end();
});

/**
 * Quietanza: la ricevuta del versamento, caricata dall'impresa. Stesso
 * meccanismo degli scontrini (routes/costs.ts) — il file va nello storage
 * privato e nel database resta il percorso. Qui però **non passa dall'IA**:
 * una quietanza è una prova, non un dato da estrarre.
 */
router.post(
  "/fiscale/scadenzario/:chiave/quietanza",
  requireAuth,
  requirePermission("fiscale", "full"),
  (req, res, next) => {
    quietanzaUpload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError || err instanceof Error) {
        res.status(400).json({ error: "INVALID", message: err.message });
        return;
      }
      next(err);
    });
  },
  async (req, res) => {
    const userId = getUserId(res);
    if (!(await moduloOForbidden(userId, res))) return;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "INVALID", message: "Nessun file caricato." });
      return;
    }
    const anno = Number(req.body?.anno);
    if (!Number.isFinite(anno) || anno < 2015 || anno > 2100) {
      res.status(400).json({ error: "INVALID", message: "Anno non valido." });
      return;
    }
    try {
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[file.mimetype] ?? "bin";
      const subPath = `quietanze/${userId}/${randomUUID()}.${ext}`;
      const url = await objectStorage.uploadObjectBuffer({ subPath, buffer: file.buffer, contentType: file.mimetype });
      await allegaQuietanza({ userId, anno, chiave: req.params.chiave, url, nome: file.originalname });
      res.status(201).json({ nome: file.originalname });
    } catch (err) {
      erroreFiscale(err, res);
    }
  },
);

/** Il file della quietanza, solo al proprietario. */
router.get("/fiscale/scadenzario/:chiave/quietanza/file", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const riga = await quietanzaDi(userId, annoDi(req), req.params.chiave);
  if (!riga) {
    res.status(404).json({ error: "NOT_FOUND", message: "Nessuna quietanza allegata a questa scadenza." });
    return;
  }
  try {
    const file = await objectStorage.downloadPrivateObject(riga.url.replace("/objects/", ""));
    res.status(file.status);
    file.headers.forEach((v, k) => res.setHeader(k, v));
    res.setHeader("Content-Disposition", `inline; filename="${riga.nome.replace(/"/g, "")}"`);
    if (file.body) Readable.fromWeb(file.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "NOT_FOUND", message: "File non trovato." });
      return;
    }
    throw err;
  }
});

router.delete("/fiscale/scadenzario/:chiave/quietanza", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  await rimuoviQuietanza({ userId, anno: annoDi(req), chiave: req.params.chiave });
  res.status(204).end();
});

/**
 * Prospetto F24 di una scadenza, in JSON o in PDF. **Precompilato, non
 * pagato**: PrevAI prepara i campi, il versamento lo dispone l'impresa.
 */
async function prospettoDi(userId: string, anno: number, chiave: string) {
  const scadenze = await scadenzeCalcolate(userId, anno);
  const scadenza = scadenze.find((s) => s.id === chiave);
  if (!scadenza) return null;
  const profilo = await profiloOCrea(userId);
  const contribuente = await contribuenteDi(userId, profilo);
  return prospettoF24(scadenza, contribuente, { revisionato: motoreRevisionato(regoleDiAnno(anno)) });
}

router.get("/fiscale/scadenzario/:chiave/f24", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req);
  const prospetto = await prospettoDi(userId, anno, req.params.chiave);
  if (!prospetto) {
    res.status(404).json({ error: "NOT_FOUND", message: "Questa scadenza non esiste per l'anno indicato." });
    return;
  }
  res.json({ anno, prospetto, revisione: statoRevisione(anno) });
});

router.get("/fiscale/scadenzario/:chiave/f24.pdf", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req);
  const prospetto = await prospettoDi(userId, anno, req.params.chiave);
  if (!prospetto) {
    res.status(404).json({ error: "NOT_FOUND", message: "Questa scadenza non esiste per l'anno indicato." });
    return;
  }
  const { buffer, filename } = await buildF24Pdf(prospetto);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
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
