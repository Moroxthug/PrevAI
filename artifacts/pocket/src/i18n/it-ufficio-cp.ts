// Italiano (it-IT) di «Scadenze» (Compliance.dc.html, QuoteAI 127.4, i18n/screens/compliance.ts). In QuoteAI sono le scadenze canadesi (GST/HST, PST,
// T5018, WSIB); in PrevAI sono quelle dello scadenzario di Fisco (F24 di imposta sostitutiva e contributi INPS, bollo, dichiarazione) più i promemoria
// che l'impresa scrive da sé. PrevAI non versa niente: «Versata» registra ciò che il titolare dichiara di aver pagato.
export const cp = {
  cp: {
    title: "Scadenze", back: "Indietro", more: "Altre azioni", close: "Chiudi", retry: "Riprova",
    h1: "Scadenze", sub: "{{company}} · regime forfettario", subPlain: "{{company}}",
    loadFailed: { title: "Non riesco a caricare le scadenze", body: "Controlla la connessione e riprova." },
    locked: { title: "Le scadenze fanno parte di PrevAI Fisco", body: "Il calendario fiscale viene con l'add-on PrevAI Fisco. Lo attivi da prevai.it." },
    banner: { lead: "Sola lettura.", body: "{{name}}, qui vedi le scadenze: le segna il titolare." },
    empty: { title: "Ancora niente in calendario", body: "Completa il profilo fiscale sul sito e le scadenze compaiono qui, con l'F24 pronto da scaricare. Intanto puoi aggiungere i tuoi promemoria.", settings: "Completa il profilo fiscale", building: "Salvo" },
    addReminder: "Aggiungi un promemoria",
    kpi: { late: "In ritardo", lateNone: "Niente in ritardo", next: "Prossimi 30 giorni", nextNone: "Niente in arrivo", filed: "Versate nel {{year}}", onTime: "Tutte in tempo", someOnTime: "{{count}} in tempo" },
    short: { imposta: "Imposta", contributi: "INPS", bollo: "Bollo", dichiarazione: "Dichiarazione" },
    hst: {
      sub: "{{who}} · entro il {{date}}", subFiled: "{{who}} · versato il {{date}}", net: "Da versare", paid: "Versato", lines: "Righe del modello", paidSoFar: "Già registrato", days: "Giorni alla scadenza",
      worksheet: "Scarica l'F24", loading: "Preparo il file", markFiled: "Segna come versata", undoFiled: "Annulla il versamento",
    },
    calendar: { title: "Prossimi 90 giorni", link: "Scorri e tocca", aria: "Le scadenze dei prossimi 90 giorni", mark: "{{title}}, {{date}}", today: "{{date}} · oggi", in_one: "{{date}} · domani", in_other: "{{date}} · tra {{count}} giorni", ago_one: "{{date}} · ieri", ago_other: "{{date}} · {{count}} giorni fa" },
    filter: "Filtro delle scadenze", filters: { all: "Tutte", due: "In arrivo", overdue: "In ritardo", filed: "Versate" },
    groups: { late: "In ritardo", next: "Prossimi 90 giorni", later: "Più avanti", filed: "Versate" },
    groupSub: { late: "Da sistemare subito", next: "Entro 90 giorni", filed: "Le ultime" },
    noMatch: { title: "Niente qui", body: "Nessuna scadenza corrisponde a questo filtro." },
    acts: { markFiled: "Segna come presentata", markPaid: "Segna come versata", markRenewed: "Segna come rinnovata", markDone: "Segna come fatta", undo: "Annulla", f24: "Scarica l'F24" },
    toast: {
      markFiled: "Segnata come presentata", markPaid: "Segnata come versata", markRenewed: "Segnata come rinnovata", markDone: "Segnata come fatta", renewedNext: "Rinnovata · prossima il {{date}}",
      undone: "Di nuovo da versare", failed: "Non sono riuscito a salvare. Riprova.", downloadFailed: "Non sono riuscito a scaricare il file.", reminder: "Promemoria aggiunto",
    },
    subs: {
      owe: "{{who}} · {{amount}}", paid: "Versata il {{date}}", filed: "Presentata il {{date}}", today: "Segnata oggi",
      repeats: { none: "Una tantum", monthly: "Ogni mese", quarterly: "Ogni 3 mesi", annual: "Ogni anno" },
    },
    words: { late_one: "{{count}} giorno di ritardo", late_other: "{{count}} giorni di ritardo", due: "Entro il {{date}}", renews: "Rinnovo il {{date}}", filed: "Presentata", paid: "Versata", filedToday: "Presentata oggi", paidToday: "Versata oggi", renewedToday: "Rinnovata oggi" },
    setup: {
      title: "Come versi", link: "Sul sito", regime: "Regime", forfettario: "Forfettario", other: "Altro regime", inps: "Gestione INPS", bollo: "Bollo sulle fatture", bolloValue: "Virtuale, ogni trimestre",
      gestione: { artigiani: "Artigiani", commercianti: "Commercianti", gestione_separata: "Gestione separata", cassa_professionale: "Cassa professionale", nessuna: "Nessuna" },
    },
    menu: { add: "Aggiungi un promemoria", addSub: "DURC, assicurazione, formazione…", settings: "Profilo fiscale", settingsSub: "Si modifica dal sito" },
    sheet: {
      title: "Nuovo promemoria", from: "Parti da un suggerimento", name: "Nome", namePh: "Es. Assicurazione RC", due: "Scade il", repeat: "Si ripete", save: "Aggiungi", saving: "Aggiungo", prev: "Mese precedente", next: "Mese successivo",
      kind: { insurance: "Assicurazione", licence: "Documento", safety: "Sicurezza", other: "Altro" },
      rec: { none: "No", monthly: "Ogni mese", quarterly: "Ogni 3 mesi", annual: "Ogni anno" },
    },
  },
};
