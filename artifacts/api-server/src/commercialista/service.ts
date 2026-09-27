import { createHash } from "node:crypto";
import {
  STATI_INCARICO_CHIUSI,
  STATI_INCARICO_IMPEGNATI,
  documentoInTesto,
  informativaIa,
  informativaPrivacyProfessionista,
  letteraIncarico,
  nomeProfessionista,
  normalizzaCodiceFiscale,
  normalizzaPartitaIva,
  normalizeProvince,
  operativita,
  qualificaProfessionista,
  scegliProfessionista,
  statoServizio,
  testoConvenzione,
  transizionePratica,
  validaCodiceFiscale,
  validaPartitaIva,
  validaPec,
  validaProtocolloTelematico,
  azioniPossibili,
  giorniAllaScadenzaRc,
  ETICHETTE_INCARICO,
  ETICHETTE_PRATICA,
  SERVIZIO_COMMERCIALISTA,
  type AzionePratica,
  type DatiCliente,
  type DatiProfessionista,
  type Documento,
  type SezioneAlbo,
  type StatoIncarico,
  type StatoPratica,
} from "@workspace/config";
import {
  db,
  authUsersTable,
  businessProfilesTable,
  compensiProfessionistiTable,
  consulenzeMessaggiTable,
  hasFeature,
  incarichiEventiTable,
  incarichiTable,
  praticheDichiarazioneTable,
  professionistiTable,
  type Incarico,
  type PraticaDichiarazione,
  type Professionista,
} from "@workspace/db";
import { and, asc, count, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { ErroreFiscale } from "../fiscale/service.js";
import { chiusuraDi } from "../primanota/chiusura.js";
import { avvisa } from "./avvisi.js";

// ── A-6: il commercialista nel giro ──────────────────────────────────────────
// Tre attori e una regola: **i dati del cliente li vede solo il professionista
// a cui il cliente ha firmato un incarico, finché l'incarico è attivo e il
// professionista è in regola**, e ogni volta che li apre resta scritto.
//
//   cliente        → chiede il servizio, firma la lettera, consegna la chiusura
//                    d'anno, conferma la bozza, scrive in chat, revoca;
//   professionista → si candida, firma la convenzione, accetta l'incarico dopo
//                    l'adeguata verifica, rivede, approva con la bozza, invia
//                    dopo la conferma, carica la ricevuta, risponde in chat;
//   PrevAI         → verifica iscrizione, Entratel e polizza, fissa il compenso
//                    (D11), assegna le richieste a mano finché D9 è aperta.
//
// Tutti gli errori attesi sono `ErroreFiscale` con un codice, come nel resto
// del modulo: la rotta li traduce in 400/404/409.

export { ErroreFiscale };

const sha256 = (testo: string | Buffer) => createHash("sha256").update(testo).digest("hex");

// ── Eventi ───────────────────────────────────────────────────────────────────

type Attore = "cliente" | "professionista" | "prevai" | "sistema";

async function evento(params: { incarico: Pick<Incarico, "id" | "userId">; tipo: string; attore: Attore; attoreId?: string | null; dettagli?: Record<string, unknown>; ip?: string | null }) {
  await db.insert(incarichiEventiTable).values({
    incaricoId: params.incarico.id,
    userId: params.incarico.userId,
    tipo: params.tipo,
    attore: params.attore,
    attoreId: params.attoreId ?? null,
    dettagli: params.dettagli ?? {},
    ip: params.ip ?? null,
  });
}

// ── Professionisti ───────────────────────────────────────────────────────────

export async function professionistaDiUtente(userId: string): Promise<Professionista | undefined> {
  const [p] = await db.select().from(professionistiTable).where(eq(professionistiTable.userId, userId));
  return p;
}

async function professionistaPerId(id: string): Promise<Professionista | undefined> {
  const [p] = await db.select().from(professionistiTable).where(eq(professionistiTable.id, id));
  return p;
}

export function operativitaDi(p: Professionista, now = new Date()) {
  return operativita(
    {
      stato: p.stato,
      abilitatoEntratel: p.abilitatoEntratel,
      rcVerificataAt: p.rcVerificataAt,
      rcScadenza: p.rcScadenza,
      convenzioneFirmataAt: p.convenzioneFirmataAt,
      convenzioneCessataAt: p.convenzioneCessataAt,
    },
    now,
  );
}

export function datiProfessionista(p: Professionista): DatiProfessionista {
  return {
    nome: p.nome,
    cognome: p.cognome,
    codiceFiscale: p.codiceFiscale,
    partitaIva: p.partitaIva,
    sezioneAlbo: p.sezioneAlbo as SezioneAlbo,
    ordine: p.ordine,
    numeroAlbo: p.numeroAlbo,
    pec: p.pec,
    studio: p.studio,
    indirizzoStudio: p.indirizzoStudio,
    rcCompagnia: p.rcCompagnia,
    rcNumeroPolizza: p.rcNumeroPolizza,
    rcMassimaleCents: p.rcMassimaleCents,
    rcScadenza: p.rcScadenza,
    altriStrumentiIa: p.altriStrumentiIa,
  };
}

/** Ciò che il cliente vede del suo professionista: nome, iscrizione, polizza. Mai il codice fiscale. */
export function schedaPubblica(p: Professionista) {
  const d = datiProfessionista(p);
  return {
    id: p.id,
    nome: nomeProfessionista(d),
    qualifica: qualificaProfessionista(d),
    studio: p.studio,
    pec: p.pec,
    polizza: { compagnia: p.rcCompagnia, numero: p.rcNumeroPolizza, massimaleCents: p.rcMassimaleCents, scadenza: p.rcScadenza?.toISOString() ?? null },
  };
}

export function serializzaProfessionista(p: Professionista, now = new Date()) {
  const op = operativitaDi(p, now);
  return {
    id: p.id,
    nome: p.nome,
    cognome: p.cognome,
    codiceFiscale: p.codiceFiscale,
    partitaIva: p.partitaIva,
    sezioneAlbo: p.sezioneAlbo,
    ordine: p.ordine,
    numeroAlbo: p.numeroAlbo,
    pec: p.pec,
    studio: p.studio,
    indirizzoStudio: p.indirizzoStudio,
    provincia: p.provincia,
    abilitatoEntratel: p.abilitatoEntratel,
    rcCompagnia: p.rcCompagnia,
    rcNumeroPolizza: p.rcNumeroPolizza,
    rcMassimaleCents: p.rcMassimaleCents,
    rcScadenza: p.rcScadenza?.toISOString() ?? null,
    rcVerificataAt: p.rcVerificataAt?.toISOString() ?? null,
    rcGiorniAllaScadenza: giorniAllaScadenzaRc(p.rcScadenza, now),
    altriStrumentiIa: p.altriStrumentiIa,
    capienza: p.capienza,
    stato: p.stato,
    verificatoAt: p.verificatoAt?.toISOString() ?? null,
    noteVerifica: p.noteVerifica,
    motivoSospensione: p.motivoSospensione,
    compensoPraticaCents: p.compensoPraticaCents,
    convenzione: {
      firmataAt: p.convenzioneFirmataAt?.toISOString() ?? null,
      versione: p.convenzioneVersione,
      impronta: p.convenzioneImpronta,
      cessataAt: p.convenzioneCessataAt?.toISOString() ?? null,
    },
    operativo: op.operativo,
    motivi: op.motivi,
  };
}

export type DatiCandidatura = {
  nome: string;
  cognome: string;
  codiceFiscale: string;
  partitaIva: string;
  sezioneAlbo: SezioneAlbo;
  ordine: string;
  numeroAlbo: string;
  pec: string;
  studio?: string;
  indirizzoStudio?: string;
  provincia?: string | null;
  abilitatoEntratel: boolean;
  rcCompagnia: string;
  rcNumeroPolizza: string;
  rcMassimaleCents: number;
  rcScadenza: Date;
  altriStrumentiIa?: string;
};

/**
 * Candidatura o aggiornamento del profilo. Iscrizione e identità, una volta
 * verificate, non si cambiano da soli: servirebbe una nuova verifica, e nel
 * frattempo i clienti vedrebbero dati che nessuno ha controllato. La polizza
 * invece si rinnova ogni anno: il nuovo numero o la nuova scadenza azzerano
 * la verifica della polizza, e il professionista resta fermo finché PrevAI
 * non la vede.
 */
export async function salvaCandidatura(userId: string, dati: DatiCandidatura): Promise<Professionista> {
  const codiceFiscale = normalizzaCodiceFiscale(dati.codiceFiscale);
  const partitaIva = normalizzaPartitaIva(dati.partitaIva);
  if (!validaCodiceFiscale(codiceFiscale)) throw new ErroreFiscale("codice_fiscale", "Il codice fiscale non è valido.");
  if (!validaPartitaIva(partitaIva)) throw new ErroreFiscale("partita_iva", "La partita IVA non è valida.");
  if (!validaPec(dati.pec)) throw new ErroreFiscale("pec", "L'indirizzo PEC non è valido.");
  if (dati.rcMassimaleCents <= 0) throw new ErroreFiscale("rc", "Indica il massimale della polizza RC professionale.");

  const esistente = await professionistaDiUtente(userId);
  const valoriPolizza = {
    rcCompagnia: dati.rcCompagnia.trim(),
    rcNumeroPolizza: dati.rcNumeroPolizza.trim(),
    rcMassimaleCents: dati.rcMassimaleCents,
    rcScadenza: dati.rcScadenza,
  };
  const altri = {
    studio: dati.studio?.trim() ?? "",
    indirizzoStudio: dati.indirizzoStudio?.trim() ?? "",
    provincia: normalizeProvince(dati.provincia ?? null),
    abilitatoEntratel: dati.abilitatoEntratel,
    altriStrumentiIa: dati.altriStrumentiIa?.trim() ?? "",
  };
  const identita = {
    nome: dati.nome.trim(),
    cognome: dati.cognome.trim(),
    codiceFiscale,
    partitaIva,
    sezioneAlbo: dati.sezioneAlbo,
    ordine: dati.ordine.trim(),
    numeroAlbo: dati.numeroAlbo.trim(),
    pec: dati.pec.trim().toLowerCase(),
  };

  if (!esistente) {
    const [creato] = await db.insert(professionistiTable).values({ userId, ...identita, ...valoriPolizza, ...altri }).returning();
    return creato!;
  }
  if (esistente.stato === "cessato") throw new ErroreFiscale("cessato", "Il rapporto con PrevAI è cessato: per riprenderlo scrivi al supporto.");

  const identitaCambiata = (Object.keys(identita) as (keyof typeof identita)[]).some((k) => String(esistente[k]) !== String(identita[k]));
  if (identitaCambiata && esistente.stato !== "candidato") {
    throw new ErroreFiscale("identita_verificata", "Nome, codice fiscale, partita IVA, iscrizione e PEC sono già stati verificati: per cambiarli scrivi al supporto, serve una nuova verifica.");
  }
  const polizzaCambiata =
    esistente.rcNumeroPolizza !== valoriPolizza.rcNumeroPolizza ||
    esistente.rcCompagnia !== valoriPolizza.rcCompagnia ||
    esistente.rcMassimaleCents !== valoriPolizza.rcMassimaleCents ||
    esistente.rcScadenza?.getTime() !== valoriPolizza.rcScadenza.getTime();
  // Chi toglie l'abilitazione Entratel si ferma subito; chi la aggiunge dopo la verifica aspetta un controllo.
  const entratelAggiunto = !esistente.abilitatoEntratel && altri.abilitatoEntratel && esistente.stato !== "candidato";

  const [aggiornato] = await db
    .update(professionistiTable)
    .set({
      ...identita,
      ...valoriPolizza,
      ...altri,
      abilitatoEntratel: entratelAggiunto ? false : altri.abilitatoEntratel,
      rcVerificataAt: polizzaCambiata ? null : esistente.rcVerificataAt,
    })
    .where(eq(professionistiTable.id, esistente.id))
    .returning();
  return aggiornato!;
}

export async function professionistiOperativi(now = new Date()): Promise<Professionista[]> {
  const verificati = await db.select().from(professionistiTable).where(eq(professionistiTable.stato, "verificato"));
  return verificati.filter((p) => operativitaDi(p, now).operativo);
}

/** Documento della convenzione da mostrare al professionista, col compenso fissato da PrevAI. */
export function convenzioneDi(p: Professionista): Documento | null {
  if (p.compensoPraticaCents === null) return null;
  return testoConvenzione(datiProfessionista(p), p.compensoPraticaCents, SERVIZIO_COMMERCIALISTA.decisioni.D9);
}

export async function firmaConvenzione(p: Professionista, improntaVista: string, ip: string | null): Promise<Professionista> {
  if (p.stato !== "verificato") throw new ErroreFiscale("non_verificato", "La convenzione si firma dopo la verifica dell'iscrizione da parte di PrevAI.");
  if (p.convenzioneFirmataAt && !p.convenzioneCessataAt) throw new ErroreFiscale("gia_firmata", "La convenzione è già firmata.");
  const doc = convenzioneDi(p);
  if (!doc) throw new ErroreFiscale("compenso_mancante", "Il compenso per pratica non è ancora stato fissato: la convenzione non si può firmare.");
  const impronta = sha256(documentoInTesto(doc));
  if (impronta !== improntaVista) throw new ErroreFiscale("testo_cambiato", "Il testo della convenzione è cambiato mentre lo leggevi: ricarica la pagina.");
  const [firmato] = await db
    .update(professionistiTable)
    .set({
      convenzioneVersione: doc.versione,
      convenzioneImpronta: impronta,
      convenzioneTesto: doc as unknown as Record<string, unknown>,
      convenzioneFirmataAt: new Date(),
      convenzioneFirmataIp: ip,
      convenzioneCessataAt: null,
    })
    .where(eq(professionistiTable.id, p.id))
    .returning();
  return firmato!;
}

// ── Amministrazione PrevAI ───────────────────────────────────────────────────

export async function elencoProfessionisti() {
  const righe = await db.select().from(professionistiTable).orderBy(asc(professionistiTable.stato), desc(professionistiTable.createdAt));
  const carichi = await caricoProfessionisti();
  return righe.map((p) => ({ ...serializzaProfessionista(p), carico: carichi.get(p.id) ?? 0 }));
}

async function caricoProfessionisti(): Promise<Map<string, number>> {
  const righe = await db
    .select({ id: incarichiTable.professionistaId, n: count() })
    .from(incarichiTable)
    .where(inArray(incarichiTable.stato, [...STATI_INCARICO_IMPEGNATI]))
    .groupBy(incarichiTable.professionistaId);
  return new Map(righe.filter((r) => r.id).map((r) => [r.id!, Number(r.n)]));
}

export async function verificaProfessionista(id: string, params: { da: string; note: string; rcVerificata: boolean; entratelVerificato: boolean; capienza?: number; compensoPraticaCents?: number | null }) {
  const p = await professionistaPerId(id);
  if (!p) throw new ErroreFiscale("not_found", "Professionista non trovato.");
  if (p.stato === "cessato") throw new ErroreFiscale("cessato", "Il rapporto è cessato.");
  const [aggiornato] = await db
    .update(professionistiTable)
    .set({
      stato: "verificato",
      verificatoAt: p.verificatoAt ?? new Date(),
      verificatoDa: params.da,
      noteVerifica: params.note,
      sospesoAt: null,
      motivoSospensione: "",
      rcVerificataAt: params.rcVerificata ? new Date() : p.rcVerificataAt,
      abilitatoEntratel: params.entratelVerificato ? true : p.abilitatoEntratel,
      capienza: params.capienza ?? p.capienza,
      compensoPraticaCents: params.compensoPraticaCents === undefined ? p.compensoPraticaCents : params.compensoPraticaCents,
    })
    .where(eq(professionistiTable.id, id))
    .returning();
  await avvisa({ userId: p.userId, tipo: "professionista_verificato", titolo: "Profilo verificato da PrevAI", corpo: "Il tuo profilo di professionista è stato verificato.", link: "/studio" });
  return serializzaProfessionista(aggiornato!);
}

export async function sospendiProfessionista(id: string, motivo: string, cessa: boolean) {
  const p = await professionistaPerId(id);
  if (!p) throw new ErroreFiscale("not_found", "Professionista non trovato.");
  const [aggiornato] = await db
    .update(professionistiTable)
    .set({
      stato: cessa ? "cessato" : "sospeso",
      sospesoAt: new Date(),
      motivoSospensione: motivo,
      convenzioneCessataAt: cessa ? new Date() : p.convenzioneCessataAt,
    })
    .where(eq(professionistiTable.id, id))
    .returning();
  // Gli incarichi non ancora partiti tornano in coda: un cliente non aspetta chi non può lavorare.
  const inAttesa = await db
    .select()
    .from(incarichiTable)
    .where(and(eq(incarichiTable.professionistaId, id), inArray(incarichiTable.stato, ["proposto", "firmato_cliente"])));
  for (const i of inAttesa) {
    await db
      .update(incarichiTable)
      .set({ stato: "da_assegnare", professionistaId: null, assegnatoAt: null, assegnatoDa: null, documenti: null, impronta: null, firmatoAt: null, firmatoDa: null, informativaIaAccettataAt: null, informativaPrivacyAccettataAt: null })
      .where(eq(incarichiTable.id, i.id));
    await evento({ incarico: i, tipo: "riassegnazione", attore: "prevai", dettagli: { motivo: "professionista non disponibile" } });
  }
  return serializzaProfessionista(aggiornato!);
}

// ── Stato del servizio ───────────────────────────────────────────────────────

export async function statoServizioOra(now = new Date()) {
  const operativi = await professionistiOperativi(now);
  return statoServizio({ anno: now.getUTCFullYear(), professionistiOperativi: operativi.length });
}

// ── Incarichi: richiesta, assegnazione, firma ────────────────────────────────

async function datiCliente(userId: string): Promise<DatiCliente & { provincia: string | null }> {
  const [bp] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  const [utente] = await db.select({ name: authUsersTable.name }).from(authUsersTable).where(eq(authUsersTable.id, userId));
  const indirizzo = [bp?.address, [bp?.cap, bp?.city].filter(Boolean).join(" "), bp?.province ? `(${bp.province})` : ""].filter(Boolean).join(", ");
  return {
    ragioneSociale: bp?.companyName || utente?.name || "",
    codiceFiscale: bp?.codiceFiscale ?? "",
    partitaIva: bp?.vatNumber ?? "",
    indirizzo,
    titolare: utente?.name ?? "",
    provincia: bp?.province ?? null,
  };
}

const COMPENSO_CLIENTE_TESTO =
  "Il compenso del professionista per le attività elencate al punto 2 è compreso nel canone del servizio pagato a PrevAI, che lo riconosce al professionista secondo la convenzione fra loro.";

function documentiIncarico(p: Professionista, cliente: DatiCliente, anno: number) {
  const dati = datiProfessionista(p);
  const lettera = letteraIncarico(dati, cliente, { anno, compensoClienteTesto: COMPENSO_CLIENTE_TESTO, dataProposta: new Date() });
  const ia = informativaIa(dati);
  const privacy = informativaPrivacyProfessionista(dati);
  const impronta = sha256([lettera, ia, privacy].map(documentoInTesto).join("\n\n----\n\n"));
  return { documenti: { lettera, informativaIa: ia, informativaPrivacy: privacy }, impronta };
}

export async function incaricoCorrente(userId: string, anno: number): Promise<Incarico | undefined> {
  const [aperto] = await db
    .select()
    .from(incarichiTable)
    .where(and(eq(incarichiTable.userId, userId), eq(incarichiTable.anno, anno), notInArray(incarichiTable.stato, [...STATI_INCARICO_CHIUSI])));
  if (aperto) return aperto;
  const [ultimo] = await db
    .select()
    .from(incarichiTable)
    .where(and(eq(incarichiTable.userId, userId), eq(incarichiTable.anno, anno)))
    .orderBy(desc(incarichiTable.createdAt))
    .limit(1);
  return ultimo;
}

async function incaricoDelCliente(userId: string, incaricoId: string): Promise<Incarico> {
  const [i] = await db.select().from(incarichiTable).where(and(eq(incarichiTable.id, incaricoId), eq(incarichiTable.userId, userId)));
  if (!i) throw new ErroreFiscale("not_found", "Incarico non trovato.");
  return i;
}

async function assegnaA(incarico: Incarico, p: Professionista, da: string): Promise<Incarico> {
  const cliente = await datiCliente(incarico.userId);
  const { documenti, impronta } = documentiIncarico(p, cliente, incarico.anno);
  const [aggiornato] = await db
    .update(incarichiTable)
    .set({
      professionistaId: p.id,
      stato: "proposto",
      assegnatoAt: new Date(),
      assegnatoDa: da,
      documenti: documenti as unknown as Incarico["documenti"],
      impronta,
    })
    .where(and(eq(incarichiTable.id, incarico.id), eq(incarichiTable.stato, "da_assegnare")))
    .returning();
  if (!aggiornato) throw new ErroreFiscale("stato_cambiato", "L'incarico non è più in attesa di assegnazione.");
  await evento({ incarico, tipo: "assegnato", attore: da === "automatico" ? "sistema" : "prevai", dettagli: { professionista: nomeProfessionista(datiProfessionista(p)), da } });
  await avvisa({
    userId: incarico.userId,
    tipo: "incarico_proposto",
    titolo: "La lettera d'incarico è pronta da firmare",
    corpo: `${nomeProfessionista(datiProfessionista(p))} seguirà la tua dichiarazione dei redditi. Leggi e firma la lettera d'incarico.`,
    link: "/dashboard/fisco/commercialista",
    entityId: incarico.id,
  });
  return aggiornato;
}

/**
 * Il cliente chiede il servizio per un anno d'imposta. Con D9 chiusa
 * l'assegnazione è immediata; con D9 aperta la richiesta resta in coda
 * (`da_assegnare`) per l'amministrazione.
 */
export async function richiediServizio(params: { userId: string; actorId: string; anno: number; ip?: string | null }): Promise<Incarico> {
  const esistente = await incaricoCorrente(params.userId, params.anno);
  if (esistente && !STATI_INCARICO_CHIUSI.includes(esistente.stato)) {
    throw new ErroreFiscale("gia_richiesto", "C'è già un incarico aperto per questo anno.");
  }
  const [creato] = await db.insert(incarichiTable).values({ userId: params.userId, anno: params.anno, richiestoDa: params.actorId }).returning();
  const incarico = creato!;
  await evento({ incarico, tipo: "richiesto", attore: "cliente", attoreId: params.actorId, ip: params.ip, dettagli: { anno: params.anno } });

  const stato = await statoServizioOra();
  if (!stato.assegnazioneAutomatica) return incarico;
  const operativi = await professionistiOperativi();
  const carichi = await caricoProfessionisti();
  const cliente = await datiCliente(params.userId);
  const scelto = scegliProfessionista(
    operativi.map((p) => ({ id: p.id, operativo: true, carico: carichi.get(p.id) ?? 0, capienza: p.capienza, provincia: p.provincia })),
    stato.modello,
    cliente.provincia,
  );
  if (!scelto) return incarico;
  return assegnaA(incarico, operativi.find((p) => p.id === scelto.id)!, "automatico");
}

export async function assegnaManualmente(incaricoId: string, professionistaId: string, da: string): Promise<Incarico> {
  const [i] = await db.select().from(incarichiTable).where(eq(incarichiTable.id, incaricoId));
  if (!i) throw new ErroreFiscale("not_found", "Incarico non trovato.");
  const p = await professionistaPerId(professionistaId);
  if (!p) throw new ErroreFiscale("not_found", "Professionista non trovato.");
  const op = operativitaDi(p);
  if (!op.operativo) throw new ErroreFiscale("non_operativo", `Il professionista non può ricevere incarichi: ${op.motivi.join(" ")}`);
  const carico = (await caricoProfessionisti()).get(p.id) ?? 0;
  if (carico >= p.capienza) throw new ErroreFiscale("capienza", "Il professionista ha raggiunto il numero massimo di incarichi.");
  return assegnaA(i, p, da);
}

export async function richiesteDaAssegnare() {
  const righe = await db
    .select({ incarico: incarichiTable, azienda: businessProfilesTable.companyName, provincia: businessProfilesTable.province })
    .from(incarichiTable)
    .leftJoin(businessProfilesTable, eq(businessProfilesTable.userId, incarichiTable.userId))
    .where(eq(incarichiTable.stato, "da_assegnare"))
    .orderBy(asc(incarichiTable.richiestoAt));
  return righe.map((r) => ({ id: r.incarico.id, anno: r.incarico.anno, richiestoAt: r.incarico.richiestoAt.toISOString(), azienda: r.azienda ?? "", provincia: r.provincia }));
}

export async function firmaIncarico(params: {
  userId: string;
  actorId: string;
  incaricoId: string;
  improntaVista: string;
  informativaIa: boolean;
  informativaPrivacy: boolean;
  ip: string | null;
  userAgent: string | null;
}): Promise<Incarico> {
  const i = await incaricoDelCliente(params.userId, params.incaricoId);
  if (i.stato !== "proposto") throw new ErroreFiscale("stato_cambiato", `L'incarico non è da firmare: ${ETICHETTE_INCARICO[i.stato].toLowerCase()}.`);
  if (!params.informativaIa || !params.informativaPrivacy) {
    throw new ErroreFiscale("informative", "Per firmare devi prendere visione delle due informative allegate: uso dell'intelligenza artificiale e trattamento dei dati.");
  }
  if (!i.impronta || i.impronta !== params.improntaVista) throw new ErroreFiscale("testo_cambiato", "La lettera è cambiata mentre la leggevi: ricarica la pagina.");
  const p = i.professionistaId ? await professionistaPerId(i.professionistaId) : undefined;
  if (!p || !operativitaDi(p).operativo) throw new ErroreFiscale("non_operativo", "Il professionista proposto non è disponibile in questo momento: la richiesta torna in coda.");
  const ora = new Date();
  const [firmato] = await db
    .update(incarichiTable)
    .set({
      stato: "firmato_cliente",
      firmatoAt: ora,
      firmatoDa: params.actorId,
      firmatoIp: params.ip,
      firmatoUserAgent: params.userAgent?.slice(0, 400) ?? null,
      informativaIaAccettataAt: ora,
      informativaPrivacyAccettataAt: ora,
    })
    .where(and(eq(incarichiTable.id, i.id), eq(incarichiTable.stato, "proposto")))
    .returning();
  if (!firmato) throw new ErroreFiscale("stato_cambiato", "L'incarico è cambiato nel frattempo: ricarica la pagina.");
  await evento({ incarico: i, tipo: "firmato", attore: "cliente", attoreId: params.actorId, ip: params.ip, dettagli: { impronta: i.impronta } });
  await avvisa({
    userId: p.userId,
    tipo: "incarico_firmato",
    titolo: "Nuovo incarico firmato dal cliente",
    corpo: "Un cliente ha firmato la lettera d'incarico. Svolgi l'adeguata verifica e accetta l'incarico.",
    link: `/studio/incarichi/${i.id}`,
    entityId: i.id,
  });
  return firmato;
}

export async function revocaIncarico(params: { userId: string; actorId: string; incaricoId: string; motivo: string; ip: string | null }) {
  const i = await incaricoDelCliente(params.userId, params.incaricoId);
  if (STATI_INCARICO_CHIUSI.includes(i.stato)) throw new ErroreFiscale("gia_chiuso", "L'incarico è già chiuso.");
  const [revocato] = await db
    .update(incarichiTable)
    .set({ stato: "revocato", chiusoAt: new Date(), motivoChiusura: params.motivo || "Revocato dal cliente" })
    .where(eq(incarichiTable.id, i.id))
    .returning();
  await evento({ incarico: i, tipo: "revocato", attore: "cliente", attoreId: params.actorId, ip: params.ip, dettagli: { motivo: params.motivo } });
  if (i.professionistaId) {
    const p = await professionistaPerId(i.professionistaId);
    if (p) await avvisa({ userId: p.userId, tipo: "incarico_revocato", titolo: "Un incarico è stato revocato", corpo: "Il cliente ha revocato l'incarico: i suoi dati non sono più accessibili.", link: "/studio", entityId: i.id });
  }
  return revocato!;
}

// ── Lato professionista: accesso all'incarico ────────────────────────────────

export type ContestoProfessionista = { professionista: Professionista; actorUserId: string; ip: string | null };

/**
 * L'unico punto da cui un professionista arriva a un incarico. Controlla, ogni
 * volta: che l'incarico sia suo, che lui sia operativo adesso, e — se servono
 * i dati del cliente — che l'incarico sia attivo e che il cliente abbia ancora
 * il servizio. Se `registra` è dato, l'accesso finisce negli eventi.
 */
export async function incaricoPerProfessionista(
  ctx: ContestoProfessionista,
  incaricoId: string,
  opzioni: { serveAccesso: boolean; registra?: string },
): Promise<Incarico> {
  const [i] = await db
    .select()
    .from(incarichiTable)
    .where(and(eq(incarichiTable.id, incaricoId), eq(incarichiTable.professionistaId, ctx.professionista.id)));
  if (!i) throw new ErroreFiscale("not_found", "Incarico non trovato.");
  const op = operativitaDi(ctx.professionista);
  if (!op.operativo) throw new ErroreFiscale("non_operativo", op.motivi.join(" "));
  if (opzioni.serveAccesso) {
    if (i.stato !== "attivo") throw new ErroreFiscale("senza_accesso", "I dati del cliente sono accessibili solo con l'incarico attivo.");
    const [bp] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, i.userId));
    if (!hasFeature(bp, "accountant_service")) throw new ErroreFiscale("senza_accesso", "Il cliente non ha più il servizio attivo.");
  }
  if (opzioni.registra) await evento({ incarico: i, tipo: "accesso", attore: "professionista", attoreId: ctx.actorUserId, ip: ctx.ip, dettagli: { risorsa: opzioni.registra } });
  return i;
}

