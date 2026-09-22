import { createHash } from "node:crypto";
import {
  db,
  sdiSettingsTable,
  eInvoicesTable,
  eInvoiceEventsTable,
  invoicesTable,
  invoiceSequencesTable,
  businessProfilesTable,
  clientsTable,
  progressivoInvio as componiProgressivo,
  nomeFileFattura,
  descrizioneErroreSdi,
  STATI_SDI_FINALI,
  STATI_SDI_LABEL,
  type SdiSettings,
  type SdiOnboardingStep,
  type EInvoice,
  type Invoice,
  type StatoSdi,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { encryptField, decryptField } from "../lib/fieldCrypto.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { writeAudit, createNotification } from "../lib/notifications.js";
import { loadInvoice } from "../invoices/service.js";
import { mappaFattura } from "./mapper.js";
import { buildFatturaPaXml } from "./xml.js";
import { validaFatturaPa, type EsitoValidazione } from "./validate.js";
import { intermediarioPer } from "./providers/index.js";
import type { EventoSdi } from "./providers/types.js";
import type { FatturaPaInput } from "./types.js";
import { registraBolloDocumento } from "./bollo.js";
import { requisitiMancanti, type Requisito } from "./stato.js";

export { requisitiMancanti, moduloAttivo, moduloSdiAttivo, impostazioniSdi, type Requisito } from "./stato.js";

const storage = new ObjectStorageService();

// ── A-1: servizio di fatturazione elettronica ────────────────────────────────
// Il percorso di un documento: anteprima (XML + controlli) → invio (riga in
// `e_invoices`, XML nel nostro storage, consegna all'intermediario) → stati
// SdI (webhook o polling). Niente parte da solo: l'invio è sempre un'azione
// esplicita dell'utente (AMMINISTRAZIONE-PLAN.md §7, "nessuna azione
// automatica con effetto esterno").

export class ErroreSdi extends Error {
  constructor(
    readonly codice: string,
    message: string,
    readonly dettagli?: unknown,
  ) {
    super(message);
    this.name = "ErroreSdi";
  }
}

// ── Impostazioni ─────────────────────────────────────────────────────────────

const IMPOSTAZIONI_DEFAULT = {
  provider: "simulato" as const,
  stato: "non_configurato" as const,
  regimeFiscale: "RF19" as const,
  ambiente: "sandbox" as const,
};

/** Legge le impostazioni dell'impresa, creandole al primo accesso. */
export async function impostazioniOCrea(userId: string): Promise<SdiSettings> {
  const [esistente] = await db.select().from(sdiSettingsTable).where(eq(sdiSettingsTable.userId, userId));
  if (esistente) return esistente;
  const [creata] = await db.insert(sdiSettingsTable).values({ userId, ...IMPOSTAZIONI_DEFAULT }).onConflictDoNothing().returning();
  if (creata) return creata;
  const [dopoConflitto] = await db.select().from(sdiSettingsTable).where(eq(sdiSettingsTable.userId, userId));
  return dopoConflitto!;
}

export type PatchImpostazioni = Partial<
  Pick<SdiSettings, "provider" | "regimeFiscale" | "ambiente" | "conservazioneAttiva" | "codiceDestinatarioRicezione" | "pecRicezione" | "delegaRiferimento">
> & {
  /** Credenziali in chiaro: vengono cifrate qui e non tornano mai al client. */
  providerAccountId?: string | null;
  providerApiKey?: string | null;
  webhookSecret?: string | null;
  cicloPassivoAttivo?: boolean;
  delegaFirmata?: boolean;
  /** Passi dell'onboarding da segnare come fatti. */
  completa?: SdiOnboardingStep[];
};

export async function aggiornaImpostazioni(params: { userId: string; patch: PatchImpostazioni; ip?: string | null }): Promise<SdiSettings> {
  const attuali = await impostazioniOCrea(params.userId);
  const p = params.patch;
  const onboarding = { ...attuali.onboarding };
  for (const passo of p.completa ?? []) onboarding[passo] = { doneAt: new Date().toISOString() };

  const valori: Partial<typeof sdiSettingsTable.$inferInsert> = {
    ...(p.provider ? { provider: p.provider } : {}),
    ...(p.regimeFiscale ? { regimeFiscale: p.regimeFiscale } : {}),
    ...(p.ambiente ? { ambiente: p.ambiente } : {}),
    ...(p.conservazioneAttiva === undefined ? {} : { conservazioneAttiva: p.conservazioneAttiva }),
    ...(p.codiceDestinatarioRicezione === undefined ? {} : { codiceDestinatarioRicezione: p.codiceDestinatarioRicezione }),
    ...(p.pecRicezione === undefined ? {} : { pecRicezione: p.pecRicezione }),
    ...(p.delegaRiferimento === undefined ? {} : { delegaRiferimento: p.delegaRiferimento }),
    ...(p.providerAccountId === undefined ? {} : { providerAccountId: encryptField(p.providerAccountId) }),
    ...(p.providerApiKey === undefined ? {} : { providerApiKey: encryptField(p.providerApiKey) }),
    ...(p.webhookSecret === undefined ? {} : { webhookSecret: encryptField(p.webhookSecret) }),
    onboarding,
  };
  if (p.delegaFirmata !== undefined) {
    valori.delegaFirmataAt = p.delegaFirmata ? (attuali.delegaFirmataAt ?? new Date()) : null;
  }
  // Ciclo passivo: adesione esplicita e tracciata (Provv. Garante 2018-2019).
  if (p.cicloPassivoAttivo !== undefined && p.cicloPassivoAttivo !== attuali.cicloPassivoAttivo) {
    valori.cicloPassivoAttivo = p.cicloPassivoAttivo;
    valori.cicloPassivoAttivatoAt = p.cicloPassivoAttivo ? new Date() : null;
  }

  const [aggiornata] = await db.update(sdiSettingsTable).set(valori).where(eq(sdiSettingsTable.userId, params.userId)).returning();
  const finale = await ricalcolaStatoConfigurazione(aggiornata!);
  await writeAudit({
    userId: params.userId,
    actorType: "user",
    actorId: params.userId,
    entityType: "sdi_settings",
    entityId: params.userId,
    action: "updated",
    // Mai loggare le credenziali: solo il fatto che sono state cambiate.
    diff: {
      provider: finale.provider,
      ambiente: finale.ambiente,
      stato: finale.stato,
      cicloPassivoAttivo: finale.cicloPassivoAttivo,
      credenzialiAggiornate: p.providerApiKey !== undefined,
      passi: p.completa ?? [],
    },
    ip: params.ip,
  });
  return finale;
}

/** `attivo` solo quando c'è tutto: dati fiscali, intermediario, delega. */
export async function ricalcolaStatoConfigurazione(settings: SdiSettings): Promise<SdiSettings> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, settings.userId));
  const mancanti = requisitiMancanti(settings, profile ?? null);
  const stato = mancanti.length === 0 ? "attivo" : settings.stato === "sospeso" ? "sospeso" : mancanti.length < 4 ? "in_configurazione" : "non_configurato";
  if (stato === settings.stato) return settings;
  const [aggiornata] = await db.update(sdiSettingsTable).set({ stato }).where(eq(sdiSettingsTable.userId, settings.userId)).returning();
  return aggiornata!;
}

