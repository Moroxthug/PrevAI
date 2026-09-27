# PrevAI — Piano dell'app mobile (fasi APP-0 → APP-6)

**Creato:** 2026-09-27, su richiesta del titolare dopo il cutover v2. Le fasi sono le righe 15–21 di `PIANO-AZIONE.md`; le decisioni nuove sono D12–D16.

## 1. Perché un'app, e per chi

Il cliente tipo di PrevAI è un artigiano o un'impresa edile che il preventivo lo pensa **in cantiere**, col telefono in mano: guarda il lavoro, fa due foto, detta a voce cosa c'è da fare. Oggi può farlo dal browser, ma:
- non riceve **notifiche** (preventivo aperto o accettato dal cliente, nuovo lead dal widget, scadenza fiscale) se non apre il sito;
- non ha l'icona sul telefono, quindi PrevAI non entra nelle abitudini;
- la fotocamera e la dettatura passano dal browser, con più passaggi;
- non si trova negli store, e questo vale anche come credibilità e marketing.

L'app **non è un prodotto nuovo**: è PrevAI, nella stessa veste della dashboard (vedi la regola di design in fondo), con in più notifiche, fotocamera, dettatura e condivisione native.

## 2. L'approccio consigliato (D12)

| Opzione | Riuso del codice | Qualità nativa | Tempo | Rischio store | Note |
|---|---|---|---|---|---|
| **A. Solo PWA** (app installabile dal sito) | 100% | bassa-media | 1 sett | nessuno (non è negli store) | Notifiche push su iPhone solo se l'utente la aggiunge alla home (iOS 16.4+). Nessuna presenza negli store |
| **B. PWA + guscio nativo Capacitor** ✅ | ~90% | media-alta | 5–7 sett | medio (Apple 4.2 rifiuta i "siti impacchettati" senza funzioni native) | Stesso codice React della dashboard, plugin nativi per fotocamera, push, condivisione, Face ID. **Consigliata** |
| C. App nativa React Native / Expo | ~30% (solo API e logica) | alta | 3–4 mesi | basso | Riscrivere tutte le schermate. Ha senso solo se l'app diventa il prodotto principale |

**Raccomandazione: B, in due tempi.** Prima la PWA (APP-2), che dà subito icona e notifiche a chi usa Android e a chi installa su iPhone. Poi il guscio Capacitor (APP-3/APP-4) con le funzioni native che lo rendono un'app vera, e quindi accettabile per Apple.

## 3. Soldi e store (D13) — da verificare all'avvio di APP-0

- **Non vendere abbonamenti dentro l'app (raccomandato).** Gli abbonamenti PrevAI e PrevAI Fisco si comprano sul sito con Stripe, come oggi; nell'app si entra con l'account. È il modello "multipiattaforma" delle regole Apple (3.1.3(b)): niente commissione del 15–30%, a patto che l'app non spinga all'acquisto fuori.
- Le regole sui link verso l'acquisto esterno sono cambiate nel 2024–2025 (DMA nell'UE, sentenze negli USA). **Prima di APP-3 vanno rilette le linee guida in vigore** e annotato qui cosa si può mostrare in Italia (es. un link "Gestisci abbonamento sul sito").
- **Costi fissi:** Apple Developer Program 99 $/anno (account **organizzazione**, serve il numero D-U-N-S dell'impresa, gratuito ma richiede giorni); Google Play 25 $ una tantum (account organizzazione con verifica d'identità). Servizio di build iOS nel cloud (D15): 0–100 €/mese a seconda del volume.

## 3b. Senza Mac e senza iPhone (vincolo del titolare, 2026-09-27)

Il titolare non ha dispositivi Apple. Non blocca nulla, cambia l'ordine: **Android prima, iPhone subito dopo**.

| Serve | Senza Apple si fa così | Costo indicativo (da verificare in APP-0) |
|---|---|---|
| Compilare l'app iOS e caricarla su App Store Connect | Build nel cloud da GitHub: Codemagic (supporta Capacitor, ha un piano gratuito con minuti macOS), in alternativa Ionic Appflow o i runner macOS di GitHub Actions + fastlane | 0–100 €/mese |
| Firma dell'app (certificati e profili) | Gestita dal servizio di build con la chiave API di App Store Connect: niente Xcode, niente portachiavi del Mac | incluso |
| Provare l'app su un iPhone | iPhone veri da remoto (BrowserStack App Live o AWS Device Farm), usati dal browser, anche da Claude per le verifiche; poi **TestFlight** con le imprese pilota che hanno un iPhone | 30–40 €/mese solo nei mesi di test |
| Iscrizione Apple Developer | Dal sito, come organizzazione con il D-U-N-S; la verifica in due passaggi dell'Apple ID via SMS su un numero qualsiasi (anche Android) | 99 $/anno |
| Gestire l'app (scheda, revisione, TestFlight) | App Store Connect è un sito web, funziona da Windows | — |
| Screenshot per lo store | Generati da Claude alle misure iPhone richieste da Apple (come per la fase 19) | — |