export async function incarichiDelProfessionista(p: Professionista) {
  const righe = await db
    .select({ incarico: incarichiTable, azienda: businessProfilesTable.companyName, pratica: praticheDichiarazioneTable })
    .from(incarichiTable)
    .leftJoin(businessProfilesTable, eq(businessProfilesTable.userId, incarichiTable.userId))
    .leftJoin(praticheDichiarazioneTable, eq(praticheDichiarazioneTable.incaricoId, incarichiTable.id))
    .where(eq(incarichiTable.professionistaId, p.id))
    .orderBy(desc(incarichiTable.updatedAt));
  const nonLetti = await db
    .select({ id: consulenzeMessaggiTable.incaricoId, n: count() })
    .from(consulenzeMessaggiTable)
    .where(and(eq(consulenzeMessaggiTable.autore, "cliente"), isNull(consulenzeMessaggiTable.lettoAt)))
    .groupBy(consulenzeMessaggiTable.incaricoId);
  const mappa = new Map(nonLetti.map((r) => [r.id, Number(r.n)]));
  return righe.map((r) => ({
    id: r.incarico.id,
    anno: r.incarico.anno,
    stato: r.incarico.stato,
    etichetta: ETICHETTE_INCARICO[r.incarico.stato],
    // Il nome dell'impresa si vede anche prima di accettare: serve a decidere e all'adeguata verifica.
    azienda: r.azienda ?? "",
    pratica: r.pratica ? { stato: r.pratica.stato, etichetta: ETICHETTE_PRATICA[r.pratica.stato] } : null,
    messaggiNonLetti: mappa.get(r.incarico.id) ?? 0,
    aggiornatoAt: r.incarico.updatedAt.toISOString(),
  }));
}

