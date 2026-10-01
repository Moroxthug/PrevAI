-- PrevAI v2 — SYNC-1 Dati sul telefono senza rete (riga 54, 2026-10-01).
-- Additiva e idempotente, da eseguire dopo la 0020 (non dipende da nessuna).
--   Nuove tabelle:
--   · idempotency_keys — una riga per ogni `Idempotency-Key` ricevuta da una
--     scrittura (POST/PUT/PATCH/DELETE). La prima richiesta prenota la chiave;
--     quando finisce con uno stato sotto 500 ne salva la risposta, e un
--     secondo invio con la stessa chiave (la coda del telefono che ripete dopo
--     una caduta di rete) riceve la stessa risposta invece di fare il lavoro
--     due volte. Ripulita dopo 7 giorni dal cron.
--   · change_log — il feed delle modifiche per impresa, scritto da un
--     trigger sulle tabelle che l'app mostra. Contiene solo id, mai contenuti:
--     GET /api/changes dice a ogni app aperta cosa riscaricare. Ripulito dopo
--     2 giorni dal cron.
--   Nessuna colonna nuova su tabelle esistenti. Nessun DROP di dati, nessun
--   RENAME, nessun cambio di tipo (PREVAI-V2-PLAN.md §1). I trigger sono
--   AFTER e inghiottono ogni errore: non possono bloccare né far fallire una
--   scrittura.
--
-- Finché non viene eseguita il codice nuovo non si rompe: le chiavi di
-- idempotenza si saltano (la richiesta gira come prima) e /api/changes
-- risponde 503 (l'app torna ad aggiornarsi al ritorno in primo piano).
--
-- Le due tabelle sono solo del server (RLS attiva, nessuna policy), come le
-- altre. `change_log.org_id` e' l'impresa (user_id della riga); la
-- cancellazione dell'account non le tocca: non contengono dati personali, solo
-- id, e si svuotano da sole.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0021_sync1_sync.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS / CREATE OR REPLACE.

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  fingerprint text,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_key_idx ON idempotency_keys (key, method, path);
CREATE INDEX IF NOT EXISTS idempotency_keys_created_idx ON idempotency_keys (created_at);

CREATE TABLE IF NOT EXISTS change_log (
  id bigserial PRIMARY KEY,
  org_id text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  parent_id text,
  op text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS change_log_org_idx ON change_log (org_id, id);
CREATE INDEX IF NOT EXISTS change_log_at_idx ON change_log (at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;

-- Una sola funzione per tutte le tabelle del feed.
--   TG_ARGV[0] = il nome con cui l'app conosce la riga
--   TG_ARGV[1] = la colonna col genitore (cantiere o preventivo), '' se non c'è
-- L'impresa è lo user_id della riga; le righe senza (project_tasks) si cercano
-- tramite il cantiere. Qualunque errore qui viene inghiottito: il feed è un
-- suggerimento a riscaricare, non deve mai bloccare una scrittura.
CREATE OR REPLACE FUNCTION prevai_log_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  r jsonb;
  org text;
  parent text;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN r := to_jsonb(OLD); ELSE r := to_jsonb(NEW); END IF;
    org := r->>'user_id';
    IF TG_NARGS > 1 AND TG_ARGV[1] <> '' THEN parent := r->>TG_ARGV[1]; END IF;
    IF org IS NULL AND parent IS NOT NULL THEN
      SELECT p.user_id INTO org FROM projects p WHERE p.id = parent::uuid;
    END IF;
    IF org IS NOT NULL THEN
      INSERT INTO change_log (org_id, entity, entity_id, parent_id, op)
      VALUES (org, TG_ARGV[0], r->>'id', parent, lower(TG_OP));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NULL;
END
$$;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('projects', 'job', ''),
    ('milestones', 'milestone', 'project_id'),
    ('project_tasks', 'task', 'project_id'),
    ('job_notes', 'note', 'project_id'),
    ('job_photos', 'photo', 'project_id'),
    ('cost_entries', 'cost', 'project_id'),
    ('time_entries', 'time', 'project_id'),
    ('field_reports', 'report', 'project_id'),
    ('change_orders', 'change_order', 'project_id'),
    ('schedule_blocks', 'schedule', 'project_id'),
    ('quotes', 'quote', ''),
    ('quote_variants', 'quote', 'quote_id'),
    ('clients', 'client', ''),
    ('invoices', 'invoice', 'project_id'),
    ('contracts', 'contract', 'project_id'),
    ('leads', 'lead', '')
  ) AS v(tbl, entity, parent_col)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS prevai_change_feed ON %I', t.tbl);
      EXECUTE format('CREATE TRIGGER prevai_change_feed AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevai_log_change(%L, %L)', t.tbl, t.entity, t.parent_col);
    END IF;
  END LOOP;
END
$$;
