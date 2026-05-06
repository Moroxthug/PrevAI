import {
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessProfilesTable = pgTable("business_profiles", {
  userId: text("user_id").primaryKey(),
  companyName: text("company_name").notNull().default(""),
  vatNumber: text("vat_number"),
  address: text("address"),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBusinessProfileSchema = createInsertSchema(businessProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
export type BusinessProfile = typeof businessProfilesTable.$inferSelect;
