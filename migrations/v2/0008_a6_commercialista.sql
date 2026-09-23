-- PrevAI v2 — A-6 Commercialista nel giro: professionisti convenzionati, incarico
-- digitale, revisione → conferma → invio, consulenza, compensi (2026-09-23).
-- Additiva e idempotente, da eseguire DOPO la 0007.
--   Nuove tabelle: professionisti, incarichi, pratiche_dichiarazione,
--   consulenze_messaggi, incarichi_eventi, compensi_professionisti.
--   Nessuna colonna nuova su tabelle esistenti. Nessun DROP, nessun RENAME,
--   nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- Tutte le tabelle nascono vuote e restano vuote finché l'amministrazione non
-- verifica il primo professionista: il servizio non ha un piano né un add-on in
-- vendita (D9, D11), si accende solo col flag `accountant_service` sul profilo.
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0008_a6_commercialista.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS o protetto da duplicate_object.

CREATE TABLE IF NOT EXISTS "professionisti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"nome" text NOT NULL,
	"cognome" text NOT NULL,
	"codice_fiscale" text NOT NULL,
	"partita_iva" text NOT NULL,
	"sezione_albo" text NOT NULL,
	"ordine" text NOT NULL,
	"numero_albo" text NOT NULL,
	"pec" text NOT NULL,
	"studio" text DEFAULT '' NOT NULL,
	"indirizzo_studio" text DEFAULT '' NOT NULL,
	"provincia" text,
	"abilitato_entratel" boolean DEFAULT false NOT NULL,
	"rc_compagnia" text DEFAULT '' NOT NULL,
	"rc_numero_polizza" text DEFAULT '' NOT NULL,
	"rc_massimale_cents" integer DEFAULT 0 NOT NULL,
	"rc_scadenza" timestamp with time zone,
	"rc_verificata_at" timestamp with time zone,
	"altri_strumenti_ia" text DEFAULT '' NOT NULL,
	"capienza" integer DEFAULT 40 NOT NULL,
	"stato" text DEFAULT 'candidato' NOT NULL,
	"verificato_at" timestamp with time zone,
	"verificato_da" text,
	"note_verifica" text DEFAULT '' NOT NULL,
	"sospeso_at" timestamp with time zone,
	"motivo_sospensione" text DEFAULT '' NOT NULL,
	"compenso_pratica_cents" integer,
	"convenzione_versione" text,
	"convenzione_impronta" text,
	"convenzione_testo" jsonb,
	"convenzione_firmata_at" timestamp with time zone,
	"convenzione_firmata_ip" text,
	"convenzione_cessata_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "professionisti_user_idx" ON "professionisti" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "professionisti_stato_idx" ON "professionisti" USING btree ("stato");

CREATE TABLE IF NOT EXISTS "incarichi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"professionista_id" uuid,
	"anno" integer NOT NULL,
	"stato" text DEFAULT 'da_assegnare' NOT NULL,
	"richiesto_at" timestamp with time zone DEFAULT now() NOT NULL,
	"richiesto_da" text,
	"assegnato_at" timestamp with time zone,
	"assegnato_da" text,
	"documenti" jsonb,
	"impronta" text,
	"firmato_at" timestamp with time zone,
	"firmato_da" text,
	"firmato_ip" text,
	"firmato_user_agent" text,
	"informativa_ia_accettata_at" timestamp with time zone,
	"informativa_privacy_accettata_at" timestamp with time zone,
	"adeguata_verifica_at" timestamp with time zone,
	"accettato_at" timestamp with time zone,
	"chiuso_at" timestamp with time zone,
	"motivo_chiusura" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
	ALTER TABLE "incarichi" ADD CONSTRAINT "incarichi_professionista_id_professionisti_id_fk" FOREIGN KEY ("professionista_id") REFERENCES "public"."professionisti"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "incarichi_user_anno_idx" ON "incarichi" USING btree ("user_id","anno");
