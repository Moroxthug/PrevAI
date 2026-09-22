# Registro delle attività di trattamento (art. 30 GDPR) — PrevAI

Versione 1.0 · A-0 · 21 settembre 2026 · Da rivedere a ogni fase che aggiunge dati (A-1 SDI, A-2 motore fiscale, A-4 prima nota, A-6 commercialista).

**Titolare:** PrevAI (dati societari da completare dal titolare: ragione sociale, P. IVA, sede) — privacy@prevai.it. **DPO:** non obbligatorio (art. 37: nessun monitoraggio su larga scala di persone fisiche come attività principale, nessun dato art. 9/10 su larga scala); rivalutare in A-6. **Sicurezza:** vedi `docs/QA-VERIFICATION-PLAN.md` (Phase 62–64) e §8 della Privacy Policy.

## A. Trattamenti in cui PrevAI è **titolare**

| # | Trattamento | Interessati | Categorie di dati | Finalità | Base giuridica | Destinatari / responsabili | Trasferimenti extra-UE | Conservazione | Misure principali |
|---|---|---|---|---|---|---|---|---|---|
| T1 | Account e autenticazione | Utenti (artigiani, membri della squadra) | Nome, email, hash password, segreto TOTP e codici di backup (2FA), sessioni (IP, user agent), ruolo nell'org | Erogazione del servizio, sicurezza | art. 6.1.b; 6.1.f (sicurezza) | Vercel (hosting UE), Supabase (DB, Irlanda), Resend (email) | Vercel/Resend: USA, SCC/DPF | Account + 30 gg; log sessioni 90 gg | Hash password (better-auth), 2FA, revoca sessioni, audit log di sicurezza, rate limit |
| T2 | Profilo aziendale | Utenti | Ragione sociale, P. IVA, C.F., indirizzo, telefono, email, REA, **IBAN (cifrato a riposo)**, logo, codice SDI | Intestazione documenti, fatturazione, pagamenti | 6.1.b; 6.1.c (dati fiscali) | Supabase, Vercel | come T1 | Durata account; dati fiscali su fatture 10 anni | Cifratura AES-256-GCM dell'IBAN (`fieldCrypto.ts`), accesso per ruolo |
| T3 | Abbonamenti e pagamenti | Utenti | Stripe customer id, piano, stato, storico addebiti (no dati carta) | Fatturazione del servizio | 6.1.b; 6.1.c | Stripe (responsabile e titolare autonomo per i propri obblighi) | Stripe: USA, SCC/DPF | 10 anni (documenti contabili) | Webhook firmati, nessun dato carta su PrevAI |
| T4 | Telemetria e diagnostica | Utenti, visitatori | Eventi d'uso pseudonimizzati, errori applicativi con stack e id utente, IP nei log server | Miglioramento del servizio, stabilità | 6.1.f | PostHog (UE, se attivo), Sentry (se attivo), Vercel (log) | Sentry: USA, SCC | 90 gg log; eventi analytics 12 mesi | Nessun cookie di profilazione, IP anonimizzato dove possibile |
| T5 | Comunicazioni di servizio e supporto | Utenti | Email, contenuto delle richieste, cronologia del bot di supporto | Assistenza, notifiche transazionali | 6.1.b | Resend, Groq (bot di supporto: testo della conversazione) | USA, SCC/DPF | Durata account; conversazioni bot 12 mesi | Avviso IA al primo contatto (art. 50 AI Act) |
| T6 | Marketing diretto | Utenti che hanno acconsentito | Email, nome | Newsletter, novità prodotto | 6.1.a | Resend | USA | Fino a revoca | Link di disiscrizione in ogni email |
| T7 | Lead pubblici (widget, WhatsApp, Meta Lead Ads) — *dati dei potenziali clienti degli utenti, ma raccolti da PrevAI prima dell'assegnazione a un utente* | Potenziali clienti degli artigiani | Nome, telefono/email, descrizione del lavoro, foto, comune | Instradamento della richiesta all'artigiano | 6.1.b (misure precontrattuali su richiesta dell'interessato) | Supabase, Meta (WhatsApp/Lead Ads), Groq (classificazione) | Meta/Groq: USA, SCC/DPF | 24 mesi dall'ultimo contatto se non convertito | Consenso informativa nel widget, avviso IA nel bot WhatsApp |

## B. Trattamenti in cui PrevAI è **responsabile** per conto dell'utente (art. 28; accordo = Termini §9)

| # | Trattamento | Titolare | Interessati | Categorie di dati | Sub-responsabili | Conservazione (istruzione del titolare) | Misure |
|---|---|---|---|---|---|---|---|
| R1 | Preventivi, varianti, accettazione online | Utente (artigiano) | Clienti e potenziali clienti dell'utente | Identificativi, contatti, indirizzo lavori, C.F./P. IVA, importi, foto | Supabase, Vercel, Groq (generazione testo: descrizione lavori, listino, dati del cliente necessari), Resend (invio), Meta (WhatsApp) | Durata account; poi export e cancellazione entro 30 gg, salvo documenti fiscali | Segregazione per org (IDOR-tested), token pubblici firmati e a scadenza, marcatura IA nei PDF |
| R2 | Contratti e firma elettronica | Utente | Clienti dell'utente, firmatari | Come R1 + email verificata, IP, timestamp, hash del documento, C.F. del firmatario | Supabase, Resend | 10 anni (art. 2220 c.c.) | Prova di firma con hash, eIDAS (firma elettronica semplice) |
| R3 | Cantieri, note spese, foto | Utente | Clienti, collaboratori dell'utente | Indirizzi, foto, ore lavorate, costi | Supabase, Groq (note spese OCR) | Durata account | Storage privato con URL firmati |
| R4 | Fatture pro-forma e pagamenti in entrata | Utente | Clienti dell'utente | Come R1 + IBAN dell'utente, stato dei pagamenti, Stripe Connect | Supabase, Stripe, Resend | 10 anni | Sequenza numerica, link pubblico firmato, promemoria con consenso dell'utente |
| R5 | Rubrica clienti (CRM) e lead assegnati | Utente | Clienti dell'utente | Contatti, note, storico | Supabase | Durata account | Export CSV (art. 20) |
| R6 | Integrazioni scelte dall'utente (Gmail invio, Google/Outlook Calendar, Meta Lead Ads) | Utente | Clienti dell'utente | Email inviate, eventi calendario, lead Meta | Google, Microsoft, Meta | Token cifrati; revoca in Impostazioni | AES-256-GCM sui token OAuth, rotazione chiave documentata |
| R7 | **Modulo Amministrazione (dal rilascio A-1/A-2)** — fatture elettroniche attive/passive, dati fiscali, F24, prima nota | Utente | Clienti e fornitori dell'utente | XML FatturaPA, importi, C.F./P. IVA, IBAN, scadenze fiscali, delega/credenziali intermediario (cifrate) | Intermediario SDI (Openapi.it o A-Cube, DPA da firmare — D8), Supabase, Groq (nessun dato bancario ai modelli) | 10 anni anche dopo disdetta (obbligo di legge, informativa dedicata) | 2FA obbligatoria (policy org), cifratura campi fiscali, conferma umana per ogni invio esterno, log dei calcoli con versione delle regole |

## C. Violazioni dei dati (art. 33–34)

Procedura: rilevazione (Sentry/log/segnalazione) → valutazione entro 24 h dal titolare → notifica al Garante entro 72 h se c'è rischio → comunicazione agli utenti-titolari interessati entro 48 h dalla scoperta (impegno nei Termini §9.2) → registro interno delle violazioni in `docs/compliance/VIOLAZIONI.md` (da creare al primo evento).

## D. Storico revisioni

| Data | Versione | Cosa |
|---|---|---|
| 2026-09-21 | 1.0 | Prima stesura (A-0). R7 descritto in anticipo per la DPIA; diventa operativo con A-1. |
