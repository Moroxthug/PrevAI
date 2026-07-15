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

## 2. `humanVerified` esiste nello schema ma non è ancora usato

**File:** [incentives.ts (schema)](lib/db/src/schema/incentives.ts)

Il campo booleano è stato aggiunto (default `false`) ma:
- non c'è ancora un'interfaccia admin per marcarlo manualmente vero
  dopo che qualcuno ha controllato la fonte ufficiale a mano;
- il widget/frontend non lo legge né lo mostra all'utente finale
  (es. bollino "✓ verificato da un operatore" vs "in attesa di
  conferma umana").
- La migration va applicata al DB reale con `pnpm --filter @workspace/db push`
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

---

*Aggiungi qui sotto altri punti scoperti durante il prossimo giro di lavoro.*
