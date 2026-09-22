# PrevAI — Piano d'azione complessivo

**Creato:** 2026-09-21. **Questo è il file da aprire all'inizio di ogni sessione.** Contiene la sequenza di tutte le fasi, lo stato di avanzamento e il punto esatto da cui ripartire. I dettagli di ogni fase sono nei due piani figli:
- `PREVAI-V2-PLAN.md` — porting del codebase QuoteAI in PrevAI (fasi **V2-0 → V2-6**)
- `AMMINISTRAZIONE-PLAN.md` — fatturazione SDI, motore fiscale forfettari, amministrazione d'impresa (fasi **A-0 → A-6**)

## Regole di lavoro (valgono per ogni sessione)
1. **Una fase alla volta, un agente alla volta.** Niente agenti in parallelo.
2. Ogni fase si chiude con: typecheck pulito, build verde, test verdi, **un commit** con messaggio `V2-N: …` / `A-N: …`, e **aggiornamento della tabella di stato qui sotto** (stato, data, commit, note).
3. **Dati di produzione**: valgono le 8 regole di `PREVAI-V2-PLAN.md` §1 in ogni fase, anche quelle del modulo Amministrazione. Mai `drizzle-kit push` sulla prod. Solo SQL additivo. Dump prima di ogni migrazione.
4. **Non toccare il repo QuoteAI** (`C:\Users\Admin\OneDrive\Desktop\QuoteAI`): è riferimento in sola lettura.
5. Se una fase scopre qualcosa che cambia il piano, si aggiorna il piano figlio **prima** di continuare, e si annota qui nelle note.
6. Le decisioni che spettano al titolare sono elencate in §"Decisioni aperte": non si inventano, si chiedono.

## Sequenza e stato

