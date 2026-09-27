import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

// ── APP-5: beta con le imprese pilota (docs/APP-PLAN.md §5) ─────────────────
// Two small tables so the beta can be judged on facts, not impressions:
//
// - app_events: the three usage events the plan asks for (app opened, quote
//   created, quote shared), each stamped with the surface it came from — web,
//   installed PWA, or the native shell (android / ios) once APP-3 exists. The
//   "done" test of APP-5 ("20 preventivi creati dall'app") is a count here.
// - app_feedback: "Segnala un problema" from the phone's Altro sheet.
//
// `user_id` is the org (owner) id, like every tenant table, so e2e cleanup and
// account deletion sweep these too; `actor_user_id` is the person who acted.
// No content of quotes lands here: only ids, kinds and the surface.

export const APP_EVENT_KINDS = ["app_open", "quote_created", "quote_shared"] as const;
export type AppEventKind = (typeof APP_EVENT_KINDS)[number];

export const APP_SURFACES = ["web", "pwa", "android", "ios"] as const;
export type AppSurface = (typeof APP_SURFACES)[number];

export const APP_FEEDBACK_STATES = ["nuovo", "visto", "risolto"] as const;
export type AppFeedbackState = (typeof APP_FEEDBACK_STATES)[number];

export const appEventsTable = pgTable(
  "app_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    kind: text("kind").$type<AppEventKind>().notNull(),
    surface: text("surface").$type<AppSurface>().notNull(),
    /** "phone" (≤ 980 px, the phone navigation) or "desktop". */
    viewport: text("viewport").notNull().default("desktop"),
    appVersion: text("app_version"),
    /** quote id for quote_created / quote_shared. */
    entityId: text("entity_id"),
    /** How a quote was shared: "link", "email", "share_sheet". */
    channel: text("channel"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("app_events_user_created_idx").on(t.userId, t.createdAt),
    index("app_events_created_idx").on(t.createdAt),
  ],
);

export const appFeedbackTable = pgTable(
  "app_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    actorEmail: text("actor_email").notNull().default(""),
    message: text("message").notNull(),
    route: text("route").notNull().default(""),
    surface: text("surface").$type<AppSurface>().notNull(),
    viewport: text("viewport").notNull().default("desktop"),
    appVersion: text("app_version"),
    userAgent: text("user_agent").notNull().default(""),
    stato: text("stato").$type<AppFeedbackState>().notNull().default("nuovo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("app_feedback_created_idx").on(t.createdAt)],
);

export type AppEvent = typeof appEventsTable.$inferSelect;
export type AppFeedback = typeof appFeedbackTable.$inferSelect;
