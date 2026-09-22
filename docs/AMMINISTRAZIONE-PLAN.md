# PrevAI Amministrazione — Fatturazione in house, obblighi fiscali e "indipendenza dal commercialista"

**Stato:** ricerca + piano, nessun codice. Scritto il 2026-09-21. Piano d'azione complessivo e stato avanzamento: `PIANO-AZIONE.md`. Segue e dipende da `PREVAI-V2-PLAN.md` (si costruisce sulla v2, non sulla v1).
**Decisioni già prese dal titolare:** target iniziale = **forfettari**; poi eventualmente **commercialista umano nel loop**.
**Domande a cui questo documento risponde:** cosa fare, come, quanto far pagare, pacchetti vs add-on/paywall, GDPR, AI Act / legge italiana IA.

---

## 1. Tesi in una pagina

Gli artigiani forfettari oggi pagano **900–1.500 €/anno** a un commercialista tradizionale, o **365–560 €/anno** a un "commercialista online" (Fiscozen, Quickfisco, FlexTax), per un regime in cui il calcolo delle tasse è **deterministico**: ricavi incassati × coefficiente di redditività (86% in edilizia/impianti) − contributi INPS versati = imponibile; × 15% (o 5% i primi 5 anni). Il vero lavoro non è il calcolo, è **disciplina**: fatturare correttamente via SDI, sapere quanto mettere via ogni mese, non mancare una scadenza, non sfondare la soglia degli 85.000 € senza accorgersene, e produrre a fine anno un quadro LM pulito.

PrevAI ha un vantaggio strutturale che nessun concorrente fiscale ha: **è già dentro il flusso di lavoro dell'artigiano** (preventivo → contratto → cantiere → SAL → fattura → incasso, dalla v2). Fiscozen e Quickfisco partono dalla fattura; PrevAI parte dal preventivo, quindi conosce i ricavi *futuri*, non solo quelli passati. Questo permette una cosa che nessuno fa: **previsione fiscale sul lavoro in pipeline** ("se accetti questo cantiere da 12.000 € superi la soglia a novembre").

Il posizionamento credibile e legalmente sicuro non è "senza commercialista" ma: **"PrevAI fa il 90% del lavoro; tu firmi; il commercialista — il tuo o il nostro — fa la dichiarazione e costa una frazione".** Software puro nella fase 1, commercialisti iscritti all'Albo in convenzione nella fase 2.

---

## 2. Ricerca: mercato e concorrenza

### 2.1 Dimensione
- Nel 2025 il **48,5% delle nuove partite IVA** ha scelto il forfettario (MEF, Osservatorio Partite IVA, 12/02/2026). Lo stock di forfettari è nell'ordine dei **~2 milioni** di contribuenti (dato MEF dichiarazioni — da riverificare con l'ultimo rapporto prima di usarlo in marketing).
- Il sotto-segmento PrevAI (edilizia, impianti, finiture — ATECO 41–43) è il più penalizzato dal regime: coefficiente **86%**, il più alto in tabella, quindi la sensibilità al "quanto pago di tasse" è massima.

### 2.2 Concorrenti diretti (prezzi rilevati settembre 2026)

| Prodotto | Modello | Prezzo forfettari | Cosa include | Limite |
|---|---|---|---|---|
| **Fiscozen** | software + commercialista dedicato | **399 €/anno** IVA incl. (forfettari); 999 €/anno + IVA semplificato | dichiarazione, F24, INPS, consulenza umana, fatturazione | non conosce il cantiere; fatturazione basica |
| **Quickfisco** | "commercialista digitale" | **365 €/anno** Standard, **475 €** Premium, IVA incl., no rinnovo automatico | come sopra, solo forfettari | solo forfettari (scelta deliberata) |
| **FlexTax** | software + commercialista | **366 €/anno** professionisti (319 € dal 2° anno); **560 €** artigiani e commercianti (con Camera di Commercio) | come sopra | prezzo artigiani più alto = segnale che il segmento costa di più da servire |
| **Fatture in Cloud** (TeamSystem) | solo software | **48 €/anno** piano Forfettari primo anno (poi 96 €), Standard 144 €, Premium 252 €, Complete 612 € | fatturazione SDI, incassi, prima nota; conservazione delegata gratis ad AdE | nessun aiuto fiscale: rimanda al commercialista |
| Commercialista tradizionale | umano | **900–1.500 €/anno** | tutto, di persona | costo, lentezza, zero software |

