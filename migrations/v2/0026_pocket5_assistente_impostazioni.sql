-- PrevAI v2 — POCKET-5 Assistente, impostazioni, account, lato server (riga 62, 2026-10-20).
-- Additiva e idempotente, da eseguire dopo la 0025. Nessun DROP, RENAME o cambio di tipo.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0026_pocket5_assistente_impostazioni.sql

--   · assistant_suggestions, assistant_activity, assistant_settings — l'assistente d'impresa dell'app (QuoteAI 128.1):
--     le proposte per un sì (promemoria, solleciti, ordini), ciò che ha fatto (con Annulla) e quanto può fare da solo.
--     Non toccano assistant_proposals / assistant_actions / assistant_permissions dell'assistente dei cantieri.
CREATE TABLE IF NOT EXISTS assistant_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  key text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  decided_by text,
  decided_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS assistant_suggestions_key_idx ON assistant_suggestions (user_id, key);
CREATE INDEX IF NOT EXISTS assistant_suggestions_status_idx ON assistant_suggestions (user_id, status);

CREATE TABLE IF NOT EXISTS assistant_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  who text NOT NULL DEFAULT '',
  who_kind text NOT NULL DEFAULT 'auto',
  category text NOT NULL DEFAULT 'jobs',
  undo text NOT NULL DEFAULT 'none',
  undo_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  word text NOT NULL DEFAULT '',
  entity_type text,
  entity_id text,
  undone_at timestamptz
);
CREATE INDEX IF NOT EXISTS assistant_activity_user_idx ON assistant_activity (user_id, at);

CREATE TABLE IF NOT EXISTS assistant_settings (
  user_id text PRIMARY KEY,
  levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  spend_limit_cents integer NOT NULL DEFAULT 30000,
  quiet_hours text NOT NULL DEFAULT 'on',
  quiet_from integer NOT NULL DEFAULT 1200,
  quiet_until integer NOT NULL DEFAULT 420,
  quiet_sunday text NOT NULL DEFAULT 'on',
  read_back text NOT NULL DEFAULT 'on',
  updated_at timestamptz NOT NULL DEFAULT now()
);

--   · business_profiles — Dati dell'impresa e pagine delle Impostazioni dell'app (QuoteAI 128.3): ragione sociale,
--     sito, colore dei documenti e le scelte per pagina (pocket_settings).
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS brand_color text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS pocket_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

--   · member_preferences — le scelte di una persona nell'app (voce, Profilo, la sua Home), per impresa e persona.
CREATE TABLE IF NOT EXISTS member_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  member_user_id text NOT NULL,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS member_preferences_member_idx ON member_preferences (user_id, member_user_id);

--   · app_feedback — «Invia un parere» dal telefono (QuoteAI 128.6) usa la tabella delle segnalazioni della beta (0009, APP-5)
--     e il suo pannello per lo staff; qui solo le colonne in più (tipo, risposta, dati tecnici, telefono, schermata e segni).
ALTER TABLE IF EXISTS app_feedback ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE IF EXISTS app_feedback ADD COLUMN IF NOT EXISTS reply_ok boolean;
ALTER TABLE IF EXISTS app_feedback ADD COLUMN IF NOT EXISTS include_logs boolean;
ALTER TABLE IF EXISTS app_feedback ADD COLUMN IF NOT EXISTS device text;
ALTER TABLE IF EXISTS app_feedback ADD COLUMN IF NOT EXISTS screenshot_path text;
ALTER TABLE IF EXISTS app_feedback ADD COLUMN IF NOT EXISTS markup jsonb;

--   · member_job_roles — il mestiere di ogni persona e gli accessi delicati (QuoteAI 128.7).
CREATE TABLE IF NOT EXISTS member_job_roles (
  org_id text NOT NULL,
  member_user_id text NOT NULL,
  job_role text NOT NULL,
  sensitive jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, member_user_id)
);
