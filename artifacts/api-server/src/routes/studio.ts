import { createHash, randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { SEZIONI_ALBO, documentoInTesto, type AzionePratica } from "@workspace/config";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { requireAuth, getActorUserId } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "./admin.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { chiusuraDi, pacchettoAnno, statoChiusura, guida } from "../primanota/chiusura.js";
import { primaNota, primaNotaCsv } from "../primanota/service.js";
import { buildPacchettoPdf } from "../primanota/pdf.js";
import {
  accettaIncarico,
  aggiornaCompenso,
  assegnaManualmente,
  azioneProfessionista,
  chiudiDaProfessionista,
  compensi,
  convenzioneDi,
  differenzaChiusura,
  elencoProfessionisti,
  eventiIncarico,
  filePratica,
  firmaConvenzione,
  incarichiDelProfessionista,
  incaricoPerProfessionista,
  messaggi,
  praticaDi,
  professionistaDiUtente,
  richiesteDaAssegnare,
  salvaCandidatura,
  scriviMessaggio,
  serializzaIncarico,
  serializzaPratica,
  serializzaProfessionista,
  sospendiProfessionista,
  statoServizioOra,
  verificaProfessionista,
  ErroreFiscale,
  type ContestoProfessionista,
} from "../commercialista/service.js";
import { erroreCommercialista, inviaFile } from "./commercialista.js";

// ── A-6: lo studio del professionista (/api/studio) e l'amministrazione ──────
// Il professionista è una persona, non un'impresa: tutto qui ruota attorno
// all'utente che agisce (`getActorUserId`), non all'organizzazione attiva.
//
// Tre controlli, in quest'ordine, su ogni rotta che tocca un cliente:
//   1. verifica in due passaggi attiva sull'account del professionista — sono
//      i conti di altre persone;
//   2. professionista operativo adesso (iscrizione verificata, Entratel,
//      polizza RC valida, convenzione firmata);
//   3. incarico suo, attivo, e cliente che ha ancora il servizio.
// Ogni lettura dei dati del cliente finisce negli eventi dell'incarico, che il
// cliente vede.

const router = Router();
const objectStorage = new ObjectStorageService();
const messaggiLimiter = userRateLimiter({ windowMs: 60_000, max: 30, message: "Troppi messaggi al minuto" });

const MIME_DOCUMENTO = ["application/pdf", "image/jpeg", "image/png", "application/xml", "text/xml", "text/plain"] as const;
const documentoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((MIME_DOCUMENTO as readonly string[]).includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Tipo di file non supportato: ${file.mimetype}. Carica un PDF, un'immagine o il file della ricevuta.`));
  },
});

/** Carica il professionista dell'utente e controlla la verifica in due passaggi. */
async function studio(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!res.locals.twoFactorEnabled) {
    res.status(403).json({ error: "TWO_FACTOR_NEEDED", message: "Lo studio richiede la verifica in due passaggi sul tuo account: attivala in Impostazioni → Sicurezza." });
    return;
  }
  const professionista = await professionistaDiUtente(getActorUserId(res));
  if (!professionista) {
    res.status(404).json({ error: "NO_PROFILE", message: "Non hai ancora un profilo da professionista." });
    return;
  }
  res.locals.contesto = { professionista, actorUserId: getActorUserId(res), ip: req.ip ?? null };
  next();
}

const ctx = (res: Response): ContestoProfessionista => res.locals.contesto;