**Lettura:** il mercato ha già fissato due prezzi psicologici: **~50–100 €/anno** per "software fatture" e **~400–500 €/anno** per "commercialista incluso". Non c'è nessuno nel mezzo che offra **"software fiscale completo + gestione impresa, senza umano"** a ~150–250 €/anno: è lo spazio vuoto in cui PrevAI entra nella fase 1, per poi salire a ~450 €/anno con l'umano nella fase 2.

---

## 3. Ricerca: regole del forfettario da codificare (stato 2026)

Queste regole vanno in un **motore di regole versionato per anno fiscale** (`lib/fiscal/rules/2026.ts`), mai sparse nel codice: cambiano a ogni legge di bilancio e devono essere revisionate da un commercialista prima del rilascio.

**Accesso e permanenza**
- Ricavi/compensi anno precedente ≤ **85.000 €** (ragguagliati ad anno).
- Spese per lavoro dipendente/accessorio/collaboratori ≤ **20.000 €** lordi.
- Redditi da lavoro dipendente/assimilati anno precedente ≤ **30.000 €**, elevati a **35.000 €** per 2025 e 2026.
- **Uscita**: > 100.000 € nell'anno → uscita **immediata** (IVA da quella operazione); 85.001–100.000 € → uscita dall'anno successivo. Questa è la regola con più valore per l'artigiano: va monitorata in tempo reale **incluso il lavoro in pipeline**.

**Determinazione dell'imposta**
- Imponibile = ricavi **incassati** (criterio di cassa) × **coefficiente di redditività** per codice ATECO (edilizia e impianti, gruppi 41–43: **86%**; commercio 40%; professionisti 78%; tabella completa: allegato 2, L. 145/2018 — nota: nuova classificazione ATECO 2025, verificare mappatura).
- − contributi previdenziali **versati** nell'anno.
- × **15%** imposta sostitutiva (IRPEF, addizionali, IRAP), oppure **5%** per i primi 5 anni se: nessuna attività nei 3 anni precedenti, non mera continuazione di lavoro dipendente, ricavi del precedente titolare entro soglia.
- Nessuna IVA in fattura, nessuna ritenuta subita/operata (dicitura obbligatoria in fattura), **bollo 2 €** su fatture > 77,47 € (assolto virtualmente, trimestrale via F24 — adempimento che il software deve gestire in automatico).

**INPS Gestione Artigiani 2026** (Circ. INPS 14/2026)
- Reddito minimale **18.808 €**; aliquota **24%** artigiani (24,48% commercianti); fissi minimi ≈ **4.521 €/anno** artigiani, in 4 rate trimestrali (16/5, 20/8, 16/11, 16/2) + eccedenza sul reddito oltre il minimale a saldo/acconto con le imposte.
- Riduzione **35%** su richiesta per forfettari (da esercitare telematicamente, con effetto anche sull'accredito contributivo).
- Riduzione **50%** per 36 mesi per i nuovi iscritti dal 2025 (L. 207/2024) — alternativa alla 35%, va confrontata caso per caso: è una decisione con impatto pensionistico → **qui serve l'umano o quantomeno un disclaimer forte**.

**Scadenze annuali da mettere nello scadenzario**
- 30/6 saldo anno precedente + 1° acconto (40% o 50%); 30/11 2° acconto; rate trimestrali INPS; bollo virtuale trimestrale; **30/10** invio Redditi PF (quadro LM); LIPE non dovute (niente IVA).
- Fatturazione elettronica **obbligatoria per tutti i forfettari dal 1/1/2024** (il vecchio esonero non esiste più). Chi fattura solo elettronicamente ha decadenza accertamento ridotta di un anno.

**Adempimenti che il contribuente può fare da solo (legalmente)**
- Emissione fatture SDI, pagamento F24 via home banking/Fisconline, invio Redditi PF via Fisconline con SPID/CIE (con **precompilata anche per P.IVA**, alimentata dalle fatture SDI). Nessuno di questi richiede un intermediario abilitato.

---

## 4. Ricerca: infrastruttura SDI (fatturazione elettronica in house)

Non ci accreditiamo come canale SdI (accreditamento AdE, canale SFTP/web service, firma qualificata, conservazione AgID: mesi e costi fissi). Si usa un **intermediario API accreditato** in white-label. Tre candidati verificati:

| Provider | Prezzo | Conservazione a norma | Note |
|---|---|---|---|
| **Openapi.it** (SDI API) | pay-as-you-go, **nessun setup**: creazione fattura 0,070 € (0,022 € col miglior piano), firma+conservazione 0,125 € (0,052 €), ricezione/notifiche **gratis** (1.000/giorno), download 0,001 € | inclusa (opzione firma + legal storage) | **≈ 0,20 €/fattura a listino, ≈ 0,07 € a volume**. Sandbox con simulazione fattura fornitore. Il più economico e il più trasparente. |
| **A-Cube API** | non pubblicato, su preventivo | inclusa | Accreditato SdI, webhook per ogni evento, sandbox gratuita, integration manager dedicato, SLA. Multi-paese UE (utile se un giorno serve per QuoteAI/altri mercati). Da chiedere preventivo. |
| **Fatture in Cloud API** (TeamSystem) | licenza per utente finale | **non gestita** — delegabile gratis ad AdE | Ci renderebbe rivenditori di TeamSystem: sconsigliato, è un concorrente diretto. |

**Costo unitario stimato per un artigiano forfettario**: 50–150 fatture/anno × ~0,20 € = **10–30 €/anno** a listino, che scende a 4–10 € a volume. Trascurabile rispetto al prezzo di vendita: il paywall SDI è puro margine.

**Requisiti operativi**: per ogni cliente serve una **delega/onboarding** presso l'intermediario (P.IVA, codice fiscale, regime), la scelta del **codice destinatario** (quello dell'intermediario, comunicato ad AdE dal cliente nel portale Fatture e Corrispettivi — passo guidato in-app con screenshot) per ricevere le passive, e il **contratto ex art. 28 GDPR** con l'intermediario (responsabile del trattamento). Il ciclo passivo (fatture fornitori: materiali, subappalti) è gratuito in ricezione e vale oro: alimenta prima nota, costi per cantiere (già in v2) e la precompilata.

