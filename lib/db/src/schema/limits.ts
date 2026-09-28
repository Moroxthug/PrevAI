import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

// ── SEC-2: limiti condivisi fra le istanze (docs/CONTROLLO-FASE-41.md §3) ──
// Two small tables, migrations/v2/0015:
//
// - rate_limit_counters: one row per limiter bucket ("<limiter>:<who>"), a
//   fixed window. Every Vercel instance counts on the same row, so a cold start
//   no longer resets a limit and ten instances no longer mean ten times the
//   budget. Expired rows are swept by the counter itself now and then.
// - ai_budgets: a per-company override of the monthly AI spending cap
//   (lib/config tetto-ia.ts). No row = the plan's cap. Staff only, by SQL
//   (RUNBOOKS §26).

export const rateLimitCountersTable = pgTable(
  "rate_limit_counters",
  {
    key: text("key").primaryKey(),
    hits: integer("hits").notNull().default(0),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limit_counters_reset_at_idx").on(t.resetAt)],
);

export const aiBudgetsTable = pgTable("ai_budgets", {
  /** The company (business_profiles.user_id). */
  userId: text("user_id").primaryKey(),
  /** Monthly AI spending cap in euro cents; `null` = no cap for this company. */
  monthlyCapEurCents: integer("monthly_cap_eur_cents"),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiBudgetRow = typeof aiBudgetsTable.$inferSelect;
