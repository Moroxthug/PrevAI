import { pgTable, text, uuid, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

// ── POCKET-4 (riga 61, da QuoteAI 127.8 Group): più imprese in un gruppo ──────
// Un'impresa resta una riga di `business_profiles` col suo titolare, e un accesso ha una sola impresa. Un *gruppo* ne mette insieme
// più d'una per una cosa sola: la vista di insieme (fatturato, costi, margine, da incassare), con il lavoro fra le imprese del gruppo
// tolto dai totali. Niente si fonde: ogni riga resta nella sua impresa, ognuna con i suoi libri e le sue dichiarazioni.
// Fuori per ora (da decidere col titolare, toccano piani e fatturazione): un listino condiviso, una sola fattura per tutte, le persone
// che lavorano per due imprese.
export const GROUP_MEMBER_STATUSES = ["pending", "active"] as const;
export type GroupMemberStatus = (typeof GROUP_MEMBER_STATUSES)[number];

export const companyGroupsTable = pgTable(
  "company_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** L'impresa che ha creato il gruppo e lo gestisce (nome, chi ci sta). */
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("company_groups_user_id_idx").on(t.userId)],
);

export const companyGroupMembersTable = pgTable(
  "company_group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => companyGroupsTable.id, { onDelete: "cascade" }),
    /** L'impresa membro (business_profiles.user_id). Un'impresa sta al massimo in un gruppo. */
    userId: text("user_id").notNull(),
    status: text("status", { enum: GROUP_MEMBER_STATUSES }).notNull().default("pending"),
    invitedByUserId: text("invited_by_user_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("company_group_members_user_idx").on(t.userId), index("company_group_members_group_idx").on(t.groupId)],
);

export type CompanyGroup = typeof companyGroupsTable.$inferSelect;
export type CompanyGroupMember = typeof companyGroupMembersTable.$inferSelect;
