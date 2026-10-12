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
