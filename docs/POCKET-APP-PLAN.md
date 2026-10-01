# PrevAI Pocket: l'app Expo

L'app per telefono di PrevAI, nello **stesso identico design** dell'app di QuoteAI ("quoteAI Pocket", Claude Design), ricostruita in Expo. Decisione del titolare del 2026-09-30: "stesso identico stile, senza cambiare nulla nel design", e fra le due versioni di QuoteAI (schermate del telefono nella web app, fasi 143–152, già superate; app Expo dal pacchetto di design finale, fasi 123–130) ha scelto **l'app Expo**.

Righe del piano: **57–64** di `PIANO-AZIONE.md` (POCKET-0 … POCKET-7 = QuoteAI 123 … 130). Sostituiscono le righe 18 (APP-3, guscio Capacitor), 19 (APP-4, funzioni native nel guscio), 20 (APP-5, beta) e 21 (APP-6, pubblicazione) per la parte "app": il codice di APP-2 (PWA e Web Push) resta per il sito. **D12 chiusa:** app nativa in Expo/React Native.

## La regola
- Il design è quello di QuoteAI, invariato: `docs/pocket-design/` è una copia fissata del pacchetto di QuoteAI (commit `c4b8649` di QuoteAI), handoff in `docs/pocket-design/handoff/`. Colori, font, misure, raggi, ombre, movimento, icone: da `handoff/tokens/tokens.ts` e `handoff/icons/`, mai scritti a mano.
- Si costruisce **solo quello che QuoteAI ha già costruito e verificato**, fase per fase: PrevAI segue QuoteAI, non lo anticipa. Il codice dell'app QuoteAI è in `C:\Users\Admin\Desktop\QuoteAI\artifacts\pocket` (sola lettura).
- **Cosa cambia per PrevAI, e solo questo:**
  - lingua: solo **italiano** (`src/i18n/it.ts`; i testi italiani si scrivono traducendo quelli inglesi dei pannelli, con il vocabolario del sito: preventivo, cantiere, pro-forma, fattura, capocantiere…); niente selettore di lingua;
  - formati: `it-IT` ed **euro** come il sito (`4131,05 €`, `18.000 €`, `29 set`, `14:30`);
  - marchio: nome **PrevAI**, identificativo `it.prevai.app`, schema `prevai://`, icone dal logo attuale (`artifacts/preventivo-ai/public/icon-512.png`, `icon-maskable-512.png`); il logo SVG del pacchetto (`svgs.logo`) non si usa finché non c'è quello di PrevAI;
  - server: `https://prevai.it` (in sviluppo l'API di staging sulla porta 5069);
  - funzioni che PrevAI ha diverse (fisco forfettario, SdI, pro-forma, IVA, niente SMS): quando una schermata le tocca, si mostrano con le parti del design, senza inventare elementi.
- Le pagine che vede il cliente (preventivo, firma, fattura, area clienti, modulo del sito) restano pagine del sito.
- Niente prezzi, piani o acquisti nell'app (D13): piano e fatturazione aprono prevai.it.

## Dove sta
- `artifacts/pocket/` — **fuori dal workspace pnpm**, con un suo `npm install` (`package-lock.json`): Metro non segue i collegamenti di pnpm su Windows, e così Expo non entra nell'installazione di Vercel. Installazione: `cd artifacts/pocket && npm install --before=<un giorno fa>`.
- Riusa: l'API esistente, gli hook generati `lib/api-client-react` (Metro li legge da lì, `metro.config.js`), il token bearer di better-auth nel portachiavi del telefono (`expo-secure-store`).
- Comandi: `npm run typecheck`, `npm test` (formati, cifre, gradienti), `npm run lint:tokens` (nessun colore o misura scritto a mano fuori da `src/theme`), `npm run sync:design` (ricopia tokens e icone dall'handoff).
- Prova nel browser: `npx expo start --web` (pagina `/sandbox`).

## Regole di lettura del pacchetto (28 MB)
- Mai aprire interi i `*.dc.html` (348 pannelli, fino a 50k token l'uno, con ~30 KB di CSS ripetuto in cima). Si apre solo il pannello chiaro inglese e se ne estrae il markup: `sed -n '/<x-dc>/,$p' NOME.dc.html | grep -v '^\s*$' | head -400`, oppure grep.
- I pannelli `Dark` e `FR` non sono fonti: la notte viene dai token; l'italiano si scrive qui.
- `handoff/SCREENS.md`, `screens.json`, `navigation.json`: solo la sezione della fase in corso.
- Mai aprire `docs/pocket-design/kit/`, `screens-src.zip`, `canvas.json`, le anteprime png/jpg.

## Fasi
| Riga | Fase | QuoteAI | Contenuto | Stato |
|---|---|---|---|---|
| 57 | **POCKET-0** Fondamenta | 123 | progetto, tema chiaro/notte/auto con i 16 sfondi, font (Geist + Manrope per le cifre), icone, tutti i componenti del pannello Components, movimento, pipeline di rilascio | 0a fatto (= 123.1–123.3); il resto segue QuoteAI |
| 58 | **POCKET-1** Entrare | 124 | 11 schermate: benvenuto, accesso, registrazione, verifica, due passaggi, password dimenticata, inviti, codice d'accesso, scelta impresa, configurazione, primo preventivo | |
| 59 | **POCKET-2** Dal preventivo all'incasso | 125 | Home, Preventivi, Nuovo preventivo, Preventivo, Modifica, Controllo prezzi, Clienti, Cliente, Lead, Pro-forma/Fatture, Fattura, Menu e la schermata "In arrivo" | |
| 60 | **POCKET-3** Cantieri e squadra | 126 | 16 schermate; timbratura con posizione solo durante il turno; home del capocantiere | |
| 61 | **POCKET-4** Soldi e ufficio | 127 | 13 schermate (con fisco e SdI di PrevAI) | |
| 62 | **POCKET-5** Assistente, impostazioni, account | 128 | 31 schermate, l'assistente come nei pannelli | |
| 63 | **POCKET-6** Rifiniture e rilascio | 129 | stati di sistema, tablet, testo grande, Play (produzione dopo i 14 giorni di test chiuso), iOS con EAS (serve l'account Apple) | |
| 64 | **POCKET-7** Video | 130 | tutorial, anteprime per gli store | |

## Cose del titolare
- Prima della prima build sul telefono: account Expo (EAS) e Firebase (`google-services.json`, per le notifiche) — D16.
- Prima di iOS: account Apple Developer (D14).
- La scheda Play di PrevAI è approvata (28/9): le build Expo vanno sul test chiuso con `it.prevai.app`.

## Diario
- **2026-09-30 (POCKET-0a = QuoteAI 123.1–123.3):** pacchetto di design copiato in `docs/pocket-design/` (come in QuoteAI, i `.dc.html` sono marcati `-diff linguist-generated`); progetto Expo copiato da QuoteAI `artifacts/pocket` e adattato (italiano, euro, PrevAI, `it.prevai.app`, icone PrevAI, API prevai.it, niente `expo-localization`). Contiene: Expo SDK 57 con expo-router, tema con chiaro/notte/auto e i 16 sfondi (sfumatura "dusk" fissa dietro il contenuto), Geist + Manrope con la regola delle cifre, le 69 icone nei 13 toni, i pulsanti (5 tipi × 4 stati, 4 misure, riga piccola, barra d'azione fluttuante), movimento della pressione e ombre; pagine `/sandbox` e `/sandbox/foundations`. Il resto di 123 (gli altri componenti del pannello, movimento di fogli e schede, pipeline di rilascio) arriva quando QuoteAI lo fa.
