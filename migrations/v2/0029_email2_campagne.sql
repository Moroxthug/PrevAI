-- PrevAI v2 — EMAIL-2 campagne email agli utenti PrevAI (riga 68, 2026-11-11).
-- Additiva e idempotente, da eseguire dopo la 0028. Nessun DROP, RENAME o cambio di tipo.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0029_email2_campagne.sql
--
--   · marketing_preferences — una riga per utente che ha ricevuto (o rifiutato) una campagna:
--     il token del link "annulla l'iscrizione" e quando l'ha usato. Nessuna riga = iscritto
--     (soft spam, art. 130 c.4 Codice Privacy: servizi analoghi + opt-out in ogni messaggio).
--   · email_campaigns — la campagna (contenuto a blocchi in jsonb, pubblico, stato, contatori).
--   · email_campaign_recipients — la fotografia dei destinatari al momento dell'invio:
--     ogni riga parte una volta sola, così l'invio a lotti si può riprendere senza doppioni.
CREATE TABLE IF NOT EXISTS marketing_preferences (
  user_id text PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  unsubscribe_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  unsubscribed_at timestamptz,
  unsubscribe_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_preferences_token_idx ON marketing_preferences (unsubscribe_token);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  content jsonb NOT NULL,
  audience text NOT NULL,
  status text NOT NULL DEFAULT 'bozza',
  created_by text,
  test_sent_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  recipients_total integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON email_campaigns (status);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  email text NOT NULL,
  first_name text,
  status text NOT NULL DEFAULT 'in_coda',
  resend_id text,
  error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_campaign_recipients_uniq ON email_campaign_recipients (campaign_id, user_id);
CREATE INDEX IF NOT EXISTS email_campaign_recipients_queue_idx ON email_campaign_recipients (campaign_id, status);
