import { pgTable, uuid, text, timestamp, integer, bigint, jsonb, index } from "drizzle-orm/pg-core";

// ── GDPR-1: "Scarica i tuoi dati" (art. 20 GDPR, migrazione 0017) ────────────
// Una riga per richiesta. Lo ZIP è diviso in parti perché il bucket privato
// accetta file fino a 25 MB e una funzione Vercel vive 60 s:
//
//   in_preparazione ──(parte "dati", poi le parti con i file)──▶ pronta ──(7 giorni, cron)──▶ scaduta
//          │
//          └──(3 tentativi falliti)──▶ errore
//
// `pending_files` è null finché la parte "dati" non è fatta; poi è la lista
// dei file ancora da impacchettare, che si svuota parte dopo parte.

export const ACCOUNT_EXPORT_STATES = ["in_preparazione", "pronta", "errore", "scaduta"] as const;
export type AccountExportState = (typeof ACCOUNT_EXPORT_STATES)[number];

/** Una parte dello ZIP già caricata in `account-exports/<userId>/<id>/`. */
export type AccountExportPart = { n: number; kind: "dati" | "file"; path: string; bytes: number; files: number };
/** Un file dello storage da mettere nello ZIP. */
export type AccountExportFile = { bucket: string; path: string; size: number };

export const accountExportsTable = pgTable(
  "account_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** L'impresa esportata (= il titolare, business_profiles.user_id). */
    userId: text("user_id").notNull(),
    requestedByUserId: text("requested_by_user_id").notNull(),
    /** Dove arriva l'avviso "è pronta". */
    email: text("email").notNull(),
    stato: text("stato").$type<AccountExportState>().notNull().default("in_preparazione"),
    parts: jsonb("parts").$type<AccountExportPart[]>().notNull().default([]),
    pendingFiles: jsonb("pending_files").$type<AccountExportFile[] | null>(),
    /** File spariti o illeggibili durante la preparazione: la pagina li elenca. */
    skippedFiles: jsonb("skipped_files").$type<string[]>().notNull().default([]),
    tableCount: integer("table_count"),
    rowCount: integer("row_count"),
    fileCount: integer("file_count"),
    totalBytes: bigint("total_bytes", { mode: "number" }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /** Chi sta preparando una parte (richiesta, pagina aperta o cron) la tiene fino a qui. */
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("account_exports_user_idx").on(t.userId, t.createdAt), index("account_exports_stato_idx").on(t.stato)],
);

export type AccountExport = typeof accountExportsTable.$inferSelect;
