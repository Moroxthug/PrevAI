# Valutazione d'impatto sulla protezione dei dati (DPIA, art. 35 GDPR) — PrevAI e modulo Amministrazione

Versione 1.0 (bozza per il titolare) · A-0 · 21 settembre 2026 · Metodologia: linee guida WP248 rev.01 e allegato 1 al provvedimento del Garante n. 467/2018 (elenco dei trattamenti soggetti a DPIA).

> **Stato:** bozza tecnica completa. Prima del rilascio del modulo Amministrazione (A-5) il titolare deve: (1) completare la sezione 1 con i dati societari, (2) far leggere il documento al commercialista partner (D6) per la parte "dati fiscali", (3) firmare la sezione 8. Nessun parere del Garante è necessario (art. 36) se le misure della sezione 6 sono attuate: il rischio residuo è **basso**.

## 1. Descrizione sistematica del trattamento

**Titolare:** PrevAI — *ragione sociale, P. IVA, sede da inserire* — privacy@prevai.it.

**Perché serve una DPIA.** Il modulo Amministrazione porta PrevAI dal trattare "preventivi e anagrafiche" al trattare **i dati economici completi di una micro-impresa** (fatture attive e passive, incassi, scadenze fiscali, F24, previsioni di reddito e imposte) e i dati personali dei clienti finali contenuti nelle fatture. Ricadono i criteri WP248 n. 1 (valutazione/scoring: previsione fiscale e monitoraggio della soglia forfettaria), n. 4 (dati di natura finanziaria), n. 8 (uso innovativo: assistenti IA generativa) e la voce 6 dell'allegato al provv. 467/2018 (trattamenti su larga scala di dati finanziari con profilazione). Tre criteri → DPIA dovuta.

**Perimetro.** Tutta la piattaforma prevai.it (v2) con il modulo Amministrazione come è descritto in `docs/AMMINISTRAZIONE-PLAN.md` §8. Il registro `REGISTRO-TRATTAMENTI.md` elenca i singoli trattamenti (T1–T7 come titolare, R1–R7 come responsabile).

**Natura.** Raccolta (inserimento dell'utente, import CSV/OFX, ricezione fatture passive da SDI), conservazione, elaborazione (calcolo imposte, generazione documenti con IA), comunicazione (invio a clienti, a SDI tramite intermediario, al commercialista in fase 2), cancellazione.

**Ambito.** Utenti attesi: artigiani e micro-imprese italiane (ordine di grandezza: migliaia). Per ogni utente: decine-centinaia di clienti finali l'anno. Dati sensibili in senso stretto (art. 9): **non richiesti**; possibile presenza incidentale nei campi liberi (es. descrizione di lavori in abitazione di persona con disabilità) → minimizzazione nelle istruzioni e nel prompt IA.

**Contesto.** Gli interessati sono (a) gli utenti, che si aspettano un gestionale sicuro; (b) i loro clienti, che non hanno un rapporto diretto con PrevAI e sono tutelati dall'accordo art. 28 (Termini §9) e dall'informativa che l'artigiano deve fornire. Fonti normative rilevanti: GDPR, D.Lgs. 196/2003, provvedimento del Garante sulla fatturazione elettronica (2018–2019: minimizzazione nel campo descrizione; consenso per la consultazione delle fatture passive), art. 2220 c.c. e DPR 633/72 (conservazione decennale), AI Act art. 50 (trasparenza), L. 132/2025 (uso dell'IA da parte dei professionisti).

**Finalità.** Fornire all'utente un gestionale fiscale: emettere fatture elettroniche, calcolare imposte e contributi del regime forfettario, ricordare le scadenze, tenere la prima nota e preparare la chiusura d'anno; in fase 2, condividere con il commercialista.

**Flusso dei dati (asset).**

