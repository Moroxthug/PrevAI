# PrevAI — l'assistente che parla e agisce (APP-8, righe 32–39)

Scritto il 2026-09-27, quando il titolare ha chiesto la "fase 32". Parte dal piano di QuoteAI (`docs/VOICE-ASSISTANT-PLAN.md`, fasi 133–142), che lì esiste **solo come piano**: nessuna di quelle fasi è stata costruita. Qui è riscritto nella misura di PrevAI (Italia, un solo fornitore di IA oggi, niente portale clienti, niente SMS) e diviso in righe del piano d'azione come APP-1.

Obiettivo: l'assistente di oggi (una chat testuale sulla pagina Assistente e nella scheda di un cantiere) diventa **uno solo per tutta l'app**: si apre da qualunque schermata, si scrive o si parla, risponde anche a voce, e può fare il lavoro — il riassunto della giornata, mandare un preventivo o una fattura, scrivere a un cliente, aggiornare un cantiere, avviare una chiamata — **entro i limiti che fissa il titolare**.

Stesse regole di sempre: una riga per sessione, in ordine; un commit per riga su `v2`, push subito; voce nel diario di `PIANO-AZIONE.md`; sezione del RUNBOOKS quando cambia un comportamento; ogni schermata nuova passa `pnpm qa:phone`; si resta nello stile della dashboard (nessuno stile nuovo).

---

## Stato

| Riga | Sotto-fase | Da QuoteAI | Stato |
|---|---|---|---|
| 32 | **APP-8a** Risposte in streaming, un assistente da ogni schermata, sa dove sei, dettatura | 133 | ✅ 2026-09-27 |
| 33 | **APP-8b** Permessi "fa / chiede / mai" + una conversazione per persona | 134 | ✅ |
| 34 | **APP-8c** Strumenti nuovi: brief del giorno, cerca, apri la schermata, preventivi, messaggi ai clienti | 135 | ✅ 2026-09-27 |
| 35 | **APP-8d** La schermata dell'assistente (calma) e la riga su Oggi | 136 | ✅ 2026-09-27 |
| 36 | **APP-8e** Risponde a voce | 137 | ✅ (D17 aperta: voce del browser, fornitore spento) |
| 37 | **APP-8f** Conferma a voce, interruzione, annulla | 138 | ✅ |
| 38 | **APP-8g** "Chiama Rossi" apre il telefono; rubrica fornitori | 139 | ✅ |
| 39 | **APP-8h** Fiducia: prove automatiche, costi, registro delle azioni | 141 | ✅ 2026-09-28 |

Non diventano righe: la **chiamata collegata** dal numero dell'impresa con registrazione (QuoteAI 140) — rinviata dalla decisione D19; **mani libere in furgone** con Siri/Google (QuoteAI 142) — si fa dentro il guscio nativo, dopo APP-3/APP-4 (righe 18–19).

---

## 1. Cosa c'è oggi (dopo APP-8a)

| Pezzo | Dove | Stato |
|---|---|---|
| Modello e ciclo | `api-server/src/assistant/service.ts` | chiede `gpt-4o`, che il client riscrive in **Groq `openai/gpt-oss-120b`** (unico fornitore IA attivo, `ENV-INVENTORY.md`); function calling, 6 giri di strumenti, 40 messaggi di storia; **in streaming** (APP-8a) |
| Strumenti di lettura (7) | `assistant/tools.ts` | riepilogo cantiere, cantieri, costi, fatture, ore, rischi del cronoprogramma, numeri dell'impresa |
| Proposte (6) | `assistant/tools.ts`, `assistant/apply.ts` | costo, fase, attività, bozza fattura, **invio fattura**, incasso — ognuna una scheda che l'utente conferma; passa dagli stessi servizi delle schermate; audit con `actorType: "ai"` |
| Contesto della schermata | `assistant/context.ts`, `lib/assistant-context.ts` | cantiere, preventivo o fattura aperti (APP-8a) — gli id sono controllati sul server |
| Accesso | `routes/assistant.ts` | funzione di piano `assistant` (Elite); `jobs:view` per chiedere, `jobs:edit` per confermare; 120 turni/ora |
| Voce in entrata | `hooks/use-voice-input.ts`, `routes/speech.ts` | MediaRecorder → Whisper su Groq (`whisper-large-v3-turbo`); nel campo dell'assistente da APP-8a |
| Voce in uscita | — | **nessuna** |
| Invii che esistono ma l'assistente non raggiunge | invio preventivo (email/PDF), invio contratto, risposta ai lead, WhatsApp (`routes/whatsapp.ts`), email collegata (`emailConnections`) | servizi pronti, nessuno strumento |
| Chiamate | link `tel:` sparsi | — |