**Riconciliazione bancaria (fase 2, non MVP)**: PSD2/AISP. GoCardless Bank Account Data ha **chiuso il tier gratuito e l'onboarding nuovi clienti**; Tink, TrueLayer, Salt Edge, Fabrick sono a prezzo negoziato (ordine di grandezza 1–3 €/conto/mese). Va negoziato quando c'è volume; nel frattempo import CSV/OFX dell'estratto conto copre il bisogno.

---

## 5. Legale: cosa può fare il software, cosa richiede un commercialista

Questa è la sezione che decide il prodotto. Tre riferimenti:

1. **Cass. pen. sez. VI n. 10100/2011**: l'assistenza fiscale e contabile a imprese e lavoratori autonomi è "atto tipico" della professione di commercialista; basta che la prestazione sia caratteristica della professione, senza bisogno di una riserva esplicita di legge.
2. **Cass. SS.UU. pen. n. 11545/2012** (il riferimento consolidato): tenere la contabilità, redigere dichiarazioni e fare i versamenti **non sono atti riservati in sé**; diventano reato ex **art. 348 c.p.** (esercizio abusivo) quando svolti **in modo continuativo, organizzato e retribuito, creando l'apparenza** dell'attività di un professionista abilitato.
3. **Legge 132/2025 (legge italiana sull'IA), art. 13**: nelle professioni intellettuali l'IA è solo strumento di supporto, il professionista resta responsabile e deve **informare il cliente per iscritto** dell'uso dell'IA.

**Conseguenze di prodotto (non negoziabili):**

| Cosa | Fase 1 (software puro) | Fase 2 (umano nel loop) |
|---|---|---|
| Emettere fatture SDI, calcolare bollo, conservare | ✅ è software, il cliente è l'emittente | ✅ |
| Calcolare imposta e INPS, mostrare "quanto mettere via", scadenzario, F24 precompilato che **il cliente paga da solo** | ✅ **strumento** che il contribuente usa su sé stesso, come una calcolatrice evoluta. Ogni numero con la formula visibile ("perché questo importo") | ✅ |
| Monitor soglia 85k/100k, simulazioni "se accetto questo cantiere" | ✅ informativo | ✅ |
| Compilare e **inviare** Redditi PF / quadro LM per conto del cliente | ❌ **no** — fatto sistematicamente e a pagamento = esattamente la fattispecie SS.UU. 11545/2012. In alternativa: **export** del quadro LM precompilato + guida passo-passo per farlo da solo su Fisconline, oppure **"Condividi col tuo commercialista"** (accesso in sola lettura + export) | ✅ inviato da **commercialista iscritto all'Albo** in convenzione, abilitato Entratel, con proprio mandato/lettera d'incarico col cliente e propria polizza RC |
| Rispondere a domande fiscali personalizzate ("mi conviene la riduzione 35% o 50%?") | ⚠️ solo **informazione generale** + disclaimer; l'assistente AI rimanda al professionista per la decisione. Vietata la chat "consulenza" con operatori non iscritti | ✅ consulenza umana del commercialista (chat/call), con informativa ex art. 13 L. 132/2025 sull'uso dell'IA a supporto |
| Scelte con effetto pensionistico/patrimoniale (riduzioni contributive, uscita dal regime, opzione IVA) | ❌ solo spiegazione neutra | ✅ |

**Wording**: mai "commercialista digitale", "il tuo commercialista", "facciamo noi la dichiarazione" nella fase 1. Sì a "amministrazione", "controllo fiscale", "assistente amministrativo". Nella fase 2 il nome e l'iscrizione all'Albo del professionista che firma sono visibili al cliente.

**Struttura fase 2**: rete di commercialisti convenzionati (o una società tra professionisti partner), non dipendenti. PrevAI vende software + intermediazione; il rapporto professionale (mandato, responsabilità, RC) è tra cliente e commercialista. È il modello Fiscozen/FlexTax. Economics tipici da negoziare: **80–150 € per dichiarazione forfettaria** al professionista, che con un prezzo cliente di ~450 €/anno lascia margine per software e supporto.

---

## 6. GDPR

Il perimetro dati cambia natura: da "preventivi e anagrafiche" a **dati finanziari completi dell'impresa** (fatture attive/passive, corrispettivi, F24, saldi bancari, redditi). Adeguamenti obbligatori prima del lancio:

1. **Registro dei trattamenti aggiornato** e **DPIA** (art. 35): trattamento su larga scala di dati finanziari con profilazione (previsioni fiscali) → la valutazione d'impatto è dovuta, non opzionale.
2. **Nomina responsabili (art. 28)**: intermediario SDI, provider AI (Groq oggi: verificare DPA, sede trattamento, no-training; valutare provider UE o clausole SCC), hosting (Vercel/Supabase: regione UE per il nuovo DB fiscale, DPA in essere), eventuale aggregatore bancario.
3. **Base giuridica**: esecuzione del contratto per il servizio; **obbligo legale** per la conservazione decennale delle fatture (art. 2220 c.c. / DPR 633/72) → retention differenziata: dati fiscali 10 anni anche dopo la disdetta (con informativa chiara), tutto il resto cancellato.
4. **Dati di terzi**: le fatture contengono dati personali dei **clienti dell'artigiano** (privati, con codice fiscale e indirizzo) → l'artigiano è titolare, PrevAI responsabile: serve il **DPA PrevAI ↔ utente** nelle condizioni d'uso (oggi probabilmente assente).
5. **Sicurezza**: cifratura a riposo per campi fiscali sensibili (IBAN, credenziali/deleghe), 2FA **obbligatoria** (non opzionale) per chi attiva il modulo, audit log già presente dalla v2, segregazione per organizzazione (già IDOR-tested in v2), export dati in formato leggibile (art. 20).
6. **Provvedimento Garante sulla fatturazione elettronica** (2018–2019): minimizzazione dei dati nel campo descrizione (no dati sanitari o eccedenti), accesso alle fatture passive solo con consenso/adesione esplicita del contribuente → il passo "attiva ricezione fatture passive" deve essere una scelta attiva, tracciata.
7. Il **commercialista** in fase 2 è **titolare autonomo** per la sua attività professionale: serve un accordo di contitolarità/flussi dati e un'informativa che lo dica.

---

## 7. AI Act e legge italiana sull'IA

**Classificazione**: un assistente che calcola imposte e spiega scadenze per un'impresa **non rientra nell'Allegato III** (alto rischio: credit scoring, accesso a servizi essenziali per persone fisiche, ecc.). È un sistema a **rischio limitato** con obblighi di trasparenza. Attenzione a non sconfinare: **niente scoring di affidabilità creditizia** dei clienti finali dell'artigiano e **niente decisioni automatiche** con effetti giuridici (es. inviare un F24 o una dichiarazione senza conferma umana) — questo tiene il prodotto fuori dall'alto rischio e dall'art. 22 GDPR.

**Obblighi in vigore dal 2 agosto 2026 (art. 50 AI Act)** — già applicabili a PrevAI oggi:
- L'utente deve sapere **al primo contatto** che sta parlando con un'IA (assistente, support bot, WhatsApp bot): messaggio esplicito in-context, non nei ToS.
- **Marcatura tecnica** (metadati/watermark) dei contenuti generati dall'IA: PDF di preventivi, testi di email, descrizioni generate → aggiungere metadati "AI-generated" nei PDF e negli export; per i sistemi già sul mercato prima del 2/8/2026 il compromesso Digital Omnibus (6/5/2026) concede fino al **2 dicembre 2026** per la marcatura art. 50(2). **Questa è una cosa da fare in v2 indipendentemente dal modulo fiscale.**
- **Alfabetizzazione (art. 4)**: chi in PrevAI opera/progetta il sistema deve avere formazione documentata sull'uso dell'IA.
- Sanzioni per violazione trasparenza: fino a **15 M€ o 3% del fatturato globale**.

**Legge 132/2025**: quando entra il commercialista (fase 2), egli deve informare per iscritto il cliente che usa IA (PrevAI) come supporto e resta pienamente responsabile del risultato → template di informativa fornito da noi nel flusso di incarico. Inoltre la legge prevede aggravanti per reati commessi tramite algoritmi e obblighi di governance nel settore finanziario: rilevante solo se in futuro entriamo nei pagamenti (Stripe Connect resta il PSP, noi non lo siamo).

**Regola di prodotto**: ogni output fiscale dell'IA è **spiegabile e verificabile** (formula, aliquota, fonte normativa, anno regole) e ogni azione con effetto esterno (invio SDI, pagamento, invio dichiarazione) richiede **conferma esplicita dell'utente**. Log di ogni calcolo con versione del motore regole.

---

## 8. Prodotto: moduli e MVP

Costruito sopra la v2 (motore fatture acconto/SAL/saldo, costi per cantiere, note spese AI, team, 2FA, audit log). Nomenclatura di lavoro: **PrevAI Amministrazione**.

### Moduli
1. **Fatture SDI** — emissione da SAL/fattura v2 → XML FatturaPA → intermediario → stati SdI (consegnata, scartata, mancata consegna) → conservazione. Ciclo passivo in ricezione → prima nota e costi per cantiere. Bollo virtuale calcolato e F24 trimestrale precompilato. Note di credito. Fatture verso PA (split payment non applicabile ai forfettari, ma CIG/CUP sì).
2. **Motore fiscale forfettario** — regole versionate per anno; calcolo live di imponibile, imposta (5/15), INPS (fissi + eccedenza, riduzioni), acconti; **"Quanto mettere via"** mensile; **monitor soglia** con proiezione su pipeline (preventivi accettati + contratti firmati); simulatore "se accetto questo lavoro".
3. **Scadenzario e F24** — calendario personalizzato (imposte, INPS, bollo, Redditi), F24 precompilati scaricabili/copiabili in home banking, promemoria email/WhatsApp, spunta "pagato" con upload quietanza.
4. **Prima nota e cassa** — incassi (già in v2 + Stripe Connect), costi (fatture passive + scontrini AI), import CSV/OFX estratto conto; **utile netto dopo tasse in tempo reale**; margine per cantiere già presente.
5. **Chiusura d'anno** — pacchetto per Redditi PF/quadro LM: prospetto ricavi incassati, contributi versati, coefficiente, imposta, acconti versati; export PDF + CSV; guida passo-passo Fisconline (precompilata P.IVA); **"Condividi col commercialista"** (link in sola lettura, scadenza, log accessi).
6. **Fase 2 — Commercialista incluso** — marketplace/convenzione: incarico digitale, invio dichiarazione da parte del professionista, chat/consulenza, informativa L. 132/2025, fatturazione del professionista tramite PrevAI (o diretta).

### MVP (ciò che rende il modulo vendibile)
Moduli 1 + 2 + 3, con **onboarding fiscale** (regime, ATECO, data inizio attività per il 5%, riduzione INPS scelta, acconti già versati). Senza il 4 e il 5 il prodotto è già "il primo software che ti dice quanto pagherai di tasse sul lavoro che stai preventivando".

---

## 9. Pricing e packaging

### 9.1 Principi
- I piani PrevAI attuali (Starter 19 €, Pro 49 €, Elite 59 €/mese) vendono **preventivi**. L'amministrazione è un valore diverso, con un prezzo di riferimento di mercato diverso (§2.2): va venduta come **add-on**, non spalmata nei piani, altrimenti (a) si regala a chi non la usa, (b) si perde il confronto diretto "vs Fiscozen 399 €".
- **Paywall sul valore ricorrente, gratis ciò che crea dipendenza**: calcolatore tasse e scadenzario **gratuiti per tutti gli utenti PrevAI** (costo zero, generano abitudine e dati); a pagamento l'esecuzione (invio SDI, F24 pronti, conservazione, prima nota, chiusura d'anno).
- Prezzo **annuale** privilegiato (il mercato fiscale è annuale, riduce churn e allinea al ciclo dichiarativo), con mensile come porta d'ingresso.

