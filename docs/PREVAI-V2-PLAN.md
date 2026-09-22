# PrevAI v2 — Piano di evoluzione (porting del codebase QuoteAI al mercato italiano)

**Stato:** solo pianificazione, nessuna modifica al codice. Scritto il 2026-09-21. Piano d'azione complessivo e stato avanzamento: `PIANO-AZIONE.md`.
**Vincoli del titolare:**
1. I dati dei clienti esistenti non devono andare persi — priorità assoluta.
2. Tutto il lavoro avviene in **questo** repo/cartella (`Moroxthug/PrevAI`). QuoteAI (`C:\Users\Admin\OneDrive\Desktop\QuoteAI`) è solo un riferimento in lettura: due prodotti, due entità, due codebase separate. Non si modifica nulla lì.

## 0. Sintesi

QuoteAI è nato come fork di PrevAI (2026-09-10) e da allora ha ricevuto 120+ commit / 70 fasi / ~76.000 righe: ciclo preventivo → contratto (firma elettronica) → cantiere → fatture, team e ruoli, CRM lead kanban, assistente AI con tool-calling, integrazioni, sicurezza (2FA, rate limit, audit log), redesign pixel-perfect, suite e2e + CI, runbook operativi. PrevAI nello stesso periodo ha ~10 commit piccoli.