// ── Progressivo di invio ─────────────────────────────────────────────────────

/** Univoco per trasmittente: `<anno a 2 cifre><contatore>`, mai riusato. */
export async function prossimoProgressivo(userId: string, now = new Date()): Promise<string> {
  const anno = now.getFullYear();
  const [row] = await db
    .insert(invoiceSequencesTable)
    .values({ userId, year: anno, kind: "SDI", next: 2 })
    .onConflictDoUpdate({ target: [invoiceSequencesTable.userId, invoiceSequencesTable.year, invoiceSequencesTable.kind], set: { next: sql`${invoiceSequencesTable.next} + 1` } })
    .returning({ next: invoiceSequencesTable.next });
  return componiProgressivo(anno, (row?.next ?? 2) - 1);
}

// ── Anteprima ────────────────────────────────────────────────────────────────

export type Anteprima = { input: FatturaPaInput; xml: string; validazione: EsitoValidazione; fileName: string };

/**
 * Costruisce il documento elettronico **senza** consumare un progressivo:
 * serve alla schermata "controlla prima di inviare". Il progressivo finto
 * (`ANTEPRIMA`) non finisce mai in un file trasmesso.
 */
export async function anteprimaFattura(params: { invoiceId: string; userId: string }): Promise<Anteprima> {
  const { invoice, settings, profile, client, originale } = await contesto(params);
  const input = mappaFattura({
    invoice,
    profile,
    settings,
    client,
    iban: decryptField(profile?.iban),
    fatturaOriginale: originale,
    progressivoInvio: "ANTEPRIMA",
  });
  return {
    input,
    xml: buildFatturaPaXml(input),
    validazione: validaFatturaPa(input),
    fileName: nomeFileFattura("IT", input.cedente.partitaIva || "00000000000", "ANTEPRIMA"),
  };
}

