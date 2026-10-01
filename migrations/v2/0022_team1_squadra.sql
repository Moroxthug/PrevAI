-- PrevAI v2 — TEAM-1 Posti, codici d'accesso, chi ha inviato e chi ha vinto (riga 56, 2026-10-01).
-- Additiva e idempotente, da eseguire dopo la 0021 (non dipende da nessuna).
--   Colonne nuove, tutte nullable o con default:
--   · quotes.sent_by_user_id, invoices.sent_by_user_id — chi della squadra ha
--     inviato per primo il documento (auth_user.id). Si scrive solo da ora in
--     poi: prima non c'è nessuno e la classifica parte da zero. Un preventivo
--     accettato conta come «vinto» per chi l'ha inviato.
--   · organization_members.access_code_hash / access_code_label — codice
--     d'accesso al posto del link per email. Solo l'hash; l'indice univoco
--     impedisce due righe con lo stesso codice.
--   · business_profiles.extra_seats — posti oltre quelli del piano, default 0.
--     Oggi lo scrive solo il personale (D20: il prezzo non c'è).
--   Nessun DROP di dati, nessun RENAME, nessun cambio di tipo
--   (PREVAI-V2-PLAN.md §1).
--
-- Finché non viene eseguita il codice nuovo NON gira: le query su queste
-- tabelle nominano le colonne nuove. Eseguirla prima di pubblicare.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0022_team1_squadra.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_by_user_id text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_by_user_id text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS access_code_hash text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS access_code_label text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS extra_seats integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_access_code_idx ON organization_members (access_code_hash);
CREATE INDEX IF NOT EXISTS quotes_sent_by_idx ON quotes (user_id, sent_by_user_id) WHERE sent_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_sent_by_idx ON invoices (user_id, sent_by_user_id) WHERE sent_by_user_id IS NOT NULL;
