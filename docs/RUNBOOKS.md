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