**Da sapere:** le conversazioni sono salvate col `userId` dell'**impresa** (il titolare), non della persona: oggi un membro della squadra con piano Elite vede la stessa conversazione del titolare. Si separa in APP-8b, che ha comunque bisogno di una migrazione.

## 2. Principi

1. **Un assistente solo, ovunque.** Lo stesso ✦ in alto su ogni schermata apre la stessa conversazione; sa dove sei senza che tu lo dica.
2. **Scrivi o parla, stessa conversazione.** Passare dalla voce alla tastiera non perde nulla.
3. **Fa il lavoro, non solo risponde.** Una risposta che implica un'azione la propone.
4. **Niente esce dall'impresa senza di te — a meno che tu l'abbia deciso.** Soldi, messaggi ai clienti e firme chiedono sempre prima, per impostazione. Il titolare può allentare per tipo di azione, mai oltre il ruolo della persona.
5. **Calmo.** Nessuna sfera luminosa. Testo, una riga su cosa sta facendo ("Guardo il cantiere…"), una scheda per cosa vuole fare. Lo stile è quello della dashboard.
6. **Tutto visibile e, dove si può, annullabile.** Registro delle azioni; qualche secondo per annullare quelle reversibili.
7. **È un'IA e lo dice** (AI Act art. 50): l'avviso resta in cima alla chat; a voce lo dice la prima volta.

## 3. Decisioni (in `PIANO-AZIONE.md` come D17–D19)

| # | Decisione | Opzioni | Proposta |
|---|---|---|---|
| D17 | **Motore della voce** (serve per APP-8e) | (a) OpenAI Realtime: voce-a-voce, latenza minima, interrompibile, stessi strumenti — ma serve una chiave OpenAI (oggi usiamo Groq) ed è la voce più cara al minuto; (b) catena: Whisper su Groq (c'è già) → testo in streaming (c'è da APP-8a) → sintesi vocale (per esempio OpenAI `gpt-4o-mini-tts` o una voce italiana di un altro fornitore; prezzi da rileggere al momento); 1–2 s più lenta; (c) la sintesi vocale del browser, gratuita, voce di qualità variabile da telefono a telefono | **(b) catena**, con (c) come ripiego senza costi: riusa quello che c'è, resta su un fornitore di modello solo, costa molto meno per minuto. Realtime si rivaluta con i numeri di APP-8h |
| D18 | **Quali piani e quanti minuti di voce** (serve per APP-8b ed APP-8e) | solo Elite come oggi / testo da Pro e voce da Elite / minuti inclusi per posto e poi solo testo | **Testo da Pro, voce su Elite** con minuti inclusi (proposta: 300 al mese per posto), avviso all'80 %, poi solo testo. Cambiarlo tocca `piani.ts` e i Termini §4 |
| D19 | **Chiamate collegate e registrazioni** (QuoteAI 140) e **l'IA che parla coi clienti** | mai / più avanti con informativa e consenso | **Non in questo piano.** Solo "apri il telefono" (APP-8g). Da rivedere con un legale: registrazione delle telefonate e informativa GDPR alle due parti, parere del Garante sulle chiamate con voce sintetica, obblighi di trasparenza dell'AI Act per l'audio generato |

## 4. Permessi (APP-8b)

Tre livelli per tipo di azione, decisi dal titolare in **Impostazioni → Assistente**, eventualmente più stretti per ruolo:

| Livello | Significa |
|---|---|
| **Lo fa** | Esegue subito e mostra una scheda "fatto" con **Annulla** per 10 s dove l'azione si può annullare |
| **Chiede prima** | Mostra la scheda di conferma (come oggi); "sì" o Conferma |
| **Mai** | Lo strumento non viene nemmeno offerto al modello |

