-- PrevAI v2 — POCKET-2 Dal preventivo all'incasso, lato server (riga 59, 2026-10-10).
-- Additiva e idempotente, da eseguire dopo la 0022 (non dipende da nessuna).
--   · quotes.first_viewed_at — quando il cliente ha aperto la pagina del preventivo la prima volta
--     (la campanella lo sapeva già; qui c'è il momento, per «Visto» nell'elenco).
--   · quotes.declined_at / declined_reason — il cliente ha rifiutato dalla sua pagina, e perché
--     (facoltativo). Si azzerano quando il preventivo è inviato di nuovo.
--   · quotes.exclusions — «Non incluso»: cosa il prezzo non copre, una riga ciascuna.
--   · quotes.version / revision_open + tabella quote_versions — un preventivo già inviato e poi
--     modificato diventa la versione successiva; la sostituita resta in quote_versions.
--   · quote_variants.recommended — l'opzione che l'impresa consiglia fra le varianti.
--   · today_checks — le spunte della lista «Da fare oggi» (una riga per persona, giorno e voce).
--   Nessun DROP di dati, nessun RENAME, nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- Finché non viene eseguita il codice nuovo NON gira: le query sui preventivi nominano le colonne
-- nuove. Eseguirla prima di pubblicare.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0023_pocket2_preventivo_incasso.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_reason text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS exclusions text[] NOT NULL DEFAULT '{}';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS revision_open boolean NOT NULL DEFAULT false;

ALTER TABLE quote_variants ADD COLUMN IF NOT EXISTS recommended boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  version integer NOT NULL,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_versions_quote_idx ON quote_versions (quote_id, version);

CREATE TABLE IF NOT EXISTS today_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  member_user_id text NOT NULL,
  day text NOT NULL,
  item_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS today_checks_member_day_item_idx ON today_checks (member_user_id, day, item_id);

-- ── Clienti dai preventivi esistenti ────────────────────────────────────────
-- La scheda Clienti dell'app legge le righe di `clients`, ma i preventivi scritti prima non le hanno:
-- (la pagina web raggruppa i preventivi per nome, email e telefono). Si crea un cliente per ogni gruppo
-- (la stessa chiave di dedup del sito) e si collegano preventivi e cantieri nati da quei preventivi.
-- Idempotente: ON CONFLICT DO NOTHING e si aggiorna solo dove il collegamento manca.
INSERT INTO clients (user_id, name, email, phone, address, city, province, postal_code, business_number, dedup_key, marketing_unsubscribe_token)
SELECT DISTINCT ON (q.user_id, dk.key)
  q.user_id,
  COALESCE(NULLIF(trim(q.client_data->>'nome'), ''), 'Cliente'),
  NULLIF(trim(q.client_data->>'email'), ''),
  NULLIF(trim(q.client_data->>'phone'), ''),
  NULLIF(trim(q.client_data->>'indirizzo'), ''),
  NULLIF(trim(q.client_data->>'city'), ''),
  NULLIF(upper(trim(q.client_data->>'province')), ''),
  NULLIF(trim(q.client_data->>'postalCode'), ''),
  COALESCE(NULLIF(trim(q.client_data->>'businessNumber'), ''), NULLIF(trim(q.client_data->>'partitaIva'), '')),
  dk.key,
  gen_random_uuid()::text
FROM quotes q
CROSS JOIN LATERAL (
  SELECT concat_ws('|',
    lower(trim(coalesce(q.client_data->>'nome', ''))),
    lower(trim(coalesce(q.client_data->>'email', ''))),
    lower(trim(coalesce(q.client_data->>'phone', '')))
  ) AS key
) dk
WHERE trim(coalesce(q.client_data->>'nome', '')) <> ''
ORDER BY q.user_id, dk.key, q.created_at DESC
ON CONFLICT (user_id, dedup_key) DO NOTHING;

UPDATE quotes q
SET client_id = c.id
FROM clients c
WHERE q.client_id IS NULL
  AND c.user_id = q.user_id
  AND c.dedup_key = concat_ws('|',
    lower(trim(coalesce(q.client_data->>'nome', ''))),
    lower(trim(coalesce(q.client_data->>'email', ''))),
    lower(trim(coalesce(q.client_data->>'phone', '')))
  );

UPDATE projects p
SET client_id = q.client_id
FROM quotes q
WHERE p.client_id IS NULL AND p.quote_id = q.id AND q.client_id IS NOT NULL AND q.user_id = p.user_id;

UPDATE invoices i
SET client_id = p.client_id
FROM projects p
WHERE i.client_id IS NULL AND i.project_id = p.id AND p.client_id IS NOT NULL AND p.user_id = i.user_id;
