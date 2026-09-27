import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── APP-1c: cancellazione dell'account in autonomia (docs/APP-PLAN.md §5) ────
// Apple 5.1.1(v) e GDPR art. 17. Una riga per richiesta:
//
//   in_attesa ──(30 giorni, cron)──▶ completata
//       │
//       └──(la persona annulla)──▶ annullata
//
// La colonna della persona si chiama `subject_user_id` e NON `user_id` di
// proposito: la cancellazione spazza ogni tabella con `user_id`, e questa riga
// deve sopravvivere come prova che la cancellazione è avvenuta (accountability,
// GDPR art. 5.2). Dopo la cancellazione l'email si svuota e resta solo il suo
// hash, per rispondere a "avete cancellato i miei dati?".
//
// Contratti firmati, fatture emesse e fatture elettroniche restano per legge
// (art. 2220 c.c.) fino a `retain_until`; poi il cron li cancella e segna
// `retention_cleared_at`.

export const ACCOUNT_DELETION_STATES = ["in_attesa", "annullata", "completata", "errore"] as const;
export type AccountDeletionState = (typeof ACCOUNT_DELETION_STATES)[number];

/** Quante righe (e file) sono state cancellate o conservate, per tabella. */
export type AccountDeletionSummary = {
  deleted: Record<string, number>;
  retained: Record<string, number>;
  storage: { deleted: number; retainedPrefixes: string[]; error?: string };
  stripe: { cancelled: string[]; error?: string };
};

export const accountDeletionsTable = pgTable(
  "account_deletions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** auth_user.id della persona che si cancella. */
    subjectUserId: text("subject_user_id").notNull(),
    /** Vero se la persona era titolare di un'impresa (business_profiles): si cancella anche l'impresa. */
    ownsOrg: boolean("owns_org").notNull().default(false),
    /** Serve per le email (conferma, promemoria, fatto); svuotata a cancellazione completata. */
    email: text("email"),
    /** sha256 dell'email in minuscolo: resta dopo la cancellazione. */
    emailHash: text("email_hash").notNull(),
    stato: text("stato").$type<AccountDeletionState>().notNull().default("in_attesa"),
    reason: text("reason"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Abbonamenti Stripe messi in disdetta a fine periodo da questa richiesta (si ripristinano se annulla). */
    stripeSubscriptions: jsonb("stripe_subscriptions").$type<string[]>().notNull().default([]),
    stripeCustomerId: text("stripe_customer_id"),
    summary: jsonb("summary").$type<AccountDeletionSummary | null>(),
    retainUntil: timestamp("retain_until", { withTimezone: true }),
    retentionClearedAt: timestamp("retention_cleared_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("account_deletions_subject_idx").on(t.subjectUserId),
    index("account_deletions_stato_idx").on(t.stato, t.scheduledFor),
    uniqueIndex("account_deletions_one_pending_idx").on(t.subjectUserId).where(sql`stato = 'in_attesa'`),
  ],
);

export type AccountDeletion = typeof accountDeletionsTable.$inferSelect;
