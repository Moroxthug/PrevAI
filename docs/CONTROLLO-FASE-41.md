# Controllo completo — fase 41 (2026-09-28)

Richiesta del titolare: «aggiungi fase 41 a nuove fasi per tutto ciò che abbiamo dimenticato, funzioni che mancano, un check completo per assicurarci che tutto va bene, code, security ecc.»

Questo file è il rapporto del controllo. Le cose da fare sono diventate le righe **40 e 42–56** di `PIANO-AZIONE.md`; qui c'è il perché di ognuna.

## 1. Controlli automatici (su `main`, staging locale)

| Controllo | Esito |
|---|---|
| `pnpm typecheck` (librerie, API, app, script) | ✅ 0 errori |
| `pnpm lint` | ✅ 0 errori, 67 avvisi (quasi tutti `any` esplicito) → riga 48 |
| `pnpm test` (unit API) | ✅ 426/426 |
| `pnpm test:e2e` (staging) | ❌→✅ 150/151: il test anti‑IDOR aveva **6 route senza dati di prova** (fornitori ×2, versamenti, note del cantiere, home per ruolo ×2), quindi quelle route non erano davvero verificate. **Sistemato qui**: dati di prova aggiunti, `:kind` escluso perché non identifica niente; ora 21/21 nel file di sicurezza |
| `qa:pdf` | ✅ 44 PDF generati, lint IA/inglese pulito |
| `route-matrix` | ✅ `ROUTE-MATRIX.md` allineato al codice |
| `pnpm audit --prod` | 🟨 1 vulnerabilità **bassa**: esbuild < 0.28.1 (solo sviluppo, via drizzle-kit) → riga 44 ✅ 28/9 (0.28.2) |
| `knip` | 🟨 20 file inutilizzati (audio/batch/image delle integrazioni OpenAI, `ui/form.tsx`, `ui/select.tsx`), 159 export e 63 tipi inutilizzati; la configurazione di knip non trova i propri entry su Windows → riga 48 |
| Segreti nel repo | ✅ nessuna chiave nei file tracciati; `.env*` ignorati |
| TODO/FIXME nel codice | ✅ nessuno aperto |
| Non rilanciati | `qa:visual` e `qa:phone` (16 min, verdi alla riga 30), Lighthouse |

## 2. Produzione (solo lettura, 28/9)

- `/api/healthz` 200 (1,9 s a freddo), `/api/healthz/ops` 200, home 0,2 s, `www` → apex 308, sitemap 344 URL, `widget.js`, `sw.js`, manifest ok.
- Intestazioni di sicurezza della pagina complete (CSP con hash, HSTS preload, nosniff, frame-ancestors, Permissions-Policy).
- **Soft 404**: un indirizzo inesistente (`/pagina-inesistente-xyz/`) risponde **200** con `canonical` sulla home e `index, follow`. Google lo tratta come duplicato della home → riga 47.
- Variabili d'ambiente di produzione (solo nomi): **mancano `SENTRY_DSN`/`VITE_SENTRY_DSN`** (oggi nessun errore di produzione arriva a nessuno), `VAPID_*` (notifiche push spente), le chiavi di WhatsApp/Meta/Google/Outlook (integrazioni spente, voluto) → riga 40.

## 3. Revisione di sicurezza del codice

Fatta in sola lettura su middleware, rotte, assistente, upload, email, log. Già coperti dai test: intestazioni, CORS, IDOR su tutte le route con parametro, firme dei webhook, cron, archivio privato.

### Sistemato in questa fase
1. **ALTA — XSS salvato tramite logo SVG.** Un logo `.svg` con `<script>` era servito da `prevai.it/api/storage/public-objects/…` come `image/svg+xml` senza CSP: chi apriva il link eseguiva lo script sul dominio dell'app, con i cookie della vittima. Ora ogni file caricato (pubblico e privato) esce con `X-Content-Type-Options: nosniff` e, tranne i PDF (Chrome non li apre sotto sandbox), con `Content-Security-Policy: default-src 'none'; …; sandbox`. Test e2e nuovo: carica un SVG con script e verifica le intestazioni.
2. **BASSA — localhost fidato in produzione.** `http://localhost:5000/3000` erano sempre fra le origini fidate di better-auth (redirect dei link di reset verso un programma locale). Ora solo fuori produzione. Da ricordare in APP-3: il guscio Capacitor avrà la sua origine, da aggiungere esplicitamente.