function riservato(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

// ── Profilo, candidatura, convenzione ────────────────────────────────────────

/** Senza 2FA: serve alla pagina per dire che cosa manca. */
router.get("/studio/profilo", requireAuth, async (_req, res) => {
  const p = await professionistaDiUtente(getActorUserId(res));
  const convenzione = p ? convenzioneDi(p) : null;
  const servizio = await statoServizioOra();
  res.json({
    twoFactorEnabled: Boolean(res.locals.twoFactorEnabled),
    professionista: p ? serializzaProfessionista(p) : null,
    convenzione: convenzione ? { documento: convenzione, impronta: createHash("sha256").update(documentoInTesto(convenzione)).digest("hex") } : null,
    sezioniAlbo: SEZIONI_ALBO,
    servizio: { stato: servizio.effettivo, modello: servizio.modello },
  });
});

const candidaturaSchema = z.object({
  nome: z.string().trim().min(1).max(100),
  cognome: z.string().trim().min(1).max(100),
  codiceFiscale: z.string().trim().min(11).max(16),
  partitaIva: z.string().trim().min(11).max(13),
  sezioneAlbo: z.enum(["A", "B"]),
  ordine: z.string().trim().min(2).max(100),
  numeroAlbo: z.string().trim().min(1).max(30),
  pec: z.string().trim().min(5).max(200),
  studio: z.string().trim().max(200).optional(),
  indirizzoStudio: z.string().trim().max(300).optional(),
  provincia: z.string().trim().max(2).nullable().optional(),
  abilitatoEntratel: z.boolean(),
  rcCompagnia: z.string().trim().min(2).max(200),
  rcNumeroPolizza: z.string().trim().min(2).max(100),
  rcMassimaleCents: z.number().int().min(1).max(10_000_000_000),
  rcScadenza: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  altriStrumentiIa: z.string().trim().max(1000).optional(),
});

router.post("/studio/candidatura", requireAuth, async (req, res) => {
  if (!res.locals.twoFactorEnabled) {
    res.status(403).json({ error: "TWO_FACTOR_NEEDED", message: "Attiva prima la verifica in due passaggi sul tuo account." });
    return;
  }
  const parsed = candidaturaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Controlla i campi evidenziati.", dettagli: parsed.error.issues });
    return;
  }
  try {
    const p = await salvaCandidatura(getActorUserId(res), { ...parsed.data, rcScadenza: new Date(`${parsed.data.rcScadenza}T23:59:59.000Z`) });
    res.json({ professionista: serializzaProfessionista(p) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.post("/studio/convenzione/firma", requireAuth, studio, async (req, res) => {
  const impronta = z.string().length(64).safeParse(req.body?.impronta);
  if (!impronta.success) {
    res.status(400).json({ error: "INVALID", message: "Dati non validi." });
    return;
  }
  try {
    const p = await firmaConvenzione(ctx(res).professionista, impronta.data, req.ip ?? null);
    res.json({ professionista: serializzaProfessionista(p) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.get("/studio/compensi", requireAuth, studio, async (_req, res) => {
  res.json({ compensi: await compensi({ professionistaId: ctx(res).professionista.id }) });
});

// ── Incarichi ────────────────────────────────────────────────────────────────

router.get("/studio/incarichi", requireAuth, studio, async (_req, res) => {
  res.json({ incarichi: await incarichiDelProfessionista(ctx(res).professionista) });
});

router.get("/studio/incarichi/:id", requireAuth, studio, async (req, res) => {
  riservato(res);
  try {
    const i = await incaricoPerProfessionista(ctx(res), req.params.id as string, { serveAccesso: false });
    const pratica = await praticaDi(i.id);
    res.json({
      incarico: serializzaIncarico(i),
      pratica: serializzaPratica(pratica, "professionista", pratica && i.stato === "attivo" ? await differenzaChiusura(pratica) : null),
      eventi: i.stato === "attivo" ? await eventiIncarico(i.id) : [],
    });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.post("/studio/incarichi/:id/accetta", requireAuth, studio, async (req, res) => {
  try {
    const i = await accettaIncarico(ctx(res), req.params.id as string, req.body?.adeguataVerifica === true);
    res.json({ incarico: serializzaIncarico(i) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

for (const tipo of ["rifiuta", "rinuncia"] as const) {
  router.post(`/studio/incarichi/:id/${tipo}`, requireAuth, studio, async (req, res) => {
    try {
      const motivo = z.string().trim().max(500).catch("").parse(req.body?.motivo);
      const i = await chiudiDaProfessionista(ctx(res), req.params.id as string, tipo, motivo);
      res.json({ incarico: serializzaIncarico(i) });
    } catch (err) {
      erroreCommercialista(err, res);
    }
  });
}

/** Il pacchetto dell'anno: gli stessi numeri che il cliente vede, più la fotografia consegnata. */
router.get("/studio/incarichi/:id/pacchetto", requireAuth, studio, async (req, res) => {
  riservato(res);
  try {
    const i = await incaricoPerProfessionista(ctx(res), req.params.id as string, { serveAccesso: true, registra: "pacchetto" });
    const [pacchetto, nota] = await Promise.all([pacchettoAnno(i.userId, i.anno), primaNota(i.userId, i.anno)]);
    res.json({ pacchetto, voci: nota.voci, chiusura: await statoChiusura(i.userId, i.anno, pacchetto), guida: guida(i.anno) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.get("/studio/incarichi/:id/pacchetto.pdf", requireAuth, studio, async (req, res) => {
  riservato(res);
  try {
    const i = await incaricoPerProfessionista(ctx(res), req.params.id as string, { serveAccesso: true, registra: "pacchetto.pdf" });
    const { buffer, filename } = await buildPacchettoPdf(await pacchettoAnno(i.userId, i.anno), await chiusuraDi(i.userId, i.anno));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.get("/studio/incarichi/:id/prima-nota.csv", requireAuth, studio, async (req, res) => {
  riservato(res);
  try {
    const i = await incaricoPerProfessionista(ctx(res), req.params.id as string, { serveAccesso: true, registra: "prima-nota.csv" });
    const { voci } = await primaNota(i.userId, i.anno);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="prima-nota-${i.anno}.csv"`);
    res.send(primaNotaCsv(voci));
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

const AZIONI_PROFESSIONISTA = ["prendi_in_carico", "richiedi_modifiche", "approva", "segna_inviata", "esito_accolta", "esito_scartata"] as const;
const AZIONI_CON_FILE: readonly string[] = ["approva", "esito_accolta", "esito_scartata"];

router.post(
  "/studio/incarichi/:id/pratica/:azione",
  requireAuth,
  studio,
  (req, res, next) => {
    documentoUpload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError || err instanceof Error) {
        res.status(400).json({ error: "INVALID", message: err.message });
        return;
      }
      next(err);
    });
  },
  async (req, res) => {
    const azione = (AZIONI_PROFESSIONISTA as readonly string[]).includes(req.params.azione as string) ? (req.params.azione as Exclude<AzionePratica, "consegna" | "conferma">) : null;
    if (!azione) {
      res.status(404).json({ error: "NOT_FOUND", message: "Azione sconosciuta." });
      return;
    }
    try {
      // Il file si carica solo dopo aver controllato l'accesso: nessun upload da chi non può toccare la pratica.
      const i = await incaricoPerProfessionista(ctx(res), req.params.id as string, { serveAccesso: true });
      let file: { url: string; nome: string; buffer: Buffer } | undefined;
      if (req.file && AZIONI_CON_FILE.includes(azione)) {
        const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "application/xml": "xml", "text/xml": "xml", "text/plain": "txt" }[req.file.mimetype] ?? "bin";
        const url = await objectStorage.uploadObjectBuffer({ subPath: `commercialista/${i.userId}/${i.id}/${randomUUID()}.${ext}`, buffer: req.file.buffer, contentType: req.file.mimetype });
        file = { url, nome: req.file.originalname, buffer: req.file.buffer };
      }
      const pratica = await azioneProfessionista(ctx(res), i.id, azione, {
        osservazioni: typeof req.body?.osservazioni === "string" ? req.body.osservazioni : undefined,
        protocollo: typeof req.body?.protocollo === "string" ? req.body.protocollo : undefined,
        file,
      });
      res.json({ pratica: serializzaPratica(pratica, "professionista", null) });
    } catch (err) {
      erroreCommercialista(err, res);
    }
  },
);

router.get("/studio/incarichi/:id/file/:tipo", requireAuth, studio, async (req, res) => {
  const tipo = req.params.tipo === "ricevuta" ? "ricevuta" : req.params.tipo === "bozza" ? "bozza" : null;
  try {
    if (!tipo) throw new ErroreFiscale("not_found", "File non trovato.");
    const i = await incaricoPerProfessionista(ctx(res), req.params.id as string, { serveAccesso: true, registra: tipo });
    const file = await filePratica(i, tipo);
    if (!file) {
      res.status(404).json({ error: "NOT_FOUND", message: "File non trovato." });
      return;
    }
    await inviaFile(res, file);
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.get("/studio/incarichi/:id/messaggi", requireAuth, studio, async (req, res) => {
  try {
    const i = await incaricoPerProfessionista(ctx(res), req.params.id as string, { serveAccesso: true });
    res.json({ messaggi: await messaggi(i.id, "professionista") });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.post("/studio/incarichi/:id/messaggi", requireAuth, studio, messaggiLimiter, async (req, res) => {
  try {
    const i = await incaricoPerProfessionista(ctx(res), req.params.id as string, { serveAccesso: true });
    const messaggio = await scriviMessaggio({
      incarico: i,
      autore: "professionista",
      autoreUserId: ctx(res).actorUserId,
      testo: z.string().catch("").parse(req.body?.testo),
      destinatarioUserId: i.userId,
    });
    res.status(201).json({ messaggio });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

// ── Amministrazione PrevAI ───────────────────────────────────────────────────

/** Chi dello staff ha agito: finisce in `verificato_da` e `assegnato_da`. */
async function emailAdmin(req: Request): Promise<string> {
  const sessione = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return sessione?.user.email ?? "admin";
}
// Verifica dei professionisti, compenso (D11), assegnazione a mano finché D9 è
// aperta, registro dei compensi. Lo staff di PrevAI **non** vede i dati fiscali
// dei clienti: qui ci sono nome dell'impresa, anno e stato, nient'altro.

router.get("/admin/commercialisti", requireAdmin, async (_req, res) => {
  const servizio = await statoServizioOra();
  res.json({
    servizio: { stato: servizio.effettivo, modello: servizio.modello, assegnazioneAutomatica: servizio.assegnazioneAutomatica, mancanti: servizio.mancanti },
    professionisti: await elencoProfessionisti(),
    richieste: await richiesteDaAssegnare(),
    compensi: await compensi(),
  });
});

const verificaSchema = z.object({
  note: z.string().trim().max(1000).default(""),
  rcVerificata: z.boolean(),
  entratelVerificato: z.boolean(),
  capienza: z.number().int().min(1).max(1000).optional(),
  compensoPraticaCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

router.post("/admin/commercialisti/:id/verifica", requireAdmin, async (req, res) => {
  const parsed = verificaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Dati non validi." });
    return;
  }
  try {
    res.json({ professionista: await verificaProfessionista(req.params.id as string, { da: await emailAdmin(req), ...parsed.data }) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.post("/admin/commercialisti/:id/sospendi", requireAdmin, async (req, res) => {
  const motivo = z.string().trim().min(3).max(500).safeParse(req.body?.motivo);
  if (!motivo.success) {
    res.status(400).json({ error: "INVALID", message: "Indica il motivo." });
    return;
  }
  try {
    res.json({ professionista: await sospendiProfessionista(req.params.id as string, motivo.data, req.body?.cessa === true) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.post("/admin/commercialisti/richieste/:id/assegna", requireAdmin, async (req, res) => {
  const professionistaId = z.string().uuid().safeParse(req.body?.professionistaId);
  if (!professionistaId.success) {
    res.status(400).json({ error: "INVALID", message: "Scegli un professionista." });
    return;
  }
  try {
    const i = await assegnaManualmente(req.params.id as string, professionistaId.data, await emailAdmin(req));
    res.json({ incarico: { id: i.id, stato: i.stato } });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.post("/admin/commercialisti/compensi/:id/:azione", requireAdmin, async (req, res) => {
  if (req.params.azione !== "fatturato" && req.params.azione !== "pagato") {
    res.status(404).json({ error: "NOT_FOUND", message: "Azione sconosciuta." });
    return;
  }
  try {
    await aggiornaCompenso(req.params.id as string, req.params.azione as "fatturato" | "pagato", typeof req.body?.fatturaNumero === "string" ? req.body.fatturaNumero : undefined);
    res.json({ ok: true });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

export default router;
