import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import type { PaymentSchedule } from "./payment-schedule";

export type FeatureFlags = Record<string, boolean>;

/** Automation preferences a company can tune. All default to the conservative option. */
export type AutomationSettings = {
  /** Email the company when a customer accepts a quote. */
  notifyOnQuoteAccepted: boolean;
  /** Phase 1: auto-draft a contract when a quote is accepted. */
  autoDraftContract: boolean;
  /** Phase 4: send automation-drafted invoices (deposit / progress / final) to the customer immediately, without review. */
  autoSendInvoices: boolean;
  /**
   * Phase 4, review mode only: send an automation-drafted invoice on its own
   * if nobody has touched it after this many hours (0 = never). The daily
   * cron performs the send, so the effective delay is "the next tick after".
   */
  invoiceAutoSendAfterHours: number;
  /** Phase 4: email overdue reminders to the customer (3 / 7 / 14 days past due). */
  invoiceReminders: boolean;
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  notifyOnQuoteAccepted: true,
  autoDraftContract: true,
  autoSendInvoices: false,
  invoiceAutoSendAfterHours: 0,
  invoiceReminders: true,
};

export const businessProfilesTable = pgTable("business_profiles", {
  userId: text("user_id").primaryKey(),
  companyName: text("company_name").notNull().default(""),
  vatNumber: text("vat_number"),
  address: text("address"),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionPlan: text("subscription_plan"),
  subscriptionStatus: text("subscription_status"),
  subscriptionPeriodEnd: timestamp("subscription_period_end", { withTimezone: true }),
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
  trialDownloadsUsed: integer("trial_downloads_used").notNull().default(0),
  apiKey: text("api_key"),
  // ── Identità fiscale italiana (V2-4: le colonne canadesi GST/HST, QST, PST,
  //    licence, e-Transfer non esistono più; la P. IVA è `vatNumber`) ──────────
  province: text("province"), // sigla provincia della sede: default IVA/regime e modello di contratto
  // A-1: la FatturaPA vuole la sede dell'emittente scomposta (Indirizzo, CAP,
  //      Comune, Provincia); `address` resta il testo libero che finisce su
  //      preventivi e contratti.
  city: text("city"), // comune della sede
  cap: text("cap"), // CAP della sede (5 cifre)
  codiceFiscale: text("codice_fiscale"), // C.F. dell'impresa (ditta individuale = quello del titolare); serve alla FatturaPA
  codiceSdi: text("codice_sdi"), // codice destinatario SDI o PEC dell'impresa (ciclo passivo, A-1)
  reaNumber: text("rea_number"), // n° REA / iscrizione albo, stampato sui contratti
  iban: text("iban"), // dove i clienti fanno il bonifico — stampato su pro-forma e pagina pubblica
  defaultPaymentSchedule: jsonb("default_payment_schedule").$type<PaymentSchedule | null>(),
  // ── Phase 10: review requests ────────────────────────────────────────────
  googleReviewUrl: text("google_review_url"), // Google Business Profile "write a review" link, set once in Settings
  // ── Phase 26: seconda piattaforma di recensioni (link manuale, es. Trustpilot/ProntoPro) ──
  secondaryReviewUrl: text("secondary_review_url"),
  sendReviewRequests: boolean("send_review_requests").notNull().default(true),
  automationSettings: jsonb("automation_settings").$type<Partial<AutomationSettings>>().notNull().default({}),
  featureFlags: jsonb("feature_flags").$type<FeatureFlags>().notNull().default({}),
  // ── A-0: policy di sicurezza dell'organizzazione. Quando è true ogni utente
  //    che agisce nell'org (titolare e membri) deve avere la verifica in due
  //    passaggi attiva: le API rispondono 403 `two_factor_required` finché non
  //    la attiva. Il modulo Amministrazione (A-5) la imposta a true e non la
  //    lascia più disattivare (AMMINISTRAZIONE-PLAN §6.5).
  twoFactorRequired: boolean("two_factor_required").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBusinessProfileSchema = createInsertSchema(businessProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
export type BusinessProfile = typeof businessProfilesTable.$inferSelect;
