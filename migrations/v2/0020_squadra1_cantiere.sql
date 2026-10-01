-- PrevAI v2 — SQUADRA-1 L'app della squadra sul link dell'operaio (riga 52, 2026-09-30).
-- Additiva e idempotente, da eseguire dopo la 0019. Portata da QuoteAI
-- 0046 (fase 86) e 0048 (fase 86b).
--   Nuova tabella:
--   · field_reports — quello che un operaio manda da /t/:token senza account:
--     una foto con una nota, "sono bloccato", i materiali usati. La foto va in
--     job_photos e i materiali in cost_entries (da controllare); questa riga
--     dice chi ha mandato cosa e, per un blocco, se l'ufficio ha risposto.
--   Tabelle esistenti (solo aggiunte, nessun DROP/RENAME/cambio di tipo):
--   · collaborators: can_add_tasks (false di partenza: l'ufficio decide a chi
--     affidare la lista) e crew_seen_at (il segno di "Da quando hai guardato").
--   · project_tasks: chi l'ha aggiunta dal cantiere (created_by_worker_id,
--     created_by_name), l'ultima modifica fatta dal cantiere (field_updated_by,
--     field_updated_at) e client_ref (un doppio invio rende la stessa riga).
--   · audit_log: indice (user_id, entity_type, created_at) per leggere i turni
--     cambiati di un'impresa.
--
-- Il codice nuovo legge queste colonne: va eseguita PRIMA del push.
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0020_squadra1_cantiere.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS field_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  worker_id uuid REFERENCES collaborators(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'blocker', 'materials')),
  body text NOT NULL DEFAULT '',
  photo_id uuid REFERENCES job_photos(id) ON DELETE SET NULL,
  materials_cents integer CHECK (materials_cents IS NULL OR materials_cents >= 0),
  cost_entry_id uuid REFERENCES cost_entries(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by_name text,
  resolution_note text,
  client_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS field_reports_project_idx ON field_reports (project_id, created_at);
CREATE INDEX IF NOT EXISTS field_reports_user_open_idx ON field_reports (user_id, kind, resolved_at);
CREATE UNIQUE INDEX IF NOT EXISTS field_reports_client_ref_idx ON field_reports (worker_id, client_ref) WHERE client_ref IS NOT NULL;

ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS can_add_tasks boolean NOT NULL DEFAULT false;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS crew_seen_at timestamptz;

ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS created_by_worker_id uuid REFERENCES collaborators(id) ON DELETE SET NULL;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS field_updated_by uuid REFERENCES collaborators(id) ON DELETE SET NULL;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS field_updated_at timestamptz;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS client_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS project_tasks_field_client_ref_idx ON project_tasks (created_by_worker_id, client_ref) WHERE client_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_tasks_project_updated_idx ON project_tasks (project_id, updated_at);

CREATE INDEX IF NOT EXISTS audit_log_user_type_created_idx ON audit_log (user_id, entity_type, created_at);
