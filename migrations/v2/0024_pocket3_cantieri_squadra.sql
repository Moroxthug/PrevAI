-- PrevAI v2 — POCKET-3 Cantieri e squadra, lato server (riga 60, 2026-10-10).
-- Additiva e idempotente, da eseguire dopo la 0023 (non dipende da nient'altro).
--   · collaborators.pairing_code_hash / pairing_code_expires_at — il codice di 6 caratteri che il titolare
--     consegna a un operaio: si scrive sul telefono, vale 7 giorni, funziona una volta (si cancella nello
--     stesso UPDATE che emette il link).
--   · collaborators.replaced_token_hash — il token del link che uno più nuovo ha sostituito, così il vecchio
--     link dice «sostituito» e non «non valido».
--   · crew_locations — l'ultima posizione di chi è in turno e ha scelto di condividerla (una riga per
--     operaio, cancellata all'uscita).
--   · service_calls — chiamate e visite su cantieri conclusi (Assistenza e garanzia).
--   · job_permits — pratiche e sopralluoghi di un cantiere (CILA, SCIA, impianti…).
--   Nessun DROP di dati, nessun RENAME, nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- Finché non viene eseguita il codice nuovo NON gira: le query sugli operai nominano le colonne nuove.
-- Eseguirla prima di pubblicare.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0024_pocket3_cantieri_squadra.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS pairing_code_hash text;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS pairing_code_expires_at timestamptz;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS replaced_token_hash text;
CREATE INDEX IF NOT EXISTS collaborators_pairing_code_idx ON collaborators (pairing_code_hash) WHERE pairing_code_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS collaborators_replaced_token_idx ON collaborators (replaced_token_hash) WHERE replaced_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS crew_locations (
  worker_id uuid PRIMARY KEY,
  user_id text NOT NULL,
  project_id uuid,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_locations_user_idx ON crew_locations (user_id);

CREATE TABLE IF NOT EXISTS service_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue text NOT NULL,
  note text NOT NULL DEFAULT '',
  reported_by text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'phone',
  status text NOT NULL DEFAULT 'open',
  billing text NOT NULL DEFAULT 'warranty',
  amount_cents integer NOT NULL DEFAULT 0,
  visit_starts_at timestamptz,
  visit_ends_at timestamptz,
  worker_id uuid REFERENCES collaborators(id) ON DELETE SET NULL,
  schedule_block_id uuid,
  reported_at timestamptz NOT NULL DEFAULT now(),
  first_visit_at timestamptz,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_calls_user_idx ON service_calls (user_id, status);
CREATE INDEX IF NOT EXISTS service_calls_project_idx ON service_calls (project_id);

CREATE TABLE IF NOT EXISTS job_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  authority text NOT NULL DEFAULT '',
  reference_number text NOT NULL DEFAULT '',
  url text,
  status text NOT NULL DEFAULT 'needed',
  applied_at timestamptz,
  issued_at timestamptz,
  inspection_at timestamptz,
  expires_at timestamptz,
  closed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_permits_project_idx ON job_permits (project_id);
CREATE INDEX IF NOT EXISTS job_permits_user_inspection_idx ON job_permits (user_id, inspection_at);
