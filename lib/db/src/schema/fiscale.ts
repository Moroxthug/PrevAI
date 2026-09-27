import { pgTable, text, uuid, timestamp, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { GESTIONI_PREVIDENZIALI, RIDUZIONI_CONTRIBUTIVE, LIVELLI_SOGLIA, type GestionePrevidenziale, type RiduzioneContributiva, type LivelloSoglia } from "@workspace/config";

// ── A-2: profilo fiscale e versamenti ────────────────────────────────────────
// Il motore di calcolo (`@workspace/config/fiscale`) è puro: queste tabelle
// tengono le due cose che il motore non può indovinare — ciò che l'impresa
// dichiara di sé (regime, ATECO, gestione previdenziale) e ciò che ha
// effettivamente versato durante l'anno.
//
// Gli incassi **non** stanno qui: si leggono da `invoice_payments`, dove sono
// già. Duplicarli vorrebbe dire tenerne due versioni e sbagliare la seconda.

export const REGIMI_CONTABILI = ["forfettario", "altro"] as const;
export type RegimeContabile = (typeof REGIMI_CONTABILI)[number];

/** Passi dell'onboarding fiscale (dashboard → Fisco → configura). */
export const FISCO_ONBOARDING_STEPS = ["regime", "ateco", "previdenza", "storico", "avviso"] as const;
export type FiscoOnboardingStep = (typeof FISCO_ONBOARDING_STEPS)[number];

export type FiscoOnboardingState = Partial<Record<FiscoOnboardingStep, { doneAt: string }>>;

/**
 * Una riga per impresa. Nulla di tutto questo si deduce dai dati esistenti:
 * il coefficiente dipende dal codice ATECO dichiarato, l'aliquota dipende da
 * requisiti che solo il titolare conosce, e la gestione previdenziale non è
 * scritta da nessuna parte nel prodotto.
 */
export const taxProfilesTable = pgTable("tax_profiles", {
  userId: text("user_id").primaryKey(),
  regime: text("regime", { enum: REGIMI_CONTABILI }).notNull().default("forfettario"),
  /** Codice ATECO dichiarato, es. `43.22.01`. */
  codiceAteco: text("codice_ateco").notNull().default(""),
  /**
   * Coefficiente di redditività in percentuale. 0 = "usa quello del gruppo
   * ATECO": si sovrascrive solo se il commercialista dell'impresa indica un
   * valore diverso, e allora il motore usa il suo.
   */
  coefficientePercent: integer("coefficiente_percent").notNull().default(0),
  gestione: text("gestione", { enum: GESTIONI_PREVIDENZIALI }).$type<GestionePrevidenziale>().notNull().default("artigiani"),
  riduzione: text("riduzione", { enum: RIDUZIONI_CONTRIBUTIVE }).$type<RiduzioneContributiva>().notNull().default("nessuna"),
  /** Anno di apertura della partita IVA: decide se il 5 % è ancora applicabile. */
  annoInizioAttivita: integer("anno_inizio_attivita"),
  /** Il titolare dichiara di avere i tre requisiti per l'aliquota start-up. */
  requisitiStartup: boolean("requisiti_startup").notNull().default(false),
  /** Dati dell'anno precedente: servono ai controlli di permanenza F1/F3/F4. */
  ricaviAnnoPrecedenteCents: integer("ricavi_anno_precedente_cents").notNull().default(0),
  speseLavoroCents: integer("spese_lavoro_cents").notNull().default(0),
  redditoDipendenteCents: integer("reddito_dipendente_cents").notNull().default(0),
  /** Imposta sostitutiva dell'anno precedente: base degli acconti col metodo storico. */
  impostaAnnoPrecedenteCents: integer("imposta_anno_precedente_cents").notNull().default(0),
  /** Quanto mettere via in più rispetto al dovuto, in percentuale. */
  margineSicurezzaPercent: integer("margine_sicurezza_percent").notNull().default(10),
  onboarding: jsonb("onboarding").$type<FiscoOnboardingState>().notNull().default({}),
  completatoAt: timestamp("completato_at", { withTimezone: true }),
  /**
   * Presa d'atto che il modulo è uno strumento di calcolo e non una
   * consulenza (AMMINISTRAZIONE-PLAN.md §5). Si chiede una volta e si
   * ri-chiede quando cambia il testo: `avvisoVersione`.
   */
  avvisoAccettatoAt: timestamp("avviso_accettato_at", { withTimezone: true }),
  avvisoVersione: text("avviso_versione").notNull().default(""),
  /** Monitor soglia: ultimo livello già comunicato, per non ripetere la stessa notifica ogni notte. */
  sogliaLivelloNotificato: text("soglia_livello_notificato", { enum: LIVELLI_SOGLIA }).$type<LivelloSoglia>(),
  sogliaNotificataAt: timestamp("soglia_notificata_at", { withTimezone: true }),

  // ── A-3: modello F24 e promemoria ──────────────────────────────────────────
  /**
   * Matricola INPS e codice della sede competente. Stanno sull'estratto conto
   * contributivo e **non si deducono** da nient'altro: senza, la sezione INPS
   * del modello resta con due caselle vuote, e il prospetto lo dichiara invece
   * di inventarle.
   */
  matricolaInps: text("matricola_inps").notNull().default(""),
  sedeInps: text("sede_inps").notNull().default(""),
  /** Canali del promemoria. L'in-app c'è sempre: queste due sono in più. */
  promemoriaEmail: boolean("promemoria_email").notNull().default(true),
  promemoriaWhatsapp: boolean("promemoria_whatsapp").notNull().default(false),
  /** Numero a cui mandare il promemoria WhatsApp, in formato internazionale. */
  promemoriaTelefono: text("promemoria_telefono").notNull().default(""),
  /**
   * Quanti giorni prima avvisare. Più di uno perché una scadenza fiscale si
   * prepara (il denaro va trovato) e poi si esegue: il default avvisa a 15
   * giorni per organizzarsi e a 3 per farlo.
   */
  promemoriaGiorni: jsonb("promemoria_giorni").$type<number[]>().notNull().default([15, 3]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * Versamenti già fatti. Il forfettario deduce i contributi **per cassa**
 * (F6): senza queste righe l'imposta risulterebbe più alta del vero, che è
 * l'errore meno pericoloso dei due ma pur sempre un errore.
 *
 * Il bollo trimestrale ha già la sua tabella in A-1 (`bollo_periods`): qui
 * finisce solo se l'utente lo registra come versamento, per lo scadenzario.
 */
export const TIPI_VERSAMENTO = ["contributi_inps", "imposta_saldo", "imposta_acconto", "bollo", "altro"] as const;
export type TipoVersamento = (typeof TIPI_VERSAMENTO)[number];

export const ORIGINI_VERSAMENTO = ["manuale", "bollo", "importato"] as const;
export type OrigineVersamento = (typeof ORIGINI_VERSAMENTO)[number];

export const fiscalPaymentsTable = pgTable(
  "fiscal_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** Anno d'imposta a cui il versamento si riferisce, che può non essere quello della data. */
    anno: integer("anno").notNull(),
    tipo: text("tipo", { enum: TIPI_VERSAMENTO }).notNull(),
    data: timestamp("data", { withTimezone: true }).notNull().defaultNow(),
    importoCents: integer("importo_cents").notNull().default(0),
    codiceTributo: text("codice_tributo").notNull().default(""),
    riferimento: text("riferimento").notNull().default(""),
    note: text("note").notNull().default(""),
    origine: text("origine", { enum: ORIGINI_VERSAMENTO }).notNull().default("manuale"),
    /**
     * A-3: chiave della scadenza pagata, quando il versamento nasce dallo
     * scadenzario. Resta vuota per i versamenti inseriti a mano fuori
     * calendario, che esistono eccome (un ravvedimento, un F24 di anni prima).
     *
     * Un F24 solo può generare **più** righe qui: la delega del 30 giugno
     * contiene imposta e contributi, che il motore deve poter contare
     * separatamente (i contributi sono deducibili per cassa, l'acconto no).
     */
    scadenzaChiave: text("scadenza_chiave").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("fiscal_payments_user_anno_idx").on(t.userId, t.anno, t.data),
    index("fiscal_payments_tipo_idx").on(t.userId, t.tipo),
  ],
);

// ── A-3: stato dello scadenzario ─────────────────────────────────────────────
// Le scadenze **non** si conservano: si ricalcolano ogni volta dal motore e dal
// bollo trimestrale, perché un incasso di ieri cambia il saldo di giugno e una
// riga salvata sarebbe già vecchia. Qui sta solo quello che il calcolo non può
// sapere: se è stata versata, con quale versamento, e quali promemoria sono
// già partiti.
//
// I campi `etichetta`, `data` e `importo_cents` sono una **fotografia** del
// momento in cui la riga è stata toccata l'ultima volta: servono allo storico
// ("a giugno avevo un F24 da 1.240 €") e a mostrare qualcosa di sensato se in
// futuro il motore smette di generare quella scadenza. Non sono la verità:
// la verità è il ricalcolo.

export const STATI_SCADENZA = ["aperta", "versata", "non_dovuta"] as const;
export type StatoScadenza = (typeof STATI_SCADENZA)[number];

/** Promemoria già inviati: `{ "15": "2026-06-15", "3": "2026-06-27", "scaduta": "2026-07-01" }`. */
export type PromemoriaInviati = Record<string, string>;

export const fiscalDeadlinesTable = pgTable(
  "fiscal_deadlines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** Anno d'imposta di competenza, che spesso non è l'anno della data. */
    anno: integer("anno").notNull(),
    /** Chiave stabile della scadenza: `saldo_primo_acconto`, `inps_fissi_1`, `bollo_t3`, … */
    chiave: text("chiave").notNull(),
    etichetta: text("etichetta").notNull().default(""),
    data: timestamp("data", { withTimezone: true }).notNull(),
    importoCents: integer("importo_cents").notNull().default(0),
    categoria: text("categoria").notNull().default("imposta"),
    stato: text("stato", { enum: STATI_SCADENZA }).notNull().default("aperta"),
    versataAt: timestamp("versata_at", { withTimezone: true }),
    /**
     * Quietanza: la ricevuta del versamento, caricata dall'impresa (il PDF
     * dell'home banking o dei servizi telematici). Sta sulla scadenza e non
     * sul versamento perché **un F24 è uno solo** anche quando genera tre
     * righe contabili. È la prova che il denaro è uscito, e serve anni dopo
     * se l'Agenzia contesta il pagamento.
     */
    quietanzaUrl: text("quietanza_url").notNull().default(""),
    quietanzaNome: text("quietanza_nome").notNull().default(""),
    quietanzaCaricataAt: timestamp("quietanza_caricata_at", { withTimezone: true }),
    promemoriaInviati: jsonb("promemoria_inviati").$type<PromemoriaInviati>().notNull().default({}),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("fiscal_deadlines_chiave_idx").on(t.userId, t.anno, t.chiave),
    index("fiscal_deadlines_data_idx").on(t.userId, t.data),
    index("fiscal_deadlines_stato_idx").on(t.stato, t.data),
  ],
);

export type ScadenzaSalvata = typeof fiscalDeadlinesTable.$inferSelect;

// `TaxProfile` in questo repo è già il profilo IVA (`@workspace/config/iva`):
// questa è la riga del profilo **fiscale** dell'impresa, e porta il nome
// italiano del dominio per non confondersi con quella.
export type ProfiloFiscale = typeof taxProfilesTable.$inferSelect;
export type FiscalPayment = typeof fiscalPaymentsTable.$inferSelect;
