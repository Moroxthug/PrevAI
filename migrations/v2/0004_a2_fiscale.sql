-- PrevAI v2 — A-2 Motore fiscale forfettario (2026-09-22). Additiva e idempotente, da eseguire DOPO la 0003.
--   Nuove tabelle: tax_profiles (profilo fiscale dichiarato dall'impresa), fiscal_payments (versamenti).
--   Nessuna colonna nuova su tabelle esistenti, nessun DROP, nessun RENAME (PREVAI-V2-PLAN.md §1).
-- Gli incassi non si copiano qui: restano in invoice_payments, dove già sono.
-- Le due tabelle nascono vuote: nessuna impresa ha un profilo fiscale finché non compila l'onboarding.
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0004_a2_fiscale.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "tax_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"regime" text DEFAULT 'forfettario' NOT NULL,
	"codice_ateco" text DEFAULT '' NOT NULL,
	"coefficiente_percent" integer DEFAULT 0 NOT NULL,
	"gestione" text DEFAULT 'artigiani' NOT NULL,
	"riduzione" text DEFAULT 'nessuna' NOT NULL,
	"anno_inizio_attivita" integer,
	"requisiti_startup" boolean DEFAULT false NOT NULL,
	"ricavi_anno_precedente_cents" integer DEFAULT 0 NOT NULL,
	"spese_lavoro_cents" integer DEFAULT 0 NOT NULL,
	"reddito_dipendente_cents" integer DEFAULT 0 NOT NULL,
	"imposta_anno_precedente_cents" integer DEFAULT 0 NOT NULL,
	"margine_sicurezza_percent" integer DEFAULT 10 NOT NULL,
	"onboarding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completato_at" timestamp with time zone,
	"avviso_accettato_at" timestamp with time zone,
	"avviso_versione" text DEFAULT '' NOT NULL,
	"soglia_livello_notificato" text,
	"soglia_notificata_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fiscal_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"anno" integer NOT NULL,
	"tipo" text NOT NULL,
	"data" timestamp with time zone DEFAULT now() NOT NULL,
	"importo_cents" integer DEFAULT 0 NOT NULL,
	"codice_tributo" text DEFAULT '' NOT NULL,
	"riferimento" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"origine" text DEFAULT 'manuale' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fiscal_payments_user_anno_idx" ON "fiscal_payments" USING btree ("user_id","anno","data");
CREATE INDEX IF NOT EXISTS "fiscal_payments_tipo_idx" ON "fiscal_payments" USING btree ("user_id","tipo");