export async function accettaIncarico(ctx: ContestoProfessionista, incaricoId: string, adeguataVerifica: boolean) {
  const i = await incaricoPerProfessionista(ctx, incaricoId, { serveAccesso: false });
  if (i.stato !== "firmato_cliente") throw new ErroreFiscale("stato_cambiato", "Si accetta un incarico dopo la firma del cliente.");
  if (!adeguataVerifica) throw new ErroreFiscale("adeguata_verifica", "Prima di accettare devi aver svolto l'adeguata verifica della clientela (D.Lgs. 231/2007).");
  const ora = new Date();
  const [attivo] = await db
    .update(incarichiTable)
    .set({ stato: "attivo", adeguataVerificaAt: ora, accettatoAt: ora })
    .where(and(eq(incarichiTable.id, i.id), eq(incarichiTable.stato, "firmato_cliente")))
    .returning();
  if (!attivo) throw new ErroreFiscale("stato_cambiato", "L'incarico è cambiato nel frattempo.");
  await evento({ incarico: i, tipo: "accettato", attore: "professionista", attoreId: ctx.actorUserId, ip: ctx.ip, dettagli: { adeguataVerifica: true } });
  await avvisa({
    userId: i.userId,
    tipo: "incarico_attivo",
    titolo: "Il tuo commercialista ha accettato l'incarico",
    corpo: "Da ora puoi scrivergli in chat e, quando hai chiuso l'anno, consegnargli la pratica.",
    link: "/dashboard/fisco/commercialista",
    entityId: i.id,
  });
  return attivo;
}

