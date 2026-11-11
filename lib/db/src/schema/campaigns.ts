import { pgTable, uuid, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { randomBytes } from "node:crypto";
import { authUsersTable } from "./auth";

// ── EMAIL-2: campagne email agli utenti PrevAI (migrazione 0029) ────────────

/** Nessuna riga = iscritto (soft spam, art. 130 c.4 D.Lgs. 196/2003). */
export const marketingPreferencesTable = pgTable(
  "marketing_preferences",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => authUsersTable.id, { onDelete: "cascade" }),
    unsubscribeToken: text("unsubscribe_token").notNull().$defaultFn(() => randomBytes(24).toString("hex")),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    /** "link" (pagina), "one_click" (List-Unsubscribe-Post), "settings" (impostazioni), "admin", "bounce"/"complaint". */
    unsubscribeSource: text("unsubscribe_source"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("marketing_preferences_token_idx").on(t.unsubscribeToken)],
);

export const CAMPAIGN_STATUSES = ["bozza", "in_invio", "inviata", "annullata"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const emailCampaignsTable = pgTable(
  "email_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    /** CampaignContent (api-server lib/emailCampaign.ts). */
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    /** Id di un pubblico (api-server campaigns/audiences.ts). */
    audience: text("audience").notNull(),
    status: text("status").$type<CampaignStatus>().notNull().default("bozza"),
    createdBy: text("created_by"),
    testSentAt: timestamp("test_sent_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    recipientsTotal: integer("recipients_total").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_campaigns_status_idx").on(t.status)],
);

export const CAMPAIGN_RECIPIENT_STATUSES = ["in_coda", "in_corso", "inviata", "fallita", "saltata"] as const;
export type CampaignRecipientStatus = (typeof CAMPAIGN_RECIPIENT_STATUSES)[number];

export const emailCampaignRecipientsTable = pgTable(
  "email_campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => emailCampaignsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    status: text("status").$type<CampaignRecipientStatus>().notNull().default("in_coda"),
    resendId: text("resend_id"),
    error: text("error"),
    /** Quando un lotto l'ha preso: 'in_corso' da troppo = lotto interrotto. */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("email_campaign_recipients_uniq").on(t.campaignId, t.userId), index("email_campaign_recipients_queue_idx").on(t.campaignId, t.status)],
);

export type EmailCampaign = typeof emailCampaignsTable.$inferSelect;
export type EmailCampaignRecipient = typeof emailCampaignRecipientsTable.$inferSelect;
