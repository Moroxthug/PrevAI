import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { invoicesTable } from "./invoices";
import { costEntriesTable } from "./costs";
import { projectsTable, suppliersTable } from "./crm";
import { STATI_SDI, type StatoSdi, type TipoDocumento, type RegimeFiscale } from "@workspace/config";

// ── A-1: fatturazione elettronica via Sistema di Interscambio ────────────────
// PrevAI non è un canale accreditato presso l'Agenzia delle Entrate: passa da
// un intermediario in white-label (Openapi.it di default, adapter unico per
// non restare incastrati — AMMINISTRAZIONE-PLAN.md §11). Di ogni documento
// teniamo comunque **noi** l'XML e le ricevute SdI, così la conservazione è
// esportabile e il cambio di intermediario non perde niente.
//
// Il documento fiscale resta la riga di `invoices`: queste tabelle sono il
// suo "passaporto elettronico" (trasmissione, stati, ricevute, conservazione).

export const SDI_PROVIDERS = ["simulato", "openapi", "acube"] as const;
export type SdiProvider = (typeof SDI_PROVIDERS)[number];

export const SDI_SETUP_STATI = ["non_configurato", "in_configurazione", "attivo", "sospeso"] as const;
export type SdiSetupStato = (typeof SDI_SETUP_STATI)[number];

/** Passi dell'onboarding guidato (dashboard → Amministrazione → Fatture SDI). */
export const SDI_ONBOARDING_STEPS = ["dati_fiscali", "regime", "intermediario", "delega", "codice_destinatario", "ciclo_passivo"] as const;
export type SdiOnboardingStep = (typeof SDI_ONBOARDING_STEPS)[number];

export type SdiOnboardingState = Partial<Record<SdiOnboardingStep, { doneAt: string; note?: string }>>;

/**
 * Configurazione del modulo per impresa. Una riga per `user_id` (org).
 * Le credenziali dell'intermediario sono cifrate a riposo con `enc1:`
 * (`fieldCrypto.ts`, A-0): in chiaro non stanno mai in tabella.
 */
