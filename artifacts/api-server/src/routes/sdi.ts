import { Router } from "express";
import { z } from "zod";
import {
  db,
  businessProfilesTable,
  invoicesTable,
  eInvoicesTable,
  hasFeature,
  isRegimeFiscale,
  validaCodiceDestinatario,
  validaPec,
  SDI_PROVIDERS,
  SDI_ONBOARDING_STEPS,
  COST_CATEGORIES,
  REGIMI_FISCALI,
  type CostCategory,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import {
  ErroreSdi,
  impostazioniOCrea,
  aggiornaImpostazioni,
  requisitiMancanti,
  serializzaImpostazioni,
  serializzaTrasmissione,
  anteprimaFattura,
  inviaAlloSdi,
  sincronizzaStato,
  trasmissioniDi,
  eventiDi,
  xmlTrasmissione,
} from "../sdi/service.js";
import { intermediarioPer } from "../sdi/providers/index.js";
import { collegaACantiere, ignoraPassiva, listaPassive, serializzaPassiva, sincronizzaPassive, xmlPassiva } from "../sdi/passive.js";
import { f24Bollo, periodiBollo, segnaVersato } from "../sdi/bollo.js";

const router = Router();
const inviiLimiter = userRateLimiter({ windowMs: 60 * 60_000, max: 200, message: "Troppe trasmissioni in un'ora" });

// ── A-1: API del modulo Fatture SDI ──────────────────────────────────────────
// Tutte le rotte vogliono l'add-on "Amministrazione" (`sdi_invoicing`), che
// nessun piano include: si accende con un flag sul profilo finché A-5 non
// collega l'abbonamento Stripe. Le credenziali dell'intermediario entrano ma
// non escono mai.

async function moduloOForbidden(userId: string, res: import("express").Response): Promise<boolean> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "sdi_invoicing")) return true;
  res.status(403).json({
    error: "SDI_MODULE_OFF",
    message: "Il modulo Amministrazione non è attivo su questo account: le fatture restano pro-forma.",
  });
  return false;
}

function erroreSdi(err: unknown, res: import("express").Response): void {
  if (err instanceof ErroreSdi) {
    const stato = err.codice === "not_found" ? 404 : err.codice === "gia_trasmessa" || err.codice === "gia_collegata" ? 409 : 400;
    res.status(stato).json({ error: err.codice.toUpperCase(), message: err.message, dettagli: err.dettagli ?? null });
    return;
  }
  throw err;
}

// ── Impostazioni e onboarding ────────────────────────────────────────────────

router.get("/sdi/settings", requireAuth, requirePermission("settings", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const settings = await impostazioniOCrea(userId);
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  res.json({
    settings: serializzaImpostazioni(settings, {
      requisitiMancanti: requisitiMancanti(settings, profile ?? null),
      codiceDestinatarioIntermediario: intermediarioPer(settings).codiceDestinatarioRicezione(),
    }),
    regimi: REGIMI_FISCALI,
    providers: SDI_PROVIDERS,
    passi: SDI_ONBOARDING_STEPS,
  });
});

const patchSchema = z.object({
  provider: z.enum(SDI_PROVIDERS).optional(),
  regimeFiscale: z.string().refine(isRegimeFiscale, "Regime fiscale sconosciuto").optional(),
  ambiente: z.enum(["sandbox", "produzione"]).optional(),
  conservazioneAttiva: z.boolean().optional(),
  codiceDestinatarioRicezione: z.string().trim().max(7).nullable().optional(),
  pecRicezione: z.string().trim().max(256).nullable().optional(),
  providerAccountId: z.string().trim().max(200).nullable().optional(),
  providerApiKey: z.string().trim().max(500).nullable().optional(),
  webhookSecret: z.string().trim().min(16).max(200).nullable().optional(),
  cicloPassivoAttivo: z.boolean().optional(),
  delegaFirmata: z.boolean().optional(),
  delegaRiferimento: z.string().trim().max(200).nullable().optional(),
  completa: z.array(z.enum(SDI_ONBOARDING_STEPS)).optional(),
});

router.patch("/sdi/settings", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Dati non validi", dettagli: parsed.error.issues });
    return;
  }
  const patch = parsed.data;
  if (patch.codiceDestinatarioRicezione && !validaCodiceDestinatario(patch.codiceDestinatarioRicezione)) {
    res.status(400).json({ error: "INVALID", message: "Il codice destinatario deve avere 7 caratteri alfanumerici (6 per la Pubblica Amministrazione)." });
    return;
  }
  if (patch.pecRicezione && !validaPec(patch.pecRicezione)) {
    res.status(400).json({ error: "INVALID", message: "La PEC indicata non è valida." });
    return;
  }
  const settings = await aggiornaImpostazioni({ userId, patch, ip: req.ip });
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  res.json({
    settings: serializzaImpostazioni(settings, {
      requisitiMancanti: requisitiMancanti(settings, profile ?? null),
      codiceDestinatarioIntermediario: intermediarioPer(settings).codiceDestinatarioRicezione(),
    }),
  });
});

