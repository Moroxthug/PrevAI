import { pgTable, text, uuid, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── SQUADRA-1 (riga 52, da QuoteAI fase 86): quello che arriva dal cantiere ──
// Quello che un operaio manda da /t/:token senza account: una foto con una
// nota, "sono bloccato" (l'ufficio deve rispondere), o i materiali usati. La
// foto finisce nella galleria del cantiere (job_photos) e i materiali nei
// costi da controllare (cost_entries, pending_review): questa riga lega le
// due cose a chi le ha mandate e, per un blocco, dice se qualcuno ha risposto.

export const FIELD_REPORT_KINDS = ["note", "blocker", "materials"] as const;
export type FieldReportKind = (typeof FIELD_REPORT_KINDS)[number];

export const fieldReportsTable = pgTable(
  "field_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** Plain uuids (no drizzle FKs, to stay out of the crm.ts/jobs.ts cycle); the SQL migration adds them. */
    projectId: uuid("project_id").notNull(),
    milestoneId: uuid("milestone_id"),
    workerId: uuid("worker_id"),
    /** The worker's name when they sent it — survives the worker being deleted. */
    authorName: text("author_name").notNull().default(""),
    kind: text("kind", { enum: FIELD_REPORT_KINDS }).notNull().default("note"),
    body: text("body").notNull().default(""),
    photoId: uuid("photo_id"),
    /** Materials reports: what they said it cost, and the pending cost entry made from it. */
    materialsCents: integer("materials_cents"),
    costEntryId: uuid("cost_entry_id"),
    /** Blockers stay open until someone in the office answers them. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByName: text("resolved_by_name"),
    resolutionNote: text("resolution_note"),
    /** Id the phone gives each send — a second delivery (double tap, retry) returns the row it already created. */
    clientRef: text("client_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("field_reports_project_idx").on(t.projectId, t.createdAt),
    index("field_reports_user_open_idx").on(t.userId, t.kind, t.resolvedAt),
    uniqueIndex("field_reports_client_ref_idx").on(t.workerId, t.clientRef).where(sql`client_ref is not null`),
  ],
);

export type FieldReport = typeof fieldReportsTable.$inferSelect;