CREATE INDEX IF NOT EXISTS "incarichi_professionista_idx" ON "incarichi" USING btree ("professionista_id","stato");
-- Un solo incarico aperto per impresa e anno.
CREATE UNIQUE INDEX IF NOT EXISTS "incarichi_aperto_idx" ON "incarichi" USING btree ("user_id","anno") WHERE stato not in ('rifiutato', 'revocato', 'rinunciato', 'concluso');

CREATE TABLE IF NOT EXISTS "pratiche_dichiarazione" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incarico_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"anno" integer NOT NULL,
	"stato" text DEFAULT 'da_revisionare' NOT NULL,
	"chiusura_versione" integer NOT NULL,
	"chiusura_impronta" text NOT NULL,
	"osservazioni" text DEFAULT '' NOT NULL,
	"bozza_url" text,
	"bozza_nome" text,
	"bozza_impronta" text,
	"approvata_at" timestamp with time zone,
	"confermata_at" timestamp with time zone,
	"confermata_da" text,
	"confermata_ip" text,
	"protocollo" text,
	"inviata_at" timestamp with time zone,
	"ricevuta_url" text,
	"ricevuta_nome" text,
	"esito" text,
	"esito_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
	ALTER TABLE "pratiche_dichiarazione" ADD CONSTRAINT "pratiche_dichiarazione_incarico_id_incarichi_id_fk" FOREIGN KEY ("incarico_id") REFERENCES "public"."incarichi"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "pratiche_dichiarazione_incarico_idx" ON "pratiche_dichiarazione" USING btree ("incarico_id");
CREATE INDEX IF NOT EXISTS "pratiche_dichiarazione_user_idx" ON "pratiche_dichiarazione" USING btree ("user_id","anno");

CREATE TABLE IF NOT EXISTS "consulenze_messaggi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incarico_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"autore" text NOT NULL,
	"autore_user_id" text NOT NULL,
	"testo" text NOT NULL,
	"letto_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
	ALTER TABLE "consulenze_messaggi" ADD CONSTRAINT "consulenze_messaggi_incarico_id_incarichi_id_fk" FOREIGN KEY ("incarico_id") REFERENCES "public"."incarichi"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "consulenze_messaggi_incarico_idx" ON "consulenze_messaggi" USING btree ("incarico_id","created_at");

CREATE TABLE IF NOT EXISTS "incarichi_eventi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incarico_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"tipo" text NOT NULL,
	"attore" text NOT NULL,
	"attore_id" text,
	"dettagli" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
	ALTER TABLE "incarichi_eventi" ADD CONSTRAINT "incarichi_eventi_incarico_id_incarichi_id_fk" FOREIGN KEY ("incarico_id") REFERENCES "public"."incarichi"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "incarichi_eventi_incarico_idx" ON "incarichi_eventi" USING btree ("incarico_id","at");
CREATE INDEX IF NOT EXISTS "incarichi_eventi_user_idx" ON "incarichi_eventi" USING btree ("user_id","at");

CREATE TABLE IF NOT EXISTS "compensi_professionisti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professionista_id" uuid NOT NULL,
	"incarico_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"anno" integer NOT NULL,
	"importo_cents" integer NOT NULL,
	"stato" text DEFAULT 'maturato' NOT NULL,
	"maturato_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fattura_numero" text,
	"fatturato_at" timestamp with time zone,
	"pagato_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
	ALTER TABLE "compensi_professionisti" ADD CONSTRAINT "compensi_professionisti_professionista_id_professionisti_id_fk" FOREIGN KEY ("professionista_id") REFERENCES "public"."professionisti"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
	ALTER TABLE "compensi_professionisti" ADD CONSTRAINT "compensi_professionisti_incarico_id_incarichi_id_fk" FOREIGN KEY ("incarico_id") REFERENCES "public"."incarichi"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "compensi_professionisti_incarico_idx" ON "compensi_professionisti" USING btree ("incarico_id");
CREATE INDEX IF NOT EXISTS "compensi_professionisti_prof_idx" ON "compensi_professionisti" USING btree ("professionista_id","stato");