**Metodo:** il codice di QuoteAI viene importato in questo repo come base della v2 (branch `v2`), ri-italianizzato (l'inverso di quanto fatto a settembre per il Canada), e deployato sul progetto Vercel `prevai` esistente **contro il database Supabase attuale** tramite migrazioni esclusivamente additive. Nessun dato viene copiato tra database; il codice v1 attuale resta la via di rollback.

Alternativa scartata: portare le feature una a una dentro il codice v1 (120 commit su base divergente: mesi di lavoro, rischio bug massimo).

## 1. Contratto di sicurezza dei dati (vale per ogni fase)

Il Supabase di PrevAI è produzione con clienti paganti. Queste regole prevalgono sulla velocità:

1. **Mai `drizzle-kit push` sul DB di produzione.** Solo file SQL di migrazione revisionati a mano, idempotenti (`IF NOT EXISTS`, backfill con guardia), eseguiti con un runner one-off (da portare da QuoteAI, `scripts/` Fase 2).
2. **Solo additivo.** `CREATE TABLE`, `ALTER TABLE … ADD COLUMN` (nullable o con default), `CREATE INDEX CONCURRENTLY`. Niente `DROP`, `RENAME`, restrizioni di tipo, `NOT NULL` su colonne esistenti.
3. **Le rinomine sono expand → backfill → contract, con il contract rimandato.** Dove QuoteAI ha rinominato colonne che PrevAI usa (note finora su `quotes`: `citta → city`, `codiceFiscale → businessNumber`, `cap`; più i campi incentivi `bonusStataleApplicato`, `bandoRegionaleApplicato`, `fasciaIsee`, `regione`, `tipoImmobile`, `obiettivoLavori`, `costoNettoStimato`, `scontoIvaStimato`, `totaleIncentiviStimati`, `incentivesData` che in QuoteAI sono stati rimossi): **in v2 si tengono i nomi italiani di PrevAI** dove possibile (è il codice v2 ad adattarsi al DB, non viceversa); dove serve davvero una colonna nuova, si aggiunge, si backfilla, e la vecchia resta almeno un ciclo di fatturazione.
4. **Il codice v1 deve restare deployabile sul DB migrato in ogni momento.** Le migrazioni additive lo garantiscono: il rollback è "promuovi il deployment precedente" su Vercel, senza toccare il DB. Verificato esplicitamente in V2-3.
5. **Backup logico completo prima di ogni migrazione in produzione** (`pg_dump` formato custom via pooler session-mode, salvato fuori dal repo, sha256 annotato in `docs/RUNBOOKS.md`). Il restore si **prova**, non si presume: V2-3 ripristina un dump reale in un Supabase di staging e ci esegue migrazione + app completa.
6. **Auth, Storage, Stripe restano dove sono.** Stesse tabelle better-auth (password e sessioni intatte), stessi bucket Supabase (`public-assets`/`private-assets`), stesso account Stripe con gli stessi price ID in EUR. Nessun utente si ri-registra, ri-carica file o ri-sottoscrive.
7. **Il cutover è uno switch di deployment, non uno spostamento di dati.**
8. Ogni fase di migrazione termina con una riconciliazione conteggi/checksum (users, business_profiles, quotes, crm, documents, conversazioni WhatsApp) contro lo snapshot pre-migrazione.

## 2. Stato attuale (verificato 2026-09-21)

| | PrevAI v1 (questo repo) | QuoteAI (riferimento) |
|---|---|---|
| Git | 408 commit, `main`, **101 file modificati non committati** | 122 commit |
| Vercel | `prevai` (`prj_tEaFpswmNfK7ySGKXtvcO4SdGI4A`) | `quote-ai` |
| Tabelle DB (Drizzle) | 24 | ~78 |
| File schema | 13 | 40 |
| i18n | nessuna, italiano hardcoded in JSX/template | `translations.ts` (1 861 righe, en/fr) |
| Fiscale | IVA 22% fissa | tabella per provincia GST/HST/PST/QST (`tax.ts`) |
| Valuta | EUR hardcoded | CAD in 32 file server + frontend |
| AI | Groq `llama-3.3-70b-versatile` + Whisper STT; prompt con prezzi regionali e guardrail (`35777f330`, il più recente — da preservare) | Groq |
| Incentivi | **live e centrale** (bonus, ISEE, bandi regionali, cron verifica AI) | rimossi, poi ricostruiti come "Incentives Engine" canadese |
| Frontend package | `artifacts/preventivo-ai` | `artifacts/quote-ai` |

**Sicurezza — da fare subito (V2-0):** il remote `origin` di questo clone ha un **token GitHub in chiaro nell'URL** (`git remote -v` lo stampa). Va revocato dal titolare e il remote reimpostato con URL pulito + credential manager. Ci sono anche 25 remote `subrepl-*` morti di Replit da eliminare.

**Pulizia:** i 101 file modificati non committati (catalog, public-quotes, quotes schema, home, seo, ~85 immagini OG blog, nuova pagina `pages/p/`, mockup preview) vanno capiti e committati su `main` **prima** di aprire il branch v2, altrimenti si perdono.

## 3. Architettura v2

Branch `v2` in questo repo. Contenuto: l'albero di QuoteAI (`artifacts/api-server`, `artifacts/quote-ai` → rinominato `artifacts/preventivo-ai`, `lib/*`, `scripts/`, `docs/`, CI) importato come commit unico "Import QuoteAI codebase as v2 base (ref <sha>)" per tracciabilità, poi ri-italianizzato in fasi. `main` resta v1 finché il cutover non è consolidato; poi `v2` → `main`.

Non serve un'astrazione multi-mercato: PrevAI è un prodotto italiano e basta. Si sostituiscono i valori canadesi con quelli italiani direttamente, ma raccolti in **un unico modulo di configurazione** (`lib/config/italy.ts`: valuta, regime IVA, termini di pagamento, formato numero preventivo, brand, integrazioni attive, tassonomia SEO) invece che sparsi in 85 file — così la prossima evoluzione importata da QuoteAI si adatta cambiando un modulo, non un grep site-wide.

Locale: `translations.ts` viene ridotto a **solo `it`** (si rimuovono en/fr e il toggle lingua). Testi presi dal JSX v1 così i clienti vedono le parole che già conoscono.

## 4. Fasi (sequenziali, un agente alla volta, niente agenti paralleli)

Ogni fase = typecheck pulito, build verde, e2e verdi, un commit, doc aggiornato.

### V2-0 — Sicurezza e igiene (½ giorno)
- Titolare revoca il PAT GitHub; sistemo `origin`, elimino i remote Replit.
- Analizzo e committo i 101 file modificati su `main` (o li scarto se sono rumore, decisione con il titolare).
- **`pg_dump` baseline** della produzione (pooler session-mode, porta 5432). Dimensione, conteggi per tabella, sha256 in `docs/RUNBOOKS.md`. Verifica `pg_restore --list`.
- Inventario nomi env var Vercel prod (`vercel env ls production`) in `docs/ENV-INVENTORY.md` — solo nomi, mai valori.
- Tag `v1-final`. Creo branch `v2`.

### V2-1 — Import base QuoteAI (1 giorno)
- Copio l'albero QuoteAI (escluso `.git`, `node_modules`, `.vercel`, `.env*`) nel branch `v2`. Rinomino `artifacts/quote-ai` → `artifacts/preventivo-ai`, package name, path in `vercel.json`, `tsconfig`, CI.
- Riporto la CI (ESLint, knip, route-matrix guard, i18n audit, e2e) e i `docs/` (DESIGN-SYSTEM, RUNBOOKS, ROUTE-MATRIX, QA plan) come base v2.
- Build verde con `MARKET` ancora canadese: è solo il punto di partenza misurabile.

### V2-2 — Ri-italianizzazione (5–7 giorni)
- `lib/config/italy.ts`: EUR, `it-IT`, regime IVA (22/10/4, reverse charge edilizia, split payment PA, ritenuta d'acconto, bollo €2 su esenti > €77,47), preset pagamenti acconto / SAL / saldo (riuso del "Progress Billing" di QuoteAI, che era il SAL di PrevAI), numerazione preventivi `N° n/aaaa del gg/mm/aaaa`, testi legali GDPR/Codice del Consumo, brand PrevAI.
- **Tassonomia SEO: si riprendono gli slug di PrevAI v1 identici** (`/preventivi/elettricista/milano` ecc., sono indicizzati) da `seo-data.ts` v1; blog e guest post v1 portati in `blog-data.ts`.
- `translations.ts` → solo `it`, popolato dal JSX v1 + traduzione di tutte le superfici nuove (dashboard 70 fasi, email, template PDF/HTML in `routes/quotes.ts` e `generateQuoteWhatsappPdfBuffer.ts`, demo scenes, 404, legali). Trappole già note dal lavoro inverso: `prerender-seo.ts`, template literal nei PDF, `components/demo/`, slug URL.
- Prompt AI: unifico le due copie (`generateQuoteFromText.ts` + duplicato in `routes/quotes.ts`), base = prompt v1 (`35777f330`, prezzi regionali/guardrail) esteso con la struttura QuoteAI (Base/Consigliato/Premium, descrizione generale, note, validità).
- Audit CI invertito: "nessuna stringa UI inglese/francese residua" (grep `[àèìòù]` ora è atteso).

### V2-3 — Prova generale su copia reale (2–3 giorni) ← la fase che protegge i dati
- Nuovo progetto Supabase `prevai-staging`. Restore del dump V2-0 (pooler session-mode, username `postgres.<ref>`, password URL-encoded — gotcha noti).
- Set migrazioni `migrations/v2/0001…000N.sql`: generate con `drizzle-kit generate` (schema v1 → v2), poi **editate a mano** per rispettare §1 (via ogni DROP/RENAME/SET NOT NULL, `IF NOT EXISTS`, rinomine → add+backfill). Atteso: ~54 tabelle nuove, colonne nuove su `quotes`, `business_profiles`, `crm`, `documents`, `settings`, `auth_*` (2FA, metadata sessioni).
- Eseguo su staging → app v2 su staging → e2e + schema-drift check → riconciliazione conteggi.
- **Deploy anche del codice v1 sullo staging migrato** e smoke (login, apertura preventivo storico, generazione nuovo, replay webhook WhatsApp): prova la regola §1.4 prima di toccare la prod.
- Misuro la durata della migrazione per dimensionare la finestra di manutenzione.
- **Esito (2026-09-21):** fatto su **Postgres 17 locale** (decisione titolare: niente terzo progetto Supabase; Storage e preview Vercel rimandati a V2-5). Migrazione unica `migrations/v2/0001_v1_to_v2_additive.sql`: 342 ms, idempotente, drift 0. e2e 63/63 con storage in memoria. v1 e v2 verificate sul DB migrato. Runbook completo in `RUNBOOKS.md` §3–§4. **La migrazione va rigenerata in V2-5** dallo schema finale di V2-4 (le colonne canadesi ancora presenti nello schema — `gst_hst_number`, `qst_number`, `etransfer_email`, `homestars_profile_url`, default `incentives_catalog` — non devono arrivare in prod).

### V2-4 — Riconciliazione feature per l'Italia (5–8 giorni)
- **Aggiunto da V2-3:** pulizia dello schema Drizzle dalle colonne/default canadesi (`business_profiles`, `incentives_catalog`, `collaborators.role`) e dalle tabelle delle integrazioni disattivate se si decide di non crearle (QuickBooks, Wave, Flinks, LSA, Financeit, Meta lead ads); poi `schema-drift` + rigenerazione della migrazione in V2-5.
Per ogni feature QuoteAI: tieni / rietichetta / sostituisci / disattiva. Proposta:

| Feature QuoteAI | Decisione IT |
|---|---|
| Contratti + firma elettronica nativa | tieni; testi legali → FES/FEA (eIDAS), codice fiscale/P.IVA del firmatario |
| Cantieri / milestone / varianti | tieni (SAL 1:1) |
| Fatturazione (acconto/SAL/saldo/ritenuta) | tieni il motore; **in Italia la fattura senza SDI non è emissibile** → v2 emette *pro-forma / avviso di parcella*, con export verso Fatture in Cloud / Aruba in una fase successiva |
| Motore fiscale | sostituisci con regime IVA (V2-2) |
| Incentives Engine canadese | **sostituisci con gli incentivi v1 di PrevAI** (schema `incentives.ts` v1, cron verifica, riepilogo email, campi su `quotes`) montati sulla struttura del motore QuoteAI (catalogo + applicazione per preventivo); colonne v1 preservate (§1.3) |
| CRM lead + follow-up CASL | tieni; semantica consenso → GDPR (opt-in, disiscrizione, retention) |
| Team / ruoli / 2FA / audit log | tieni |
| Email dal Gmail/Outlook del cliente | tieni |
| Sync calendario | tieni |
| Bot WhatsApp | tieni — numero e template v1 sono già italiani; verifica template Meta |
| QuickBooks, Wave | disattiva |
| Flinks (feed bancario) | disattiva (PSD2 = progetto a parte) |
| Financeit (finanziamento POS) | disattiva |
| HomeStars | disattiva |
| Meta Lead Ads / Google LSA | Meta tieni; Google LSA disattiva (non esiste in Italia) |
| Stripe Connect su fatture | tieni (account Stripe IT, EUR); "e-Transfer confirm" → "conferma bonifico" |
| API pubblica + webhook | tieni |
| Preventivi a livelli Good/Better/Best | tieni ("Base / Consigliato / Premium") |
| Timbratura GPS | tieni |
| Import dati (CSV/Excel/PDF) | tieni; mantenere i fallback header CSV listini italiani |
| Piani | riuso dei price ID Stripe EUR live di v1; mappare il gating di `plans.ts` su quelli |

"Disattiva" = fuori dal catalogo integrazioni: sparisce da nav, settings, route e route-matrix guard, non solo nascosto.

### V2-5 — Migrazione produzione + cutover (1 giorno, finestra di manutenzione)
1. Avviso utenti (Resend + banner) — orario a scelta del titolare; consiglio mattina presto di un giorno feriale.
2. `pg_dump` fresco (§1.5), verificato ripristinabile.
3. Migrazioni `migrations/v2/*` sulla prod via pooler session-mode. Riconciliazione conteggi.
4. v1 resta live durante il punto 3 (è additivo). Smoke.
5. Vercel `prevai`: build dal branch `v2`, env da inventario V2-0 + variabili nuove (Stripe webhook secret ri-puntato, `BETTER_AUTH_URL`/`TRUSTED_ORIGINS`=https://prevai.it). **Prima su preview URL**, smoke con login admin reale, apertura preventivi storici, rigenerazione PDF, webhook WhatsApp.
6. Promote a produzione. Monitoraggio `vercel logs` + error tracking (Fase 69) per 48 h.
7. Rollback pre-scritto in `RUNBOOKS.md`: Vercel → promote deployment v1 precedente. Nessuna azione sul DB.

### V2-6 — Consolidamento post-cutover (1–2 settimane)
- **AI Act art. 50 (in vigore dal 2/8/2026, proroga marcatura al 2/12/2026)**: avviso "stai interagendo con un'IA" al primo contatto su assistente, support bot e bot WhatsApp; metadati "contenuto generato con IA" nei PDF/email generati. Dettagli in `AMMINISTRAZIONE-PLAN.md` §7 — va fatto qui, non aspetta il modulo fiscale.
- Suite QA (fasi 61–70 importate): route matrix, security, sweep a11y, matrice PDF, Lighthouse.
- SEO: ogni URL v1 indicizzato risponde 200 con lo stesso canonical; controllo copertura GSC; hreflang solo `it-IT`.
- Solo dopo ≥1 ciclo di fatturazione e approvazione esplicita: **fase contract** — drop delle colonne vecchie e rimozione dei fallback.
- `v2` → `main`.
- Backlog integrazioni italiane (piano separato): export SDI (Fatture in Cloud / Aruba), PEC, aggiornamento catalogo incentivi AdE, feed bancari PSD2.

## 5. Stima

| Fase | Sforzo |
|---|---|
| V2-0 | ½ giorno |
| V2-1 | 1 giorno |
| V2-2 | 5–7 giorni |
| V2-3 | 2–3 giorni |
| V2-4 | 5–8 giorni |
| V2-5 | 1 giorno + monitoraggio |
| V2-6 | 1–2 settimane, in parte in parallelo all'operatività |
| **Totale al cutover** | **~3–4 settimane lavorative** di sessioni sequenziali |

## 6. Decisioni richieste al titolare prima di V2-2

1. Confermare la tabella V2-4 (soprattutto: fatture come pro-forma finché non c'è export SDI; incentivi v1 ripristinati).
2. Finestra di manutenzione per V2-5.
3. Design: prevai.it adotta il design system navy/Figtree di QuoteAI così com'è, oppure vanno preservati logo/colori attuali di PrevAI? Decide quanto lavoro di theming c'è in V2-2.
4. Revoca del PAT GitHub (V2-0) — azione sull'account, non posso farla io.
5. Cosa fare dei 101 file non committati su `main`.

## 7. Cosa questo piano NON fa

- Non tocca i dati di produzione prima di V2-5, e mai in modo non additivo.
- Non sposta dati tra progetti Supabase.
- Non cambia gli URL SEO live di PrevAI.
- Non modifica nulla nel repo QuoteAI.
- Non costruisce la fatturazione elettronica (SDI) — piano successivo.
- Non usa agenti paralleli.
