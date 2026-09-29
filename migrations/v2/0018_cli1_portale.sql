-- PrevAI v2 — CLI-1 Portale del cliente (riga 50, 2026-09-28).
-- Additiva e idempotente, da eseguire dopo la 0017 (non dipende da nessuna).
--   Nuove tabelle:
--   · client_portals — una riga per cliente che ha un portale: hash del link,
--     codice di accesso via email (hash, scadenza, tentativi), quando è stato
--     invitato e quando l'ha aperto l'ultima volta. Tabella a parte e non
--     colonne su `clients`: il codice di oggi non la legge, quindi il deploy
--     non dipende dall'ordine con la migrazione.
--   · client_portal_sessions — le sessioni del cliente dopo il codice (30
--     giorni, solo l'hash del token, revocabili).
--   · client_messages — i messaggi tra impresa e cliente (uno scambio per
--     cliente, eventualmente riferito a un cantiere).
--   Nessuna colonna nuova su tabelle esistenti. Nessun DROP, nessun RENAME,
--   nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- Finché non viene eseguita, la scheda Messaggi e il portale rispondono 503
-- e le pagine /i, /sign e /p non mostrano il riquadro "Vedi tutto".
--
-- Non contiene segreti: link e sessioni sono salvati solo come SHA-256. Tutte
-- e tre hanno `user_id` (l'impresa): la cancellazione dell'account le spazza
-- da sola; l'esportazione GDPR include portali e messaggi, non le sessioni.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0018_cli1_portale.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "client_portals" (
	"client_id" uuid PRIMARY KEY NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"otp_hash" text,
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0 NOT NULL,
	"invited_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "client_portals_token_idx" ON "client_portals" ("token_hash");
CREATE INDEX IF NOT EXISTS "client_portals_user_idx" ON "client_portals" ("user_id");

CREATE TABLE IF NOT EXISTS "client_portal_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "client_portal_sessions_token_idx" ON "client_portal_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "client_portal_sessions_client_idx" ON "client_portal_sessions" ("client_id");

CREATE TABLE IF NOT EXISTS "client_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
	"project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
	"sender" text NOT NULL CHECK ("sender" IN ('contractor', 'client')),
	"sender_name" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "client_messages_client_idx" ON "client_messages" ("client_id", "created_at");
CREATE INDEX IF NOT EXISTS "client_messages_unread_idx" ON "client_messages" ("user_id", "sender", "read_at");
CREATE INDEX IF NOT EXISTS "client_messages_project_idx" ON "client_messages" ("project_id");
