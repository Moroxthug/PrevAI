# APP-6: kit per la pubblicazione su App Store e Google Play

Riga 21 del piano (`docs/PIANO-AZIONE.md`), fase APP-6 di `docs/APP-PLAN.md` §5.
Preparato il 27/9/2026, prima che esista l'app nativa: qui c'è tutto ciò che si può scrivere e controllare adesso. **L'invio agli store lo fa il titolare, dopo il suo ok esplicito**, quando le fasi sotto (§1) sono chiuse.

## 1. Cosa manca prima dell'invio (in ordine)

| # | Serve | Riga del piano | Perché blocca |
|---|---|---|---|
| 1 | Decisioni D12–D16 e account Apple Developer (organizzazione, D-U-N-S) e Google Play Console | 15 (APP-0) | senza account non esiste una scheda |
| 2 | ~~Cancellazione dell'account dentro l'app~~ ✅ 27/9/2026 | 23 (APP-1c) | fatta: Impostazioni → Il tuo accesso → Elimina account (password + ELIMINA, 30 giorni di grazia). In produzione serve la migrazione 0010 (RUNBOOKS §13), senza la quale il pulsante rimanda a privacy@prevai.it |
| 3 | Guscio nativo Android e iOS (Capacitor) | 18 (APP-3) | è il binario che si carica |
| 4 | Funzioni native (foto, condivisione PDF, push) | 19 (APP-4) | senza, Apple tende a rifiutare con la 4.2 "funzionalità minima" (app = sito impacchettato) |
| 5 | Beta di due settimane con le imprese pilota | 20 b (APP-5) | "fatto quando" di APP-5; Google chiede comunque un test chiuso prima della produzione per gli account sviluppatore nuovi (verificare le regole in vigore all'apertura dell'account) |
| 6 | Ok esplicito del titolare | 21 | la pubblicazione è pubblica e irreversibile nei tempi (le schede restano indicizzate) |

