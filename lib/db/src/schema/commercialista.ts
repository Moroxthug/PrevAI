import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { STATI_INCARICO, STATI_PRATICA, STATI_PROFESSIONISTA } from "@workspace/config";

// ── A-6: il commercialista nel giro (fase 2 del modulo Amministrazione) ──────
// Sei tabelle, tutte nuove:
//
//   1. `professionisti` — chi lavora: iscrizione all'Albo, Entratel, polizza RC,
//      verifica di PrevAI e convenzione firmata. È un utente PrevAI normale
//      (`user_id`), con un profilo in più;
//   2. `incarichi` — la lettera d'incarico fra cliente e professionista, con il
//      testo esatto che il cliente ha firmato e le due informative allegate;
//   3. `pratiche_dichiarazione` — il giro revisione → conferma → invio, legato
//      a una versione precisa della chiusura d'anno (A-4) tramite la sua impronta;
//   4. `consulenze_messaggi` — la chat fra cliente e professionista. Nessuna IA
//      scrive qui dentro, e nessuno di PrevAI;
//   5. `incarichi_eventi` — la storia dell'incarico e **ogni accesso** del
//      professionista ai dati del cliente, che il cliente vede;
//   6. `compensi_professionisti` — ciò che PrevAI deve al professionista per
//      ogni pratica, secondo la convenzione.
//
// `user_id` è sempre l'impresa cliente, tranne in `professionisti`, dove è
// l'utente del professionista.

export const professionistiTable = pgTable(
  "professionisti",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    nome: text("nome").notNull(),
    cognome: text("cognome").notNull(),
    codiceFiscale: text("codice_fiscale").notNull(),
    partitaIva: text("partita_iva").notNull(),
    /** A o B dell'Albo dei Dottori Commercialisti e degli Esperti Contabili. */
    sezioneAlbo: text("sezione_albo", { enum: ["A", "B"] }).notNull(),
    /** L'Ordine territoriale, per esempio "Milano". */
    ordine: text("ordine").notNull(),
    numeroAlbo: text("numero_albo").notNull(),
    pec: text("pec").notNull(),
    studio: text("studio").notNull().default(""),
    indirizzoStudio: text("indirizzo_studio").notNull().default(""),
    provincia: text("provincia"),
    abilitatoEntratel: boolean("abilitato_entratel").notNull().default(false),
    rcCompagnia: text("rc_compagnia").notNull().default(""),
    rcNumeroPolizza: text("rc_numero_polizza").notNull().default(""),
    rcMassimaleCents: integer("rc_massimale_cents").notNull().default(0),
    rcScadenza: timestamp("rc_scadenza", { withTimezone: true }),
    /** Chi di PrevAI ha visto la polizza e quando. Un rinnovo dichiarato la azzera fino alla nuova verifica. */
    rcVerificataAt: timestamp("rc_verificata_at", { withTimezone: true }),
    altriStrumentiIa: text("altri_strumenti_ia").notNull().default(""),
    /** Quanti incarichi al massimo, fra proposti e attivi. */
    capienza: integer("capienza").notNull().default(40),
    stato: text("stato", { enum: STATI_PROFESSIONISTA }).notNull().default("candidato"),
    verificatoAt: timestamp("verificato_at", { withTimezone: true }),
    verificatoDa: text("verificato_da"),
    noteVerifica: text("note_verifica").notNull().default(""),
    sospesoAt: timestamp("sospeso_at", { withTimezone: true }),
    motivoSospensione: text("motivo_sospensione").notNull().default(""),
    /** D11: il compenso per pratica. Finché è vuoto la convenzione non si può firmare. */
    compensoPraticaCents: integer("compenso_pratica_cents"),
    convenzioneVersione: text("convenzione_versione"),
    convenzioneImpronta: text("convenzione_impronta"),
    /** Il testo esatto che il professionista ha accettato. */
    convenzioneTesto: jsonb("convenzione_testo").$type<Record<string, unknown>>(),
    convenzioneFirmataAt: timestamp("convenzione_firmata_at", { withTimezone: true }),
    convenzioneFirmataIp: text("convenzione_firmata_ip"),
    convenzioneCessataAt: timestamp("convenzione_cessata_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("professionisti_user_idx").on(t.userId), index("professionisti_stato_idx").on(t.stato)],
);

export type DocumentiIncarico = {
  lettera: Record<string, unknown>;
  informativaIa: Record<string, unknown>;
  informativaPrivacy: Record<string, unknown>;
};

export const incarichiTable = pgTable(
  "incarichi",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    professionistaId: uuid("professionista_id").references(() => professionistiTable.id),
    /** Anno d'imposta della dichiarazione. */
    anno: integer("anno").notNull(),
    stato: text("stato", { enum: STATI_INCARICO }).notNull().default("da_assegnare"),
    richiestoAt: timestamp("richiesto_at", { withTimezone: true }).notNull().defaultNow(),
    richiestoDa: text("richiesto_da"),
    assegnatoAt: timestamp("assegnato_at", { withTimezone: true }),
    /** `automatico` (D9) oppure l'email di chi in PrevAI l'ha assegnato a mano. */
    assegnatoDa: text("assegnato_da"),
    documenti: jsonb("documenti").$type<DocumentiIncarico>(),
    /** sha256 della lettera e delle due informative, come testo: ciò che il cliente firma. */
    impronta: text("impronta"),
    firmatoAt: timestamp("firmato_at", { withTimezone: true }),
    firmatoDa: text("firmato_da"),
    firmatoIp: text("firmato_ip"),
    firmatoUserAgent: text("firmato_user_agent"),
    informativaIaAccettataAt: timestamp("informativa_ia_accettata_at", { withTimezone: true }),
    informativaPrivacyAccettataAt: timestamp("informativa_privacy_accettata_at", { withTimezone: true }),
    /** Il professionista attesta di aver svolto l'adeguata verifica (D.Lgs. 231/2007). */
    adeguataVerificaAt: timestamp("adeguata_verifica_at", { withTimezone: true }),
    accettatoAt: timestamp("accettato_at", { withTimezone: true }),
    chiusoAt: timestamp("chiuso_at", { withTimezone: true }),
    motivoChiusura: text("motivo_chiusura").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("incarichi_user_anno_idx").on(t.userId, t.anno),
    index("incarichi_professionista_idx").on(t.professionistaId, t.stato),
    // Un solo incarico aperto per impresa e anno.
    uniqueIndex("incarichi_aperto_idx")
      .on(t.userId, t.anno)
      .where(sql`stato not in ('rifiutato', 'revocato', 'rinunciato', 'concluso')`),
  ],
);

