import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";

// ── APP-4a: note del cantiere (docs/APP-PLAN.md, riga 30) ────────────────────
// A short note on a job, typed or dictated on site ("il cliente vuole il
// battiscopa bianco"). `source` says how it arrived; the dictation is turned
// into text on the phone before saving, so no audio is ever stored.
// Table created by migrations/v2/0011_app4a_note_cantiere.sql; until it runs
// the API answers { available: false } and the app hides notes.

export const JOB_NOTE_SOURCES = ["typed", "voice"] as const;
export type JobNoteSource = (typeof JOB_NOTE_SOURCES)[number];

export const jobNotesTable = pgTable(
  "job_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The company (owner account), like every other job table. */
    userId: text("user_id").notNull(),
    /** Who wrote it: the owner or a team member acting for the company. */
    actorUserId: text("actor_user_id").notNull(),
    authorName: text("author_name").notNull().default(""),
    /** Plain uuid (no drizzle FK) to avoid a schema cycle with crm.ts; the SQL migration adds the FK. */
    projectId: uuid("project_id").notNull(),
    body: text("body").notNull(),
    source: text("source").$type<JobNoteSource>().notNull().default("typed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_notes_project_idx").on(t.projectId, t.createdAt)],
);

export type JobNote = typeof jobNotesTable.$inferSelect;
