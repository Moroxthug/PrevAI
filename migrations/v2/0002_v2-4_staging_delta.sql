-- V2-4 — delta di schema applicato allo STAGING locale già migrato con 0001.
-- Serve solo a portare lo staging (e la suite e2e) sullo schema finale di V2-4
-- senza il prompt interattivo di drizzle-kit. NON è la migrazione di produzione:
-- in V2-5 si rigenera `0001` dallo schema finale (RUNBOOKS §4) e questo file
-- viene eliminato. Sulla prod le colonne/tabelle qui rimosse non sono mai esistite.
BEGIN;

-- business_profiles: identità fiscale italiana al posto delle colonne canadesi
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS codice_fiscale text,
  ADD COLUMN IF NOT EXISTS codice_sdi text,
  ADD COLUMN IF NOT EXISTS rea_number text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS secondary_review_url text;
ALTER TABLE business_profiles
  DROP COLUMN IF EXISTS gst_hst_number,
  DROP COLUMN IF EXISTS qst_number,
  DROP COLUMN IF EXISTS pst_number,
  DROP COLUMN IF EXISTS licence_number,
  DROP COLUMN IF EXISTS etransfer_email,
  DROP COLUMN IF EXISTS homestars_profile_url;

-- pro-forma: segnalazione bonifico
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_transfer_self_reported_at timestamp with time zone;
ALTER TABLE invoices DROP COLUMN IF EXISTS etransfer_self_reported_at;
ALTER TABLE invoice_payments ALTER COLUMN method SET DEFAULT 'bank_transfer';
UPDATE invoice_payments SET method = 'bank_transfer' WHERE method = 'etransfer';

-- squadra: default v1
ALTER TABLE collaborators ALTER COLUMN role SET DEFAULT 'collaboratore';

-- incentivi: schema v1 (regione/comune già presenti perché 0001 non li ha eliminati)
ALTER TABLE incentives_catalog
  ADD COLUMN IF NOT EXISTS regione text,
  ADD COLUMN IF NOT EXISTS comune text;
ALTER TABLE incentives_catalog
  DROP COLUMN IF EXISTS province,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS income_tested;
UPDATE incentives_catalog SET percentuale_massima = 50.00 WHERE percentuale_massima IS NULL;
ALTER TABLE incentives_catalog
  ALTER COLUMN level SET DEFAULT 'statale',
  ALTER COLUMN categoria_intervento SET DEFAULT 'tutti',
  ALTER COLUMN tipo_agevolazione SET DEFAULT 'detrazione_10_anni',
  ALTER COLUMN percentuale_massima SET DEFAULT 50.00,
  ALTER COLUMN percentuale_massima SET NOT NULL;

-- lead: niente Google LSA
ALTER TABLE leads
  DROP COLUMN IF EXISTS google_lsa_lead_id,
  DROP COLUMN IF EXISTS google_lsa_lead_type,
  DROP COLUMN IF EXISTS google_lsa_category;

-- integrazioni disattivate (D3)
DROP TABLE IF EXISTS quickbooks_sync_log;
DROP TABLE IF EXISTS quickbooks_connections;
DROP TABLE IF EXISTS wave_sync_log;
DROP TABLE IF EXISTS wave_connections;
DROP TABLE IF EXISTS flinks_transactions;
DROP TABLE IF EXISTS flinks_connections;
DROP TABLE IF EXISTS financeit_loan_events;
DROP TABLE IF EXISTS financeit_applications;
DROP TABLE IF EXISTS financeit_connections;
DROP TABLE IF EXISTS google_lsa_import_log;
DROP TABLE IF EXISTS google_lsa_connections;

COMMIT;
