# Responsabili e sub-responsabili del trattamento (art. 28 GDPR) — stato dei DPA

Versione 1.0 · A-0 · 21 settembre 2026. Questo è l'elenco "Destinatari" richiamato dalla Privacy Policy §5 e dai Termini §9.3: ogni modifica va comunicata agli utenti con 14 giorni di preavviso.

Legenda stato: ✅ DPA in essere e archiviato · 🟨 DPA standard del fornitore accettato con i ToS, copia da archiviare · ⬜ da fare · — non applicabile.

| Fornitore | Ruolo | Dati | Sede / regione | Trasferimento extra-UE | DPA | Azione del titolare |
|---|---|---|---|---|---|---|
| **Supabase Inc.** | sub-responsabile (DB Postgres, Storage) | tutto il DB e i file | Progetto in `aws-0-eu-west-1` (Irlanda) — D7 ✅ | Supporto/tooling USA: SCC nel DPA Supabase | 🟨 | Scaricare il DPA dalla dashboard (Organization → Legal → DPA), firmare, archiviare in `C:\Users\Admin\PrevAI-compliance\` (fuori dal repo) |
| **Vercel Inc.** | sub-responsabile (hosting funzioni, log) | richieste HTTP, log con IP, variabili d'ambiente | Funzioni: regione da confermare in `vercel.json` (usare `fra1`/`dub1` se non già UE) | USA: DPF + SCC (Vercel DPA) | 🟨 | Accettare/scaricare il DPA (Vercel → Settings → Legal); verificare la regione delle funzioni |
| **Groq, Inc.** | sub-responsabile (inferenza LLM) | testo prompt: descrizione lavori, listino, dati cliente necessari al documento, note spese, conversazioni bot | USA | SCC | ⬜ **priorità** | Verificare: DPA disponibile, clausola **no-training / zero data retention** sulle API, sede del trattamento. Se non soddisfacente entro A-1: valutare provider UE (Mistral) o OpenAI/Azure con DPA e regione UE. Nel frattempo il prompt non contiene mai IBAN, credenziali, XML fatture (regola in `DPIA.md` §2) |
| **Resend Inc.** | sub-responsabile (email transazionali) | destinatario, oggetto, corpo (link ai documenti) | USA | DPF/SCC | 🟨 | Scaricare il DPA (resend.com/legal/dpa) |
| **Stripe Payments Europe Ltd. / Stripe Inc.** | responsabile per l'abbonamento; titolare autonomo per gli obblighi antiriciclaggio; Stripe Connect per gli incassi dell'utente | dati di fatturazione dell'utente, importi | Irlanda / USA | DPF/SCC | 🟨 | DPA incluso nello Stripe Services Agreement: archiviare copia |
| **Meta Platforms Ireland Ltd.** | sub-responsabile (WhatsApp Business Platform, Lead Ads) | numeri di telefono, messaggi, lead | Irlanda / USA | DPF/SCC | 🟨 | WhatsApp Business Data Processing Terms: accettati con l'onboarding; archiviare |
| **Google LLC** | sub-responsabile (Gmail invio, Google Calendar, GSC) — solo se l'utente collega l'account | email inviate, eventi | USA | DPF/SCC | 🟨 | Google Workspace/Cloud Data Processing Addendum |
| **Microsoft Corporation** | sub-responsabile (Outlook Calendar) — solo se l'utente collega l'account | eventi | USA/UE | DPF/SCC | 🟨 | Microsoft Products and Services DPA |
| **PostHog, Inc.** | sub-responsabile (analytics) — **oggi disattivato in prod** (chiavi assenti) | eventi pseudonimizzati | UE (`eu.i.posthog.com`) | — se host UE | ⬜ se si attiva | DPA PostHog al momento dell'attivazione |
| **Functional Software, Inc. (Sentry)** | sub-responsabile (error tracking) — attivo solo se `SENTRY_DSN` impostato | stack trace, id utente, IP | USA (o UE se org creata in regione UE) | DPF/SCC | ⬜ se attivo | Scegliere la regione UE dell'org Sentry; DPA da sentry.io/legal/dpa |
| **GitHub, Inc.** | sub-responsabile (backup notturno cifrato come artefatto CI) | dump cifrato | USA | DPF/SCC | 🟨 | GitHub DPA (parte dei ToS); i backup sono cifrati con passphrase fuori da GitHub |
| **Intermediario SDI — Openapi.it (default) o A-Cube** | sub-responsabile (trasmissione/ricezione FatturaPA, conservazione a norma) | XML fatture completi, delega, codice destinatario | Italia/UE | — | ⬜ **D8** | A-1 (22/9/2026): il codice è pronto e l'adapter è scritto, ma **nessuna impresa può emettere** finché non ci sono contratto, DPA e manuale di conservazione firmati dal titolare e il token inserito in Impostazioni. Senza credenziali il modulo resta sul provider `simulato`, che non trasmette nulla |
| **Commercialista / studio partner (fase 2)** | **titolare autonomo** per la propria prestazione professionale — **non** è un responsabile né un contitolare | i dati dell'anno dell'incarico, chat, bozza e ricevuta | Italia | — | — (non serve un DPA) | A-6 (23/9/2026): codice pronto. La comunicazione avviene per istruzione dell'utente (lettera d'incarico in app, registro R8); i flussi sono regolati dalla convenzione §5 (`testoConvenzione()` in `lib/config/src/commercialista.ts`); l'informativa del professionista e quella sull'IA (art. 13 L. 132/2025) le accetta l'utente con la lettera. Da fare col primo studio (D9): far rivedere a un legale convenzione, lettera e informative prima della firma |

## Regole operative

1. Nessun nuovo fornitore che tocca dati personali senza (a) riga in questa tabella, (b) DPA archiviato, (c) aggiornamento della Privacy Policy §5 e preavviso 14 gg agli utenti.
2. I DPA firmati stanno in `C:\Users\Admin\PrevAI-compliance\` (o nel password manager come allegati), mai nel repo.
3. Riesame annuale insieme alla DPIA.