/** La guida passo-passo: cosa fare, dove, con quale codice. */
router.get("/sdi/onboarding", requireAuth, requirePermission("settings", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const settings = await impostazioniOCrea(userId);
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  const codice = intermediarioPer(settings).codiceDestinatarioRicezione();
  res.json({
    stato: settings.stato,
    completati: settings.onboarding,
    requisitiMancanti: requisitiMancanti(settings, profile ?? null),
    codiceDestinatarioIntermediario: codice,
    cicloPassivoAttivo: settings.cicloPassivoAttivo,
    passi: [
      { id: "dati_fiscali", titolo: "Completa i dati fiscali dell'impresa", testo: "Ragione sociale, partita IVA, codice fiscale e sede completa (indirizzo, CAP, comune, provincia): sono i dati che finiscono in ogni fattura elettronica." },
      { id: "regime", titolo: "Dichiara il regime fiscale", testo: "Per gli artigiani forfettari è RF19: in fattura non si espone IVA e ogni riga porta la natura N2.2 con la dicitura di legge." },
      { id: "intermediario", titolo: "Collega l'intermediario", testo: "PrevAI non è un canale accreditato presso l'Agenzia delle Entrate: la trasmissione la fa un intermediario. Inserisci il token API del tuo account." },
      { id: "delega", titolo: "Firma la delega presso l'intermediario", testo: "È il contratto che autorizza l'intermediario a trasmettere e conservare le tue fatture. Va firmato da te, una volta sola." },
      {
        id: "codice_destinatario",
        titolo: "Registra il codice destinatario nel portale dell'Agenzia",
        testo: `Entra in "Fatture e Corrispettivi" con SPID/CIE, apri "Registrazione dell'indirizzo telematico" e indica il codice ${codice ?? "dell'intermediario"}. Da quel momento tutte le fatture dei tuoi fornitori arrivano qui, qualunque codice abbiano scritto in fattura.`,
      },
      { id: "ciclo_passivo", titolo: "Attiva la ricezione delle fatture di acquisto", testo: "Scelta facoltativa e revocabile: se la attivi, PrevAI scarica le fatture dei fornitori e te le propone come costi di cantiere." },
    ],
  });
});

// ── Trasmissione di una fattura ──────────────────────────────────────────────

router.get("/invoices/:id/sdi", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const [fattura] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, req.params.id), eq(invoicesTable.userId, userId)));
  if (!fattura) {
    res.status(404).json({ error: "NOT_FOUND", message: "Fattura non trovata" });
    return;
  }
  const trasmissioni = await trasmissioniDi(fattura.id);
  const corrente = trasmissioni[0] ?? null;
  res.json({
    corrente: corrente ? serializzaTrasmissione(corrente) : null,
    storico: trasmissioni.map(serializzaTrasmissione),
    eventi: corrente ? (await eventiDi(corrente.id)).map((e) => ({ id: e.id, tipo: e.tipo, stato: e.statoDopo, messaggio: e.messaggio, ricevutoAt: e.ricevutoAt.toISOString() })) : [],
  });
});

/** Anteprima: XML e controlli, senza consumare un progressivo né inviare niente. */
router.get("/invoices/:id/sdi/anteprima", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  try {
    const anteprima = await anteprimaFattura({ invoiceId: req.params.id, userId });
    res.json({
      fileName: anteprima.fileName,
      xml: anteprima.xml,
      validazione: anteprima.validazione,
      destinatario: { codice: anteprima.input.codiceDestinatario, pec: anteprima.input.pecDestinatario, formato: anteprima.input.formatoTrasmissione },
      bolloCents: anteprima.input.bolloVirtualeCents ?? 0,
      totaleCents: anteprima.input.totaleDocumentoCents,
    });
  } catch (err) {
    erroreSdi(err, res);
  }
});

router.post("/invoices/:id/sdi/invia", requireAuth, requirePermission("invoicing", "full"), inviiLimiter, async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const forza = req.body?.forza === true;
  // Il rate limiter allarga il tipo di req.params: qui l'id è sempre una stringa.
  const invoiceId = String(req.params.id);
  try {
    const { eInvoice, validazione } = await inviaAlloSdi({ invoiceId, userId, actorId: userId, ip: req.ip, forza });
    res.json({ trasmissione: serializzaTrasmissione(eInvoice), avvisi: validazione.avvisi });
  } catch (err) {
    erroreSdi(err, res);
  }
});