export async function chiudiDaProfessionista(ctx: ContestoProfessionista, incaricoId: string, tipo: "rifiuta" | "rinuncia", motivo: string) {
  const i = await incaricoPerProfessionista(ctx, incaricoId, { serveAccesso: false }).catch(async (err) => {
    // Rinunciare deve restare possibile anche a chi non è più operativo (polizza scaduta): è il modo di non lasciare il cliente appeso.
    if (err instanceof ErroreFiscale && err.codice === "non_operativo") {
      const [r] = await db.select().from(incarichiTable).where(and(eq(incarichiTable.id, incaricoId), eq(incarichiTable.professionistaId, ctx.professionista.id)));
      if (r) return r;
    }
    throw err;
  });
  if (!motivo.trim()) throw new ErroreFiscale("motivo", "Indica il motivo: il cliente lo legge.");
  const consentiti: StatoIncarico[] = tipo === "rifiuta" ? ["proposto", "firmato_cliente"] : ["attivo"];
  if (!consentiti.includes(i.stato)) throw new ErroreFiscale("stato_cambiato", tipo === "rifiuta" ? "Si rifiuta un incarico prima di accettarlo." : "Si rinuncia a un incarico attivo.");
  const [chiuso] = await db
    .update(incarichiTable)
    .set({ stato: tipo === "rifiuta" ? "rifiutato" : "rinunciato", chiusoAt: new Date(), motivoChiusura: motivo.trim() })
    .where(eq(incarichiTable.id, i.id))
    .returning();
  await evento({ incarico: i, tipo: tipo === "rifiuta" ? "rifiutato" : "rinunciato", attore: "professionista", attoreId: ctx.actorUserId, ip: ctx.ip, dettagli: { motivo: motivo.trim() } });
  await avvisa({
    userId: i.userId,
    tipo: "incarico_chiuso",
    titolo: tipo === "rifiuta" ? "Il professionista non ha accettato l'incarico" : "Il professionista ha rinunciato all'incarico",
    corpo: `Motivo: ${motivo.trim()}. Puoi chiedere di nuovo il servizio: la richiesta andrà a un altro professionista.`,
    link: "/dashboard/fisco/commercialista",
    entityId: i.id,
  });
  return chiuso!;
}

