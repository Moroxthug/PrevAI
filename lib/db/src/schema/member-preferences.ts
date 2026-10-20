import { pgTable, text, uuid, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

// ── POCKET-5 (riga 62, QuoteAI 128.3 e 128.7): le scelte di una persona nell'app ──
// Per impresa e persona, su ogni dispositivo: la voce dell'assistente, leggere le risposte, chiedere prima di inviare,
// ruolo in impresa, cellulare e firma (Profilo), e la sua Home (Personalizza la Home). In QuoteAI viene dalla fase 149;
// PrevAI non l'aveva. Non è la Home del sito (home_layouts, APP-7): quella resta com'è.
// Tabella creata da migrations/v2/0026_pocket5_assistente_impostazioni.sql.
export type MemberPrefs = {
  /** La voce dell'assistente (Impostazioni → Assistente → Voce). */
  voice?: "ember" | "tide" | "stone";
  /** Legge a voce le risposte dell'assistente. Di partenza sì. */
  speak?: boolean;
  /** L'assistente chiede prima di inviare preventivi, fatture e messaggi ai clienti. Di partenza sì. */
  confirmSend?: boolean;
  /** Profilo: ruolo in impresa e cellulare, e la firma disegnata (tracciati SVG in un riquadro 330 × 92) per preventivi e contratti. */
  jobTitle?: string;
  mobile?: string;
  signature?: string;
  /** Personalizza la Home: l'ordine delle sezioni, quali si vedono, le tre schede e la densità. */
  home?: { order?: string[]; on?: Record<string, boolean>; tabs?: string[]; density?: 0 | 1 };
};

export const memberPreferencesTable = pgTable(
  "member_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** L'impresa. */
    userId: text("user_id").notNull(),
    /** La persona (auth user id). */
    memberUserId: text("member_user_id").notNull(),
    prefs: jsonb("prefs").$type<MemberPrefs>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("member_preferences_member_idx").on(t.userId, t.memberUserId)],
);

export type MemberPreferencesRow = typeof memberPreferencesTable.$inferSelect;