| Gruppo | Azioni | Predefinito |
|---|---|---|
| Lettura | riassunti, ricerche, "apri il cantiere Rossi" | Lo fa (sempre, non si spegne) |
| Note e attività | nota di cantiere, attività, costo, data o stato di una fase | Lo fa |
| Bozze | bozza di preventivo, fattura, variante, messaggio | Lo fa (una bozza non parte) |
| Soldi e clienti | inviare preventivo / fattura / contratto, scrivere a un cliente, registrare un incasso, variante | **Chiede prima** — ed è il minimo: non può diventare "Lo fa" |
| Distruttive | eliminare, annullare, chiudere un cantiere | **Mai**; al massimo Chiede prima |
| Chiamate | apri il telefono | Chiede prima |

Il ruolo vince sempre: chi non può emettere fatture non le emette nemmeno tramite l'assistente, qualunque sia l'impostazione. Si controlla sul server due volte — togliendo lo strumento dall'elenco mandato al modello e di nuovo all'esecuzione (`FEATURE_FOR` in `apply.ts` più il ruolo della persona, oggi assente). L'area `fiscale` resta chiusa come in A-2 (la legge solo il contabile, APP-7).

---

## APP-8a — Streaming e un assistente da ogni schermata (riga 32) ✅

Fatta il 2026-09-27. **Server:** `POST /api/assistant/conversations/:id/stream` manda il turno come Server-Sent Events (`progress` con la riga "Guardo il cantiere", `delta` col testo mentre si scrive, `message`, `proposal`, `done`, `error`); il turno è lo stesso di `/messages`, che resta. `assistant/stream.ts` rimette insieme testo e chiamate agli strumenti che arrivano a pezzi; `assistant/context.ts` riceve la schermata (percorso + id di cantiere, preventivo o fattura), controlla che ogni id sia dell'impresa e la descrive al modello; il cantiere della schermata diventa quello predefinito per gli strumenti. Se l'utente chiude il pannello a metà risposta il modello si ferma. `GET /api/assistant/conversations` e `GET /api/assistant/conversations/:id` per le conversazioni di prima. **App:** ✦ nella barra in alto su ogni schermata dei piani con l'assistente: pannello a destra sul computer, foglio alto sul telefono; la scheda Assistente del cantiere e la pagina Assistente usano la stessa conversazione; le vecchie conversazioni per cantiere restano leggibili nella pagina; microfono nel campo (dettatura con Whisper, il testo si rilegge prima di mandarlo). Dettagli in RUNBOOKS §17.

## APP-8b — Permessi e una conversazione per persona (riga 33) ✅

Fatta il 2026-09-27 (diario in PIANO-AZIONE, RUNBOOKS §18). Differenza dal piano qui sotto: nessuna colonna su `assistant_conversations`; la persona sta in una tabella nuova (`assistant_conversation_actors`), perché la colonna avrebbe rotto ogni lettura prima della migrazione. Il livello sta in `assistant_actions` e nell'audit. D18 aperta: piani invariati.

- Migrazione `0013`: `assistant_conversations.actor_user_id` (la persona; le conversazioni esistenti restano del titolare), `assistant_permissions` (impresa, tipo di azione, livello, ruolo facoltativo), livello registrato nell'audit.
- **Inerte finché la migrazione non gira** come 0011/0012: senza la colonna il server continua come oggi.
- Impostazioni → **Assistente** nella struttura a elenco di APP-1b.
- Server: strumenti filtrati per permesso e ruolo prima di ogni chiamata al modello, ricontrollati all'esecuzione; "Lo fa" esegue con un record per annullare.
- D18: se si apre il testo a Pro, `assistant` passa da Elite a Pro in `piani.ts` (e nei Termini).
- **Fatta quando:** test che provano che uno strumento "Mai" non è mai offerto, che "Chiede prima" non esegue mai senza conferma e che un ruolo senza `invoicing:edit` non invia una fattura con nessuna impostazione; un membro della squadra non vede la conversazione del titolare.

## APP-8c — Strumenti nuovi (riga 34) ✅

Fatta il 2026-09-27 (diario in PIANO-AZIONE, RUNBOOKS §19). Differenze dalla tabella qui sotto: `add_job_note` è `propose_job_note` e aspetta la migrazione 0011; `message_client` è **solo email** e solo verso contatti già noti (WhatsApp verso i clienti richiede un template, D10); `reply_lead` manda il messaggio standard della sequenza; le letture non passano dai permessi (sempre attive) ma sono filtrate per ruolo. I casi per APP-8h sono in `assistant/evals/cases.ts`.