export const sdiSettingsTable = pgTable("sdi_settings", {
  userId: text("user_id").primaryKey(),
  provider: text("provider", { enum: SDI_PROVIDERS }).notNull().default("simulato"),
  stato: text("stato", { enum: SDI_SETUP_STATI }).notNull().default("non_configurato"),
  /** Regime fiscale dichiarato in fattura (1.2.1.8). Default forfettario. */
  regimeFiscale: text("regime_fiscale").$type<RegimeFiscale>().notNull().default("RF19"),
  /** Codice destinatario che l'impresa comunica ad AdE per ricevere le passive (quello dell'intermediario). */
  codiceDestinatarioRicezione: text("codice_destinatario_ricezione"),
  /** PEC dell'impresa, alternativa al codice destinatario. */
  pecRicezione: text("pec_ricezione"),
  /** Credenziali dell'intermediario (cifrate). */
  providerAccountId: text("provider_account_id"),
  providerApiKey: text("provider_api_key"),
  /** Segreto condiviso per verificare i webhook dell'intermediario (cifrato). */
  webhookSecret: text("webhook_secret"),
  /** Ambiente dell'intermediario: la sandbox non produce fatture valide. */
  ambiente: text("ambiente", { enum: ["sandbox", "produzione"] }).notNull().default("sandbox"),
  /**
   * Ciclo passivo: scelta **attiva** e tracciata dell'utente (Provv. Garante
   * fatturazione elettronica 2018-2019). Finché è false non scarichiamo
   * nessuna fattura di acquisto.
   */
  cicloPassivoAttivo: boolean("ciclo_passivo_attivo").notNull().default(false),
  cicloPassivoAttivatoAt: timestamp("ciclo_passivo_attivato_at", { withTimezone: true }),
  /** Delega/adesione firmata presso l'intermediario. */
  delegaFirmataAt: timestamp("delega_firmata_at", { withTimezone: true }),
  delegaRiferimento: text("delega_riferimento"),
  /** Conservazione a norma delegata all'intermediario (10 anni, art. 2220 c.c.). */
  conservazioneAttiva: boolean("conservazione_attiva").notNull().default(true),
  onboarding: jsonb("onboarding").$type<SdiOnboardingState>().notNull().default({}),
  /** Ultimo errore di configurazione mostrato in dashboard. */
  ultimoErrore: text("ultimo_errore"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * Una trasmissione elettronica di una fattura. Non sostituisce la riga di
 * `invoices`: la accompagna. Un rinvio dopo uno scarto crea una **nuova**
 * riga (nuovo progressivo, nuovo nome file) e la precedente resta `scartata`,
 * perché lo SdI ragiona per trasmissione, non per documento.
 */
export const eInvoicesTable = pgTable(
  "e_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
    tipoDocumento: text("tipo_documento").$type<TipoDocumento>().notNull().default("TD01"),
    /** FPR12 privati, FPA12 pubblica amministrazione. */
    formatoTrasmissione: text("formato_trasmissione", { enum: ["FPR12", "FPA12"] }).notNull().default("FPR12"),
    /** Univoco per trasmittente: entra nel nome del file. */
    progressivoInvio: text("progressivo_invio").notNull(),
    fileName: text("file_name").notNull(),
    /** Percorso dell'XML nel nostro storage privato (copia indipendente dall'intermediario). */
    xmlPath: text("xml_path"),
    xmlHash: text("xml_hash"),
    xmlBytes: integer("xml_bytes").notNull().default(0),
    stato: text("stato", { enum: STATI_SDI }).$type<StatoSdi>().notNull().default("bozza"),
    /** Dati del destinatario usati davvero nell'XML (servono a spiegare uno scarto). */
    codiceDestinatario: text("codice_destinatario"),
    pecDestinatario: text("pec_destinatario"),
    /** Identificativo assegnato dallo SdI alla trasmissione. */
    identificativoSdi: text("identificativo_sdi"),
    /** Id del documento presso l'intermediario (per polling e download). */
    providerDocumentId: text("provider_document_id"),
    provider: text("provider", { enum: SDI_PROVIDERS }).notNull().default("simulato"),
    ambiente: text("ambiente", { enum: ["sandbox", "produzione"] }).notNull().default("sandbox"),
    /** Imposta di bollo assolta virtualmente su questo documento (DPR 642/1972). */
    bolloVirtuale: boolean("bollo_virtuale").notNull().default(false),
    bolloCents: integer("bollo_cents").notNull().default(0),
    /** Totale del documento come scritto nell'XML: serve a riconciliare. */
    totaleCents: integer("totale_cents").notNull().default(0),
    /** Scarto: codice e messaggio tradotti in italiano leggibile. */
    erroreCodice: text("errore_codice"),
    erroreMessaggio: text("errore_messaggio"),
    /** Trasmissione che sostituisce questa dopo uno scarto. */
    rinviataInId: uuid("rinviata_in_id"),
    conservazione: text("conservazione", { enum: ["non_richiesta", "in_corso", "conservata", "errore"] }).notNull().default("non_richiesta"),
    conservazioneAt: timestamp("conservazione_at", { withTimezone: true }),
    conservazioneRiferimento: text("conservazione_riferimento"),
    inviataAt: timestamp("inviata_at", { withTimezone: true }),
    consegnataAt: timestamp("consegnata_at", { withTimezone: true }),
    ultimoEventoAt: timestamp("ultimo_evento_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("e_invoices_user_idx").on(t.userId, t.createdAt),
    index("e_invoices_invoice_idx").on(t.invoiceId),
    index("e_invoices_stato_idx").on(t.userId, t.stato),
    uniqueIndex("e_invoices_progressivo_idx").on(t.userId, t.progressivoInvio),
    uniqueIndex("e_invoices_provider_doc_idx").on(t.provider, t.providerDocumentId),
  ],
);

/** Ricevute e notifiche SdI, così come arrivano: niente si butta. */
export const eInvoiceEventsTable = pgTable(
  "e_invoice_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eInvoiceId: uuid("e_invoice_id").notNull().references(() => eInvoicesTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    /** RC · NS · MC · NE · DT · AT · EC, o un evento proprio dell'intermediario. */
    tipo: text("tipo").notNull(),
    statoDopo: text("stato_dopo", { enum: STATI_SDI }).$type<StatoSdi>(),
    messaggio: text("messaggio").notNull().default(""),
    /** Chiave di idempotenza: lo stesso evento può arrivare più volte. */
    providerEventId: text("provider_event_id"),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    ricevutoAt: timestamp("ricevuto_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("e_invoice_events_doc_idx").on(t.eInvoiceId, t.ricevutoAt),
    uniqueIndex("e_invoice_events_provider_idx").on(t.eInvoiceId, t.providerEventId),
  ],
);

/**
 * Ciclo passivo: fatture di acquisto (materiali, subappalti) che lo SdI
 * recapita all'intermediario. Gratuite in ricezione e preziose: alimentano
 * i costi per cantiere già presenti dalla v2.
 */
export const SUPPLIER_E_INVOICE_STATI = ["nuova", "collegata", "ignorata"] as const;
export type SupplierEInvoiceStato = (typeof SUPPLIER_E_INVOICE_STATI)[number];

export const supplierEInvoicesTable = pgTable(
  "supplier_e_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider", { enum: SDI_PROVIDERS }).notNull().default("simulato"),
    providerDocumentId: text("provider_document_id").notNull(),
    fileName: text("file_name").notNull().default(""),
    xmlPath: text("xml_path"),
    xmlHash: text("xml_hash"),
    /** Anagrafica del fornitore come scritta in fattura. */
    fornitoreNome: text("fornitore_nome").notNull().default(""),
    fornitorePartitaIva: text("fornitore_partita_iva"),
    fornitoreCodiceFiscale: text("fornitore_codice_fiscale"),
    supplierId: uuid("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
    numero: text("numero").notNull().default(""),
    data: timestamp("data", { withTimezone: true }),
    tipoDocumento: text("tipo_documento").$type<TipoDocumento>().notNull().default("TD01"),
    imponibileCents: integer("imponibile_cents").notNull().default(0),
    ivaCents: integer("iva_cents").notNull().default(0),
    totaleCents: integer("totale_cents").notNull().default(0),
    valuta: text("valuta").notNull().default("EUR"),
    /** Righe della fattura, per la scheda di revisione e l'import in prima nota. */
    righe: jsonb("righe").$type<{ descrizione: string; quantita: number | null; prezzoUnitarioCents: number | null; totaleCents: number }[]>().notNull().default([]),
    stato: text("stato", { enum: SUPPLIER_E_INVOICE_STATI }).notNull().default("nuova"),
    /** Costo generato quando l'utente la collega a un cantiere. */
    costEntryId: uuid("cost_entry_id").references(() => costEntriesTable.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
    ricevutaAt: timestamp("ricevuta_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("supplier_e_invoices_user_idx").on(t.userId, t.ricevutaAt),
    index("supplier_e_invoices_stato_idx").on(t.userId, t.stato),
    uniqueIndex("supplier_e_invoices_provider_doc_idx").on(t.userId, t.provider, t.providerDocumentId),
  ],
);

/**
 * Bollo virtuale: € 2 su ogni fattura senza IVA oltre € 77,47. Si versa per
 * trimestre con F24 (codici 2521-2524), entro il mese successivo al trimestre
 * — il primo e il secondo trimestre possono slittare se l'importo è piccolo.
 * Una riga per impresa × anno × trimestre, mantenuta dal cron.
 */
export const BOLLO_PERIODO_STATI = ["aperto", "da_versare", "versato", "non_dovuto"] as const;
export type BolloPeriodoStato = (typeof BOLLO_PERIODO_STATI)[number];

export const bolloPeriodsTable = pgTable(
  "bollo_periods",
  {
    userId: text("user_id").notNull(),
    anno: integer("anno").notNull(),
    /** 1-4. */
    trimestre: integer("trimestre").notNull(),
    documenti: integer("documenti").notNull().default(0),
    importoCents: integer("importo_cents").notNull().default(0),
    stato: text("stato", { enum: BOLLO_PERIODO_STATI }).notNull().default("aperto"),
    /** Codice tributo F24 del trimestre (2521…2524). */
    codiceTributo: text("codice_tributo").notNull().default(""),
    scadenza: timestamp("scadenza", { withTimezone: true }),
    versatoAt: timestamp("versato_at", { withTimezone: true }),
    riferimentoVersamento: text("riferimento_versamento").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.anno, t.trimestre] })],
);

export type SdiSettings = typeof sdiSettingsTable.$inferSelect;
export type EInvoice = typeof eInvoicesTable.$inferSelect;
export type EInvoiceEvent = typeof eInvoiceEventsTable.$inferSelect;
export type SupplierEInvoice = typeof supplierEInvoicesTable.$inferSelect;
export type BolloPeriod = typeof bolloPeriodsTable.$inferSelect;