// ── La pratica ───────────────────────────────────────────────────────────────

export async function praticaDi(incaricoId: string): Promise<PraticaDichiarazione | undefined> {
  const [p] = await db.select().from(praticheDichiarazioneTable).where(eq(praticheDichiarazioneTable.incaricoId, incaricoId));
  return p;
}

/**
 * La pratica vale per una fotografia precisa della chiusura d'anno. Se il
 * cliente riapre l'anno o lo richiude con numeri diversi, ciò che il
 * professionista ha approvato non è più ciò che c'è: si torna alla consegna.
 */
export async function differenzaChiusura(pratica: PraticaDichiarazione): Promise<string | null> {
  const c = await chiusuraDi(pratica.userId, pratica.anno);
  if (!c) return "La chiusura d'anno non esiste più.";
  if (c.stato !== "chiuso") return "L'anno è stato riaperto dopo la consegna.";
  if (c.impronta !== pratica.chiusuraImpronta) return "L'anno è stato richiuso con numeri diversi da quelli consegnati.";
  return null;
}

export function serializzaPratica(p: PraticaDichiarazione | undefined, attore: "cliente" | "professionista", differenza: string | null) {
  if (!p) return null;
  return {
    id: p.id,
    anno: p.anno,
    stato: p.stato,
    etichetta: ETICHETTE_PRATICA[p.stato],
    chiusuraVersione: p.chiusuraVersione,
    chiusuraImpronta: p.chiusuraImpronta,
    osservazioni: p.osservazioni,
    bozza: p.bozzaUrl ? { nome: p.bozzaNome, impronta: p.bozzaImpronta } : null,
    approvataAt: p.approvataAt?.toISOString() ?? null,
    confermataAt: p.confermataAt?.toISOString() ?? null,
    protocollo: p.protocollo,
    inviataAt: p.inviataAt?.toISOString() ?? null,
    ricevuta: p.ricevutaUrl ? { nome: p.ricevutaNome } : null,
    esito: p.esito,
    esitoAt: p.esitoAt?.toISOString() ?? null,
    /** Se i numeri sono cambiati dopo la consegna: la pratica va riconsegnata. */
    differenza,
    azioni: azioniPossibili(p.stato, attore),
  };
}

