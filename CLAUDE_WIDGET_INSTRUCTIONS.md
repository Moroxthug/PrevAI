# Istruzioni per l'Implementazione del Widget Funnel (PrevAI)

Ciao Claude! Questo file serve per allinearti sul progetto PrevAI e darti tutte le informazioni necessarie per sviluppare il **design e le funzionalità del Widget Funnel di acquisizione contatti edili**.

---

## 1. Contesto del Progetto (PrevAI)
PrevAI è una piattaforma italiana che permette a imprese edili e artigiani di generare preventivi professionali strutturati in capitoli partendo da testo libero, sfruttando l'AI (OpenAI). 
Il backend è un server Express/Node.js che si trova sotto `artifacts/api-server`, mentre il frontend principale è in `artifacts/preventivo-ai`. C'è anche una Sandbox di mockup in `artifacts/mockup-sandbox` che usiamo come terreno di prova.

Abbiamo appena ottimizzato il motore di calcolo del backend in [quotes.ts](file:///c:/Users/Admin/Downloads/PrevAI%20%282%29/PrevAI/artifacts/api-server/src/routes/quotes.ts) introducendo:
1. **RAG sul Listino Prezzi:** L'API esegue una ricerca semantica/testuale sul listino dell'azienda (`price_catalog_items`) e invia all'AI solo le voci più pertinenti, azzerando le allucinazioni sui prezzi unitari.
2. **Variabili Geometriche (Misure):** L'API ora accetta un oggetto `misure` (es. `{"Superficie Pavimento (mq)": 25, "Altezza Pareti (m)": 2.7}`) per calcolare le quantità in modo matematico.
3. **Range di Prezzo Dinamico:** La risposta della serializzazione del preventivo contiene ora i campi calcolati `prezzoMinimo` (90% del totale) e `prezzoMassimo` (125% del totale).

---

## 2. Il Tuo Compito: Progettare il Widget Funnel
Devi creare il design e l'interfaccia interattiva del **funnel di acquisizione lead**. Il widget deve essere integrabile nei siti web esterni delle imprese.

### Requisiti del Flusso (Multi-step Funnel):
1. **Step 1 (Scopo/Ambito):** L'utente seleziona il tipo di intervento (es. Ristrutturazione Bagno, Tinteggiatura, Cartongesso, ecc.).
2. **Step 2 (Misure Geometriche):** In base alla selezione, mostra input numerici specifici (es. se seleziona tinteggiatura, chiedi Mq stanza e Altezza pareti).
3. **Step 3 (Descrizione Libera):** Un campo di testo per note aggiuntive o dettagli specifici (es. "Voglio pittura lavabile bianca e grigio tortora dietro il letto").
4. **Step 4 (Acquisizione Contatto - LEAD):** Chiedi Nome, Email e Telefono. È lo step vincolante per inviare i dati.
5. **Step 5 (Risultato Stima):** Mostra un caricamento animato dell'AI e poi presenta il range di prezzo calcolato (`prezzoMinimo` - `prezzoMassimo`) in modo elegante con un disclaimer.

### Requisiti Estetici (Design di Alto Livello):
* **Stile:** Glassmorphism moderno (sfondi semitrasparenti sfocati `backdrop-blur`, bordi leggeri, ombre morbide) che si adatta a sfondi chiari e scuri.
* **Palette:** Gradienti che sfumano dal viola (`#7C3AED`) all'indigo (`#4F46E5`) e al ciano (`#06B6D4`), con tocchi ambra per elementi importanti/CTA.
* **Micro-animazioni:**
  * Transizioni fluide tra i vari step del funnel.
  * Contatore numerico animato per il calcolo del prezzo.
  * Animazione di caricamento (shimmer / pulse) durante l'elaborazione del preventivo.

---

## 3. Integrazione API (Come connettersi al Backend)
Il widget raccoglie i dati e invia una richiesta `POST /api/quotes` (o un futuro endpoint pubblico dedicato).

### Payload da inviare:
```json
{
  "rawInput": "Descrizione inserita dall'utente + informazioni sul tipo di intervento",
  "clientData": {
    "nome": "Mario Rossi",
    "email": "mario.rossi@example.com",
    "phone": "+393331234567"
  },
  "misure": {
    "Superficie Pavimento (mq)": 16,
    "Altezza Pareti (m)": 2.7
  }
}
```

### Struttura della Risposta da elaborare:
```json
{
  "id": "uuid-del-preventivo",
  "totale": 2500.00,
  "prezzoMinimo": 2250.00,
  "prezzoMassimo": 3125.00,
  "descrizioneGenerale": "..."
}
```

---

## 4. Dove implementare il Prototipo
Puoi creare un file dedicato sotto `artifacts/mockup-sandbox/src/components/mockups/prevai-redesign/WidgetFunnelDemo.tsx` e registrarlo nel file di importazione della sandbox per visualizzarlo nel browser, oppure implementarlo direttamente come script embeddabile standalone a seconda delle indicazioni dell'utente.

Buon lavoro!
