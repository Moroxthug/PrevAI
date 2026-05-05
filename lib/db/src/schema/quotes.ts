import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quoteItemSchema = z.object({
  descrizione: z.string(),
  quantita: z.number(),
  unita: z.string(),
  prezzoUnitario: z.number(),
  totale: z.number(),
});

export const quoteClientDataSchema = z.object({
  nome: z.string(),
  indirizzo: z.string(),
});

export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type QuoteClientData = z.infer<typeof quoteClientDataSchema>;

export const quotesTable = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  clientData: jsonb("client_data").$type<QuoteClientData>().notNull().default({ nome: "", indirizzo: "" }),
  descrizioneGenerale: text("descrizione_generale").notNull().default(""),
  items: jsonb("items").$type<QuoteItem[]>().notNull().default([]),
  subtotale: numeric("subtotale", { precision: 10, scale: 2 }).notNull().default("0"),
  ivaPercentuale: numeric("iva_percentuale", { precision: 5, scale: 2 }).notNull().default("22"),
  ivaValore: numeric("iva_valore", { precision: 10, scale: 2 }).notNull().default("0"),
  totale: numeric("totale", { precision: 10, scale: 2 }).notNull().default("0"),
  note: text("note").notNull().default("Preventivo valido 30 giorni"),
  status: text("status", { enum: ["draft", "unlocked", "pending_payment"] }).notNull().default("draft"),
  pdfUrl: text("pdf_url"),
  rawInput: text("raw_input").notNull().default(""),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQuoteSchema = createInsertSchema(quotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotesTable.$inferSelect;