/** Il cliente consegna (o riconsegna) al professionista la chiusura d'anno attuale. */
export async function consegnaPratica(params: { userId: string; actorId: string; incaricoId: string; ip: string | null }) {
  const i = await incaricoDelCliente(params.userId, params.incaricoId);
  if (i.stato !== "attivo") throw new ErroreFiscale("senza_accesso", "La pratica si consegna quando il professionista ha accettato l'incarico.");
  const c = await chiusuraDi(i.userId, i.anno);
  if (!c || c.stato !== "chiuso") throw new ErroreFiscale("anno_non_chiuso", `Chiudi prima l'anno ${i.anno} nella pagina Chiusura d'anno: il professionista rivede quella fotografia.`);
  const esistente = await praticaDi(i.id);
  const t = transizionePratica(esistente?.stato ?? null, "consegna", "cliente");
  if (!t.ok) {
    // Da "confermata" o oltre non si riconsegna: se i numeri cambiano, lo chiede il professionista.
    throw new ErroreFiscale("stato_pratica", t.motivo);
  }
  const valori = {
    stato: t.a,
    chiusuraVersione: c.versione,
    chiusuraImpronta: c.impronta,
    bozzaUrl: null,
    bozzaNome: null,
    bozzaImpronta: null,
    approvataAt: null,
    confermataAt: null,
    confermataDa: null,
    confermataIp: null,
  };
  let pratica: PraticaDichiarazione;
  if (esistente) {
    [pratica] = (await db.update(praticheDichiarazioneTable).set(valori).where(eq(praticheDichiarazioneTable.id, esistente.id)).returning()) as [PraticaDichiarazione];
  } else {
    [pratica] = (await db.insert(praticheDichiarazioneTable).values({ incaricoId: i.id, userId: i.userId, anno: i.anno, ...valori }).returning()) as [PraticaDichiarazione];
  }
  await evento({ incarico: i, tipo: "consegna", attore: "cliente", attoreId: params.actorId, ip: params.ip, dettagli: { versione: c.versione, impronta: c.impronta } });
  const prof = i.professionistaId ? await professionistaPerId(i.professionistaId) : undefined;
  if (prof) {
    await avvisa({ userId: prof.userId, tipo: "pratica_consegnata", titolo: "Pratica da rivedere", corpo: `Un cliente ti ha consegnato la chiusura dell'anno ${i.anno}.`, link: `/studio/incarichi/${i.id}`, entityId: i.id });
  }
  return pratica;
}

export async function confermaPratica(params: { userId: string; actorId: string; incaricoId: string; bozzaImpronta: string; ip: string | null }) {
  const i = await incaricoDelCliente(params.userId, params.incaricoId);
  if (i.stato !== "attivo") throw new ErroreFiscale("senza_accesso", "L'incarico non è attivo.");
  const pratica = await praticaDi(i.id);
  if (!pratica) throw new ErroreFiscale("not_found", "Nessuna pratica consegnata.");
  const t = transizionePratica(pratica.stato, "conferma", "cliente");
  if (!t.ok) throw new ErroreFiscale("stato_pratica", t.motivo);
  const diff = await differenzaChiusura(pratica);
  if (diff) throw new ErroreFiscale("numeri_cambiati", `${diff} Riconsegna la pratica: il professionista deve rivedere i numeri nuovi.`);
  if (!pratica.bozzaImpronta || pratica.bozzaImpronta !== params.bozzaImpronta) {
    throw new ErroreFiscale("bozza_cambiata", "La bozza è cambiata mentre la leggevi: ricarica la pagina e rileggila.");
  }
  const [confermata] = await db
    .update(praticheDichiarazioneTable)
    .set({ stato: t.a, confermataAt: new Date(), confermataDa: params.actorId, confermataIp: params.ip })
    .where(and(eq(praticheDichiarazioneTable.id, pratica.id), eq(praticheDichiarazioneTable.stato, "approvata")))
    .returning();
  if (!confermata) throw new ErroreFiscale("stato_pratica", "La pratica è cambiata nel frattempo.");
  await evento({ incarico: i, tipo: "conferma", attore: "cliente", attoreId: params.actorId, ip: params.ip, dettagli: { bozza: pratica.bozzaImpronta, chiusura: pratica.chiusuraImpronta } });
  const prof = i.professionistaId ? await professionistaPerId(i.professionistaId) : undefined;
  if (prof) {
    await avvisa({ userId: prof.userId, tipo: "pratica_confermata", titolo: "Il cliente ha confermato la bozza", corpo: "Puoi trasmettere la dichiarazione e registrare il protocollo.", link: `/studio/incarichi/${i.id}`, entityId: i.id });
  }
  return confermata;
}