async function contesto(params: { invoiceId: string; userId: string }) {
  const caricata = await loadInvoice(params.invoiceId);
  if (!caricata || caricata.invoice.userId !== params.userId) throw new ErroreSdi("not_found", "Fattura non trovata.");
  const invoice = caricata.invoice;
  const settings = await impostazioniOCrea(params.userId);
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, params.userId));
  const client = invoice.clientId ? ((await db.select().from(clientsTable).where(eq(clientsTable.id, invoice.clientId)))[0] ?? null) : null;
  const originale = invoice.creditNoteForId
    ? ((await db.select({ number: invoicesTable.number, issueDate: invoicesTable.issueDate }).from(invoicesTable).where(eq(invoicesTable.id, invoice.creditNoteForId)))[0] ?? null)
    : null;
  return { invoice, settings, profile: profile ?? null, client, originale };
}

// ── Invio ────────────────────────────────────────────────────────────────────

/**
 * Trasmette la fattura allo SdI tramite l'intermediario. Rifiuta tutto ciò
 * che sarebbe scartato (meglio un errore in dashboard che un documento "non
 * emesso" da correggere in 5 giorni) e archivia l'XML nel nostro storage
 * prima ancora di consegnarlo.
 */
export async function inviaAlloSdi(params: { invoiceId: string; userId: string; actorId?: string | null; ip?: string | null; forza?: boolean }): Promise<{ eInvoice: EInvoice; validazione: EsitoValidazione }> {
  const { invoice, settings, profile, client, originale } = await contesto(params);
  if (invoice.status === "draft") throw new ErroreSdi("bozza", "La fattura è ancora una bozza: inviala al cliente prima di trasmetterla allo SdI.");
  if (invoice.status === "void") throw new ErroreSdi("annullata", "La fattura è annullata.");

  const esistente = await trasmissioneCorrente(invoice.id);
  if (esistente && esistente.stato !== "scartata") {
    throw new ErroreSdi("gia_trasmessa", `La fattura è già stata trasmessa (stato: ${STATI_SDI_LABEL[esistente.stato]}).`);
  }

  const progressivo = await prossimoProgressivo(params.userId);
  const input = mappaFattura({
    invoice,
    profile,
    settings,
    client,
    iban: decryptField(profile?.iban),
    fatturaOriginale: originale,
    progressivoInvio: progressivo,
  });
  const validazione = validaFatturaPa(input);
  if (!validazione.ok && !params.forza) {
    throw new ErroreSdi("non_valida", "La fattura non è pronta per lo SdI: correggi i dati segnalati.", validazione.errori);
  }

  const xml = buildFatturaPaXml(input);
  const fileName = nomeFileFattura("IT", input.cedente.partitaIva || "00000000000", progressivo);
  const xmlHash = createHash("sha256").update(xml).digest("hex");
  const xmlPath = `sdi/${params.userId}/${input.data.slice(0, 4)}/${fileName}`;
  try {
    await storage.uploadObjectBuffer({ subPath: xmlPath, buffer: Buffer.from(xml, "utf8"), contentType: "application/xml" });
  } catch (err) {
    logger.error({ err, invoiceId: invoice.id }, "XML FatturaPA non archiviato");
    throw new ErroreSdi("storage", "Non è stato possibile archiviare il file XML: riprova.");
  }

  const [riga] = await db
    .insert(eInvoicesTable)
    .values({
      userId: params.userId,
      invoiceId: invoice.id,
      tipoDocumento: input.tipoDocumento,
      formatoTrasmissione: input.formatoTrasmissione,
      progressivoInvio: progressivo,
      fileName,
      xmlPath,
      xmlHash,
      xmlBytes: Buffer.byteLength(xml, "utf8"),
      stato: "pronta",
      codiceDestinatario: input.codiceDestinatario,
      pecDestinatario: input.pecDestinatario ?? null,
      provider: settings.provider,
      ambiente: settings.ambiente,
      bolloVirtuale: Boolean(input.bolloVirtualeCents),
      bolloCents: input.bolloVirtualeCents ?? 0,
      totaleCents: input.totaleDocumentoCents,
      conservazione: settings.conservazioneAttiva ? "in_corso" : "non_richiesta",
    })
    .returning();

  const intermediario = intermediarioPer(settings);
  try {
    const esito = await intermediario.invia({ fileName, xml, conservazione: settings.conservazioneAttiva });
    const [inviata] = await db
      .update(eInvoicesTable)
      .set({
        stato: esito.stato,
        providerDocumentId: esito.providerDocumentId,
        identificativoSdi: esito.identificativoSdi ?? null,
        inviataAt: new Date(),
        ultimoEventoAt: new Date(),
        erroreCodice: null,
        erroreMessaggio: null,
      })
      .where(eq(eInvoicesTable.id, riga!.id))
      .returning();
    if (esistente) await db.update(eInvoicesTable).set({ rinviataInId: riga!.id }).where(eq(eInvoicesTable.id, esistente.id));
    await registraEvento(inviata!, {
      tipo: "invio",
      stato: esito.stato,
      messaggio: esito.messaggio ?? `Trasmessa tramite ${settings.provider} (${settings.ambiente}).`,
      providerEventId: `${esito.providerDocumentId}:invio`,
      providerDocumentId: esito.providerDocumentId,
      ricevutoAt: new Date(),
      payload: { progressivo, fileName },
    });
    await registraBolloDocumento(inviata!);
    await writeAudit({
      userId: params.userId,
      actorType: "user",
      actorId: params.actorId ?? params.userId,
      entityType: "e_invoice",
      entityId: inviata!.id,
      action: "sent_to_sdi",
      diff: { invoiceId: invoice.id, numero: invoice.number, fileName, xmlHash, provider: settings.provider, ambiente: settings.ambiente, forzata: Boolean(params.forza) },
      ip: params.ip,
    });
    return { eInvoice: inviata!, validazione };
  } catch (err) {
    const messaggio = err instanceof Error ? err.message : "Errore sconosciuto";
    await db.update(eInvoicesTable).set({ stato: "pronta", erroreMessaggio: messaggio, ultimoEventoAt: new Date() }).where(eq(eInvoicesTable.id, riga!.id));
    logger.error({ err, invoiceId: invoice.id }, "Invio allo SdI fallito");
    throw new ErroreSdi("intermediario", `L'intermediario non ha accettato la trasmissione: ${messaggio}`);
  }
}