| # | Fase | Piano | Sforzo | Stato | Data | Commit | Note |
|---|---|---|---|---|---|---|---|
| 1 | **V2-0** Sicurezza e igiene: revoca PAT, remote puliti, triage 101 file non committati, `pg_dump` baseline, inventario env, tag `v1-final`, branch `v2` | V2 §4 | ½ g | ✅ fatto | 2026-09-21 | `6dbe45de4` (main) | main pulito (7 commit), dump baseline OK, tag `v1-final`, branch `v2` |
| 2 | **V2-1** Import base QuoteAI nel branch `v2`, rinomina `quote-ai` → `preventivo-ai`, CI e docs | V2 §4 | 1 g | ✅ fatto | 2026-09-21 | commit `V2-1: import base QuoteAI…` su `v2` | base = QuoteAI `5d65f61` (Phase 71); typecheck, build, 65 test verdi; `.gitattributes` LF |
| 3 | **V2-2** Ri-italianizzazione: `@workspace/config`, locale solo `it`, slug SEO v1 identici, blog v1, prompt AI unificato | V2 §4 | 5–7 g | ✅ fatto | 2026-09-21 | `52c1e6fb7` … `09bd1c7df` + chiusura su `v2` (a–f, 10 commit) | Sotto-tappe: **a** fondamenta ✅ · **b** SEO v1 ✅ · **c** `translations.ts` + pagine pubbliche ✅ · **d** `translations.dashboard.ts` ✅ · **e** prompt AI unificato + WhatsApp/notifiche/piani ✅ · **f** audit CI invertito ✅. Restano per V2-3: dati e2e canadesi (ON/QC) nell'harness `api-server/src/e2e`; testi delle integrazioni disattivate (QuickBooks/Wave/Flinks/LSA) decisi in V2-4 |
| 4 | **V2-3** Prova generale su staging da dump reale; migrazioni additive; v1 e v2 entrambe funzionanti sul DB migrato | V2 §4 | 2–3 g | ✅ fatto | 2026-09-21 | `a638af781` (v2) | Staging = **Postgres 17 locale** (decisione titolare, niente progetto Supabase). Migrazione `migrations/v2/0001` additiva, 342 ms, idempotente; drift 0; e2e 63/63 (harness italianizzato, storage in memoria); v1 e v2 verificate sul DB migrato. Da rigenerare in V2-5 dallo schema finale |
| 5 | **V2-4** Riconciliazione feature per l'Italia (tabella keep/swap/disable; incentivi v1 ripristinati; fatture pro-forma) | V2 §4 | 5–8 g | ⬜ | | | **← PROSSIMA**. richiede decisione D3. Deve anche togliere dallo schema le colonne canadesi (vedi note V2-3) |
| 6 | **V2-5** Migrazione produzione + cutover su Vercel `prevai` (preview → promote), rollback pre-scritto | V2 §4 | 1 g + 48 h monitoraggio | ⬜ | | | richiede D2 |
| 7 | **V2-6** Consolidamento: **AI Act art. 50** (scadenza 2/12/2026), suite QA, SEO check, poi `v2` → `main` | V2 §4 | 1–2 sett. | ⬜ | | | |
| 8 | **A-0** Compliance e fondamenta: DPIA, DPA, 2FA obbligatoria sul modulo, cifratura campi fiscali, revisione regole 2026 con commercialista | A §10 | 1 sett. | ⬜ | | | richiede D6, D7 |
| 9 | **A-1** Fatture SDI via intermediario (Openapi default), onboarding delega, XML FatturaPA, stati SdI, conservazione, bollo, ciclo passivo | A §10 | 2–3 sett. | ⬜ | | | richiede D8 (contratto) |
| 10 | **A-2** Motore fiscale forfettario versionato, onboarding fiscale, "quanto mettere via", monitor soglia con pipeline, simulatore | A §10 | 2 sett. | ⬜ | | | |
| 11 | **A-3** Scadenzario + F24 precompilati + promemoria | A §10 | 1 sett. | ⬜ | | | |
| 12 | **A-4** Prima nota, import estratto conto, utile netto dopo tasse, chiusura d'anno, "Condividi col commercialista" | A §10 | 2 sett. | ⬜ | | | |
| 13 | **A-5** Pricing add-on su Stripe, paywall, landing con test prezzo, SEO | A §10 | 1 sett. | ⬜ | | | richiede D5 |
| 14 | **A-6** Commercialista nel loop (fase 2): convenzione, incarico digitale, revisione→invio, consulenza, L. 132/2025 | A §10 | 3–4 sett. + negoziazione | ⬜ | | | decisione separata, D9 |
| — | Dopo: contract phase (drop colonne vecchie), PSD2, regime semplificato, SDI export avanzato | V2 §4 V2-6 / A §10 | — | ⬜ | | | piani separati |

Legenda stato: ⬜ da fare · 🟨 in corso · ✅ fatto · ⛔ bloccato (scrivere perché nelle note)

**Stima totale:** v2 al cutover ~3–4 settimane; Amministrazione fase 1 ~9–11 settimane dopo; fase 2 a seguire.

## Decisioni aperte (spettano al titolare)

