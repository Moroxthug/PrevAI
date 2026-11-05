-- PrevAI v2 — PREZZI-2 crediti dei preventivi (riga 66, 2026-11-05).
-- Additiva e idempotente, da eseguire dopo la 0026. Nessun DROP, RENAME o cambio di tipo.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0027_prezzi2_crediti_preventivi.sql
--
--   · business_profiles.preventivi_crediti — i preventivi comprati col pacchetto e non ancora usati.
--   · preventivi_crediti_acquisti — una riga per sessione Stripe: un webhook ripetuto non accredita due volte.
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS preventivi_crediti integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS preventivi_crediti_acquisti (
  stripe_session_id text PRIMARY KEY,
  user_id text NOT NULL,
  crediti integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS preventivi_crediti_acquisti_user_idx ON preventivi_crediti_acquisti (user_id);
