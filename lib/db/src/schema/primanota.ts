import { pgTable, text, uuid, timestamp, integer, boolean, jsonb, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";

// ── A-4: prima nota, estratto conto, chiusura d'anno, condivisione ───────────
// La prima nota **non** ricopia nulla: incassi, costi e versamenti stanno già
// in `invoice_payments`, `cost_entries` e `fiscal_payments`, e la prima nota li
// legge da lì. Qui ci sono solo le tre cose che non avevano un posto:
//
//   1. i movimenti che non sono né un incasso di fattura né un costo di
//      cantiere né un versamento fiscale — commissioni bancarie, un prelievo
//      del titolare, un rimborso — (`prima_nota_movimenti`);
//   2. l'estratto conto importato, che è un **ingresso da riconciliare** e non
//      una seconda contabilità: ogni riga della banca finisce abbinata a una
//      riga che esiste già, o ne crea una nelle tabelle di sempre
//      (`bank_imports`, `bank_movements`);
//   3. la chiusura dell'anno e il link in sola lettura per il commercialista.

/**
 * Categorie dei movimenti manuali. `incideSulUtile` separa ciò che è un
 * ricavo o un costo da ciò che è solo denaro che si sposta: un prelievo del
 * titolare esce dal conto ma non è un costo, e contarlo come tale farebbe
 * sembrare l'impresa in perdita.
 */
export const CATEGORIE_MOVIMENTO = [
  "altri_ricavi",
  "spese_generali",
  "commissioni_bancarie",
  "affitto_utenze",
  "veicoli_carburante",
  "assicurazioni",
  "altre_imposte",
  "prelievo_titolare",
  "apporto_titolare",
  "giroconto",
  "altro",
] as const;
export type CategoriaMovimento = (typeof CATEGORIE_MOVIMENTO)[number];

export const TIPI_MOVIMENTO = ["entrata", "uscita"] as const;
export type TipoMovimento = (typeof TIPI_MOVIMENTO)[number];

export const primaNotaMovimentiTable = pgTable(
  "prima_nota_movimenti",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    data: timestamp("data", { withTimezone: true }).notNull(),
    tipo: text("tipo", { enum: TIPI_MOVIMENTO }).notNull(),
    categoria: text("categoria", { enum: CATEGORIE_MOVIMENTO }).notNull().default("altro"),
    /** Sempre positivo: il verso lo dice `tipo`. */
    importoCents: integer("importo_cents").notNull(),
    descrizione: text("descrizione").notNull().default(""),
    controparte: text("controparte").notNull().default(""),
    /** Movimento bancario da cui è nato, se è nato dall'estratto conto. */
    bankMovementId: uuid("bank_movement_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("prima_nota_movimenti_user_data_idx").on(t.userId, t.data)],
);

export const FORMATI_ESTRATTO = ["csv", "ofx"] as const;
export type FormatoEstratto = (typeof FORMATI_ESTRATTO)[number];

export const bankImportsTable = pgTable(
  "bank_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    formato: text("formato", { enum: FORMATI_ESTRATTO }).notNull(),
    nomeFile: text("nome_file").notNull().default(""),
    /** Hash del file: lo stesso estratto caricato due volte si riconosce subito. */
    fileHash: text("file_hash").notNull().default(""),
    /** Etichetta libera del conto ("Conto BPM aziendale"): più conti si distinguono da qui. */
    conto: text("conto").notNull().default(""),
    righeLette: integer("righe_lette").notNull().default(0),
    righeNuove: integer("righe_nuove").notNull().default(0),
    righeDuplicate: integer("righe_duplicate").notNull().default(0),
    righeScartate: integer("righe_scartate").notNull().default(0),
    /** Colonne riconosciute nel CSV, per spiegare all'utente come è stato letto. */
    lettura: jsonb("lettura").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bank_imports_user_idx").on(t.userId, t.createdAt)],
);

/**
 * Stato di una riga dell'estratto conto:
 * - `da_abbinare`: letta, non ancora ricondotta a nulla;
 * - `abbinato`: corrisponde a una riga che esiste già (un incasso, un costo,
 *   un versamento, un movimento manuale) — anche se l'ha creata l'abbinamento;
 * - `ignorato`: l'utente ha deciso che non va in prima nota (un giroconto fra
 *   due conti propri, un addebito poi stornato).
 */
export const STATI_MOVIMENTO_BANCA = ["da_abbinare", "abbinato", "ignorato"] as const;
export type StatoMovimentoBanca = (typeof STATI_MOVIMENTO_BANCA)[number];

/** A che cosa è abbinato: il nome della tabella di sempre, in italiano. */
export const TIPI_ABBINAMENTO = ["incasso", "costo", "versamento", "movimento"] as const;
export type TipoAbbinamento = (typeof TIPI_ABBINAMENTO)[number];

export const bankMovementsTable = pgTable(
  "bank_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    importId: uuid("import_id").notNull().references(() => bankImportsTable.id, { onDelete: "cascade" }),
    data: timestamp("data", { withTimezone: true }).notNull(),
    dataValuta: timestamp("data_valuta", { withTimezone: true }),
    /** Con segno: positivo = accredito (entrata), negativo = addebito (uscita). */
    importoCents: integer("importo_cents").notNull(),
    descrizione: text("descrizione").notNull().default(""),
    controparte: text("controparte").notNull().default(""),
    /** FITID dell'OFX, o il riferimento della banca quando il CSV ce l'ha. */
    riferimento: text("riferimento").notNull().default(""),
    /**
     * Impronta del movimento, unica per impresa: è ciò che rende innocuo
     * ricaricare lo stesso estratto, o due estratti che si sovrappongono.
     */
    impronta: text("impronta").notNull(),
    stato: text("stato", { enum: STATI_MOVIMENTO_BANCA }).notNull().default("da_abbinare"),
    abbinamentoTipo: text("abbinamento_tipo", { enum: TIPI_ABBINAMENTO }),
    abbinamentoId: text("abbinamento_id"),
    abbinatoAt: timestamp("abbinato_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("bank_movements_impronta_idx").on(t.userId, t.impronta),
    index("bank_movements_user_stato_idx").on(t.userId, t.stato, t.data),
    index("bank_movements_abbinamento_idx").on(t.userId, t.abbinamentoTipo, t.abbinamentoId),
  ],
);

// ── Chiusura d'anno ──────────────────────────────────────────────────────────
// Chiudere un anno **non blocca** i dati: fatture, incassi e costi restano
// modificabili, perché un errore scoperto a luglio va corretto a luglio. La
// chiusura è una fotografia firmata con un'impronta: il pacchetto che il
// titolare ha visto e (eventualmente) consegnato al commercialista. Se dopo
// cambia qualcosa, la pagina mostra la differenza fra la fotografia e i
// numeri di oggi invece di cambiare la fotografia di nascosto.

export const STATI_CHIUSURA = ["chiuso", "riaperto"] as const;
export type StatoChiusura = (typeof STATI_CHIUSURA)[number];

export const fiscalYearClosingsTable = pgTable(
  "fiscal_year_closings",
  {
    userId: text("user_id").notNull(),
    anno: integer("anno").notNull(),
    stato: text("stato", { enum: STATI_CHIUSURA }).notNull().default("chiuso"),
    /** Quante volte è stato chiuso: si riapre e si richiude, la versione sale. */
    versione: integer("versione").notNull().default(1),
    chiusoAt: timestamp("chiuso_at", { withTimezone: true }).notNull().defaultNow(),
    riapertoAt: timestamp("riaperto_at", { withTimezone: true }),
    /** Il pacchetto com'era al momento della chiusura (prospetto, utile, totali). */
    fotografia: jsonb("fotografia").$type<Record<string, unknown>>().notNull().default({}),
    /** sha256 della fotografia serializzata: prova che non è stata ritoccata. */
    impronta: text("impronta").notNull().default(""),
    /** Le regole usate erano revisionate da un commercialista? (D6) */
    regoleRevisionate: boolean("regole_revisionate").notNull().default(false),
    /** Dati riportati sul profilo fiscale come "anno precedente" dell'anno dopo. */
    riportatoAt: timestamp("riportato_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.anno] })],
);

// ── Condividi col commercialista ─────────────────────────────────────────────
// Un link in sola lettura, per un anno, con scadenza, revocabile, e con il
// registro di chi l'ha aperto e quando. Il token si vede una volta sola e nel
// database resta il suo hash: chi legge la tabella non può ricostruire il link.
//
// GDPR: l'impresa è titolare e decide lei di comunicare i propri dati a un
// professionista di sua scelta; PrevAI esegue la comunicazione su sua
// istruzione (Termini §9) e ne tiene traccia (docs/compliance/REGISTRO-TRATTAMENTI.md).

export const accountantSharesTable = pgTable(
  "accountant_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    /** Nome dello studio o del professionista, per riconoscere il link nell'elenco. */
    destinatario: text("destinatario").notNull().default(""),
    email: text("email").notNull().default(""),
    anno: integer("anno").notNull(),
    scadeAt: timestamp("scade_at", { withTimezone: true }).notNull(),
    revocatoAt: timestamp("revocato_at", { withTimezone: true }),
    accessi: integer("accessi").notNull().default(0),
    ultimoAccessoAt: timestamp("ultimo_accesso_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("accountant_shares_token_idx").on(t.tokenHash), index("accountant_shares_user_idx").on(t.userId, t.createdAt)],
);

export const accountantShareAccessesTable = pgTable(
  "accountant_share_accesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shareId: uuid("share_id").notNull().references(() => accountantSharesTable.id, { onDelete: "cascade" }),
    /** `pacchetto`, `prima_nota.csv`, `pacchetto.pdf`. */
    risorsa: text("risorsa").notNull().default(""),
    ip: text("ip"),
    userAgent: text("user_agent"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accountant_share_accesses_share_idx").on(t.shareId, t.at)],
);

export type PrimaNotaMovimento = typeof primaNotaMovimentiTable.$inferSelect;
export type BankImport = typeof bankImportsTable.$inferSelect;
export type BankMovement = typeof bankMovementsTable.$inferSelect;
export type ChiusuraAnno = typeof fiscalYearClosingsTable.$inferSelect;
export type AccountantShare = typeof accountantSharesTable.$inferSelect;
