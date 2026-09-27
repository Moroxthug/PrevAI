import { pgTable, text, uuid, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { randomUUID } from "crypto";

// First-class client records. Until Phase 0 clients were derived on the fly
// from quotes.client_data; contracts and invoices need a stable party to
// point at, so quotes now link to a row here (quotes.client_id).
export const clientsTable = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type", { enum: ["individual", "business"] }).notNull().default("individual"),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    province: text("province"), // ISO-ish 2-letter code (ON, QC, ...)
    postalCode: text("postal_code"),
    businessNumber: text("business_number"), // P. IVA del cliente impresa (V2-4: era il CRA BN canadese)
    // ── A-1: dati che la FatturaPA pretende sul cessionario/committente ──────
    /** C.F. del cliente: obbligatorio per i privati (che non hanno P. IVA). */
    codiceFiscale: text("codice_fiscale"),
    /** Codice destinatario SDI a 7 caratteri (6 per la PA); `0000000` = privato senza canale. */
    codiceSdi: text("codice_sdi"),
    /** PEC del cliente, alternativa al codice destinatario. */
    pec: text("pec"),
    /** Fatture verso PA: CIG/CUP obbligatori quando l'ente li ha comunicati. */
    cig: text("cig"),
    cup: text("cup"),
    preferredLanguage: text("preferred_language", { enum: ["it"] }).notNull().default("it"),
    notes: text("notes").notNull().default(""),
    /** Stable dedup key: lower(name)|lower(email)|phone — same recipe used by the legacy derived clients list. */
    dedupKey: text("dedup_key").notNull(),
    // ── Phase 10: opt-out GDPR/art. 130 Codice Privacy per gli invii non transazionali (richieste recensione, foto condivise) ──
    // Never gates transactional messages (quotes/contracts/invoices) — only automated reachout.
    marketingUnsubscribeToken: text("marketing_unsubscribe_token").notNull().$defaultFn(() => randomUUID()),
    marketingUnsubscribedAt: timestamp("marketing_unsubscribed_at", { withTimezone: true }),
    /** Phase 47: soft-archive. Set when moved to the Archive view; excluded from list endpoints while set. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedByName: text("archived_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("clients_user_id_idx").on(t.userId),
    uniqueIndex("clients_user_dedup_idx").on(t.userId, t.dedupKey),
    uniqueIndex("clients_marketing_unsubscribe_token_idx").on(t.marketingUnsubscribeToken),
    index("clients_archived_idx").on(t.userId, t.archivedAt),
  ],
);

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;

/** Same recipe as the legacy md5 grouping in routes/clients.ts (minus the hash). */
export function clientDedupKey(input: { name?: string | null; email?: string | null; phone?: string | null }): string {
  const name = (input.name ?? "").trim().toLowerCase();
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").trim().toLowerCase();
  return `${name}|${email}|${phone}`;
}
