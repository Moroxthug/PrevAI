// Italiano (it-IT) di Documenti (Documents.dc.html, QuoteAI 127.7, i18n/screens/documents.ts): cosa dicono sui prezzi gli scontrini e le fatture dei fornitori
// letti dall'IA, e i file per cantiere.
export const doc = {
  dc: {
    back: "Indietro", more: "Altre azioni", retry: "Riprova", close: "Chiudi", title: "Documenti", upload: "Carica",
    empty: { title: "Insegna a PrevAI i tuoi prezzi", body: "Carica 3 fatture di fornitori o vecchi preventivi e teniamo d'occhio quanto ti costano davvero i materiali.", action: "Carica un documento" },
    trend: {
      up: "{{name}} è salito del {{pct}}", down: "{{name}} è sceso del {{pct}}", flat: "{{name}} non si è mosso",
      sub_one: "da {{count}} fattura da {{month}}", sub_other: "da {{count}} fatture da {{month}}",
      pillUp: "In su del {{pct}}", pillDown: "In giù del {{pct}}", pillFlat: "Stabile", chart: "Prezzo da {{from}} a {{to}}",
      update: "Aggiorna il listino", keep: "Tieni {{price}}", updated: "Listino portato a {{price}}", kept: "Tenuto {{price}} · te lo ricordiamo il mese prossimo", undo: "Annulla",
    },
    almost: { title: "I prezzi di {{name}} sono quasi pronti", sub: "{{have}} fatture su {{need}}" },
    key: { title: "Materiali chiave", link: "Listino", same: "Uguale", sub_one: "{{store}} · {{count}} fattura", sub_other: "{{store}} · {{count}} fatture", subNone: "{{count}} fatture" },
    read: {
      title: "Letti dall'IA", count: "{{count}} questo mese", Read: "Letto", Reading: "In lettura", Check: "Da controllare",
      prices_one: "{{count}} prezzo", prices_other: "{{count}} prezzi", pricesRead_other: "{{count}} prezzi letti", pricesRead_one: "{{count}} prezzo letto", changed: "{{count}} cambiati", unread_one: "{{count}} riga che non siamo riusciti a leggere", unread_other: "{{count}} righe che non siamo riusciti a leggere",
      none: "Nessun prezzo trovato", failed: "Non si è riusciti a leggerlo", filed: "Archiviato in {{job}}",
    },
    jobs: { title: "Per cantiere", files_one: "{{count}} file", files_other: "{{count}} file", company: "Impresa", companySub: "Non archiviati in un cantiere · {{count}}", sub: "{{client}} · {{count}}", subNone: "{{count}}" },
    sheet: { title: "Carica", sub: "Fatture, scontrini, listini, vecchi preventivi", photo: "Scatta una foto", photoSub: "Fattura o scontrino su carta", file: "Scegli un file", fileSub: "PDF o foto", under: "Archivia in", jobs: "Cantiere", company: "Impresa" },
    toast: {
      reading: "Leggo {{name}}", read: "{{name}} letto", failed: "Non sono riuscito a leggere il file. Prova una foto più chiara.", plan: "La lettura delle fatture è compresa in un piano superiore.", noAccess: "Il tuo ruolo non può caricare documenti.",
      offline: "Sei senza rete. Riprova quando torni online.", denied: "Consenti le foto nelle Impostazioni per caricare.", unavailable: "Le foto non sono disponibili su questo telefono.", saved: "Listino aggiornato", undone: "Rimesso com'era", priceFailed: "Non sono riuscito ad aggiornare il listino.",
    },
    loadFailed: { title: "Non riesco a caricare i documenti", body: "Controlla la connessione e riprova." },
    offline: { lead: "Sei senza rete.", body: "Vedi ciò che era stato letto l'ultima volta." },
    readOnly: { lead: "Sola lettura.", body: "Il tuo ruolo vede i documenti ma non può caricarli." },
  },
};
