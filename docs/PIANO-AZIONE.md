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
| 3 | **V2-2** Ri-italianizzazione: `lib/config/italy.ts`, locale solo `it`, slug SEO v1 identici, blog v1, prompt AI unificato | V2 §4 | 5–7 g | ⬜ da fare | | | **← PROSSIMA** (richiede D1) |
| 4 | **V2-3** Prova generale su `prevai-staging` da dump reale; migrazioni additive; v1 e v2 entrambe funzionanti sul DB migrato | V2 §4 | 2–3 g | ⬜ | | | fase che protegge i dati |
| 5 | **V2-4** Riconciliazione feature per l'Italia (tabella keep/swap/disable; incentivi v1 ripristinati; fatture pro-forma) | V2 §4 | 5–8 g | ⬜ | | | richiede decisioni D1, D3 |
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

## Come iniziare la prossima sessione (V2-2)

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

- **2026-09-21** — Creati `PREVAI-V2-PLAN.md`, `AMMINISTRAZIONE-PLAN.md` e questo file. Nessun codice toccato. Ricerca di mercato/legale/compliance completata (vedi `AMMINISTRAZIONE-PLAN.md` §13 per le fonti). QuoteAI consultato in sola lettura per ricostruire le 70 fasi.
- **2026-09-21 (V2-0)** — Triage D4: 102 file → 5 commit per tema su `main` (`4265338a5` accettazione pubblica `/p/:id`, `36ad3c965` OCR listino, `063d6f861` home CRM, `d03cf34a8` hero SEO, `dae9d577a` docs); 88 PNG OG scartate (byproduct di build); audit HTML e xlsx Toronto spostati fuori repo. Dump baseline prod (151 KB, 24 tabelle, 106 preventivi, 28 utenti) → `RUNBOOKS.md`. Scoperto che le colonne `accepted_*` erano già in prod. `ENV-INVENTORY.md` creato (13 var su Vercel; Groq è l'unico provider AI). D7 risolta (eu-west-1). Tag `v1-final` = `6dbe45de4`, branch `v2` creato e pushato. Push di `main` ha avviato deploy prod su Vercel.
- **2026-09-21 (V2-1)** — Base QuoteAI (`5d65f61`) importata su `v2` e rinominata `preventivo-ai`. Due scoperte: (a) i filtri pnpm per path non funzionano nella cartella `PrevAI (2)` → script `typecheck` passato ai filtri per nome; (b) `core.autocrlf=true` sulla macchina rendeva CRLF il working tree e faceva fallire il test degli hash CSP → aggiunto `.gitattributes` `eol=lf`. Build verde con `MARKET` canadese: punto di partenza misurabile per V2-2.