/** L'ultima trasmissione di una fattura (quella che conta). */
export async function trasmissioneCorrente(invoiceId: string): Promise<EInvoice | null> {
  const [riga] = await db.select().from(eInvoicesTable).where(eq(eInvoicesTable.invoiceId, invoiceId)).orderBy(desc(eInvoicesTable.createdAt)).limit(1);
  return riga ?? null;
}

export async function trasmissioniDi(invoiceId: string): Promise<EInvoice[]> {
  return db.select().from(eInvoicesTable).where(eq(eInvoicesTable.invoiceId, invoiceId)).orderBy(desc(eInvoicesTable.createdAt));
}

export async function eventiDi(eInvoiceId: string) {
  return db.select().from(eInvoiceEventsTable).where(eq(eInvoiceEventsTable.eInvoiceId, eInvoiceId)).orderBy(desc(eInvoiceEventsTable.ricevutoAt));
}

// ── Stati SdI ────────────────────────────────────────────────────────────────

/** Scrive un evento (idempotente) e porta il documento nel nuovo stato. */
export async function registraEvento(eInvoice: EInvoice, evento: EventoSdi): Promise<EInvoice> {
  const inserito = await db
    .insert(eInvoiceEventsTable)
    .values({
      eInvoiceId: eInvoice.id,
      userId: eInvoice.userId,
      tipo: evento.tipo,
      statoDopo: evento.stato,
      messaggio: evento.messaggio ?? "",
      providerEventId: evento.providerEventId,
      payload: evento.payload,
      ricevutoAt: evento.ricevutoAt,
    })
    .onConflictDoNothing()
    .returning();
  // Evento già visto: niente da aggiornare.
  if (inserito.length === 0 && evento.providerEventId) return eInvoice;
  if (!evento.stato) {
    const [soloData] = await db.update(eInvoicesTable).set({ ultimoEventoAt: evento.ricevutoAt }).where(eq(eInvoicesTable.id, eInvoice.id)).returning();
    return soloData!;
  }
  const valori: Partial<typeof eInvoicesTable.$inferInsert> = { stato: evento.stato, ultimoEventoAt: evento.ricevutoAt };
  if (evento.identificativoSdi) valori.identificativoSdi = evento.identificativoSdi;
  if (evento.stato === "consegnata" || evento.stato === "mancata_consegna") valori.consegnataAt = evento.ricevutoAt;
  if (evento.stato === "scartata") {
    valori.erroreCodice = evento.erroreCodice ?? null;
    valori.erroreMessaggio = descrizioneErroreSdi(evento.erroreCodice, evento.messaggio);
  }
  if (evento.tipo.toLowerCase().includes("storage") || evento.tipo.toLowerCase().includes("conservazione")) {
    valori.conservazione = "conservata";
    valori.conservazioneAt = evento.ricevutoAt;
    valori.conservazioneRiferimento = evento.providerEventId;
  }
  const [aggiornata] = await db.update(eInvoicesTable).set(valori).where(eq(eInvoicesTable.id, eInvoice.id)).returning();
  await avvisa(aggiornata!, evento);
  return aggiornata!;
}

