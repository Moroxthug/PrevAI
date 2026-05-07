export interface SectorData {
  slug: string;
  label: string;
  labelPlural: string;
  titleTag: string;
  titleVariants: string[];
  metaDescription: string;
  descriptionVariants: string[];
  h1: string;
  h1Highlight: string;
  intro: string;
  h2Benefits: string;
  benefits: { title: string; desc: string }[];
  h2HowItWorks: string;
  howItWorks: { step: string; desc: string }[];
  h2UseCases: string;
  useCases: string[];
  h2Faq: string;
  faq: { q: string; a: string }[];
  jsonLdDescription: string;
}

export const SECTORS: Record<string, SectorData> = {
  imbianchino: {
    slug: "imbianchino",
    label: "Imbianchino",
    labelPlural: "imbianchini",
    titleTag: "Preventivo Imbianchino Online | prevai – AI in 30s",
    titleVariants: [
      "Preventivo Imbianchino Online | prevai – AI in 30s",
      "Software Preventivi per Imbianchini | prevai",
      "Crea Preventivi Imbianchino Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per lavori di tinteggiatura e imbiancatura in 30 secondi con l'AI. Software di preventivazione digitale per imbianchini italiani. Gratis.",
    descriptionVariants: [
      "Crea preventivi per lavori di tinteggiatura e imbiancatura in 30 secondi con l'AI. Software di preventivazione digitale per imbianchini italiani. Gratis.",
      "Software preventivi AI per imbianchini: tinteggiatura, rasatura, pittura. Genera offerte professionali in 30 secondi.",
      "Preventivi per imbianchini in 30 secondi con l'AI. Calcolo mq automatico, IVA inclusa, PDF professionale. Prova gratis.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Imbianchini",
    intro: "Smetti di perdere serate a fare preventivi su Excel o carta. Con prevai descrivi i lavori di tinteggiatura a parole tue — rasatura, due mani di pittura lavabile, rifinitura soffitti — e il motore AI genera un preventivo professionale con descrizioni tecniche, quantità in mq, prezzi unitari e IVA calcolata in automatico. In 30 secondi, dal tuo smartphone.",
    h2Benefits: "Perché gli imbianchini scelgono prevai",
    benefits: [
      { title: "Preventivo dal cantiere", desc: "Apri prevai dallo smartphone mentre sei ancora dal cliente. Descrivi i lavori in dialogo naturale e ottieni un documento pronto in un minuto." },
      { title: "Calcolo mq automatico", desc: "L'AI stima le superfici, i litri di vernice e le ore di lavoro in base alla descrizione. Niente più calcoli manuali sbagliati." },
      { title: "Documento professionale", desc: "Il preventivo include intestazione aziendale, voce per voce con U.M., prezzi unitari, subtotali e IVA. Trasmette fiducia al cliente." },
      { title: "Archivio digitale", desc: "Tutti i tuoi preventivi salvati e accessibili da qualsiasi dispositivo. Trova subito il documento del cliente senza cercare tra le carte." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi il lavoro", desc: "Scrivi in italiano semplice: 'Tinteggiatura appartamento 90mq, due mani pittura lavabile bianca, rasatura parete bagno'." },
      { step: "2. L'AI genera il preventivo", desc: "prevai analizza il testo, identifica le voci di costo, stima le quantità e calcola i totali con IVA 22%." },
      { step: "3. Scarica e invia", desc: "Personalizza, aggiungi il logo aziendale e scarica il PDF. Invialo al cliente via WhatsApp o email." },
    ],
    h2UseCases: "Casi d'uso frequenti per imbianchini",
    useCases: [
      "Tinteggiatura appartamenti con pittura lavabile",
      "Imbiancatura locali commerciali e uffici",
      "Rasatura e ripristino pareti con crepe",
      "Verniciatura serramenti e infissi in legno",
      "Stucco veneziano e finiture decorative",
      "Rifacimento facciate esterne con pittura traspirante",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Quanto costa il software di preventivazione per imbianchini?", a: "prevai offre un piano Starter da 29€/mese con 20 preventivi inclusi. Puoi anche acquistare preventivi singoli da 29€ ciascuno senza abbonamento." },
      { q: "Posso usarlo dallo smartphone in cantiere?", a: "Sì. prevai è completamente responsive e funziona da qualsiasi smartphone o tablet con connessione internet, senza installare nulla." },
      { q: "Il preventivo include i prezzi di mercato per l'imbianchino?", a: "L'AI suggerisce prezzi tipici di mercato italiano che puoi modificare liberamente. Puoi impostare i tuoi listini nelle impostazioni." },
    ],
    jsonLdDescription: "Software di preventivazione AI per imbianchini italiani. Genera preventivi professionali per tinteggiatura e imbiancatura in 30 secondi.",
  },

  elettricista: {
    slug: "elettricista",
    label: "Elettricista",
    labelPlural: "elettricisti",
    titleTag: "Preventivo Elettricista Online | prevai – AI in 30s",
    titleVariants: [
      "Preventivo Elettricista Online | prevai – AI in 30s",
      "Software Preventivi per Elettricisti | prevai",
      "Crea Preventivi Elettricista Professionali – prevai AI",
    ],
    metaDescription: "Software preventivi per elettricisti: crea offerte per impianti elettrici, quadri, cablaggio in 30 secondi. AI pensata per elettricisti italiani. Gratis.",
    descriptionVariants: [
      "Software preventivi per elettricisti: crea offerte per impianti elettrici, quadri, cablaggio in 30 secondi. AI pensata per elettricisti italiani. Gratis.",
      "Preventivi per elettricisti in 30 secondi. L'AI conosce cavi FG16OR16, differenziali, interruttori magnetotermici, punti luce e prese.",
      "Software preventivi AI per elettricisti: impianti civili e industriali. Computo metrico professionale in 30 secondi. Prova gratis.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Elettricisti",
    intro: "Ogni lavoro elettrico richiede un preventivo dettagliato: impianto, quadro elettrico, punti luce, prese, cablaggio dati. prevai capisce la terminologia tecnica degli elettricisti e genera un documento professionale con computo metrico, unità di misura e prezzi. Dal piccolo intervento domestico all'impianto industriale, in 30 secondi.",
    h2Benefits: "Perché gli elettricisti scelgono prevai",
    benefits: [
      { title: "Terminologia tecnica integrata", desc: "L'AI conosce cavi FG16OR16, quadri elettrici, differenziali, interruttori magnetotermici, punti luce e prese. Niente traduzione: scrivi come parli." },
      { title: "Computo metrico professionale", desc: "Il preventivo include metri di cavo, numero di punti luce, ore di manodopera e materiali. Un documento che ogni tecnico e committente capisce." },
      { title: "Più preventivi, più lavori vinti", desc: "Chi risponde prima vince il lavoro. Con prevai mandi il preventivo mentre sei ancora dal cliente. Aumenti il tasso di conversione." },
      { title: "Storico clienti e lavori", desc: "Archivia tutti i preventivi per cliente. Hai subito a disposizione lo storico dei lavori per ogni committente." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi l'impianto", desc: "Scrivi: 'Rifacimento impianto elettrico appartamento 80mq, quadro 18 moduli, 15 punti luce, 10 prese, cablaggio dati 4 prese RJ45'." },
      { step: "2. L'AI struttura il preventivo", desc: "prevai genera le voci di costo con quantità, prezzi unitari per materiali e manodopera, subtotali e IVA 22%." },
      { step: "3. PDF pronto in un clic", desc: "Aggiungi il tuo logo, verifica i prezzi e scarica il PDF. Invialo al cliente in meno di 2 minuti dall'ispezione." },
    ],
    h2UseCases: "Lavori tipici per elettricisti",
    useCases: [
      "Rifacimento impianto elettrico civile",
      "Installazione quadro elettrico e differenziali",
      "Impianti fotovoltaici e colonnine EV",
      "Cablaggio dati e impianti domotici",
      "Impianti industriali e capannoni",
      "Messa a norma impianti vecchi",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso inserire i miei prezzi per materiali e manodopera?", a: "Sì, puoi modificare ogni voce del preventivo prima di salvarlo. prevai suggerisce i prezzi ma sei sempre tu a decidere il valore finale." },
      { q: "Il preventivo è conforme alla normativa italiana?", a: "prevai genera documenti con la struttura professionale standard usata in Italia, incluse le condizioni di pagamento e i riferimenti IVA." },
      { q: "Funziona anche per preventivi di grandi impianti industriali?", a: "Sì, prevai supporta preventivi multi-capitolo ideali per impianti complessi con molte voci." },
    ],
    jsonLdDescription: "Software di preventivazione AI per elettricisti italiani.",
  },

  idraulico: {
    slug: "idraulico",
    label: "Idraulico",
    labelPlural: "idraulici",
    titleTag: "Preventivo Idraulico Online | prevai – AI in 30s",
    titleVariants: [
      "Preventivo Idraulico Online | prevai – AI in 30s",
      "Software Preventivi per Idraulici | prevai",
      "Crea Preventivi Idraulico Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per impianti idraulici e termici in 30 secondi. Software AI per idraulici italiani. Niente Excel. Gratis.",
    descriptionVariants: [
      "Crea preventivi per impianti idraulici e termici in 30 secondi. Software AI per idraulici italiani. Niente Excel. Gratis.",
      "Software preventivi AI per idraulici: impianti idrici, caldaie, sanitari. Genera offerte professionali in 30 secondi.",
      "Preventivi per idraulici in 30 secondi con l'AI. Impianti termici, sanitari e riparazioni: documenti professionali in un clic.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Idraulici",
    intro: "Impianti idrici, termici, sanitari: ogni lavoro idraulico ha voci di costo specifiche difficili da comunicare al cliente. prevai capisce la terminologia tecnica — raccordi, tubazioni, collettori, caldaia, termostato — e genera un preventivo chiaro e professionale in 30 secondi.",
    h2Benefits: "Perché gli idraulici scelgono prevai",
    benefits: [
      { title: "Dal guasto al preventivo in 60 secondi", desc: "Sei ancora a casa del cliente quando il guasto è risolto? Genera subito il preventivo per il prossimo lavoro." },
      { title: "Prezzi per impianti e materiali", desc: "L'AI suggerisce prezzi tipici per tubi in rame, raccordi, valvole, caldaie a condensazione e lavori sanitari nel mercato italiano." },
      { title: "Preventivi multi-voce chiari", desc: "Ogni intervento diviso in voci: manodopera, materiali, smaltimento. Il cliente vede la trasparenza e si fida." },
      { title: "Risposta rapida", desc: "Invia il PDF via WhatsApp o email. Il cliente può approvarlo direttamente dal telefono prima dell'intervento." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi il lavoro idraulico", desc: "Scrivi: 'Installazione impianto termico appartamento con caldaia a condensazione 24kW, 8 radiatori, valvole termostatiche, collettore, collaudo'." },
      { step: "2. L'AI calcola le voci", desc: "prevai genera le voci per l'impianto idrico con materiali, ore di manodopera e smaltimento. Tutto strutturato in un documento professionale." },
      { step: "3. PDF inviato in 2 minuti", desc: "Scarica il PDF e invialo al cliente via WhatsApp ancora dall'appartamento. Il cliente lo approva prima che tu sia in macchina." },
    ],
    h2UseCases: "Lavori tipici per idraulici",
    useCases: [
      "Sostituzione caldaia a condensazione",
      "Rifacimento impianto idrico appartamento",
      "Installazione impianti radianti a pavimento",
      "Interventi su scarichi e fognature",
      "Manutenzione impianti termici",
      "Installazione sanitari e rubinetteria",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso fare un preventivo per urgenze anche dal telefono?", a: "Sì. prevai è ottimizzato per mobile. In 30 secondi hai un preventivo professionale anche in emergenza." },
      { q: "Come gestisco i preventivi non accettati?", a: "prevai archivia tutti i preventivi con stato. Puoi ricontattare i clienti che non hanno ancora risposto." },
      { q: "Funziona per piccole riparazioni e per grandi impianti?", a: "Sì, sia per piccoli interventi (sostituzione rubinetto) che per impianti complessi multi-capitolo." },
    ],
    jsonLdDescription: "Software di preventivazione AI per idraulici italiani.",
  },

  edilizia: {
    slug: "edilizia",
    label: "Impresa Edile",
    labelPlural: "imprese edili",
    titleTag: "Preventivi per Imprese Edili | prevai – AI in 30s",
    titleVariants: [
      "Preventivi per Imprese Edili | prevai – AI in 30s",
      "Software Preventivi per Imprese Edili | prevai",
      "Computo Metrico AI per Imprese Edili – prevai",
    ],
    metaDescription: "Software preventivi per imprese edili: muratura, fondazioni, finiture. Computo metrico AI in 30 secondi. Per PMI italiane.",
    descriptionVariants: [
      "Software preventivi per imprese edili: muratura, fondazioni, finiture. Computo metrico AI in 30 secondi. Per PMI italiane.",
      "Preventivi per imprese edili in 30 secondi. L'AI genera computi metrici professionali per cantieri di qualsiasi dimensione.",
      "Computo metrico AI per imprese edili: muratura, fondazioni, intonaci. Documenti professionali in 30 secondi. Prova gratis.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Imprese Edili",
    intro: "Un'impresa edile gestisce cantieri con decine di voci di costo: muratura, fondazioni, solai, intonaci, finiture. Creare un computo metrico corretto richiede ore. Con prevai descrivi il cantiere in linguaggio naturale e l'AI genera un preventivo strutturato con capitoli, voci, quantità e prezzi.",
    h2Benefits: "Perché le imprese edili scelgono prevai",
    benefits: [
      { title: "Computo metrico multi-capitolo", desc: "Preventivi organizzati in capitoli con Quadro Sintetico e Computo Dettagliato. Standard professionale cantieristico." },
      { title: "Logo aziendale e intestazione", desc: "Ogni preventivo riporta il tuo logo, partita IVA, indirizzo e contatti. Il documento rispecchia l'identità della tua impresa." },
      { title: "Riduzione tempi amministrativi", desc: "Meno tempo su scartoffie, più tempo in cantiere. prevai taglia del 90% il tempo speso nella preparazione dei preventivi." },
      { title: "Gestione clienti PMI", desc: "Dashboard con tutti i preventivi, stato avanzamento e storico clienti. Un sistema gestionale leggero per la tua impresa." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi il cantiere", desc: "Scrivi: 'Costruzione villetta unifamiliare 200mq: fondazione, solaio latero-cemento, muratura esterna in laterizio, intonaco civile, impianti'." },
      { step: "2. L'AI genera il computo metrico", desc: "prevai struttura il preventivo in capitoli per tipologia di lavoro. Ogni capitolo ha voci con quantità, prezzi unitari e importi." },
      { step: "3. Preventivo pronto per il committente", desc: "PDF con Quadro Sintetico e Computo Dettagliato. Professionale quanto quello di uno studio di ingegneria." },
    ],
    h2UseCases: "Lavori tipici per imprese edili",
    useCases: [
      "Costruzione ville e abitazioni unifamiliari",
      "Ristrutturazione edifici residenziali e commerciali",
      "Opere di muratura e strutture in c.a.",
      "Intonacatura e finiture interne ed esterne",
      "Consolidamento e risanamento strutturale",
      "Demolizioni e smaltimento macerie",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "prevai è adatto per imprese edili con più dipendenti?", a: "Sì, il piano Pro (79€/mese) offre preventivi illimitati per tutte le commesse dell'impresa." },
      { q: "Posso allegare planimetrie o file al preventivo?", a: "Il PDF generato contiene il computo metrico completo. Per allegare planimetrie puoi unirlo con qualsiasi PDF editor." },
      { q: "I prezzi suggeriti sono aggiornati al mercato italiano?", a: "L'AI si basa su prezzi tipici del mercato edile italiano. Puoi sempre modificare ogni voce." },
    ],
    jsonLdDescription: "Software di preventivazione AI per imprese edili italiane.",
  },

  ristrutturazione: {
    slug: "ristrutturazione",
    label: "Ristrutturazione",
    labelPlural: "ristrutturatori",
    titleTag: "Preventivo Ristrutturazione Casa | prevai – AI",
    titleVariants: [
      "Preventivo Ristrutturazione Casa | prevai – AI",
      "Software Preventivi Ristrutturazione | prevai",
      "Crea Preventivi Ristrutturazione Professionali – prevai AI",
    ],
    metaDescription: "Preventivi per ristrutturazioni complete in 30 secondi. AI per geometri, imprese e artigiani del settore ristrutturazione in Italia.",
    descriptionVariants: [
      "Preventivi per ristrutturazioni complete in 30 secondi. AI per geometri, imprese e artigiani del settore ristrutturazione in Italia.",
      "Software preventivi ristrutturazione: genera computi metrici multi-capitolo in 30 secondi. Per imprese e artigiani italiani.",
      "Preventivi professionali per ristrutturazioni in 30 secondi. L'AI gestisce demolizioni, impianti, finiture e bonus edilizi.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Ristrutturazioni",
    intro: "Una ristrutturazione coinvolge più categorie di lavori: demolizioni, muratura, impianti, finiture, serramenti. Coordinare tutto in un unico preventivo è complesso. prevai aggrega tutte le voci in un documento multi-capitolo strutturato, con Quadro Sintetico e Computo Dettagliato.",
    h2Benefits: "Perché i ristrutturatori scelgono prevai",
    benefits: [
      { title: "Preventivo multi-categoria", desc: "Un solo documento per tutti i lavori: demolizioni, impianti elettrici, idraulici, pavimenti, tinteggiatura. Tutto organizzato in capitoli." },
      { title: "Bonus edilizi e detrazioni", desc: "Menziona nel testo se il lavoro rientra in Superbonus o Bonus Ristrutturazioni e l'AI include le note fiscali nel documento." },
      { title: "Trasparenza verso il cliente", desc: "Il cliente vede ogni voce di costo. La trasparenza riduce le contestazioni e accelera la firma del contratto." },
      { title: "Aggiornamento preventivi", desc: "Se il committente chiede varianti, modifica il preventivo in pochi secondi e invia il documento aggiornato." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi la ristrutturazione", desc: "Scrivi: 'Ristrutturazione appartamento 90mq: demolizione tramezzi, rifacimento impianto idrico e elettrico, nuovi pavimenti in gres, tinteggiatura'." },
      { step: "2. L'AI genera il preventivo multi-capitolo", desc: "prevai organizza automaticamente le voci in capitoli: demolizioni, impianti, pavimenti, finiture. Struttura professionale in 30 secondi." },
      { step: "3. PDF pronto da presentare", desc: "Il documento include Quadro Sintetico e Computo Dettagliato. Il cliente lo firma e i lavori partono senza malintesi." },
    ],
    h2UseCases: "Lavori tipici di ristrutturazione",
    useCases: [
      "Ristrutturazione completa appartamenti e ville",
      "Rifacimento bagni con ceramiche e sanitari",
      "Sostituzione pavimenti e rivestimenti",
      "Cambio infissi e serramenti esterni",
      "Interventi per Bonus Ristrutturazioni e Superbonus",
      "Ristrutturazione uffici e spazi commerciali",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso includere le detrazioni fiscali nel preventivo?", a: "Sì. Menziona nel testo il tipo di bonus (es. Bonus Ristrutturazioni 50%) e prevai includerà una nota esplicativa nel documento." },
      { q: "Il preventivo è valido come documento contrattuale?", a: "Il preventivo prevai è un documento commerciale professionale. Per avere valore contrattuale è sufficiente farlo firmare dal committente." },
      { q: "Posso creare preventivi separati per ogni categoria di lavoro?", a: "Sì, puoi scegliere se creare un preventivo unico multi-capitolo o preventivi separati per ogni categoria di lavorazione." },
    ],
    jsonLdDescription: "Software di preventivazione AI per ristrutturazioni in Italia.",
  },

  carpentiere: {
    slug: "carpentiere",
    label: "Carpentiere",
    labelPlural: "carpentieri",
    titleTag: "Preventivo Carpentiere e Fabbro | prevai – AI",
    titleVariants: [
      "Preventivo Carpentiere e Fabbro | prevai – AI",
      "Software Preventivi per Carpentieri | prevai",
      "Crea Preventivi Carpenteria Professionali – prevai AI",
    ],
    metaDescription: "Preventivi per carpenteria metallica e falegnameria in 30 secondi. Software AI per carpentieri e fabbri italiani. Gratis.",
    descriptionVariants: [
      "Preventivi per carpenteria metallica e falegnameria in 30 secondi. Software AI per carpentieri e fabbri italiani. Gratis.",
      "Software preventivi AI per carpentieri: cancelli, strutture metalliche, scale. Calcolo materiali automatico in 30 secondi.",
      "Preventivi professionali per carpentieri e fabbri in 30 secondi. L'AI calcola kg di ferro, ore di saldatura e prezzi.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Carpentieri",
    intro: "Cancelli, recinzioni, strutture metalliche, pensiline, scale: ogni lavoro di carpenteria ha misure precise e materiali specifici. prevai calcola i kg di ferro, i metri lineari di profilato e le ore di saldatura partendo da una semplice descrizione testuale.",
    h2Benefits: "Perché i carpentieri scelgono prevai",
    benefits: [
      { title: "Calcolo materiali automatico", desc: "Descrivi la struttura e l'AI stima kg di ferro, lamiera, profilati e viti. Preventivo più accurato, meno sprechi." },
      { title: "Voci separate: materiali e manodopera", desc: "Il documento distingue chiaramente il costo dei materiali dalle ore di lavorazione. Trasparenza totale verso il cliente." },
      { title: "Professionalità immediata", desc: "Un preventivo ordinato e firmato vale più di uno scritto a mano. Aumenta la percezione di qualità del tuo lavoro." },
      { title: "Velocità di risposta", desc: "Manda il preventivo prima della concorrenza. Chi arriva primo spesso vince il lavoro." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi la struttura metallica", desc: "Scrivi: 'Cancello scorrevole in ferro tubolare 3mx2m con motorizzazione, recinzione metallica 30ml h.1.5m con pali interrati ogni 2m'." },
      { step: "2. L'AI calcola materiali e manodopera", desc: "prevai stima i kg di ferro, le ore di saldatura e i costi di verniciatura. Genera le voci con prezzi unitari e quantità." },
      { step: "3. Documento professionale in 60 secondi", desc: "PDF con intestazione aziendale e logo. Il cliente riceve un documento professionale che giustifica il prezzo richiesto." },
    ],
    h2UseCases: "Lavori tipici per carpentieri",
    useCases: [
      "Cancelli e recinzioni in ferro e acciaio",
      "Strutture metalliche e capriati",
      "Pensiline e tettoie in ferro",
      "Scale interne ed esterne in ferro",
      "Balconi e ringhiere in acciaio inox",
      "Soppalchi e strutture industriali",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso usarlo anche per piccoli lavori di fabbro?", a: "Assolutamente. prevai funziona sia per piccoli interventi (serratura, cancelletto) che per grandi strutture metalliche." },
      { q: "Come inserisco i prezzi del ferro che variano ogni mese?", a: "Ogni voce è modificabile prima di salvare il preventivo. Aggiorna il prezzo del materiale in base alle quotazioni del momento." },
      { q: "Posso salvare un preventivo tipo da riutilizzare?", a: "Sì. Puoi copiare un preventivo precedente e modificarlo per un nuovo cliente, risparmiando ulteriore tempo." },
    ],
    jsonLdDescription: "Software di preventivazione AI per carpentieri e fabbri italiani.",
  },

  falegname: {
    slug: "falegname",
    label: "Falegname",
    labelPlural: "falegnami",
    titleTag: "Preventivo Falegname e Mobilificio | prevai – AI",
    titleVariants: [
      "Preventivo Falegname e Mobilificio | prevai – AI",
      "Software Preventivi per Falegnami | prevai",
      "Crea Preventivi Falegnameria Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per falegnameria, mobili su misura e serramenti in 30 secondi. Software AI per falegnami italiani. Gratis.",
    descriptionVariants: [
      "Crea preventivi per falegnameria, mobili su misura e serramenti in 30 secondi. Software AI per falegnami italiani. Gratis.",
      "Software preventivi AI per falegnami: armadi su misura, cucine, serramenti. Genera offerte professionali in 30 secondi.",
      "Preventivi professionali per falegnami in 30 secondi. L'AI conosce essenze, finiture e specifiche tecniche del legno.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Falegnami",
    intro: "Armadi su misura, cucine, serramenti, pavimenti in legno: il preventivo di un falegname deve spiegare materiali, essenze, finiture e ore di lavorazione. prevai capisce la terminologia del legno — rovere, abete, essenza laccata, bordo ABS — e genera un documento professionale in 30 secondi.",
    h2Benefits: "Perché i falegnami scelgono prevai",
    benefits: [
      { title: "Terminologia del legno integrata", desc: "L'AI riconosce essenze, finiture, spessori e sistemi di montaggio. Scrivi come parli con i tuoi fornitori." },
      { title: "Voci per materiale e lavorazione", desc: "Pannelli, bordi, cerniere, binari cassetti, ore di falegnameria: ogni voce separata per massima chiarezza." },
      { title: "Immagine professionale", desc: "Un preventivo ben strutturato vale più di mille parole. Il cliente percepisce qualità ancor prima di vedere il lavoro finito." },
      { title: "Meno tempo in ufficio, più in officina", desc: "Riduzione drastica dei tempi amministrativi. Ogni ora risparmiata sul preventivo è un'ora in più di produzione." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi l'arredo su misura", desc: "Scrivi: 'Cabina armadio su misura 3mx2.4m in legno di rovere con 4 ante scorrevoli in vetro acidato, cassettiera interna, specchio e illuminazione led'." },
      { step: "2. L'AI calcola materiali e lavorazione", desc: "prevai genera le voci per pannelli, bordi, cerniere, binari e ore di falegnameria. Tutto calcolato con la terminologia del settore." },
      { step: "3. PDF professionale con logo", desc: "Il documento include le caratteristiche del prodotto finito. Il cliente capisce cosa acquista e firma il preventivo con fiducia." },
    ],
    h2UseCases: "Lavori tipici per falegnami",
    useCases: [
      "Armadi e cabine armadio su misura",
      "Cucine in legno massello e laminato",
      "Serramenti in legno e legno-alluminio",
      "Pavimenti in parquet e listoni di legno",
      "Porte interne su misura",
      "Arredamento bagno e librerie su misura",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso inserire le essenze di legno e le finiture nel preventivo?", a: "Sì. Includi nella descrizione i dettagli (rovere sbiancato, laccato opaco, melaminico) e l'AI li riporterà fedelmente nel documento." },
      { q: "Come gestisco i preventivi con molte varianti?", a: "Puoi creare preventivi separati per ogni variante o opzione, così il cliente sceglie la versione che preferisce." },
      { q: "Il preventivo include le condizioni di pagamento?", a: "Sì, prevai permette di aggiungere le condizioni di pagamento (acconto, saldo a consegna, rate) nel documento finale." },
    ],
    jsonLdDescription: "Software di preventivazione AI per falegnami italiani.",
  },

  termoidraulico: {
    slug: "termoidraulico",
    label: "Termoidraulico",
    labelPlural: "termoidraulici",
    titleTag: "Preventivo Termoidraulico Online | prevai – AI",
    titleVariants: [
      "Preventivo Termoidraulico Online | prevai – AI",
      "Software Preventivi per Termoidraulici | prevai",
      "Crea Preventivi Termoidraulici Professionali – prevai AI",
    ],
    metaDescription: "Software preventivi per termoidraulici: caldaie, climatizzatori, pavimento radiante. AI in 30 secondi. Per professionisti italiani.",
    descriptionVariants: [
      "Software preventivi per termoidraulici: caldaie, climatizzatori, pavimento radiante. AI in 30 secondi. Per professionisti italiani.",
      "Preventivi per impianti termoidraulici in 30 secondi. L'AI calcola caldaie, radiatori, pompe di calore e IVA agevolata.",
      "Software preventivi AI per termoidraulici: impianti termici, idraulici e di raffrescamento. Documenti professionali in 30 secondi.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Termoidraulici",
    intro: "L'installazione di un impianto di riscaldamento o raffrescamento richiede un preventivo dettagliato: caldaia, collettori, tubazioni, radiatori o pannelli radianti, valvole termostatiche, collaudo. prevai gestisce tutta la complessità termotecnica e genera un documento professionale in 30 secondi.",
    h2Benefits: "Perché i termoidraulici scelgono prevai",
    benefits: [
      { title: "Impianti complessi semplificati", desc: "Caldaia a condensazione, impianto radiante, split e VMC: ogni sistema ha le sue voci. prevai le organizza automaticamente." },
      { title: "Prezzi aggiornati al mercato", desc: "L'AI suggerisce prezzi tipici per caldaie, pompe di calore e impianti radianti nel mercato italiano. Modificabili in un clic." },
      { title: "Documentazione per detrazioni fiscali", desc: "I clienti spesso chiedono il preventivo per la pratica Ecobonus o Conto Termico. Il documento prevai è adatto allo scopo." },
      { title: "Risposta rapida, più lavori", desc: "Chi manda il preventivo per primo ha un vantaggio competitivo enorme. Con prevai lo mandi in 2 minuti dall'ispezione." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi l'impianto termico", desc: "Scrivi: 'Installazione pompa di calore aria-acqua 12kW con impianto di riscaldamento a pavimento in appartamento 100mq, 4 zone termostatiche'." },
      { step: "2. L'AI genera le voci dell'impianto", desc: "prevai calcola le voci per unità esterna, collettori, tubazioni, controlli e manodopera. Include le note per la pratica Ecobonus." },
      { step: "3. Preventivo in 2 minuti", desc: "PDF pronto per il cliente e per la pratica fiscale. Il documento separa fornitura e posa come richiesto dalle detrazioni." },
    ],
    h2UseCases: "Lavori tipici per termoidraulici",
    useCases: [
      "Installazione caldaie a condensazione e pompe di calore",
      "Impianti di riscaldamento a pavimento radiante",
      "Climatizzatori e impianti di raffrescamento",
      "Sostituzione radiatori e corpi scaldanti",
      "Impianti solari termici",
      "Manutenzione impianti termici e caldaie",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso indicare l'aliquota IVA ridotta al 10% per impianti residenziali?", a: "Sì. Nel testo specifica che si tratta di abitazione principale e prevai applicherà l'aliquota IVA corretta al documento." },
      { q: "Come gestisco i preventivi con fornitura e posa?", a: "prevai separa automaticamente i costi di fornitura materiali dai costi di posa e manodopera, come richiesto per le detrazioni fiscali." },
      { q: "Funziona per la manutenzione annuale degli impianti?", a: "Sì, perfetto anche per piccoli interventi di manutenzione periodica, con possibilità di creare preventivi ricorrenti simili in pochi secondi." },
    ],
    jsonLdDescription: "Software di preventivazione AI per termoidraulici italiani.",
  },

  freelance: {
    slug: "freelance",
    label: "Freelance",
    labelPlural: "freelance e consulenti",
    titleTag: "Preventivo per Freelance e Consulenti | prevai",
    titleVariants: [
      "Preventivo per Freelance e Consulenti | prevai",
      "Software Preventivi per Freelance Italiani | prevai",
      "Crea Proposte Commerciali Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi professionali per consulenza, marketing, design e IT in 30 secondi. Software AI per freelance italiani. Gratis.",
    descriptionVariants: [
      "Crea preventivi professionali per consulenza, marketing, design e IT in 30 secondi. Software AI per freelance italiani. Gratis.",
      "Software preventivi AI per freelance: proposte commerciali per consulenza, design e sviluppo in 30 secondi. Prova gratis.",
      "Preventivi professionali per freelance in 30 secondi. L'AI genera proposte con attività, tariffe e condizioni di pagamento.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Freelance",
    intro: "Come freelance, ogni proposta commerciale è un'occasione per trasmettere professionalità. Un preventivo ben strutturato fa la differenza tra un cliente che accetta e uno che passa al concorrente. prevai genera in 30 secondi una proposta commerciale dettagliata con descrizione delle attività, ore stimate, tariffe e condizioni di pagamento.",
    h2Benefits: "Perché i freelance scelgono prevai",
    benefits: [
      { title: "Proposta commerciale professionale", desc: "Non un semplice preventivo: una vera proposta di valore con descrizione delle attività, deliverable e modalità di lavoro." },
      { title: "Tariffe orarie e forfait", desc: "Gestisci sia preventivi a tariffa oraria che a corpo/forfait. L'AI adatta il formato in base alla tipologia di servizio." },
      { title: "Condizioni di pagamento chiare", desc: "Specifica acconto, milestone e saldo. Riduci i ritardi nei pagamenti con termini scritti e firmati dal cliente." },
      { title: "Immagine da professionista", desc: "Un documento con il tuo logo e intestazione trasmette serietà. Il cliente ti percepisce come un partner affidabile." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi il progetto", desc: "Scrivi: 'Realizzazione sito web aziendale: design UI/UX, sviluppo frontend React, integrazione CMS, SEO on-page, 2 revisioni incluse, consegna in 30 giorni'." },
      { step: "2. L'AI struttura la proposta", desc: "prevai genera le attività con ore stimate, tariffe e subtotali. Include le condizioni di pagamento e i termini di consegna." },
      { step: "3. PDF professionale che vende", desc: "Un documento con il tuo logo che trasmette competenza. Il cliente percepisce il valore del servizio prima ancora della chiamata." },
    ],
    h2UseCases: "Settori tipici per freelance e consulenti",
    useCases: [
      "Web developer e sviluppatori software",
      "Designer grafici e UX/UI designer",
      "Consulenti di marketing e SEO",
      "Copywriter e content creator",
      "Fotografi e videomaker professionisti",
      "Consulenti aziendali e business coach",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso usarlo anche senza partita IVA?", a: "Sì. prevai funziona anche per chi emette ricevute fiscali o è in regime forfettario. Puoi personalizzare la sezione fiscale del documento." },
      { q: "Come gestisco preventivi in inglese per clienti esteri?", a: "Al momento prevai genera documenti in italiano. Per clienti esteri puoi modificare manualmente le sezioni." },
      { q: "Posso allegare un portfolio o case study al preventivo?", a: "Il preventivo PDF si integra facilmente con altri documenti. Puoi unirlo al tuo portfolio in un unico file da inviare al cliente." },
    ],
    jsonLdDescription: "Software di preventivazione AI per freelance e consulenti italiani.",
  },

  geometra: {
    slug: "geometra",
    label: "Geometra",
    labelPlural: "geometri",
    titleTag: "Preventivo per Geometri e Studi Tecnici | prevai",
    titleVariants: [
      "Preventivo per Geometri e Studi Tecnici | prevai",
      "Software Preventivi per Geometri Italiani | prevai",
      "Crea Preventivi Tecnici Professionali – prevai AI",
    ],
    metaDescription: "Software preventivi per geometri e studi tecnici: perizie, pratiche edilizie, direzione lavori. AI in 30 secondi per professionisti italiani.",
    descriptionVariants: [
      "Software preventivi per geometri e studi tecnici: perizie, pratiche edilizie, direzione lavori. AI in 30 secondi per professionisti italiani.",
      "Preventivi per geometri in 30 secondi. L'AI gestisce onorari, spese vive e oneri previdenziali con terminologia tecnica corretta.",
      "Software di preventivazione AI per geometri e studi tecnici: perizie, SCIA, APE. Documenti professionali in 30 secondi.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Geometri",
    intro: "Un geometra offre una gamma ampia di prestazioni professionali: perizie, rilievi, pratiche al catasto, DIA e SCIA, direzione lavori, certificazioni energetiche. Ogni prestazione ha una tariffa professionale diversa. prevai genera preventivi tecnici dettagliati in linea con le prassi professionali degli studi tecnici italiani.",
    h2Benefits: "Perché i geometri scelgono prevai",
    benefits: [
      { title: "Onorari professionali strutturati", desc: "Distingui onorario professionale, spese vive e oneri previdenziali. Il documento rispetta le convenzioni dei preventivi di studio tecnico." },
      { title: "Terminologia tecnica corretta", desc: "L'AI conosce il lessico del settore: perizia estimativa, computo metrico estimativo, SCIA, CILA, relazione asseverata." },
      { title: "Più pratiche, stesso tempo", desc: "Genera il preventivo per ogni pratica in pochi secondi. Dedica più tempo alle attività tecniche ad alto valore aggiunto." },
      { title: "Dashboard studio tecnico", desc: "Tutti i preventivi e le pratiche organizzati per cliente. Gestione clienti PMI leggera ma efficace per il tuo studio." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi la prestazione tecnica", desc: "Scrivi: 'Perizia estimativa immobile commerciale 300mq con relazione di stima, rilievo planimetrico, ricerca ipocatastale e relazione finale'." },
      { step: "2. L'AI struttura il preventivo professionale", desc: "prevai genera le voci con onorario, spese vive e oneri previdenziali (4%). Terminologia conforme alle prassi degli studi tecnici." },
      { step: "3. PDF per il committente", desc: "Documento con l'intestazione del tuo studio, numero di pratica e condizioni di pagamento. Professionale quanto un preventivo di uno studio legale." },
    ],
    h2UseCases: "Prestazioni tipiche per geometri",
    useCases: [
      "Perizie estimative e relazioni di stima",
      "Pratiche catastali e variazioni planimetriche",
      "SCIA, CILA e pratiche edilizie",
      "Direzione lavori e contabilità di cantiere",
      "APE – Attestati di Prestazione Energetica",
      "Rilievi topografici e frazionamenti",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Il preventivo include gli oneri previdenziali della cassa geometri?", a: "Sì. Menziona nel testo che si tratta di prestazione professionale e prevai includerà automaticamente la voce per gli oneri previdenziali (4%)." },
      { q: "Posso creare preventivi separati per ogni pratica dello stesso cliente?", a: "Assolutamente. prevai archivia ogni preventivo con cliente e data, permettendo di gestire più pratiche contemporaneamente per lo stesso committente." },
      { q: "Come gestisco preventivi per lavori di direzione lavori lunghi?", a: "Puoi strutturare il preventivo per fasi (progetto, DL, contabilità finale) o creare preventivi separati per ogni fase del lavoro." },
    ],
    jsonLdDescription: "Software di preventivazione AI per geometri e studi tecnici italiani.",
  },

  muratore: {
    slug: "muratore",
    label: "Muratore",
    labelPlural: "muratori",
    titleTag: "Preventivo Muratore Online | Offerta Muratura AI – prevai",
    titleVariants: [
      "Preventivo Muratore Online | Offerta Muratura AI – prevai",
      "Software Preventivi per Muratori | prevai",
      "Crea Preventivi Muratura Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per lavori di muratura, fondazioni, demolizioni e opere edili in 30 secondi. Software AI per muratori italiani. Provalo gratis.",
    descriptionVariants: [
      "Crea preventivi per lavori di muratura, fondazioni, demolizioni e opere edili in 30 secondi. Software AI per muratori italiani. Provalo gratis.",
      "Software preventivi AI per muratori: fondazioni, tramezzi, intonaci. Computo metrico professionale in 30 secondi.",
      "Preventivi professionali per muratori in 30 secondi. L'AI calcola mc, mq, manodopera e materiali per ogni opera edile.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Muratori",
    intro: "Ogni lavoro di muratura ha voci specifiche: fondazioni, tramezzi, intonaci, massetti, cordoli. Spiegarlo al cliente in modo chiaro richiede tempo. Con prevai descrivi le opere murarie in linguaggio naturale e ottieni un'offerta commerciale strutturata con capitoli, quantità in mc e mq, prezzi unitari e IVA. In 30 secondi.",
    h2Benefits: "Perché i muratori scelgono prevai",
    benefits: [
      { title: "Computo metrico professionale", desc: "Voci in mc, mq, ml per murature, fondazioni e intonaci. Il committente vede esattamente cosa paga per ogni lavorazione." },
      { title: "Calcolo manodopera e materiali", desc: "L'AI stima le ore di manodopera e i materiali (mattoni, cemento, sabbia, ferro) in base alla descrizione del lavoro." },
      { title: "Documento valido per appalti", desc: "Il preventivo ha la struttura di un computo metrico estimativo, riconoscibile da committenti privati e pubblici." },
      { title: "Risposta rapida al cliente", desc: "Genera il preventivo dal cantiere in 30 secondi. Chi risponde prima vince spesso il lavoro." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi le opere murarie", desc: "Scrivi: 'Costruzione muro portante in laterizio h3m x 8ml, fondazione a platea 50mq sp.30cm con rete elettrosaldata, intonaco civile su tutte le superfici'." },
      { step: "2. L'AI calcola il computo metrico", desc: "prevai genera le voci in mc, mq e ml per ogni lavorazione. Stima le ore di manodopera e i materiali con prezzi di mercato italiani." },
      { step: "3. Offerta commerciale professionale", desc: "PDF con capitoli per fondazioni, muratura e finiture. Il committente vede un documento strutturato come un computo metrico estimativo." },
    ],
    h2UseCases: "Lavori tipici per muratori",
    useCases: [
      "Costruzione muri portanti e tramezzi in laterizio",
      "Fondazioni e platee in calcestruzzo armato",
      "Intonacatura civile e rasatura pareti",
      "Massetti per pavimentazioni e riscaldamento a pavimento",
      "Demolizioni e rimozione tramezzi",
      "Ripristino e consolidamento murature esistenti",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Il preventivo include i prezzi dei materiali da costruzione?", a: "Sì. L'AI suggerisce prezzi tipici del mercato italiano per mattoni, cemento, ferro e manodopera. Puoi modificare ogni voce prima di salvare." },
      { q: "Posso fare preventivi per lavori edili pubblici?", a: "Il documento generato ha la struttura di un computo metrico estimativo adatto anche a lavori pubblici di piccola entità." },
      { q: "Funziona anche per piccoli interventi di riparazione?", a: "Sì, prevai è adatto sia per piccoli interventi (riparazione muro, ripristino intonaco) che per grandi cantieri multi-capitolo." },
    ],
    jsonLdDescription: "Software di preventivazione AI per muratori italiani.",
  },

  giardiniere: {
    slug: "giardiniere",
    label: "Giardiniere",
    labelPlural: "giardinieri",
    titleTag: "Preventivo Giardiniere Online | Manutenzione Giardino – prevai",
    titleVariants: [
      "Preventivo Giardiniere Online | Manutenzione Giardino – prevai",
      "Software Preventivi per Giardinieri | prevai",
      "Crea Preventivi Giardinaggio Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per giardinaggio, manutenzione giardino e progettazione verde in 30 secondi. Software AI per giardinieri italiani. Provalo gratis.",
    descriptionVariants: [
      "Crea preventivi per giardinaggio, manutenzione giardino e progettazione verde in 30 secondi. Software AI per giardinieri italiani. Provalo gratis.",
      "Software preventivi AI per giardinieri: taglio erba, potatura, impianti irrigazione. Offerte professionali in 30 secondi.",
      "Preventivi professionali per giardinieri in 30 secondi. L'AI calcola mq di prato, ml di siepe e canoni di manutenzione.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Giardinieri",
    intro: "Taglio erba, potatura siepi, realizzazione aiuole, impianti di irrigazione: ogni servizio di giardinaggio ha un costo difficile da comunicare al cliente. prevai capisce il linguaggio del verde e genera un preventivo professionale con voci dettagliate e prezzi. In 30 secondi.",
    h2Benefits: "Perché i giardinieri scelgono prevai",
    benefits: [
      { title: "Voci per ogni servizio verde", desc: "Taglio erba, potatura, concimazione, trattamenti fitosanitari, impianti irrigazione: ogni servizio con la sua voce e prezzo unitario." },
      { title: "Contratti di manutenzione annuali", desc: "Crea preventivi per abbonamenti di manutenzione mensile o stagionale. Il cliente capisce cosa riceve per ogni intervento." },
      { title: "Dal sopralluogo al preventivo in 2 minuti", desc: "Sei ancora in giardino? Genera l'offerta dallo smartphone e inviala al cliente prima ancora di uscire dal cancello." },
      { title: "Professionalità che fa la differenza", desc: "Un documento strutturato convince più clienti rispetto a un preventivo scritto a mano. Aumenta il tasso di chiusura dei preventivi." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi i lavori verde", desc: "Scrivi: 'Manutenzione mensile giardino 500mq: taglio prato con raccolta, potatura siepe tuja 40ml, trattamento fitosanitario piante da frutto'." },
      { step: "2. L'AI genera le voci del servizio", desc: "prevai calcola i prezzi per mq di prato, ml di siepe e ogni servizio verde. Struttura l'offerta per intervento o canone mensile." },
      { step: "3. PDF inviato dal cantiere", desc: "Sei ancora in giardino? Descrivi il lavoro, genera il PDF e invialo al cliente via WhatsApp in 2 minuti." },
    ],
    h2UseCases: "Servizi tipici per giardinieri",
    useCases: [
      "Manutenzione ordinaria prati e giardini",
      "Potatura siepi, arbusti e alberi da frutto",
      "Progettazione e realizzazione giardini da zero",
      "Installazione impianti di irrigazione automatica",
      "Trattamenti fitosanitari e concimazioni",
      "Realizzazione aiuole, fioriere e giardini pensili",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso creare preventivi per abbonamenti annuali di manutenzione?", a: "Sì. Descrivilo nel testo (es. 'manutenzione mensile aprile-ottobre') e prevai struttura l'offerta con canone e interventi inclusi." },
      { q: "Il preventivo funziona anche per la gestione di aree condominiali?", a: "Perfetto per condomini. Puoi creare preventivi multi-voce con frequenze diverse per ogni servizio e intestarli all'amministratore." },
      { q: "Posso aggiungere il listino per stagione estiva e invernale?", a: "Sì, crea preventivi separati per stagione o includi nella descrizione i lavori stagionali e prevai li distinguerà automaticamente." },
    ],
    jsonLdDescription: "Software di preventivazione AI per giardinieri italiani.",
  },

  piastrellista: {
    slug: "piastrellista",
    label: "Piastrellista",
    labelPlural: "piastrellisti",
    titleTag: "Preventivo Piastrellista | Posa Piastrelle Online – prevai",
    titleVariants: [
      "Preventivo Piastrellista | Posa Piastrelle Online – prevai",
      "Software Preventivi per Piastrellisti | prevai",
      "Crea Preventivi Posa Piastrelle Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per posa piastrelle, gres porcellanato, rivestimenti e mosaici in 30 secondi. Software AI per piastrellisti italiani. Provalo gratis.",
    descriptionVariants: [
      "Crea preventivi per posa piastrelle, gres porcellanato, rivestimenti e mosaici in 30 secondi. Software AI per piastrellisti italiani. Provalo gratis.",
      "Software preventivi AI per piastrellisti: calcolo mq, tipo di posa, preparazione fondo. Offerte professionali in 30 secondi.",
      "Preventivi professionali per piastrellisti in 30 secondi. L'AI calcola mq da posare, scarti e costi di preparazione fondo.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Piastrellisti",
    intro: "Posa di gres porcellanato, rivestimento bagni, pavimenti in cotto, mosaici: ogni lavoro di piastrellatura ha voci specifiche. prevai trasforma la tua descrizione tecnica in un preventivo professionale con mq, prezzi unitari e totali. In 30 secondi, direttamente dal cantiere.",
    h2Benefits: "Perché i piastrellisti scelgono prevai",
    benefits: [
      { title: "Calcolo mq automatico", desc: "Descrivi le superfici e l'AI calcola i mq da posare includendo gli scarti tipici per formato e tipo di posa." },
      { title: "Voci per tipo di materiale", desc: "Gres porcellanato, cotto, marmo, mosaico: ogni materiale con il suo prezzo. Il cliente vede esattamente cosa sta acquistando." },
      { title: "Preparazione del fondo inclusa", desc: "L'AI riconosce le voci accessorie: rasatura, massetto, impermeabilizzazione, rimozione vecchio pavimento. Niente dimenticanze." },
      { title: "Preventivo dal cliente in 60 secondi", desc: "Fai il sopralluogo, descrivi i lavori, invia il PDF. Tutto in meno di due minuti prima di uscire dall'appartamento." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi il lavoro di posa", desc: "Scrivi: 'Posa gres porcellanato effetto legno 20x120 in soggiorno 45mq, rimozione vecchio pavimento, rasatura massetto, battiscopa coordinato'." },
      { step: "2. L'AI calcola mq e costi", desc: "prevai stima i mq da posare con scarto, le voci per rasatura fondo e la rimozione del vecchio materiale. Prezzi unitari per ogni lavorazione." },
      { step: "3. PDF dal cantiere in 60 secondi", desc: "Ancora dall'appartamento del cliente: descrivi i lavori, genera il PDF e invialo. Chi arriva prima vince il lavoro." },
    ],
    h2UseCases: "Lavori tipici per piastrellisti",
    useCases: [
      "Posa gres porcellanato e grandi lastre in soggiorno",
      "Rivestimento bagni e docce con ceramica e mosaico",
      "Rifacimento pavimenti con rimozione vecchio materiale",
      "Posa cotto e pavimenti in pietra naturale",
      "Impermeabilizzazione docce e zone umide",
      "Posa parquet ceramico e pavimenti effetto legno",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Il preventivo include anche la fornitura dei materiali?", a: "Puoi scegliere: specifica se la fornitura è inclusa e prevai distinguerà il costo della posa da quello dei materiali." },
      { q: "Come gestisco preventivi con più ambienti?", a: "Descrivi ogni ambiente nel testo ('bagno 8mq, soggiorno 35mq') e prevai crea voci separate per ciascuno." },
      { q: "Posso usarlo anche per preventivi di rivestimento scale o terrazzi?", a: "Sì. Scale, terrazzi, balconi e facciate rientrano tutti nelle voci che prevai riconosce e quantifica automaticamente." },
    ],
    jsonLdDescription: "Software di preventivazione AI per piastrellisti italiani.",
  },

  serramentista: {
    slug: "serramentista",
    label: "Serramentista",
    labelPlural: "serramentisti",
    titleTag: "Preventivo Serramentista | Infissi e Finestre Online – prevai",
    titleVariants: [
      "Preventivo Serramentista | Infissi e Finestre Online – prevai",
      "Software Preventivi per Serramentisti | prevai",
      "Crea Preventivi Infissi e Serramenti Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per infissi, finestre, porte e serramenti in PVC, alluminio e legno in 30 secondi. Software AI per serramentisti italiani.",
    descriptionVariants: [
      "Crea preventivi per infissi, finestre, porte e serramenti in PVC, alluminio e legno in 30 secondi. Software AI per serramentisti italiani.",
      "Software preventivi AI per serramentisti: finestre PVC, porte blindate, portoni. Offerte professionali in 30 secondi.",
      "Preventivi professionali per serramentisti in 30 secondi. L'AI include specifiche tecniche e note per il Bonus Infissi.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Serramentisti",
    intro: "Finestre in PVC, porte blindate, portoni sezionali, infissi in alluminio a taglio termico: ogni prodotto ha caratteristiche tecniche precise. prevai traduce le specifiche tecniche dei tuoi serramenti in un preventivo chiaro e professionale con descrizioni, quantità, prezzi e posa inclusa. In 30 secondi.",
    h2Benefits: "Perché i serramentisti scelgono prevai",
    benefits: [
      { title: "Specifiche tecniche nel documento", desc: "Trasmittanza termica, classe acustica, colore RAL, tipo di vetro: prevai include tutte le caratteristiche tecniche che il cliente vuole vedere." },
      { title: "Fornitura e posa separati", desc: "Il preventivo distingue chiaramente il costo del prodotto dalla posa. Trasparenza che genera fiducia e riduce le trattative." },
      { title: "Bonus finestre e Ecobonus", desc: "Se il lavoro rientra nel Bonus Infissi o nell'Ecobonus 50%, includilo nella descrizione e prevai aggiunge le note fiscali." },
      { title: "Da più preventivi a più commesse", desc: "Con prevai rispondi a più richieste nello stesso tempo. Più preventivi inviati = più lavori vinti." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi i serramenti", desc: "Scrivi: '4 finestre PVC 100x140 a 2 ante, classe A4, Uw 0.9, colore esterno antracite, 1 portoncino blindato 90x210 classe 3 sicurezza, posa inclusa'." },
      { step: "2. L'AI genera il preventivo tecnico", desc: "prevai include le specifiche tecniche nel documento: materiale, trasmittanza, classe di sicurezza, dimensioni. Tutto quello che il cliente vuole sapere." },
      { step: "3. PDF professionale in 2 minuti", desc: "Il documento è già formattato con fornitura e posa separati. Il cliente riceve un'offerta professionale che giustifica il prezzo." },
    ],
    h2UseCases: "Prodotti e lavori tipici per serramentisti",
    useCases: [
      "Sostituzione finestre in PVC e alluminio a taglio termico",
      "Installazione porte blindate e portoncini d'ingresso",
      "Portoni sezionali e basculanti per garage",
      "Zanzariere fisse, a rullo e plissé su misura",
      "Serrande avvolgibili motorizzate e persiane in alluminio",
      "Vetrate scorrevoli e pareti in vetro",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Il preventivo è valido per richiedere il Bonus Infissi?", a: "Sì. prevai genera un documento con la struttura richiesta, separando fornitura e posa. Sarà da integrare con la scheda tecnica del prodotto." },
      { q: "Posso includere le certificazioni tecniche nel preventivo?", a: "Nella descrizione puoi menzionare le certificazioni (classe energetica, Uw, Rw) e prevai le includerà nel documento come specifiche tecniche." },
      { q: "Gestisco anche preventivi per serramenti su misura?", a: "Perfetto per su misura. Descrivi le dimensioni esatte e le caratteristiche e prevai genera la voce con il prezzo personalizzato." },
    ],
    jsonLdDescription: "Software di preventivazione AI per serramentisti italiani.",
  },

  tetto: {
    slug: "tetto",
    label: "Copertura e Tetto",
    labelPlural: "imprese di coperture",
    titleTag: "Preventivo Rifacimento Tetto | Coperture Online – prevai",
    titleVariants: [
      "Preventivo Rifacimento Tetto | Coperture Online – prevai",
      "Software Preventivi per Coperture e Tetti | prevai",
      "Crea Preventivi Rifacimento Tetto Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per rifacimento tetto, coperture, impermeabilizzazioni e lattonerie in 30 secondi. Software AI per imprese di coperture italiane. Provalo gratis.",
    descriptionVariants: [
      "Crea preventivi per rifacimento tetto, coperture, impermeabilizzazioni e lattonerie in 30 secondi. Software AI per imprese di coperture italiane. Provalo gratis.",
      "Software preventivi AI per coperture: tegole, guaine, lattoneria, isolamento. Computo metrico professionale in 30 secondi.",
      "Preventivi professionali per rifacimento tetti in 30 secondi. L'AI calcola mq di copertura, lattoneria e materiali di impermeabilizzazione.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Coperture e Tetti",
    intro: "Rifacimento del manto di tegole, impermeabilizzazione terrazzo, lattoneria, isolamento: ogni lavoro di copertura ha costi elevati e voci tecniche complesse. prevai genera un computo metrico professionale per opere di copertura con mq, prezzi unitari e capitoli distinti per materiali e manodopera. In 30 secondi.",
    h2Benefits: "Perché le imprese di coperture scelgono prevai",
    benefits: [
      { title: "Voci tecniche per le coperture", desc: "Tegole marsigliesi, lamiera, guaine bituminose, pannelli sandwich, lattoneria: prevai conosce i materiali e i prezzi di mercato italiani." },
      { title: "Capitoli separati per ogni lavorazione", desc: "Smontaggio vecchio manto, posa isolante, nuova copertura, lattoneria e grondaie: ogni fase nel suo capitolo con costi distinti." },
      { title: "Preventivo per Superbonus e detrazioni", desc: "I lavori di coibentazione del tetto spesso rientrano nel Superbonus o Ecobonus. prevai struttura il documento per supportare la pratica." },
      { title: "Velocità = più lavori", desc: "Chi fa il sopralluogo e manda il preventivo in giornata ha un vantaggio enorme sulla concorrenza. Con prevai ci vuole un minuto." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi le opere di copertura", desc: "Scrivi: 'Rifacimento manto tegole coppi su tetto a 2 falde 150mq: rimozione vecchio manto, nuovo listello e controlistello, tegole coppo toscano, lattoneria in rame'." },
      { step: "2. L'AI calcola il computo coperture", desc: "prevai stima i mq di copertura, i ml di lattoneria e le ore di manodopera. Genera capitoli separati per smontaggio, posa e lattoneria." },
      { step: "3. PDF con computo dettagliato", desc: "Documento con Quadro Sintetico e voci dettagliate. Il committente vede la professionalità dell'impresa ancor prima dell'inizio lavori." },
    ],
    h2UseCases: "Lavori tipici per imprese di coperture",
    useCases: [
      "Rifacimento manto tegole e coppi",
      "Impermeabilizzazione terrazzi e tetti piani con guaina",
      "Installazione pannelli coibentanti e isolamento sottotetto",
      "Lattoneria: grondaie, pluviali, scossaline in rame o zinco",
      "Installazione lucernari e finestre per tetti",
      "Coperture in lamiera e pannelli sandwich industriali",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Il preventivo va bene per i lavori con Superbonus cappotto tetto?", a: "Sì. Menziona il tipo di intervento (isolamento, cappotto) e prevai genera il documento con la separazione materiali/manodopera per la pratica." },
      { q: "Come gestisco preventivi con ponteggio incluso?", a: "Aggiungi il ponteggio nella descrizione e prevai lo inserisce come voce separata con il costo al mq o al mese secondo il tuo input." },
      { q: "Posso usarlo anche per manutenzioni ordinarie del tetto?", a: "Perfetto anche per piccole manutenzioni: sostituzione tegole rotte, sigillatura comignoli, pulizia grondaie. Voci rapide in 30 secondi." },
    ],
    jsonLdDescription: "Software di preventivazione AI per imprese di coperture italiane.",
  },

  condizionatori: {
    slug: "condizionatori",
    label: "Condizionatore",
    labelPlural: "installatori di climatizzatori",
    titleTag: "Preventivo Condizionatore e Climatizzatore | prevai – AI",
    titleVariants: [
      "Preventivo Condizionatore e Climatizzatore | prevai – AI",
      "Software Preventivi Impianti Climatizzazione | prevai",
      "Crea Preventivi Condizionatori Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per installazione condizionatori, climatizzatori, pompe di calore e ventilazione in 30 secondi. Software AI per installatori italiani. Gratis.",
    descriptionVariants: [
      "Crea preventivi per installazione condizionatori, climatizzatori, pompe di calore e ventilazione in 30 secondi. Software AI per installatori italiani. Gratis.",
      "Software preventivi AI per installatori di climatizzatori: split, pompe di calore, VMC. Offerte professionali in 30 secondi.",
      "Preventivi professionali per impianti di climatizzazione in 30 secondi. L'AI include specifiche tecniche e note per l'Ecobonus.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Impianti di Climatizzazione",
    intro: "Installazione split, pompe di calore, VMC, impianti VRF multi-split: ogni lavoro di climatizzazione ha specifiche tecniche precise e costi che cambiano in base alla potenza e alla complessità dell'installazione. prevai genera preventivi professionali per impianti di climatizzazione in 30 secondi.",
    h2Benefits: "Perché gli installatori di climatizzatori scelgono prevai",
    benefits: [
      { title: "Schede tecniche nel preventivo", desc: "Potenza in kW/BTU, classe energetica, marca e modello: ogni apparecchio descritto con le specifiche che il cliente vuole vedere prima di decidere." },
      { title: "Voci per fornitura e installazione", desc: "Il documento separa il costo dell'unità dal lavoro di installazione. Trasparenza che riduce le discussioni sul prezzo." },
      { title: "Ecobonus pompe di calore", desc: "Le pompe di calore aria-acqua rientrano nell'Ecobonus 65%. prevai include le note fiscali se menzioni il tipo di intervento." },
      { title: "Da sopralluogo a preventivo in 2 minuti", desc: "Fai la valutazione tecnica, descrivi i lavori e invia il PDF al cliente prima ancora di salire in auto." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi l'impianto di climatizzazione", desc: "Scrivi: 'Installazione 3 split inverter LG 9000 BTU in soggiorno e 2 camere, unità esterna multi-split 28000 BTU, tubazioni 3ml per unità, scarico condensa'." },
      { step: "2. L'AI genera il preventivo tecnico", desc: "prevai include le specifiche dell'apparecchio (BTU, classe energetica, marca) e le voci per installazione e accessori. Note Ecobonus se applicabile." },
      { step: "3. PDF con fornitura e posa separati", desc: "Il documento distingue il costo dell'apparecchio dall'installazione. Il cliente capisce cosa paga e può verificare il prezzo dell'unità." },
    ],
    h2UseCases: "Impianti tipici per installatori di climatizzatori",
    useCases: [
      "Installazione split inverter mono e multi-split residenziali",
      "Pompe di calore aria-acqua per riscaldamento e raffrescamento",
      "Impianti VRF e canalizzati per uffici e locali commerciali",
      "Sistemi di ventilazione meccanica controllata (VMC)",
      "Manutenzione e ricarica gas impianti esistenti",
      "Impianti di raffrescamento evaporativo industriale",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Il preventivo include l'Ecobonus per le pompe di calore?", a: "Sì. Specifica che si tratta di una pompa di calore e prevai aggiunge la nota fiscale per l'Ecobonus 65% con la separazione fornitura/manodopera." },
      { q: "Posso includere il contratto di manutenzione annuale nel preventivo?", a: "Sì. Aggiungi nella descrizione il piano di manutenzione e prevai crea una voce separata per il canone annuale." },
      { q: "Funziona anche per grandi impianti di climatizzazione industriale?", a: "Assolutamente. prevai supporta preventivi multi-capitolo per impianti complessi con più unità, canalizzazioni e quadri elettrici dedicati." },
    ],
    jsonLdDescription: "Software di preventivazione AI per installatori di climatizzatori italiani.",
  },

  pittore: {
    slug: "pittore",
    label: "Pittore Edile",
    labelPlural: "pittori edili",
    titleTag: "Preventivo Pittore Edile | Verniciatura Online – prevai",
    titleVariants: [
      "Preventivo Pittore Edile | Verniciatura Online – prevai",
      "Software Preventivi per Pittori Edili | prevai",
      "Crea Preventivi Verniciatura Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per pittura edile, verniciatura facciate, tinteggiatura interni ed esterni in 30 secondi. Software AI per pittori edili italiani. Gratis.",
    descriptionVariants: [
      "Crea preventivi per pittura edile, verniciatura facciate, tinteggiatura interni ed esterni in 30 secondi. Software AI per pittori edili italiani. Gratis.",
      "Software preventivi AI per pittori edili: tinteggiatura interni, verniciatura facciate, stucchi decorativi. In 30 secondi.",
      "Preventivi professionali per pittori edili in 30 secondi. L'AI calcola mq per ogni superficie e tipo di prodotto verniciante.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Pittori Edili",
    intro: "Tinteggiatura di interni, verniciatura di facciate, rifinitura di serramenti, stucchi decorativi: il lavoro del pittore edile richiede preventivi dettagliati con mq, tipo di prodotto e numero di mani. prevai genera un'offerta commerciale professionale con voci distinte per ogni lavorazione. In 30 secondi.",
    h2Benefits: "Perché i pittori edili scelgono prevai",
    benefits: [
      { title: "Calcolo mq automatico per ogni superficie", desc: "Pareti, soffitti, facciate, serramenti: l'AI stima le superfici in base alla descrizione e calcola i mq da trattare." },
      { title: "Tipo di prodotto nel documento", desc: "Primer, pittura lavabile, silossanica, smalto: ogni prodotto nominato esplicitamente con il numero di mani. Il cliente vede la qualità." },
      { title: "Preventivo in cantiere dal telefono", desc: "Fai il sopralluogo, apri prevai, descrivi i lavori e manda il PDF. Tutto prima che il cliente chiami il secondo preventivatore." },
      { title: "Lavori interni ed esterni", desc: "Dalla tinteggiatura dell'appartamento alla verniciatura della facciata condominiale: prevai gestisce entrambi con voci appropriate." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi i lavori di pittura", desc: "Scrivi: 'Tinteggiatura interni appartamento 90mq: primer su tutte le pareti, 2 mani pittura lavabile bianca, soffitti con idropittura, verniciatura porte interne con smalto satinato'." },
      { step: "2. L'AI calcola le voci", desc: "prevai identifica superfici, prodotti, numero di mani e ore di lavoro. Genera un preventivo con mq per ogni tipo di lavorazione." },
      { step: "3. PDF professionale con il tuo logo", desc: "Documento che trasmette qualità professionale. Il cliente capisce cosa riceve e si fida del tuo lavoro prima ancora di vederlo." },
    ],
    h2UseCases: "Lavori tipici per pittori edili",
    useCases: [
      "Tinteggiatura appartamenti e case private (interni)",
      "Verniciatura facciate con pittura silossanica o ai silicati",
      "Stucco veneziano e finiture decorative di pregio",
      "Verniciatura serramenti in legno e ferro",
      "Trattamenti antimuffa e pitture traspiranti",
      "Rifacimento facciate condominiali",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Il preventivo distingue i prodotti per interni ed esterni?", a: "Sì. L'AI riconosce il contesto (interno/esterno) e usa i prodotti appropriati: idropittura lavabile per interni, silossanica o ai silicati per esterni." },
      { q: "Posso inserire il numero di mani e il tipo di primer nel preventivo?", a: "Assolutamente. Includi questi dettagli nella descrizione e prevai li riporterà fedelmente nel documento." },
      { q: "Come gestisco preventivi per condomini con ponteggio?", a: "Aggiungi il costo del ponteggio nella descrizione e prevai lo inserisce come voce separata nel computo." },
    ],
    jsonLdDescription: "Software di preventivazione AI per pittori edili italiani.",
  },

  pavimentista: {
    slug: "pavimentista",
    label: "Pavimentista",
    labelPlural: "pavimentisti",
    titleTag: "Preventivo Posa Pavimento | Pavimentista Online – prevai",
    titleVariants: [
      "Preventivo Posa Pavimento | Pavimentista Online – prevai",
      "Software Preventivi per Pavimentisti | prevai",
      "Crea Preventivi Posa Pavimento Professionali – prevai AI",
    ],
    metaDescription: "Crea preventivi per posa parquet, laminato, pavimenti in resina, moquette e massetti in 30 secondi. Software AI per pavimentisti italiani. Provalo gratis.",
    descriptionVariants: [
      "Crea preventivi per posa parquet, laminato, pavimenti in resina, moquette e massetti in 30 secondi. Software AI per pavimentisti italiani. Provalo gratis.",
      "Software preventivi AI per pavimentisti: parquet, laminato, resina. Calcolo mq automatico e preparazione fondo in 30 secondi.",
      "Preventivi professionali per pavimentisti in 30 secondi. L'AI calcola mq, scarti, preparazione fondo e costi di fornitura.",
    ],
    h1: "Preventivi per",
    h1Highlight: "Pavimentisti",
    intro: "Parquet prefinito, laminato, resina epossidica, pavimento in vinile, moquette: ogni tipo di pavimentazione ha costi di fornitura e posa diversi. prevai genera offerte commerciali professionali per lavori di pavimentazione con mq, tipo di prodotto, preparazione del fondo e finitura. In 30 secondi.",
    h2Benefits: "Perché i pavimentisti scelgono prevai",
    benefits: [
      { title: "Voci per fornitura e posa separate", desc: "Il documento distingue il costo del materiale dall'installazione e dalla preparazione del fondo. Trasparenza totale." },
      { title: "Preparazione del fondo inclusa", desc: "L'AI include automaticamente le voci per rasatura, massetto livellante e primer quando sono necessari. Niente dimenticanze." },
      { title: "Calcolo mq con percentuale di scarto", desc: "L'AI stima i mq da ordinare includendo lo scarto tipico per il formato e il tipo di posa. Ordini giusti, zero sprechi." },
      { title: "Dal sopralluogo al PDF in 60 secondi", desc: "Misuri, descrivi, invii. Il cliente riceve il preventivo prima che tu sia risalito in auto." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi la pavimentazione", desc: "Scrivi: 'Posa parquet prefinito rovere 15x120 in soggiorno 40mq con sottopavimento, rasatura massetto, battiscopa in legno su tutti i perimetri'." },
      { step: "2. L'AI genera il preventivo", desc: "prevai calcola mq, tipo di materiale, preparazione del fondo e finitura. Aggiunge le voci per smaltimento del vecchio pavimento se richiesto." },
      { step: "3. PDF pronto da inviare", desc: "Documento con intestazione professionale e logo aziendale. Il cliente lo approva via WhatsApp e parte il lavoro." },
    ],
    h2UseCases: "Lavori tipici per pavimentisti",
    useCases: [
      "Posa parquet prefinito e pavimenti in legno massello",
      "Installazione pavimenti laminati e vinilici (LVT/SPC)",
      "Pavimenti in resina epossidica e microcemento",
      "Posa moquette e rivestimenti tessili per uffici",
      "Massetti livellanti e preparazione fondi per la posa",
      "Lucidatura, verniciatura e manutenzione parquet esistenti",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Il preventivo include la rimozione del vecchio pavimento?", a: "Se lo menzioni nella descrizione sì. prevai aggiunge la voce di rimozione e smaltimento con i costi separati dalla nuova posa." },
      { q: "Posso fare preventivi per pavimenti in resina di grandi superfici?", a: "Sì, perfetto per resine epossidiche in ambito industriale, commerciale o residenziale. Prevai gestisce qualsiasi superficie." },
      { q: "Il preventivo è adatto anche per la lucidatura di parquet esistenti?", a: "Assolutamente. Descrivi il tipo di intervento (carteggiatura, verniciatura, trattamento ad olio) e prevai genera le voci con prezzi al mq." },
    ],
    jsonLdDescription: "Software di preventivazione AI per pavimentisti italiani.",
  },

  "modello-excel": {
    slug: "modello-excel",
    label: "Preventivo Excel",
    labelPlural: "utenti Excel",
    titleTag: "Modello Preventivo Excel Gratis | Alternativa Migliore – prevai",
    titleVariants: [
      "Modello Preventivo Excel Gratis | Alternativa Migliore – prevai",
      "Alternativa al Modello Preventivo Excel | prevai AI",
      "Preventivo Senza Excel: Software AI Gratuito – prevai",
    ],
    metaDescription: "Cerchi un modello preventivo Excel gratis? prevai è meglio: genera preventivi professionali in 30 secondi con l'AI, senza formule, senza errori. Prova gratis.",
    descriptionVariants: [
      "Cerchi un modello preventivo Excel gratis? prevai è meglio: genera preventivi professionali in 30 secondi con l'AI, senza formule, senza errori. Prova gratis.",
      "Alternativa al preventivo Excel: prevai genera offerte professionali in 30 secondi con l'AI. Niente formule, niente errori.",
      "Stop ai modelli Excel per preventivi. prevai AI genera documenti professionali in 30 secondi, con IVA e totali calcolati in automatico.",
    ],
    h1: "Basta con il",
    h1Highlight: "Preventivo su Excel",
    intro: "Scarichi un modello preventivo Excel, passi mezz'ora a impostare le formule, inserisci i dati uno per uno, controlli i calcoli, salvi come PDF — e alla fine il documento sembra ancora amatoriale. Con prevai descrivi il lavoro a parole e in 30 secondi hai un'offerta commerciale professionale.",
    h2Benefits: "Perché prevai è meglio di un foglio Excel",
    benefits: [
      { title: "Nessuna formula da impostare", desc: "Con Excel devi costruire o adattare il modello ogni volta. Con prevai descrivi il lavoro e il preventivo è già strutturato e calcolato." },
      { title: "PDF professionale in un clic", desc: "Niente conversioni da .xlsx a PDF. Il documento è già formattato come un preventivo professionale, pronto da inviare al cliente." },
      { title: "Calcoli sempre corretti", desc: "Le formule Excel si rompono. L'AI di prevai calcola IVA, subtotali e totali senza mai sbagliare." },
      { title: "Archivio digitale automatico", desc: "Con Excel salvi file in cartelle dimenticate. Con prevai tutti i preventivi sono nell'archivio digitale, accessibili da qualsiasi dispositivo." },
    ],
    h2HowItWorks: "Dalla descrizione al PDF: 3 passi",
    howItWorks: [
      { step: "1. Scrivi il lavoro a parole", desc: "Niente fogli, niente formule. Scrivi in italiano: 'Ristrutturazione bagno 8mq: rimozione vecchie piastrelle, posa gres 60x120, sostituzione sanitari'." },
      { step: "2. L'AI genera il preventivo completo", desc: "In 30 secondi hai voci, quantità, prezzi unitari, subtotali e IVA. Struttura da computo metrico professionale, non da foglio Excel." },
      { step: "3. Scarica il PDF e invia al cliente", desc: "Un clic per scaricare. Il cliente riceve un documento professionale con intestazione aziendale, logo e condizioni di pagamento." },
    ],
    h2UseCases: "Chi usa prevai al posto di Excel",
    useCases: [
      "Imbianchini e pittori edili stanchi di aggiornare formule",
      "Idraulici che vogliono fare il preventivo dal cantiere",
      "Imprese edili con preventivi multi-capitolo complessi",
      "Falegnami e carpentieri con voci materiali e manodopera",
      "Elettricisti che devono rispondere velocemente ai clienti",
      "Freelance e consulenti che inviano proposte commerciali",
    ],
    h2Faq: "Domande frequenti sul preventivo Excel vs prevai",
    faq: [
      { q: "I modelli preventivo Excel gratuiti sono davvero gratuiti?", a: "Sì, ma costano tempo. Ogni modello va adattato, le formule vanno verificate, la formattazione va sistemata. Con prevai in 30 secondi hai già il PDF." },
      { q: "Posso importare il mio vecchio preventivo Excel in prevai?", a: "Non serve importare nulla. Descrivi il lavoro in linguaggio naturale e prevai costruisce il preventivo da zero, più velocemente di copiare da Excel." },
      { q: "prevai funziona anche offline come Excel?", a: "prevai richiede connessione internet. Ma funziona da qualsiasi dispositivo — smartphone, tablet, laptop — senza installare nulla." },
    ],
    jsonLdDescription: "Alternativa AI ai modelli preventivo Excel. Genera preventivi professionali in 30 secondi senza formule e senza errori.",
  },

  "modello-word": {
    slug: "modello-word",
    label: "Preventivo Word",
    labelPlural: "utenti Word",
    titleTag: "Modello Preventivo Word Gratis | Preventivo Online AI – prevai",
    titleVariants: [
      "Modello Preventivo Word Gratis | Preventivo Online AI – prevai",
      "Alternativa al Template Preventivo Word | prevai AI",
      "Preventivo Senza Word: Software AI Professionale – prevai",
    ],
    metaDescription: "Cerchi un modello preventivo Word da scaricare? prevai genera preventivi professionali in 30 secondi con l'AI. Niente template Word, niente formattazione manuale.",
    descriptionVariants: [
      "Cerchi un modello preventivo Word da scaricare? prevai genera preventivi professionali in 30 secondi con l'AI. Niente template Word, niente formattazione manuale.",
      "Alternativa al preventivo Word: prevai genera offerte professionali in 30 secondi con l'AI. Niente formattazione, niente errori.",
      "Stop ai template Word per preventivi. prevai AI genera documenti professionali in 30 secondi, già formattati e pronti da inviare.",
    ],
    h1: "Dimentica il",
    h1Highlight: "Template Preventivo Word",
    intro: "Hai scaricato un template preventivo Word, passato mezz'ora a formattare la tabella, inserito i dati manualmente e alla fine il documento non sembra professionale quanto vorresti. Con prevai non devi trovare template, non devi formattare nulla: descrivi il lavoro a parole e in 30 secondi hai un preventivo impaginato, calcolato e pronto per il cliente.",
    h2Benefits: "Perché prevai è meglio di un template Word",
    benefits: [
      { title: "Nessun template da scaricare", desc: "Con Word devi trovare il modello giusto, adattarlo, controllare che la formattazione non si sia rotta. Con prevai digiti il lavoro e il preventivo è fatto." },
      { title: "Calcoli automatici inclusi", desc: "Word non calcola. Con prevai IVA, subtotali e totali sono calcolati dall'AI in automatico, senza errori e senza calcolatrice." },
      { title: "Struttura professionale predefinita", desc: "Ogni preventivo ha intestazione aziendale, numero documento, dati cliente, voci dettagliate con U.M. e totali. Struttura da studio commercialista." },
      { title: "Logo e brand aziendale inclusi", desc: "Il tuo logo appare automaticamente su ogni preventivo. Con Word devi inserirlo manualmente su ogni file." },
    ],
    h2HowItWorks: "Come creare un preventivo senza Word",
    howItWorks: [
      { step: "1. Descrivi il lavoro in italiano", desc: "Scrivi: 'Installazione impianto elettrico appartamento 70mq: 12 punti luce, 8 prese, quadro 12 moduli con differenziale, cablaggio dati 4 prese'." },
      { step: "2. L'AI struttura il preventivo", desc: "In 30 secondi hai un computo metrico con descrizioni tecniche, unità di misura, prezzi unitari e IVA calcolata. Meglio di qualsiasi template Word." },
      { step: "3. Scarica PDF e invia subito", desc: "Un PDF professionale, non un .docx che il cliente non riesce ad aprire. Invialo via WhatsApp, email o stampalo sul momento." },
    ],
    h2UseCases: "Chi cerca un preventivo Word e trova prevai",
    useCases: [
      "Artigiani che cercano 'modello preventivo Word gratis'",
      "Idraulici ed elettricisti alle prime armi con i preventivi",
      "Imprese edili che vogliono uno standard professionale",
      "Freelance che inviano proposte commerciali ai clienti",
      "Ristrutturatori e geometri con preventivi multi-voce",
      "Piccole imprese senza software gestionale",
    ],
    h2Faq: "Domande sul preventivo Word vs prevai",
    faq: [
      { q: "Dove posso trovare un modello preventivo Word gratis?", a: "Ci sono molti modelli gratuiti online, ma richiedono formattazione manuale e non calcolano i totali. Con prevai ci vuole un minuto e il risultato è molto più professionale." },
      { q: "Il PDF di prevai è compatibile con tutti i dispositivi?", a: "Sì. Il PDF si apre su qualsiasi smartphone, tablet o computer senza bisogno di Microsoft Office o altri programmi." },
      { q: "Posso personalizzare il preventivo dopo che l'AI lo ha generato?", a: "Sì. Puoi modificare ogni voce, i prezzi, le descrizioni e le condizioni di pagamento prima di scaricare il PDF definitivo." },
    ],
    jsonLdDescription: "Alternativa AI ai template preventivo Word. Genera preventivi professionali in 30 secondi senza formattazione manuale.",
  },

  "come-fare-preventivo": {
    slug: "come-fare-preventivo",
    label: "Preventivo Professionale",
    labelPlural: "professionisti",
    titleTag: "Come Fare un Preventivo Professionale Online | Guida prevai",
    titleVariants: [
      "Come Fare un Preventivo Professionale Online | Guida prevai",
      "Guida Come Fare Preventivi Professionali | prevai",
      "Come Creare un Preventivo Online in 30 Secondi – prevai",
    ],
    metaDescription: "Scopri come fare un preventivo professionale per la tua attività in 30 secondi. Guida pratica per artigiani, PMI e freelance italiani. Niente Excel, niente errori.",
    descriptionVariants: [
      "Scopri come fare un preventivo professionale per la tua attività in 30 secondi. Guida pratica per artigiani, PMI e freelance italiani. Niente Excel, niente errori.",
      "Guida pratica per fare preventivi professionali in 30 secondi. Software AI per artigiani e PMI italiane. Niente Excel, niente errori.",
      "Come fare un preventivo professionale in italiano. prevai AI genera offerte per artigiani in 30 secondi. Provalo gratis.",
    ],
    h1: "Come Fare un",
    h1Highlight: "Preventivo Professionale",
    intro: "Un preventivo professionale non è solo un elenco di voci e prezzi: è un documento commerciale che trasmette fiducia, giustifica il prezzo e accelera la decisione del cliente. Per farlo bene servono: intestazione aziendale, voci dettagliate con unità di misura, prezzi unitari, subtotali, IVA corretta e condizioni di pagamento chiare. Con prevai tutto questo viene generato automaticamente in 30 secondi.",
    h2Benefits: "Cos'è un preventivo professionale e perché conta",
    benefits: [
      { title: "Struttura da computo metrico", desc: "Un preventivo professionale ha voci distinte con descrizione, unità di misura, quantità e prezzo unitario. Non un tot finale scritto a mano." },
      { title: "IVA sempre corretta", desc: "Ogni categoria di lavoro ha la sua aliquota IVA: 4%, 10% o 22%. Un errore costa soldi e credibilità. prevai applica l'aliquota giusta in automatico." },
      { title: "Condizioni di pagamento chiare", desc: "Acconto, saldo a fine lavori, rate: le condizioni scritte nel preventivo riducono i conflitti e accelerano gli incassi." },
      { title: "Risposta rapida = più lavori vinti", desc: "Chi manda il preventivo per primo vince spesso il lavoro. Con prevai rispondi in 30 secondi invece che il giorno dopo." },
    ],
    h2HowItWorks: "Come creare un preventivo in 3 passi",
    howItWorks: [
      { step: "1. Descrivi il lavoro a parole", desc: "Non hai bisogno di conoscere la struttura giusta. Scrivi in italiano semplice cosa devi fare: l'AI di prevai capisce e struttura tutto." },
      { step: "2. Controlla e personalizza", desc: "L'AI genera il preventivo in 30 secondi. Controlla i prezzi, aggiusta le voci se vuoi, aggiungi le condizioni di pagamento." },
      { step: "3. Scarica il PDF e invialo", desc: "Il documento è già formattato con la tua intestazione aziendale e il tuo logo. Invialo via WhatsApp, email o stampalo per il cliente." },
    ],
    h2UseCases: "Chi usa prevai per fare preventivi professionali",
    useCases: [
      "Artigiani che vogliono smettere di fare preventivi a mano",
      "Imprese edili che cercano un software preventivi veloce",
      "Idraulici ed elettricisti che fanno preventivi dal cantiere",
      "Freelance che inviano proposte commerciali ai clienti",
      "Ristrutturatori che devono giustificare prezzi elevati",
      "Piccole imprese che vogliono un preventivo professionale",
    ],
    h2Faq: "Domande su come fare un preventivo",
    faq: [
      { q: "Qual è la struttura giusta per un preventivo professionale?", a: "Un buon preventivo include: intestazione con P.IVA e contatti, numero e data documento, dati del cliente, voci con descrizione/U.M./quantità/prezzo, totali con IVA, condizioni di pagamento. prevai genera tutto questo in automatico." },
      { q: "Che differenza c'è tra preventivo, offerta commerciale e computo metrico?", a: "Sono nomi diversi per lo stesso documento. Il preventivo è usato nel commercio in generale, l'offerta commerciale nel B2B, il computo metrico nell'edilizia. prevai genera tutti e tre i formati." },
      { q: "Quanto deve costare un preventivo? Come stabilisco i prezzi?", a: "prevai suggerisce prezzi tipici di mercato italiano per ogni tipo di lavoro. Puoi modificarli liberamente in base al tuo listino, alla zona geografica e alla complessità del lavoro." },
    ],
    jsonLdDescription: "Guida pratica su come fare un preventivo professionale. Software AI per artigiani e PMI italiane: preventivi in 30 secondi.",
  },

  "preventivi-gratis": {
    slug: "preventivi-gratis",
    label: "Preventivi Gratis",
    labelPlural: "artigiani e PMI",
    titleTag: "Preventivi Online Gratis | Software Preventivi Gratuito – prevai",
    titleVariants: [
      "Preventivi Online Gratis | Software Preventivi Gratuito – prevai",
      "Software Preventivi Gratuito per Artigiani | prevai",
      "Crea Preventivi Online Gratis con l'AI – prevai",
    ],
    metaDescription: "Crea preventivi online gratis con prevai. Software di preventivazione gratuito per artigiani e PMI italiane. Inizia subito senza carta di credito.",
    descriptionVariants: [
      "Crea preventivi online gratis con prevai. Software di preventivazione gratuito per artigiani e PMI italiane. Inizia subito senza carta di credito.",
      "Software preventivi gratuito per artigiani italiani. Inizia senza carta di credito. Piano Starter da 29€/mese con 20 preventivi.",
      "Preventivi online gratis per artigiani e PMI. prevai AI genera offerte professionali in 30 secondi. Nessuna carta di credito.",
    ],
    h1: "Preventivi Online",
    h1Highlight: "Gratuiti per Iniziare",
    intro: "Cerchi un software per fare preventivi online gratis? prevai ti permette di iniziare senza carta di credito: crea il tuo account, descrivi il lavoro a parole e genera il tuo primo preventivo professionale in 30 secondi. Il piano Starter da 29€/mese include 20 preventivi al mese — più che sufficienti per piccole attività.",
    h2Benefits: "Perché prevai è il miglior software preventivi gratuito",
    benefits: [
      { title: "Prova gratuita senza carta di credito", desc: "Registrati, crea il tuo primo preventivo e vedi il risultato prima di qualsiasi pagamento. Nessun impegno, nessuna sorpresa." },
      { title: "29€/mese per 20 preventivi", desc: "Il piano Starter include 20 preventivi professionali al mese. Per la maggior parte degli artigiani è più che sufficiente per partire." },
      { title: "Preventivi illimitati con Pro", desc: "Per chi ha un volume alto di preventivi, il piano Pro a 79€/mese offre preventivi illimitati senza restrizioni." },
      { title: "Nessun software da installare", desc: "prevai funziona direttamente nel browser, da smartphone o computer. Nessuna installazione, nessun aggiornamento manuale." },
    ],
    h2HowItWorks: "Inizia gratis in 3 minuti",
    howItWorks: [
      { step: "1. Crea il tuo account gratuito", desc: "Registrazione in 30 secondi con email o account Google. Nessuna carta di credito richiesta per iniziare." },
      { step: "2. Configura il profilo aziendale", desc: "Inserisci il nome dell'azienda, P.IVA, indirizzo e carica il logo. Le informazioni appariranno su ogni preventivo generato." },
      { step: "3. Genera il tuo primo preventivo gratis", desc: "Descrivi il lavoro in italiano e l'AI genera il preventivo in 30 secondi. Scarica il PDF e invialo al cliente." },
    ],
    h2UseCases: "Chi cerca un software preventivi gratuito",
    useCases: [
      "Artigiani alle prime armi che vogliono preventivi professionali",
      "Piccole imprese che vogliono digitalizzare i preventivi",
      "Freelance che cercano un'alternativa gratuita a Word ed Excel",
      "Elettricisti e idraulici che vogliono provare prima di pagare",
      "Geometri e professionisti che testano nuovi strumenti",
      "Imprese edili che valutano un cambio di software",
    ],
    h2Faq: "Domande sul piano gratuito di prevai",
    faq: [
      { q: "prevai è davvero gratuito?", a: "La registrazione è gratuita e puoi creare il tuo primo preventivo senza pagare. Il piano Starter costa 29€/mese e include 20 preventivi. Nessuna carta di credito richiesta per iniziare." },
      { q: "Quanti preventivi posso fare gratis?", a: "Puoi vedere l'anteprima del preventivo generato gratuitamente. Per scaricare il PDF hai bisogno di un piano a pagamento o di un acquisto singolo da 29€." },
      { q: "Cosa succede se supero i 20 preventivi mensili del piano Starter?", a: "Il sistema ti avvisa quando sei vicino al limite. Puoi fare upgrade al piano Pro (illimitato) o acquistare preventivi singoli aggiuntivi." },
    ],
    jsonLdDescription: "Software di preventivazione online gratuito per artigiani e PMI italiane. Inizia gratis, senza carta di credito.",
  },
};

export const DEFAULT_SECTOR: SectorData = {
  slug: "professionista",
  label: "Professionista",
  labelPlural: "professionisti",
  titleTag: "Preventivi Online per Professionisti | prevai – AI",
  titleVariants: [
    "Preventivi Online per Professionisti | prevai – AI",
    "Software Preventivi per Artigiani e PMI | prevai",
    "Crea Preventivi Professionali Online – prevai AI",
  ],
  metaDescription: "Crea preventivi professionali in 30 secondi con l'AI. Software di preventivazione digitale per artigiani, PMI e professionisti italiani. Gratis.",
  descriptionVariants: [
    "Crea preventivi professionali in 30 secondi con l'AI. Software di preventivazione digitale per artigiani, PMI e professionisti italiani. Gratis.",
    "Software preventivi AI per artigiani e PMI italiane. Genera offerte professionali in 30 secondi. Niente Excel, niente errori.",
    "Preventivi professionali in 30 secondi con l'AI. Per artigiani, imprese edili, freelance e professionisti italiani. Prova gratis.",
  ],
  h1: "Preventivi per",
  h1Highlight: "Professionisti",
  intro: "prevai è il software di preventivazione con intelligenza artificiale pensato per artigiani, PMI e professionisti italiani. Descrivi il lavoro in linguaggio naturale e ottieni un preventivo professionale completo in 30 secondi. Niente Excel, niente fogli scritti a mano, niente errori.",
  h2Benefits: "Perché scegliere prevai",
  benefits: [
    { title: "Velocità", desc: "30 secondi per un preventivo completo. Mandalo al cliente ancora in cantiere." },
    { title: "Professionalità", desc: "Documento con intestazione, voci dettagliate, IVA e condizioni di pagamento." },
    { title: "Zero errori", desc: "Calcoli automatici. L'AI non sbaglia mai i totali." },
    { title: "Archivio digitale", desc: "Tutti i tuoi preventivi accessibili sempre, da qualsiasi dispositivo." },
  ],
  h2HowItWorks: "Come funziona",
  howItWorks: [
    { step: "1. Descrivi il lavoro", desc: "Scrivi in italiano semplice cosa devi fare." },
    { step: "2. L'AI genera il preventivo", desc: "Voci, quantità, prezzi e IVA calcolati in automatico." },
    { step: "3. Scarica e invia", desc: "PDF pronto con il tuo logo. Invialo via WhatsApp o email." },
  ],
  h2UseCases: "Per chi è prevai",
  useCases: ["Artigiani", "Imprese edili", "Imbianchini", "Elettricisti", "Idraulici", "Freelance e consulenti"],
  h2Faq: "Domande frequenti",
  faq: [
    { q: "Quanto costa prevai?", a: "Il piano Starter costa 29€/mese. Il piano Pro costa 79€/mese con preventivi illimitati. Sono disponibili anche acquisti singoli." },
    { q: "Serve una carta di credito per provarlo?", a: "No. Puoi registrarti gratuitamente e creare il tuo primo preventivo senza inserire dati di pagamento." },
  ],
  jsonLdDescription: "Software di preventivazione AI per artigiani e professionisti italiani.",
};

export interface CityData {
  name: string;
  slug: string;
  region: string;
  regionSlug: string;
  nearbySlug: string[];
}

export const CITIES: CityData[] = [
  // Lombardia
  { name: "Milano", slug: "milano", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["bergamo", "brescia", "monza", "pavia", "varese"] },
  { name: "Bergamo", slug: "bergamo", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["milano", "brescia", "lecco", "monza", "cremona"] },
  { name: "Brescia", slug: "brescia", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["milano", "bergamo", "cremona", "mantova", "verona"] },
  { name: "Como", slug: "como", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["milano", "varese", "lecco", "bergamo", "novara"] },
  { name: "Cremona", slug: "cremona", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["brescia", "mantova", "piacenza", "bergamo", "lodi"] },
  { name: "Lecco", slug: "lecco", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["como", "bergamo", "monza", "sondrio", "varese"] },
  { name: "Lodi", slug: "lodi", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["milano", "cremona", "pavia", "piacenza", "bergamo"] },
  { name: "Mantova", slug: "mantova", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["brescia", "cremona", "verona", "ferrara", "reggio-emilia"] },
  { name: "Monza", slug: "monza", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["milano", "bergamo", "como", "lecco", "varese"] },
  { name: "Pavia", slug: "pavia", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["milano", "lodi", "piacenza", "alessandria", "cremona"] },
  { name: "Sondrio", slug: "sondrio", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["lecco", "como", "bergamo", "bolzano", "trento"] },
  { name: "Varese", slug: "varese", region: "Lombardia", regionSlug: "lombardia", nearbySlug: ["milano", "como", "monza", "novara", "lecco"] },
  // Piemonte
  { name: "Torino", slug: "torino", region: "Piemonte", regionSlug: "piemonte", nearbySlug: ["novara", "asti", "cuneo", "alessandria", "vercelli"] },
  { name: "Alessandria", slug: "alessandria", region: "Piemonte", regionSlug: "piemonte", nearbySlug: ["torino", "asti", "novara", "genova", "pavia"] },
  { name: "Asti", slug: "asti", region: "Piemonte", regionSlug: "piemonte", nearbySlug: ["torino", "alessandria", "cuneo", "novara", "vercelli"] },
  { name: "Biella", slug: "biella", region: "Piemonte", regionSlug: "piemonte", nearbySlug: ["vercelli", "torino", "novara", "verbania", "asti"] },
  { name: "Cuneo", slug: "cuneo", region: "Piemonte", regionSlug: "piemonte", nearbySlug: ["torino", "asti", "savona", "alessandria", "imperia"] },
  { name: "Novara", slug: "novara", region: "Piemonte", regionSlug: "piemonte", nearbySlug: ["torino", "milano", "vercelli", "varese", "biella"] },
  { name: "Verbania", slug: "verbania", region: "Piemonte", regionSlug: "piemonte", nearbySlug: ["novara", "biella", "vercelli", "varese", "como"] },
  { name: "Vercelli", slug: "vercelli", region: "Piemonte", regionSlug: "piemonte", nearbySlug: ["novara", "torino", "biella", "alessandria", "asti"] },
  // Liguria
  { name: "Genova", slug: "genova", region: "Liguria", regionSlug: "liguria", nearbySlug: ["savona", "la-spezia", "imperia", "alessandria", "cuneo"] },
  { name: "Imperia", slug: "imperia", region: "Liguria", regionSlug: "liguria", nearbySlug: ["savona", "genova", "cuneo", "la-spezia", "alessandria"] },
  { name: "La Spezia", slug: "la-spezia", region: "Liguria", regionSlug: "liguria", nearbySlug: ["genova", "savona", "massa", "lucca", "pisa"] },
  { name: "Savona", slug: "savona", region: "Liguria", regionSlug: "liguria", nearbySlug: ["genova", "imperia", "cuneo", "la-spezia", "alessandria"] },
  // Valle d'Aosta
  { name: "Aosta", slug: "aosta", region: "Valle d'Aosta", regionSlug: "valle-d-aosta", nearbySlug: ["torino", "novara", "vercelli", "biella", "verbania"] },
  // Veneto
  { name: "Venezia", slug: "venezia", region: "Veneto", regionSlug: "veneto", nearbySlug: ["padova", "treviso", "rovigo", "vicenza", "verona"] },
  { name: "Verona", slug: "verona", region: "Veneto", regionSlug: "veneto", nearbySlug: ["brescia", "vicenza", "mantova", "trento", "padova"] },
  { name: "Padova", slug: "padova", region: "Veneto", regionSlug: "veneto", nearbySlug: ["venezia", "vicenza", "rovigo", "treviso", "ferrara"] },
  { name: "Vicenza", slug: "vicenza", region: "Veneto", regionSlug: "veneto", nearbySlug: ["verona", "padova", "treviso", "trento", "venezia"] },
  { name: "Treviso", slug: "treviso", region: "Veneto", regionSlug: "veneto", nearbySlug: ["venezia", "padova", "vicenza", "udine", "belluno"] },
  { name: "Belluno", slug: "belluno", region: "Veneto", regionSlug: "veneto", nearbySlug: ["treviso", "vicenza", "trento", "udine", "pordenone"] },
  { name: "Rovigo", slug: "rovigo", region: "Veneto", regionSlug: "veneto", nearbySlug: ["padova", "venezia", "ferrara", "vicenza", "mantova"] },
  // Emilia-Romagna
  { name: "Bologna", slug: "bologna", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["modena", "ferrara", "firenze", "ravenna", "piacenza"] },
  { name: "Modena", slug: "modena", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["bologna", "reggio-emilia", "parma", "ferrara", "mantova"] },
  { name: "Parma", slug: "parma", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["piacenza", "reggio-emilia", "modena", "cremona", "la-spezia"] },
  { name: "Reggio Emilia", slug: "reggio-emilia", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["modena", "parma", "bologna", "mantova", "piacenza"] },
  { name: "Ferrara", slug: "ferrara", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["bologna", "rovigo", "ravenna", "modena", "padova"] },
  { name: "Ravenna", slug: "ravenna", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["bologna", "ferrara", "forli", "cesena", "rimini"] },
  { name: "Forlì", slug: "forli", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["cesena", "ravenna", "bologna", "rimini", "pesaro"] },
  { name: "Cesena", slug: "cesena", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["forli", "rimini", "ravenna", "pesaro", "bologna"] },
  { name: "Rimini", slug: "rimini", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["cesena", "forli", "pesaro", "ravenna", "san-marino"] },
  { name: "Piacenza", slug: "piacenza", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["parma", "cremona", "pavia", "lodi", "milano"] },
  // Friuli-Venezia Giulia
  { name: "Trieste", slug: "trieste", region: "Friuli-Venezia Giulia", regionSlug: "friuli-venezia-giulia", nearbySlug: ["udine", "gorizia", "venezia", "pordenone", "treviso"] },
  { name: "Udine", slug: "udine", region: "Friuli-Venezia Giulia", regionSlug: "friuli-venezia-giulia", nearbySlug: ["trieste", "gorizia", "pordenone", "treviso", "venezia"] },
  { name: "Pordenone", slug: "pordenone", region: "Friuli-Venezia Giulia", regionSlug: "friuli-venezia-giulia", nearbySlug: ["udine", "treviso", "venezia", "belluno", "gorizia"] },
  { name: "Gorizia", slug: "gorizia", region: "Friuli-Venezia Giulia", regionSlug: "friuli-venezia-giulia", nearbySlug: ["trieste", "udine", "pordenone", "venezia", "treviso"] },
  // Trentino-Alto Adige
  { name: "Trento", slug: "trento", region: "Trentino-Alto Adige", regionSlug: "trentino-alto-adige", nearbySlug: ["bolzano", "verona", "vicenza", "belluno", "brescia"] },
  { name: "Bolzano", slug: "bolzano", region: "Trentino-Alto Adige", regionSlug: "trentino-alto-adige", nearbySlug: ["trento", "verona", "brescia", "vicenza", "innsbruck"] },
  // Toscana
  { name: "Firenze", slug: "firenze", region: "Toscana", regionSlug: "toscana", nearbySlug: ["prato", "pistoia", "siena", "arezzo", "bologna"] },
  { name: "Arezzo", slug: "arezzo", region: "Toscana", regionSlug: "toscana", nearbySlug: ["firenze", "siena", "perugia", "grosseto", "prato"] },
  { name: "Grosseto", slug: "grosseto", region: "Toscana", regionSlug: "toscana", nearbySlug: ["siena", "livorno", "viterbo", "arezzo", "firenze"] },
  { name: "Livorno", slug: "livorno", region: "Toscana", regionSlug: "toscana", nearbySlug: ["pisa", "firenze", "grosseto", "lucca", "siena"] },
  { name: "Lucca", slug: "lucca", region: "Toscana", regionSlug: "toscana", nearbySlug: ["pisa", "pistoia", "massa", "firenze", "la-spezia"] },
  { name: "Massa", slug: "massa", region: "Toscana", regionSlug: "toscana", nearbySlug: ["lucca", "pisa", "la-spezia", "pistoia", "genova"] },
  { name: "Pisa", slug: "pisa", region: "Toscana", regionSlug: "toscana", nearbySlug: ["livorno", "lucca", "firenze", "massa", "pistoia"] },
  { name: "Pistoia", slug: "pistoia", region: "Toscana", regionSlug: "toscana", nearbySlug: ["firenze", "lucca", "prato", "massa", "siena"] },
  { name: "Prato", slug: "prato", region: "Toscana", regionSlug: "toscana", nearbySlug: ["firenze", "pistoia", "lucca", "siena", "arezzo"] },
  { name: "Siena", slug: "siena", region: "Toscana", regionSlug: "toscana", nearbySlug: ["firenze", "arezzo", "grosseto", "perugia", "pistoia"] },
  // Umbria
  { name: "Perugia", slug: "perugia", region: "Umbria", regionSlug: "umbria", nearbySlug: ["terni", "arezzo", "siena", "ancona", "firenze"] },
  { name: "Terni", slug: "terni", region: "Umbria", regionSlug: "umbria", nearbySlug: ["perugia", "rieti", "viterbo", "l-aquila", "ancona"] },
  // Marche
  { name: "Ancona", slug: "ancona", region: "Marche", regionSlug: "marche", nearbySlug: ["pesaro", "macerata", "perugia", "fermo", "ascoli-piceno"] },
  { name: "Ascoli Piceno", slug: "ascoli-piceno", region: "Marche", regionSlug: "marche", nearbySlug: ["fermo", "macerata", "ancona", "pescara", "teramo"] },
  { name: "Fermo", slug: "fermo", region: "Marche", regionSlug: "marche", nearbySlug: ["ascoli-piceno", "macerata", "ancona", "pesaro", "pescara"] },
  { name: "Macerata", slug: "macerata", region: "Marche", regionSlug: "marche", nearbySlug: ["ancona", "fermo", "ascoli-piceno", "pesaro", "perugia"] },
  { name: "Pesaro", slug: "pesaro", region: "Marche", regionSlug: "marche", nearbySlug: ["ancona", "rimini", "cesena", "macerata", "forli"] },
  // Lazio
  { name: "Roma", slug: "roma", region: "Lazio", regionSlug: "lazio", nearbySlug: ["latina", "frosinone", "viterbo", "rieti", "napoli"] },
  { name: "Frosinone", slug: "frosinone", region: "Lazio", regionSlug: "lazio", nearbySlug: ["roma", "latina", "caserta", "isernia", "l-aquila"] },
  { name: "Latina", slug: "latina", region: "Lazio", regionSlug: "lazio", nearbySlug: ["roma", "frosinone", "caserta", "napoli", "viterbo"] },
  { name: "Rieti", slug: "rieti", region: "Lazio", regionSlug: "lazio", nearbySlug: ["roma", "viterbo", "terni", "l-aquila", "ascoli-piceno"] },
  { name: "Viterbo", slug: "viterbo", region: "Lazio", regionSlug: "lazio", nearbySlug: ["roma", "rieti", "terni", "grosseto", "perugia"] },
  // Abruzzo
  { name: "L'Aquila", slug: "l-aquila", region: "Abruzzo", regionSlug: "abruzzo", nearbySlug: ["pescara", "chieti", "teramo", "rieti", "isernia"] },
  { name: "Chieti", slug: "chieti", region: "Abruzzo", regionSlug: "abruzzo", nearbySlug: ["pescara", "l-aquila", "teramo", "campobasso", "isernia"] },
  { name: "Pescara", slug: "pescara", region: "Abruzzo", regionSlug: "abruzzo", nearbySlug: ["chieti", "l-aquila", "teramo", "campobasso", "ancona"] },
  { name: "Teramo", slug: "teramo", region: "Abruzzo", regionSlug: "abruzzo", nearbySlug: ["pescara", "chieti", "l-aquila", "ascoli-piceno", "ancona"] },
  // Molise
  { name: "Campobasso", slug: "campobasso", region: "Molise", regionSlug: "molise", nearbySlug: ["isernia", "chieti", "benevento", "foggia", "pescara"] },
  { name: "Isernia", slug: "isernia", region: "Molise", regionSlug: "molise", nearbySlug: ["campobasso", "l-aquila", "caserta", "frosinone", "benevento"] },
  // Campania
  { name: "Napoli", slug: "napoli", region: "Campania", regionSlug: "campania", nearbySlug: ["caserta", "salerno", "benevento", "avellino", "latina"] },
  { name: "Avellino", slug: "avellino", region: "Campania", regionSlug: "campania", nearbySlug: ["napoli", "salerno", "benevento", "caserta", "potenza"] },
  { name: "Benevento", slug: "benevento", region: "Campania", regionSlug: "campania", nearbySlug: ["napoli", "caserta", "avellino", "campobasso", "foggia"] },
  { name: "Caserta", slug: "caserta", region: "Campania", regionSlug: "campania", nearbySlug: ["napoli", "benevento", "frosinone", "latina", "isernia"] },
  { name: "Salerno", slug: "salerno", region: "Campania", regionSlug: "campania", nearbySlug: ["napoli", "avellino", "potenza", "cosenza", "matera"] },
  // Puglia
  { name: "Bari", slug: "bari", region: "Puglia", regionSlug: "puglia", nearbySlug: ["taranto", "brindisi", "foggia", "lecce", "barletta"] },
  { name: "Barletta", slug: "barletta", region: "Puglia", regionSlug: "puglia", nearbySlug: ["bari", "foggia", "taranto", "brindisi", "lecce"] },
  { name: "Brindisi", slug: "brindisi", region: "Puglia", regionSlug: "puglia", nearbySlug: ["lecce", "taranto", "bari", "foggia", "barletta"] },
  { name: "Foggia", slug: "foggia", region: "Puglia", regionSlug: "puglia", nearbySlug: ["bari", "barletta", "campobasso", "benevento", "potenza"] },
  { name: "Lecce", slug: "lecce", region: "Puglia", regionSlug: "puglia", nearbySlug: ["brindisi", "taranto", "bari", "foggia", "barletta"] },
  { name: "Taranto", slug: "taranto", region: "Puglia", regionSlug: "puglia", nearbySlug: ["bari", "brindisi", "lecce", "potenza", "matera"] },
  // Basilicata
  { name: "Matera", slug: "matera", region: "Basilicata", regionSlug: "basilicata", nearbySlug: ["potenza", "taranto", "bari", "salerno", "cosenza"] },
  { name: "Potenza", slug: "potenza", region: "Basilicata", regionSlug: "basilicata", nearbySlug: ["matera", "salerno", "cosenza", "avellino", "taranto"] },
  // Calabria
  { name: "Catanzaro", slug: "catanzaro", region: "Calabria", regionSlug: "calabria", nearbySlug: ["cosenza", "crotone", "reggio-calabria", "vibo-valentia", "potenza"] },
  { name: "Cosenza", slug: "cosenza", region: "Calabria", regionSlug: "calabria", nearbySlug: ["catanzaro", "potenza", "salerno", "reggio-calabria", "vibo-valentia"] },
  { name: "Crotone", slug: "crotone", region: "Calabria", regionSlug: "calabria", nearbySlug: ["catanzaro", "cosenza", "vibo-valentia", "reggio-calabria", "taranto"] },
  { name: "Reggio Calabria", slug: "reggio-calabria", region: "Calabria", regionSlug: "calabria", nearbySlug: ["catanzaro", "vibo-valentia", "cosenza", "messina", "crotone"] },
  { name: "Vibo Valentia", slug: "vibo-valentia", region: "Calabria", regionSlug: "calabria", nearbySlug: ["catanzaro", "cosenza", "reggio-calabria", "crotone", "potenza"] },
  // Sicilia
  { name: "Agrigento", slug: "agrigento", region: "Sicilia", regionSlug: "sicilia", nearbySlug: ["palermo", "caltanissetta", "trapani", "enna", "ragusa"] },
  { name: "Caltanissetta", slug: "caltanissetta", region: "Sicilia", regionSlug: "sicilia", nearbySlug: ["palermo", "agrigento", "enna", "catania", "trapani"] },
  { name: "Catania", slug: "catania", region: "Sicilia", regionSlug: "sicilia", nearbySlug: ["messina", "siracusa", "ragusa", "enna", "palermo"] },
  { name: "Enna", slug: "enna", region: "Sicilia", regionSlug: "sicilia", nearbySlug: ["caltanissetta", "agrigento", "palermo", "catania", "messina"] },
  { name: "Messina", slug: "messina", region: "Sicilia", regionSlug: "sicilia", nearbySlug: ["catania", "palermo", "siracusa", "reggio-calabria", "enna"] },
  { name: "Palermo", slug: "palermo", region: "Sicilia", regionSlug: "sicilia", nearbySlug: ["trapani", "agrigento", "caltanissetta", "messina", "enna"] },
  { name: "Ragusa", slug: "ragusa", region: "Sicilia", regionSlug: "sicilia", nearbySlug: ["siracusa", "catania", "agrigento", "caltanissetta", "enna"] },
  { name: "Siracusa", slug: "siracusa", region: "Sicilia", regionSlug: "sicilia", nearbySlug: ["catania", "ragusa", "messina", "agrigento", "enna"] },
  { name: "Trapani", slug: "trapani", region: "Sicilia", regionSlug: "sicilia", nearbySlug: ["palermo", "agrigento", "caltanissetta", "messina", "enna"] },
  // Sardegna
  { name: "Cagliari", slug: "cagliari", region: "Sardegna", regionSlug: "sardegna", nearbySlug: ["oristano", "nuoro", "sassari", "olbia"] },
  { name: "Nuoro", slug: "nuoro", region: "Sardegna", regionSlug: "sardegna", nearbySlug: ["cagliari", "oristano", "sassari", "olbia"] },
  { name: "Olbia", slug: "olbia", region: "Sardegna", regionSlug: "sardegna", nearbySlug: ["sassari", "nuoro", "oristano", "cagliari"] },
  { name: "Oristano", slug: "oristano", region: "Sardegna", regionSlug: "sardegna", nearbySlug: ["cagliari", "nuoro", "sassari", "olbia"] },
  { name: "Sassari", slug: "sassari", region: "Sardegna", regionSlug: "sardegna", nearbySlug: ["olbia", "nuoro", "oristano", "cagliari"] },
];

export const CITIES_BY_SLUG: Record<string, CityData> = Object.fromEntries(
  CITIES.map((c) => [c.slug, c])
);

export const CITY_SECTORS: readonly string[] = [
  "imbianchino",
  "elettricista",
  "idraulico",
  "edilizia",
  "ristrutturazione",
  "carpentiere",
  "falegname",
  "termoidraulico",
  "freelance",
  "geometra",
];

export const SECTOR_CITIES: Record<string, string[]> = Object.fromEntries(
  Object.keys(SECTORS).map((s) => [s, CITIES.map((c) => c.slug)])
);

function strHash(s: string): number {
  return s.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

const CITY_TITLE_FORMULAS: Array<(label: string, labelPlural: string, city: string) => string> = [
  (label, _lp, city) => `Preventivo ${label} a ${city} | prevai – AI in 30s`,
  (_l, labelPlural, city) => `Software Preventivi per ${labelPlural} a ${city} | prevai`,
  (label, _lp, city) => `Crea Preventivi ${label} Professionali a ${city} – prevai`,
  (label, _lp, city) => `${label} a ${city}: Preventivo Online in 30 Secondi | prevai`,
  (_l, labelPlural, city) => `Preventivi per ${labelPlural} a ${city} | Software AI prevai`,
];

const CITY_DESC_FORMULAS: Array<(label: string, labelPlural: string, city: string, region: string) => string> = [
  (_l, labelPlural, city, region) => `Software di preventivazione AI per ${labelPlural} a ${city}. Crea preventivi professionali in 30 secondi. Nessuna carta di credito. Usato in tutta ${region}.`,
  (label, _lp, city) => `Sei un ${label.toLowerCase()} a ${city}? Genera preventivi professionali in 30 secondi con l'AI. Niente Excel, niente errori. Provalo gratis.`,
  (_l, labelPlural, city) => `I ${labelPlural} a ${city} usano prevai per creare preventivi in 30 secondi. Professionale, veloce, senza errori. Prova gratis.`,
  (label, _lp, city, region) => `Preventivo ${label.toLowerCase()} a ${city} in 30 secondi con l'AI. Software professionale per artigiani in ${region}. Nessun impegno.`,
  (label, _lp, city) => `Crea il tuo preventivo da ${label.toLowerCase()} a ${city} in 30 secondi. prevai AI per artigiani e PMI italiane. Provalo gratis.`,
];

export function getCityTitle(sector: SectorData, cityName: string, citySlug: string): string {
  const hash = strHash(sector.slug + citySlug);
  const formula = CITY_TITLE_FORMULAS[hash % CITY_TITLE_FORMULAS.length];
  return formula(sector.label, sector.labelPlural, cityName);
}

export function getCityDesc(sector: SectorData, cityName: string, citySlug: string, region: string): string {
  const hash = strHash(sector.slug + citySlug + "d");
  const formula = CITY_DESC_FORMULAS[hash % CITY_DESC_FORMULAS.length];
  return formula(sector.label, sector.labelPlural, cityName, region);
}
