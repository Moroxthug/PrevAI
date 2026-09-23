-- PrevAI v2 — A-4 Prima nota, estratto conto, chiusura d'anno, condivisione col commercialista (2026-09-23).
-- Additiva e idempotente, da eseguire DOPO la 0005.
--   Nuove tabelle: prima_nota_movimenti, bank_imports, bank_movements,
--   fiscal_year_closings, accountant_shares, accountant_share_accesses.
--   Nessuna colonna nuova su tabelle esistenti. Nessun DROP, nessun RENAME,
--   nessun cambio di tipo (PREVAI-V2-PLAN.md §1).
--
-- La prima nota non ricopia incassi, costi e versamenti: li legge da
-- invoice_payments, cost_entries e fiscal_payments. Qui ci sono solo i movimenti
-- che non avevano un posto, l'estratto conto da riconciliare, la fotografia
-- della chiusura d'anno e i link in sola lettura per il commercialista.
-- Tutte le tabelle nascono vuote.
--
-- Esecuzione: psql "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0006_a4_prima_nota.sql
-- Rieseguibile: ogni statement è IF NOT EXISTS o protetto da duplicate_object.

CREATE TABLE IF NOT EXISTS "prima_nota_movimenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"data" timestamp with time zone NOT NULL,
	"tipo" text NOT NULL,
	"categoria" text DEFAULT 'altro' NOT NULL,
	"importo_cents" integer NOT NULL,
	"descrizione" text DEFAULT '' NOT NULL,
	"controparte" text DEFAULT '' NOT NULL,
	"bank_movement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "prima_nota_movimenti_user_data_idx" ON "prima_nota_movimenti" USING btree ("user_id","data");

CREATE TABLE IF NOT EXISTS "bank_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"formato" text NOT NULL,
	"nome_file" text DEFAULT '' NOT NULL,
	"file_hash" text DEFAULT '' NOT NULL,
	"conto" text DEFAULT '' NOT NULL,
	"righe_lette" integer DEFAULT 0 NOT NULL,
	"righe_nuove" integer DEFAULT 0 NOT NULL,
	"righe_duplicate" integer DEFAULT 0 NOT NULL,
	"righe_scartate" integer DEFAULT 0 NOT NULL,
	"lettura" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "bank_imports_user_idx" ON "bank_imports" USING btree ("user_id","created_at");

CREATE TABLE IF NOT EXISTS "bank_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"import_id" uuid NOT NULL,
	"data" timestamp with time zone NOT NULL,
	"data_valuta" timestamp with time zone,
	"importo_cents" integer NOT NULL,
	"descrizione" text DEFAULT '' NOT NULL,
	"controparte" text DEFAULT '' NOT NULL,
	"riferimento" text DEFAULT '' NOT NULL,
	"impronta" text NOT NULL,
	"stato" text DEFAULT 'da_abbinare' NOT NULL,
	"abbinamento_tipo" text,
	"abbinamento_id" text,
	"abbinato_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
	ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_import_id_bank_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."bank_imports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- L'impronta unica per impresa rende innocuo ricaricare lo stesso estratto.
CREATE UNIQUE INDEX IF NOT EXISTS "bank_movements_impronta_idx" ON "bank_movements" USING btree ("user_id","impronta");
CREATE INDEX IF NOT EXISTS "bank_movements_user_stato_idx" ON "bank_movements" USING btree ("user_id","stato","data");
CREATE INDEX IF NOT EXISTS "bank_movements_abbinamento_idx" ON "bank_movements" USING btree ("user_id","abbinamento_tipo","abbinamento_id");

CREATE TABLE IF NOT EXISTS "fiscal_year_closings" (
	"user_id" text NOT NULL,
	"anno" integer NOT NULL,
	"stato" text DEFAULT 'chiuso' NOT NULL,
	"versione" integer DEFAULT 1 NOT NULL,
	"chiuso_at" timestamp with time zone DEFAULT now() NOT NULL,
	"riaperto_at" timestamp with time zone,
	"fotografia" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"impronta" text DEFAULT '' NOT NULL,
	"regole_revisionate" boolean DEFAULT false NOT NULL,
	"riportato_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_year_closings_user_id_anno_pk" PRIMARY KEY("user_id","anno")
);

CREATE TABLE IF NOT EXISTS "accountant_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"destinatario" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"anno" integer NOT NULL,
	"scade_at" timestamp with time zone NOT NULL,
	"revocato_at" timestamp with time zone,
	"accessi" integer DEFAULT 0 NOT NULL,
	"ultimo_accesso_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "accountant_shares_token_idx" ON "accountant_shares" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "accountant_shares_user_idx" ON "accountant_shares" USING btree ("user_id","created_at");

CREATE TABLE IF NOT EXISTS "accountant_share_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"risorsa" text DEFAULT '' NOT NULL,
	"ip" text,
	"user_agent" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
	ALTER TABLE "accountant_share_accesses" ADD CONSTRAINT "accountant_share_accesses_share_id_accountant_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."accountant_shares"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "accountant_share_accesses_share_idx" ON "accountant_share_accesses" USING btree ("share_id","at");
