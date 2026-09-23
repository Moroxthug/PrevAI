# PrevAI — Runbook operativi

## 1. Backup del database di produzione (`pg_dump`)

**Strumenti:** binari PostgreSQL 17.6 (zip ufficiale EDB) estratti in `C:\Users\Admin\pg17\pgsql\bin\` — non nel PATH. `winget install PostgreSQL.PostgreSQL.17` non funziona su questa macchina (fallisce il controllo CRL TLS verso enterprisedb.com; con `curl --ssl-no-revoke` il download va).

**Connessione:** pooler Supabase in **session mode** (porta **5432**, non 6543 transaction mode: `pg_dump` ha bisogno di prepared statements e `SET` di sessione). Host `aws-0-eu-west-1.pooler.supabase.com`, utente `postgres.<project-ref>`, `PGSSLMODE=require`. La stringa si ricava da `DATABASE_URL` in `.env.production` sostituendo `:6543/` con `:5432/` e togliendo la query string.

**Comando (Git Bash):**
```bash
export PGSSLMODE=require
"/c/Users/Admin/pg17/pgsql/bin/pg_dump.exe" \
  --dbname="postgresql://postgres.<ref>:<password-url-encoded>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" \
  --format=custom --no-owner --no-privileges --schema=public \
  --file="C:/Users/Admin/PrevAI-backups/prevai-prod-<YYYYMMDD-HHMM>.dump"
```
Poi: `sha256sum <file>` e `pg_restore --list <file> > <file>.toc` (deve elencare le 24 tabelle senza errori).

**Destinazione:** `C:\Users\Admin\PrevAI-backups\` — **fuori dal repo**, mai committare. Il dump contiene dati personali (utenti, clienti, preventivi): conservarlo cifrato/offline e cancellarlo quando non serve più.

**Restore su staging (V2-3):**
```bash
"/c/Users/Admin/pg17/pgsql/bin/pg_restore.exe" --dbname="<staging session URL>" --no-owner --no-privileges --clean --if-exists <file>.dump
```

### Baseline v1 — 2026-09-21 (fase V2-0)

| | |
|---|---|
| File | `C:\Users\Admin\PrevAI-backups\prevai-prod-baseline-20260921-1347.dump` |
| Dimensione | 151.394 byte (DB logico 13 MB) |
| SHA-256 | `27639b6a35a1d1d99f7c4b7f9273ccbe79861de90f1ea64e3e35ccd70075bc10` |
| Server | PostgreSQL 17.6, regione `eu-west-1` |
| `pg_restore --list` | OK — 105 voci TOC, 24 `TABLE DATA` |

Conteggi righe (`SELECT count(*)` al momento del dump):

| Tabella | Righe | Tabella | Righe |
|---|---|---|---|
| auth_user | 28 | quotes | 106 |
| auth_account | 28 | quote_attachments | 1 |
| auth_session | 92 | conversations | 335 |
| auth_verification | 1 | messages | 190 |
| business_profiles | 13 | email_events | 2 |
| settings | 1 | incentives_catalog | 10 |
| projects | 1 | whatsapp_connections | 1 |
| collaborators, extra_costs, price_catalog_items, price_intelligence, project_assignments, project_tasks, suppliers, uploaded_documents, whatsapp_otp, whatsapp_sessions | 0 | | |

Stati presenti in `quotes.status`: `draft`, `pending_payment`, `unlocked` (nessun `accepted` ancora). Le colonne `accepted_at`, `accepted_by_name`, `accepted_ip` **sono già presenti in prod** → il commit `4265338a5` (accettazione pubblica) non richiede migrazione.

## 2. Query di sola lettura sulla prod

Stesso URL session-mode, con `psql`:
```bash
"/c/Users/Admin/pg17/pgsql/bin/psql.exe" "<session URL>" -At -c "<query>"
```
Regola: solo `SELECT`. Qualunque `ALTER`/`INSERT`/`UPDATE` passa da una migrazione SQL additiva, revisionata, con dump fatto prima (vedi `PREVAI-V2-PLAN.md` §1).


## 3. Staging locale per la prova generale (fase V2-3, 2026-09-21)

Decisione del titolare (2026-09-21): lo staging è un **Postgres 17 locale**, non un progetto Supabase (l'org è al limite Free di 2 progetti). Limite accettato: lo Storage Supabase (loghi, PDF caricati) non è testabile in locale — la suite e2e lo sostituisce con un bucket in memoria (`artifacts/api-server/src/e2e/storageStub.ts`, attivo quando `SUPABASE_URL` non è impostata). Il test con Storage reale e preview Vercel si fa in V2-5.

| | |
|---|---|
| Cartella | `C:\Users\Admin\PrevAI-staging\` (fuori dal repo, mai committare) |
| Cluster | `data\` — `initdb -U postgres --auth=trust -E UTF8 --locale=C`, porta **5433**, TLS attivo (cert self-signed `server.crt`/`server.key`, così il codice v1 — che forza `ssl: { rejectUnauthorized: false }` — si connette senza modifiche) |
| DB | `prevai_staging` (di lavoro) · `prevai_v1_baseline` (copia pristina del dump, template per il reset) |
| Worktree v1 | `v1\` = `git worktree add … v1-final`, dipendenze installate, `artifacts/api-server/dist` buildato con `node ./build.mjs` |
| Env | repo: `.env.staging` (api v2, porta 5050, `DATABASE_URL=…5433/prevai_staging?sslmode=disable`, AI puntata a porta chiusa) · `.env.staging-web` (Vite porta 5175, proxy → 5050) · `v1\.env.staging-v1` (api v1, porta 5060, GROQ reale, segreti WhatsApp finti) |
| Launch | `..\.claude\launch.json` (cartella `PrevAI (2)`): `api-server-staging` (5050), `preventivo-ai-staging` (5175) via `dev-*-staging.cmd` |

```bash
PG=/c/Users/Admin/pg17/pgsql/bin
"$PG/pg_ctl.exe" -D "C:/Users/Admin/PrevAI-staging/data" -o "-p 5433" -l "C:/Users/Admin/PrevAI-staging/pg.log" start   # (stop: … stop)
# Reset dello staging al dump v1 (pochi secondi):
"$PG/psql.exe" -p 5433 -U postgres -c "drop database prevai_staging" -c "create database prevai_staging template prevai_v1_baseline"
# Restore da zero (se serve rifare il baseline):
"$PG/pg_restore.exe" --dbname="postgresql://postgres@127.0.0.1:5433/prevai_staging" --no-owner --no-privileges <file>.dump   # 1 errore atteso: "schema public already exists"
```

Verifica del restore (2026-09-21): 24 tabelle, conteggi identici al baseline §1 (auth_user 28, quotes 106, conversations 335, messages 190, …). Le sessioni better-auth restano valide: il token di una sessione v1 funziona su v1 e v2 (cookie `better-auth.session_token=<token>.<base64 HMAC-SHA256(secret, token)>`, firmato con il `BETTER_AUTH_SECRET` dello staging).

Comandi di verifica usati in V2-3:
```bash
# Drift schema v2 ↔ DB (0 fatali atteso dopo la migrazione):
cd lib/db && DATABASE_URL="postgresql://postgres@127.0.0.1:5433/prevai_staging" pnpm exec tsx scripts/schema-drift.ts
# Suite e2e (63 test) contro lo staging, storage in memoria:
pnpm --filter @workspace/api-server test:e2e            # legge .env.staging
# PDF di preventivi storici reali con il renderer v2 → artifacts/api-server/.qa/pdfs/historic/
pnpm --filter @workspace/api-server qa:historic-pdf [quoteId]
```

## 4. Migrazione v1 → v2 (runbook per V2-5, provato in V2-3, rigenerata in V2-5)

File: `migrations/v2/0001_v1_to_v2_additive.sql` — generato con `drizzle-kit pull` (introspezione del DB v1) + `drizzle-kit generate` (schema v2) e poi trasformato in additivo/idempotente (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ADD CONSTRAINT` e `CREATE TYPE` guardati da `duplicate_object`). Scartati: tutti i `SET/DROP DEFAULT` su colonne esistenti. Unica modifica a una colonna esistente: `quotes.iva_percentuale numeric(5,2)→numeric(6,3)` (allargamento; il codice v1 fa `Number()` su quel campo, verificato). `incentives_catalog` non viene toccata (schema v2 = prod dopo V2-4). `quotes.unsubscribe_token` ha `DEFAULT gen_random_uuid()::text` così le INSERT v1 continuano a funzionare.

Contenuto (versione V2-5, 2026-09-21): 1 enum, **43 tabelle nuove, 53 colonne nuove su 9 tabelle esistenti, 45 FK, 69 indici** (la versione V2-3 aveva 54 tabelle / 57 colonne / 52 FK / 82 indici: in meno le 11 tabelle delle integrazioni canadesi, le colonne `gst_hst_number`/`qst_number`/`pst_number`/`licence_number`/`etransfer_email`/`homestars_profile_url` di `business_profiles`, `province`/`city`/`income_tested` di `incentives_catalog`; in più `codice_fiscale`/`codice_sdi`/`rea_number`/`iban`/`secondary_review_url`; `contract_signers.tax_id`; `invoices.bank_transfer_self_reported_at`; `invoice_payments.method` default `bank_transfer`; `leads` senza `google_lsa_*`). **Durata su staging (copia prod, 13 MB): 409 ms** in una transazione; la seconda esecuzione è un no-op (solo NOTICE "already exists, skipping"; i due NOTICE "identifier … will be truncated" sui vincoli `assistant_*` sono innocui: Postgres tronca a 63 caratteri, stesso nome che drizzle si aspetta). Finestra di manutenzione V2-5 dimensionata dal dump + promote Vercel, non dalla migrazione.

