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

--   · price_catalog_items: kind, unit_cost, previous_price, price_changed_at, parts (Listino, QuoteAI 127.6).
--   · suppliers: referente, conto/banco, condizioni, sconto, indirizzo, consegna, orari, note, archivio (Fornitori).
--   · inventory_items, supplier_orders — scorte e ordini ai fornitori (Magazzino).
ALTER TABLE price_catalog_items ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE price_catalog_items ADD COLUMN IF NOT EXISTS unit_cost numeric(10,2);
ALTER TABLE price_catalog_items ADD COLUMN IF NOT EXISTS previous_price numeric(10,2);
ALTER TABLE price_catalog_items ADD COLUMN IF NOT EXISTS price_changed_at timestamptz;
ALTER TABLE price_catalog_items ADD COLUMN IF NOT EXISTS parts jsonb;

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rep_name text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rep_role text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'account';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS account_no text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS terms text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS pro_discount_pct numeric(5,2);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS delivers text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS hours text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'cad',
  par numeric(10,2) NOT NULL DEFAULT 0,
  shop_qty numeric(10,2) NOT NULL DEFAULT 0,
  truck_qty numeric(10,2) NOT NULL DEFAULT 0,
  sites jsonb NOT NULL DEFAULT '[]'::jsonb,
  reserved jsonb NOT NULL DEFAULT '[]'::jsonb,
  unit_cost_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_items_user_idx ON inventory_items (user_id);

CREATE TABLE IF NOT EXISTS supplier_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  unit text NOT NULL DEFAULT 'cad',
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price_cents integer,
  destination text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'listed',
  ordered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_orders_user_supplier_idx ON supplier_orders (user_id, supplier_id, created_at);

--   · company_groups, company_group_members — più imprese in un gruppo, per la vista di insieme (QuoteAI 127.8 Group).
CREATE TABLE IF NOT EXISTS company_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_groups_user_id_idx ON company_groups (user_id);
CREATE TABLE IF NOT EXISTS company_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES company_groups(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_by_user_id text NOT NULL,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS company_group_members_user_idx ON company_group_members (user_id);
CREATE INDEX IF NOT EXISTS company_group_members_group_idx ON company_group_members (group_id);
