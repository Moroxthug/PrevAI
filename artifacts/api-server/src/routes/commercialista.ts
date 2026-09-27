import { Readable } from "node:stream";
import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable, hasFeature, incarichiTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage.js";
import {
  ErroreFiscale,
  confermaPratica,
  consegnaPratica,
  differenzaChiusura,
  eventiIncarico,
  filePratica,
  firmaIncarico,
  incaricoCorrente,
  messaggi,
  praticaDi,
  professionistaDiIncarico,
  revocaIncarico,
  richiediServizio,
  schedaPubblica,
  scriviMessaggio,
  serializzaIncarico,
  serializzaPratica,
  statoServizioOra,
} from "../commercialista/service.js";

// ── A-6: il commercialista, lato impresa ─────────────────────────────────────
// Stessa area di permessi del resto del modulo (`fiscale`): il titolare firma,
// consegna, conferma e scrive; l'amministratore guarda. La lettera d'incarico
// e la conferma della bozza hanno peso legale, quindi chiedono anche la
// verifica in due passaggi di chi le fa.
//
// Il servizio si accende con la feature `accountant_service`, che nessun piano
// include e nessun add-on vende finché D9 e D11 sono aperte: oggi solo un
// flag messo a mano dall'amministrazione per un'impresa pilota.

const router = Router();
const objectStorage = new ObjectStorageService();
const messaggiLimiter = userRateLimiter({ windowMs: 60_000, max: 20, message: "Troppi messaggi al minuto" });

async function servizioOForbidden(userId: string, res: import("express").Response): Promise<boolean> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "accountant_service")) return true;
  res.status(403).json({ error: "ACCOUNTANT_SERVICE_OFF", message: "Il servizio con commercialista non è attivo su questo account." });
  return false;
}

function serveDueFattori(res: import("express").Response): boolean {
  if (res.locals.twoFactorEnabled) return true;
  res.status(403).json({ error: "TWO_FACTOR_NEEDED", message: "Per firmare e confermare attiva prima la verifica in due passaggi (Impostazioni → Sicurezza)." });
  return false;
}

export function erroreCommercialista(err: unknown, res: import("express").Response): void {
  if (err instanceof ErroreFiscale) {
    const stato = err.codice === "not_found" ? 404 : ["stato_cambiato", "stato_pratica", "gia_richiesto", "gia_firmata", "gia_chiuso", "numeri_cambiati", "testo_cambiato", "bozza_cambiata"].includes(err.codice) ? 409 : err.codice === "senza_accesso" || err.codice === "non_operativo" ? 403 : 400;
    res.status(stato).json({ error: err.codice.toUpperCase(), message: err.message });
    return;
  }
  throw err;
}

function annoDi(valore: unknown): number {
  const grezzo = Number(valore);
  const scorso = new Date().getUTCFullYear() - 1;
  if (!Number.isFinite(grezzo)) return scorso;
  return Math.min(scorso + 1, Math.max(2015, Math.trunc(grezzo)));
}

const meta = (req: import("express").Request) => ({ ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null });

/** Tutto ciò che la pagina del cliente mostra per un anno d'imposta. */
router.get("/fiscale/commercialista", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await servizioOForbidden(userId, res))) return;
  const anno = annoDi(req.query.anno);
  const servizio = await statoServizioOra();
  const incarico = await incaricoCorrente(userId, anno);
  const professionista = incarico ? await professionistaDiIncarico(incarico) : undefined;
  const pratica = incarico ? await praticaDi(incarico.id) : undefined;
  res.json({
    anno,
    servizio: { stato: servizio.effettivo, modello: servizio.modello, assegnazioneAutomatica: servizio.assegnazioneAutomatica },
    incarico: incarico ? serializzaIncarico(incarico) : null,
    professionista: professionista ? schedaPubblica(professionista) : null,
    pratica: serializzaPratica(pratica, "cliente", pratica ? await differenzaChiusura(pratica) : null),
    eventi: incarico ? await eventiIncarico(incarico.id) : [],
    twoFactorEnabled: Boolean(res.locals.twoFactorEnabled),
  });
});

