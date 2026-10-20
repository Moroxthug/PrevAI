// Italiano (it-IT) di Ruoli, Personalizza la Home e Home per ruolo (QuoteAI 128.7, i18n/screens/jobRoles.ts). In PrevAI le
// Home per ruolo sono del piano Elite (in QuoteAI Business). I nove mestieri sono quelli di QuoteAI, con i nomi di un'impresa italiana.
export const ruoli = {
  jr: {
    back: "Indietro", close: "Chiudi", loadFailed: { title: "Non riesco a caricare i ruoli", body: "Controlla la connessione e riprova.", retry: "Riprova" },
    title: "Ruoli", sub_other: "Impostazioni · Squadra · {{count}} persone", sub_one: "Impostazioni · Squadra · {{count}} persona",
    readOnly: { lead: "Solo lettura.", body: "Il tuo ruolo vede i ruoli ma non li cambia. Chiedi al titolare." },
    locked: { lead: "Le Home per ruolo sono incluse in Elite.", body: "Con Pro tutti vedono la Home del titolare. Il piano non si cambia dall'app.", action: "Vedi i piani" },
    roles: "Ruoli", andMore: "{{names}} e altri {{count}}", defaults: "Di partenza per {{role}}",
    access: { owner: "Titolare", office: "Ufficio", viewer: "Solo lettura", foreman: "Capo cantiere", link: "Link" },
    accessSub: { owner: "Tutto, compresi piano e sicurezza", office: "Preventivi, cantieri, costi e fatture", viewer: "Solo lettura, più attestati e infortuni", foreman: "Cantieri e costi in cantiere, il resto in lettura", link: "Link personale, senza accesso" },
    accessLabel: "Accesso", homeOrder: "Home, in quest'ordine", tabsLabel: "Schede", edit: "Modifica",
    own: { label: "Lascia che ognuno cambi la sua Home", sub: "Può nascondere o riordinare, non aggiungere ciò che è bloccato" }, preview: { label: "Guarda questa Home", sub: "Vedi quello che vede {{name}}" },
    sensitive: { title: "Accessi delicati", person: "Persona", keys: { payRates: "Vedere le paghe", margins: "Vedere margini e costi", approveTime: "Approvare le ore", sendInvoices: "Inviare le fatture" },
      changed: "Cambiato · per {{role}} di partenza è {{state}}", isDefault: "Di partenza per {{role}}", on: "acceso", off: "spento", changedN: "{{count}} cambiati", foot: "Il titolare li ha sempre tutti e quattro. Ogni modifica resta registrata con chi l'ha fatta.", ownerFixed: "Il titolare ha sempre tutti gli interruttori." },
    role: {
      owner: "Titolare", officeManager: "Responsabile d'ufficio", estimator: "Preventivista", projectManager: "Responsabile di commessa", dispatcher: "Pianificatore", bookkeeper: "Contabile", safety: "Responsabile della sicurezza", foreman: "Capo cantiere", crew: "Operaio",
    },
    toast: { saved: "Salvato.", failed: "Non sono riuscito a salvare.", offline: "Sei offline. Riprova quando torni in linea.", noAccess: "I ruoli li cambia solo il titolare.", plan: "Le Home per ruolo sono incluse in Elite." },
    tab: { home: "Home", quotes: "Preventivi", leads: "Richieste", clients: "Clienti", jobs: "Cantieri", schedule: "Agenda", invoices: "Fatture", map: "Mappa", docs: "Documenti", books: "Prima nota", pay: "Ore e costo", team: "Team", hours: "Ore", photos: "Foto", travel: "Trasferte", empty: "Vuota" },
    sec: {
      needs: ["Serve a te", "Approvazioni e risposte"], money: ["Soldi", "Incassato e da incassare"], quotes: ["Preventivi da fare", "Bozze e richieste"], crew: ["Squadra", "Chi è dove"], today: ["Oggi", "Visite e consegne"], week: ["Questa settimana", "La settimana in breve"],
      visits: ["Sopralluoghi", "Oggi e domani"], win: ["Preventivi vinti", "Ultimi 4 mesi"], waiting: ["Aspettano i clienti", "Preventivi inviati e aperti"], weather: ["Meteo del cantiere", "Avvisi di pioggia e freddo"], leads: ["Nuove richieste", "Dal sito e dalle chiamate"],
      atRisk: ["A rischio", "Cantieri in ritardo o bloccati"], activeJobs: ["Cantieri in corso", "A che punto è ognuno"], budget: ["Budget e speso", "I costi rispetto al budget"], changeOrders: ["Varianti", "In attesa e firmate"],
      crewNow: ["Squadra adesso", "Chi condivide la posizione"], unassigned: ["Da assegnare", "Lavori senza una persona"], tomorrow: ["Domani", "Visite e consegne"],
      reconcile: ["Da abbinare", "Movimenti della banca"], receipts: ["Scontrini", "Ti aspettano"], hst: ["Prossimo F24", "Imposte e contributi"], comingUp: ["In arrivo", "Versamenti e scadenze"],
      certificates: ["Attestati in scadenza", "Scaduti e in scadenza"], incidents: ["Infortuni", "Giorni persi e mancati infortuni"], toolbox: ["Riunioni di sicurezza", "Firme"], inspections: ["Sopralluoghi di sicurezza", "Giri in cantiere"],
      clock: ["Timbratura", "Le tue ore"], blockers: ["Blocchi", "Cosa ferma il lavoro"], crewToday: ["Squadra oggi", "Chi è in cantiere"], tasks: ["Attività", "Cosa è aperto"], tasksToday: ["Attività di oggi", "Cosa c'è oggi"], reports: ["I tuoi rapporti", "Note e foto che hai mandato"],
    },
    home: {
      title: "La tua Home", lede: "{{name}} · {{role}}", saved: { lead: "Salvato.", body: "Home e schede sono aggiornate su questo telefono e sul sito." }, sections: "Sezioni", shown: "{{shown}} di {{total}} visibili", hidden: "Nascoste",
      reorder: "Riordina {{name}}", show: "Mostra {{name}}", up: "Sposta su", down: "Sposta giù", locked: { label: "Soldi e margini", sub: "Non fanno parte del tuo ruolo", tag: "Ufficio" },
      tabsTitle: "Schede", tabCount: "{{count}} di 4", navLabel: "Anteprima della barra", full: "Quattro schede al massimo. Togline una per aggiungerne un'altra.", notRole: "{{name}}, non fa parte del tuo ruolo",
      density: "Densità", densities: ["Comoda", "Compatta"], densityNote: ["Cifre più grandi. Stanno circa 3 sezioni in una schermata.", "Schede più piccole. Stanno circa 5 sezioni in una schermata."],
      reset: { label: "Torna a quelle di {{role}}", sub: "Decise dal titolare" }, roleDefaults: { label: "Di partenza per ruolo", sub: "Impostazioni · Squadra · Ruoli" }, save: "Salva", savedLabel: "Salvato", locked2: "Il titolare l'ha spento per il tuo ruolo.",
    },
    rh: {
      seeAll: "Vedi tutto", books: "Prima nota", schedule: "Agenda", quotes: "Preventivi", analytics: "Analisi", jobs: "Cantieri", activeN: "{{count}} in corso", all: "Tutti", map: "Mappa", compliance: "Scadenze", log: "Registro",
      nothing: "Ancora niente qui.", custom: "Personalizza la Home", customSub: "Schede: {{tabs}}", good: "Buongiorno, {{name}}", hidden: "Per il tuo ruolo le paghe sono nascoste.", noMargins: "Vedi i soldi ma non i margini. Chiedi al titolare di cambiarlo.",
      notBuilt: "Qui non si registra ancora niente.", openAction: "Apri",
    },
  },
};