export type FileCaricato = { url: string; nome: string; buffer: Buffer };

/** Le azioni del professionista sulla pratica, ciascuna con ciò che le serve. */
export async function azioneProfessionista(
  ctx: ContestoProfessionista,
  incaricoId: string,
  azione: Exclude<AzionePratica, "consegna" | "conferma">,
  dati: { osservazioni?: string; protocollo?: string; file?: FileCaricato },
) {
  const i = await incaricoPerProfessionista(ctx, incaricoId, { serveAccesso: true });
  const pratica = await praticaDi(i.id);
  if (!pratica) throw new ErroreFiscale("not_found", "Il cliente non ha ancora consegnato la pratica.");
  const t = transizionePratica(pratica.stato, azione, "professionista");
  if (!t.ok) throw new ErroreFiscale("stato_pratica", t.motivo);

  const aggiorna: Partial<typeof praticheDichiarazioneTable.$inferInsert> = { stato: t.a };
  const dettagli: Record<string, unknown> = {};
  switch (azione) {
    case "prendi_in_carico":
      break;
    case "richiedi_modifiche": {
      const testo = dati.osservazioni?.trim() ?? "";
      if (testo.length < 5) throw new ErroreFiscale("osservazioni", "Scrivi che cosa va corretto: il cliente lo legge.");
      Object.assign(aggiorna, { osservazioni: testo, confermataAt: null, confermataDa: null, confermataIp: null });
      dettagli.osservazioni = testo;
      break;
    }
    case "approva": {
      const diff = await differenzaChiusura(pratica);
      if (diff) throw new ErroreFiscale("numeri_cambiati", `${diff} Chiedi al cliente di riconsegnare la pratica.`);
      if (!dati.file) throw new ErroreFiscale("bozza", "Allega la bozza della dichiarazione: il cliente conferma quel documento.");
      const impronta = sha256(dati.file.buffer);
      Object.assign(aggiorna, { bozzaUrl: dati.file.url, bozzaNome: dati.file.nome, bozzaImpronta: impronta, approvataAt: new Date(), osservazioni: dati.osservazioni?.trim() ?? "" });
      dettagli.bozza = impronta;
      break;
    }
    case "segna_inviata": {
      // Il controllo più importante del giro: si invia solo ciò che il cliente ha confermato, e solo se è ancora vero.
      if (!pratica.confermataAt) throw new ErroreFiscale("non_confermata", "Il cliente non ha confermato la bozza.");
      const diff = await differenzaChiusura(pratica);
      if (diff) throw new ErroreFiscale("numeri_cambiati", `${diff} La conferma del cliente non vale più: non trasmettere.`);
      const protocollo = dati.protocollo?.trim() ?? "";
      if (!validaProtocolloTelematico(protocollo)) throw new ErroreFiscale("protocollo", "Ricopia il protocollo telematico dalla ricevuta di Entratel.");
      Object.assign(aggiorna, { protocollo, inviataAt: new Date() });
      dettagli.protocollo = protocollo;
      break;
    }
    case "esito_accolta":
    case "esito_scartata": {
      if (!dati.file) throw new ErroreFiscale("ricevuta", "Allega la ricevuta dell'Agenzia delle Entrate.");
      Object.assign(aggiorna, { ricevutaUrl: dati.file.url, ricevutaNome: dati.file.nome, esito: azione === "esito_accolta" ? "accolta" : "scartata", esitoAt: new Date() });
      if (azione === "esito_scartata") Object.assign(aggiorna, { confermataAt: null, confermataDa: null, confermataIp: null, osservazioni: dati.osservazioni?.trim() ?? "Dichiarazione scartata: il professionista la sta correggendo." });
      break;
    }
  }

  const [nuova] = await db
    .update(praticheDichiarazioneTable)
    .set(aggiorna)
    .where(and(eq(praticheDichiarazioneTable.id, pratica.id), eq(praticheDichiarazioneTable.stato, pratica.stato)))
    .returning();
  if (!nuova) throw new ErroreFiscale("stato_pratica", "La pratica è cambiata nel frattempo: ricarica la pagina.");
  await evento({ incarico: i, tipo: azione, attore: "professionista", attoreId: ctx.actorUserId, ip: ctx.ip, dettagli });

  if (azione === "esito_accolta") {
    // Il compenso matura con la ricevuta di accoglimento (convenzione §3), e l'incarico si chiude.
    await db
      .insert(compensiProfessionistiTable)
      .values({ professionistaId: ctx.professionista.id, incaricoId: i.id, userId: i.userId, anno: i.anno, importoCents: ctx.professionista.compensoPraticaCents ?? 0 })
      .onConflictDoNothing();
    await db.update(incarichiTable).set({ stato: "concluso", chiusoAt: new Date(), motivoChiusura: "Dichiarazione trasmessa e accolta" }).where(eq(incarichiTable.id, i.id));
    await evento({ incarico: i, tipo: "concluso", attore: "sistema" });
  }

  const avviso = AVVISI_CLIENTE[azione];
  if (avviso) await avvisa({ userId: i.userId, tipo: `pratica_${azione}`, titolo: avviso.titolo, corpo: avviso.corpo, link: "/dashboard/fisco/commercialista", entityId: i.id });
  return nuova;
}

const AVVISI_CLIENTE: Partial<Record<AzionePratica, { titolo: string; corpo: string }>> = {
  richiedi_modifiche: { titolo: "Il commercialista chiede delle correzioni", corpo: "Leggi le osservazioni, correggi i dati e richiudi l'anno, poi riconsegna la pratica." },
  approva: { titolo: "La bozza della dichiarazione è pronta", corpo: "Leggila e confermala: il commercialista la trasmette solo dopo la tua conferma." },
  segna_inviata: { titolo: "Dichiarazione trasmessa", corpo: "Il commercialista ha trasmesso la dichiarazione all'Agenzia delle Entrate." },
  esito_accolta: { titolo: "Dichiarazione accolta", corpo: "La ricevuta dell'Agenzia delle Entrate è disponibile." },
  esito_scartata: { titolo: "Dichiarazione scartata dall'Agenzia", corpo: "Il commercialista la sta correggendo: riceverai una nuova bozza da confermare." },
};

/** Il file della bozza o della ricevuta, per chi ha diritto di vederlo. */
export async function filePratica(incarico: Incarico, tipo: "bozza" | "ricevuta"): Promise<{ url: string; nome: string } | null> {
  const p = await praticaDi(incarico.id);
  if (!p) return null;
  if (tipo === "bozza" && p.bozzaUrl) return { url: p.bozzaUrl, nome: p.bozzaNome ?? "bozza.pdf" };
  if (tipo === "ricevuta" && p.ricevutaUrl) return { url: p.ricevutaUrl, nome: p.ricevutaNome ?? "ricevuta.pdf" };
  return null;
}

// ── Consulenza ───────────────────────────────────────────────────────────────

export const MAX_MESSAGGIO = 4000;

