import { pgTable, text, uuid, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { projectsTable } from "./crm";

// ── CLI-1: portale del cliente (docs/PIANO-AZIONE.md riga 50, QuoteAI Phase 76) ──
// migrations/v2/0018. Un posto dove il cliente vede tutto quello che l'impresa
// gli ha mandato: preventivi, contratti, pro-forma e fatture (e le paga),
// l'avanzamento del cantiere con le foto, e uno scambio di messaggi. Si apre
// con /portal/:token; la casella email si dimostra con un codice di 6 cifre e
// il browser tiene poi un token di sessione, mandato nell'header
// X-Portal-Session (mai un cookie). Di link, codice e sessione si salva solo
// lo SHA-256.
//
// Il portale sta in una tabella sua e non in colonne di `clients`: il codice
// che legge i clienti non cambia, e finché la 0018 non gira in un ambiente
// il resto dell'app non se ne accorge.

export const clientPortalsTable = pgTable(
  "client_portals",
  {
    clientId: uuid("client_id").primaryKey().references(() => clientsTable.id, { onDelete: "cascade" }),
    /** L'impresa (business_profiles.user_id): la cancellazione dell'account la spazza. */
    userId: text("user_id").notNull(),
    /** SHA-256 del token del link (un HMAC dell'id del cliente, ricostruibile: portal/service.ts). */
    tokenHash: text("token_hash").notNull(),
    otpHash: text("otp_hash"),
    otpExpiresAt: timestamp("otp_expires_at", { withTimezone: true }),
    otpAttempts: integer("otp_attempts").notNull().default(0),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("client_portals_token_idx").on(t.tokenHash), index("client_portals_user_idx").on(t.userId)],
);

export const clientPortalSessionsTable = pgTable(
  "client_portal_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    clientId: uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    /** SHA-256 del token di sessione che tiene il browser. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_portal_sessions_token_idx").on(t.tokenHash), index("client_portal_sessions_client_idx").on(t.clientId)],
);

export const CLIENT_MESSAGE_SENDERS = ["contractor", "client"] as const;
export type ClientMessageSender = (typeof CLIENT_MESSAGE_SENDERS)[number];

/**
 * Lo scambio di messaggi tra l'impresa e un suo cliente. Uno per cliente; un
 * messaggio può riferirsi a un cantiere ("per: Bagno via Roma"). I messaggi
 * dell'impresa arrivano al cliente per email col link del portale; le risposte
 * del cliente fanno una notifica e un'email all'impresa.
 */
export const clientMessagesTable = pgTable(
  "client_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    clientId: uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
    sender: text("sender", { enum: CLIENT_MESSAGE_SENDERS }).notNull(),
    /** Il nome al momento dell'invio (chi della squadra, o il cliente). */
    senderName: text("sender_name").notNull().default(""),
    body: text("body").notNull(),
    /** Quando l'ha visto l'*altra* parte (l'impresa apre lo scambio / il cliente apre il portale). */
    readAt: timestamp("read_at", { withTimezone: true }),
    /** Quando è partita la copia via email (null: niente indirizzo, email non configurata o invio fallito — il messaggio c'è comunque). */
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_messages_client_idx").on(t.clientId, t.createdAt), index("client_messages_unread_idx").on(t.userId, t.sender, t.readAt), index("client_messages_project_idx").on(t.projectId)],
);

export type ClientPortal = typeof clientPortalsTable.$inferSelect;
export type ClientPortalSession = typeof clientPortalSessionsTable.$inferSelect;
export type ClientMessage = typeof clientMessagesTable.$inferSelect;
