import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { db, businessProfilesTable, hasFeature, CATEGORIE_MOVIMENTO, TIPI_MOVIMENTO, STATI_MOVIMENTO_BANCA, TIPI_ABBINAMENTO, COST_CATEGORIES } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { ErroreFiscale, statoRevisione } from "../fiscale/service.js";
import { ETICHETTE_CATEGORIA, CATEGORIE_NEUTRE, creaMovimento, eliminaMovimento, primaNota, primaNotaCsv, utileNettoAnno } from "../primanota/service.js";
import {
  MAX_FILE_ESTRATTO,
  abbina,
  abbinaSicuri,
  elencoImport,
  eliminaImport,
  ignora,
  importaEstratto,
  movimentiBanca,
  registraCosto,
  registraIncasso,
  registraMovimento,
  riepilogoBanca,
  scollega,
} from "../primanota/banca.js";
import {
  DURATE_CONDIVISIONE,
  accessiCondivisione,
  chiudiAnno,
  chiusuraDi,
  creaCondivisione,
  elencoCondivisioni,
  guida,
  pacchettoAnno,
  revocaCondivisione,
  riapriAnno,
  statoChiusura,
} from "../primanota/chiusura.js";
import { buildPacchettoPdf } from "../primanota/pdf.js";

// ── A-4: prima nota, estratto conto, chiusura d'anno, condivisione ───────────
// Stesso gate e stessa area di permessi del motore fiscale (A-2): è lo stesso
// modulo, e la posizione economica del titolare non è un dato di lavoro per
// ufficio, capocantiere o ospite. L'amministratore guarda, solo il titolare
// scrive.
//
// Nessuna rotta dispone pagamenti, compila o invia dichiarazioni: la chiusura
// è una fotografia e il link del commercialista è in sola lettura
// (AMMINISTRAZIONE-PLAN.md §5).

const router = Router();
const importLimiter = userRateLimiter({ windowMs: 60_000, max: 10, message: "Troppi caricamenti al minuto" });
const estrattoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_ESTRATTO, files: 1 },
  fileFilter: (_req, file, cb) => {
    const nome = file.originalname.toLowerCase();
    // I browser mandano il CSV con mime diversi (text/csv, application/vnd.ms-excel,
    // text/plain): decide l'estensione, e il contenuto lo controlla il lettore.
    if (/\.(csv|txt|ofx|qfx)$/.test(nome)) cb(null, true);
    else cb(new Error("Carica l'estratto conto in formato CSV o OFX. Se la banca ti dà solo Excel, salvalo come CSV."));
  },
});

// A-5: prima nota, estratto conto, chiusura e link al commercialista sono la
// parte a pagamento del modulo (`admin_suite`): il calcolo fiscale da solo, che
// dopo il lancio sarà gratuito, non li sblocca. Due codici diversi perché
// l'interfaccia mostra due cose diverse: "modulo spento" o "parte dell'add-on".
async function moduloOForbidden(userId: string, res: import("express").Response): Promise<boolean> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  const fiscale = hasFeature(profile, "fiscal_engine");
  if (fiscale && hasFeature(profile, "admin_suite")) return true;
  if (fiscale) {
    res.status(403).json({ error: "ADMIN_SUITE_OFF", message: "Prima nota, estratto conto e chiusura d'anno fanno parte dell'add-on PrevAI Fisco." });
    return false;
  }
  res.status(403).json({ error: "FISCAL_MODULE_OFF", message: "Il modulo PrevAI Fisco non è attivo su questo account." });
  return false;
}

function errore(err: unknown, res: import("express").Response): void {
  if (err instanceof ErroreFiscale) {
    res.status(err.codice === "not_found" ? 404 : 400).json({ error: err.codice.toUpperCase(), message: err.message });
    return;
  }
  throw err;
}

function annoDi(valore: unknown): number {
  const grezzo = Number(valore);
  const corrente = new Date().getUTCFullYear();
  if (!Number.isFinite(grezzo)) return corrente;
  return Math.min(corrente + 1, Math.max(2015, Math.trunc(grezzo)));
}

function invalido(res: import("express").Response, dettagli: unknown) {
  res.status(400).json({ error: "INVALID", message: "Dati non validi", dettagli });
}

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const aMezzogiorno = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

// ── Prima nota ───────────────────────────────────────────────────────────────

