import { pgTable, text, uuid, timestamp, integer, index } from "drizzle-orm/pg-core";

// POCKET-4 (riga 61, da QuoteAI 127.4 Compliance): i promemoria dell'impresa nel calendario delle scadenze (DURC, assicurazione,
// sorveglianza sanitaria, formazione sulla sicurezza, attestazione SOA…). Le scadenze fiscali non stanno qui: si ricalcolano
// dallo scadenzario del modulo Fisco. Un promemoria è dell'impresa, scritto da lei: PrevAI non dice quali siano dovuti.
export const REMINDER_KINDS = ["insurance", "licence", "safety", "other"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];
export const REMINDER_RECURRENCES = ["none", "monthly", "quarterly", "annual"] as const;
export type ReminderRecurrence = (typeof REMINDER_RECURRENCES)[number];

export const complianceRemindersTable = pgTable(
  "compliance_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind", { enum: REMINDER_KINDS }).notNull().default("other"),
    preset: text("preset"),
    title: text("title").notNull(),
    authority: text("authority").notNull().default(""),
    /** `AAAA-MM-GG`. */
    dueDate: text("due_date").notNull(),
    recurrence: text("recurrence", { enum: REMINDER_RECURRENCES }).notNull().default("none"),
    remindDaysBefore: integer("remind_days_before").notNull().default(30),
    notes: text("notes").notNull().default(""),
    lastDoneAt: timestamp("last_done_at", { withTimezone: true }),
    /** Un promemoria che non si ripete, fatto, esce dall'elenco. */
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("compliance_reminders_user_idx").on(t.userId, t.dueDate)],
);

export type ComplianceReminder = typeof complianceRemindersTable.$inferSelect;
