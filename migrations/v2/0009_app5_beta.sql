-- PrevAI v2 — APP-5 Beta con le imprese pilota: eventi d'uso minimi e
-- "Segnala un problema" (2026-09-27). Prima migrazione DOPO il cutover.
-- Additiva e idempotente, da eseguire dopo la 0008.
--   Nuove tabelle: app_events, app_feedback.
--   Nessuna colonna nuova su tabelle esistenti. Nessun DROP, nessun RENAME,
--   nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- Finché non viene eseguita il codice resta inerte: POST /api/app/events
-- risponde 204 senza scrivere, "Segnala un problema" risponde 503 e il
-- pannello admin "Beta app" dice che la migrazione manca.
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0009_app5_beta.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "app_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"surface" text NOT NULL,
	"viewport" text DEFAULT 'desktop' NOT NULL,
	"app_version" text,
	"entity_id" text,
	"channel" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "app_events_user_created_idx" ON "app_events" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "app_events_created_idx" ON "app_events" USING btree ("created_at");

CREATE TABLE IF NOT EXISTS "app_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_email" text DEFAULT '' NOT NULL,
	"message" text NOT NULL,
	"route" text DEFAULT '' NOT NULL,
	"surface" text NOT NULL,
	"viewport" text DEFAULT 'desktop' NOT NULL,
	"app_version" text,
	"user_agent" text DEFAULT '' NOT NULL,
	"stato" text DEFAULT 'nuovo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "app_feedback_created_idx" ON "app_feedback" USING btree ("created_at");