```bash
# 1. dump (§1)   2. migrazione in un'unica transazione:
"$PG/psql.exe" "<session URL>" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0001_v1_to_v2_additive.sql
# 3. drift check (§3)   4. riconciliazione: conteggi per tabella + checksum
#    ATTENZIONE: iva_percentuale cambia rappresentazione (22.00 → 22.000): normalizzare con ::numeric(10,2) nel checksum.
psql "<url>" -At -c "select md5(string_agg(id::text||subtotale||(iva_percentuale::numeric(10,2))||iva_valore||totale||status||coalesce(numero_preventivo_data,'')||coalesce(items::text,'')||coalesce(capitoli::text,'')||coalesce(client_data::text,''), ',' order by id)) from quotes"
```
Rollback: promuovere il deployment v1 precedente su Vercel — v1 gira sul DB migrato (provato: sessione, lista, apertura storico, preventivo manuale, generazione AI, sign-up, webhook WhatsApp firmato).

**Rigenerazione V2-5 (2026-09-21):** invece di ripetere pull+generate (prompt interattivo di drizzle-kit sulle rinomine), la 0001 di V2-3 è stata trasformata con uno script deterministico che applica le modifiche di schema di V2-4 (rimozione dei blocchi `CREATE TABLE`/FK/indici delle 11 tabelle canadesi, swap delle colonne di `business_profiles`, `incentives_catalog` intoccata, `leads` senza `google_lsa_*`, e-Transfer → bonifico, `contract_signers.tax_id`). Verifica: staging resettato dal template `prevai_v1_baseline` → nuova 0001 (409 ms) → `pg_dump --schema-only` **identico** allo staging V2-4 (0001+0002) a meno dell'ordine delle colonne → `schema-drift` 0 fatali (67 tabelle, 3 enum; 3 indici PK "extra" informativi, come sempre) → e2e **60/60**. `migrations/v2/0002_v2-4_staging_delta.sql` eliminata.

## 5. Cutover v2 in produzione (fase V2-5)

**Prerequisiti:** D2 decisa (finestra), branch `v2` pushato (aggiorna solo la *preview* Vercel), `main` = v1 in produzione, staging verde (§4). Tutto ciò che tocca la prod si fa nella finestra, nell'ordine sotto; ogni passo ha il suo "come si verifica".

### 5.1 Variabili d'ambiente Vercel (progetto `prevai`) — prima della finestra

Le 13 variabili v1 restano valide (`docs/ENV-INVENTORY.md`). Da **aggiungere** per v2 (Production + Preview), generate/lette dal titolare, mai scritte nei docs:

| Variabile | Valore | Perché |
|---|---|---|
| `BETTER_AUTH_URL` | `https://prevai.it` | base dei callback auth (in preview il codice ricade su `PREVAI_BASE_URL`/`VERCEL_URL`) |
| `TRUSTED_ORIGINS` | `https://prevai.it,https://www.prevai.it` | CORS + better-auth; senza, il login da `www` fallisce |
| `CRON_SECRET` | `openssl rand -hex 32` | bearer del cron giornaliero `/api/cron/tick` (12:00 UTC, `vercel.json`): incentivi v1, follow-up, promemoria pro-forma |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` (64 hex) | AES-256-GCM per i token OAuth (calendario/Gmail) a riposo; il modulo lancia un errore alla prima cifratura se manca |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | da Stripe → Webhooks → endpoint `/api/payments/connect-webhook` | firma del webhook Connect (pagamenti pro-forma con carta). Se Connect non si attiva subito, impostare comunque un valore: l'endpoint rifiuta con 400, nessun crash |
| `SUPABASE_PUBLIC_BUCKET` / `SUPABASE_PRIVATE_BUCKET` | `public-assets` / `private-assets` | default già uguali a v1: opzionali, impostarle solo per esplicitare |
| `OPS_ALERT_EMAIL` | email del titolare | alert cron/automazioni (fallback: `ADMIN_EMAIL`) |
| `SENTRY_DSN`, `VITE_SENTRY_DSN` | opzionali | error tracking (QuoteAI §1); senza, solo log Vercel |

Da **verificare** (già presenti): `STRIPE_WEBHOOK_SECRET` deve corrispondere all'endpoint Stripe `https://prevai.it/api/payments/webhook` (v1 usava lo stesso path: nessun cambio se il path non cambia); `RESEND_WEBHOOK_SECRET` → `/api/webhooks/resend`. **Non impostare** `INCENTIVES_SOURCE_FETCH` (solo locale/e2e). Dopo aver impostato le variabili: `vercel env pull .env.production` locale per il controllo e rigenerare `docs/ENV-INVENTORY.md` (solo nomi).

### 5.2 Preview v2 (fuori finestra, senza toccare il DB)

1. `git push origin v2` → deploy preview. Con le env Production copiate in Preview, la preview **legge il DB di produzione non ancora migrato**: le tabelle v2 mancano, quindi la preview serve solo per frontend, login e lettura preventivi. **Non** creare dati dalla preview prima della migrazione.
2. Verifica preview: `/api/healthz` 200; homepage e 3 URL SEO v1 (es. `/preventivo-ristrutturazione-bagno`) 200 con canonical `https://prevai.it/...`; login admin reale; lista preventivi; apertura di un preventivo storico; PDF.

### 5.3 Finestra di manutenzione (ordine obbligatorio)

```bash
PG=/c/Users/Admin/pg17/pgsql/bin; export PGSSLMODE=require
URL="postgresql://postgres.<ref>:<pw>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"   # session mode, §1
# 1. dump fresco + verifica
"$PG/pg_dump.exe" --dbname="$URL" --format=custom --no-owner --no-privileges --schema=public --file="C:/Users/Admin/PrevAI-backups/prevai-prod-pre-v2-$(date +%Y%m%d-%H%M).dump"
"$PG/pg_restore.exe" --list C:/Users/Admin/PrevAI-backups/prevai-prod-pre-v2-*.dump | grep -c "TABLE DATA"     # 24
# 2. conteggi + checksum PRIMA
"$PG/psql.exe" "$URL" -At -f docs/sql/reconcile.sql > C:/Users/Admin/PrevAI-backups/reconcile-before.txt
# 3. migrazione (una transazione, ~0,5 s; v1 resta live: è additiva)
"$PG/psql.exe" "$URL" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0001_v1_to_v2_additive.sql
"$PG/psql.exe" "$URL" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0002_a0_compliance.sql      # A-0: business_profiles.two_factor_required
"$PG/psql.exe" "$URL" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0003_a1_sdi.sql             # A-1: fatture elettroniche (§6.7)
"$PG/psql.exe" "$URL" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0004_a2_fiscale.sql         # A-2: motore fiscale (§7.7)
"$PG/psql.exe" "$URL" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0005_a3_scadenzario.sql     # A-3: scadenzario (§8.6)
"$PG/psql.exe" "$URL" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0006_a4_prima_nota.sql      # A-4: prima nota e chiusura (§9.7)
"$PG/psql.exe" "$URL" -v ON_ERROR_STOP=1 -1 -f migrations/v2/0007_a5_addon.sql            # A-5: add-on e test di prezzo (§10.6)
# 4. conteggi + checksum DOPO → devono coincidere (iva_percentuale normalizzata nella query)
"$PG/psql.exe" "$URL" -At -f docs/sql/reconcile.sql > C:/Users/Admin/PrevAI-backups/reconcile-after.txt
diff C:/Users/Admin/PrevAI-backups/reconcile-before.txt C:/Users/Admin/PrevAI-backups/reconcile-after.txt   # nessuna differenza
# 5. drift v2 ↔ prod (0 fatali)
cd lib/db && DATABASE_URL="$URL" pnpm exec tsx scripts/schema-drift.ts
```
6. Smoke **v1 ancora live** sul DB migrato (login, lista, apertura preventivo, generazione AI di un preventivo di prova da cancellare poi).
7. Smoke **preview v2** sul DB migrato: login admin, preventivi storici, PDF, `/p/:id` di un preventivo con incentivi, widget `GET /api/public/incentives`, creazione di un preventivo manuale di prova (poi archiviarlo).
8. **Promote**: Vercel → Deployments → deployment preview di `v2` → *Promote to Production* (oppure `vercel promote <url>`). Non fare merge in `main`: resta v1 per il rollback finché V2-6 non chiude.
9. Subito dopo: `https://prevai.it/api/healthz` e `/api/healthz/ops` 200; login; un preventivo storico; `curl -H "Authorization: Bearer $CRON_SECRET" https://prevai.it/api/cron/tick` (idempotente: la prima esecuzione del tick v2 crea la riga `cron_ticks`); Stripe → Webhooks → *Send test event* su entrambi gli endpoint; Vercel → Settings → Cron Jobs mostra `/api/cron/tick`.
10. Avviso agli utenti (Resend) che la nuova versione è online. Monitoraggio 48 h: Vercel Logs filtrati `level:error`, `/api/healthz/ops`, Sentry se attivo.
11. **A-0, dopo il promote** (mai prima: il codice v1 non conosce il prefisso `enc1:`): cifrare gli IBAN scritti in chiaro — `TOKEN_ENCRYPTION_KEY=<prod> DATABASE_URL="$URL" pnpm --filter @workspace/api-server ops:encrypt-fiscal-fields` (dry run), poi `--apply`, poi dry run di nuovo → `0 plaintext`. Vedi §5.5.

### 5.4 Rollback (pre-scritto)

