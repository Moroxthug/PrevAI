# Cutover v2: kit per martedì 29 settembre 2026, 07:00

**Preparato:** 2026-09-26 (fase 18). **Fonte dei comandi:** RUNBOOKS §5. Questo file non li ripete: aggiunge l'orario, chi fa cosa, i punti in cui fermarsi e cosa guardare nelle 48 ore dopo. Se questo file e RUNBOOKS si contraddicono, fermarsi e chiarire prima di andare avanti.

**Preflight in sola lettura:** `bash scripts/cutover-preflight.sh` (con `CUTOVER_DB_URL="$URL"` controlla anche il DB). Non scrive nulla e non stampa segreti. Esce con 1 se c'è un KO. Con un KO non si parte.

## 0. Stato al 26/9 sera (preflight senza DB)

| Controllo | Esito | Cosa fare |
|---|---|---|
| Strumenti (psql/pg_dump/pg_restore 17.6, vercel, pnpm, node) | OK | — |
| CA Supabase in `C:\Users\Admin\PrevAI-backups\supabase-ca.crt` | **KO** | Titolare, lunedì (§1 punto 3) |
| Migrazioni 0001–0008 e `reconcile.sql` = quelle provate su staging | OK (hash fissati nello script) | Se un hash cambia, rifare la prova generale della fase 16 |
| `v2` su GitHub | **KO**: `origin/v2` = `33a191d1b`, locale = `5a380328d` (8 commit in più) | Push lunedì (§1 punto 1) |
| **Preview da promuovere** | **KO**: costruita da `33a191d1b`, il suo `widget.js` chiama `https://www.prevai.it` | **Promuoverla così riaprirebbe il guasto dei lead della fase 17.** Serve una preview nuova dopo il push |
| Variabili Vercel obbligatorie (14) | OK | — |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | assente, **di proposito** | Stripe Connect non è attivo sull'account PrevAI (verificato il 26/9: "non è configurato come piattaforma Connect"). Senza questa variabile il pagamento con carta delle pro-forma risulta "non ancora disponibile" (503 `NOT_CONFIGURED`), invece di dare un 500. Si imposta solo quando Connect è attivo |
| `OPS_ALERT_EMAIL` | avviso: assente, fallback su `ADMIN_EMAIL` | Facoltativa |
| `PREVAI_BASE_URL` (Production, di luglio) | avviso: valore da controllare | È origine fidata dell'auth e base dei link in email e WhatsApp. Deve essere `https://prevai.it`: se è `www`, i link passano da un 308 in più |
| Produzione v1 vista da fuori (healthz, healthz/db, www→apex 308, CORS dal sito di un'impresa, widget sull'apex) | OK | — |
| DB (sezione 7 dello script) | provata solo su staging | Lunedì col DB vero (§1 punto 3) |

Lo script è stato provato su staging in tre casi: DB v1 non migrato (OK, 24 tabelle), DB già migrato (avviso, 88 tabelle) e CA sbagliata (KO `certificate verify failed`).

**Aggiornamento 26/9, tarda sera:**
- `v2` pushato (`2130be241`); preview nuova `prevai-9aqyn01zy-…`, con il widget sull'apex.
- Smoke in sola lettura verde:
  - healthz e healthz/db 200;
  - home, `/preventivi/idraulico/`, `/preventivi/imbianchino/milano/`, un articolo del blog e `/fisco/`: tutti 200 con canonical `https://prevai.it/…`;
  - `/seo/imbianchino/` → 308 verso `/preventivi/imbianchino/`;
  - `GET /api/public/incentives` 200.
- Il preflight ora dà **1 KO**: la CA Supabase.
- Restano per lunedì: il punto 2 (solo login admin, storico e PDF, che richiedono le credenziali del titolare), il punto 3 e i punti 5–7.
- Promuovere martedì **l'ultima preview di `v2`**: il preflight la trova da solo e ne controlla il widget.

