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

La rotazione della chiave (§6) copre anche queste colonne: `rotate-token-key.ts` conosce il prefisso e salta le righe in chiaro. Quando A-1 aggiunge una colonna cifrata: una riga in `COLUMNS` di entrambi gli script.

### 5.6 Policy "2FA obbligatoria" per organizzazione (A-0)

`business_profiles.two_factor_required` (default `false`). Il titolare la attiva da Impostazioni → Sicurezza (deve avere già la 2FA lui stesso; owner-only via `security: full`); il modulo Amministrazione la imporrà (A-5). Con la policy attiva, un utente senza 2FA riceve **403 `{ error: "two_factor_required" }`** da ogni rotta dietro `requireAuth` tranne `GET /api/security/policy`, `GET /api/business-profile`, `GET /api/team/orgs`, `POST /api/team/switch` (ciò che serve alla schermata di blocco della dashboard per spiegare e far attivare la 2FA, o cambiare organizzazione). Eventi nell'audit log: `two_factor.policy_enabled` / `two_factor.policy_disabled`. Sblocco d'emergenza di un'org (titolare che ha perso l'app di autenticazione **e** i codici di backup): `update business_profiles set two_factor_required = false where user_id = '<org>'` + `update auth_user set two_factor_enabled = false where id = '<user>'` e cancellare la riga in `two_factor`; annotare nel Diario.



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