router.post("/fiscale/commercialista/richiesta", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await servizioOForbidden(userId, res))) return;
  const parsed = z.object({ anno: z.number().int().min(2015).max(2100) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Anno non valido." });
    return;
  }
  try {
    const incarico = await richiediServizio({ userId, actorId: getActorUserId(res), anno: parsed.data.anno, ip: meta(req).ip });
    res.status(201).json({ incarico: serializzaIncarico(incarico) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

const firmaSchema = z.object({ impronta: z.string().length(64), informativaIa: z.boolean(), informativaPrivacy: z.boolean() });

router.post("/fiscale/commercialista/incarichi/:id/firma", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await servizioOForbidden(userId, res)) || !serveDueFattori(res)) return;
  const parsed = firmaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Dati non validi." });
    return;
  }
  try {
    const m = meta(req);
    const incarico = await firmaIncarico({
      userId,
      actorId: getActorUserId(res),
      incaricoId: req.params.id,
      improntaVista: parsed.data.impronta,
      informativaIa: parsed.data.informativaIa,
      informativaPrivacy: parsed.data.informativaPrivacy,
      ip: m.ip,
      userAgent: m.userAgent,
    });
    res.json({ incarico: serializzaIncarico(incarico) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.post("/fiscale/commercialista/incarichi/:id/revoca", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await servizioOForbidden(userId, res))) return;
  const motivo = z.string().trim().max(500).catch("").parse(req.body?.motivo);
  try {
    const incarico = await revocaIncarico({ userId, actorId: getActorUserId(res), incaricoId: req.params.id, motivo, ip: meta(req).ip });
    res.json({ incarico: serializzaIncarico(incarico) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.post("/fiscale/commercialista/incarichi/:id/consegna", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await servizioOForbidden(userId, res))) return;
  try {
    const pratica = await consegnaPratica({ userId, actorId: getActorUserId(res), incaricoId: req.params.id, ip: meta(req).ip });
    res.json({ pratica: serializzaPratica(pratica, "cliente", null) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

router.post("/fiscale/commercialista/incarichi/:id/conferma", requireAuth, requirePermission("fiscale", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await servizioOForbidden(userId, res)) || !serveDueFattori(res)) return;
  const parsed = z.object({ bozzaImpronta: z.string().length(64) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Dati non validi." });
    return;
  }
  try {
    const pratica = await confermaPratica({ userId, actorId: getActorUserId(res), incaricoId: req.params.id, bozzaImpronta: parsed.data.bozzaImpronta, ip: meta(req).ip });
    res.json({ pratica: serializzaPratica(pratica, "cliente", null) });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

/** La bozza da confermare e la ricevuta dell'Agenzia, solo all'impresa dell'incarico. */
router.get("/fiscale/commercialista/incarichi/:id/file/:tipo", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await servizioOForbidden(userId, res))) return;
  const tipo = req.params.tipo === "ricevuta" ? "ricevuta" : req.params.tipo === "bozza" ? "bozza" : null;
  const incarico = tipo ? await incaricoCorrenteOId(userId, req.params.id) : null;
  const file = incarico && tipo ? await filePratica(incarico, tipo) : null;
  if (!file) {
    res.status(404).json({ error: "NOT_FOUND", message: "File non trovato." });
    return;
  }
  await inviaFile(res, file);
});

router.get("/fiscale/commercialista/incarichi/:id/messaggi", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await servizioOForbidden(userId, res))) return;
  const incarico = await incaricoCorrenteOId(userId, req.params.id);
  if (!incarico) {
    res.status(404).json({ error: "NOT_FOUND", message: "Incarico non trovato." });
    return;
  }
  // Solo il titolare segna come letti: un amministratore che guarda non "legge" al posto suo.
  res.json({ messaggi: await messaggi(incarico.id, res.locals.actorRole === "owner" ? "cliente" : null) });
});

router.post("/fiscale/commercialista/incarichi/:id/messaggi", requireAuth, requirePermission("fiscale", "full"), messaggiLimiter, async (req, res) => {
  const userId = getUserId(res);
  if (!(await servizioOForbidden(userId, res))) return;
  const incarico = await incaricoCorrenteOId(userId, req.params.id as string);
  const professionista = incarico ? await professionistaDiIncarico(incarico) : undefined;
  if (!incarico || !professionista) {
    res.status(404).json({ error: "NOT_FOUND", message: "Incarico non trovato." });
    return;
  }
  try {
    const messaggio = await scriviMessaggio({
      incarico,
      autore: "cliente",
      autoreUserId: getActorUserId(res),
      testo: z.string().catch("").parse(req.body?.testo),
      destinatarioUserId: professionista.userId,
    });
    res.status(201).json({ messaggio });
  } catch (err) {
    erroreCommercialista(err, res);
  }
});

async function incaricoCorrenteOId(userId: string, id: string) {
  const [i] = await db.select().from(incarichiTable).where(and(eq(incarichiTable.id, id), eq(incarichiTable.userId, userId)));
  return i;
}

export async function inviaFile(res: import("express").Response, file: { url: string; nome: string }): Promise<void> {
  try {
    const oggetto = await objectStorage.downloadPrivateObject(file.url.replace("/objects/", ""));
    res.status(oggetto.status);
    oggetto.headers.forEach((v, k) => res.setHeader(k, v));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `inline; filename="${file.nome.replace(/"/g, "")}"`);
    if (oggetto.body) Readable.fromWeb(oggetto.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "NOT_FOUND", message: "File non trovato." });
      return;
    }
    throw err;
  }
}

export default router;