## 1. Lunedì 28/9 (T-1)

Chi: **T** = titolare, **C** = Claude. Claude non inserisce chiavi né password, e non fa push, promote o scritture sulla prod senza un "vai" esplicito in chat per quel passo.

1. **C, su ok di T: push di `v2`.** Aggiorna solo la preview, non la produzione. Poi, quando il deploy è pronto, il preflight deve dare OK alla sezione 6 (widget della preview sull'apex).
2. **C: smoke della preview nuova in sola lettura**, come RUNBOOKS §5.2 punto 2: healthz, home, 3 URL SEO con canonical sull'apex, `/seo/imbianchino/` → `/preventivi/imbianchino/`, login admin, un preventivo storico e il suo PDF. **Non creare dati**: il DB di produzione non è ancora migrato.
3. **T: certificato Supabase.** Supabase → Project Settings → Database → SSL Configuration → *Download certificate*, salvarlo come `C:\Users\Admin\PrevAI-backups\supabase-ca.crt`. Poi comporre `$URL` come in RUNBOOKS §5.3 e lanciare `CUTOVER_DB_URL="$URL" bash scripts/cutover-preflight.sh`. Atteso in sezione 7: `select 1` OK e "schema v1 non ancora migrato (24 tabelle)". Se la connessione fallisce per il certificato, martedì si usa il piano B di RUNBOOKS §5.3 (`sslmode=require`, e `no-verify` solo per il drift) e lo si annota.
4. **Vercel, già fatto il 26/9.** `PREVAI_BASE_URL` = `https://prevai.it`, confermato dal titolare. `STRIPE_CONNECT_WEBHOOK_SECRET` **non si imposta**: Connect non è attivo, e un valore finto riaccenderebbe il pulsante del pagamento con carta, che poi darebbe errore. Quando Connect sarà attivo: endpoint "Account connessi" su `https://prevai.it/api/payments/connect-webhook` con gli eventi `checkout.session.completed` e `account.updated`, poi il `whsec_` su Vercel (Production e Preview) e un nuovo deploy. Le variabili cambiate valgono dal deploy successivo: vanno impostate **prima** del push del punto 1, oppure bisogna rifare il deploy della preview.
5. **T: Stripe live** (account `acct_1QtrTCCaDBaDETvn`). I 13 Price esistono già. Resta il controllo di RUNBOOKS §5.2 punto 3: i Price storici di Starter e Pro devono essere 19 e 49 €, non 29.
6. **T: `TOKEN_ENCRYPTION_KEY` nel password manager.** Serve martedì al passo 11 (cifratura degli IBAN) e per un'eventuale decifratura dopo un rollback. Se si perde, gli IBAN cifrati e i token OAuth non si recuperano più.
7. **T: approvare il testo dell'avviso agli utenti** (§6), o cambiarlo.
8. **Target del rollback, già fissato:** il deployment di produzione attuale `https://prevai-l42sqwhz9-youssefbouchtaoui-4103s-projects.vercel.app`, da `main` `aa5c74036` con l'hotfix del widget (alias `prevai.it` e `www.prevai.it` al 26/9). **Non** tornare a un deployment più vecchio di `f9acdf4e1`: riaprirebbe il guasto dei lead. Se lunedì esce un altro deploy di `main`, questo punto va aggiornato.

**Go/no-go di lunedì sera:** preflight completo (con `CUTOVER_DB_URL`) a **0 KO**, e gli avvisi letti uno per uno. Se resta un KO, il cutover si sposta: v1 continua a funzionare, non c'è niente da annullare.

## 2. Martedì 29/9: finestra

I numeri dei passi sono quelli di RUNBOOKS §5.3. Tempi stimati dalla prova generale del 26/9 (8 migrazioni in circa 1,5 s su una copia della prod).

| Ora | Passo | Chi | Atteso | Se non torna |
|---|---|---|---|---|
| 06:40 | Preflight completo (`CUTOVER_DB_URL`) | C o T | 0 KO | **Stop.** Nulla da annullare |
| 07:00 | **1** dump + `pg_restore --list` + `sha256sum` | C o T | 24 `TABLE DATA`, file > 150 KB | **Stop.** Nessuna migrazione senza dump verificato |
| 07:03 | **2** `reconcile-before.txt` | C o T | file con 24 conteggi + 6 checksum | Stop |
| 07:05 | **3** migrazioni 0001 → 0008, una per volta, `ON_ERROR_STOP=1 -1` | C o T | ogni file finisce con `COMMIT`, nessun `ERROR` | Una transazione fallita non lascia nulla a metà: fermarsi, leggere l'errore. v1 resta live. Non andare avanti coi file successivi |
| 07:06 | **4** `reconcile-after.txt` + `diff` | C o T | nessuna differenza | Vedi §3 (differenze ammesse) |
| 07:08 | **5** drift v2 ↔ prod | C o T | 0 fatali | Stop prima del promote; v1 resta live sul DB migrato (additivo, provato in V2-3) |
| 07:10 | **6** smoke di v1 sul DB migrato | T | login, lista, apertura, un preventivo AI di prova (da cancellare poi) | Se v1 si rompe sul DB migrato: è un caso mai visto in prova, fermarsi. Il DB non si ripristina dal dump (RUNBOOKS §5.4) |
| 07:15 | **7** smoke della **preview nuova** sul DB migrato | C + T | login admin, storico, PDF, `/p/:id` con incentivi, `GET /api/public/incentives`, un preventivo manuale di prova (poi archiviato) | Stop: niente promote, v1 resta in produzione |
| 07:25 | **Go/no-go del promote** | T | passi 1–7 verdi, e il deployment da promuovere è quello del punto 1 di lunedì (il suo `widget.js` è sull'apex) | Rimandare. v1 funziona sul DB migrato |
| 07:30 | **8** promote della preview | T (o C su "vai" esplicito) | `prevai.it` serve v2 | Rollback (§4) |
| 07:32 | **9** controlli dopo il promote, **incluso il widget da un'origine esterna** | C | healthz e healthz/ops 200, login, storico, cron tick manuale, test event Stripe su entrambi gli endpoint, CORS 204 da `www.rba-edilizia.it`, console pulita su quel sito | Rollback se cade login, healthz/db o il widget |
| 07:45 | **11** cifratura degli IBAN: dry run → `--apply` → dry run | T (la chiave è sua) | `0 plaintext` | Non blocca: si può rifare più tardi. **Solo dopo il promote** |
| 07:55 | **10** avviso agli utenti (§6), apertura del monitoraggio (§5) | T | — | — |
| 08:00 | Diario in `PIANO-AZIONE.md`: orari, hash del dump, esito di ogni passo, eventuali deviazioni | C | — | — |

Nel passo 9 il preflight rifatto dopo il promote deve dare OK alle sezioni 5 e 7. La sezione 7 segnalerà "tabelle v2 già presenti", ed è corretto a quel punto. La sezione 6 non conta più.

## 3. Differenze ammesse nel diff del passo 4

Tra il passo 2 e il passo 4 v1 resta live, quindi il traffico può muovere qualche conteggio.

- **Ammesse, se spiegabili col traffico di quei minuti:** `count auth_session`, `count auth_verification`, `count conversations`, `count messages`, `count email_events`, e i checksum `md5 conversations` / `md5 messages` quando è cambiato anche il conteggio corrispondente. Si annota nel diario e si va avanti.
- **Non ammesse:** qualsiasi differenza in `md5 quotes`, `md5 auth_user`, `md5 business_profiles` o `md5 incentives_catalog` che non corrisponda a un nuovo preventivo o a un nuovo utente in quei minuti. La migrazione non tocca quei dati: una differenza vuol dire che qualcosa li ha cambiati. Stop e indagine prima del promote. Il DB resta migrato (è additivo), v1 continua a girare.
- Per non dubitare, conviene rilanciare il passo 2 subito prima del 3, così la finestra tra i due file è di pochi secondi.

## 4. Rollback

Quando: nelle prime 48 ore, se il login non funziona, se `/api/healthz/db` non risponde 200 per più di 5 minuti, se il widget torna a dare errori CORS dai siti delle imprese, se i PDF storici non si aprono, oppure se Stripe segnala webhook falliti che non si risolvono.

Come (RUNBOOKS §5.4, meno di 1 minuto): Vercel → Deployments → `prevai-l42sqwhz9-…` (vedi §1 punto 8) → *Promote to Production*. **Nessuna azione sul database.** Se il passo 11 è già stato fatto, v1 non legge `business_profiles.iban` (colonna nata in v2), quindi non se ne accorge. Dopo il rollback: diario, e il tentativo successivo riparte dal passo 7.

## 5. Monitoraggio delle 48 ore

| Quando (ora italiana) | Cosa guardare |
|---|---|
| 07:45, 08:30 | Vercel → Logs filtrati per `level:error`; `/api/healthz/ops` 200 |
| 10:00 | Stripe → Webhooks: consegne degli ultimi 3 h tutte 2xx; Resend: email partite (benvenuto, preventivi) senza bounce anomali |
| **14:05** | Primo cron **automatico** (`0 12 * * *` UTC = 14:00 ora legale). `select started_at, ok, took_ms, error from cron_ticks order by started_at desc limit 3;` → una riga delle 12:00 UTC con `ok = true` |
| 18:00 | Lead e preventivi dal widget arrivati dopo il promote: `select source, count(*) from quotes where created_at > '2026-09-29 05:30+00' group by 1;` e `select source, count(*) from leads where created_at > '2026-09-29 05:30+00' group by 1;`. Se ci sono visite sui siti delle imprese ma zero righe dal widget, riaprire la console su `www.rba-edilizia.it` |
| mer 30/9 09:00 | Log di errori della notte; il secondo cron (14:05) come sopra |
| gio 1/10 07:30 | Chiusura delle 48 ore: nessun rollback, cron ok per due giorni, webhook verdi. Poi riga 6 → ✅ in `PIANO-AZIONE.md`, e si passa a V2-6 (merge di `v2` in `main` solo allora: fino a quel momento `main` resta il ramo del rollback) |

Le query sono in sola lettura e girano con lo stesso `$URL` del passo 1 (`psql "$URL" -c "…"`).

## 6. Avviso agli utenti (bozza da approvare)

> **Oggetto:** PrevAI si è rinnovato
>
> Ciao {nome},
> da stamattina trovi PrevAI in una versione nuova: stesso indirizzo, stesso accesso, i tuoi preventivi sono tutti al loro posto.
> Cosa cambia: una dashboard ridisegnata, pro-forma e contratti da firmare online, cantieri e squadra, e l'assistente IA dentro ogni cantiere.
> Se qualcosa non ti torna, rispondi a questa email: la leggiamo noi.
> Il team PrevAI

Si manda dopo il passo 9 verde, non prima. Se il titolare preferisce non mandarlo lo stesso giorno, va bene: non è un requisito tecnico.

## 7. Registro della finestra (da compilare martedì)

| Passo | Ora inizio | Ora fine | Esito | Note (hash del dump, differenze del reconcile, deviazioni) |
|---|---|---|---|---|
| Preflight | | | | |
| 1 dump | | | | |
| 2 reconcile prima | | | | |
| 3 migrazioni 0001–0008 | | | | |
| 4 reconcile dopo | | | | |
| 5 drift | | | | |
| 6 smoke v1 | | | | |
| 7 smoke preview | | | | |
| 8 promote | | | | |
| 9 controlli dopo | | | | |
| 11 IBAN | | | | |
| 10 avviso | | | | |
