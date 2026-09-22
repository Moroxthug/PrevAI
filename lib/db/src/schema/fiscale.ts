import { pgTable, text, uuid, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("fiscal_payments_user_anno_idx").on(t.userId, t.anno, t.data),
    index("fiscal_payments_tipo_idx").on(t.userId, t.tipo),
  ],
);

// `TaxProfile` in questo repo è già il profilo IVA (`@workspace/config/iva`):
// questa è la riga del profilo **fiscale** dell'impresa, e porta il nome
// italiano del dominio per non confondersi con quella.
export type ProfiloFiscale = typeof taxProfilesTable.$inferSelect;
export type FiscalPayment = typeof fiscalPaymentsTable.$inferSelect;
