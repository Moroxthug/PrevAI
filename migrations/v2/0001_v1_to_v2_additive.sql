-- PrevAI v2 — migrazione additiva v1 → v2 (fase V2-3, 2026-09-21)
-- Generata con drizzle-kit (introspezione DB v1 → lib/db/src/schema) e rivista a mano.
-- Regole PREVAI-V2-PLAN.md §1: solo statement additivi/idempotenti, nessun DROP/RENAME/SET NOT NULL.
-- Le uniche modifiche a colonne esistenti sono allargamenti (compatibili con il codice v1):
--   * incentives_catalog.percentuale_massima  DROP NOT NULL   (schema v2 la vuole nullable)
--   * quotes.iva_percentuale                  numeric(5,2) -> numeric(6,3)  (QuoteAI Phase 71)
-- Scartati di proposito (v1 resta autorevole finché V2-4 non riallinea lo schema):
--   * DROP COLUMN incentives_catalog.regione / comune
--   * SET/DROP DEFAULT su incentives_catalog.level / categoria_intervento / tipo_agevolazione / percentuale_massima,
--     collaborators.role (default QuoteAI in inglese: 'federal', 'all', 'rebate', 'worker'), quotes.condizioni_pagamento (identico), quotes.iva_percentuale (identico)
-- quotes.unsubscribe_token: NOT NULL con DEFAULT gen_random_uuid()::text (come QuoteAI 0024), così le INSERT del codice v1 continuano a funzionare.
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0001_v1_to_v2_additive.sql   (un'unica transazione)
-- Rieseguibile: ogni statement è IF NOT EXISTS / guardato da duplicate_object.

DO $$ BEGIN
  CREATE TYPE "public"."price_trend_direction" AS ENUM('up', 'down');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "quote_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capitoli" jsonb DEFAULT '[]'::jsonb,
	"sconto" jsonb,
	"condizioni_pagamento" text[] DEFAULT '{}',
	"subtotale" numeric(10, 2) DEFAULT '0' NOT NULL,
	"iva_percentuale" numeric(6, 3) DEFAULT '22' NOT NULL,
	"iva_valore" numeric(10, 2) DEFAULT '0' NOT NULL,
	"totale" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp
);
CREATE TABLE IF NOT EXISTS "price_intelligence_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"work_type" text NOT NULL,
	"zone" text,
	"previous_avg_price" text NOT NULL,
	"current_avg_price" text NOT NULL,
	"percent_change" text NOT NULL,
	"direction" "price_trend_direction" NOT NULL,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text DEFAULT 'individual' NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"province" text,
	"postal_code" text,
	"business_number" text,
	"preferred_language" text DEFAULT 'it' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"dedup_key" text NOT NULL,
	"marketing_unsubscribe_token" text NOT NULL,
	"marketing_unsubscribed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"archived_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"diff" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"last_error" text,
	"next_attempt_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text,
	"entity_type" text,
	"entity_id" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "contract_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"signer_id" uuid,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"detail" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "contract_sequences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"next" integer DEFAULT 1 NOT NULL
);
CREATE TABLE IF NOT EXISTS "contract_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"token_hash" text,
	"token_expires_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"otp_hash" text,
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0 NOT NULL,
	"otp_verified_at" timestamp with time zone,
	"signature_type" text,
	"signature_data" text,
	"consent_text" text,
	"signed_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"decline_reason" text,
	"viewed_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"quote_id" uuid,
	"client_id" uuid,
	"project_id" uuid,
	"kind" text DEFAULT 'agreement' NOT NULL,
	"parent_contract_id" uuid,
	"change_order_id" uuid,
	"contract_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"province" text NOT NULL,
	"language" text DEFAULT 'it' NOT NULL,
	"template_key" text NOT NULL,
	"document" jsonb NOT NULL,
	"variables" jsonb NOT NULL,
	"contract_value_cents" integer DEFAULT 0 NOT NULL,
	"holdback_enabled" boolean DEFAULT false NOT NULL,
	"holdback_percent" integer DEFAULT 10 NOT NULL,
	"unsigned_pdf_hash" text,
	"unsigned_pdf_url" text,
	"signed_pdf_hash" text,
	"signed_pdf_url" text,
	"sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"last_reminder_at" timestamp with time zone,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "change_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"contract_id" uuid,
	"document_contract_id" uuid,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"schedule_delta_days" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"signed_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "cost_budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"category" text NOT NULL,
	"chapter_ref" text,
	"label" text DEFAULT '' NOT NULL,
	"planned_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"planned_start" timestamp with time zone,
	"planned_end" timestamp with time zone,
	"actual_start" timestamp with time zone,
	"actual_end" timestamp with time zone,
	"status" text DEFAULT 'planned' NOT NULL,
	"payment_term_id" text,
	"payment_term_label" text,
	"payment_amount_cents" integer,
	"source_chapter" text,
	"value_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "cost_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid,
	"milestone_id" uuid,
	"category" text DEFAULT 'misc' NOT NULL,
	"vendor" text DEFAULT '' NOT NULL,
	"supplier_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"tax_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_by" text DEFAULT 'user' NOT NULL,
	"source_document_id" uuid,
	"time_entry_id" uuid,
	"equipment_usage_id" uuid,
	"ai_extraction" jsonb,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"ownership" text DEFAULT 'owned' NOT NULL,
	"purchase_cents" integer DEFAULT 0 NOT NULL,
	"financing" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"usage_rate_cents" integer DEFAULT 0 NOT NULL,
	"usage_unit" text DEFAULT 'day' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "equipment_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"equipment_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid,
	"date" timestamp with time zone NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"unit" text DEFAULT 'day' NOT NULL,
	"rate_cents_snapshot" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"cost_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"worker_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid,
	"date" timestamp with time zone NOT NULL,
	"hours" numeric(6, 2) NOT NULL,
	"rate_cents_snapshot" integer DEFAULT 0 NOT NULL,
	"burden_percent_snapshot" numeric(5, 2) DEFAULT '0' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"entered_by" text DEFAULT 'company' NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_reason" text,
	"cost_entry_id" uuid,
	"clock_in_at" timestamp with time zone,
	"clock_out_at" timestamp with time zone,
	"clock_in_lat" numeric(9, 6),
	"clock_in_lng" numeric(9, 6),
	"clock_out_lat" numeric(9, 6),
	"clock_out_lng" numeric(9, 6),
	"geofence_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "invoice_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"detail" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" text DEFAULT 'etransfer' NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"credit_note_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "invoice_sequences" (
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"kind" text DEFAULT 'INV' NOT NULL,
	"next" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "invoice_sequences_user_id_year_kind_pk" PRIMARY KEY("user_id","year","kind")
);
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid,
	"client_id" uuid,
	"contract_id" uuid,
	"milestone_id" uuid,
	"change_order_id" uuid,
	"payment_term_id" text,
	"payment_term_label" text,
	"credit_note_for_id" uuid,
	"number" text NOT NULL,
	"type" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"language" text DEFAULT 'it' NOT NULL,
	"province" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"issue_date" timestamp with time zone DEFAULT now() NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"scheduled_for" timestamp with time zone,
	"scheduled_notified_at" timestamp with time zone,
	"contractor" jsonb NOT NULL,
	"customer" jsonb NOT NULL,
	"site_address" text DEFAULT '' NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"holdback_percent" integer DEFAULT 0 NOT NULL,
	"holdback_cents" integer DEFAULT 0 NOT NULL,
	"taxable_cents" integer DEFAULT 0 NOT NULL,
	"tax_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"payment_instructions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"public_token_hash" text,
	"pdf_url" text,
	"pdf_hash" text,
	"etransfer_self_reported_at" timestamp with time zone,
	"stripe_checkout_session_id" text,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"auto_send_at" timestamp with time zone,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"archived_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "assistant_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"tool_calls" jsonb,
	"tool_call_id" text,
	"tool_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "assistant_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"user_id" text NOT NULL,
	"project_id" uuid,
	"kind" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result_entity_type" text,
	"result_entity_id" text,
	"error" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"user_id" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"invited_email" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"invite_token_hash" text,
	"invite_token_expires_at" timestamp with time zone,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "usage_daily_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"kind" text NOT NULL,
	"quantity" numeric(14, 4) DEFAULT '0' NOT NULL,
	"cost_cents" numeric(12, 4) DEFAULT '0' NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_cost_cents" numeric(10, 6) DEFAULT '0' NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "lead_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"channel" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"client_id" uuid,
	"quote_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"preferred_language" text DEFAULT 'it' NOT NULL,
	"preferred_channel" text DEFAULT 'email' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"consent_source" text DEFAULT 'manual_entry' NOT NULL,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"follow_up_stage" integer DEFAULT 0 NOT NULL,
	"next_follow_up_at" timestamp with time zone,
	"last_contacted_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"meta_lead_id" text,
	"meta_form_id" text,
	"meta_form_name" text,
	"meta_campaign_id" text,
	"meta_campaign_name" text,
	"meta_ad_id" text,
	"google_lsa_lead_id" text,
	"google_lsa_lead_type" text,
	"google_lsa_category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "job_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"file_url" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"shared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "quickbooks_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"realm_id" text NOT NULL,
	"environment" text DEFAULT 'production' NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"payment_account" jsonb,
	"category_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "quickbooks_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"qbo_id" text,
	"qbo_type" text,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "calendar_connections" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"account_email" text DEFAULT '' NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "calendar_connections_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