async function avvisa(eInvoice: EInvoice, evento: EventoSdi): Promise<void> {
  const [fattura] = await db.select({ numero: invoicesTable.number }).from(invoicesTable).where(eq(invoicesTable.id, eInvoice.invoiceId));
  const numero = fattura?.numero ?? "";
  if (evento.stato === "scartata") {
    await createNotification({
      userId: eInvoice.userId,
      type: "sdi_scarto",
      title: `Fattura ${numero} scartata dallo SdI`,
      body: `${eInvoice.erroreMessaggio ?? descrizioneErroreSdi(evento.erroreCodice, evento.messaggio)} Correggi e rinvia entro 5 giorni: fino ad allora la fattura si considera non emessa.`,
      link: `/dashboard/invoices/${eInvoice.invoiceId}`,
      entityType: "invoice",
      entityId: eInvoice.invoiceId,
    });
  } else if (evento.stato === "mancata_consegna") {
    await createNotification({
      userId: eInvoice.userId,
      type: "sdi_mancata_consegna",
      title: `Fattura ${numero}: mancata consegna`,
      body: "Il cliente non ha un canale telematico attivo. La fattura è valida ed è depositata nel suo cassetto fiscale: avvisalo e mandagli la copia di cortesia.",
      link: `/dashboard/invoices/${eInvoice.invoiceId}`,
      entityType: "invoice",
      entityId: eInvoice.invoiceId,
    });
  } else if (evento.stato === "rifiutata") {
    await createNotification({
      userId: eInvoice.userId,
      type: "sdi_rifiuto",
      title: `Fattura ${numero} rifiutata dall'ente`,
      body: "La Pubblica Amministrazione ha rifiutato la fattura: correggila e rinviala, oppure emetti una nota di credito.",
      link: `/dashboard/invoices/${eInvoice.invoiceId}`,
      entityType: "invoice",
      entityId: eInvoice.invoiceId,
    });
  }
}

/** Interroga l'intermediario e applica gli eventi nuovi. */
export async function sincronizzaStato(eInvoice: EInvoice): Promise<EInvoice> {
  if (!eInvoice.providerDocumentId) return eInvoice;
  if (STATI_SDI_FINALI.includes(eInvoice.stato) && eInvoice.conservazione !== "in_corso") return eInvoice;
  const settings = await impostazioniOCrea(eInvoice.userId);
  const intermediario = intermediarioPer(settings);
  let corrente = eInvoice;
  try {
    const { stato, eventi } = await intermediario.stato(eInvoice.providerDocumentId);
    for (const evento of eventi) corrente = await registraEvento(corrente, evento);
    if (eventi.length === 0 && stato !== corrente.stato) {
      corrente = await registraEvento(corrente, {
        tipo: "stato",
        stato,
        messaggio: `Stato aggiornato dall'intermediario: ${STATI_SDI_LABEL[stato]}.`,
        providerEventId: `${eInvoice.providerDocumentId}:${stato}`,
        providerDocumentId: eInvoice.providerDocumentId,
        ricevutoAt: new Date(),
        payload: {},
      });
    }
  } catch (err) {
    logger.warn({ err, eInvoiceId: eInvoice.id }, "Stato SdI non aggiornabile");
  }
  return corrente;
}

