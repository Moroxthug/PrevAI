-- PrevAI v2 — APP-4a Note del cantiere, scritte o dettate dal telefono (2026-09-27).
-- Terza migrazione dopo il cutover. Additiva e idempotente, da eseguire
-- dopo la 0010.
--   Nuova tabella: job_notes (una riga per nota; solo testo, nessun audio).
--   Nessuna colonna nuova su tabelle esistenti. Nessun DROP, nessun RENAME,
--   nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- Finché non viene eseguita il codice resta inerte: GET /api/jobs/:id/notes
-- risponde { available: false, notes: [] }, la scheda Note del cantiere e la
-- voce "Nota vocale" del + non compaiono.
--
-- La cancellazione dell'account la spazza da sola (ha `user_id`).
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0011_app4a_note_cantiere.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS / duplicate_object.

CREATE TABLE IF NOT EXISTS "job_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"project_id" uuid NOT NULL,
	"body" text NOT NULL,
	"source" text DEFAULT 'typed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "job_notes_project_idx" ON "job_notes" USING btree ("project_id","created_at");
