// Italiano (it-IT) di Notifiche e Cerca (QuoteAI 128.2, i18n/screens/notifications.ts) e del livello dell'assistente
// aperto dall'orb (128.8, assistantChat.ts).
export const avvisi = {
  ai: {
    label: "Assistente", openKeyboard: "Scrivi invece", backToVoice: "Torna alla voce", close: "Chiudi l'assistente", mute: "Spegni il microfono", unmute: "Accendi il microfono",
    placeholder: "Chiedi quello che vuoi, o descrivi un lavoro", field: "Scrivi all'assistente", send: "Invia",
    tapToTalk: "Tocca il microfono e parla.", listening: "Ti ascolto. Tocca di nuovo per inviare.", talk: "Parla", stopSend: "Ferma e invia",
    micDenied: "Il microfono è spento per PrevAI. Accendilo nelle impostazioni del telefono, o tocca la tastiera per scrivere.", micFailed: "Non riesco a usare il microfono. Tocca la tastiera per scrivere.", empty: "Non ho capito. Riprova.",
    locked: "L'assistente è incluso in Elite. Prepara promemoria, ordini e cambi di agenda, e aspetta il tuo sì.", seePlan: "Vedi i piani",
    failed: "Adesso non riesco a rispondere. Riprova tra poco.", offline: "Sei offline. Riprova quando torni in linea.",
    proposals_one: "{{count}} cosa aspetta il tuo OK.", proposals_other: "{{count}} cose aspettano il tuo OK.", review: "Rivedi",
  },
  nt: {
    back: "Indietro", retry: "Riprova", close: "Chiudi", title: "Notifiche", markAll: "Segna tutte come lette", filterLabel: "Filtro", filter: { all: "Tutte", unread: "Da leggere" }, today: "Oggi", earlier: "Prima",
    unreadLabel: "Da leggere. {{title}}", action: { confirm: "Conferma", review: "Rivedi le ore", remind: "Manda un promemoria" },
    empty: { title: "Sei in pari", body: "Qui trovi i preventivi aperti dal cliente, i pagamenti e le novità della squadra.", action: "Vedi tutte" },
    loadFailed: { title: "Non riesco a caricare le notifiche", body: "Controlla la connessione e riprova." },
    ask: {
      label: "Attiva le notifiche", title: "Vuoi saperlo appena accettano?", body: "Ti avvisiamo quando un preventivo viene aperto, firmato o pagato. Il resto lo scegli nelle Impostazioni.", on: "Attiva le notifiche", later: "Non ora",
      app: "PrevAI", now: "ora", sampleTitle: "Dana Bianchi ha accettato il tuo preventivo", sampleBody: "Camere e soffitto del bagno ·",
      denied: "Le notifiche sono spente per PrevAI. Accendile nelle impostazioni del telefono.", unavailable: "Questo telefono non può ancora mostrare le notifiche dell'app.",
    },
    toast: { failed: "Non sono riuscito a segnarle come lette.", openFailed: "Non riesco ad aprirla." },
  },
  sr: {
    back: "Indietro", retry: "Riprova", placeholder: "Preventivi, clienti, cantieri, fatture", label: "Cerca in tutto", clear: "Cancella la ricerca", cancel: "Annulla", typeLabel: "Tipo",
    types: { all: "Tutto", quotes: "Preventivi", clients: "Clienti", jobs: "Cantieri", invoices: "Fatture", pages: "Pagine" },
    recentSearches: "Ricerche recenti", clearRecent: "Cancella", opened: "Aperti di recente", seeAll: "Vedi tutti",
    kind: { quotes: "Preventivo", clients: "Cliente", jobs: "Cantiere", invoices: "Fattura" },
    none: { title: "Niente corrisponde a «{{q}}»", body: "Prova con il nome di un cliente, un indirizzo o un numero come 118.2026.", action: "Cancella la ricerca" },
    loadFailed: { title: "Non riesco a caricare tutto per la ricerca", body: "Controlla la connessione e riprova." },
    partial: { lead: "Alcuni elenchi non si sono caricati.", body: "Potrebbero mancare dei risultati." },
    quoteSub: "{{number}} · {{job}}", jobSub: "{{client}} · {{detail}}", jobProgress: "{{pct}}", jobFinished: "finito il {{date}}", jobStarts: "inizia il {{date}}", jobWaiting: "aspetta il meteo",
    invoiceOverdue_one: "scaduta da {{count}} giorno", invoiceOverdue_other: "scaduta da {{count}} giorni",
    quoteState: { draft: "Bozza", sent: "Inviato", viewed: "Aperto", expiring: "In scadenza", accepted: "Accettato", declined: "Rifiutato", expired: "Scaduto" },
    jobState: { setup: "Da avviare", planning: "In programma", active: "In corso", hold: "In pausa", done: "Finito" },
    invState: { draft: "Bozza", sent: "Inviata", viewed: "Aperta", partially_paid: "Pagata in parte", pending_confirmation: "Da confermare", paid: "Pagata", void: "Annullata", overdue: "Scaduta" },
    pages: {
      settings: { t: "Impostazioni", s: "Aspetto, notifiche, voce" }, notifications: { t: "Notifiche", s: "{{count}} da leggere" }, notificationsNone: { t: "Notifiche", s: "Niente da leggere" },
      menu: { t: "Menu", s: "Profilo, impresa, piano" }, team: { t: "Team", s: "Chi entra nell'app e la squadra in cantiere" }, priceBook: { t: "Listino prezzi", s: "Le tue voci e tariffe" },
      compliance: { t: "Scadenze", s: "F24, INPS, DURC e assicurazioni" }, integrations: { t: "App collegate", s: "Google Calendar, Gmail, WhatsApp" }, home: { t: "Home", s: "Oggi, soldi e cantieri" },
    },
  },
};
