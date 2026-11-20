-- PrevAI v2 — campagne email a utenti scelti a mano (2026-11-19).
-- Additiva e idempotente, da eseguire dopo la 0029. Nessun DROP, RENAME o cambio di tipo.
--
-- Esecuzione: bash scripts/prod-migrate.sh migrations/v2/0030_campagne_utenti_selezionati.sql
--
--   · email_campaigns.recipient_user_ids — per il pubblico "selezionati": gli auth_user.id
--     scelti dall'admin. Al lancio valgono comunque i filtri legali di ogni pubblico
--     (email verificata, non disiscritto, nessun rimbalzo o segnalazione di spam).
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS recipient_user_ids text[];
