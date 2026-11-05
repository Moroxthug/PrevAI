-- PrevAI v2 — PREZZI-2 richieste per il piano Su misura (riga 66, 2026-11-05).
-- Additiva e idempotente, da eseguire dopo la 0027. Nessun DROP, RENAME o cambio di tipo.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0028_contatti_su_misura.sql
--
--   · contatti_su_misura — chi chiede il piano dal modulo pubblico. La riga resta anche se l'email a noi non parte.
CREATE TABLE IF NOT EXISTS contatti_su_misura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  impresa text NOT NULL,
  email text NOT NULL,
  telefono text,
  persone text,
  messaggio text,
  created_at timestamptz NOT NULL DEFAULT now()
);
