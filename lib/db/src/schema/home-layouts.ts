import { pgTable, text, uuid, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

// ── APP-7: la home per ruolo e "Personalizza la home" (docs/PIANO-AZIONE.md riga 31) ──
// One row per saved layout. `subject` says whose it is:
//   `user:<auth_user.id>` — one person's own home in this company;
//   `role:<kind>`         — the owner's starting home for a kind of role
//                           (titolare / ufficio / capocantiere / contabile / lettore).
// The layout itself (sections, tabs, period) is checked against the role on
// every read and write (lib/config home.ts normalizeHomeLayout), so a stored
// row can never show more than the role allows.
// Table created by migrations/v2/0012_app7_home.sql; until it runs everyone
// gets their role's built-in home and "Personalizza" says it can't save yet.

export const homeLayoutsTable = pgTable(
  "home_layouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The company (owner account), like every other table. */
    userId: text("user_id").notNull(),
    subject: text("subject").notNull(),
    layout: jsonb("layout").$type<object>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("home_layouts_user_subject_idx").on(t.userId, t.subject)],
);

export type HomeLayoutRow = typeof homeLayoutsTable.$inferSelect;
