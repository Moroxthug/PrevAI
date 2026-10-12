-- PrevAI v2 — POCKET-4 Soldi e ufficio, lato server (riga 61, 2026-10-11).
-- Additiva e idempotente, da eseguire dopo la 0024. Nessun DROP, RENAME o cambio di tipo.
--   · month_closes — la chiusura del mese di Libri (QuoteAI 127.1): chi, quando, la fotografia dei conti aperti.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0025_pocket4_soldi_ufficio.sql

CREATE TABLE IF NOT EXISTS month_closes (
  user_id text NOT NULL,
  month text NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by_name text,
  note text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, month)
);

--   · pay_settings, pay_exports — «Ore e costo del lavoro» (QuoteAI 127.2 Pay): le regole per impresa e il registro delle esportazioni.
CREATE TABLE IF NOT EXISTS pay_settings (
  user_id text PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pay_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  period_start text NOT NULL,
  format text NOT NULL DEFAULT 'generic',
  exported_at timestamptz NOT NULL DEFAULT now(),
  exported_by_name text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS pay_exports_user_period_idx ON pay_exports (user_id, period_start);

--   · compliance_reminders — i promemoria dell'impresa nel calendario delle scadenze (QuoteAI 127.4 Compliance).
CREATE TABLE IF NOT EXISTS compliance_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  preset text,
  title text NOT NULL,
  authority text NOT NULL DEFAULT '',
  due_date text NOT NULL,
  recurrence text NOT NULL DEFAULT 'none',
  remind_days_before integer NOT NULL DEFAULT 30,
  notes text NOT NULL DEFAULT '',
  last_done_at timestamptz,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compliance_reminders_user_idx ON compliance_reminders (user_id, due_date);

--   · accountant_comments — i commenti del contabile sui conti di un mese (QuoteAI 127.3 AccountantView).
CREATE TABLE IF NOT EXISTS accountant_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  month text NOT NULL,
  author_user_id text NOT NULL,
  author_name text NOT NULL DEFAULT '',
  author_role text NOT NULL DEFAULT '',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accountant_comments_user_month_idx ON accountant_comments (user_id, month, created_at);