| Asset | Dove | Chi vi accede |
|---|---|---|
| Database Postgres | Supabase, regione `aws-0-eu-west-1` (Irlanda, UE) — verificato 2026-09-21 (D7) | Applicazione (Vercel, funzioni serverless), titolare via pooler con credenziali in password manager |
| File (PDF, foto, XML) | Supabase Storage, bucket privato con URL firmati | Applicazione |
| Backup | Cifrati (passphrase in password manager), GitHub Actions artefatto 30 gg + `C:\Users\Admin\PrevAI-backups\` | Titolare |
| Modelli IA | Groq (USA) via API — testo dei preventivi, listino, dati cliente necessari, note spese; **mai** IBAN, credenziali, XML fatture | Applicazione |
| Intermediario SDI (A-1) | Openapi.it o A-Cube (UE) — XML FatturaPA completo | Applicazione con delega dell'utente |
| Email | Resend (USA); Gmail dell'utente se collegato | Applicazione |
| Messaggi | Meta WhatsApp Business (USA) | Applicazione |
| Pagamenti | Stripe (USA) | Applicazione; Stripe è titolare autonomo per i propri obblighi |

## 2. Necessità e proporzionalità

| Principio | Come è rispettato |
|---|---|
| Liceità (art. 6) | Contratto (6.1.b) per il servizio; obbligo legale (6.1.c) per la conservazione decennale; legittimo interesse (6.1.f) per sicurezza e telemetria; consenso (6.1.a) per marketing e, come richiesto dal Garante, per l'**attivazione della ricezione delle fatture passive** (scelta attiva e tracciata dell'utente) |
| Trasparenza (artt. 12–14) | Privacy Policy e Termini §9 (accordo art. 28); informativa dedicata al modulo Amministrazione al momento dell'attivazione (retention 10 anni post-disdetta); avviso IA al primo contatto (art. 50 AI Act) |
| Minimizzazione (art. 5.1.c) | Nessun dato art. 9 richiesto; campo descrizione fattura con avviso di minimizzazione; ai modelli IA va solo il necessario al documento, mai dati bancari o fiscali aggregati; nessun aggregatore bancario nella fase 1 (import file, non credenziali della banca) |
| Esattezza | Ogni calcolo fiscale è spiegato (formula, aliquota, fonte, versione delle regole) e verificabile dall'utente; regole riviste dal commercialista partner (D6) |
| Limitazione della conservazione | Retention differenziata (registro): 10 anni per documenti fiscali, 30 gg post-cancellazione per il resto, 90 gg per i log |
| Diritti degli interessati | Export dati (art. 20) in CSV/PDF/XML, cancellazione dell'account, portale per gli utenti; per i clienti finali risponde l'artigiano con l'assistenza di PrevAI (Termini §9.2) |
| Responsabili (art. 28) | Elenco e stato dei DPA in `RESPONSABILI-ART28.md`; sub-responsabili autorizzati in via generale con preavviso di 14 gg |
| Trasferimenti (cap. V) | Fornitori USA con SCC o DPF; DB e file in UE; intermediario SDI in UE |
| Nessuna decisione automatizzata con effetti giuridici (art. 22) | Invio a SDI, pagamenti, invio dichiarazioni: sempre conferma esplicita dell'utente; nessuno scoring creditizio dei clienti finali (resta fuori dall'alto rischio AI Act) |

## 3. Consultazione degli interessati

Prevista nella fase beta di A-5 (utenti pilota): questionario su chiarezza dell'informativa, comprensibilità dei calcoli, percezione del rischio. Il parere del commercialista partner (D6) sostituisce la consultazione per gli aspetti fiscali. Esito da annotare nella sezione 8.

## 4. Rischi per i diritti e le libertà

Scala: probabilità (P) e gravità (G) 1–4; rischio = P × G (≤4 basso, 5–8 medio, ≥9 alto). Valutazione **prima** delle misure della sezione 6.

| ID | Rischio | Evento temuto | P | G | Livello |
|---|---|---|---|---|---|
| R-01 | Accesso illegittimo a dati finanziari (violazione account) | Credenziali rubate/phishing → lettura fatture, IBAN, redditi; frode ai danni dei clienti finali (bonifico dirottato) | 3 | 4 | **alto** |
| R-02 | Esfiltrazione del database o dei backup | Dump esposto → tutti i dati fiscali di tutti gli utenti | 2 | 4 | **medio-alto** |
| R-03 | Accesso trasversale tra organizzazioni (IDOR) | Un utente legge i dati di un altro | 2 | 4 | **medio-alto** |
| R-04 | Errore di calcolo fiscale / regole obsolete | L'utente paga imposte sbagliate, sanzioni; perdita di fiducia | 3 | 3 | **alto** |
| R-05 | Fuga di dati verso i fornitori IA (uso per addestramento, log) | Dati dei clienti finali presso terzi senza base | 2 | 3 | medio |
| R-06 | Dati eccedenti nelle fatture elettroniche (Garante 2018) | Descrizioni con dati sanitari/eccedenti trasmesse a SDI e conservate 10 anni | 2 | 3 | medio |
| R-07 | Perdita di disponibilità/integrità (bug, cancellazione, ransomware) | Documenti fiscali persi → inadempimenti dell'utente | 2 | 4 | **medio-alto** |
| R-08 | Trasferimenti extra-UE non conformi | Fornitore USA senza SCC/DPF valide | 1 | 3 | basso |
| R-09 | Mancata trasparenza sull'IA (AI Act art. 50) | L'utente o il cliente finale non sa di interagire con/leggere output IA; sanzioni | 2 | 2 | basso |
| R-10 | Conservazione oltre il necessario / cancellazione impossibile | Dati non fiscali tenuti dopo la disdetta; oppure fatture cancellate prima dei 10 anni | 2 | 2 | basso |
| R-11 | Credenziali/deleghe verso l'intermediario SDI compromesse | Emissione di fatture false a nome dell'utente | 2 | 4 | **medio-alto** |
| R-12 | Commercialista (fase 2) come titolare autonomo senza flussi definiti | Dati condivisi senza base/ruoli chiari | 2 | 3 | medio |

## 5. Misure già in essere (v2, verificate in QA Phase 62–64 e V2-6)

- Autenticazione better-auth: hash password, verifica email, revoca sessioni al reset, **2FA TOTP con codici di backup**, rate limit su login/2FA, registro delle attività di sicurezza visibile all'utente.
- Segregazione per organizzazione con test IDOR sull'intera matrice di rotte (`security.e2e.test.ts`); permessi per ruolo (owner/admin/office/foreman/viewer).
- Cifratura in transito (TLS/HSTS), header di sicurezza, CORS chiuso, CSP.
- Cifratura a riposo AES-256-GCM dei token OAuth con chiave fuori dal DB e procedura di rotazione (`RUNBOOKS.md` §6).
- Backup cifrati con verifica di restore, runbook di ripristino.
- Storage privato con URL firmati a scadenza; token pubblici firmati e a scadenza per preventivi/fatture.
- Avviso IA al primo contatto in ogni assistente e marcatura dei PDF generati/assistiti dall'IA (V2-6a, AI Act art. 50).
- Webhook con firma verificata (Stripe, Resend, Meta).

## 6. Misure aggiuntive decise in A-0 e nelle fasi successive

| Misura | Rischi trattati | Fase | Stato |
|---|---|---|---|
| **Policy "2FA obbligatoria" per organizzazione** (`business_profiles.two_factor_required`): il titolare la attiva, il modulo Amministrazione la impone; chi non ha la 2FA riceve 403 su tutte le API finché non la attiva | R-01, R-11 | A-0 | ✅ fatto (`authMiddleware.ts`, `/api/security/policy`, gate nella dashboard, e2e) |
| **Cifratura a riposo dei campi fiscali** (`fieldCrypto.ts`, prefisso `enc1:`): IBAN oggi; in A-1 credenziali/delega intermediario; script per il pregresso e rotazione chiave | R-02, R-11 | A-0 (IBAN), A-1 (credenziali) | ✅ IBAN; ⬜ A-1 |
| Accordo art. 28 utente↔PrevAI nei Termini (§9) con impegno di notifica violazioni entro 48 h | R-03, R-12 (base per fase 2) | A-0 | ✅ |
| Registro dei trattamenti e questa DPIA; elenco DPA fornitori | tutti | A-0 | ✅ bozza |
| DPA con Groq (verifica no-training, sede, SCC) o passaggio a provider UE / clausole; prompt senza dati bancari | R-05 | A-0 → A-1 | ⬜ titolare (`RESPONSABILI-ART28.md`) |
| DPA con l'intermediario SDI, delega tracciata, conferma esplicita per ogni invio, revoca in un clic | R-11, R-06 | A-1 (D8) | ⬜ |
| Avviso di minimizzazione nel campo descrizione fattura + attivazione fatture passive come scelta attiva loggata | R-06 | A-1 | ⬜ |
| Motore regole versionato con golden test verificati dal commercialista; ogni numero spiegato; log del calcolo | R-04 | A-2 (D6) | ⬜ — checklist in `REVISIONE-COMMERCIALISTA.md` |
| Retention differenziata implementata (job di cancellazione post-disdetta che risparmia i documenti fiscali; informativa all'attivazione) | R-10 | A-4 | ⬜ |
| Pen-test esterno prima del lancio del modulo | R-01, R-02, R-03 | A-5 | ⬜ |
| Accordo di contitolarità/flussi con lo studio partner, informativa L. 132/2025 | R-12 | A-6 | ⬜ |
| Formazione documentata sull'IA per chi opera il sistema (AI Act art. 4) | R-09 | A-0 | ⬜ titolare: 2 h, annotare data e contenuti qui sotto |

## 7. Rischio residuo (dopo le misure della sezione 6)

| ID | P | G | Residuo | Nota |
|---|---|---|---|---|
| R-01 | 1 | 4 | basso | 2FA obbligatoria + audit log + rate limit; resta il furto di dispositivo con sessione aperta (revoca sessioni) |
| R-02 | 1 | 3 | basso | IBAN e credenziali cifrati; il resto dei dati fiscali è in chiaro nel DB (cifratura a livello di disco di Supabase): accettato, rivalutare se si aggiungono saldi bancari via PSD2 |
| R-03 | 1 | 4 | basso | test IDOR continui in CI |
| R-04 | 2 | 2 | basso | dipende dalla revisione del commercialista (D6): finché non c'è, il modulo resta in beta con disclaimer |
| R-05 | 1 | 3 | basso | subordinato al DPA Groq |
| R-06 | 1 | 2 | basso | |
| R-07 | 1 | 3 | basso | backup verificati |
| R-11 | 1 | 4 | basso | cifratura + 2FA + conferma umana |
| Altri | ≤ 2 | ≤ 2 | basso | |

Conclusione: con le misure di A-0 attuate e quelle di A-1/A-2 pianificate, **nessun rischio residuo alto**; non serve la consultazione preventiva del Garante (art. 36). La DPIA va **riesaminata** a ogni fase A-N e comunque ogni 12 mesi, o se cambia un fornitore chiave (IA, SDI, hosting).

## 8. Approvazione e riesami

| Data | Chi | Ruolo | Esito |
|---|---|---|---|
| 2026-09-21 | (agente, A-0) | redazione bozza | — |
| | titolare | approvazione | ⬜ |
| | commercialista partner (D6) | parere sezione fiscale | ⬜ |

Formazione IA (art. 4 AI Act): *data, partecipanti, contenuti* — ⬜
