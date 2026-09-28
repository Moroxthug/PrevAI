import { pgTable, text, uuid, timestamp, integer, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";

// ── APP-2: notifiche push sul telefono (docs/APP-PLAN.md, come QuoteAI Phase 77/119) ──
// Two small tables, migrations/v2/0014:
//
// - push_subscriptions: one row per browser (or installed PWA) that turned
//   notifications on. `user_id` is the company it receives for (the acting org
//   when it was turned on, like every tenant table, so account deletion sweeps
//   it); `member_user_id` is the person, so a member's role decides what reaches
//   their phone and a member who leaves takes nothing with them. A 404/410 from
//   the push service deletes the row; other failures are counted and the row is
//   dropped after a streak.
// - push_preferences: which kinds (lib/config notifiche-push.ts) a person has
//   switched off in that company. No row = everything on.

export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The company (business_profiles.user_id) whose notifications this browser receives. */
    userId: text("user_id").notNull(),
    /** The signed-in person who turned it on (auth user id): the owner or a team member. */
    memberUserId: text("member_user_id").notNull(),
    /** PushSubscription.endpoint — unique per browser profile. */
    endpoint: text("endpoint").notNull(),
    /** Subscriber's ECDH public key (base64url, 65 bytes uncompressed). */
    p256dh: text("p256dh").notNull(),
    /** 16-byte auth secret (base64url). */
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint), index("push_subscriptions_user_idx").on(t.userId)],
);

export const pushPreferencesTable = pgTable(
  "push_preferences",
  {
    userId: text("user_id").notNull(),
    memberUserId: text("member_user_id").notNull(),
    /** PushKind values switched off. */
    muted: text("muted").array().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.memberUserId] })],
);

export type PushSubscriptionRow = typeof pushSubscriptionsTable.$inferSelect;
export type PushPreferences = typeof pushPreferencesTable.$inferSelect;
