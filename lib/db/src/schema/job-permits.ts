import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./crm";

// POCKET-3 (riga 60, da QuoteAI 126): pratiche e sopralluoghi di un cantiere (CILA, SCIA, permesso di costruire, impianti…).
// Solo l'elenco e l'aggiunta: PrevAI non ha il modulo di conformità canadese di QuoteAI (suggerimenti per provincia, blocco alla chiusura).
export const PERMIT_KINDS = ["building", "demolition", "electrical", "plumbing", "gas", "hvac", "other"] as const;
export const PERMIT_STATUSES = ["needed", "applied", "issued", "closed", "not_required"] as const;
export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export const jobPermitsTable = pgTable(
  "job_permits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: PERMIT_KINDS }).notNull().default("other"),
    title: text("title").notNull(),
    authority: text("authority").notNull().default(""),
    referenceNumber: text("reference_number").notNull().default(""),
    url: text("url"),
    status: text("status", { enum: PERMIT_STATUSES }).notNull().default("needed"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    inspectionAt: timestamp("inspection_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("job_permits_project_idx").on(t.projectId), index("job_permits_user_inspection_idx").on(t.userId, t.inspectionAt)],
);

export type JobPermit = typeof jobPermitsTable.$inferSelect;