### 9.2 Proposta

| Pacchetto | Prezzo | Contenuto | Riferimento competitivo |
|---|---|---|---|
| **Gratis (in ogni piano PrevAI)** | 0 | calcolatore imposte/INPS, scadenzario, monitor soglia | Fatture in Cloud non lo ha; Fiscozen lo dà solo ai paganti |
| **Amministrazione** (add-on) | **12 €/mese o 120 €/anno** (+IVA) | Fatture SDI illimitate + conservazione, bollo, F24 precompilati, prima nota, import estratto conto, chiusura d'anno + condivisione col commercialista | sopra Fatture in Cloud (48–96 €, solo fatture), molto sotto Fiscozen (399 €). Costo vivo ≈ 10–30 €/anno SDI → margine > 75% |
| **Amministrazione + Commercialista** (fase 2) | **39 €/mese o 420 €/anno** IVA incl. (prezzo al consumatore in IVA inclusa come i concorrenti) | tutto il precedente + dichiarazione redditi inviata da commercialista convenzionato + consulenza | Fiscozen 399, Quickfisco 365–475, **FlexTax artigiani 560**: siamo allineati sul prezzo ma con il gestionale cantieri incluso, che loro non hanno |
| **Bundle "Impresa completa"** | Elite 59 € + Amministrazione a **5 €/mese** invece di 12 | leva per spingere Elite | — |