Conseguenze sulle fasi: APP-3 fa prima il guscio **Android** (si prova sul telefono del titolare) e poi iOS con la build cloud; APP-5 usa TestFlight con le imprese pilota che hanno un iPhone; APP-6 pubblica prima su Google Play.

## 4. Requisiti che gli store impongono (e che oggi mancano)

1. **Cancellazione dell'account dall'app** (Apple 5.1.1(v)) — oggi non c'è nemmeno sul sito. Serve anche per il GDPR art. 17. Si fa in APP-1, sul web, così vale per tutti.
2. **Etichette privacy** (App Store "Privacy nutrition label", Google "Data safety"): elenco dei dati raccolti. Si ricavano da `docs/compliance/` (DPIA) e dall'elenco dei sub-processori.
3. **Accesso per il revisore Apple:** un account demo funzionante con dati finti.
4. **AI Act art. 50:** gli avvisi IA già presenti in v2 valgono anche nell'app (stessa interfaccia).
5. Niente "Accedi con Apple" obbligatorio: PrevAI non ha login social. Se in futuro si aggiunge Google, diventa obbligatorio anche Apple.

## 5. Le fasi

### APP-0 — Decisioni, account e regole (½ sett, quasi tutto del titolare)
- Chiudere D12 (approccio), D13 (niente vendita in-app), D14 (account sviluppatore), D15 (build iOS), D16 (push).
- Titolare: D-U-N-S, iscrizione Apple Developer come organizzazione, Google Play Console, progetto Firebase (per le notifiche Android e iOS).
- Claude: rilettura delle linee guida Apple/Google in vigore sui pagamenti e sulle app "web wrapper", annotata in §3; nome e identificativo dell'app (`it.prevai.app`), icona e schermata d'avvio **dal logo attuale**.
- **Fatto quando:** i quattro account esistono e le decisioni sono scritte in `PIANO-AZIONE.md`.

### APP-1 — Tutta la dashboard da telefono + cancellazione account (1–1½ sett)
- Le pagine che da telefono hanno ancora tabelle fuori schermo (singolo preventivo, Clienti, Cantieri, Pro-forma, Contratti, Archivio, Listino, Squadra, Analisi, Impostazioni) portate allo stile della dashboard, come fatto in fase 19 per home, lista e nuovo preventivo.
- **Cancellazione dell'account in autonomia:** Impostazioni → Account → "Elimina account", con conferma, periodo di grazia di 30 giorni, cancellazione o anonimizzazione dei dati e disdetta Stripe. Documentata in RUNBOOKS.
- Controllo a 390 px e 430 px (iPhone standard e Pro Max) e a 360 px (Android piccolo).
- **Fatto quando:** nessuna pagina della dashboard sborda in larghezza a 360 px (test automatico nella suite `qa:visual`), la cancellazione funziona su staging end-to-end.

### APP-1, diviso (aggiunto il 2026-09-27)
Il design di riferimento è quello dell'app di QuoteAI (`design/stitch*`, `docs/MOBILE-RULES.md`, Phase 100–113), nello stile navy/Figtree della dashboard. **APP-1a** (riga 16) è fatta: pezzi da telefono, schede in basso, foglio Altro, tasto +, home "Oggi".
- **APP-1b** (riga 22) — Impostazioni come in QuoteAI 102: elenco raggruppato come prima schermata, ogni sezione una pagina con ‹, niente salvataggio a ogni modifica ma una barra "Modifiche non salvate — Annulla / Salva". App collegate come catalogo (103).
- **APP-1c** (riga 23) — Cancellazione dell'account (vedi sopra).
- **APP-1d … APP-1h** (righe 24–28) — Le pagine con i pezzi nuovi: una sola azione principale in basso (`StickyActionBar`), le altre nel foglio ⋯, tabelle che diventano righe sotto i 640 px, numeri in striscia, schede a scorrimento. Ordine: preventivi, cantieri, soldi e persone, squadra e resto, cliente e sito pubblico.
- **APP-1i** (riga 29) — Le regole mobile di `qa:visual` diventano bloccanti. Qui APP-1 è chiusa.

### APP-4a — Funzioni native possibili dal sito (riga 30)
- Foto del cantiere dal + (fotocamera del telefono dal browser), nota vocale su un cantiere dal + (dettatura come nel composer), "Condividi" del PDF con la Web Share API, bozze del nuovo preventivo salvate sul telefono se cade la rete.
- Push native e Face ID restano nella riga 19 (servono APP-3 e D16).

### APP-7 e APP-8 (righe 31–32)
- **APP-7** — Home per ruolo e "Personalizza la home" (QuoteAI 132, `design/role-homes`).
- **APP-8** — Assistente vocale (QuoteAI 133–142): richiede un piano a parte, costi dell'IA vocale e regole sui permessi; da valutare dopo gli store.