export async function messaggi(incaricoId: string, lettore: "cliente" | "professionista" | null) {
  // Leggere segna letti i messaggi dell'altra parte (chi guarda soltanto, come un amministratore, no).
  if (lettore) await db
    .update(consulenzeMessaggiTable)
    .set({ lettoAt: new Date() })
    .where(and(eq(consulenzeMessaggiTable.incaricoId, incaricoId), eq(consulenzeMessaggiTable.autore, lettore === "cliente" ? "professionista" : "cliente"), isNull(consulenzeMessaggiTable.lettoAt)));
  const righe = await db.select().from(consulenzeMessaggiTable).where(eq(consulenzeMessaggiTable.incaricoId, incaricoId)).orderBy(asc(consulenzeMessaggiTable.createdAt));
  return righe.map((m) => ({ id: m.id, autore: m.autore, testo: m.testo, lettoAt: m.lettoAt?.toISOString() ?? null, createdAt: m.createdAt.toISOString() }));
}

export async function scriviMessaggio(params: { incarico: Incarico; autore: "cliente" | "professionista"; autoreUserId: string; testo: string; destinatarioUserId: string }) {
  const testo = params.testo.trim();
  if (!testo) throw new ErroreFiscale("vuoto", "Il messaggio è vuoto.");
  if (testo.length > MAX_MESSAGGIO) throw new ErroreFiscale("troppo_lungo", `Al massimo ${MAX_MESSAGGIO} caratteri.`);
  if (params.incarico.stato !== "attivo") throw new ErroreFiscale("senza_accesso", "La chat è disponibile con l'incarico attivo.");
  const [m] = await db
    .insert(consulenzeMessaggiTable)
    .values({ incaricoId: params.incarico.id, userId: params.incarico.userId, autore: params.autore, autoreUserId: params.autoreUserId, testo })
    .returning();
  await avvisa({
    userId: params.destinatarioUserId,
    tipo: "consulenza_messaggio",
    titolo: params.autore === "cliente" ? "Nuovo messaggio da un cliente" : "Nuovo messaggio dal tuo commercialista",
    corpo: "Hai un nuovo messaggio nella chat di consulenza.",
    link: params.autore === "cliente" ? `/studio/incarichi/${params.incarico.id}` : "/dashboard/fisco/commercialista",
    entityId: params.incarico.id,
  });
  return { id: m!.id, autore: m!.autore, testo: m!.testo, lettoAt: null, createdAt: m!.createdAt.toISOString() };
}

export async function professionistaDiIncarico(i: Incarico): Promise<Professionista | undefined> {
  return i.professionistaId ? professionistaPerId(i.professionistaId) : undefined;
}

// ── Eventi e compensi ────────────────────────────────────────────────────────

const ETICHETTE_EVENTO: Record<string, string> = {
  richiesto: "Servizio richiesto",
  assegnato: "Professionista assegnato",
  riassegnazione: "Richiesta rimessa in coda",
  firmato: "Lettera d'incarico firmata",
  accettato: "Incarico accettato dal professionista",
  rifiutato: "Incarico rifiutato dal professionista",
  rinunciato: "Il professionista ha rinunciato",
  revocato: "Incarico revocato",
  accesso: "Il professionista ha aperto i tuoi dati",
  consegna: "Pratica consegnata",
  prendi_in_carico: "Revisione iniziata",
  richiedi_modifiche: "Correzioni richieste",
  approva: "Bozza della dichiarazione approvata",
  conferma: "Bozza confermata",
  segna_inviata: "Dichiarazione trasmessa",
  esito_accolta: "Ricevuta di accoglimento",
  esito_scartata: "Ricevuta di scarto",
  concluso: "Incarico concluso",
};

export async function eventiIncarico(incaricoId: string) {
  const righe = await db.select().from(incarichiEventiTable).where(eq(incarichiEventiTable.incaricoId, incaricoId)).orderBy(desc(incarichiEventiTable.at)).limit(300);
  return righe.map((e) => ({ id: e.id, tipo: e.tipo, etichetta: ETICHETTE_EVENTO[e.tipo] ?? e.tipo, attore: e.attore, dettagli: e.dettagli, at: e.at.toISOString() }));
}

export async function compensi(filtro?: { professionistaId?: string }) {
  const righe = await db
    .select({ c: compensiProfessionistiTable, nome: professionistiTable.nome, cognome: professionistiTable.cognome })
    .from(compensiProfessionistiTable)
    .innerJoin(professionistiTable, eq(professionistiTable.id, compensiProfessionistiTable.professionistaId))
    .where(filtro?.professionistaId ? eq(compensiProfessionistiTable.professionistaId, filtro.professionistaId) : sql`true`)
    .orderBy(desc(compensiProfessionistiTable.maturatoAt));
  return righe.map((r) => ({
    id: r.c.id,
    professionista: `${r.nome} ${r.cognome}`,
    anno: r.c.anno,
    importoCents: r.c.importoCents,
    stato: r.c.stato,
    maturatoAt: r.c.maturatoAt.toISOString(),
    fatturaNumero: r.c.fatturaNumero,
    fatturatoAt: r.c.fatturatoAt?.toISOString() ?? null,
    pagatoAt: r.c.pagatoAt?.toISOString() ?? null,
  }));
}

export async function aggiornaCompenso(id: string, azione: "fatturato" | "pagato", fatturaNumero?: string) {
  const [c] = await db.select().from(compensiProfessionistiTable).where(eq(compensiProfessionistiTable.id, id));
  if (!c) throw new ErroreFiscale("not_found", "Compenso non trovato.");
  if (azione === "fatturato") {
    if (!fatturaNumero?.trim()) throw new ErroreFiscale("fattura", "Indica il numero della fattura del professionista.");
    if (c.stato !== "maturato") throw new ErroreFiscale("stato", "Il compenso è già fatturato.");
    await db.update(compensiProfessionistiTable).set({ stato: "fatturato", fatturaNumero: fatturaNumero.trim(), fatturatoAt: new Date() }).where(eq(compensiProfessionistiTable.id, id));
  } else {
    if (c.stato !== "fatturato") throw new ErroreFiscale("stato", "Si paga un compenso dopo averne ricevuto la fattura.");
    await db.update(compensiProfessionistiTable).set({ stato: "pagato", pagatoAt: new Date() }).where(eq(compensiProfessionistiTable.id, id));
  }
}

export function serializzaIncarico(i: Incarico) {
  return {
    id: i.id,
    anno: i.anno,
    stato: i.stato,
    etichetta: ETICHETTE_INCARICO[i.stato],
    richiestoAt: i.richiestoAt.toISOString(),
    assegnatoAt: i.assegnatoAt?.toISOString() ?? null,
    documenti: i.documenti,
    impronta: i.impronta,
    firmatoAt: i.firmatoAt?.toISOString() ?? null,
    accettatoAt: i.accettatoAt?.toISOString() ?? null,
    adeguataVerificaAt: i.adeguataVerificaAt?.toISOString() ?? null,
    chiusoAt: i.chiusoAt?.toISOString() ?? null,
    motivoChiusura: i.motivoChiusura,
  };
}

export type { StatoPratica };
