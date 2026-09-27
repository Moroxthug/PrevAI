-- PrevAI v2 — A-5 Add-on Amministrazione in abbonamento, test di prezzo (2026-09-23).
-- Additiva e idempotente, da eseguire DOPO la 0006.
--   Nuova colonna: business_profiles.addons (jsonb, default '{}').
--   Nuova tabella: addon_events (eventi del test di prezzo).
--   Nessun DROP, nessun RENAME, nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- La colonna nasce vuota per tutti: nessuno ha l'add-on finché non passa dal
-- checkout Stripe (offerta in stato "vendita") o da ops:addon-beta. Il codice
-- v1 non la legge e non la scrive.
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0007_a5_addon.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "addons" jsonb DEFAULT '{}'::jsonb NOT NULL;

CREATE TABLE IF NOT EXISTS "addon_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"addon" text NOT NULL,
	"variante" text NOT NULL,
	"tipo" text NOT NULL,
	"intervallo" text,
	"importo_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "addon_events_user_idx" ON "addon_events" USING btree ("user_id","addon","tipo");
CREATE INDEX IF NOT EXISTS "addon_events_variante_idx" ON "addon_events" USING btree ("addon","variante","tipo");