### APP-2 — PWA installabile + notifiche web (1 sett)
- `manifest.webmanifest` (nome, icone, colore navy, `display: standalone`), service worker con cache della struttura dell'app e pagina "sei offline".
- **Notifiche push web** (standard VAPID): tabella `push_subscriptions`, invio dal server sugli stessi eventi delle notifiche in-app. Primo giro: preventivo aperto dal cliente, preventivo accettato, nuovo lead dal widget, scadenza fiscale a 7 giorni (se PrevAI Fisco è attivo). Preferenze per tipo in Impostazioni.
- Invito "Aggiungi alla schermata Home" discreto, dopo il secondo preventivo creato (non al primo accesso).
- **Fatto quando:** su Android e su iPhone (installata sulla home) arriva la notifica di un preventivo accettato su staging.

### APP-3 — Guscio nativo iOS e Android con Capacitor (1½–2 sett)
- Nuovo pacchetto `artifacts/mobile` (Capacitor) che impacchetta la build di `preventivo-ai`.
- **Login con token** (plugin `bearer` di better-auth, già attivo sul server) salvato nel portachiavi sicuro del telefono, invece dei cookie.
- API con indirizzo assoluto `https://prevai.it/api`, origine dell'app aggiunta a CORS e a `TRUSTED_ORIGINS`.
- **Link universali:** `prevai.it/dashboard/...` e le notifiche aprono l'app nella schermata giusta (file `apple-app-site-association` e `assetlinks.json` su prevai.it).
- **Prima Android** (Android Studio o build Gradle su Windows, prova sul telefono del titolare), **poi iOS** con la build nel cloud (D15), perché il titolare non ha Mac né iPhone (§3b).
- **Fatto quando:** l'app gira sull'Android del titolare e su un iPhone vero da remoto (BrowserStack) o via TestFlight: login, lista preventivi, creazione di un preventivo.

### APP-4 — Funzioni native (1½–2 sett)
- **Fotocamera e galleria** nel composer (plugin Camera), con compressione prima dell'invio.
- **Dettatura** col microfono nativo, riusando `/api/speech/transcribe`.
- **Condivisione del PDF** del preventivo con il foglio di condivisione del telefono (WhatsApp, email, AirDrop).
- **Notifiche push native** (APNs e FCM tramite Firebase, D16) con gli stessi eventi di APP-2.
- **Sblocco con Face ID / impronta** all'apertura (facoltativo, da Impostazioni).
- **Bozze senza rete:** la descrizione e le foto di un preventivo restano salvate sul telefono se in cantiere manca il segnale, e partono quando torna.
- **Fatto quando:** un preventivo creato in cantiere con due foto e la voce arriva al cliente via WhatsApp dall'app, senza passare dal browser.

### APP-5 — Beta con le imprese pilota (2 sett, in parallelo alla revisione)
- TestFlight (iOS) e test interno di Google Play con 3–5 imprese vere, a partire da quelle che usano già il widget.
- Crash e errori su Sentry (già cablato in v2, serve il DSN), eventi d'uso minimi: apertura, preventivo creato, preventivo condiviso.
- Un giro di correzioni sui problemi trovati.
- **Fatto quando:** due settimane senza crash bloccanti e almeno 20 preventivi creati dall'app dalle imprese pilota.

### APP-6 — Pubblicazione negli store (1 sett + tempi di revisione)
- Schede store in italiano: testi, 6 screenshot per piattaforma (presi dall'app vera, stile dashboard), video facoltativo, categoria "Produttività" o "Business".
- Etichette privacy, account demo per il revisore, contatti di supporto.
- Invio in revisione; risposta alle eventuali obiezioni (tipicamente la 4.2 "funzionalità minima", già coperta da APP-4).
- Aggiornamenti successivi: le modifiche all'interfaccia arrivano col normale deploy web; una nuova versione negli store serve solo quando cambiano i plugin nativi.
- **Fatto quando:** PrevAI è scaricabile da App Store e Google Play in Italia.

## 6. Tempi e ordine

| Fase | Sforzo | Dipende da | Si può fare subito? |
|---|---|---|---|
| APP-0 | ½ sett | titolare | sì (le decisioni) |
| APP-1 | 1–1½ sett | — | **sì**, serve comunque anche al sito |
| APP-2 | 1 sett | APP-1 | sì dopo APP-1 |
| APP-3 | 1½–2 sett | APP-0 (account, D15), APP-1 | no, servono gli account |
| APP-4 | 1½–2 sett | APP-3, D16 | no |
| APP-5 | 2 sett | APP-4 | no |
| APP-6 | 1 sett + revisione | APP-5 | no |

**Totale:** circa 8–10 settimane fino agli store; le prime due fasi tecniche (APP-1, APP-2) danno già valore sul sito e sulla PWA dopo 2–3 settimane.

## 7. Regole che valgono per tutte le fasi APP

1. **Stile: quello della dashboard esistente** (navy, Figtree, card bianche, pillole, righe `q-row`). Nessuno stile nuovo per l'app (decisione del titolare del 27/9, dopo il tentativo "premium" annullato).
2. Una fase alla volta, con commit, test e riga della tabella aggiornata, come per le altre fasi.
3. Nessun deploy in produzione senza il promote del titolare; nessuna pubblicazione negli store senza il suo ok esplicito.
4. I dati dell'app sono gli stessi del sito: niente database separato, nessuna copia dei dati sul telefono oltre alle bozze offline.