### Da fare (righe nuove)
| # | Gravità | Cosa | Riga |
|---|---|---|---|
| 2 | MEDIA | L'assistente può far partire una fattura senza conferma: `milestone_update` è "lo fa" e, se la tappa diventa *completata*, l'automazione crea il SAL e lo invia quando l'invio automatico è acceso. Aggira la regola "soldi = chiede". | 42 ✅ 28/9 |
| 4 | MEDIA | La lista dei "contatti noti" di `message_client` si riempie dal widget pubblico: un testo iniettato in una richiesta può far proporre una mail con dati dell'impresa a un indirizzo dell'attaccante (serve comunque un tocco, ma basta un "sì" a voce). `update_client` può essere messo su "lo fa" e cambiare l'email di un cliente. | 42 ✅ 28/9 |
| 3 | MEDIA | Limiti di velocità in memoria per istanza Vercel: login, 2FA, OTP di firma, generazione pubblica con l'IA, chat. Si azzerano a ogni avvio a freddo e si moltiplicano per istanza; il limite per utente è in realtà per impresa; chi ha la chiave pubblica del widget può esaurire il widget di un'impresa. Nessun tetto mensile ai costi IA. | 43 ✅ 28/9 |
| 5 | BASSA/MEDIA | I token pubblici (`/api/sign/<token>`, `/api/i/…`, `/api/t/…`, `/api/commercialista/…`, invito) finiscono in chiaro nei log e nel tracciamento errori. | 44 ✅ 28/9 |
| 6 | BASSA | `logoUrl` accetta qualsiasi stringa: HTML iniettabile nelle email inviate da `no-reply@prevai.it`; il PDF può includere immagini di un'altra impresa conoscendone il percorso. | 44 ✅ 28/9 |
| 7 | BASSA | SSRF cieco: URL dei webhook dei clienti e endpoint push non filtrati (IP privati, reindirizzamenti). | 44 ✅ 28/9 |
| 8 | BASSA | Il webhook SdI del provider simulato accetta richieste senza segreto. | 44 ✅ 28/9 |
| — | sospetto | Webhook Stripe Connect senza controllo che `event.account` sia dell'impresa della fattura; accesso admin senza 2FA; le chiavi API ignorano la 2FA dell'impresa; ~~il canale "voce" della conferma è dichiarato dal client~~ (verificato dal server in riga 42); l'UUID del preventivo è anche il suo link pubblico, senza scadenza né revoca; pdfmake senza politica di accesso URL. | 44 ✅ 28/9 (Connect, 2FA admin, pdfmake) · 45 ✅ 28/9 (link del preventivo, chiavi API) |
| — | non visto | Rotte WhatsApp (~1.400 righe), scritture dell'API pubblica v1, renderer del blog, impostazioni dei bucket Supabase (elenco pubblico, limite di dimensione dell'upload firmato). | 45 ✅ 28/9 (sotto) |

