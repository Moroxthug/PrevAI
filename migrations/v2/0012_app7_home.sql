-- PrevAI v2 — APP-7 Home per ruolo e "Personalizza la home" (2026-09-27).
-- Quarta migrazione dopo il cutover. Additiva e idempotente, da eseguire
-- dopo la 0011.
--   Nuova tabella: home_layouts (una riga per home salvata: la propria di
--   ogni persona, oppure quella di partenza di un ruolo scelta dal titolare).
--   Nessuna colonna nuova su tabelle esistenti. Nessun DROP, nessun RENAME,
--   nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--   Il nuovo ruolo "bookkeeper" (Contabile) NON richiede migrazione:
--   organization_members.role è text senza vincoli.
--
-- Finché non viene eseguita il codice resta inerte: GET /api/home risponde
-- con la home del ruolo e { available: false }; "Personalizza la home" si
-- apre ma dice che non può ancora salvare.
--
-- La cancellazione dell'account la spazza da sola (ha `user_id`).
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0012_app7_home.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "home_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"layout" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "home_layouts_user_subject_idx" ON "home_layouts" USING btree ("user_id","subject");