- **Applicazione**: Vercel → Deployments → ultimo deployment di `main` (v1, commit `6dbe45de4` o successivo) → *Promote to Production*. Tempo: < 1 min. v1 gira sul DB migrato (provato in V2-3: sessione, lista, storico, manuale, AI, sign-up, webhook WhatsApp). Le env aggiunte in 5.1 sono ignorate da v1.
- **Database**: **nessuna azione**. La migrazione è additiva: v1 non vede le tabelle/colonne nuove. Non fare `pg_restore` del dump (perderebbe i dati creati nel frattempo); il dump serve solo per disastro.
- **Dati creati da v2 durante la finestra** (pro-forma, contratti, cantieri) restano nelle tabelle v2 e riappaiono al prossimo tentativo di cutover.
- Dopo il rollback: annotare in `PIANO-AZIONE.md` (Diario) cosa è andato storto; il prossimo tentativo riparte da 5.3 punto 7 (la migrazione non va ripetuta, ma rieseguirla è un no-op).
- **A-0, attenzione**: se `ops:encrypt-fiscal-fields --apply` è già stato eseguito, un rollback a v1 mostrerebbe gli IBAN cifrati (`enc1:…`) sulle pro-forma. v1 non stampa `business_profiles.iban` (colonna nata in v2), quindi in pratica non succede; se mai servisse, la decifratura si fa con `decryptField()` di `src/lib/fieldCrypto.ts` e la chiave in password manager.

### 5.5 Cifratura dei campi fiscali (A-0)

`business_profiles.iban` (e in A-1 le credenziali/delega verso l'intermediario SDI) è cifrato a riposo con AES-256-GCM sotto la stessa `TOKEN_ENCRYPTION_KEY` dei token OAuth, in formato `enc1:` + `iv.tag.ciphertext` (`artifacts/api-server/src/lib/fieldCrypto.ts`). Il codice **legge** sia righe cifrate sia righe in chiaro (pre A-0) e **scrive** sempre cifrato, quindi l'ordine di rilascio è: codice → script per il pregresso.

```bash
TOKEN_ENCRYPTION_KEY=<prod, dal password manager> DATABASE_URL=<pooler url> \
  pnpm --filter @workspace/api-server ops:encrypt-fiscal-fields          # dry run: conta le righe in chiaro
  … ops:encrypt-fiscal-fields --apply                                     # una transazione, idempotente
  … ops:encrypt-fiscal-fields                                             # → "0 plaintext value(s)"
```

La rotazione della chiave copre anche queste colonne: `rotate-token-key.ts` conosce il prefisso e salta le righe in chiaro. **A-1** ha aggiunto le credenziali dell'intermediario SDI (`sdi_settings.provider_api_key`, `provider_account_id`, `webhook_secret`) a `COLUMNS` di entrambi gli script.

### 5.6 Policy "2FA obbligatoria" per organizzazione (A-0)

`business_profiles.two_factor_required` (default `false`). Il titolare la attiva da Impostazioni → Sicurezza (deve avere già la 2FA lui stesso; owner-only via `security: full`); il modulo Amministrazione la imporrà (A-5). Con la policy attiva, un utente senza 2FA riceve **403 `{ error: "two_factor_required" }`** da ogni rotta dietro `requireAuth` tranne `GET /api/security/policy`, `GET /api/business-profile`, `GET /api/team/orgs`, `POST /api/team/switch` (ciò che serve alla schermata di blocco della dashboard per spiegare e far attivare la 2FA, o cambiare organizzazione). Eventi nell'audit log: `two_factor.policy_enabled` / `two_factor.policy_disabled`. Sblocco d'emergenza di un'org (titolare che ha perso l'app di autenticazione **e** i codici di backup): `update business_profiles set two_factor_required = false where user_id = '<org>'` + `update auth_user set two_factor_enabled = false where id = '<user>'` e cancellare la riga in `two_factor`; annotare nel Diario.


## 6. Modulo Fatture SDI (A-1)

Fatturazione elettronica verso il Sistema di Interscambio dell'Agenzia delle Entrate. PrevAI **non** è un canale accreditato: firma e trasmissione le fa un intermediario (Openapi.it di default, adapter unico in `artifacts/api-server/src/sdi/providers/`). Di ogni documento restano da noi l'XML e le ricevute, quindi cambiare intermediario non perde nulla.

Pezzi: `sdi/mapper.ts` (fattura → tracciato) · `sdi/xml.ts` (FatturaPA 1.2.2) · `sdi/validate.ts` (controlli, ognuno col codice di scarto che evita) · `sdi/service.ts` (invio, stati, conservazione) · `sdi/bollo.ts` · `sdi/passive.ts` · `routes/sdi.ts` + `routes/sdi-webhooks.ts` · UI in `settings-sdi-tab.tsx`, `components/invoices/sdi-panel.tsx`, `pages/dashboard/amministrazione.tsx`.

### 6.1 Attivare il modulo su un'impresa

1. **Add-on**: `update business_profiles set feature_flags = feature_flags || '{"sdi_invoicing": true}'::jsonb where user_id = '<org>';` (finché A-5 non lo collega a Stripe). Nessun piano lo include.
2. L'impresa completa da sola, in **Impostazioni → Fatture elettroniche**: dati fiscali (ragione sociale, P. IVA, sede con CAP/comune/provincia), regime fiscale (RF19 per i forfettari), intermediario + token API, conferma della delega firmata, e la **2FA obbligatoria per l'organizzazione** (§5.6 — è un requisito, non un consiglio).
3. Finché manca anche solo un requisito lo stato resta `in_configurazione` e le fatture continuano a nascere **pro-forma** (serie `PF-`). Con tutto a posto nascono **fiscali** (serie `FT-`, `invoices.fiscale = true`) e il PDF diventa una copia di cortesia.
4. Il campo `sdi_settings.stato` è solo una cache per l'interfaccia: la verità si ricalcola dai requisiti a ogni lettura (`sdi/stato.ts`).

Ambiente: `sdi_settings.ambiente` = `sandbox` (default) o `produzione`. In sandbox **nessun documento è valido** e il bollo non entra nei trimestri. Provider `simulato` (default) non manda niente a nessuno: è quello che usano staging ed e2e, e l'esito lo decide il codice destinatario del cliente (`SCARTO1` → scarto 00305, `MANCATA` → mancata consegna).

### 6.2 Notifiche dell'intermediario (webhook)

- URL da registrare presso l'intermediario (in Openapi: `POST /api_configurations`, eventi `customer-notification` e `supplier-invoice`):
  `https://prevai.it/api/webhooks/sdi/<user_id>?token=<segreto>`
- Il segreto lo sceglie l'impresa in Impostazioni (≥ 16 caratteri) ed è conservato cifrato. Senza segreto corretto la rotta risponde 401 e non guarda nemmeno il corpo.
- Il corpo è **dato, non istruzioni**: si leggono solo i campi noti e l'idempotenza è garantita da `e_invoice_events.provider_event_id`.
- Rete di sicurezza: il tick del cron ripassa le trasmissioni ancora in volo (`sdi/maintenance.ts`), quindi un webhook perso non costa una fattura.

### 6.3 Quando lo SdI scarta una fattura

Una fattura scartata **si considera non emessa** e va corretta e ritrasmessa entro 5 giorni. In dashboard l'impresa vede lo stato rosso, il messaggio tradotto e il pulsante "Rinvia allo SdI"; il rinvio crea una **nuova** trasmissione (nuovo progressivo, nuovo nome file) e lascia la precedente a `scartata` — lo SdI ragiona per trasmissione, non per documento.

Dal lato ops:
```sql
select e.stato, e.errore_codice, e.errore_messaggio, e.file_name, i.number
from e_invoices e join invoices i on i.id = e.invoice_id
where e.user_id = '<org>' and e.stato = 'scartata' order by e.created_at desc;
```
Il dizionario dei codici è in `lib/config/src/fatturapa.ts` (`ERRORI_SDI`): se l'AdE ne aggiunge uno, si aggiunge lì e il messaggio migliora ovunque.

### 6.4 Credenziali e conservazione

- Token API, account id e segreto webhook dell'intermediario sono cifrati a riposo con `enc1:` sotto `TOKEN_ENCRYPTION_KEY` (§5.5). La rotazione della chiave (§6 QuoteAI / "Rotate TOKEN_ENCRYPTION_KEY") deve includere `sdi_settings.provider_api_key`, `provider_account_id`, `webhook_secret`.
- Le API non restituiscono mai le credenziali: solo `credenzialiPresenti`/`webhookSegretoPresente`.
- La conservazione a norma (10 anni, art. 2220 c.c.) è delegata all'intermediario quando `conservazione_attiva` è true: l'invio passa dall'endpoint con firma + legal storage. **In ogni caso** l'XML è archiviato anche nel nostro storage privato in `sdi/<user_id>/<anno>/<file>.xml` e l'impresa può scaricarlo (fattura → Scarica XML).
- Export completo per un'impresa (es. cambio intermediario o richiesta del commercialista): `select file_name, xml_path from e_invoices where user_id = '<org>'` e scaricare i file dal bucket privato.

### 6.5 Bollo virtuale e F24

2 € su ogni fattura **senza IVA** sopra 77,47 € (DPR 642/1972): nel forfettario, praticamente tutte. Il totale del trimestre non si incrementa a mano, si **ricalcola** dalle trasmissioni non scartate (`sdi/bollo.ts`), quindi uno scarto successivo non lascia residui. Codici tributo 2521-2524; scadenze 31/5, 30/9, 30/11, 28/2. L'F24 è **precompilato**, non pagato: il contribuente lo versa da sé (home banking o Fisconline). Il prospetto che fa fede resta quello dell'Agenzia nel portale Fatture e Corrispettivi — l'avviso lo dice in chiaro.

### 6.6 Ciclo passivo