export const praticheDichiarazioneTable = pgTable(
  "pratiche_dichiarazione",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incaricoId: uuid("incarico_id")
      .notNull()
      .references(() => incarichiTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    anno: integer("anno").notNull(),
    stato: text("stato", { enum: STATI_PRATICA }).notNull().default("da_revisionare"),
    /** La versione della chiusura d'anno consegnata: la pratica vale solo finché l'impronta non cambia. */
    chiusuraVersione: integer("chiusura_versione").notNull(),
    chiusuraImpronta: text("chiusura_impronta").notNull(),
    osservazioni: text("osservazioni").notNull().default(""),
    bozzaUrl: text("bozza_url"),
    bozzaNome: text("bozza_nome"),
    bozzaImpronta: text("bozza_impronta"),
    approvataAt: timestamp("approvata_at", { withTimezone: true }),
    confermataAt: timestamp("confermata_at", { withTimezone: true }),
    confermataDa: text("confermata_da"),
    confermataIp: text("confermata_ip"),
    protocollo: text("protocollo"),
    inviataAt: timestamp("inviata_at", { withTimezone: true }),
    ricevutaUrl: text("ricevuta_url"),
    ricevutaNome: text("ricevuta_nome"),
    esito: text("esito", { enum: ["accolta", "scartata"] }),
    esitoAt: timestamp("esito_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("pratiche_dichiarazione_incarico_idx").on(t.incaricoId), index("pratiche_dichiarazione_user_idx").on(t.userId, t.anno)],
);

export const consulenzeMessaggiTable = pgTable(
  "consulenze_messaggi",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incaricoId: uuid("incarico_id")
      .notNull()
      .references(() => incarichiTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    autore: text("autore", { enum: ["cliente", "professionista"] }).notNull(),
    autoreUserId: text("autore_user_id").notNull(),
    testo: text("testo").notNull(),
    lettoAt: timestamp("letto_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("consulenze_messaggi_incarico_idx").on(t.incaricoId, t.createdAt)],
);

export const ATTORI_EVENTO = ["cliente", "professionista", "prevai", "sistema"] as const;

export const incarichiEventiTable = pgTable(
  "incarichi_eventi",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incaricoId: uuid("incarico_id")
      .notNull()
      .references(() => incarichiTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    /** `richiesto`, `assegnato`, `firmato`, `accesso`, `consegna`, `approva`, … */
    tipo: text("tipo").notNull(),
    attore: text("attore", { enum: ATTORI_EVENTO }).notNull(),
    attoreId: text("attore_id"),
    dettagli: jsonb("dettagli").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("incarichi_eventi_incarico_idx").on(t.incaricoId, t.at), index("incarichi_eventi_user_idx").on(t.userId, t.at)],
);

export const STATI_COMPENSO = ["maturato", "fatturato", "pagato"] as const;

export const compensiProfessionistiTable = pgTable(
  "compensi_professionisti",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    professionistaId: uuid("professionista_id")
      .notNull()
      .references(() => professionistiTable.id),
    incaricoId: uuid("incarico_id")
      .notNull()
      .references(() => incarichiTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    anno: integer("anno").notNull(),
    importoCents: integer("importo_cents").notNull(),
    stato: text("stato", { enum: STATI_COMPENSO }).notNull().default("maturato"),
    maturatoAt: timestamp("maturato_at", { withTimezone: true }).notNull().defaultNow(),
    /** Numero della fattura del professionista a PrevAI. */
    fatturaNumero: text("fattura_numero"),
    fatturatoAt: timestamp("fatturato_at", { withTimezone: true }),
    pagatoAt: timestamp("pagato_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("compensi_professionisti_incarico_idx").on(t.incaricoId), index("compensi_professionisti_prof_idx").on(t.professionistaId, t.stato)],
);

export type Professionista = typeof professionistiTable.$inferSelect;
export type Incarico = typeof incarichiTable.$inferSelect;
export type PraticaDichiarazione = typeof praticheDichiarazioneTable.$inferSelect;
export type ConsulenzaMessaggio = typeof consulenzeMessaggiTable.$inferSelect;
export type IncaricoEvento = typeof incarichiEventiTable.$inferSelect;
export type CompensoProfessionista = typeof compensiProfessionistiTable.$inferSelect;