| ID | Decisione | Serve entro | Stato |
|---|---|---|---|
| D0 | **Revocare il PAT GitHub** presente nell'URL del remote `origin` del clone PrevAI (GitHub → Settings → Developer settings → Personal access tokens). Azione sull'account, non delegabile | V2-0 | ✅ 2026-09-21 — revocato dal titolare; remote `origin` ripulito, 25 remote Replit + gitsafe rimossi |
| D1 | Design: prevai.it adotta il design system navy/Figtree di QuoteAI così com'è, o si preservano logo/colori attuali PrevAI? | V2-2 | ✅ 2026-09-21 — **design QuoteAI così com'è** (homepage, dashboard, tutto), per ora; solo brand/testi cambiano |
| D2 | Finestra di manutenzione per il cutover (proposta: mattina presto, giorno feriale, ora italiana) | V2-5 | ⬜ |
| D3 | Conferma tabella V2-4: fatture come pro-forma finché non c'è SDI; incentivi v1 ripristinati; integrazioni canadesi disattivate | V2-4 | ⬜ |
| D4 | Cosa fare dei 101 file non committati su `main` (si decide in V2-0 guardandoli insieme) | V2-0 | ✅ 2026-09-21 — 4 feature committate per tema (accettazione pubblica, OCR listino, home CRM, hero SEO), 88 OG rigenerate scartate, 2 file spuri spostati in Downloads |
| D5 | Nome del modulo ("PrevAI Amministrazione" placeholder) e ok ai prezzi ipotesi: gratis calcolatore/scadenzario; add-on 12 €/mese o 120 €/anno; fase 2 ~420 €/anno IVA incl. | A-5 | ⬜ |
| D6 | Commercialista partner per revisionare il motore regole 2026 (di fiducia o da cercare) | A-0 | ⬜ |
| D7 | Regione UE del progetto Supabase PrevAI (verificare; se non UE, valutare) | A-0 | ✅ verificato 2026-09-21: `aws-0-eu-west-1` (Irlanda, UE) |
| D8 | Intermediario SDI: partire con Openapi.it (prezzi pubblici, no setup) + preventivo A-Cube. Contratto e DPA da firmare dal titolare | A-1 | ⬜ |
| D9 | Fase 2: unico studio partner vs rete di professionisti convenzionati | A-6 | ⬜ |

## Come iniziare la prossima sessione (V2-4)

Apri una sessione nella cartella `C:\Users\Admin\Downloads\PrevAI (2)\PrevAI`, `git checkout v2`, e scrivi: **"Leggi docs/PIANO-AZIONE.md ed esegui la fase V2-4"**. Dettagli in `PREVAI-V2-PLAN.md` §4 V2-4. Prima di iniziare serve la decisione **D3** (tabella keep/swap/disable: fatture pro-forma, incentivi v1, integrazioni canadesi disattivate). Stato al 2026-09-21: V2-3 chiusa sul branch `v2` (`v2` non ancora pushato dopo V2-1 — pushare aggiorna solo la *preview* Vercel; `main` resta v1 in produzione).

