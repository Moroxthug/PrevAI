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

export const PRICE_ITEM_KINDS = ["labour", "material", "assembly"] as const;
export type PriceItemKind = (typeof PRICE_ITEM_KINDS)[number];
export type PriceItemPart = { name: string; amount: number };

export const priceCatalogItemsTable = pgTable("price_catalog_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  nome: text("nome").notNull(),
  categoria: text("categoria"),
  um: text("um").notNull().default("cad"),
  prezzoUnitario: numeric("prezzo_unitario", { precision: 10, scale: 2 }).notNull().default("0"),
  note: text("note"),
  /** POCKET-4 (QuoteAI 127.6 PriceBook): manodopera, materiale o lavorazione composta. Vuoto sulle righe fatte prima: l'API lo ricava dall'unità. */
  kind: text("kind", { enum: PRICE_ITEM_KINDS }),
  /** Quanto costa all'impresa (il margine è il prezzo meno questo). */
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  /** Il prezzo prima dell'ultima modifica e quando è cambiato (i segni «Prezzo cambiato» e «+8 %»). */
  previousPrice: numeric("previous_price", { precision: 10, scale: 2 }),
  priceChangedAt: timestamp("price_changed_at", { withTimezone: true }),
  /** Le parti di una lavorazione composta: nome e quanto costa ciascuna. */
  parts: jsonb("parts").$type<PriceItemPart[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPriceCatalogItemSchema = createInsertSchema(priceCatalogItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPriceCatalogItem = z.infer<typeof insertPriceCatalogItemSchema>;
export type PriceCatalogItem = typeof priceCatalogItemsTable.$inferSelect;
