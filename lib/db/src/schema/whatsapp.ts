import {
  pgTable,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { authUsersTable } from "./auth";

export const whatsappConnectionsTable = pgTable("whatsapp_connections", {
  userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull().unique(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whatsappOtpTable = pgTable("whatsapp_otp", {
  phoneNumber: text("phone_number").primaryKey(),
  otp: text("otp").notNull(),
  userId: text("user_id").notNull().references(() => authUsersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWhatsappConnectionSchema = createInsertSchema(whatsappConnectionsTable).omit({
  connectedAt: true,
});
export const insertWhatsappOtpSchema = createInsertSchema(whatsappOtpTable).omit({
  createdAt: true,
});

export type WhatsappConnection = typeof whatsappConnectionsTable.$inferSelect;
export type WhatsappOtp = typeof whatsappOtpTable.$inferSelect;
export type InsertWhatsappConnection = z.infer<typeof insertWhatsappConnectionSchema>;
