import { pgTable, text, uuid, integer, timestamp, index } from "drizzle-orm/pg-core";
import { quotesTable } from "./quotes";

// ── SEC-4: public quote link (docs/CONTROLLO-FASE-41.md §3) ────────────────
// migrations/v2/0016. Until now the quote's UUID was its public link, with no
// expiry and no way to take it back. The link is now `/p/<quote id>.<signature>`,
// an HMAC of the id and `version` (quotes/publicLink.ts): nothing secret is
// stored. Revoking bumps `version`, so every link sent before stops working;
// the next share makes a new one. `expires_at` moves forward each time the
// company shares the link again.

export const quotePublicLinksTable = pgTable(
  "quote_public_links",
  {
    quoteId: uuid("quote_id").primaryKey().references(() => quotesTable.id, { onDelete: "cascade" }),
    /** The company (business_profiles.user_id): account deletion sweeps it. */
    userId: text("user_id").notNull(),
    version: integer("version").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quote_public_links_user_idx").on(t.userId)],
);

export type QuotePublicLink = typeof quotePublicLinksTable.$inferSelect;
