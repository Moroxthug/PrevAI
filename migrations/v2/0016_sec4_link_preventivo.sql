-- PrevAI v2 — SEC-4 link pubblico del preventivo revocabile e con scadenza (2026-09-28).
-- Additiva e idempotente, da eseguire dopo la 0015 (o anche prima: non dipende da nessuna).
--   Nuova tabella: quote_public_links (una riga per preventivo condiviso:
--   versione del link, scadenza, revoca). Nessuna colonna nuova su tabelle
--   esistenti. Nessun DROP, nessun RENAME, nessun cambio di tipo
--   (PREVAI-V2-PLAN.md §1).
--
-- Finché non viene eseguita i link restano quelli di oggi (/p/<id>, senza
-- scadenza né revoca) e il pulsante "Revoca link" risponde che la funzione non
-- è ancora attiva. Il server se ne accorge entro un minuto.
--
-- Non contiene segreti: il link è una firma HMAC dell'id e della versione,
-- calcolata dal server con BETTER_AUTH_SECRET. Ha `user_id`: la cancellazione
-- dell'account la spazza da sola.
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0016_sec4_link_preventivo.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "quote_public_links" (
	"quote_id" uuid PRIMARY KEY NOT NULL REFERENCES "quotes"("id") ON DELETE CASCADE,
	"user_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "quote_public_links_user_idx" ON "quote_public_links" USING btree ("user_id");
