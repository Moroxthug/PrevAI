-- PrevAI v2 — APP-2 PWA installabile e notifiche push sul telefono (2026-09-28).
-- Additiva e idempotente, da eseguire dopo la 0013.
--   Nuove tabelle: push_subscriptions (un browser o una PWA installata che
--   ha acceso le notifiche) e push_preferences (i tipi che una persona ha
--   spento). Nessuna colonna nuova su tabelle esistenti. Nessun DROP, nessun
--   RENAME, nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- Finché non viene eseguita il codice resta inerte: GET /api/push/config
-- risponde { ready: false } e Impostazioni → Notifiche sul telefono dice che
-- si attivano con il prossimo aggiornamento; la campanella funziona come oggi.
-- Il server se ne accorge entro un minuto.
--
-- La cancellazione dell'account le spazza da sola (hanno `user_id`); le righe
-- di una persona dentro imprese altrui vanno via con member_user_id.
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0014_app2_push.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"member_user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"last_used_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");

CREATE TABLE IF NOT EXISTS "push_preferences" (
	"user_id" text NOT NULL,
	"member_user_id" text NOT NULL,
	"muted" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_preferences_user_id_member_user_id_pk" PRIMARY KEY("user_id","member_user_id")
);