Punti di attenzione: (a) **IVA**: gli artigiani forfettari non la detraggono, quindi comunicare prezzi IVA inclusa come fanno Fiscozen/Quickfisco; (b) il piano Commercialista richiede **calcolo dei costi del professionista** prima di fissare il prezzo (80–150 €/dichiarazione + supporto): 420 € regge solo se il software riduce il lavoro del professionista a revisione+invio; (c) test di prezzo con 2–3 varianti su landing dedicata prima del lancio; (d) niente "pacchetto una tantum" per la dichiarazione nella fase 1 (§5).

### 9.3 Unit economics indicativi (per utente Amministrazione, anno)
Ricavo 120 € · SDI 10–30 € · AI ~5 € · storage/DB ~2 € · supporto stimato 10 € → **margine lordo ≈ 60–75 €** (50–60%) nel caso peggiore a listino Openapi; > 80 € a volume. Fase 2: ricavo 420 € · costo professionista 100–150 € · sopra ≈ 40 € → **margine ≈ 220–280 €**.

---

## 10. Fasi (dopo il cutover v2, sequenziali, un agente alla volta)

| Fase | Contenuto | Sforzo |
|---|---|---|
| **A-0 Compliance & fondamenta** | DPIA, registro trattamenti, DPA utente↔PrevAI nei ToS, DPA con intermediario SDI e provider AI, 2FA obbligatoria per il modulo, cifratura campi fiscali, banner art. 50 AI Act su tutti gli assistenti + marcatura PDF/email generati (**vale per tutta PrevAI, scadenza 2/12/2026**), revisione con commercialista partner del motore regole 2026 | 1 sett. |
| **A-1 Fatture SDI** ✅ codice (2026-09-22) — resta D8 | onboarding delega/codice destinatario guidato, XML FatturaPA dal motore fatture v2, stati SdI via webhook + polling, conservazione, note di credito TD04, bollo virtuale + F24 trimestrale, ciclo passivo in ricezione. Adapter con interfaccia unica: `simulato` (default, non trasmette), `openapi` (pronto, inerte senza token), A-Cube da valutare col preventivo. **Il titolare deve firmare contratto, DPA e manuale di conservazione** prima che un'impresa possa emettere. Dettagli operativi in `RUNBOOKS.md` §6 | 2–3 sett. |
| **A-2 Motore fiscale forfettario** ✅ codice (2026-09-22) — resta D6 | motore versionato per anno d'imposta in `lib/config/src/fiscale/regole/2026.ts` (non `lib/fiscal/`: sta in `@workspace/config`, che è già dependency-free e importabile da frontend, server e test), onboarding fiscale, calcolo live per cassa, "quanto mettere via", monitor soglia con pipeline, simulatore; ogni numero con la sua formula, fonte e regole applicate; 5 casi golden come test. **Ogni regola nasce `non_revisionata`**: il prodotto lo dichiara in ogni schermata e in ogni risposta API, e il modulo resta dietro l'add-on `fiscal_engine` che nessun piano include. Si chiude con D6 seguendo `docs/compliance/REVISIONE-COMMERCIALISTA.md`. Dettagli operativi in `RUNBOOKS.md` §7 | 2 sett. |
| **A-3 Scadenzario + F24** ✅ codice (2026-09-22) — resta D10 | calendario unico (imposta, contributi INPS, bollo, dichiarazione) ricalcolato a ogni lettura, F24 **precompilati** come prospetto e non come facsimile del modello, promemoria in app + email (WhatsApp pronto ma inerte finché non c'è un template Meta approvato, D10), quietanze allegate alla scadenza. Tre regole nuove per il commercialista: F17 codici tributo, F18 causali INPS, F19 bollo. Dettagli operativi in `RUNBOOKS.md` §8 | 1 sett. |
| **A-4 Prima nota + chiusura d'anno** | incassi/costi unificati, import CSV/OFX, utile netto dopo tasse, pacchetto quadro LM, export, guida Fisconline, "Condividi col commercialista" | 2 sett. |
| **A-5 Pricing & lancio** | add-on Stripe, paywall, landing con test prezzo, migrazione utenti beta, contenuti SEO ("tasse forfettario elettricista", "soglia 85000 calcolo") | 1 sett. |
| **A-6 Commercialista nel loop** (fase 2, decisione separata) | convenzione con studio/rete, incarico digitale, flusso revisione→invio, chat consulenza, informativa L. 132/2025, fatturazione professionista, RC | 3–4 sett. + negoziazione |
| **Dopo** | riconciliazione PSD2 (quando c'è volume da negoziare), regime semplificato (LIPE, registri IVA, ritenute, CU), forfettari con dipendenti (20k), ordinario | piano separato |

**Totale fase 1 (A-0 → A-5): ~9–11 settimane** di sessioni sequenziali dopo la v2.

---

## 11. Rischi principali e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Errore di calcolo → danno al cliente → responsabilità | regole versionate + revisione annuale da commercialista + golden tests + disclaimer "strumento, non consulenza" + formula visibile + nessuna azione automatica |
| Contestazione art. 348 c.p. ("esercizio abusivo") | fase 1: il contribuente agisce su sé stesso, PrevAI non invia dichiarazioni né dà consulenza personalizzata; fase 2: solo iscritti all'Albo, mandato diretto |
| Cambi normativi ogni legge di bilancio (dicembre) | motore regole per anno, release "regole N+1" ogni gennaio, changelog visibile all'utente |
| Lock-in intermediario SDI | adapter con interfaccia unica; XML e ricevute SdI archiviati anche nel nostro storage; conservazione esportabile |
| Dati finanziari → target per attacchi | 2FA obbligatoria, cifratura, DPIA, pen-test prima del lancio (la suite security v2 è la base) |
| Cannibalizzazione del piano Elite | add-on separato + bundle Elite scontato |
| Sottostima costo umano fase 2 | non fissare il prezzo fase 2 finché non c'è una convenzione firmata con costi per pratica |

---

## 12. Decisioni richieste al titolare

1. **Nome del modulo** ("PrevAI Amministrazione" è il placeholder).
2. Conferma **prezzi** proposti (§9.2) come ipotesi di partenza per il test.
3. **Intermediario SDI**: parto con Openapi (prezzi pubblici, no setup) e chiedo in parallelo un preventivo ad A-Cube? Il contratto va firmato da te.
4. **Commercialista partner per la revisione delle regole** (serve già in A-0, prima della fase 2): ne hai uno di fiducia o lo cerco tra studi che già lavorano con software house?
5. Fase 2 (umano nel loop): **rete di professionisti convenzionati** vs **un unico studio partner** — la seconda è più semplice da avviare, la prima scala meglio.
6. Regione UE per il DB Supabase del modulo fiscale (oggi PrevAI è su Supabase: verificare la regione del progetto esistente).

---

## 13. Fonti principali consultate (settembre 2026)

- Regime forfettario 2026, regole e soglie: [FISCOeTASSE – Regime forfettario 2026: tutte le regole](https://www.fiscoetasse.com/approfondimenti/15066-regime-forfettario-2026-tutte-le-regole.html); [Informazione Fiscale](https://www.informazionefiscale.it/regime-forfettario-limiti-requisiti-come-funziona); [Fiscomania](https://fiscomania.com/regime-forfettario/); [MEF Osservatorio P.IVA via FidoCommercialista](https://fidocommercialista.it/aprire-partita-iva-forfettario)
- Coefficiente 86% edilizia/impianti: [codiceateco.org – 43.22.05](https://www.codiceateco.org/codice/43.22.05); [tabella coefficienti](https://calcolatoreforfettario.com/blog/coefficienti-redditivita-regime-forfettario)
- INPS artigiani 2026: [INPS – Gestioni artigiani e commercianti: i contributi per il 2026](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.gestioni-artigiani-e-commercianti-i-contributi-per-il-2026.html); [Confcommercio](https://www.confcommercio.it/-/gestioni-artigiani-e-commercianti-i-contributi); [Tutela Previdenziale – Circ. 14/2026](https://www.tutelaprevidenziale.it/artigiani-e-commercianti-contributi-inps-2026-aliquote-minimali-scadenze-circolare-n-14-2026/)
- Obbligo e-fattura forfettari dal 2024: [Aruba Magazine](https://www.aruba.it/magazine/fatturazione-elettronica/obbligo-fattura-elettronica-per-tutti-i-forfettari-dal-1-gennaio-2024.aspx); [BibLus](https://biblus.acca.it/fatturazione-elettronica-forfettari/)
- Dichiarazione in autonomia / precompilata P.IVA: [Agenzia delle Entrate – precompilata 2026](https://www.agenziaentrate.gov.it/portale/la-dichiarazione-precompilata-20261); [AdE – intermediari regime forfettario](https://www.agenziaentrate.gov.it/portale/schede/agevolazioni/regime-agevolato-forfettario/semplificazioni-e-adempimenti-intermediari); [Fiscozen – dichiarazione forfettario](https://www.fiscozen.it/guide/dichiarazione-dei-redditi-regime-forfettario/)
- Intermediari SDI: [Openapi – prezzi SDI](https://console.openapi.com/apis/sdi/pricing); [Openapi – prodotto](https://openapi.com/products/italian-electronic-invoicing); [A-Cube – API e-invoicing Italia](https://www.acubeapi.com/prodotti/api-e-invoicing-italia); [A-Cube – checklist conservazione 2026](https://www.acubeapi.com/blog/fatturazione-elettronica-e-conservazione-sostitutiva-checklist-per-il-2026)
- Concorrenti e prezzi: [Fiscozen – prezzi](https://www.fiscozen.it/prezzi/); [Fiscozen – tradizionale vs online 2026](https://www.fiscozen.it/guide/costi-partita-iva-forfettaria-commercialista-tradizionale-vs-servizi-online-2026/); [Quickfisco – prezzi](https://quickfisco.it/prezzi/); [FlexTax – prezzo](https://flextax.it/flextax-prezzo-quanto-costa-davvero-gestire-la-tua-partita-iva-online/); [Fatture in Cloud – costo](https://www.fattureincloud.it/costo/); [CAF Centro Fiscale – recensione FiC 2026](https://centrofiscale.com/fatture-in-cloud-recensione-2026/)
- Riserva professionale / art. 348 c.p.: [Eutekne – Cass. 10100/2011](https://www.eutekne.info/Sezioni/Art_329755.aspx); [Commercialista Telematico – SS.UU. 11545/2012](https://www.commercialistatelematico.com/articoli/2012/04/materie-riservate-agli-iscritti-agli-ordini-dopo-la-recente-sentenza-di-cassazione-n-115452012.html); [Giurisprudenza Penale – attività non riservate](https://www.giurisprudenzapenale.com/2021/03/25/lesercizio-abusivo-della-professione-di-commercialista-e-le-attivita-non-riservate/)
- Legge 132/2025 (IA, professioni): [Informazione Fiscale – obbligo informativa AI professionisti](https://www.informazionefiscale.it/fac-simile-informativa-cliente-professionista-intelligenza-artificiale-ai); [ICT Security Magazine](https://www.ictsecuritymagazine.com/articoli/legge-132-2025/); [Agenda Digitale – IA nella finanza](https://www.agendadigitale.eu/mercati-digitali/litalia-regola-lai-nella-finanza-sicurezza-e-fiducia-al-centro/)
- AI Act art. 50 dal 2/8/2026 e Digital Omnibus: [Agenda Digitale – obblighi trasparenza](https://www.agendadigitale.eu/sicurezza/obblighi-di-trasparenza-ai-act-cosa-devono-fare-le-aziende-dal-2-agosto-2026/); [MilanoFinanza](https://www.milanofinanza.it/news/ai-act-dal-2-agosto-2026-entrano-in-vigore-gli-obblighi-di-trasparenza-per-i-chatbot-ecco-cosa-202607311152178104); [Il Fatto Quotidiano](https://www.ilfattoquotidiano.it/2026/08/02/ai-act-obblighi-trasparenza-chatbot-notizie/8467449/)
- Open banking Italia: [Experian – PSD2 2026](https://www.experian.it/chi-siamo/psd2-e-open-banking-cosa-cambia-per-le-imprese-italiane-nel-2026/); [DEV – confronto provider 2026](https://dev.to/johnfrandsen/comparing-european-open-banking-api-providers-in-2026-plaid-truelayer-tink-gocardless-125c); [Fabrick – bank coverage](https://www.fabrick.com/it-it/prodotti/bank-coverage-api/)

> Nota di metodo: i prezzi dei concorrenti e le aliquote sono stati letti da fonti secondarie aggiornate al 2026; prima di usarli in materiale commerciale o nel motore regole vanno riverificati sulle fonti primarie (siti dei concorrenti, circolari INPS/AdE, testo di legge).