| Strumento | Tipo | Usa |
|---|---|---|
| `brief_me` (oggi / settimana / un cantiere) | lettura | `today/`, `home/` ("Serve a te" di APP-7), rischi del cronoprogramma |
| `find` (clienti, cantieri, preventivi, fatture per nome, indirizzo, numero) | lettura | le ricerche che esistono |
| `get_quote` | lettura | dettaglio di un preventivo (oggi il contesto ne dà solo il riassunto) |
| `open_screen` | lettura, lato app | porta l'app alla schermata: "fammi vedere il cantiere Rossi" |
| `draft_quote` da una descrizione | bozza | il generatore di preventivi che c'è |
| `send_quote`, `send_contract`, `reply_lead` | invio | invio preventivo, contratti, lead |
| `message_client` (email, WhatsApp) | invio | email collegata, WhatsApp (solo dentro la finestra di 24 ore o con un template approvato — come D10) |
| `update_client` | modifica | clienti |
| `add_job_note` | nota | note del cantiere (migrazione 0011) |

- Ogni strumento: argomenti con zod, limitato all'impresa, una frase per la scheda ("Invia il preventivo 2026-014, 46.200 €, a Sara Lini per email").
- **Fatta quando:** ogni strumento ha un test e un caso nelle prove di APP-8h.

## APP-8d — La schermata dell'assistente e la riga su Oggi (riga 35) ✅

Fatta il 2026-09-27 (diario in PIANO-AZIONE, RUNBOOKS §20). Differenze: nessuno schizzo separato (nessuno stile nuovo, solo pezzi della dashboard); "o di' sì" per ora è "o scrivi sì" — la conferma a voce è APP-8f; senza rete la domanda aspetta la rete, e un invio arriva comunque come scheda da confermare.

