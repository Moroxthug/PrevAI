# Video brevi di PrevAI (POCKET-7, riga 64)

QuoteAI non ha mai fatto la sua fase 130 (è passata da 129 a 131): questa fase è stata costruita qui, su scelta del titolare (2026-10-23).

## Cosa sono

- Video **muti**, con **sottotitoli italiani** (uno per capitolo), **1280×776** (la forma del riquadro del lettore dell'app), H.264 in MP4, 1–2 MB l'uno.
- **Registrati dall'app vera** (Expo web su staging, impresa inventata «Edilizia Rossi», mai clienti veri): niente voce, niente animazioni disegnate a mano.
- Serviti dal sito: `artifacts/preventivo-ai/public/video/<file>.mp4` + `<file>.jpg` (locandina); i `.vtt` li scrive il prerender da `src/data/help-videos.ts`.
- Nessun lettore di terzi, nessun tracciamento sul sito. Nell'app: «video avviato» e «video finito» con la schermata da cui è stato aperto (`/api/app/events`, tabella `app_events`, nessuna migrazione), nel pannello staff **/dashboard/admin → Beta app → Video dell'app**.

## Dove compaiono

| Video | App | Sito |
|---|---|---|
| `quotes` Il tuo primo preventivo | Aiuto; «Guarda come si fa» su Preventivi vuoto | /help/video/, in cima a /help/create-a-quote/ |
| `overview` PrevAI in 60 secondi | Aiuto; fine del primo preventivo guidato (una volta) | /help/video/, in cima a /help/getting-started/ |
| `jobs` Avvia un cantiere da un preventivo | Aiuto; «Guarda come si fa» su Cantieri vuoto | /help/video/, in cima a /help/jobs-milestones-and-change-orders/ |
| `bonifico` Fatti pagare con un bonifico | Aiuto; «Guarda come si fa» su Fatture vuoto | /help/video/, in cima a /help/invoices-and-getting-paid/ |
| `crew`, `app` | non ancora registrati: nell'Aiuto non compaiono, nessun link (il link di Squadra vuota si accende da solo quando il file c'è) | — |

Un video senza file (`file: null` in `artifacts/pocket/src/lib/videos.ts`) non compare da nessuna parte.

## Come si registra di nuovo (quando l'interfaccia cambia)

Gli script sono in `artifacts/pocket/scripts/record-videos/`:

1. Staging acceso (Postgres 5433) e `node staging.mjs` (in Claude: launch `pocket-e64`): API 5080 da `dist`, Expo 8104 con `/api` passato da Metro, solo la chiave Groq di sviluppo, nessuna chiave email o Stripe).
2. `node seed.mjs` — ricrea l'impresa di prova (`demo_video_owner`, «Edilizia Rossi», quattro clienti inventati, due preventivi accettati, un cantiere, una fattura che il cliente dice di aver pagato con bonifico). Va rifatto prima di ogni video: le registrazioni cambiano i dati (nuovo preventivo, bonifico confermato).
3. `node record.mjs <video>` (`--dry` fa solo il percorso con una schermata per passo). Chrome visibile ma fuori schermo (in headless i fotogrammi arrivano a 390 px di larghezza). La «telecamera» segue il punto toccato, i tocchi hanno un cerchio, le attese dell'IA vanno a 4×.
4. Esce `out/<video>.mp4`, `.jpg` e `.json` (durata e inizio dei capitoli). Copiare mp4 e jpg in `artifacts/preventivo-ai/public/video/`, durata e capitoli in `artifacts/pocket/src/lib/videos.ts` e in `artifacts/preventivo-ai/src/data/help-videos.ts` (un test dell'app controlla che coincidano).
5. `node sheet.mjs <video>` fa un foglio di fotogrammi per controllare il risultato.

Lo staging non manda email: lo script risponde lui alla chiamata di invio (come farebbe il server quando funziona), così il video mostra «Inviato».

## Cosa resta al titolare

- **YouTube** (canale, libreria pubblica con capitoli): non fatto, serve il canale.
- **Voce**: i video sono muti con sottotitoli; una voce si aggiunge solo se la si registra o si scelgono voci sintetiche.
- **Anteprime per gli store** (App Store fino a 30 s nelle misure Apple, video promo Play) e il loop della home: si tagliano da questi video quando ci saranno gli account (D14) — in QuoteAI erano la fase 131, mai fatta.
- `crew` e `app`: da registrare quando la squadra si potrà mostrare dal telefono dell'operaio e quando ci saranno integrazioni attive su staging.