CREATE TABLE IF NOT EXISTS "calendar_synced_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"milestone_id" uuid NOT NULL,
	"external_event_id" text,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "email_connections" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"account_email" text DEFAULT '' NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_send_at" timestamp with time zone,
	"last_send_error" text,
	CONSTRAINT "email_connections_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
CREATE TABLE IF NOT EXISTS "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "quote_import_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"row_index" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"raw_row" jsonb,
	"extraction" jsonb NOT NULL,
	"matched_client_id" uuid,
	"created_quote_id" uuid,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "stripe_connect_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_account_id" text NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "financeit_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"quote_id" uuid NOT NULL,
	"dealer_id" text NOT NULL,
	"financeit_application_id" text,
	"application_link" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "financeit_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"dealer_id" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_applied_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "financeit_loan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"loan_state" text,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"role" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" text NOT NULL,
	"entity_id" text NOT NULL,
	"response_status" integer,
	"success" boolean NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secret" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "wave_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"business_name" text DEFAULT '' NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"payment_account" jsonb,
	"income_account" jsonb,
	"category_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "wave_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"wave_id" text,
	"wave_type" text,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "flinks_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"login_id_enc" text NOT NULL,
	"institution_name" text DEFAULT '' NOT NULL,
	"selected_account" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "flinks_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"flinks_transaction_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"amount_cents" integer NOT NULL,
	"balance_cents" integer,
	"match_status" text DEFAULT 'unmatched' NOT NULL,
	"matched_cost_entry_id" uuid,
	"auto_matched" boolean DEFAULT false NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "meta_lead_ads_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"page_name" text DEFAULT '' NOT NULL,
	"page_access_token_enc" text NOT NULL,
	"user_token_expires_at" timestamp with time zone,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_lead_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "meta_lead_ads_import_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"meta_lead_id" text NOT NULL,
	"form_id" text,
	"status" text NOT NULL,
	"error" text,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "google_lsa_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"lsa_customer_id" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_polled_at" timestamp with time zone,
	"last_lead_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "google_lsa_import_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"google_lsa_lead_id" text NOT NULL,
	"lead_type" text,
	"status" text NOT NULL,
	"error" text,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "cron_ticks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"result" jsonb,
	"error" text,
	"took_ms" integer
);
ALTER TABLE "incentives_catalog" ALTER COLUMN "percentuale_massima" DROP NOT NULL;
ALTER TABLE "quotes" ALTER COLUMN "iva_percentuale" SET DATA TYPE numeric(6, 3);
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "province" text;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "gst_hst_number" text;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "qst_number" text;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "pst_number" text;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "licence_number" text;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "etransfer_email" text;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "default_payment_schedule" jsonb;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "google_review_url" text;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "homestars_profile_url" text;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "send_review_requests" boolean DEFAULT true NOT NULL;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "automation_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "price_intelligence" ADD COLUMN IF NOT EXISTS "vendor" text;
ALTER TABLE "incentives_catalog" ADD COLUMN IF NOT EXISTS "province" text;
ALTER TABLE "incentives_catalog" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "incentives_catalog" ADD COLUMN IF NOT EXISTS "income_tested" boolean DEFAULT false NOT NULL;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "worker_type" text DEFAULT 'employee' NOT NULL;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "burden_percent" numeric(5, 2) DEFAULT '15' NOT NULL;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "time_token_hash" text;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "time_token_expires_at" timestamp with time zone;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "last_time_entry_at" timestamp with time zone;
ALTER TABLE "auth_user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "milestone_id" uuid;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "follow_up_stage" integer DEFAULT 0 NOT NULL;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "next_follow_up_at" timestamp with time zone;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "unsubscribe_token" text NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "unsubscribed_at" timestamp with time zone;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "client_id" uuid;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "province" text;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "payment_schedule" jsonb;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "accepted_variant_id" uuid;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "archived_by_name" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "client_id" uuid;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "contract_id" uuid;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "address" text DEFAULT '' NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "province" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "contract_value_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "change_orders_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "setup_status" text DEFAULT 'confirmed' NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "setup_proposal" jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "setup_confirmed_at" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "planned_start" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "planned_end" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "progress_percent" integer DEFAULT 0 NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "review_request_sent_at" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "geofence_radius_meters" integer;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_by_name" text;
ALTER TABLE "uploaded_documents" ADD COLUMN IF NOT EXISTS "purpose" text DEFAULT 'price_intelligence' NOT NULL;
ALTER TABLE "uploaded_documents" ADD COLUMN IF NOT EXISTS "project_id" uuid;
DO $$ BEGIN
  ALTER TABLE "quote_variants" ADD CONSTRAINT "quote_variants_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_signer_id_contract_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."contract_signers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "contract_signers" ADD CONSTRAINT "contract_signers_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_document_contract_id_contracts_id_fk" FOREIGN KEY ("document_contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "cost_budget_lines" ADD CONSTRAINT "cost_budget_lines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_source_document_id_uploaded_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."uploaded_documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "equipment_usage" ADD CONSTRAINT "equipment_usage_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "equipment_usage" ADD CONSTRAINT "equipment_usage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "equipment_usage" ADD CONSTRAINT "equipment_usage_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "equipment_usage" ADD CONSTRAINT "equipment_usage_cost_entry_id_cost_entries_id_fk" FOREIGN KEY ("cost_entry_id") REFERENCES "public"."cost_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_worker_id_collaborators_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_cost_entry_id_cost_entries_id_fk" FOREIGN KEY ("cost_entry_id") REFERENCES "public"."cost_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "assistant_proposals" ADD CONSTRAINT "assistant_proposals_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "assistant_proposals" ADD CONSTRAINT "assistant_proposals_message_id_assistant_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."assistant_messages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "assistant_proposals" ADD CONSTRAINT "assistant_proposals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "quickbooks_connections" ADD CONSTRAINT "quickbooks_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "calendar_synced_events" ADD CONSTRAINT "calendar_synced_events_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "email_connections" ADD CONSTRAINT "email_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "quote_import_candidates" ADD CONSTRAINT "quote_import_candidates_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "stripe_connect_accounts" ADD CONSTRAINT "stripe_connect_accounts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "financeit_connections" ADD CONSTRAINT "financeit_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "financeit_loan_events" ADD CONSTRAINT "financeit_loan_events_application_id_financeit_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."financeit_applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhook_endpoints_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "wave_connections" ADD CONSTRAINT "wave_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "flinks_connections" ADD CONSTRAINT "flinks_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "flinks_transactions" ADD CONSTRAINT "flinks_transactions_matched_cost_entry_id_cost_entries_id_fk" FOREIGN KEY ("matched_cost_entry_id") REFERENCES "public"."cost_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "meta_lead_ads_connections" ADD CONSTRAINT "meta_lead_ads_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "google_lsa_connections" ADD CONSTRAINT "google_lsa_connections_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "quote_variants_quote_id_idx" ON "quote_variants" USING btree ("quote_id");
CREATE INDEX IF NOT EXISTS "clients_user_id_idx" ON "clients" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "clients_user_dedup_idx" ON "clients" USING btree ("user_id","dedup_key");
CREATE UNIQUE INDEX IF NOT EXISTS "clients_marketing_unsubscribe_token_idx" ON "clients" USING btree ("marketing_unsubscribe_token");
CREATE INDEX IF NOT EXISTS "clients_archived_idx" ON "clients" USING btree ("user_id","archived_at");
CREATE INDEX IF NOT EXISTS "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "automation_runs_idempotency_idx" ON "automation_runs" USING btree ("idempotency_key");
CREATE INDEX IF NOT EXISTS "automation_runs_status_next_idx" ON "automation_runs" USING btree ("status","next_attempt_at");
CREATE INDEX IF NOT EXISTS "automation_runs_user_idx" ON "automation_runs" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at","created_at");
CREATE INDEX IF NOT EXISTS "contract_events_contract_idx" ON "contract_events" USING btree ("contract_id","created_at");
CREATE INDEX IF NOT EXISTS "contract_signers_contract_idx" ON "contract_signers" USING btree ("contract_id");
CREATE UNIQUE INDEX IF NOT EXISTS "contract_signers_token_idx" ON "contract_signers" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "contracts_user_idx" ON "contracts" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "contracts_quote_idx" ON "contracts" USING btree ("quote_id");
CREATE INDEX IF NOT EXISTS "contracts_status_idx" ON "contracts" USING btree ("status","sent_at");
CREATE INDEX IF NOT EXISTS "contracts_archived_idx" ON "contracts" USING btree ("user_id","archived_at");
CREATE INDEX IF NOT EXISTS "change_orders_project_idx" ON "change_orders" USING btree ("project_id","created_at");
CREATE INDEX IF NOT EXISTS "change_orders_document_idx" ON "change_orders" USING btree ("document_contract_id");
CREATE INDEX IF NOT EXISTS "cost_budget_lines_project_idx" ON "cost_budget_lines" USING btree ("project_id","sort_order");
CREATE INDEX IF NOT EXISTS "milestones_project_idx" ON "milestones" USING btree ("project_id","sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "milestones_project_key_idx" ON "milestones" USING btree ("project_id","key");
CREATE INDEX IF NOT EXISTS "cost_entries_project_idx" ON "cost_entries" USING btree ("project_id","date");
CREATE INDEX IF NOT EXISTS "cost_entries_user_status_idx" ON "cost_entries" USING btree ("user_id","status");
CREATE INDEX IF NOT EXISTS "equipment_user_idx" ON "equipment" USING btree ("user_id","active");
CREATE INDEX IF NOT EXISTS "equipment_usage_project_idx" ON "equipment_usage" USING btree ("project_id","date");
CREATE INDEX IF NOT EXISTS "time_entries_project_idx" ON "time_entries" USING btree ("project_id","date");
CREATE INDEX IF NOT EXISTS "time_entries_worker_idx" ON "time_entries" USING btree ("worker_id","date");
CREATE INDEX IF NOT EXISTS "time_entries_user_status_idx" ON "time_entries" USING btree ("user_id","status");
CREATE INDEX IF NOT EXISTS "invoice_events_invoice_idx" ON "invoice_events" USING btree ("invoice_id","created_at");
CREATE INDEX IF NOT EXISTS "invoice_payments_invoice_idx" ON "invoice_payments" USING btree ("invoice_id","date");
CREATE INDEX IF NOT EXISTS "invoice_payments_user_date_idx" ON "invoice_payments" USING btree ("user_id","date");
CREATE INDEX IF NOT EXISTS "invoices_user_idx" ON "invoices" USING btree ("user_id","issue_date");
CREATE INDEX IF NOT EXISTS "invoices_project_idx" ON "invoices" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "invoices_status_due_idx" ON "invoices" USING btree ("status","due_date");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_user_number_idx" ON "invoices" USING btree ("user_id","number");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_public_token_idx" ON "invoices" USING btree ("public_token_hash");
CREATE INDEX IF NOT EXISTS "invoices_archived_idx" ON "invoices" USING btree ("user_id","archived_at");
CREATE INDEX IF NOT EXISTS "assistant_conversations_user_idx" ON "assistant_conversations" USING btree ("user_id","project_id");
CREATE INDEX IF NOT EXISTS "assistant_messages_conversation_idx" ON "assistant_messages" USING btree ("conversation_id","created_at");
CREATE INDEX IF NOT EXISTS "assistant_proposals_conversation_idx" ON "assistant_proposals" USING btree ("conversation_id","status");
CREATE INDEX IF NOT EXISTS "organization_members_owner_id_idx" ON "organization_members" USING btree ("owner_id");
CREATE INDEX IF NOT EXISTS "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_owner_email_idx" ON "organization_members" USING btree ("owner_id","invited_email");
CREATE UNIQUE INDEX IF NOT EXISTS "usage_daily_summary_user_date_kind_idx" ON "usage_daily_summary" USING btree ("user_id","date","kind");
CREATE INDEX IF NOT EXISTS "usage_daily_summary_date_kind_idx" ON "usage_daily_summary" USING btree ("date","kind");
CREATE INDEX IF NOT EXISTS "usage_events_user_id_idx" ON "usage_events" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "usage_events_user_id_kind_created_at_idx" ON "usage_events" USING btree ("user_id","kind","created_at");
CREATE INDEX IF NOT EXISTS "lead_events_lead_idx" ON "lead_events" USING btree ("lead_id","created_at");
CREATE INDEX IF NOT EXISTS "leads_user_status_idx" ON "leads" USING btree ("user_id","status");
CREATE INDEX IF NOT EXISTS "leads_user_created_idx" ON "leads" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "leads_followup_due_idx" ON "leads" USING btree ("status","next_follow_up_at");
CREATE UNIQUE INDEX IF NOT EXISTS "leads_unsubscribe_token_idx" ON "leads" USING btree ("unsubscribe_token");
CREATE INDEX IF NOT EXISTS "job_photos_project_idx" ON "job_photos" USING btree ("project_id","sort_order");
CREATE INDEX IF NOT EXISTS "quickbooks_sync_log_user_idx" ON "quickbooks_sync_log" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "quickbooks_sync_log_entity_idx" ON "quickbooks_sync_log" USING btree ("entity_type","entity_id","created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_synced_events_milestone_provider_idx" ON "calendar_synced_events" USING btree ("milestone_id","provider");
CREATE INDEX IF NOT EXISTS "calendar_synced_events_user_idx" ON "calendar_synced_events" USING btree ("user_id","updated_at");
CREATE INDEX IF NOT EXISTS "import_batches_user_idx" ON "import_batches" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "quote_import_candidates_batch_idx" ON "quote_import_candidates" USING btree ("batch_id");
CREATE INDEX IF NOT EXISTS "quote_import_candidates_user_status_idx" ON "quote_import_candidates" USING btree ("user_id","status");
CREATE INDEX IF NOT EXISTS "financeit_applications_user_idx" ON "financeit_applications" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "financeit_applications_quote_idx" ON "financeit_applications" USING btree ("quote_id");
CREATE INDEX IF NOT EXISTS "financeit_applications_financeit_id_idx" ON "financeit_applications" USING btree ("financeit_application_id");
CREATE INDEX IF NOT EXISTS "financeit_loan_events_application_idx" ON "financeit_loan_events" USING btree ("application_id","created_at");
CREATE INDEX IF NOT EXISTS "api_keys_user_idx" ON "api_keys" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "api_keys_hash_idx" ON "api_keys" USING btree ("key_hash");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_idx" ON "webhook_deliveries" USING btree ("webhook_id","created_at");
CREATE INDEX IF NOT EXISTS "webhook_endpoints_user_idx" ON "webhook_endpoints" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "wave_sync_log_user_idx" ON "wave_sync_log" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "wave_sync_log_entity_idx" ON "wave_sync_log" USING btree ("entity_type","entity_id","created_at");
CREATE INDEX IF NOT EXISTS "flinks_transactions_user_date_idx" ON "flinks_transactions" USING btree ("user_id","date");
CREATE INDEX IF NOT EXISTS "flinks_transactions_user_status_idx" ON "flinks_transactions" USING btree ("user_id","match_status");
CREATE INDEX IF NOT EXISTS "flinks_transactions_flinks_id_idx" ON "flinks_transactions" USING btree ("user_id","flinks_transaction_id");
CREATE INDEX IF NOT EXISTS "meta_lead_ads_import_log_user_idx" ON "meta_lead_ads_import_log" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "meta_lead_ads_import_log_lead_idx" ON "meta_lead_ads_import_log" USING btree ("meta_lead_id");
CREATE INDEX IF NOT EXISTS "google_lsa_import_log_user_idx" ON "google_lsa_import_log" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "google_lsa_import_log_lead_idx" ON "google_lsa_import_log" USING btree ("google_lsa_lead_id");
CREATE INDEX IF NOT EXISTS "cron_ticks_started_idx" ON "cron_ticks" USING btree ("started_at");
DO $$ BEGIN
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "quotes_followup_due_idx" ON "quotes" USING btree ("status","next_follow_up_at");
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_unsubscribe_token_idx" ON "quotes" USING btree ("unsubscribe_token");
CREATE INDEX IF NOT EXISTS "quotes_archived_idx" ON "quotes" USING btree ("user_id","archived_at");
