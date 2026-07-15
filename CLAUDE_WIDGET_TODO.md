# Widget Incentivi — Cose da Sistemare Più Tardi

Nota di lavoro creata dopo il code-review del 2026-07-15 sul motore
"Incentivi e Bandi Regionali" del widget PrevAI. Le correzioni urgenti
(calcolo hardcoded lato client, moltiplicatore `*0.55`, etichette
fuorvianti) sono già state applicate. Qui restano i problemi di fondo,
più ampi, rimandati apposta.

---

## 1. Il cron AI non verifica nulla di reale

**File:** [incentives.ts](artifacts/api-server/src/routes/incentives.ts) — `POST /admin/incentives/cron-sync`

Il "Daily AI Incentive Agent" chiama `gpt-4o-mini` chiedendogli di
confermare se i bandi in catalogo sono ancora attivi, ma la chiamata
non ha accesso a internet/browsing: il modello risponde solo dalla
sua conoscenza parametrica, non da una fonte ufficiale aggiornata.
Il risultato (`isVerifiedByAi: true`, `stato: "active"`) diventa poi
ciò che il widget mostra al cliente finale come dato affidabile.

**Da fare:** dare al cron accesso a retrieval/web search reale (es.
tool call che scarica `fonteUfficialeUrl` e ne estrae lo stato), o
in alternativa etichettare chiaramente il risultato del cron come
"controllo euristico preliminare", non come verifica.

## 2. `humanVerified` — ora modificabile da admin, ma non mostrato nel widget

**File:** [incentives.ts (schema)](lib/db/src/schema/incentives.ts), [incentives.ts (admin routes)](artifacts/api-server/src/routes/incentives.ts), [admin.tsx](artifacts/preventivo-ai/src/pages/admin.tsx)

Aggiornamento 2026-07-16: esiste ora `PATCH /api/admin/incentives/:id`
e un modale "Modifica" nel tab Incentivi dell'admin con checkbox
"Ho controllato personalmente questo bando" che imposta `humanVerified`.
Resta da fare:
- il widget pubblico (`WidgetFunnelDemo.tsx`) non legge/mostra ancora
  questo flag all'utente finale (nessun bollino "✓ verificato da un
  operatore" vs "in attesa di conferma umana");
- la migration va applicata al DB reale con `pnpm --filter @workspace/db push`
  (non ancora eseguita in produzione al momento di questa nota).

## 3. Dati seed del catalogo bandi mai validati contro fonti ufficiali

**File:** [incentives.ts](artifacts/api-server/src/routes/incentives.ts) — `ensureDefaultIncentives()`

I 10 bandi di partenza (Lombardia, Piemonte, Emilia-Romagna, Veneto,
Milano, Bologna, più i 4 bonus statali) hanno importi e percentuali
plausibili ma inseriti come placeholder iniziali, non verificati uno
per uno contro le pagine ufficiali linkate in `fonteUfficialeUrl`.
Vanno controllati manualmente (o tramite il fix del punto 1) prima
che il widget venga esposto a clienti reali su siti di imprese terze.

## 4. Nessuna scadenza (`scadenza`) valorizzata sui bandi a sportello

I bandi "a fondo perduto" per definizione esauriscono i fondi e
chiudono, ma il campo `scadenza` nello schema non viene mai
popolato nel seeder. Senza una data, non c'è modo automatico di
marcare un bando `closed` quando probabilmente lo è già.

## 5. GET /api/public/incentives non è ancora collegato al widget

Il widget oggi chiama solo `POST /api/public/quotes/:quoteId/incentives`
(il calcolo finale). L'endpoint di sola lettura `GET /api/public/incentives`
(lista bandi filtrata per regione/categoria, già implementato) non è
usato: potrebbe servire per mostrare in anteprima quali bandi esistono
prima ancora che l'utente completi il preventivo, o per la dashboard
admin/partner.

## 6. Distinzione prima casa / seconda casa / ufficio incompleta

Molti bonus statali reali si applicano solo alla prima casa o hanno
percentuali diverse per seconda casa; nel calcolo attuale
`tipoImmobile` incide solo sullo sconto IVA (`isResidenziale`), non
sulla percentuale del bonus statale stesso. Da rivedere quando si
formalizzano le regole normative reali.

## 7. Webhook Resend in ingresso — solo log, nessuna persistenza/UI

**File:** [app.ts](artifacts/api-server/src/app.ts) — `POST /api/webhooks/resend`

Aggiunto un endpoint che verifica la firma Svix e riceve gli eventi
di delivery/bounce/complaint da Resend. Al momento gli eventi vengono
solo loggati (`logger.warn` per bounce/complaint, `logger.info` per
il resto) — non c'è nessuna tabella che li persiste né una sezione
nell'admin dashboard per vederli nel tempo. Se un partner smette di
ricevere le notifiche lead perché la sua email rimbalza, oggi lo si
scopre solo guardando i log del server, non dall'app.

**Da fare prima che sia davvero operativo in produzione:**
- impostare `RESEND_WEBHOOK_SECRET` nell'env (va preso dalla dashboard
  Resend quando si configura l'endpoint webhook — non ancora fatto);
- registrare l'URL `https://<dominio>/api/webhooks/resend` nella
  dashboard Resend;
- valutare se serve persistere gli eventi (nuova tabella tipo
  `email_events`) per mostrare nell'admin/nel profilo del partner
  quando le sue notifiche falliscono.

## 8. Modulo CRM (`/crm`) — cantieri/lavoratori/fornitori ora reali, alcune feature rimosse

**File:** [crm.tsx](artifacts/preventivo-ai/src/pages/dashboard/crm.tsx), [crm.ts](artifacts/api-server/src/routes/crm.ts)

Aggiornamento 2026-07-16: cantieri, scadenze, collaboratori, fornitori,
costi extra, assegnazioni operai e generazione fattura (simulata) sono
ora collegati al backend reale invece che a `localStorage`. Nel farlo
sono state **rimosse** tre funzionalità che erano solo finte demo senza
alcun supporto nel DB, per non continuare a mostrare dati inventati:
- tracciamento ore lavorate per operaio (nessuna tabella le contiene;
  la UI "Lavoratori" mostrava ore aggregate finte);
- materiali acquistati e documenti/computo metrico per cantiere
  (nessuna tabella dedicata);
- l'"assistente AI" del cantiere (rispondeva con testo precotto via
  `setTimeout`, non chiamava nessun modello reale).

**Restano fuori scope** (non toccate, ancora `localStorage`):
- "Gestione Pratiche" (CILA/SCIA/APE) — nessuna tabella backend esiste;
- "Calendario Scadenze" — timeline completamente hardcoded, slegata
  dai dati reali dei cantieri.

Se servono materiali/documenti/ore lavorate reali, serve prima
decidere lo schema DB (nuove tabelle) prima di poter ricollegare
quelle sezioni.

---

*Aggiungi qui sotto altri punti scoperti durante il prossimo giro di lavoro.*
