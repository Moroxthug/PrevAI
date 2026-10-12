// Italiano (it-IT) di «Ore e costo del lavoro» (Pay.dc.html, QuoteAI 127.2, i18n/screens/pay.ts). In QuoteAI è la preparazione della paga
// (Wagepoint, straordinari per provincia, festività, trasferte); in PrevAI le buste le fa il consulente del lavoro, quindi qui ci sono le ore
// approvate, il costo per l'impresa e il file di ore da mandargli. Niente è precompilato dal contratto: lo straordinario lo imposta il titolare.
export const pay = {
  py: {
    title: "Ore e costo", back: "Indietro", close: "Chiudi", more: "Altre azioni", retry: "Riprova", save: "Salva", saving: "Salvo", undo: "Annulla",
    sub: "Ore e costo del lavoro di {{company}}", subNone: "Ore e costo del lavoro",
    loadFailed: { title: "Non riesco a caricare il periodo", body: "Controlla la connessione e riprova." },
    locked: { title: "Il costo del lavoro lo vedono titolare e amministratore", body: "Tariffe e costi dei dipendenti non sono visibili agli altri ruoli." },
    tabsLabel: "Sezioni", tabs: { period: "Periodo", jobs: "Per cantiere", rules: "Regole ed esportazione" },
    period: {
      prev: "Periodo precedente", next: "Periodo successivo",
      freq: { weekly: "Ogni settimana", biweekly: "Ogni 2 settimane", monthly: "Ogni mese" },
      status: { exported: "Esportato il {{date}}", ready: "Pronto da esportare", progress: "In corso" },
    },
    export: {
      button: "Esporta le ore", again: "Esporta di nuovo", working: "Esporto", sheet: "Esporta",
      done: "File pronto: {{name}}", failed: "Non sono riuscito a fare il file. Riprova.",
      banner: "Ore esportate per il consulente", bannerBody_one: "· {{count}} dipendente, {{amount}}", bannerBody_other: "· {{count}} dipendenti, {{amount}}",
    },
    warn: {
      approve: { title_one: "{{count}} registrazione di ore da approvare", title_other: "{{count}} registrazioni di ore da approvare", sub: "{{names}} · {{hours}} h", subNoNames: "{{hours}} h in attesa", tag: "Da rivedere" },
      changed: { title_one: "{{count}} dipendente cambiato dopo l'esportazione", title_other: "{{count}} dipendenti cambiati dopo l'esportazione", sub: "{{names}} · dopo l'ultima esportazione", tag: "Cambiato" },
      payroll: { title_one: "Nessun codice dipendente per {{names}}", title_other: "{{count}} dipendenti senza codice del consulente", sub: "Il consulente lo usa per riconoscerli nel file", subGeneric: "Aggiungilo così il file li riconosce", tag: "Manca" },
      rate: { title_one: "Nessun costo orario per {{names}}", title_other: "{{count}} dipendenti senza costo orario", sub: "Le loro ore conterebbero zero", tag: "Manca" },
      clear: { title: "Non c'è niente da guardare", sub: "Le ore sono approvate e tutti sono pronti per il file", tag: "A posto" },
    },
    totals: {
      title: "Totali", link_one: "{{count}} dipendente", link_other: "{{count}} dipendenti",
      wages: "Retribuzioni", wagesSub: "Ore × costo orario", hours: "Ore", hoursSub: "{{hours}} di straordinario",
      burden: "Oneri dell'impresa", burdenSub: "{{pct}}% sulle retribuzioni", burdenNone: "Non calcolati",
      cost: "Costo del lavoro", costSub: "Retribuzioni e oneri",
    },
    employees: {
      title: "Dipendenti", link: "Squadra", emptyTitle: "Nessun dipendente in questo periodo", emptyBody: "Le ore compaiono qui quando sono approvate.",
      role: "{{role}} · {{rate}}/h", rate: "{{rate}}/h", flag: { noPayroll: "Manca il codice dipendente", noRate: "Manca il costo orario" },
      kind: { regular: "Ore ordinarie", overtime: "Straordinario" },
      qty: { hours: "{{hours}} h × {{rate}}" },
    },
    subs: { title: "Collaboratori esterni", link: "Non in busta", sub: "{{role}} · {{hours}} h", subHours: "{{hours}} h", bills: "In fattura" },
    jobs: {
      labour: "Costo del lavoro", hours: "Ore", overtime: "{{hours}} di straordinario", byJob: "Per cantiere", burden: "Oneri {{pct}}%", noJob: "Senza cantiere",
      cells: { hours: "Ore", overtime: "Straordinario", straight: "Retribuzione", premium: "Maggiorazione", burden: "Oneri", total: "Totale" },
      emptyTitle: "Ancora niente", emptyBody: "Le ore approvate compaiono qui, cantiere per cantiere.",
    },
    rules: {
      frequency: "Frequenza", freqNote: {
        weekly: "I periodi vanno dal lunedì alla domenica", biweekly: "Periodi di due settimane che partono di lunedì", monthly: "Un periodo al mese, dal primo all'ultimo giorno",
      },
      overtime: "Straordinario",
      otIntro: "PrevAI non conosce il tuo contratto: se paghi lo straordinario, dì dopo quante ore a settimana e con quale maggiorazione. Il consulente del lavoro ha l'ultima parola.",
      otRows: { starts: "Parte dopo", premium: "Maggiorazione" },
      starts: { weekly: "{{hours}} h a settimana", none: "Non impostato" },
      premium: { value: "+{{pct}}%", none: "Non serve" },
      saved: "Regole salvate", failed: "Non sono riuscito a salvare le regole. Riprova.", undone: "Com'era prima",
      exportTitle: "Esportazione",
      exportRows: {
        to: { label: "File per il consulente", sub: "CSV con ore e importi, ogni periodo" },
        numbers: { label: "Codici dipendente", sub: "{{have}} di {{total}} dipendenti", tag_one: "{{count}} manca", tag_other: "{{count}} mancano" },
      },
      edit: {
        starts: { title: "Quando parte lo straordinario", body: "Le ore oltre questa soglia, in una settimana (da lunedì a domenica), sono straordinario. Lascia vuoto se non lo paghi.", label: "Ore a settimana", suffix: "h" },
        premium: { title: "Maggiorazione dello straordinario", body: "Di quanto aumenta il costo orario sulle ore di straordinario.", label: "Maggiorazione", suffix: "%" },
        codes: { title: "Codici dipendente", body: "Il codice che il consulente del lavoro ha dato a ciascuno: finisce nel file." },
        invalid: "Scrivi un numero.",
      },
    },
    menu: { export: "Esporta le ore", exportSub: "Fai il file di questo periodo", team: "Squadra", teamSub: "Ore, operai e costi orari" },
  },
};