router.get("/fiscale/prima-nota", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req.query.anno);
  const nota = await primaNota(userId, anno);
  res.json({
    ...nota,
    categorie: CATEGORIE_MOVIMENTO.map((c) => ({ id: c, etichetta: ETICHETTE_CATEGORIA[c], neutra: CATEGORIE_NEUTRE.includes(c) })),
  });
});

router.get("/fiscale/prima-nota.csv", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req.query.anno);
  const { voci } = await primaNota(userId, anno);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="prima-nota-${anno}.csv"`);
  res.send(primaNotaCsv(voci));
});

const movimentoSchema = z.object({
  data: dataSchema,
  tipo: z.enum(TIPI_MOVIMENTO),
  categoria: z.enum(CATEGORIE_MOVIMENTO),
  importoCents: z.number().int().min(1).max(1_000_000_000),
  descrizione: z.string().trim().max(500).optional(),
  controparte: z.string().trim().max(200).optional(),
});

router.post("/fiscale/prima-nota/movimenti", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const parsed = movimentoSchema.safeParse(req.body);
  if (!parsed.success) return invalido(res, parsed.error.issues);
  try {
    const riga = await creaMovimento({ userId, ...parsed.data, data: aMezzogiorno(parsed.data.data) });
    res.status(201).json({ id: riga.id });
  } catch (err) {
    errore(err, res);
  }
});

router.delete("/fiscale/prima-nota/movimenti/:id", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id as string)) throw new ErroreFiscale("not_found", "Movimento non trovato.");
    await eliminaMovimento(userId, req.params.id as string);
    res.status(204).end();
  } catch (err) {
    errore(err, res);
  }
});

router.get("/fiscale/utile", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req.query.anno);
  res.json({ anno, utile: await utileNettoAnno(userId, anno), revisione: statoRevisione(anno) });
});

// ── Estratto conto ───────────────────────────────────────────────────────────

router.get("/fiscale/banca", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req.query.anno);
  const stato = z.enum(STATI_MOVIMENTO_BANCA).optional().safeParse(req.query.stato || undefined);
  const [movimenti, riepilogo, estratti] = await Promise.all([
    movimentiBanca(userId, { anno, stato: stato.success ? stato.data : undefined }),
    riepilogoBanca(userId, anno),
    elencoImport(userId),
  ]);
  res.json({
    anno,
    movimenti,
    riepilogo,
    estratti: estratti.map((e) => ({
      id: e.id,
      formato: e.formato,
      nomeFile: e.nomeFile,
      conto: e.conto,
      righeLette: e.righeLette,
      righeNuove: e.righeNuove,
      righeDuplicate: e.righeDuplicate,
      righeScartate: e.righeScartate,
      createdAt: e.createdAt.toISOString(),
    })),
    categorieCosto: COST_CATEGORIES,
  });
});

router.post(
  "/fiscale/banca/import",
  requireAuth,
  requirePermission("fiscale", "full"),
  importLimiter,
  (req, res, next) => {
    estrattoUpload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ error: "INVALID", message: err.code === "LIMIT_FILE_SIZE" ? "Il file supera i 5 MB: esporta un periodo più breve." : err.message });
        return;
      }
      if (err instanceof Error) {
        res.status(400).json({ error: "INVALID", message: err.message });
        return;
      }
      next(err);
    });
  },
  async (req, res) => {
    const userId = getUserId(res);
    if (!(await moduloOForbidden(userId, res))) return;
    if (!req.file) {
      res.status(400).json({ error: "INVALID", message: "Nessun file caricato." });
      return;
    }
    try {
      const esito = await importaEstratto({ userId, buffer: req.file.buffer, nomeFile: req.file.originalname, conto: typeof req.body?.conto === "string" ? req.body.conto : "" });
      res.status(201).json(esito);
    } catch (err) {
      errore(err, res);
    }
  },
);

router.delete("/fiscale/banca/import/:id", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id as string)) throw new ErroreFiscale("not_found", "Estratto conto non trovato.");
    await eliminaImport(userId, req.params.id as string);
    res.status(204).end();
  } catch (err) {
    errore(err, res);
  }
});

router.post("/fiscale/banca/abbina-sicuri", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  res.json(await abbinaSicuri(userId, annoDi(req.body?.anno)));
});

const azioni = {
  abbina: z.object({ tipo: z.enum(TIPI_ABBINAMENTO), id: z.string().uuid() }),
  incasso: z.object({ invoiceId: z.string().uuid() }),
  costo: z.object({ categoria: z.enum(COST_CATEGORIES), projectId: z.string().uuid().nullable().optional(), descrizione: z.string().trim().max(500).optional() }),
  movimento: z.object({ categoria: z.enum(CATEGORIE_MOVIMENTO), descrizione: z.string().trim().max(500).optional() }),
};

router.post("/fiscale/banca/movimenti/:id/:azione", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const id = req.params.id as string;
  try {
    switch (req.params.azione) {
      case "abbina": {
        const p = azioni.abbina.safeParse(req.body);
        if (!p.success) return invalido(res, p.error.issues);
        await abbina(userId, id, p.data.tipo, p.data.id);
        res.json({ ok: true });
        return;
      }
      case "incasso": {
        const p = azioni.incasso.safeParse(req.body);
        if (!p.success) return invalido(res, p.error.issues);
        res.status(201).json(await registraIncasso(userId, id, p.data.invoiceId, req.ip));
        return;
      }
      case "costo": {
        const p = azioni.costo.safeParse(req.body);
        if (!p.success) return invalido(res, p.error.issues);
        res.status(201).json(await registraCosto(userId, id, p.data));
        return;
      }
      case "movimento": {
        const p = azioni.movimento.safeParse(req.body);
        if (!p.success) return invalido(res, p.error.issues);
        res.status(201).json(await registraMovimento(userId, id, p.data));
        return;
      }
      case "ignora":
        await ignora(userId, id);
        res.json({ ok: true });
        return;
      case "scollega":
        await scollega(userId, id);
        res.json({ ok: true });
        return;
      default:
        res.status(404).json({ error: "NOT_FOUND", message: "Azione sconosciuta." });
    }
  } catch (err) {
    errore(err, res);
  }
});

// ── Chiusura d'anno ──────────────────────────────────────────────────────────

router.get("/fiscale/chiusura", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req.query.anno);
  const pacchetto = await pacchettoAnno(userId, anno);
  res.json({ pacchetto, ...(await statoChiusura(userId, anno, pacchetto)), guida: guida(anno) });
});

router.get("/fiscale/chiusura/pacchetto.pdf", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = annoDi(req.query.anno);
  const { buffer, filename } = await buildPacchettoPdf(await pacchettoAnno(userId, anno), await chiusuraDi(userId, anno));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

router.post("/fiscale/chiusura/chiudi", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const p = z.object({ anno: z.number().int().min(2015).max(2100), riporta: z.boolean().default(false) }).safeParse(req.body);
  if (!p.success) return invalido(res, p.error.issues);
  try {
    res.json(await chiudiAnno({ userId, anno: p.data.anno, riporta: p.data.riporta, ip: req.ip }));
  } catch (err) {
    errore(err, res);
  }
});

router.post("/fiscale/chiusura/riapri", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const p = z.object({ anno: z.number().int().min(2015).max(2100) }).safeParse(req.body);
  if (!p.success) return invalido(res, p.error.issues);
  try {
    await riapriAnno(userId, p.data.anno, req.ip);
    res.status(204).end();
  } catch (err) {
    errore(err, res);
  }
});

// ── Condivisione col commercialista ──────────────────────────────────────────

router.get("/fiscale/condivisioni", requireAuth, requirePermission("fiscale", "view"), async (_req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  res.json({ condivisioni: await elencoCondivisioni(userId), durate: DURATE_CONDIVISIONE });
});

router.post("/fiscale/condivisioni", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const p = z
    .object({
      anno: z.number().int().min(2015).max(2100),
      destinatario: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(200).optional().or(z.literal("")),
      giorni: z.number().int(),
    })
    .safeParse(req.body);
  if (!p.success) return invalido(res, p.error.issues);
  try {
    res.status(201).json(await creaCondivisione({ userId, ...p.data, email: p.data.email || undefined, ip: req.ip }));
  } catch (err) {
    errore(err, res);
  }
});

router.get("/fiscale/condivisioni/:id/accessi", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  try {
    res.json({ accessi: await accessiCondivisione(userId, req.params.id as string) });
  } catch (err) {
    errore(err, res);
  }
});

router.delete("/fiscale/condivisioni/:id", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  try {
    await revocaCondivisione(userId, req.params.id as string, req.ip);
    res.status(204).end();
  } catch (err) {
    errore(err, res);
  }
});

export default router;
