-- PrevAI v2 — SEC-2 limiti di velocità condivisi e tetto mensile ai costi IA (2026-09-28).
-- Additiva e idempotente, da eseguire dopo la 0014 (o anche prima: non dipende da nessuna).
--   Nuove tabelle: rate_limit_counters (un contatore per limite e per chi,
--   condiviso fra tutte le istanze di Vercel) e ai_budgets (tetto mensile IA
--   diverso da quello del piano, per una singola impresa, deciso dallo staff).
--   Nessuna colonna nuova su tabelle esistenti. Nessun DROP, nessun RENAME,
--   nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- Finché non viene eseguita i limiti restano quelli di oggi (in memoria, per
-- istanza) e il tetto IA usa solo quello del piano. Il server se ne accorge
-- entro un minuto.
--
-- ai_budgets ha `user_id`: la cancellazione dell'account la spazza da sola.
-- rate_limit_counters non contiene dati personali leggibili (chiavi con id e
-- IP, che scadono con la finestra e vengono cancellate dal contatore stesso).
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0015_sec2_limiti.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "rate_limit_counters_reset_at_idx" ON "rate_limit_counters" USING btree ("reset_at");

CREATE TABLE IF NOT EXISTS "ai_budgets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"monthly_cap_eur_cents" integer,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