router.post("/sdi/transmissions/:id/aggiorna", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const [riga] = await db.select().from(eInvoicesTable).where(and(eq(eInvoicesTable.id, req.params.id), eq(eInvoicesTable.userId, userId)));
  if (!riga) {
    res.status(404).json({ error: "NOT_FOUND", message: "Trasmissione non trovata" });
    return;
  }
  res.json({ trasmissione: serializzaTrasmissione(await sincronizzaStato(riga)) });
});

router.get("/sdi/transmissions/:id/xml", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  try {
    const { fileName, xml } = await xmlTrasmissione({ eInvoiceId: req.params.id, userId });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(xml);
  } catch (err) {
    erroreSdi(err, res);
  }
});

// ── Ciclo passivo ────────────────────────────────────────────────────────────

router.get("/sdi/passive", requireAuth, requirePermission("costs", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const statoQuery = typeof req.query.stato === "string" ? req.query.stato : "";
  const stato = ["nuova", "collegata", "ignorata"].includes(statoQuery) ? (statoQuery as "nuova" | "collegata" | "ignorata") : undefined;
  res.json({ fatture: (await listaPassive({ userId, stato })).map(serializzaPassiva) });
});

router.post("/sdi/passive/sincronizza", requireAuth, requirePermission("costs", "edit"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  try {
    res.json(await sincronizzaPassive({ userId }));
  } catch (err) {
    erroreSdi(err, res);
  }
});

router.post("/sdi/passive/:id/collega", requireAuth, requirePermission("costs", "edit"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const schema = z.object({ projectId: z.string().uuid(), category: z.enum(COST_CATEGORIES).optional(), milestoneId: z.string().uuid().nullable().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID", message: "Indica il cantiere a cui collegare la fattura." });
    return;
  }
  try {
    const passiva = await collegaACantiere({
      userId,
      id: req.params.id,
      projectId: parsed.data.projectId,
      category: parsed.data.category as CostCategory | undefined,
      milestoneId: parsed.data.milestoneId ?? null,
      ip: req.ip,
    });
    res.json({ fattura: serializzaPassiva(passiva) });
  } catch (err) {
    erroreSdi(err, res);
  }
});

router.post("/sdi/passive/:id/ignora", requireAuth, requirePermission("costs", "edit"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  try {
    res.json({ fattura: serializzaPassiva(await ignoraPassiva({ userId, id: req.params.id, ip: req.ip })) });
  } catch (err) {
    erroreSdi(err, res);
  }
});

router.get("/sdi/passive/:id/xml", requireAuth, requirePermission("costs", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  try {
    const { fileName, xml } = await xmlPassiva({ userId, id: req.params.id });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(xml);
  } catch (err) {
    erroreSdi(err, res);
  }
});

// ── Bollo virtuale ───────────────────────────────────────────────────────────

router.get("/sdi/bollo", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = Number.parseInt(String(req.query.anno ?? ""), 10) || new Date().getFullYear();
  const periodi = await periodiBollo(userId, anno);
  res.json({
    anno,
    periodi: periodi.map((p) => ({
      trimestre: p.trimestre,
      documenti: p.documenti,
      importoCents: p.importoCents,
      stato: p.stato,
      codiceTributo: p.codiceTributo,
      scadenza: p.scadenza?.toISOString() ?? null,
      versatoAt: p.versatoAt?.toISOString() ?? null,
      riferimentoVersamento: p.riferimentoVersamento,
    })),
  });
});

router.get("/sdi/bollo/:anno/:trimestre/f24", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = Number.parseInt(req.params.anno, 10);
  const trimestre = Number.parseInt(req.params.trimestre, 10);
  if (!anno || trimestre < 1 || trimestre > 4) {
    res.status(400).json({ error: "INVALID", message: "Anno o trimestre non validi." });
    return;
  }
  res.json(await f24Bollo({ userId, anno, trimestre }));
});

router.post("/sdi/bollo/:anno/:trimestre/versato", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const anno = Number.parseInt(req.params.anno, 10);
  const trimestre = Number.parseInt(req.params.trimestre, 10);
  if (!anno || trimestre < 1 || trimestre > 4) {
    res.status(400).json({ error: "INVALID", message: "Anno o trimestre non validi." });
    return;
  }
  const versato = req.body?.versato !== false;
  const periodo = await segnaVersato({ userId, anno, trimestre, versato, riferimento: typeof req.body?.riferimento === "string" ? req.body.riferimento : undefined });
  res.json({ periodo: { trimestre: periodo.trimestre, stato: periodo.stato, versatoAt: periodo.versatoAt?.toISOString() ?? null, riferimentoVersamento: periodo.riferimentoVersamento } });
});

export default router;