Si scarica qualcosa solo se l'impresa ha **aderito esplicitamente** (`ciclo_passivo_attivo`, con data): è una prescrizione del Garante (Provv. fatturazione elettronica 2018-2019), non una preferenza. Le fatture di acquisto restano `nuova` finché è l'utente a collegarle a un cantiere: nessuna categorizzazione automatica con effetti contabili. Per ricevere davvero le passive l'impresa deve registrare il codice destinatario dell'intermediario nel portale "Fatture e Corrispettivi" (passo guidato nell'onboarding).

### 6.7 Cutover e migrazioni

`migrations/v2/0003_a1_sdi.sql` è additiva e idempotente e va eseguita **dopo** la 0002 (§5.3): cinque tabelle nuove, `business_profiles.city/cap`, `invoices.fiscale`, cinque colonne su `clients`. I documenti già emessi restano pro-forma (`fiscale = false`), come sono stati consegnati ai clienti. Nessun utente passa a `FT-` finché non accende il modulo e completa l'onboarding.

## 7. Motore fiscale forfettario (A-2)

Calcolo di imposta sostitutiva e contributi, "quanto mettere via", monitor della soglia degli 85.000 € e simulatore. **È uno strumento di calcolo, non una consulenza**: mostra la formula di ogni importo, non versa nulla e non invia dichiarazioni (AMMINISTRAZIONE-PLAN.md §5).

Pezzi: `lib/config/src/fiscale/` (motore puro: `regole/2026.ts`, `ateco.ts`, `calcolo.ts`, `golden.ts`) · `artifacts/api-server/src/fiscale/` (`dati.ts` raccolta, `service.ts`, `maintenance.ts`) · `routes/fiscale.ts` · UI in `pages/dashboard/fisco.tsx` e `lib/fiscale-api.ts` · tabelle `tax_profiles` e `fiscal_payments`.

### 7.1 Lo stato della revisione (D6) — leggere prima di tutto il resto

Le regole vengono dalla ricerca in AMMINISTRAZIONE-PLAN.md §3, **non da un commercialista**. Ogni regola in `regole/2026.ts` porta `revisione.stato`, che oggi è `non_revisionata` per tutte e 16. Conseguenze in codice:

- `Calcolo.revisionato` è `false` e ogni risposta dell'API porta `revisione` con l'elenco regola per regola;
- la pagina Fisco mostra in cima, sempre, l'avviso "numeri non ancora verificati da un commercialista";
- i 5 casi golden (`lib/config/src/fiscale/golden.ts`) hanno `attesi: null` e verificano solo la coerenza.

**Per chiudere la revisione**: si compila la colonna Esito di `docs/compliance/REVISIONE-COMMERCIALISTA.md`, si riportano `stato`, `da` e `il` in `regole/2026.ts` regola per regola, si inseriscono i valori attesi nei 5 casi golden. Da quel momento `golden.test.ts` è un vincolo: qualunque modifica alle regole che sposti un centesimo fa saltare il caso. Un test controlla proprio che le due cose restino allineate (regole confermate ⇒ golden compilati).

### 7.2 Attivare il modulo su un'impresa

1. **Add-on**: `update business_profiles set feature_flags = feature_flags || '{"fiscal_engine": true}'::jsonb where user_id = '<org>';` — feature separata da `sdi_invoicing`, perché un'impresa in regime ordinario vuole le fatture elettroniche e non il forfettario. Nessun piano include nessuna delle due.
2. L'impresa completa l'onboarding fiscale in **Fisco**: codice ATECO (decide il coefficiente), cassa previdenziale, eventuale riduzione contributiva, anno di apertura, requisiti per il 5 %, presa d'atto dell'avviso. Finché manca un passo la pagina mostra il modulo di onboarding e non il calcolo.
3. Il completamento **non** è un flag: `passiMancanti()` lo ricava dai dati veri a ogni lettura.

### 7.3 Chi vede cosa

`fiscale` è la prima **area di permessi chiusa**: owner `full`, admin `view`, office/foreman/viewer **niente**, nemmeno in lettura. La posizione fiscale del titolare non è un dato di lavoro. Il livello `none` nella matrice di `requirePermission.ts` esiste per questo.

### 7.4 Da dove vengono i numeri

- **Incassi**: `invoice_payments` nell'anno solare, escluse le righe generate da una nota di credito. Criterio di cassa: conta la data dell'incasso, non quella della fattura.
- **Fatturato non incassato**: fatture aperte emesse nell'anno. Non fa imposta, pesa sulla soglia.
- **Pipeline**: preventivi accettati nell'anno meno il fatturato dell'anno, con minimo zero. È una stima per differenza, non un aggancio preventivo→fattura: sovrastima apposta, perché il monitor deve avvisare prima e non dopo.
- **Contributi e acconti versati**: `fiscal_payments`, inseriti a mano dall'impresa. Senza, l'imposta calcolata è **più alta** del vero.
- **Bollo**: `bollo_periods` dal modulo A-1.

Attenzione a una differenza che non è un refuso: la base dei **contributi** è il reddito forfettario (incassi × coefficiente), quella dell'**imposta** è lo stesso reddito **meno** i contributi versati. Dedurre i contributi anche dalla base INPS sarebbe un errore a favore dell'utente, che se ne accorgerebbe solo a saldo. È la domanda F6/F10 al commercialista.

### 7.5 Monitor della soglia

Gira nel tick del cron (`fiscale/maintenance.ts`), solo sulle imprese con l'onboarding completo e il modulo acceso. Avvisa quando il livello **peggiora** (`ok → attenzione → vicino → superata → fuori_regime`), mai due volte per lo stesso livello: `tax_profiles.soglia_livello_notificato` tiene il punto. L'avviso descrive la conseguenza e si ferma lì — non dice cosa fare, perché quella è una scelta da professionista.

Per rimandare un avviso in prova: `update tax_profiles set soglia_livello_notificato = null where user_id = '<org>';`

### 7.6 L'anno nuovo

A gennaio si scrive `regole/<anno>.ts` e si aggiunge al registro in `regole/index.ts`; **non si modifica l'anno precedente**, perché una dichiarazione si può rifare tre anni dopo e va rifatta con le regole di allora. Se l'anno richiesto non esiste ancora, il motore usa l'ultima versione disponibile e lo dichiara in `Calcolo.annoRegole`, che l'interfaccia mostra.

### 7.7 Cutover e migrazioni

`migrations/v2/0004_a2_fiscale.sql` è additiva e idempotente e va eseguita **dopo** la 0003 (§5.3): due tabelle nuove (`tax_profiles`, `fiscal_payments`), nessuna colonna su tabelle esistenti. Nascono vuote: nessuna impresa ha un profilo fiscale finché non compila l'onboarding, e senza profilo il modulo non calcola niente.

## 8. Scadenzario, F24 precompilati e promemoria (A-3)

Un calendario solo per tutto ciò che ha una data e un importo: imposta sostitutiva, contributi INPS, bollo trimestrale, invio della dichiarazione. Prima di A-3 le prime due stavano nel motore fiscale (A-2) e il bollo nel modulo fatture (A-1), e nessuna delle due schermate sapeva dell'altra.

Pezzi: `lib/config/src/fiscale/f24.ts` (prospetto puro) e `calcolo.ts` (righe del modello) · `artifacts/api-server/src/fiscale/` (`scadenzario.ts` riconciliazione, `f24pdf.ts`, `promemoria.ts`) · rotte in `routes/fiscale.ts` · UI in `pages/dashboard/scadenzario.tsx` (rotta `/dashboard/fisco/scadenzario`) · tabella `fiscal_deadlines`, colonna `fiscal_payments.scadenza_chiave`.

Vale la stessa linea di A-1 e A-2: **PrevAI prepara la delega, non versa**. Non c'è nessun collegamento a conti correnti e nessuna rotta che disponga un pagamento.

### 8.1 Le scadenze non si conservano: si ricalcolano

Ogni lettura dello scadenzario ricalcola le scadenze dal motore fiscale e dal bollo trimestrale, e poi le **riconcilia** con le righe di `fiscal_deadlines`, che tengono solo ciò che il calcolo non può sapere: versata o no, con quale quietanza, quali promemoria sono già partiti. Un incasso di ieri cambia il saldo di giugno, e una riga salvata a gennaio sarebbe una bugia a giugno.

Conseguenze operative:
- `etichetta`, `data`, `importo_cents` e `categoria` nella tabella sono una **fotografia** dell'ultima riconciliazione, non la verità. Servono allo storico e alle righe che il motore non genera più.
- Una riga che il motore smette di generare (cambio di gestione previdenziale, trimestre di bollo sceso a zero dopo uno scarto) **sparisce** solo se non è mai stata toccata: se è segnata come versata o ha una quietanza, resta.
- La chiave (`chiave`) è stabile e non si cambia: `saldo_primo_acconto`, `secondo_acconto`, `inps_fissi_1..4`, `bollo_t1..t4`, `dichiarazione`. Cambiarla scollega lo stato dalla scadenza e fa ripartire i promemoria.

### 8.2 Una scadenza = un modello F24, non un tributo

La delega del 30 giugno contiene **tre righe**: saldo dell'imposta dell'anno chiuso (codice 1792), primo acconto dell'anno in corso (1790) e contributi sul reddito oltre il minimale (sezione INPS, causale AP). Tenerle separate farebbe compilare tre deleghe dove ne basta una.

Per questo `segnaVersata()` scrive **una riga di `fiscal_payments` per ogni riga del modello**, con la stessa `scadenza_chiave`: il motore conta i contributi versati (deducibili per cassa, F6) separatamente dagli acconti d'imposta, e una delega registrata come un versamento solo farebbe sparire una deduzione vera. Se l'impresa versa un importo diverso da quello calcolato si registra il suo, riproporzionando le righe: noi non sappiamo cosa le ha detto il suo commercialista, e la differenza resta visibile nello scadenzario.

Riaprire una scadenza (`POST …/riapri`) cancella i versamenti nati da lì. Per il bollo, entrambe le operazioni allineano anche `bollo_periods` (A-1), altrimenti il pannello della fattura continuerebbe a dire "da versare".

### 8.3 Il prospetto F24 non è il modello F24

Quello che produciamo — in JSON su `GET /api/fiscale/scadenzario/:chiave/f24` e in PDF su `…/f24.pdf` — è un **prospetto**: gli stessi campi, nello stesso ordine, su un foglio nostro, con scritto in testa che va ricopiato nell'home banking o nei servizi telematici dell'Agenzia. Un facsimile del modello ministeriale inviterebbe a presentarlo com'è allo sportello, dove non sarebbe accettato.

Il PDF è marcato `none` ai fini dell'AI Act art. 50 (V2-6a): non c'è niente di generato da un modello: sono i numeri del motore fiscale, calcolati da regole scritte a mano.

**Matricola INPS e codice sede** stanno sull'estratto conto contributivo e non si deducono da nient'altro: l'impresa li inserisce nello scadenzario (salvati in `tax_profiles.matricola_inps` / `sede_inps`). Finché mancano, il prospetto segna le caselle vuote e lo dichiara in un'avvertenza, invece di inventarle. Il codice sede è validato a quattro cifre: uno storto farebbe rifiutare la delega dalla banca.

Finché D6 è aperta (§7.1) il prospetto porta anche l'avvertenza che codici tributo e causali non sono stati verificati da un commercialista. Le regole nuove di A-3 sono **F17** (codici 1790/1791/1792), **F18** (causali INPS AF/AP, CF/CP, sede e matricola) e **F19** (bollo 2521-2524): sono nella checklist come tutte le altre.

### 8.4 Promemoria

Girano nel tick del cron dentro `runFiscalMaintenance()`, sugli stessi due filtri del monitor soglia: onboarding fiscale completo e add-on `fiscal_engine` acceso. Si guardano **due anni d'imposta**, perché le scadenze dell'anno chiuso cadono in quello dopo (il saldo di giugno, la quarta rata INPS di febbraio, il bollo del quarto trimestre).

Regole anti-rumore:
- un promemoria per soglia e per scadenza, mai due volte (`fiscal_deadlines.promemoria_inviati`);
- vale la soglia **più stretta fra quelle già aperte**: a 4 giorni dalla scadenza parte quella dei 3, non quella dei 15, e una soglia già passata non si recupera a ritroso;
- niente promemoria su una scadenza senza importo o già versata; per una scaduta, un solo richiamo e non oltre 30 giorni dopo.

Canali: la notifica in app parte sempre; l'email (Resend, all'indirizzo dell'account) se `tax_profiles.promemoria_email`; WhatsApp solo se `promemoria_whatsapp`, con un numero, **e** con un template Meta approvato.

> **WhatsApp è inerte (decisione D10).** Fuori dalla finestra di 24 ore Meta accetta solo template pre-approvati. Il codice è completo e il canale si accende impostando `WHATSAPP_TEMPLATE_SCADENZA_FISCALE` con il nome del template approvato (tre parametri nel corpo: `{{1}}` cosa scade, `{{2}}` data, `{{3}}` importo). Finché la variabile è vuota, l'interruttore in interfaccia è disattivato e spiega perché.

Per rimandare un promemoria in prova: `update fiscal_deadlines set promemoria_inviati = '{}'::jsonb where user_id = '<org>' and chiave = '<chiave>';`

### 8.5 Quietanze

La ricevuta del versamento (PDF dell'home banking o foto) si carica su `POST /api/fiscale/scadenzario/:chiave/quietanza` come multipart, finisce nello storage privato con lo stesso meccanismo degli scontrini (`routes/costs.ts`) e si rilegge da `…/quietanza/file`. **Non passa dall'IA**: una quietanza è una prova, non un dato da estrarre.

Sta sulla scadenza e non sul versamento perché un F24 è uno solo anche quando genera tre righe contabili. Lo storage non è provabile in locale (§3): questa parte si verifica in preview dopo il cutover.

### 8.6 Cutover e migrazioni

`migrations/v2/0005_a3_scadenzario.sql` è additiva e idempotente e va eseguita **dopo** la 0004 (§5.3): la tabella `fiscal_deadlines`, sei colonne su `tax_profiles` (matricola/sede INPS e preferenze dei promemoria) e una su `fiscal_payments` (`scadenza_chiave`). Nessuna env nuova è obbligatoria. La tabella nasce vuota e si popola da sé alla prima apertura dello scadenzario.

## 9. Prima nota, estratto conto, chiusura d'anno e commercialista (A-4)

Stesso modulo e stesso gate di A-2/A-3 (feature `fiscal_engine`, area di permessi `fiscale`: il titolare scrive, l'amministratore legge, gli altri ruoli non vedono nulla). Pagine: `/dashboard/fisco/prima-nota`, `/dashboard/fisco/banca`, `/dashboard/fisco/chiusura`; pagina pubblica `/commercialista/:token`. Codice in `artifacts/api-server/src/primanota/` e `lib/config/src/fiscale/chiusura.ts`.

### 9.1 La prima nota non ricopia nulla

Incassi da `invoice_payments` (escluse le righe da nota di credito), costi da `cost_entries` confermati (**escluse** le ore approvate e l'uso delle attrezzature: sono allocazioni interne ai cantieri, non uscite di cassa), versamenti da `fiscal_payments`. L'unica tabella nuova per i movimenti è `prima_nota_movimenti`, per ciò che non ha un altro posto (commissioni, affitto, prelievi, apporti, giroconti). Se un numero in prima nota è sbagliato, si corregge **dove sta** (la fattura, il costo, il versamento), non qui.

Prelievi, apporti del titolare e giroconti si vedono ma **non contano nell'utile**; neanche i versamenti F24, perché l'utile sottrae già imposta e contributi **di competenza** dell'anno dal motore (contare anche i versamenti di cassa li sottrarrebbe due volte).

### 9.2 Estratto conto

CSV delle banche italiane (colonne cercate per nome: data/data contabile/data operazione, dare/avere o importo con segno, descrizione, causale; `;` o `,`; UTF-8 o Windows-1252; righe di saldo scartate col motivo) e OFX 1.x/2.x. Niente IA: si legge con regole scritte (`primanota/estratto.ts`, test in `estratto.test.ts`). Limite 5 MB e 5000 movimenti per file.

Ogni movimento ha un'**impronta** unica per impresa (FITID dell'OFX, altrimenti data + importo + descrizione + ordinale nel file): ricaricare lo stesso estratto, o due estratti che si sovrappongono, non raddoppia nulla. Se una banca cambia il testo della descrizione fra due export dello stesso periodo, i movimenti rientrano come nuovi: si riconoscono dalla stessa data e importo e si ignorano.

Un movimento finisce **abbinato** (a un incasso, costo, versamento o movimento che esiste già, o creato ora con le funzioni di sempre — `recordPayment` per gli incassi, senza ricevuta al cliente) oppure **ignorato**. "Abbina i sicuri" collega solo i movimenti con **una** corrispondenza già registrata (stesso importo, ±7 giorni per le entrate, ±10 per le uscite) non contesa da un altro movimento, e non crea nulla. Un F24 con più righe (saldo + acconto + contributi) si confronta con la somma della delega. "Scollega" non cancella la riga creata: un incasso resta registrato in fattura.

Un estratto si toglie solo se nessun suo movimento è abbinato (errore `IMPORT_CON_ABBINAMENTI`).

### 9.3 Utile netto

`ricavi incassati − costi pagati − imposta − contributi − bollo` dell'anno, con imposta e contributi **dal motore** (quindi non revisionati finché D6 è aperta, e la pagina lo dice). Accanto: i costi che il coefficiente ATECO dà per scontati (`incassi × (100 − coefficiente)`), perché nel forfettario i costi veri non abbassano l'imposta. La pagina lo mostra senza consigliare nulla sul regime.

### 9.4 Chiusura d'anno

Si chiude un anno finito (`ANNO_APERTO` altrimenti), in regime forfettario e con l'onboarding completo. La chiusura è una **fotografia** in `fiscal_year_closings.fotografia` con impronta sha256, versione, e se le regole erano revisionate: **non blocca** fatture, incassi o costi. Se dopo cambia qualcosa, la pagina mostra la differenza voce per voce (ricavi, contributi dedotti, imposta, saldo, costi, utile); si richiude per fissare una nuova versione. "Riporta" (solo per l'anno appena finito) copia ricavi e imposta nel profilo fiscale come "anno precedente": è ciò su cui il motore calcola acconti e permanenza nel regime dell'anno nuovo. Tutto finisce nell'audit log (`fiscal_year` `closed`/`reopened`).

Il prospetto (`prospettoDichiarazione`) riempie i righi LM22, LM34–LM39, LM45, LM46/LM47 e il quadro RR sez. I. I numeri di rigo sono la **regola F20**, `non_revisionata`: vengono dal modello dell'anno precedente e vanno riconfrontati col modello vero ogni primavera. Per un anno senza regole proprie nel motore (oggi: tutti tranne il 2026) il prospetto dice quali regole ha usato. Perdite pregresse (LM37) non gestite: il prospetto lo dichiara.

PrevAI **non compila né invia** la dichiarazione (AMMINISTRAZIONE-PLAN §5): PDF del pacchetto, CSV della prima nota, guida al fai-da-te con SPID/CIE, link al commercialista.

### 9.5 Link del commercialista

Token casuale di 32 byte, mostrato una volta sola, salvato come sha256. Durata 7, 30 o 90 giorni; revocabile. Il link smette di funzionare anche se l'impresa spegne il modulo. Ogni apertura (pagina, CSV, PDF) va in `accountant_share_accesses` con IP e user agent, e il titolare la vede nella pagina Chiusura. Risposta sempre 404 per token sconosciuto, scaduto o revocato. Intestazioni `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`; `/commercialista/` è in `robots.txt`. Rate limit 30/min per IP.

Se un link finisce nelle mani sbagliate: revocarlo dalla pagina Chiusura (effetto immediato) e controllare il registro degli accessi.

### 9.6 Dati di terzi

Prima nota ed estratto conto contengono nomi di clienti e fornitori dell'impresa (le controparti). Sono trattati come le fatture (registro R7): nessun dato va ai modelli AI, e il commercialista li riceve solo tramite un link che l'impresa crea.

### 9.7 Cutover e migrazioni

`migrations/v2/0006_a4_prima_nota.sql` è additiva e idempotente e va eseguita **dopo** la 0005 (§5.3): sei tabelle nuove (`prima_nota_movimenti`, `bank_imports`, `bank_movements`, `fiscal_year_closings`, `accountant_shares`, `accountant_share_accesses`), nessuna colonna su tabelle esistenti. Nessuna env nuova: l'URL del link usa `PREVAI_BASE_URL` come il resto dei link pubblici. Le tabelle nascono vuote.

## 10. Add-on Amministrazione: offerta, test di prezzo, abbonamento (A-5)

### 10.1 Dove sta tutto

- **Nome, prezzi, varianti, stato richiesto**: `lib/config/src/offerta.ts` (`OFFERTA_AMMINISTRAZIONE`). È l'unico posto: landing, paywall, fatturazione, checkout e pannello staff leggono da lì.
- **Stato effettivo**: `statoOfferta()` lo calcola dai prerequisiti e non supera mai quello che consentono. `bozza` (niente visibile, landing noindex e fuori sitemap, checkout 409) → `interesse` (landing indicizzata, paywall con il prezzo, "avvisami") → `vendita` (checkout Stripe).
  - `interesse` richiede **D5** (`decisioni.D5 = true`).
  - `vendita` richiede anche **D6** (dedotta dalle regole del motore: tutte revisionate) e **D8** (`decisioni.D8 = true`).
  - Il **livello gratuito** (calcolo, soglia, scadenzario per ogni utente) si accende da solo con offerta almeno in `interesse` **e** D6 chiusa. Gli articoli SEO sulle tasse (`src/data/blog-fiscale*.ts`) escono con lui.
- **Cosa sblocca l'add-on**: `sdi_invoicing`, `fiscal_engine`, `admin_suite` (`FEATURE_ADDON_AMMINISTRAZIONE`). `admin_suite` è la parte a pagamento: F24 precompilati, prima nota, estratto conto, chiusura, link del commercialista. Col solo `fiscal_engine` quelle rotte rispondono 403 `ADMIN_SUITE_OFF`.
- **Stato dell'abbonamento**: `business_profiles.addons.amministrazione` (jsonb). Stati: `attivo`, `prova`, `insoluto` (danno accesso), `beta` (accesso fino a `betaFino`), `cessato`. I flag del profilo restano l'override in entrambi i sensi (un `false` spegne anche un add-on pagato).
- **Eventi del test di prezzo**: tabella `addon_events` (vista, interesse, checkout, attivato, cessato, beta), con la variante. Risultati per lo staff: Admin → "Test di prezzo" (`GET /api/admin/addons/test-prezzo`).

### 10.2 Passare a `interesse` (serve D5)

1. Il titolare conferma nome e prezzi (anche solo come ipotesi da testare). Aggiornare in `offerta.ts`: `nome`, `varianti`, `bundleEliteMensileCents`, `ivaInclusa` (il piano dice "+IVA" nella tabella e "IVA inclusa" al punto (a): va scelto).
2. `decisioni.D5 = true`, `statoRichiesto = "interesse"`. Commit, deploy.
3. Verifiche: `/amministrazione/` ha `index, follow` ed è in `sitemap.xml`; il menu della dashboard mostra "Amministrazione" a chi non ha il modulo; la pagina `/dashboard/amministrazione/attiva` ha il bottone "Mi interessa".
4. Campagne del test di prezzo: link alla landing con `?v=a|b|c`. La variante resta all'impresa quando si registra (sessionStorage → primo evento). Senza `?v=` la variante è l'hash dell'id dell'impresa.

### 10.3 Passare a `vendita` (servono D5, D6, D8 e i Price su Stripe)

1. **Price su Stripe** (dashboard Stripe, modalità live): un prodotto "PrevAI Amministrazione" e un Price ricorrente in EUR per ogni riga di `lookupKeysAttese()` — l'elenco esatto, con importi e periodicità, è nel pannello Admin → "Test di prezzo". Ogni Price va creato con la sua **lookup key** (`amministrazione_a_mensile`, `amministrazione_a_annuale`, …, `amministrazione_bundle_elite_mensile`). Nessuna env: il checkout cerca il Price per chiave e **rifiuta** (503 `ADDON_PRICE_MISMATCH`) se importo, valuta o periodicità non coincidono con la configurazione.
2. Il **Customer Portal** di Stripe deve permettere la disdetta degli abbonamenti (è lo stesso portale del piano).
3. D6 si chiude seguendo `docs/compliance/REVISIONE-COMMERCIALISTA.md`: quando tutte le regole non sono più `non_revisionata`, D6 risulta chiusa da sola. D8: `decisioni.D8 = true` dopo la firma di contratto, DPA e manuale di conservazione con l'intermediario.
4. `statoRichiesto = "vendita"`. Commit, deploy.
5. Prova end-to-end in modalità test di Stripe su una preview: checkout → ritorno su `?esito=ok` → webhook → `addons.amministrazione.stato = "attivo"`, `two_factor_required = true`, evento `attivato`; disdetta dal portale → `cessato` e il **piano resta com'era**.

### 10.4 Utenti beta

Chi aveva il modulo acceso a mano coi flag va convertito prima del lancio, altrimenti il flag lo tiene dentro per sempre:

```bash
DATABASE_URL=… pnpm --filter @workspace/api-server ops:addon-beta                       # elenca
DATABASE_URL=… pnpm --filter @workspace/api-server ops:addon-beta --apply --fino 2027-01-31
```

Toglie i flag `sdi_invoicing`/`fiscal_engine`/`admin_suite` a true (i `false` restano), scrive `stato: "beta"` con la data, registra l'evento `beta`. Idempotente. Non accende la 2FA obbligatoria (lo fa il webhook quando l'impresa si abbona). Dopo `betaFino` l'impresa vede il paywall; se si abbona prima, la beta è sostituita dall'abbonamento.

### 10.5 Webhook e sincronizzazione

- Gli abbonamenti dell'add-on si riconoscono dai metadati (`addon: "amministrazione"`, ripetuti in `subscription_data`) o dalla lookup key (`amministrazione_…`). Vanno a `sincronizzaAbbonamento()` e **non** al flusso del piano: prima di A-5 qualsiasi `customer.subscription.deleted` riportava l'impresa al piano gratuito.
- Idempotente: si scrive lo stato che l'oggetto Stripe dice. Un evento di un abbonamento non più corrente che dice "cancellato" non spegne quello attivo.
- "Verifica abbonamento" in Impostazioni (`POST /api/payments/sync-subscription`) ora sincronizza anche l'add-on e non scambia più l'add-on per il piano.
- **Insoluto** (`past_due`): l'accesso resta finché Stripe riprova; all'ultimo tentativo fallito Stripe cancella e arriva `deleted`.

### 10.6 Cutover e migrazioni

`migrations/v2/0007_a5_addon.sql` è additiva e idempotente, **dopo** la 0006 (§5.3): una colonna `business_profiles.addons` (jsonb, default `{}`) e la tabella `addon_events`. Il codice v1 non le vede. Nessuna env nuova. Con l'offerta in bozza nessuno ha l'add-on e nessun evento viene registrato.

### 10.7 Cosa non è fatto (di proposito)

- Prezzi IVA inclusa vs esclusa, Stripe Tax, fattura dell'add-on all'impresa: dipendono da D5 e dalla configurazione fiscale di PrevAI, non dal codice.
- Cambio di prezzo quando un'impresa passa da/verso Elite: il bundle si applica al checkout, non si ricalcola sugli abbonamenti già attivi.
- Avviso automatico a chi ha registrato interesse: al lancio si estrae l'elenco da `addon_events` (`tipo = 'interesse'`) e si scrive a mano o con una campagna.


---

# Riferimento QuoteAI (base importata in V2-1, 2026-09-21)

> Sezione ereditata dal repo QuoteAI (progetto Vercel `quoteai`, mercato canadese). Da ri-adattare a PrevAI nelle fasi V2-2…V2-5. Le parti sopra questa riga riguardano la produzione PrevAI.

### QuoteAI runbooks

Phase 69 (docs/QA-VERIFICATION-PLAN.md). Written so that someone with the repo, the Vercel + Supabase logins and the password manager can recover the service without reading source. Every command runs from the repo root on any machine with Node 24 + pnpm — no Docker, no `psql`.

**Exit criterion of Phase 69:** on-call can recover from these docs alone. If a step here needed a source dive, fix the doc.

---

### 0. Where things are

| What | Where |
|---|---|
| Production | https://quoteai.ca — one Vercel project `preventivo-ai` (static frontend + `api/index.js` → the bundled Express app in `artifacts/api-server/dist/app.mjs`) |
| Deploys | `git push origin main` → Vercel builds and promotes automatically. Nothing else deploys. |
| Database | Supabase project **quoteai** (`iwrujhplhilhxweejbtt`, us-west-2, Postgres 17). Connect through the **session pooler** `aws-0-us-west-2.pooler.supabase.com:5432` (the direct `db.*` host is IPv6-only). `DATABASE_URL` in Vercel is that URL. |
| Storage | Supabase Storage buckets `public-assets` (logos) and `private-assets` (signed contract/invoice PDFs, job photos). |
| Cron | Vercel Cron, `vercel.json` → `GET /api/cron/tick` **daily at 12:00 UTC** (Hobby plan cap). Bearer `CRON_SECRET`. |
| Logs | Vercel → project → **Logs** (runtime, pino JSON, `LOG_LEVEL` default `info`). Build logs under Deployments. |
| Errors | Sentry, when `SENTRY_DSN` / `VITE_SENTRY_DSN` are set (see §1). Otherwise only the Vercel logs. |
| Admin API | `/api/admin/*`, any signed-in user whose email is in `ADMIN_EMAIL`. Use the browser session or a bearer session token. |
| Ops probe | `GET https://quoteai.ca/api/healthz/ops` — public, 200 = healthy, 503 = degraded with `problems[]` (see §2). |
| Env vars | `docs/ENV-INVENTORY.md` (generated) and `pnpm env:inventory` (§7). |
| Migrations | `lib/db/drizzle/NNNN_*.sql`, applied **by hand**: `supabase db query --linked --file lib/db/drizzle/NNNN_x.sql`. No migration table; the files are additive and idempotent. |
| Backups | Nightly GitHub Action `Backup` (encrypted artifact, 30 days) once its secrets exist; `pnpm --filter @workspace/api-server ops:backup` by hand (§5). |

First response to any incident: open `/api/healthz/ops`, the Vercel logs filtered to `level:error`, and Sentry. Then the relevant section below.

---

### 1. Error tracking (Sentry) — setup and what is wired

Both apps report through `lib/error-reporting` (a small envelope client, no SDK — see the file header for why). It is inert until the DSN is set.

**Setup once (user):**
1. Create a Sentry project (platform "Node.js" is fine for both), copy the DSN.
2. Vercel → Settings → Environment Variables → add `SENTRY_DSN` and `VITE_SENTRY_DSN` (same value; Production + Preview). `SENTRY_ENVIRONMENT` is optional — it defaults to `VERCEL_ENV`.
3. For **readable stack traces** (source maps): create an org auth token with `project:releases` + `org:read`, add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` as build-time env vars. `scripts/sentry-sourcemaps.mjs` then injects debug ids and uploads the maps on every build (and deletes the frontend `.map` files before deploy). Without the token, builds are unchanged.
4. Sentry → Alerts: one rule "a new issue is created" → email/Slack; a second rule on `logger:ops` (the cron/automation warnings from §2) so operational alerts page too.
5. Redeploy and confirm: the function boot log says `Error tracking: Sentry enabled` (Vercel → Logs). To see a real event, break something on a **preview** deployment (e.g. set `DATABASE_URL` to a wrong host there and open `/api/healthz/db`) and watch the issue arrive with a symbolicated stack.

**What reports automatically:** every `500` from the API (with route, method, actor id, no bodies/cookies); every failed automation attempt (tags `automation_event`, `automation_status`); a cron tick that throws (level fatal); unhandled rejections / uncaught exceptions in the function; browser `window.onerror` / `unhandledrejection` and the React error boundary (tags `route`, `lang`; max 10 per page load, duplicates dropped).

---

### 2. Cron / automation failures

**How it works.** The daily tick (`routes/cron.ts`) runs, in order: automation retries → contract reminders → invoice maintenance (overdue, reminders, auto-send, holdback releases) → lead follow-ups → review requests → incentives freshness → price-trend check → quote follow-ups → Flinks sync → Google LSA poll → usage roll-up. Every domain side effect is an `automation_runs` row executed inline and **retried by the tick** with backoff 5 min / 15 min / 1 h / 4 h / 24 h, 5 attempts, then `dead`. With a daily tick, "5 attempts" means 5 days.

Each tick writes a `cron_ticks` row. `/api/healthz/ops` returns **503** when: no successful tick in the last `CRON_STALE_AFTER_HOURS` (default 25), the last tick failed, or any run is `dead` (last 7 days) / `failed` with an overdue retry. The tick also emails `OPS_ALERT_EMAIL` (fallback `ADMIN_EMAIL`) whenever there is a dead/failed backlog, and pings `CRON_HEARTBEAT_URL` after a good run.

**Setup once (user):** point an uptime monitor (Better Stack, UptimeRobot, Cronitor — free tiers are enough) at `https://quoteai.ca/api/healthz/ops`, every 5–10 min, alert on non-200. Optionally create a heartbeat check there with a 26 h period and put its ping URL in `CRON_HEARTBEAT_URL`. Set `OPS_ALERT_EMAIL`.

### 2a. "no successful cron tick since …" / heartbeat missed
1. Vercel → project → Settings → **Cron Jobs**: is the job listed and enabled, and what does its last run say? Cron jobs only update on a production deploy — if `vercel.json` changed, redeploy.
2. Vercel → Logs, filter `url:/api/cron/tick`. `401` → `CRON_SECRET` changed in Vercel but Vercel Cron sends the value at deploy time: **redeploy**. `503 CRON_SECRET not configured` → the var is missing. `500` → open the error in Sentry / the log line "Cron tick failed", fix, redeploy.
3. Run it by hand to catch up (idempotent — safe to run twice):
   ```bash
   curl -sS -H "Authorization: Bearer $CRON_SECRET" https://quoteai.ca/api/cron/tick
   ```
   The JSON reply lists what each maintainer did and `backlog`.
4. Function timeout (the tick is bounded by `maxDuration: 60` in `vercel.json`): the reply/log shows `tookMs`. If it approaches 60 000, the queue is too big for one tick — run step 3 a few times (each tick retries 25 runs), then raise `maxDuration` or move the cron to hourly (Pro plan) and set `CRON_STALE_AFTER_HOURS=2`.

### 2b. "N automation run(s) dead / failed"
1. `GET /api/admin/automations` (or `?status=dead`) — each row has `event`, `entityType/entityId`, `userId`, `attempts`, `lastError`.
2. Read `lastError`. Common causes: a third-party token expired (→ §4), Resend key invalid (→ every email fails; check `RESEND_API_KEY`), a PDF render error (→ Sentry has the stack).
3. Fix the cause, then retry — one attempt right now, bypassing backoff and the attempt cap. Handlers are idempotent, so retrying a half-done run is safe:
   ```bash
   curl -sS -X POST https://quoteai.ca/api/admin/automations/<run id>/retry -H "Cookie: <your signed-in cookie>"
   ```
   The reply carries the run after the attempt (`status: succeeded | failed | dead`).
4. If the run can never succeed (entity deleted, tenant gone), leave it: `dead` rows drop out of the health check after 7 days, or delete the row.

### 2c. The tick itself throws
Everything after the failing maintainer is skipped for that day. Sentry gets a `fatal` event with `route: GET /api/cron/tick`; the ops email contains the message. Fix → deploy → run 2a step 3.

---

### 3. Stripe webhook backlog / subscription state wrong

Two endpoints, both verified with Stripe's signature before `express.json()`: `POST /api/payments/webhook` (subscriptions, quote unlocks — secret `STRIPE_WEBHOOK_SECRET`) and `POST /api/payments/connect-webhook` (contractor Connect accounts, card payments on invoices — `STRIPE_CONNECT_WEBHOOK_SECRET`). Stripe retries a failed delivery with backoff for **3 days**, then stops; the dashboard shows each attempt.

**Symptoms:** a customer paid but the plan is still free / the quote still locked; Stripe → Developers → Webhooks shows red attempts.

1. Stripe → Webhooks → the endpoint → **Attempts**. `400 Webhook signature error` → the signing secret in Vercel does not match this endpoint (each endpoint has its own `whsec_…`); fix the var, redeploy. `500 Webhook secret not configured` → the var is missing. `500` otherwise → Sentry / logs (`Webhook business logic error`).
2. **Replay**: after the fix, in the same Stripe screen select the failed events → **Resend**. The handlers are idempotent (Stripe event → upsert by customer id).
3. **One customer, no replay needed** — force a resync from Stripe's current state:
   - as the user: Settings → Billing → "Sync subscription" (`POST /api/payments/sync-subscription`);
   - as admin: `POST /api/admin/sync-subscription {"email": "<user email>"}` searches Stripe customers by email; if the Stripe email differs, `POST /api/admin/sync-by-customer {"stripeCustomerId": "cus_…", "userEmail": "<user email>"}`; a plan can be granted outright with `POST /api/admin/grant-plan`.
4. Endpoint disabled by Stripe (too many failures): re-enable it in the dashboard; the events from the disabled period must be resent by hand (step 2).
5. Rotating the webhook secret: Stripe → endpoint → Roll secret (24 h overlap available) → set the new value in Vercel → redeploy → expire the old one.

---

### 4. OAuth token revoked / integration stops syncing

Tokens for QuickBooks, Google Calendar, Gmail, Wave, Meta, Google LSA and the Flinks login id are stored encrypted (`TOKEN_ENCRYPTION_KEY`, AES-256-GCM) in the `*_connections` tables. Access tokens are refreshed on use; when the refresh fails (`… token refresh failed` in the logs) the sync returns `null`, the automation run fails and lands in §2b with the provider error in `lastError`. The Settings → Integrations card only shows a failure for connected email ("Last send failed — reconnect"); the sync log (`GET /api/quickbooks/sync-log`, Wave likewise) shows the rest.

**Causes:** user revoked access at the provider; the provider expired the refresh token (QuickBooks: 100 days unused; Google: 6 months unused, or 7 days while the OAuth app is in "Testing" status); our OAuth client secret was rotated; `TOKEN_ENCRYPTION_KEY` changed without §6 (every decrypt fails at once — "Unsupported state or unable to authenticate data").

1. One tenant only → ask them to **Disconnect and reconnect** in Settings → Integrations (`DELETE /api/<provider>/disconnect` then the connect button). Nothing else needs to happen; the dead runs are retried per §2b step 3.
2. Every tenant of one provider at the same moment → the app credentials: check the provider console (Intuit developer portal / Google Cloud console / Meta) for a rotated or expired client secret, a consent screen back in "Testing", or a suspended app; update `*_CLIENT_SECRET` in Vercel; redeploy; users still have to reconnect if their refresh tokens were invalidated.
3. Every provider at once → `TOKEN_ENCRYPTION_KEY` mismatch. If the previous key is still known, set it back (or run §6 properly). If it is lost, the tokens are unrecoverable: delete the `*_connections` rows and tell users to reconnect.
4. Disable a broken integration without disconnecting it: the `is_enabled` flag on the connection row (`PATCH /api/quickbooks/toggle`, the calendar/Wave equivalents, or SQL) stops the sync while keeping the tokens.

---

### 5. Backups and restore

**Facts.** The Supabase project is on the **Free plan: no automatic backups, no PITR.** Until it is on Pro (daily backups, 7-day retention; PITR is a paid add-on), the only backups are the ones below — and after that they remain the only copy outside Supabase. Backup policy (retention, off-site copy, encryption key custody) is the owner's decision; the tooling supports any of it.

**Nightly (once the secrets exist).** `.github/workflows/backup.yml` runs at 07:17 UTC: `ops:backup` → `ops:restore --verify` → uploads `quoteai-backup-<run id>` (encrypted, 30-day retention). Secrets to set in GitHub → Settings → Secrets → Actions: `BACKUP_DATABASE_URL` (the pooler URL), `BACKUP_SUPABASE_URL`, `BACKUP_SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE` (generate: `openssl rand -base64 32`, **store it in the password manager — without it every artifact is unreadable**). The workflow refuses to upload an unencrypted backup. Trigger one by hand: Actions → Backup → Run workflow.

**By hand** (any machine; reads `.env.staging` for `DATABASE_URL` / Supabase vars if present):
```bash
BACKUP_PASSPHRASE='…' pnpm --filter @workspace/api-server ops:backup --out .backups/$(date +%F)
```
Output: `manifest.json` (tables, row counts, sha256, sequences, migration list, schema snapshot), `tables/<table>.csv.gz[.enc]`, `storage/<bucket>/…`. One consistent snapshot (repeatable-read transaction). Verify any backup without a database:
```bash
BACKUP_PASSPHRASE='…' pnpm --filter @workspace/api-server ops:restore --verify --from .backups/2026-09-21
```

**Restore** (into a scratch/staging project, or production after data loss). Needs the target's pooler `DATABASE_URL` (Supabase → Project Settings → Database; reset the password there if unknown) and the checkout of the commit the backup was taken from (the manifest lists the migration files).
```bash
### fresh project: rebuild the schema from lib/db/drizzle/*.sql, then load
BACKUP_PASSPHRASE='…' pnpm --filter @workspace/api-server ops:restore --from .backups/2026-09-21 --target 'postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres' --yes --wipe
### schema already there (e.g. production after a bad delete): keep it, empty the tables, load
… ops:restore --from … --target … --yes --truncate --data-only
### also put the PDFs/logos back
RESTORE_SUPABASE_URL=… RESTORE_SUPABASE_SERVICE_ROLE_KEY=… … ops:restore … --storage
```
The script refuses the backup's own source unless `--allow-same-source`, refuses a non-empty target without `--truncate`/`--wipe`, checks the target schema against the manifest, loads in foreign-key order inside one transaction (rolled back on any error), restores sequences and compares row counts. Afterwards: `DATABASE_URL=<target> pnpm --filter @workspace/db schema-drift`.

**Restoring production itself:** `--truncate --data-only` on the production URL with `--allow-same-source`, from the newest artifact (download it from the Actions run, unzip). Put the app in maintenance first (Vercel → pause project, or set the deployment protection) so no writes race the load; run; unpause; run the cron tick by hand (§2a step 3).

**Rehearsal log:** backup of production taken 2026-09-21 (77 tables, 83 rows, Storage empty) and verified; encrypted round-trip verified; **the restore into a second project has not been run yet** — see the Phase 69 build log for why and what is needed.

**Supabase-side:** Project paused for inactivity (Free plan, 7 days idle) → Supabase dashboard → Restore; the API returns 500s meanwhile. Project deleted → the nightly artifact is the only copy.

---

### 6. Rotate `TOKEN_ENCRYPTION_KEY`

The key encrypts every stored OAuth token (§4). Rotating it without re-encrypting the rows breaks every integration at once. The script does the re-encryption and is idempotent, so the deploy window is safe.

1. Generate: `openssl rand -hex 32` → NEW. Get the current value from Vercel (it is a Sensitive var — copy it from the password manager, where it must live; Vercel will not show it).
2. Dry run against production — counts what would change and proves both keys work:
   ```bash
   OLD_TOKEN_ENCRYPTION_KEY=<old> NEW_TOKEN_ENCRYPTION_KEY=<new> DATABASE_URL=<pooler url> \
     pnpm --filter @workspace/api-server ops:rotate-token-key
   ```
   "N undecryptable" → those rows decrypt with neither key (already broken, or OLD is wrong). Add `--skip-undecryptable` to rotate the rest and have those users reconnect, or stop and find the right OLD.
3. `… ops:rotate-token-key --apply` — one transaction.
4. Vercel → set `TOKEN_ENCRYPTION_KEY` = NEW → **redeploy**.
5. Run step 2 again (dry run, same OLD/NEW): tokens that the old deployment refreshed between steps 3 and 4 show up as "to rotate" → `--apply` once more. Repeat until `0 value(s) to rotate`.
6. Update the password manager; keep OLD for 30 days in case a backup from before the rotation has to be restored (a restored row is under the key of its backup date — run the script with that OLD).

Same procedure, without the script, for `BETTER_AUTH_SECRET` (logs everyone out — do it at night) and `CRON_SECRET` (redeploy so Vercel Cron picks it up).

---

### 7. Deploy rollback and migrations

**Code rollback:** Vercel → Deployments → previous good deployment → **Instant Rollback** (or *Promote to Production*). Takes effect in seconds, no build. Then revert the commit on `main` so the next push does not redeploy the bug.

**Migrations** are additive SQL applied by hand; the code that needs them is pushed after. Order for a change: apply the migration → push the code. A rolled-back deployment therefore keeps working against a newer schema (nothing is dropped). To undo a migration, write a new forward one (`NNNN_revert_x.sql`), never edit an applied file. Drift check any time: `DATABASE_URL=<pooler url> pnpm --filter @workspace/db schema-drift` (exit 1 if the code expects something the DB lacks).

**A deploy that never boots** (`Startup failed` JSON from every `/api` route): `api/index.js` caught an import error — the Vercel function log shows it; usually a missing env var read at import time. Fix the var / rollback.

**Env var changes** need a redeploy to reach the function (Vercel → Deployments → Redeploy).

**Env inventory** — before launch and after any integration lands:
```bash
### keys only, from the Vercel dashboard or `vercel env ls` pasted into a file
pnpm env:inventory --vercel-keys keys.txt --write docs/ENV-INVENTORY.md
### or straight from the API
VERCEL_TOKEN=… VERCEL_PROJECT_ID=prj_3Xs1CcZ9QM7wd07jY20C2vBFaUTI pnpm env:inventory
```
Exit 1 = a variable the code reads is unclassified, or a required one is missing in production. `docs/ENV-INVENTORY.md` is the last snapshot.

---

### 8. Quick reference — other things that page

| Symptom | Look at | Do |
|---|---|---|
| Sign-in "Too many attempts" for everyone | `app.ts` auth limiters are per IP; a shared office NAT hits 30/15 min | wait, or raise the limit and deploy |
| `/p/:id` "Quote not available" for a client | public view limiter 120/min per IP, or the quote was archived | check `quotes.archived_at`; unarchive from the dashboard |
| Emails not arriving | Resend dashboard → Logs; `GET /api/admin/email-events` (bounces/complaints via the Resend webhook — needs `RESEND_WEBHOOK_SECRET`) | fix DNS (`pnpm --filter @workspace/api-server email-dns-check`), suppressions, or the API key |
| PDFs 500 | Sentry: pdfmake font errors → `src/lib/pdfmake.ts` registers fonts once; `includeFiles` in `vercel.json` ships `dist/data` | rollback, then fix |
| Storage uploads fail | Supabase → Storage → bucket policies; `SUPABASE_SERVICE_ROLE_KEY` rotated? | update the key, redeploy |
| Database "too many connections" | pooler session mode, `max: 3` per function instance; Free plan pooler cap 200 | Supabase → Database → connection stats; scale down concurrency or move to transaction pooler port 6543 (needs `prepare: false`) |
| Everything 500 after a deploy | function boot log → missing env var at import | §7 |
| Vercel flags `readable-secret` on a var | `STRIPE_CONNECT_WEBHOOK_SECRET`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `QUICKBOOKS_CLIENT_SECRET` were added as plain Encrypted, not Sensitive | recreate them as Sensitive (the code does not care) |
