// Italiano (it-IT) di Invia un parere, Novità, Aiuto, Video e «Quando un pagamento non va a buon fine» (QuoteAI 128.6,
// i18n/screens/feedback.ts, whatsNew.ts, help.ts, video.ts, dunning.ts). Gli articoli dell'Aiuto sono quelli del centro
// assistenza del sito (src/content/helpArticles.ts); l'assistenza è supporto@prevai.it e la chat del sito (niente telefono).
export const aiuto = {
  fb: {
    title: "Invia un parere", close: "Chiudi", offline: { lead: "Sei offline.", body: "Lo teniamo su questo telefono e lo mandiamo quando torni in linea." },
    shotLabel: "Schermata con i tuoi segni", noShot: "Nessuna schermata", markUp: "Segna", undoMark: "Togli l'ultimo segno", addShot: "Aggiungi una schermata", removeShot: "Togli la schermata",
    hintOn: "Disegna con il dito. Tocca di nuovo Segna quando hai finito.", hint: "Cerchia quello che non va.", hintNoShot: "Aggiungi una schermata di quello che intendi.",
    kinds: ["Qualcosa non va", "Un'idea", "Una domanda"], kind: "Tipo di parere", noteLabel: "Cosa è successo?",
    placeholders: ["Cosa è successo, e cosa ti aspettavi?", "Cosa lo renderebbe più facile?", "Cosa stai cercando di fare?"],
    logs: { label: "Includi i dati tecnici", sub: "Versione dell'app, modello del telefono e la schermata dov'eri. Niente dati dei clienti." }, reply: { label: "Potete rispondermi per email" },
    from: "Da {{screen}} · {{version}}",
    send: "Invia", sending: "Invio…", saveLater: "Salva e invia dopo",
    done: { sent: "Grazie, inviato", saved: "Salvato, parte dopo", textReply: "Leggiamo ogni messaggio. Se ci serve altro scriviamo a {{email}}.", text: "Leggiamo ogni messaggio. Grazie per aiutarci a sistemarlo.", textSaved: "È su questo telefono e parte appena torni in linea.", ref: "Riferimento", shot: "Schermata", logs: "Dati tecnici", attached: "Allegati", none: "Nessuna", notIncluded: "Non inclusi", back: "Indietro", another: "Inviane un altro", waiting: "In attesa" },
    needNote: "Scrivi una nota o aggiungi una schermata.", noPhotos: "Consenti l'accesso alle foto nelle impostazioni del telefono per aggiungere una schermata.", failed: "Non sono riuscito a inviarlo. Riprova.", tooMany: "Tanti messaggi in quest'ora. Riprova più tardi.",
    screens: { default: "Preventivo" },
  },
  wn: {
    label: "Le novità della versione {{version}}", version: "Versione", title: "Novità", got: "Ho capito", all: "Tutte le note di versione", close: "Chiudi",
    demo: { tile: "Incassato", who: "Tommaso e Lena Rossi", number: "12.2026", amount: "2.340,00 €", late: "9 giorni di ritardo" },
    feats: [
      ["«Serve a te» in Oggi", "Fatture in ritardo, preventivi da firmare e domande della squadra, appena apri l'app."],
      ["Scorri per fare prima", "Scorri un preventivo o una fattura a sinistra per sollecitare, mandare un promemoria o segnarla pagata."],
      ["Scontrini dalla fotocamera", "Fotografa uno scontrino. Leggiamo il totale e l'IVA e lo mettiamo nel cantiere."],
      ["Guarda come si fa", "Brevi video con i sottotitoli nelle prime schermate e nell'Aiuto."],
    ],
  },
  hc: {
    back: "Indietro", title: "Aiuto", chatOnline: "Chat attiva", chatOffline: "Chat non attiva",
    offline: { lead: "Sei offline.", body: "Gli articoli funzionano anche offline. Video e chat hanno bisogno della connessione." },
    searchLabel: "Cerca nell'aiuto", searchPlaceholder: "Cerca nell'aiuto, per esempio acconto", clear: "Cancella la ricerca",
    results: "Risultati", found_one: "{{count}} trovato", found_other: "{{count}} trovati",
    none: { title: "Ancora niente su «{{q}}»", body: "Chiedi a noi e ti rispondiamo, di solito in pochi minuti.", action: "Chiedi all'assistenza" },
    popular: "I più letti", topics: "Argomenti", articles_one: "{{count}} articolo", articles_other: "{{count}} articoli", videos: "Video", videoCount: "{{count}} video brevi",
    topic: { start: "Primi passi", quotes: "Preventivi", contracts: "Contratti e firma elettronica", jobs: "Cantieri", money: "Fatture e pagamenti", team: "Squadra", growth: "Richieste e integrazioni" },
    video: {
      quotes: ["Il tuo primo preventivo", "Preventivi"], overview: ["PrevAI in 60 secondi", "Panoramica"], jobs: ["Avvia un cantiere da un preventivo", "Cantieri"], crew: ["Il primo giorno della squadra", "Squadra"], bonifico: ["Fatti pagare con un bonifico", "Fatture"], app: ["Collega le tue app", "Integrazioni"],
      watch: "Guarda {{title}}, {{dur}}", offline: "Offline",
    },
    talk: { title: "Parla con noi", chat: ["Scrivici in chat", "Di solito rispondiamo in 5 minuti", "Serve la connessione", "Attiva", "Non attiva"], email: ["Email", "supporto@prevai.it · rispondiamo entro un giorno"], call: ["Chiama", ""], problem: ["Segnala un problema", "Manda una schermata e una nota"], hours: "Rispondiamo dal lunedì al venerdì, 9–18." },
    article: { back: "Torna all'aiuto", read: "{{count}} min di lettura · Aggiornato il {{date}}", helpful: "Ti è stato utile?", yes: "Sì", no: "No", thanks: "Grazie per avercelo detto.", sorry: "Ci dispiace. Vuoi parlare con una persona?", chat: "Scrivi all'assistenza", missing: "Dicci cosa manca", related: "Da leggere anche", gone: "Questo articolo non c'è." },
    failed: "Non riesco ad aprirlo.",
  },
  vp: {
    close: "Chiudi il video", offline: "Questo video ha bisogno della connessione", offlineSub: "I passaggi nell'Aiuto funzionano offline.", retry: "Riprova", loading: "Carico", play: "Riproduci", pause: "Pausa", back10: "Indietro di 10 secondi", fwd10: "Avanti di 10 secondi",
    watchHow: "Guarda come si fa", offerOverview: "Guarda PrevAI in 60 secondi",
    position: "Posizione", captions: "Sottotitoli", speed: "Velocità {{speed}}", speedTitle: "Velocità", ccOn: "Italiano", ccOff: "No", chapters: "Capitoli", playing: "In riproduzione", paused: "In pausa", watched: "Visto", chapter: "Capitolo {{n}}: {{title}}",
    v: {
      quotes: {
        head: "Guarda come si fa", title: "Il tuo primo preventivo", topic: "Preventivi", sub: "Racconta il lavoro, scegli il cliente e manda un preventivo con le voci e l'IVA.", cta: "Provalo adesso",
        ch: [["Tocca Nuovo preventivo", "Dalla scheda Preventivi, tocca Nuovo preventivo."], ["Descrivi il lavoro", "Scrivilo o dettalo come lo diresti al cliente, poi scegli il cliente."], ["Controlla le voci", "Ogni voce ha quantità e prezzo: cambiali con un tocco."], ["Invialo", "Invia per email: il cliente lo apre e lo accetta dal telefono."]],
      },
      overview: {
        head: "PrevAI in 60 secondi", title: "PrevAI in 60 secondi", topic: "Panoramica", sub: "Oggi, preventivi, cantieri e fatture: l'app in meno di un minuto.", cta: "Comincia",
        ch: [["Oggi", "Ogni mattina: cosa serve a te, il meteo dei cantieri, i soldi."], ["Preventivi", "Scritti dall'IA, inviati per email, accettati dal cliente."], ["Cantieri", "Dal preventivo accettato al cantiere: squadra, foto, costi."], ["Fatture", "Chi ti deve dei soldi e cosa è già arrivato."]],
      },
      jobs: {
        head: "Guarda come si fa", title: "Avvia un cantiere da un preventivo", topic: "Cantieri", sub: "Dal preventivo accettato al cantiere, con le fasi, le date e la squadra.", cta: "Vai ai cantieri",
        ch: [["Apri il preventivo accettato", "Il cliente ha accettato: apri il preventivo."], ["Avvia il cantiere", "Tocca Avvia cantiere. PrevAI prepara le fasi dalle voci."], ["Controlla le fasi", "Date, fasi e pagamenti arrivano dal preventivo."], ["Tutto in un posto", "Squadra, foto, costi e fatture stanno nel cantiere."]],
      },
      crew: {
        head: "Guarda come si fa", title: "Il primo giorno della squadra", topic: "Squadra", sub: "Aggiungi un operaio, collega il suo telefono e guarda le ore arrivare.", cta: "Vai alla squadra",
        ch: [["Aggiungi un operaio", ""], ["Collega il telefono", ""], ["Le ore", ""], ["Approva", ""]],
      },
      bonifico: {
        head: "Guarda come si fa", title: "Fatti pagare con un bonifico", topic: "Fatture", sub: "Il cliente paga con il bonifico e lo segnala: tu controlli la banca e confermi.", cta: "Vai alle fatture",
        ch: [["Il cliente ha pagato", "Il cliente paga con l'IBAN della fattura e lo segnala dal link."], ["Controlla la banca", "Prima di confermare, guarda che il bonifico sia arrivato."], ["Conferma il bonifico", "Confermo che è arrivato: importo e metodo sono già compilati."], ["Pagata", "La fattura è pagata e il cliente riceve la ricevuta."]],
      },
      app: {
        head: "Guarda come si fa", title: "Collega le tue app", topic: "Integrazioni", sub: "Calendario, contabilità e le altre app che usi già.", cta: "Vai alle integrazioni",
        ch: [["Le tue app", ""], ["Collega", ""], ["Cosa passa", ""], ["Fatto", ""]],
      },
    },
  },
  du: {
    back: "Indietro", title: "Quando un pagamento non va a buon fine",
    intro: { owner: "Cosa vedete tu e la squadra, passo per passo. Puoi sistemarlo in qualsiasi momento su prevai.it.", member: "Cosa vedi quando il pagamento dell'impresa non va a buon fine. Lo può sistemare solo il titolare." },
    greeting: "Buongiorno, {{name}}",
    s1: {
      title: "Pagamento non riuscito", day: "Giorno 1", cap: "Un avviso in Oggi per chi vede la fatturazione.", mini: "Oggi con l'avviso del pagamento non riuscito", later: "Dopo", late: "9 giorni di ritardo", viewed: "Aperto",
      owner: { lead: "Il tuo pagamento non è andato a buon fine.", body: "Aggiorna la carta su prevai.it perché tutto continui a funzionare.", action: "Apri prevai.it" },
      member: { lead: "Il pagamento dell'impresa non è andato a buon fine.", body: "Il titolare lo può aggiornare su prevai.it.", action: "Scrivi al titolare" },
    },
    s2: {
      title: "Periodo di tolleranza", end: "Finisce dopo l'ultimo tentativo", cap: "Tutto continua a funzionare. Riproviamo la carta qualche volta.",
      owner: { lead: "Aggiorna presto il metodo di pagamento su prevai.it", body: "La carta è stata rifiutata. Per squadra e clienti non cambia niente mentre riproviamo." },
      member: { lead: "Il titolare deve aggiornare presto il metodo di pagamento", body: "Per te non cambia niente mentre riproviamo. Gli abbiamo scritto anche per email." }, meter: "Riproviamo la carta", from: "Giorno 1", to: "Ultimo tentativo",
    },
    s3: {
      title: "Piano finito", day: "Dopo l'ultimo tentativo", cap: "Non si perde niente. Clienti e squadra non restano bloccati.", lead: "Il tuo piano è finito.", owner: "Aggiorna il pagamento su prevai.it per far ripartire il piano.", member: "Chiedi al titolare di aggiornare il metodo di pagamento.",
      works: "Funziona ancora", paused: "In pausa finché il pagamento non è sistemato",
      w: ["Vedi ogni preventivo, cantiere e fattura", "I clienti possono pagare le fatture aperte", "Link degli operai, timbrature e foto", "Esporta i tuoi dati"], p: ["Le funzioni del piano di prima", "Gli accessi dei colleghi", "Assistente e promemoria automatici"],
    },
    s4: {
      title: "Passato a Free", day: "Subito", cap: "Solo preventivi. Tutto il resto si tiene.", lead: "Adesso sei su Free.", body: "Cantieri, fatture e squadra restano salvati. Il piano non si cambia dall'app.", link: "prevai.it",
      quotes: ["Preventivi", "Fino al limite di Free", "Disponibili"], jobs: ["Cantieri e fatture", "Solo da vedere ed esportare", "Salvati"], team: "Colleghi", teamPaused: "In pausa", teamOwner: "Gli accessi dei colleghi vanno in pausa", teamMember: "Il tuo accesso va in pausa finché non è sistemato",
    },
    s5: { title: "Pagamento sistemato", day: "Quando vuoi", cap: "Tutto torna normale in un minuto, da qualsiasi passo.", lead: "Pagamento aggiornato.", body: "È tutto tornato com'era." },
    foot: "Pagamenti e piani si gestiscono su prevai.it.",
  },
};
