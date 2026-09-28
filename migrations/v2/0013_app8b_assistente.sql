-- PrevAI v2 — APP-8b Assistente: permessi "fa / chiede / mai" e una
-- conversazione per persona (2026-09-27). Quinta migrazione dopo il cutover.
-- Additiva e idempotente, da eseguire dopo la 0012.
--   Nuove tabelle:
--     assistant_conversation_actors — di chi è una conversazione (nessuna riga = del titolare:
--                                     tutte quelle di prima restano sue);
--     assistant_permissions         — le scelte del titolare in Impostazioni → Assistente
--                                     (role '' = tutta l'impresa, altrimenti solo quel ruolo);
--     assistant_actions             — ogni azione eseguita dall'assistente: chi, a che livello
--                                     ('auto' = Lo fa, 'ask' = confermata), se è stata annullata.
--   Nessuna colonna nuova su tabelle esistenti (apposta: ogni select sulle tabelle
--   dell'assistente la chiederebbe e fallirebbe prima della migrazione). Nessun DROP,
--   nessun RENAME, nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--   Lo stato "undone" delle proposte NON richiede migrazione: assistant_proposals.status è text.
--
-- Finché non viene eseguita il codice resta inerte: una conversazione per impresa come
-- prima, ogni azione chiede conferma, Impostazioni → Assistente dice che si attiva con
-- il prossimo aggiornamento. Il controllo del ruolo vale comunque (non usa tabelle).
--
-- La cancellazione dell'account le spazza da sola (hanno `user_id`).
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0013_app8b_assistente.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "assistant_conversation_actors" (
	"conversation_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assistant_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"level" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assistant_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"proposal_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"level" text NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone
);

DO $$ BEGIN
  ALTER TABLE "assistant_conversation_actors" ADD CONSTRAINT "assistant_conversation_actors_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_proposal_id_assistant_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."assistant_proposals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "assistant_conversation_actors_actor_idx" ON "assistant_conversation_actors" USING btree ("user_id","actor_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_permissions_user_action_role_idx" ON "assistant_permissions" USING btree ("user_id","action","role");
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_actions_proposal_idx" ON "assistant_actions" USING btree ("proposal_id");
CREATE INDEX IF NOT EXISTS "assistant_actions_user_idx" ON "assistant_actions" USING btree ("user_id","executed_at");