- Conversazione come testo senza fumetti pesanti, righe di avanzamento, schede con Conferma / Modifica ("o di' sì"), suggerimenti dal contesto, barra in basso con tastiera, microfono, stop — **nello stile della dashboard**, prima uno schizzo accanto al desktop come chiede la regola di design.
- Su Oggi una riga sola "Chiedi o detta…" che apre l'assistente.
- Stati: vuoto, sta pensando, azione in attesa, fatto con annulla, errore con riprova, senza rete ("lo preparo quando torni in linea" solo per le bozze, mai per gli invii).
- Sul telefono anche le conversazioni di prima (oggi l'elenco è nascosto sotto 640 px).
- **Fatta quando:** `qa:phone` passa; si usa tutta con la tastiera e con il lettore di schermo.

## APP-8e — Risponde a voce (riga 36) ✅

Fatta il 2026-09-27 con **D17 aperta** (diario in PIANO-AZIONE, RUNBOOKS §21): la catena (b) è costruita, ma finché non c'è la chiave del fornitore (AS-2) parla la voce del browser (c). Differenze: la voce del fornitore è provvisoria ("coral", AS-3); velocità e modo "solo testo" sono scelte del dispositivo, non dell'impresa; i minuti si contano per l'impresa senza tetto (D18 aperta), il "per posto" si aggiunge quando D18 fissa il numero. Misure: dal silenzio alla frase consegnata alla voce, mediana 1,73 s in Wi-Fi e 2,12 s in 4G simulato, con la voce del browser; da rimisurare con quella del fornitore.

- Con la catena di D17: la dettatura c'è; il testo arriva già in streaming; si aggiunge la sintesi vocale frase per frase (si comincia a parlare alla prima frase finita, non alla fine della risposta). `POST /api/assistant/speech` con la chiave sul server, mai nel browser.
- Voce calma e neutra in italiano scelta dal titolare fra alcuni campioni; velocità; modalità "solo testo".
- Minuti contati per posto (D18). L'audio non si conserva (come la dettatura di oggi).
- **Fatta quando:** dal silenzio alla prima parola detta meno di 2 s in Wi-Fi e 3 s in 4G, misurati.

## APP-8f — Conferma a voce, interruzione, annulla (riga 37) ✅

Fatta il 2026-09-27 (diario in PIANO-AZIONE, RUNBOOKS §22). Differenze: la soglia sta in `assistant_permissions` (riga `voice_confirm_max`), nessuna migrazione; un no chiaro mette da parte la scheda (non la lascia in attesa: non succede comunque nulla); scritto a mano "sì" conferma anche sopra la soglia (è come il tocco); l'interruzione parlando è una scelta del dispositivo e si accende solo se il microfono è già permesso. Le prove sono `APP8F_VOICE_REPLY_CASES` in `assistant/evals/cases.ts` (girano senza modello).

- Parlare sopra l'assistente lo zittisce subito.
- La conferma a voce rilegge l'essenziale ("Invio la fattura PF-2026-0042, settemilacentododici euro, a Marco Venturi per email?") e accetta solo un sì chiaro ("sì", "vai", "mandala"); tutto il resto la lascia in attesa.
- Importi e destinatari sempre anche a schermo; sopra una soglia (proposta 5.000 €, decisa dal titolare) serve il tocco, non basta la voce.
- "Annulla" nella finestra di annullamento.
- **Fatta quando:** nelle prove ci sono conferme ambigue ("sì, anzi no") e nessuna esegue.

## APP-8g — "Chiama Rossi" apre il telefono (riga 38) ✅

Fatta il 2026-09-27 (diario in PIANO-AZIONE, RUNBOOKS §23). Differenze: lo strumento è `propose_call` (una scheda come le altre, livello massimo "Chiede prima") e cerca il numero da solo, senza passare da `find`; la rubrica fornitori non è una tabella nuova ma la `suppliers` di v1 con una schermata in Squadra → Fornitori (il referente sta nelle note, dove il riconoscimento SdI cerca già la P. IVA); il QR si mostra dopo "Mostra il numero". I casi per APP-8h sono `APP8G_EVAL_CASES`.

- Strumento `call`: trova il numero giusto (cliente, lead, fornitore, squadra) e, dopo "Chiede prima", apre il compositore del telefono (`tel:`); sul computer mostra il numero e un QR.
- Una rubrica fornitori semplice (nome, ditta, telefono, email) se non c'è, così "chiama Marco di Edilceramiche" si risolve.
- Dopo la chiamata: "Aggiungo una nota?" → nota dettata sul cantiere.

## APP-8h — Fiducia (riga 39) ✅

Fatta il 2026-09-28 (diario in PIANO-AZIONE, RUNBOOKS §24). Differenze: 165 richieste invece di 150 (si allarga con AS-4); le prove girano senza database, con il prompt e gli strumenti veri per ruolo e schermata, e ricevono un risultato inventato dove serve un secondo passo; costi in euro al cambio approssimato, avviso allo staff oltre 5 € al mese per posto; Annulla dal registro solo nei secondi della scheda, poi Apri. Primo esito: 97,6 %, 0 azioni sbagliate, si resta su gpt-oss-120b (il 20b sbaglia azioni, qwen è troppo lento per la voce).

- Circa 150 richieste realistiche (rumore nella dettatura, nomi ambigui, tentativi fuori dal proprio ruolo) con lo strumento atteso; girano a ogni cambio di prompt o di modello; misurano esattezza, **azioni sbagliate (obiettivo 0)**, latenza e costo per turno. Servono anche a decidere se cambiare modello (oggi gpt-oss su Groq).
- Costi per impresa: minuti di voce, token, € per posto; avviso allo staff.
- Impostazioni → Assistente → **Attività**: ogni azione dell'IA, chi l'ha chiesta, cosa ha fatto, con quale livello, con annulla dove si può.
- Protezione dalle istruzioni nascoste: testi di clienti, lead, email e descrizioni dei preventivi passano come dati e mai come istruzioni; gli invii partono solo da una richiesta dell'utente, mai da un testo che l'assistente ha letto.

---

## Cose del titolare

| # | Cosa | Quando | Costo |
|---|---|---|---|
| AS-1 | Decidere D17, D18 (prima di APP-8b / APP-8e) e, quando servirà, D19 | vedi sopra | — |
| AS-2 | Se D17 = sintesi vocale OpenAI: una chiave OpenAI con tetto di spesa mensile (oggi c'è solo Groq) | prima di APP-8e | a consumo |
| AS-3 | Scegliere la voce italiana fra i campioni | APP-8e | — |
| AS-4 | Usarlo una settimana su lavori veri e segnare cosa sbaglia (diventa parte delle prove) | dopo APP-8f | — |
| AS-5 | Rileggere i Termini se l'assistente passa a Pro (D18) | APP-8b | — |
