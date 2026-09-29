-- PrevAI v2 — GDPR-1 "Scarica i tuoi dati" in autonomia (art. 20 GDPR, 2026-09-28).
-- Additiva e idempotente, da eseguire dopo la 0016 (non dipende da nessuna).
--   Nuova tabella: account_exports (una riga per richiesta di esportazione:
--   stato, parti dello ZIP già caricate, file ancora da impacchettare,
--   scadenza). Nessuna colonna nuova su tabelle esistenti. Nessun DROP,
--   nessun RENAME, nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- Finché non viene eseguita la scheda "Scarica i tuoi dati" rimanda a
-- privacy@prevai.it (il percorso di oggi), POST risponde 503 e il cron salta.
-- Il server se ne accorge entro un minuto.
--
-- Non contiene segreti: gli ZIP stanno nel bucket privato sotto
-- account-exports/<user_id>/<id>/ e si scaricano solo da dentro l'app con un
-- link firmato di 5 minuti. Ha `user_id`: la cancellazione dell'account la
-- spazza da sola (e con lei la cartella account-exports).
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0017_gdpr1_esportazione.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "account_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"email" text NOT NULL,
	"stato" text DEFAULT 'in_preparazione' NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending_files" jsonb,
	"skipped_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"table_count" integer,
	"row_count" integer,
	"file_count" integer,
	"total_bytes" bigint,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"locked_until" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_exports_user_idx" ON "account_exports" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "account_exports_stato_idx" ON "account_exports" USING btree ("stato");
