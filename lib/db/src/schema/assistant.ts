import { pgTable, text, timestamp, uuid, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { projectsTable } from "./crm";

// ── Phase 5: job assistant ───────────────────────────────────────────────────
// One conversation per (user, job) — or company-wide when project_id is null.
// The model only *proposes* writes: every propose_* tool call becomes an
// `assistant_proposals` row that the user confirms or dismisses from a card.

export const ASSISTANT_ROLES = ["user", "assistant", "tool"] as const;
export type AssistantRole = (typeof ASSISTANT_ROLES)[number];

// APP-8c adds the quote draft, the customer-facing sends (quote, contract, lead, free message),
// a client's contact details and a job note. `kind` is plain text in SQL, so no migration.
export const PROPOSAL_KINDS = ["cost_entry", "milestone_update", "task", "invoice", "record_payment", "send_invoice", "draft_quote", "send_quote", "send_contract", "reply_lead", "message_client", "update_client", "job_note", "call"] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

// APP-8b: "undone" = ran by itself ("Lo fa") and the person pressed Annulla.
export const PROPOSAL_STATUSES = ["pending", "confirmed", "dismissed", "failed", "undone"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type AssistantToolCall = { id: string; name: string; arguments: string };

export const assistantConversationsTable = pgTable(
  "assistant_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("assistant_conversations_user_idx").on(t.userId, t.projectId)],
);

export const assistantMessagesTable = pgTable(
  "assistant_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull().references(() => assistantConversationsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ASSISTANT_ROLES }).notNull(),
    content: text("content").notNull().default(""),
    /** Assistant turn: the tool calls the model requested. */
    toolCalls: jsonb("tool_calls").$type<AssistantToolCall[] | null>(),
    /** Tool turn: the call this message answers. */
    toolCallId: text("tool_call_id"),
    toolName: text("tool_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistant_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const assistantProposalsTable = pgTable(
  "assistant_proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull().references(() => assistantConversationsTable.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => assistantMessagesTable.id, { onDelete: "set null" }),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: PROPOSAL_KINDS }).notNull(),
    /** Human-readable one-liner shown on the card. */
    summary: text("summary").notNull().default(""),
    /** Validated tool arguments (shape depends on `kind`). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status", { enum: PROPOSAL_STATUSES }).notNull().default("pending"),
    /** Entity created/changed when confirmed (e.g. "invoice", "cost_entry"). */
    resultEntityType: text("result_entity_type"),
    resultEntityId: text("result_entity_id"),
    error: text("error"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistant_proposals_conversation_idx").on(t.conversationId, t.status)],
);

// ── APP-8b: permessi e una conversazione per persona (docs/ASSISTENTE-PLAN.md §4) ──
// Three NEW tables, created by migrations/v2/0013_app8b_assistente.sql. Nothing
// is added to the tables above on purpose: every select() on them would ask for
// a new column and fail until the migration runs. Until it does the assistant
// works as before APP-8b (one conversation per company, every action asks) — the
// role check needs no table and applies anyway (api-server assistant/permissions.ts).

/** Who a conversation belongs to. No row = the account owner (every conversation before APP-8b). */
export const assistantConversationActorsTable = pgTable(
  "assistant_conversation_actors",
  {
    conversationId: uuid("conversation_id").primaryKey().references(() => assistantConversationsTable.id, { onDelete: "cascade" }),
    /** The company (owner account), like every other table. */
    userId: text("user_id").notNull(),
    /** The person (auth_user.id) — the owner too, for threads created after APP-8b. */
    actorUserId: text("actor_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistant_conversation_actors_actor_idx").on(t.userId, t.actorUserId)],
);

/** The owner's choices in Impostazioni → Assistente. role "" = the whole company, otherwise only that role. */
export const assistantPermissionsTable = pgTable(
  "assistant_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),
    role: text("role").notNull().default(""),
    level: text("level").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("assistant_permissions_user_action_role_idx").on(t.userId, t.action, t.role)],
);

/** One row per action the assistant carried out: who, at which level ("auto" = Lo fa, "ask" = confirmed), and whether it was undone. */
export const assistantActionsTable = pgTable(
  "assistant_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    proposalId: uuid("proposal_id").notNull().references(() => assistantProposalsTable.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    kind: text("kind", { enum: PROPOSAL_KINDS }).notNull(),
    level: text("level", { enum: ["auto", "ask"] }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("assistant_actions_proposal_idx").on(t.proposalId), index("assistant_actions_user_idx").on(t.userId, t.executedAt)],
);

export type AssistantConversation = typeof assistantConversationsTable.$inferSelect;
export type AssistantMessage = typeof assistantMessagesTable.$inferSelect;
export type AssistantProposal = typeof assistantProposalsTable.$inferSelect;
export type AssistantPermissionRow = typeof assistantPermissionsTable.$inferSelect;
export type AssistantActionRow = typeof assistantActionsTable.$inferSelect;
