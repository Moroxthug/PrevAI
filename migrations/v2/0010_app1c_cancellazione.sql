-- PrevAI v2 — APP-1c Cancellazione dell'account in autonomia (2026-09-27).
-- Seconda migrazione dopo il cutover. Additiva e idempotente, da eseguire
-- dopo la 0009.
--   Nuova tabella: account_deletions (una riga per richiesta).
--   Nessuna colonna nuova su tabelle esistenti. Nessun DROP, nessun RENAME,
--   nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- La persona sta in `subject_user_id`, non in `user_id`: la cancellazione
-- spazza ogni tabella con `user_id` e questa riga deve restare come prova.
--
-- Finché non viene eseguita il codice resta inerte: GET /api/account/deletion
-- risponde { available: false }, il pulsante "Elimina account" spiega di
-- scrivere a privacy@prevai.it (il percorso manuale di oggi) e il cron salta.
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0010_app1c_cancellazione.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "account_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_user_id" text NOT NULL,
	"owns_org" boolean DEFAULT false NOT NULL,
	"email" text,
	"email_hash" text NOT NULL,
	"stato" text DEFAULT 'in_attesa' NOT NULL,
	"reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"stripe_subscriptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stripe_customer_id" text,
	"summary" jsonb,
	"retain_until" timestamp with time zone,
	"retention_cleared_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_deletions_subject_idx" ON "account_deletions" USING btree ("subject_user_id");
CREATE INDEX IF NOT EXISTS "account_deletions_stato_idx" ON "account_deletions" USING btree ("stato","scheduled_for");
CREATE UNIQUE INDEX IF NOT EXISTS "account_deletions_one_pending_idx" ON "account_deletions" USING btree ("subject_user_id") WHERE stato = 'in_attesa';
