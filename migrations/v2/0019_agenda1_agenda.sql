-- PrevAI v2 — AGENDA-1 Agenda dei lavori (riga 51, 2026-09-28).
-- Additiva e idempotente, da eseguire dopo la 0018. Portata da QuoteAI
-- 0040 (fase 75) e 0045 (fase 85).
--   Nuove tabelle:
--   · schedule_blocks — "questo operaio è su questo cantiere martedì dalle 7:30
--     alle 16:30": il piano della squadra, più fine delle fasi del cantiere.
--   · calendar_feeds — i calendari .ics a cui l'impresa si abbona (Calendly,
--     Apple, Google condiviso…): solo lettura.
--   · calendar_external_events — la copia locale, in sola lettura, di quello
--     che dicono i calendari collegati e i file .ics.
--   · calendar_publish_tokens — un link privato per impresa che serve la sua
--     agenda come .ics (solo l'hash SHA-256 del token).
--   Tabelle esistenti (solo aggiunte, nessun DROP/RENAME/cambio di tipo):
--   · calendar_connections: colonna last_inbound_sync_at (nullable).
--   · calendar_synced_events: milestone_id perde il NOT NULL (una riga ora è
--     di una fase OPPURE di un blocco) e arriva schedule_block_id.
--     Il codice in produzione prima di questa migrazione scrive sempre
--     milestone_id: resta compatibile.
--
-- Il codice nuovo legge queste colonne: va eseguita PRIMA del push.
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0019_agenda1_agenda.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS (o innocuo se ripetuto).


CREATE TABLE IF NOT EXISTS schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  collaborator_id uuid REFERENCES collaborators(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  reminder_sent_at timestamptz,
  created_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedule_blocks_user_start_idx ON schedule_blocks (user_id, starts_at);
CREATE INDEX IF NOT EXISTS schedule_blocks_worker_start_idx ON schedule_blocks (collaborator_id, starts_at);
CREATE INDEX IF NOT EXISTS schedule_blocks_project_idx ON schedule_blocks (project_id);

ALTER TABLE calendar_synced_events ALTER COLUMN milestone_id DROP NOT NULL;
ALTER TABLE calendar_synced_events ADD COLUMN IF NOT EXISTS schedule_block_id uuid REFERENCES schedule_blocks(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS calendar_synced_events_block_provider_idx ON calendar_synced_events (schedule_block_id, provider);


ALTER TABLE "calendar_connections"
  ADD COLUMN IF NOT EXISTS "last_inbound_sync_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "calendar_feeds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "auth_user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "last_fetched_at" timestamp with time zone,
  "last_status" text,
  "last_error" text,
  "event_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "calendar_feeds_user_idx" ON "calendar_feeds" ("user_id");

CREATE TABLE IF NOT EXISTS "calendar_external_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "source" text NOT NULL,
  "feed_id" uuid REFERENCES "calendar_feeds"("id") ON DELETE CASCADE,
  "external_id" text NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "location" text DEFAULT '' NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "all_day" boolean DEFAULT false NOT NULL,
  "busy" boolean DEFAULT true NOT NULL,
  "html_link" text,
  "is_ours" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_external_events_identity_idx"
  ON "calendar_external_events" ("user_id", "source", "external_id");
CREATE INDEX IF NOT EXISTS "calendar_external_events_window_idx"
  ON "calendar_external_events" ("user_id", "starts_at");

CREATE TABLE IF NOT EXISTS "calendar_publish_tokens" (
  "user_id" text PRIMARY KEY REFERENCES "auth_user"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "hint" text DEFAULT '' NOT NULL,
  "last_accessed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_publish_tokens_hash_idx"
  ON "calendar_publish_tokens" ("token_hash");
