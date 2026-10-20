import { pgTable, text, uuid, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

// ── POCKET-5 (riga 62, QuoteAI 128.1): l'assistente d'impresa dell'app ───────
// Proposte, Attività e Permessi: cosa l'assistente propone per tutta l'impresa (un
// promemoria per una fattura scaduta, un sollecito per un preventivo senza risposta,
// un ordine per i materiali sotto scorta), cosa ha fatto, e quanto può fare da solo.
// Non sono le proposte dell'assistente dei cantieri (./assistant.ts, assistant_proposals
// e assistant_actions) né i suoi permessi per azione e ruolo (assistant_permissions):
// questi sono cinque ambiti dell'impresa, come li disegna l'app.
// Tabelle create da migrations/v2/0026_pocket5_assistente_impostazioni.sql.

export const COMPANY_SUGGESTION_KINDS = ["reminder", "order", "move", "followup"] as const;
export type CompanySuggestionKind = (typeof COMPANY_SUGGESTION_KINDS)[number];
export const COMPANY_SUGGESTION_STATUSES = ["pending", "approved", "dismissed", "failed"] as const;
export type CompanySuggestionStatus = (typeof COMPANY_SUGGESTION_STATUSES)[number];

/** I fatti che la scheda mostra (la bozza di un messaggio, le righe di un ordine, i due giorni di uno spostamento) e da cui si scrive il «Perché». */
export type SuggestionPayload = {
  /** reminder, followup: PrevAI manda solo email (niente SMS). */
  channel?: "email";
  to?: string;
  toName?: string;
  subject?: string;
  draft?: string;
  language?: "it";
  invoiceId?: string;
  number?: string;
  balanceCents?: number;
  daysLate?: number;
  quoteId?: string;
  totalCents?: number;
  daysSent?: number;
  /** order */
  supplierId?: string;
  supplierName?: string;
  lines?: { itemId: string | null; name: string; unit: string; qty: number; unitPriceCents: number | null }[];
  destination?: string;
  overLimit?: boolean;
  /** move */
  blockId?: string;
  blockTitle?: string;
  jobName?: string;
  from?: string;
  moveTo?: string;
};

export const assistantSuggestionsTable = pgTable(
  "assistant_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** L'impresa (business_profiles.user_id). */
    userId: text("user_id").notNull(),
    /** Di cosa parla, così si propone una volta sola: "reminder:<fattura>:<n>", "followup:<preventivo>", "order:<fornitore>:<hash>". */
    key: text("key").notNull(),
    kind: text("kind", { enum: COMPANY_SUGGESTION_KINDS }).notNull(),
    /** Fatti, non frasi: le frasi le scrive il telefono. */
    payload: jsonb("payload").$type<SuggestionPayload>().notNull().default({}),
    status: text("status", { enum: COMPANY_SUGGESTION_STATUSES }).notNull().default("pending"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("assistant_suggestions_key_idx").on(t.userId, t.key), index("assistant_suggestions_status_idx").on(t.userId, t.status)],
);

export const ASSISTANT_ACTIVITY_UNDO = ["none", "undo", "void", "open"] as const;
export type AssistantActivityUndo = (typeof ASSISTANT_ACTIVITY_UNDO)[number];
export type ActivityUndoData = { entity?: "cost" | "payment" | "block" | "order"; id?: string; was?: string; invoiceId?: string };

export const assistantActivityTable = pgTable(
  "assistant_activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** Il glifo e il tono della riga seguono il tipo. */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    /** I fatti da cui il telefono scrive la riga (cliente, numero, fornitore…); title e detail sono il testo di riserva. */
    params: jsonb("params").$type<Record<string, string | number>>().notNull().default({}),
    /** Chi l'ha chiesto (il nome) o, per un'azione automatica, la regola ("reminders", "followups"). */
    who: text("who").notNull().default(""),
    whoKind: text("who_kind", { enum: ["you", "auto"] }).notNull().default("auto"),
    category: text("category", { enum: ["msg", "money", "jobs"] }).notNull().default("jobs"),
    undo: text("undo", { enum: ASSISTANT_ACTIVITY_UNDO }).notNull().default("none"),
    undoData: jsonb("undo_data").$type<ActivityUndoData>().notNull().default({}),
    /** Com'è finita: Sent, Undone, Voided. */
    word: text("word").notNull().default(""),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
  },
  (t) => [index("assistant_activity_user_idx").on(t.userId, t.at)],
);

/** 0 chiede prima, 1 lo fa e lo dice, 2 non lo fa. */
export type CompanyAssistantLevel = 0 | 1 | 2;
export type CompanyAssistantLevels = { followups: CompanyAssistantLevel; reminders: CompanyAssistantLevel; receipts: CompanyAssistantLevel; scheduling: CompanyAssistantLevel; crew: CompanyAssistantLevel };
/**
 * I livelli di partenza. PrevAI: solleciti e promemoria restano «lo fa e te lo dice», come le automazioni li hanno
 * sempre mandati (il disegno di QuoteAI fa chiedere prima i solleciti: qui cambierebbe ciò che le imprese ricevono oggi).
 */
export const RECOMMENDED_LEVELS: CompanyAssistantLevels = { followups: 1, reminders: 1, receipts: 1, scheduling: 0, crew: 1 };

export const assistantSettingsTable = pgTable("assistant_settings", {
  /** L'impresa. */
  userId: text("user_id").primaryKey(),
  levels: jsonb("levels").$type<Partial<CompanyAssistantLevels>>().notNull().default({}),
  /** Gli ordini sopra questa cifra chiedono sempre prima. */
  spendLimitCents: integer("spend_limit_cents").notNull().default(30000),
  quietHours: text("quiet_hours", { enum: ["on", "off"] }).notNull().default("on"),
  /** Minuti dalla mezzanotte. */
  quietFrom: integer("quiet_from").notNull().default(20 * 60),
  quietUntil: integer("quiet_until").notNull().default(7 * 60),
  quietSunday: text("quiet_sunday", { enum: ["on", "off"] }).notNull().default("on"),
  readBack: text("read_back", { enum: ["on", "off"] }).notNull().default("on"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AssistantSuggestion = typeof assistantSuggestionsTable.$inferSelect;
export type AssistantActivityRow = typeof assistantActivityTable.$inferSelect;
export type CompanyAssistantSettings = typeof assistantSettingsTable.$inferSelect;