### Trovato e sistemato in SEC-4 (riga 45, 28/9)
| Gravità | Cosa | Com'è ora |
|---|---|---|
| ALTA | **XSS salvato dalla firma disegnata.** Il controllo del PNG decodificava il base64 con Node, che si ferma al primo `=`: un PNG valido seguito da `"><img onerror=…>` passava e finiva in `<img src="…">` della pagina del contratto. Chi firma dal link pubblico poteva far girare codice nella dashboard dell'impresa (con i suoi cookie). In produzione nessuna firma disegnata finora. | Solo alfabeto base64 con padding in fondo; il renderer ricontrolla ed escapa. |
| MEDIA | **Id di un'altra impresa nel corpo delle richieste.** `clientId` in "nuovo cantiere" (app e API v1) e "nuova fattura" (app e API v1) non veniva controllato: il cantiere o la fattura mostravano poi nome, indirizzo, email e P. IVA del cliente dell'altra impresa. Stesso difetto, meno grave, per `quoteId` del vecchio modulo CRM e per la fase (`milestoneId`) quando si collega una fattura d'acquisto a un cantiere. | 404 se l'id non è dell'impresa; le letture del dettaglio cantiere e del contesto fattura filtrano anche per impresa. |
| MEDIA | **Bonus del widget senza chiave.** `POST /api/public/quotes/:id/incentives` accettava qualunque id di preventivo (anche bozze): riscriveva i dati incentivi e mandava due email a nome dell'impresa. | Serve la chiave del widget dell'impresa, preventivo nato dal widget nelle ultime 24 ore. |
| MEDIA | **Link del preventivo = UUID**, senza scadenza né revoca. | Link firmato e revocabile, scadenza 180 giorni dall'ultima condivisione (migrazione 0016). Link vecchi validi 180 giorni dalla soglia (29/9 o prima condivisione dopo la migrazione) salvo revoca. |
| MEDIA | **Chiavi API sganciate dal creatore:** chi usciva dal team o cambiava ruolo teneva una chiave funzionante; la 2FA obbligatoria dell'impresa non contava. | La chiave segue il creatore (nel team, stesso ruolo, 2FA se richiesta). Decisione: nessuna 2FA per richiesta. |
| BASSA | **Upload firmato senza limiti** (`/api/storage/uploads/request-url`, non usato) e bucket senza limiti di dimensione o tipo. | Rotta tolta; script `ops:storage-buckets` (2 MB solo immagini per i loghi, 25 MB per il privato). Elenco pubblico: nessuna policy RLS, chiuso. |
| BASSA | WhatsApp: codice di collegamento con `Math.random`, nessun limite a richieste e tentativi (la richiesta manda un WhatsApp a un numero qualsiasi). | `crypto.randomInt`, 5 richieste/ora e 10 tentativi/15 min. La firma del webhook era già verificata. |
| BASSA | Email: numero del preventivo e link delle recensioni non escapati; oscuramento dei token nei log non copriva il nuovo formato del link. | Escapati; regex estesa. |

Visto e a posto: il blog è testo scritto da noi nel codice (nessun input esterno); il webhook WhatsApp verifica la firma di Meta prima di leggere il corpo; le scritture dell'API v1 passano per `requirePermission` e filtrano per impresa (a parte i due `clientId` sopra).

Verificato e a posto: elenchi filtrati per impresa, `requirePermission` su ogni scrittura, cambio impresa col cookie ricontrollato a ogni richiesta, inviti e link pubblici con token da 32 byte salvati come hash e con scadenza, chiavi API in SHA‑256, strumenti dell'assistente ricontrollati per impresa e ruolo alla conferma, OAuth con stato HMAC, niente SQL costruito a mano su input, bundle senza segreti, email con i campi dei clienti escapati, campi fiscali e token OAuth cifrati.

## 4. Cosa manca rispetto a quanto promesso o a QuoteAI

- **Esporta i miei dati** (GDPR art. 20): la privacy lo promette, non c'è un modo in autonomia (QuoteAI Phase 72 lo ha) → riga 46.
- QuoteAI 72–120 non portate (PrevAI è partita dalla Phase 71; le 100–113 sono state portate come APP-1):
  - utili in Italia → righe 49–56: 75/85/109 agenda dei lavori e calendario, 76 portale del cliente, 79 controllo prezzi del preventivo, 83/84/120 lettori di schermo, posizione di scorrimento, sensazione da app, 86/86b/108 app della squadra, 91/95 posti, codici d'accesso, chi ha inviato/vinto, 115 budget di prestazioni, 116/117 dati offline e sincronizzazione.
  - **escluse** perché canadesi o già coperte: 73 (identità legale/Connect fee → già in `piani.ts`), 74 SMS/CASL, 87 scadenze (c'è il modulo Fisco), 88 QuickBooks, 89 paghe per provincia, 90 gruppi di imprese (da riconsiderare se un cliente lo chiede), 93/98/99 (lavoro operativo di QuoteAI), 118/119 (sono APP-3/APP-4).
- Lista del titolare ancora aperta: migrazioni 0011, 0012, 0014 in produzione, `VAPID_*`, Sentry, verifica dei backup → riga 40.
