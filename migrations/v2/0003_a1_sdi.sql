-- PrevAI v2 — A-1 Fatture SDI (2026-09-22). Additiva e idempotente, da eseguire DOPO la 0002.
--   Nuove tabelle: sdi_settings, e_invoices, e_invoice_events, supplier_e_invoices, bollo_periods.
--   Nuove colonne: business_profiles.city/cap (sede scomposta per la FatturaPA) e su clients
--   codice_fiscale, codice_sdi, pec, cig, cup (dati che la FatturaPA
--   pretende sul cessionario/committente; nessuna di esse è obbligatoria per il codice v1).
-- Nessun DROP, nessun RENAME, nessun SET NOT NULL su colonne esistenti (PREVAI-V2-PLAN.md §1).
-- Le credenziali dell'intermediario in sdi_settings sono cifrate dall'applicazione (`enc1:`, A-0):
--   la colonna è text e la migrazione non le tocca.
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0003_a1_sdi.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS / guardato da duplicate_object.

ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "cap" text;

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "codice_fiscale" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "codice_sdi" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "pec" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cig" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "cup" text;

CREATE TABLE IF NOT EXISTS "sdi_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'simulato' NOT NULL,
	"stato" text DEFAULT 'non_configurato' NOT NULL,
	"regime_fiscale" text DEFAULT 'RF19' NOT NULL,
	"codice_destinatario_ricezione" text,
	"pec_ricezione" text,
	"provider_account_id" text,
	"provider_api_key" text,
	"webhook_secret" text,
	"ambiente" text DEFAULT 'sandbox' NOT NULL,
	"ciclo_passivo_attivo" boolean DEFAULT false NOT NULL,
	"ciclo_passivo_attivato_at" timestamp with time zone,
	"delega_firmata_at" timestamp with time zone,
	"delega_riferimento" text,
	"conservazione_attiva" boolean DEFAULT true NOT NULL,
	"onboarding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ultimo_errore" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "e_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"tipo_documento" text DEFAULT 'TD01' NOT NULL,
	"formato_trasmissione" text DEFAULT 'FPR12' NOT NULL,
	"progressivo_invio" text NOT NULL,
	"file_name" text NOT NULL,
	"xml_path" text,
	"xml_hash" text,
	"xml_bytes" integer DEFAULT 0 NOT NULL,
	"stato" text DEFAULT 'bozza' NOT NULL,
	"codice_destinatario" text,
	"pec_destinatario" text,
	"identificativo_sdi" text,
	"provider_document_id" text,
	"provider" text DEFAULT 'simulato' NOT NULL,
	"ambiente" text DEFAULT 'sandbox' NOT NULL,
	"bollo_virtuale" boolean DEFAULT false NOT NULL,
	"bollo_cents" integer DEFAULT 0 NOT NULL,
	"totale_cents" integer DEFAULT 0 NOT NULL,
	"errore_codice" text,
	"errore_messaggio" text,
	"rinviata_in_id" uuid,
	"conservazione" text DEFAULT 'non_richiesta' NOT NULL,
	"conservazione_at" timestamp with time zone,
	"conservazione_riferimento" text,
	"inviata_at" timestamp with time zone,
	"consegnata_at" timestamp with time zone,
	"ultimo_evento_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "e_invoice_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"e_invoice_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"tipo" text NOT NULL,
	"stato_dopo" text,
	"messaggio" text DEFAULT '' NOT NULL,
	"provider_event_id" text,
	"payload" jsonb,
	"ricevuto_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "supplier_e_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'simulato' NOT NULL,
	"provider_document_id" text NOT NULL,
	"file_name" text DEFAULT '' NOT NULL,
	"xml_path" text,
	"xml_hash" text,
	"fornitore_nome" text DEFAULT '' NOT NULL,
	"fornitore_partita_iva" text,
	"fornitore_codice_fiscale" text,
	"supplier_id" uuid,
	"numero" text DEFAULT '' NOT NULL,
	"data" timestamp with time zone,
	"tipo_documento" text DEFAULT 'TD01' NOT NULL,
	"imponibile_cents" integer DEFAULT 0 NOT NULL,
	"iva_cents" integer DEFAULT 0 NOT NULL,
	"totale_cents" integer DEFAULT 0 NOT NULL,
	"valuta" text DEFAULT 'EUR' NOT NULL,
	"righe" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stato" text DEFAULT 'nuova' NOT NULL,
	"cost_entry_id" uuid,
	"project_id" uuid,
	"ricevuta_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bollo_periods" (
	"user_id" text NOT NULL,
	"anno" integer NOT NULL,
	"trimestre" integer NOT NULL,
	"documenti" integer DEFAULT 0 NOT NULL,
	"importo_cents" integer DEFAULT 0 NOT NULL,
	"stato" text DEFAULT 'aperto' NOT NULL,
	"codice_tributo" text DEFAULT '' NOT NULL,
	"scadenza" timestamp with time zone,
	"versato_at" timestamp with time zone,
	"riferimento_versamento" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bollo_periods_user_id_anno_trimestre_pk" PRIMARY KEY("user_id","anno","trimestre")
);

DO $$ BEGIN
  ALTER TABLE "e_invoices" ADD CONSTRAINT "e_invoices_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "e_invoice_events" ADD CONSTRAINT "e_invoice_events_e_invoice_id_e_invoices_id_fk" FOREIGN KEY ("e_invoice_id") REFERENCES "public"."e_invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "supplier_e_invoices" ADD CONSTRAINT "supplier_e_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "supplier_e_invoices" ADD CONSTRAINT "supplier_e_invoices_cost_entry_id_cost_entries_id_fk" FOREIGN KEY ("cost_entry_id") REFERENCES "public"."cost_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "supplier_e_invoices" ADD CONSTRAINT "supplier_e_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "e_invoices_user_idx" ON "e_invoices" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "e_invoices_invoice_idx" ON "e_invoices" USING btree ("invoice_id");
CREATE INDEX IF NOT EXISTS "e_invoices_stato_idx" ON "e_invoices" USING btree ("user_id","stato");
CREATE UNIQUE INDEX IF NOT EXISTS "e_invoices_progressivo_idx" ON "e_invoices" USING btree ("user_id","progressivo_invio");
CREATE UNIQUE INDEX IF NOT EXISTS "e_invoices_provider_doc_idx" ON "e_invoices" USING btree ("provider","provider_document_id");
CREATE INDEX IF NOT EXISTS "e_invoice_events_doc_idx" ON "e_invoice_events" USING btree ("e_invoice_id","ricevuto_at");
CREATE UNIQUE INDEX IF NOT EXISTS "e_invoice_events_provider_idx" ON "e_invoice_events" USING btree ("e_invoice_id","provider_event_id");
CREATE INDEX IF NOT EXISTS "supplier_e_invoices_user_idx" ON "supplier_e_invoices" USING btree ("user_id","ricevuta_at");
CREATE INDEX IF NOT EXISTS "supplier_e_invoices_stato_idx" ON "supplier_e_invoices" USING btree ("user_id","stato");
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_e_invoices_provider_doc_idx" ON "supplier_e_invoices" USING btree ("user_id","provider","provider_document_id");