/** Documenti ancora in volo: li ripassa il cron. */
export async function trasmissioniDaSincronizzare(limite = 100): Promise<EInvoice[]> {
  return db
    .select()
    .from(eInvoicesTable)
    .where(and(inArray(eInvoicesTable.stato, ["inviata", "consegnata"] as StatoSdi[]), sql`${eInvoicesTable.providerDocumentId} is not null`))
    .orderBy(eInvoicesTable.ultimoEventoAt)
    .limit(limite);
}

// ── XML per l'utente ─────────────────────────────────────────────────────────

/** Scarica l'XML archiviato (conservazione esportabile: l'utente resta padrone dei suoi documenti). */
export async function xmlTrasmissione(params: { eInvoiceId: string; userId: string }): Promise<{ fileName: string; xml: string }> {
  const [riga] = await db.select().from(eInvoicesTable).where(and(eq(eInvoicesTable.id, params.eInvoiceId), eq(eInvoicesTable.userId, params.userId)));
  if (!riga?.xmlPath) throw new ErroreSdi("not_found", "File XML non disponibile.");
  const risposta = await storage.downloadPrivateObject(riga.xmlPath);
  if (!risposta.ok) throw new ErroreSdi("storage", "File XML non leggibile.");
  return { fileName: riga.fileName, xml: await risposta.text() };
}

// ── Serializzazione per l'interfaccia ────────────────────────────────────────

export function serializzaTrasmissione(e: EInvoice) {
  return {
    id: e.id,
    invoiceId: e.invoiceId,
    stato: e.stato,
    statoLabel: STATI_SDI_LABEL[e.stato],
    tipoDocumento: e.tipoDocumento,
    formatoTrasmissione: e.formatoTrasmissione,
    progressivoInvio: e.progressivoInvio,
    fileName: e.fileName,
    identificativoSdi: e.identificativoSdi,
    codiceDestinatario: e.codiceDestinatario,
    pecDestinatario: e.pecDestinatario,
    provider: e.provider,
    ambiente: e.ambiente,
    bolloVirtuale: e.bolloVirtuale,
    bolloCents: e.bolloCents,
    totaleCents: e.totaleCents,
    erroreCodice: e.erroreCodice,
    erroreMessaggio: e.erroreMessaggio,
    conservazione: e.conservazione,
    conservazioneAt: e.conservazioneAt?.toISOString() ?? null,
    inviataAt: e.inviataAt?.toISOString() ?? null,
    consegnataAt: e.consegnataAt?.toISOString() ?? null,
    ultimoEventoAt: e.ultimoEventoAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

export function serializzaImpostazioni(s: SdiSettings, extra: { requisitiMancanti: Requisito[]; codiceDestinatarioIntermediario: string | null }) {
  return {
    provider: s.provider,
    stato: s.stato,
    regimeFiscale: s.regimeFiscale,
    ambiente: s.ambiente,
    codiceDestinatarioRicezione: s.codiceDestinatarioRicezione,
    pecRicezione: s.pecRicezione,
    cicloPassivoAttivo: s.cicloPassivoAttivo,
    cicloPassivoAttivatoAt: s.cicloPassivoAttivatoAt?.toISOString() ?? null,
    delegaFirmataAt: s.delegaFirmataAt?.toISOString() ?? null,
    delegaRiferimento: s.delegaRiferimento,
    conservazioneAttiva: s.conservazioneAttiva,
    onboarding: s.onboarding,
    ultimoErrore: s.ultimoErrore,
    // Mai le credenziali: solo se ci sono.
    credenzialiPresenti: Boolean(s.providerApiKey),
    webhookSegretoPresente: Boolean(s.webhookSecret),
    ...extra,
  };
}

/** Fattura + sua trasmissione, per le schede dell'interfaccia. */
export async function statoFattura(invoice: Invoice): Promise<ReturnType<typeof serializzaTrasmissione> | null> {
  const riga = await trasmissioneCorrente(invoice.id);
  return riga ? serializzaTrasmissione(riga) : null;
}
