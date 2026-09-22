-- PrevAI v2 — A-3 Scadenzario, F24 precompilati e promemoria (2026-09-22).
-- Additiva e idempotente, da eseguire DOPO la 0004.
--   Nuova tabella: fiscal_deadlines (stato delle scadenze: versata, quietanza, promemoria inviati).
--   Colonne nuove su tabelle di A-2: tax_profiles (matricola/sede INPS + preferenze promemoria),
--   fiscal_payments.scadenza_chiave (lega il versamento alla scadenza che chiude).
--   Nessun DROP, nessun RENAME, nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- Le scadenze **non** stanno in questa tabella: si ricalcolano a ogni lettura dal motore
-- fiscale e dal bollo trimestrale. Qui c'è solo ciò che il calcolo non può sapere.
-- La tabella nasce vuota e si popola da sola alla prima apertura dello scadenzario.
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0005_a3_scadenzario.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

ALTER TABLE "tax_profiles" ADD COLUMN IF NOT EXISTS "matricola_inps" text DEFAULT '' NOT NULL;
ALTER TABLE "tax_profiles" ADD COLUMN IF NOT EXISTS "sede_inps" text DEFAULT '' NOT NULL;
ALTER TABLE "tax_profiles" ADD COLUMN IF NOT EXISTS "promemoria_email" boolean DEFAULT true NOT NULL;
ALTER TABLE "tax_profiles" ADD COLUMN IF NOT EXISTS "promemoria_whatsapp" boolean DEFAULT false NOT NULL;
ALTER TABLE "tax_profiles" ADD COLUMN IF NOT EXISTS "promemoria_telefono" text DEFAULT '' NOT NULL;
ALTER TABLE "tax_profiles" ADD COLUMN IF NOT EXISTS "promemoria_giorni" jsonb DEFAULT '[15,3]'::jsonb NOT NULL;

ALTER TABLE "fiscal_payments" ADD COLUMN IF NOT EXISTS "scadenza_chiave" text DEFAULT '' NOT NULL;

CREATE TABLE IF NOT EXISTS "fiscal_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"anno" integer NOT NULL,
	"chiave" text NOT NULL,
	"etichetta" text DEFAULT '' NOT NULL,
	"data" timestamp with time zone NOT NULL,
	"importo_cents" integer DEFAULT 0 NOT NULL,
	"categoria" text DEFAULT 'imposta' NOT NULL,
	"stato" text DEFAULT 'aperta' NOT NULL,
	"versata_at" timestamp with time zone,
	"quietanza_url" text DEFAULT '' NOT NULL,
	"quietanza_nome" text DEFAULT '' NOT NULL,
	"quietanza_caricata_at" timestamp with time zone,
	"promemoria_inviati" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Una riga per impresa, anno d'imposta e chiave: è l'indice che rende
-- idempotente la riconciliazione a ogni lettura.
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_deadlines_chiave_idx" ON "fiscal_deadlines" USING btree ("user_id","anno","chiave");
CREATE INDEX IF NOT EXISTS "fiscal_deadlines_data_idx" ON "fiscal_deadlines" USING btree ("user_id","data");
CREATE INDEX IF NOT EXISTS "fiscal_deadlines_stato_idx" ON "fiscal_deadlines" USING btree ("stato","data");