Due regole da rispettare già in APP-3, perché cambiano le risposte dei §6–7:
- **Niente vendita nell'app** (D13, raccomandato): nell'app iOS nessun prezzo, nessun pulsante "Abbonati" o "Passa a Pro", nessun link al checkout. Chi non ha un piano vede "Gestisci il tuo account su prevai.it" solo se le linee guida in vigore in Italia lo permettono (da rileggere all'avvio di APP-3, APP-PLAN §3).
- **Niente Google Analytics dentro il guscio**: `index.html` carica gtag (`G-D2B39E0ELW`) per il sito. Nel guscio va saltato (es. se `window.Capacitor` esiste) così le etichette restano "nessun tracciamento" e non serve il banner ATT di Apple. Il cambio tocca uno script inline con hash nella CSP: va fatto in APP-3 insieme a `pnpm --filter @workspace/api-server csp-hashes`.

## 2. Cosa è già pronto (27/9/2026)

| Pezzo | Dove |
|---|---|
| **Cancellazione dell'account in autonomia** (APP-1c): Impostazioni → Il tuo accesso → Elimina account; avviso in cima alla dashboard durante i 30 giorni | `pages/dashboard/settings/delete-account.tsx`, API `/api/account/deletion`, cron, RUNBOOKS §13 |
| Guida pubblica **"Cancellare l'account e i dati"** (link di eliminazione richiesto da Google Play) | `/help/delete-account/` — `src/data/help-articles.ts`, anche nella sitemap e nel bot di supporto |
| Privacy Policy aggiornata: dati d'uso dell'app, "Segnala un problema", Sentry fra i destinatari, link alla guida di cancellazione | `/privacy/` — `src/pages/privacy-policy.tsx` |
| Registro dei trattamenti v1.4 (T4 comprende eventi e segnalazioni dell'app) | `docs/compliance/REGISTRO-TRATTAMENTI.md` |
| Script che riempie l'account demo del revisore | `pnpm --filter @workspace/api-server ops:demo-revisore` (§5) |
| Testi delle schede, etichette privacy, note per il revisore | questo file, §3–§8 |
| Eventi d'uso, segnalazioni, Sentry per superficie | APP-5 a, `docs/APP-BETA-KIT.md` |

Le modifiche alla Privacy Policy sono chiarimenti (nessun trattamento nuovo oltre a quelli di APP-5 a, già attivi dopo la migrazione 0009). Se il titolare le considera sostanziali, la Policy §9 chiede 14 giorni di preavviso agli utenti: vanno mandati prima della pubblicazione negli store, non dopo.

## 3. Indirizzi da mettere nelle schede

| Campo | App Store Connect | Google Play Console | Indirizzo |
|---|---|---|---|
| Privacy | Privacy Policy URL | Norme sulla privacy | https://prevai.it/privacy/ |
| Supporto | Support URL | Sito web + email di contatto | https://prevai.it/contatti/ — info@prevai.it |
| Marketing | Marketing URL (facoltativo) | — | https://prevai.it/ |
| Cancellazione account | — (serve dentro l'app) | Sicurezza dei dati → URL per l'eliminazione dell'account | https://prevai.it/help/delete-account/ |
| Copyright | Copyright | — | © 2026 {ragione sociale del titolare} |

## 4. Testi delle schede (italiano)

Limiti controllati con lo script in fondo (§10). Niente prezzi né inviti a comprare: vale D13, e i prezzi cambiano solo in `lib/config/src/piani.ts`.

**Nome app** (Apple ≤ 30, Play ≤ 30): `PrevAI – Preventivi edili`

**Sottotitolo** (solo Apple, ≤ 30): `Preventivi, cantieri e fatture`

**Descrizione breve** (solo Play, ≤ 80): `Preventivi edili con l'AI in due minuti, poi firma, cantiere e pagamenti.`

**Testo promozionale** (solo Apple, ≤ 170, si cambia senza nuova revisione): `Descrivi il lavoro a voce o con una foto dal cantiere: PrevAI scrive il computo metrico con le tue voci e i tuoi prezzi, pronto da inviare al cliente.`

**Parole chiave** (solo Apple, ≤ 100, separate da virgola senza spazi): `preventivo,computo metrico,edilizia,artigiano,impresa,cantiere,fattura,ristrutturazione,capitolato`

**Descrizione** (Apple e Play, ≤ 4000):

```
PrevAI è il gestionale per imprese edili e artigiani che fa il preventivo al posto tuo.

Descrivi il lavoro come lo diresti a un collega, a voce, per iscritto o con una foto: PrevAI scrive il preventivo con capitoli, voci, quantità e prezzi, usando il tuo listino. Lo controlli, lo correggi e lo mandi al cliente in due minuti, anche dal cantiere.

PREVENTIVI
• Computo metrico con capitoli e voci, IVA ordinaria o agevolata
• Il tuo logo e i tuoi dati su ogni PDF
• Il cliente apre il link, sceglie la variante e accetta online
• Solleciti automatici se il cliente non risponde

CONTRATTI E FIRMA
• Contratto d'appalto preparato dal preventivo accettato
• Firma elettronica del cliente con codice via email, con certificato

CANTIERI
• Fasi, costi, foto e note di ogni cantiere
• Ore della squadra e scontrini fotografati

SOLDI
• Fatture di acconto, SAL e saldo collegate al preventivo
• Promemoria di pagamento e stato degli incassi
• Con PrevAI Fisco: fatture elettroniche, scadenze e F24

SQUADRA
• Titolare, ufficio, capocantiere: ognuno vede quello che gli serve

Oggi, appena apri l'app, trovi quello che aspetta te: preventivi da mandare, clienti da richiamare, pagamenti in ritardo.

Serve un account PrevAI. Stesso account e stessi dati del sito prevai.it.

Database e file su server nell'Unione Europea (Irlanda). Privacy: https://prevai.it/privacy/
```

**Categoria:** Apple primaria *Business*, secondaria *Produttività*. Play *Business*.
**Paese:** solo Italia al primo rilascio (l'app è solo in italiano e il fisco è italiano).
**Dispositivi Apple:** solo iPhone (niente iPad al primo rilascio: con l'iPad Apple chiede anche gli screenshot iPad e il controllo del layout largo).

## 5. Account demo per il revisore

Apple e Google devono poter entrare. L'account demo:
1. Il titolare crea una casella sua (es. `revisione@prevai.it`), si registra dal sito con quella, conferma l'email e completa l'onboarding con dati d'esempio (ragione sociale tipo "Edilizia Esempio Srl", nessuna P. IVA vera di terzi).
2. **Niente 2FA** su quell'account (il revisore non ha il telefono) e nessun modulo Fisco attivo (chiede la 2FA obbligatoria).
3. Riempirlo con dati finti ma realistici — lo script non crea utenti e non tocca password, si ferma se l'account ha già preventivi:
   ```bash
   DATABASE_URL=… pnpm --filter @workspace/api-server ops:demo-revisore --email revisione@prevai.it
   DATABASE_URL=… pnpm --filter @workspace/api-server ops:demo-revisore --email revisione@prevai.it --apply
   ```
   Crea 3 clienti (email `@demo.invalid`, nessuna email parte), 3 preventivi (accettato, inviato, bozza) e 4 voci di listino. Provato sullo staging il 27/9/2026: prova a vuoto, scrittura, rifiuto al secondo giro.
4. Il piano: al revisore deve funzionare "Nuovo preventivo". Se il piano gratuito lo limita, assegnare all'account un piano dal pannello admin (`POST /api/admin/grant-plan`), **senza** passare da Stripe.
5. Email e password le scrive il titolare in App Store Connect (App Review Information → Sign-in required) e in Play Console (Contenuti dell'app → Accesso all'app). Non vanno in questo repo.
6. Dopo ogni revisione: controllare che il revisore non abbia lasciato dati strani e che la password sia ancora quella scritta negli store.

## 6. Etichette privacy di Apple (App Privacy)

Ricavate dal codice al 27/9/2026, valide **se** in APP-3 si rispettano le due regole del §1 (niente gtag nel guscio, niente vendita in app). **Tracciamento: No.** Tutti i dati sotto sono *collegati all'utente* (servono all'account dell'impresa); nessuno è usato per pubblicità.

| Tipo di dato (Apple) | Raccolto? | Scopo | Da dove viene nel codice |
|---|---|---|---|
| Informazioni di contatto → Nome, Email, Numero di telefono, Indirizzo fisico | sì | Funzionalità dell'app | account, profilo aziendale, rubrica clienti (dati dei clienti dell'impresa) |
| Informazioni finanziarie → Altre informazioni finanziarie | sì | Funzionalità dell'app | IBAN dell'impresa (cifrato), importi di preventivi e fatture |
| Informazioni finanziarie → Informazioni di pagamento | **no** nell'app | — | le carte le vede solo Stripe, sul sito |
| Posizione → Posizione precisa | sì, solo se si usa la timbratura GPS o la posizione del cantiere | Funzionalità dell'app | cantieri (`geofence`), link ore operai |
| Contenuti dell'utente → Foto o video | sì | Funzionalità dell'app | foto del preventivo e del cantiere, scontrini |
| Contenuti dell'utente → Dati audio | sì, se si detta | Funzionalità dell'app | dettatura del preventivo (`routes/speech.ts`) |
| Contenuti dell'utente → Assistenza clienti | sì | Funzionalità dell'app | "Segnala un problema" (`app_feedback`), bot di supporto |
| Contenuti dell'utente → Altri contenuti dell'utente | sì | Funzionalità dell'app | preventivi, contratti, note |
| Identificatori → ID utente | sì | Funzionalità dell'app, Analisi | id account; negli eventi `app_events` |
| Dati di utilizzo → Interazione con il prodotto | sì | Analisi | `app_events`: app aperta, preventivo creato, condiviso |
| Diagnostica → Dati sugli arresti anomali, Altri dati diagnostici | sì, quando c'è il DSN Sentry | Funzionalità dell'app | Sentry con tag `surface` |
| Contatti (rubrica del telefono), Cronologia di navigazione, Cronologia ricerche, Dati sanitari, Dati sensibili | **no** | — | — |

Se APP-4 aggiunge le **push**, i token del dispositivo non sono una categoria a sé per Apple (restano "Funzionalità dell'app"); ricontrollare comunque la tabella a ogni plugin nativo nuovo.

## 7. Sicurezza dei dati di Google Play (Data safety)

- **Raccolta:** sì, stesse categorie del §6 (Informazioni personali: nome, email, indirizzo, telefono; Informazioni finanziarie: altre; Posizione: precisa, facoltativa; Foto; Audio: registrazioni vocali, facoltativa; Messaggi/altro: contenuti generati dall'utente; Attività nell'app: interazioni; Informazioni e prestazioni dell'app: arresti anomali e diagnostica; Identificatori: ID utente).
- **Condivisione con terze parti:** no — i fornitori del registro (Supabase, Vercel, Resend, Groq/OpenAI, Sentry, Stripe) sono *fornitori di servizi* che trattano per conto nostro, e Google non li conta come condivisione.
- **Scopo:** Funzionalità dell'app; Analisi solo per interazioni e diagnostica.
- **Facoltativi:** posizione e audio (l'utente può usare l'app senza).
- **Cifrati in transito:** sì (solo HTTPS).
- **Richiesta di cancellazione:** sì — URL del §3.
- **Pubblico di destinazione:** 18+ (uso professionale); nessun contenuto rivolto a bambini.
- **Classificazione dei contenuti (IARC):** app business senza contenuti generati condivisi pubblicamente, niente acquisti in app, niente pubblicità → PEGI 3 / "Per tutti". In Apple: fascia 4+.
- **Annunci:** l'app non contiene pubblicità.

## 8. Note per il revisore (App Review Notes, in inglese)

```
PrevAI is a business app for Italian construction companies and tradespeople: they describe a job (text, voice or photo) and the app drafts a priced quote, then handles e-signature, job sites and invoices. The app is in Italian only and distributed in Italy.

Demo account (pre-filled with sample customers and quotes): credentials in the Sign-in section.
Try: "Preventivi" tab → open "Laura Rossi" (accepted quote) or tap "+" → "Nuovo preventivo", type "rifare bagno 6 mq con piastrelle" and generate.

Native features: camera for job-site photos and receipts, share sheet for the quote PDF, push notifications when a customer opens or accepts a quote.

Accounts and subscriptions are managed on our website (multiplatform service, guideline 3.1.3(b)); the app does not sell or link to any purchase.
Account deletion: Altro → Impostazioni → Il tuo accesso → Elimina account (type ELIMINA + password; the account is deleted after a 30-day grace period and the deletion can be cancelled until then).
```

Il percorso della cancellazione è quello vero (APP-1c, 27/9/2026). Le funzioni native citate devono esserci davvero nella build inviata (APP-4).

## 9. Screenshot e grafica

Presi dall'app vera con l'account demo, nello stile della dashboard (nessuna grafica inventata, vedi le regole di design del progetto). Testo in sovrimpressione facoltativo e corto.

| Store | Formato obbligatorio | Quanti |
|---|---|---|
| Apple, iPhone 6,9" | 1320 × 2868 px (o 1290 × 2796) | 3–10, consigliati 6 |
| Google Play, telefono | lato corto ≥ 1080 px, rapporto 9:16 (es. 1080 × 1920) | 2–8, consigliati 6 |
| Google Play, grafica in evidenza | 1024 × 500 px | 1 |
| Google Play, icona | 512 × 512 px PNG | 1 (da `public/icon-512.png`) |
| Apple, icona | 1024 × 1024 px senza trasparenza | 1, dentro il binario (APP-3) |

Le sei schermate, in quest'ordine: 1) Oggi, 2) Nuovo preventivo mentre si detta, 3) il preventivo generato, 4) la pagina che vede il cliente con "Accetta", 5) un cantiere con foto e costi, 6) Soldi con gli incassi. Si possono fare già sul sito da telefono con lo script Playwright usato per le fasi 19–20 (390 × 844 a scala 3 → 1170 × 2532, poi riportato al formato Apple); quelle definitive vanno rifatte sul guscio.

## 10. Controllo delle lunghezze

```bash
node -e 'for (const [n,max,s] of [["nome",30,"PrevAI – Preventivi edili"],["sottotitolo",30,"Preventivi, cantieri e fatture"],["breve Play",80,"Preventivi edili con l'"'"'AI in due minuti, poi firma, cantiere e pagamenti."],["promo",170,"Descrivi il lavoro a voce o con una foto dal cantiere: PrevAI scrive il computo metrico con le tue voci e i tuoi prezzi, pronto da inviare al cliente."],["keywords",100,"preventivo,computo metrico,edilizia,artigiano,impresa,cantiere,fattura,ristrutturazione,capitolato"]]) console.log(n, [...s].length + "/" + max, [...s].length <= max ? "ok" : "TROPPO LUNGO")'
```

## 11. Il giorno dell'invio (titolare)

1. Controllare che le righe 15, 18, 19, 20 b e 23 siano ✅.
2. Rileggere le linee guida Apple e le norme Google in vigore (cambiano spesso) e aggiornare §1, §6 e §7 se serve.
3. Account demo pronto (§5), provato da un telefono sconosciuto.
4. Google Play: prima *test chiuso* → poi *produzione* in Italia. Apple: build da TestFlight → "Invia per la revisione", rilascio **manuale** dopo l'approvazione (così si sceglie il giorno).
5. Se arriva un rifiuto: copiare il testo nel diario del piano; Claude prepara la risposta o la correzione, il titolare la invia.
