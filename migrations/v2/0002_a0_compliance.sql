-- PrevAI v2 — A-0 Compliance e fondamenta (2026-09-21). Additiva e idempotente, da eseguire DOPO la 0001.
--   business_profiles.two_factor_required: policy di org "verifica in due passaggi obbligatoria" (false = come prima).
-- La cifratura a riposo di business_profiles.iban non cambia lo schema (colonna text, valore con prefisso `enc1:`):
--   i valori esistenti vengono cifrati dallo script `pnpm --filter @workspace/api-server ops:encrypt-fiscal-fields --apply`.
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0002_a0_compliance.sql
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "two_factor_required" boolean DEFAULT false NOT NULL;