Cose da sapere ereditate da V2-3:
- **Staging locale**: Postgres 17 in `C:\Users\Admin\PrevAI-staging\` (porta 5433, TLS on), DB `prevai_staging` + copia pristina `prevai_v1_baseline` per il reset; worktree `v1\` con il codice `v1-final` buildato. Avvio/reset/comandi in `docs/RUNBOOKS.md` §3. Se il cluster non è avviato: `pg_ctl … start` (RUNBOOKS §3). Lo staging contiene 2 preventivi di prova creati da v1 (`N° 49.2026` manuale + uno AI), un utente `v23-signup@e2e-test.invalid` e una `whatsapp_sessions`: resettare dal template prima di nuove riconciliazioni.
- L'app v2 gira in locale contro lo staging: `api-server-staging` (5050, legge `.env.staging`) e `preventivo-ai-staging` (5175, proxy → 5050) da `.claude/launch.json` della cartella padre; oppure `node --env-file=.env.staging artifacts/api-server/dist/index.mjs` dopo `pnpm --filter @workspace/api-server run build`. Per entrare come utente reale: cookie di sessione firmato (RUNBOOKS §3). Nota: sulla porta 5000 gira spesso un processo `walkthrough.ts` di QuoteAI da altre sessioni — non toccarlo.
- `lib/db/src/index.ts`: `?sslmode=disable` in `DATABASE_URL` spegne TLS (solo per Postgres locali); in prod nulla cambia.
- Suite e2e: `pnpm --filter @workspace/api-server test:e2e` legge `.env.staging`; senza `SUPABASE_URL` usa lo storage in memoria (`E2E_STORAGE_STUB=1`). Dati ora italiani (province `MI`/`NA`/`RM`, EUR, `preferredLanguage: "it"`, oggetti email italiani; un oggetto inglese/francese fa fallire il test "template hygiene"). Nuovo script `qa:historic-pdf` per rendere PDF di preventivi reali.
- **Colonne canadesi ancora nello schema v2** (e quindi nella migrazione 0001): `business_profiles.gst_hst_number/pst_number/qst_number/etransfer_email/homestars_profile_url/licence_number`, `incentives_catalog.province/city/income_tested` + default `'federal'/'all'/'rebate'`, `collaborators.role` default `'worker'`, `quotes/projects/clients.province` (ora sigla italiana, ok). V2-4 li toglie/riallinea (incentivi v1 ripristinati); poi in V2-5 si **rigenera** `migrations/v2/0001` dallo schema finale con il procedimento di RUNBOOKS §4.
- `resolveQuoteTaxRate` (api-server `lib/tax.ts`) torna a 22 % quando l'AI non indica un'aliquota: in QuoteAI la provincia decideva l'aliquota e senza provincia dava 0 % — sarebbe stato un bug su ogni preventivo AI senza provincia nel profilo.
- Il PDF preventivo v2 aveva ancora "Unit Price ($)"/"Total ($)" nelle intestazioni tabella (`quotes/pdf.ts`): corretto. L'audit i18n non copre i template PDF backend: in V2-6 aggiungere un controllo sui PDF (`qa:pdf` + grep).
- Dati storici: alcuni preventivi v1 hanno `titolo_preventivo_riga2` con il placeholder letterale "[Comune] ([Prov])" (l'AI v1 non lo sostituiva). Non è un problema di migrazione; valutare in V2-4 se ripulire il prompt (`generateQuoteFromText.ts` riga ~63 ha lo stesso esempio) e i dati.

Cose da sapere ereditate da V2-2:
- Env: il backend legge `PREVAI_BASE_URL` (rinominata da `QUOTEAI_BASE_URL` in V2-2e; `.env`/`.env.production` v1 la usano già). `BETTER_AUTH_URL` resta prioritaria.
- I piani Stripe in `api-server/src/routes/payments.ts` sono tornati agli id/prezzi EUR di PrevAI v1 (Starter 19, Pro 49, Elite 59, singoli 3/9). Le feature "team", "cantieri", "fatture" di QuoteAI non sono ancora mappate ai piani: si decide in V2-4 (D5).
- `pnpm --filter @workspace/preventivo-ai i18n-audit` è ora l'audit invertito (fallisce su chiavi mancanti, valori del dizionario in inglese, split core/dashboard, letterali inglesi nel JSX app); gira in CI (`test.yml`). `pnpm run spell` usa il dizionario `it-it` + lista parole in `cspell.json`.
- L'harness e2e (`api-server/src/e2e`, `vitest.e2e.config.ts`) contiene ancora dati canadesi (province ON/QC, HST): non gira senza DB, si sistema in V2-3 quando esiste lo staging.
- `jobs/dates.ts` usa `Intl.DateTimeFormat("en-CA")` di proposito (dà `YYYY-MM-DD`), non è un residuo.

## Come è stata avviata V2-2 (istruzioni originali)

Apri una sessione nella cartella `C:\Users\Admin\Downloads\PrevAI (2)\PrevAI`, `git checkout v2`, e scrivi: **"Leggi docs/PIANO-AZIONE.md ed esegui la fase V2-2"**. Dettagli in `PREVAI-V2-PLAN.md` §4 V2-2. Prima di iniziare serve la decisione **D1** (design system). Il codice v1 da cui recuperare `seo-data.ts`, blog, prompt AI e incentivi è nel tag `v1-final` (`git show v1-final:artifacts/preventivo-ai/src/…`).

Note operative ereditate da V2-1:
- I comandi locali vanno lanciati con i filtri per **nome pacchetto** (`--filter @workspace/preventivo-ai`), mai per path (`./artifacts/**`): le parentesi in `PrevAI (2)` rompono il glob di pnpm.
- Il repo è `eol=lf` via `.gitattributes`: i 3 hash CSP in `vercel.json` sono calcolati sull'`index.html` LF. Dopo aver toccato gli script inline di `index.html`: `pnpm --filter @workspace/api-server csp-hashes`.
- `.env` locale è ancora quello v1 (Groq ecc.): l'app v2 non gira ancora in locale contro un DB; lo farà su `prevai-staging` in V2-3. Vedi `docs/ENV-INVENTORY.md` (sezione QuoteAI) per le variabili nuove.
- `.claude/launch.json` locale: `preventivo-ai` (:5173) e `api-server` (:5000).

## Storico: come è stata eseguita V2-1

1. Export di QuoteAI `HEAD` (`5d65f61`, Phase 71) con `git archive` — repo QuoteAI non toccato. I 18 file **non committati** di QuoteAI ("Phase 72": leave-team, 2FA UI, privacy) **non** sono stati importati.
2. Rinomina `artifacts/quote-ai` → `artifacts/preventivo-ai` e `quote-ai` → `preventivo-ai` in tutti i riferimenti (package name, `vercel.json`, `pnpm-workspace.yaml`, lockfile, `knip.json`, `eslint.config.mjs`, `cspell`, CI `.github/workflows/*`, script, docs).
3. Albero v1 tolto dal branch (recuperabile dal tag `v1-final`); tree QuoteAI copiato; `docs/RUNBOOKS.md` e `docs/ENV-INVENTORY.md` di PrevAI mantenuti in testa con la versione QuoteAI accodata come sezione; altri docs QuoteAI importati (DESIGN-SYSTEM, ROUTE-MATRIX, QA-VERIFICATION-PLAN, …). I 5 piani PrevAI restano.
4. `pnpm install --frozen-lockfile`, `pnpm run typecheck` (pulito), build api-server + preventivo-ai (428 pagine prerender, ancora canadesi), `pnpm test` 65/65, lint 0 errori, i18n-audit identico al baseline QuoteAI. Knip non eseguibile in locale senza `DATABASE_URL` (carica `drizzle.config.ts`). E2e non eseguiti (richiedono DB: V2-3).

## Storico: come è stata eseguita V2-0

Apri una nuova sessione nella cartella `C:\Users\Admin\Downloads\PrevAI (2)\PrevAI` e scrivi: **"Leggi docs/PIANO-AZIONE.md ed esegui la fase V2-0"**. La fase V2-0, nell'ordine:

1. ~~D0 e pulizia remote~~ — **già fatto il 2026-09-21** (origin pulito, auth verificata). Passare al punto 2.
2. Triage dei 101 file non committati su `main` (`git status`, `git diff --stat`): raggrupparli per tema (catalogo, public-quotes, schema `quotes.ts`, home, SEO, ~85 OG blog, `pages/p/`, mockup preview), spiegarli al titolare (D4), committarli per tema o scartarli. Non aprire `v2` prima che `main` sia pulito.
3. `pg_dump` baseline della produzione via pooler session-mode (porta 5432, utente `postgres.<ref>`, password URL-encoded), formato custom, salvato **fuori dal repo**; annotare in `docs/RUNBOOKS.md` (creare il file) dimensione, sha256, conteggi per tabella; verificare `pg_restore --list`.
4. `vercel env ls production` sul progetto `prevai` → `docs/ENV-INVENTORY.md` (solo nomi).
5. `git tag v1-final` su `main`; `git checkout -b v2`; push di tag e branch.
6. Aggiornare la tabella di stato qui: riga 1 → ✅ con data e commit. Chiudere la sessione o proseguire con V2-1.

## Diario

- **2026-09-21 (V2-2 a+b)** — Creato `lib/config` (`@workspace/config`: MARKET EUR/it-IT, regime IVA 22/10/4/RC/SP/esente, bollo, 107 province + regioni, formattazione, riferimenti legali). `lib/db` `tax.ts` ri-esporta da config; enum lingua `it`; default preventivo tornati a v1 (titolo, nota, IVA 22). Backend: documenti, contratto d’appalto italiano (c.c., Cod. Consumo, eIDAS), email, follow-up, prompt assistente/cantiere in italiano; `TaxProfile` per regime in OpenAPI. Frontend: `Lang = "it"`, dizionari `fr` eliminati (testi ancora inglesi sotto `it`), route `/fr` rimosse, toggle lingua tolto, date-fns `it`, province italiane nei selettori, builder manuale con regime IVA. SEO: dati v1 (seo-data, intelligence, engine, blog 78 articoli) rimessi con slug identici; i 330 URL della sitemap v1 sono tutti prerenderizzati (+11 help). Build/typecheck/lint/test verdi a ogni sotto-tappa. Scoperte: (a) gli heredoc bash con `$VAR` non definito bloccano il tool — usare file di script; (b) `it-IT` non raggruppa le migliaia sotto 5 cifre (`1234,50`), è CLDR-corretto; (c) le pagine settore/città prerenderizzate di QuoteAI usano ancora il markup Tailwind v1, quindi le funzioni v1 (`buildQuantoCostaBlock`) si innestano senza adattamenti.
- **2026-09-21 (V2-3)** — Titolare sceglie lo **staging locale** (Postgres 17 su questa macchina) invece di un terzo progetto Supabase. Restore del dump baseline: 24 tabelle, conteggi identici. Migrazione `migrations/v2/0001_v1_to_v2_additive.sql` generata con drizzle-kit pull+generate e resa additiva a mano (trasformazione: `IF NOT EXISTS`, guardie `duplicate_object`, scartati 2 DROP COLUMN e 7 SET/DROP DEFAULT canadesi, `unsubscribe_token` con default DB): **342 ms**, idempotente, drift 0 fatali. Suite e2e portata da 30 fallimenti a **63/63** senza toccare il DB: stub Storage in memoria (`storageStub.ts`), `sslmode=disable` nel client pg, harness italianizzato (province MI/NA/RM, EUR, lingua `it`, brand PrevAI, piani Stripe v1, test Phase 71 riscritti sul regime IVA). Smoke v2 in browser con la sessione reale di un utente (48 preventivi, dashboard, dettaglio con 5 capitoli) e PDF di 5 preventivi storici con `qa:historic-pdf`. Smoke v1 (worktree `v1-final`, TLS locale) sul DB migrato: sessione, lista, storico, manuale, AI Groq, sign-up, webhook WhatsApp firmato — tutto ok; v2 legge i preventivi scritti da v1. Checksum quotes/users identici al baseline (normalizzando `iva_percentuale`). Bug trovati e corretti: intestazioni PDF "Unit Price ($)"/"Total ($)"; data dettaglio preventivo in formato ISO; `resolveQuoteTaxRate` che dava 0 % senza provincia. Scoperte: (a) drizzle-kit generate chiede conferma interattiva sulle rinomine — serve lo shim TTY + `\r` in pipe; (b) le sequenze `\\` e `\b` passate a `node -e` dal tool Bash vengono alterate: script su file; (c) better-auth firma il cookie con HMAC-SHA256 in base64 standard (non url-safe).
- **2026-09-21 (V2-2 c–f, chiusura)** — **c/d**: `translations.ts` e `translations.dashboard.ts` tradotti integralmente (3104 chiavi sotto `it`), help-centre, home, stats bar, testimonial, termini/privacy v1 (Cod. Consumo, GDPR), placeholder e valute; `seo-slugs.ts` con mappa slug QuoteAI→v1. **e**: un solo prompt AI in `generateQuoteFromText.ts` (base v1: prezzi italiani 2026 e adeguamento Nord/Centro/Sud + struttura QuoteAI: listino prioritario, misure vincolanti, zero omissioni, documento 1:1, descrizione generale, note con validità/esclusioni/garanzia art. 1667 c.c.); `routes/quotes.ts` e il widget lo importano; percorsi deterministici a IVA 22 e rate 30/30/30/10; bot WhatsApp, OCR listino, estrazione documenti, support bot, assistente cantiere, notifiche di automazioni/fatture/varianti ed email di reset/verifica tutte in italiano ed EUR; piani Stripe v1; `cspell` su `it-it`; 5 refusi nel blog v1 corretti (superfice, Rifacere, lesiniare, Autolitante, capriati). **f**: `i18n-audit.ts` invertito (0 su tutti i controlli), typecheck 0 errori, lint 0 errori, 64 test, build 341 pagine, validate-prerender/sitemap verdi. Scoperte: (a) il backend leggeva `QUOTEAI_BASE_URL` mentre le env Vercel v1 hanno `PREVAI_BASE_URL` — sarebbe stato un bug di deploy in V2-5, rinominata ora; (b) la "struttura Base/Consigliato/Premium" citata nel piano non esiste nel prompt QuoteAI (le varianti sono generate a parte da `/variants`): il prompt unificato integra le regole 11–14 di QuoteAI, non tre fasce; (c) nel tool Bash le sequenze `\b` dentro `node -e` diventano backspace — le regex vanno scritte in file di script.

- **2026-09-21** — Creati `PREVAI-V2-PLAN.md`, `AMMINISTRAZIONE-PLAN.md` e questo file. Nessun codice toccato. Ricerca di mercato/legale/compliance completata (vedi `AMMINISTRAZIONE-PLAN.md` §13 per le fonti). QuoteAI consultato in sola lettura per ricostruire le 70 fasi.
- **2026-09-21 (V2-0)** — Triage D4: 102 file → 5 commit per tema su `main` (`4265338a5` accettazione pubblica `/p/:id`, `36ad3c965` OCR listino, `063d6f861` home CRM, `d03cf34a8` hero SEO, `dae9d577a` docs); 88 PNG OG scartate (byproduct di build); audit HTML e xlsx Toronto spostati fuori repo. Dump baseline prod (151 KB, 24 tabelle, 106 preventivi, 28 utenti) → `RUNBOOKS.md`. Scoperto che le colonne `accepted_*` erano già in prod. `ENV-INVENTORY.md` creato (13 var su Vercel; Groq è l'unico provider AI). D7 risolta (eu-west-1). Tag `v1-final` = `6dbe45de4`, branch `v2` creato e pushato. Push di `main` ha avviato deploy prod su Vercel.
- **2026-09-21 (V2-1)** — Base QuoteAI (`5d65f61`) importata su `v2` e rinominata `preventivo-ai`. Due scoperte: (a) i filtri pnpm per path non funzionano nella cartella `PrevAI (2)` → script `typecheck` passato ai filtri per nome; (b) `core.autocrlf=true` sulla macchina rendeva CRLF il working tree e faceva fallire il test degli hash CSP → aggiunto `.gitattributes` `eol=lf`. Build verde con `MARKET` canadese: punto di partenza misurabile per V2-2.
- **2026-09-21 (V2-1, deploy)** — Push di `v2` → deploy *preview* Vercel `prevai` (prod intatta). Primo tentativo rotto dalla cache di build v1 (symlink pnpm stale); poi scoperto bug latente ereditato da QuoteAI Phase 61: `kysely` e `@opentelemetry/semantic-conventions` (usati da `@better-auth/core`) erano esclusi dal bundle esbuild ma non risolvibili nella function → fix `b17475932` (ora bundlati). Preview finale: frontend 200 (design QuoteAI, contenuti canadesi come atteso); `/api/*` risponde `BETTER_AUTH_SECRET or SESSION_SECRET must be set` perché le env del progetto Vercel sono ancora quelle v1. **Volutamente non configurate**: puntare l'API v2 al DB di produzione prima di V2-3 violerebbe §1. Le env v2 per preview si mettono in V2-3 (staging) e V2-5 (prod). D1 decisa: design QuoteAI così com'è.
