import { pgTable, text, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";

// ── POCKET-5 (riga 62, QuoteAI 128.7): il mestiere di ogni persona nell'impresa ──
// Ruoli, Personalizza la Home e Home per ruolo dell'app: cosa fa ognuno (un mestiere) sopra il ruolo con cui entra
// (amministratore, ufficio, capo cantiere, contabile, solo lettura), e i quattro accessi delicati (vedere le paghe,
// vedere margini e costi, approvare le ore, inviare le fatture) dove la persona è diversa dal suo mestiere.
// I mestieri (sezioni della Home, schede, accessi di partenza) sono nel codice; qui solo chi ha quale, e le eccezioni.
// Gli accessi spenti li fa valere api-server/src/roles/enforce.ts. Non è la Home per ruolo del sito (home_layouts, APP-7).
// Tabella creata da migrations/v2/0026_pocket5_assistente_impostazioni.sql.
export const JOB_ROLES = ["owner", "officeManager", "estimator", "projectManager", "dispatcher", "bookkeeper", "safety", "foreman", "crew"] as const;
export type JobRole = (typeof JOB_ROLES)[number];
export const SENSITIVE_KEYS = ["payRates", "margins", "approveTime", "sendInvoices"] as const;
export type SensitiveKey = (typeof SENSITIVE_KEYS)[number];
export type SensitiveOverrides = Partial<Record<SensitiveKey, boolean>>;

export const memberJobRolesTable = pgTable(
  "member_job_roles",
  {
    orgId: text("org_id").notNull(),
    memberUserId: text("member_user_id").notNull(),
    jobRole: text("job_role", { enum: JOB_ROLES }).notNull(),
    sensitive: jsonb("sensitive").$type<SensitiveOverrides>().notNull().default({}),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.memberUserId] })],
);

export type MemberJobRole = typeof memberJobRolesTable.$inferSelect;
