export interface SectorData {
  slug: string;
  label: string;
  labelPlural: string;
  titleTag: string;
  metaDescription: string;
  h1: string;
  h1Highlight: string;
  intro: string;
  benefits: { title: string; desc: string }[];
  useCases: string[];
  jsonLdDescription: string;
}

export const SECTORS: Record<string, SectorData> = {
  imbianchino: {
    slug: "imbianchino",
    label: "Imbianchino",
    labelPlural: "imbianchini",
    titleTag: "Preventivo Imbianchino Online | prevai – AI in 30s",
    metaDescription: "Crea preventivi per tinteggiatura e imbiancatura in 30 secondi con l'AI. Software per imbianchini italiani. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Imbianchini",
    intro: "Smetti di perdere serate a fare preventivi su Excel o carta. Con prevai descrivi i lavori di tinteggiatura a parole tue — rasatura, due mani di pittura lavabile, rifinitura soffitti — e il motore AI genera un preventivo professionale con descrizioni tecniche, quantità in mq, prezzi unitari e IVA calcolata in automatico. In 30 secondi, dal tuo smartphone.",
    benefits: [
      { title: "Preventivo dal cantiere", desc: "Apri prevai dallo smartphone mentre sei ancora dal cliente. Descrivi i lavori in dialogo naturale e ottieni un documento pronto in un minuto." },
      { title: "Calcolo mq automatico", desc: "L'AI stima le superfici, i litri di vernice e le ore di lavoro in base alla descrizione. Niente più calcoli manuali sbagliati." },
      { title: "Documento professionale", desc: "Il preventivo include intestazione aziendale, voce per voce con U.M., prezzi unitari, subtotali e IVA. Trasmette fiducia al cliente." },
      { title: "Archivio digitale", desc: "Tutti i tuoi preventivi salvati e accessibili da qualsiasi dispositivo. Trova subito il documento del cliente senza cercare tra le carte." },
    ],
    useCases: ["Tinteggiatura appartamenti con pittura lavabile", "Imbiancatura locali commerciali e uffici", "Rasatura e ripristino pareti con crepe", "Verniciatura serramenti e infissi in legno", "Stucco veneziano e finiture decorative", "Rifacimento facciate esterne"],
    jsonLdDescription: "Software di preventivazione AI per imbianchini italiani.",
  },
  elettricista: {
    slug: "elettricista",
    label: "Elettricista",
    labelPlural: "elettricisti",
    titleTag: "Preventivo Elettricista Online | prevai – AI in 30s",
    metaDescription: "Software preventivi per elettricisti: impianti, quadri, cablaggio in 30 secondi. AI per elettricisti italiani. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Elettricisti",
    intro: "Ogni lavoro elettrico richiede un preventivo dettagliato: impianto, quadro elettrico, punti luce, prese, cablaggio dati. prevai capisce la terminologia tecnica degli elettricisti e genera un documento professionale con computo metrico, unità di misura e prezzi. Dal piccolo intervento domestico all'impianto industriale, in 30 secondi.",
    benefits: [
      { title: "Terminologia tecnica integrata", desc: "L'AI riconosce cavi FG16OR16, differenziali, interruttori magnetotermici, punti luce e prese. Scrivi come parli con i tuoi fornitori." },
      { title: "Computo metrico professionale", desc: "Il preventivo include metri di cavo, numero di punti luce, ore di manodopera e materiali. Un documento che ogni committente capisce." },
      { title: "Più preventivi, più lavori vinti", desc: "Chi risponde prima vince il lavoro. Con prevai mandi il preventivo mentre sei ancora dal cliente." },
      { title: "Storico clienti e lavori", desc: "Archivia tutti i preventivi per cliente. Hai subito a disposizione lo storico dei lavori per ogni committente." },
    ],
    useCases: ["Rifacimento impianto elettrico civile", "Installazione quadro elettrico e differenziali", "Impianti fotovoltaici e colonnine EV", "Cablaggio dati e impianti domotici", "Impianti industriali e capannoni", "Messa a norma impianti datati"],
    jsonLdDescription: "Software di preventivazione AI per elettricisti italiani.",
  },
  idraulico: {
    slug: "idraulico",
    label: "Idraulico",
    labelPlural: "idraulici",
    titleTag: "Preventivo Idraulico Online | prevai – AI in 30s",
    metaDescription: "Crea preventivi per impianti idraulici e termici in 30 secondi. Software AI per idraulici italiani. Niente Excel. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Idraulici",
    intro: "Impianti idrici, termici, sanitari: ogni lavoro idraulico ha voci di costo specifiche difficili da comunicare al cliente. prevai capisce la terminologia tecnica — raccordi, tubazioni, collettori, caldaia, termostato — e genera un preventivo chiaro e professionale in 30 secondi.",
    benefits: [
      { title: "Dal guasto al preventivo in 60 secondi", desc: "Sei ancora a casa del cliente quando il guasto è risolto? Genera subito il preventivo per il prossimo lavoro." },
      { title: "Prezzi per impianti e materiali", desc: "L'AI suggerisce prezzi tipici per tubi in rame, raccordi, valvole, caldaie a condensazione e lavori sanitari nel mercato italiano." },
      { title: "Preventivi multi-voce chiari", desc: "Ogni intervento diviso in voci: manodopera, materiali, smaltimento. Il cliente vede la trasparenza e si fida." },
      { title: "Risposta rapida", desc: "Invia il PDF via WhatsApp o email. Il cliente può approvarlo direttamente dal telefono prima dell'intervento." },
    ],
    useCases: ["Sostituzione caldaia a condensazione", "Rifacimento impianto idrico appartamento", "Installazione impianti radianti a pavimento", "Interventi su scarichi e fognature", "Manutenzione impianti termici", "Installazione sanitari e rubinetteria"],
    jsonLdDescription: "Software di preventivazione AI per idraulici italiani.",
  },
  edilizia: {
    slug: "edilizia",
    label: "Impresa Edile",
    labelPlural: "imprese edili",
    titleTag: "Preventivi per Imprese Edili | prevai – AI in 30s",
    metaDescription: "Software preventivi per imprese edili: muratura, fondazioni, finiture. Computo metrico AI in 30 secondi. Per PMI italiane.",
    h1: "Preventivi per",
    h1Highlight: "Imprese Edili",
    intro: "Un'impresa edile gestisce cantieri con decine di voci di costo: muratura, fondazioni, solai, intonaci, finiture. Creare un computo metrico corretto richiede ore. Con prevai descrivi il cantiere in linguaggio naturale e l'AI genera un preventivo strutturato con capitoli, voci, quantità e prezzi.",
    benefits: [
      { title: "Computo metrico multi-capitolo", desc: "Preventivi organizzati in capitoli con Quadro Sintetico e Computo Dettagliato. Standard professionale cantieristico." },
      { title: "Logo aziendale e intestazione", desc: "Ogni preventivo riporta il tuo logo, partita IVA, indirizzo e contatti. Il documento rispecchia l'identità della tua impresa." },
      { title: "Riduzione tempi amministrativi", desc: "Meno tempo su scartoffie, più tempo in cantiere. prevai taglia del 90% il tempo speso nella preparazione dei preventivi." },
      { title: "Gestione clienti PMI", desc: "Dashboard con tutti i preventivi, stato avanzamento e storico clienti. Un sistema gestionale leggero per la tua impresa." },
    ],
    useCases: ["Costruzione ville e abitazioni unifamiliari", "Ristrutturazione edifici residenziali e commerciali", "Opere di muratura e strutture in c.a.", "Intonacatura e finiture interne ed esterne", "Consolidamento e risanamento strutturale", "Demolizioni e smaltimento macerie"],
    jsonLdDescription: "Software di preventivazione AI per imprese edili italiane.",
  },
  ristrutturazione: {
    slug: "ristrutturazione",
    label: "Ristrutturazione",
    labelPlural: "ristrutturatori",
    titleTag: "Preventivo Ristrutturazione Casa | prevai – AI",
    metaDescription: "Preventivi per ristrutturazioni complete in 30 secondi. AI per geometri, imprese e artigiani del settore ristrutturazione in Italia.",
    h1: "Preventivi per",
    h1Highlight: "Ristrutturazioni",
    intro: "Una ristrutturazione coinvolge più categorie di lavori: demolizioni, muratura, impianti, finiture, serramenti. Coordinare tutto in un unico preventivo è complesso. prevai aggrega tutte le voci in un documento multi-capitolo strutturato, con Quadro Sintetico e Computo Dettagliato.",
    benefits: [
      { title: "Preventivo multi-categoria", desc: "Un solo documento per tutti i lavori: demolizioni, impianti elettrici, idraulici, pavimenti, tinteggiatura. Tutto organizzato in capitoli." },
      { title: "Bonus edilizi e detrazioni", desc: "Menziona nel testo se il lavoro rientra in Superbonus o Bonus Ristrutturazioni e l'AI include le note fiscali nel documento." },
      { title: "Trasparenza verso il cliente", desc: "Il cliente vede ogni voce di costo. La trasparenza riduce le contestazioni e accelera la firma del contratto." },
      { title: "Aggiornamento preventivi", desc: "Se il committente chiede varianti, modifica il preventivo in pochi secondi e invia il documento aggiornato." },
    ],
    useCases: ["Ristrutturazione completa appartamenti e ville", "Rifacimento bagni con ceramiche e sanitari", "Sostituzione pavimenti e rivestimenti", "Cambio infissi e serramenti esterni", "Interventi per Bonus Ristrutturazioni e Superbonus", "Ristrutturazione uffici e spazi commerciali"],
    jsonLdDescription: "Software di preventivazione AI per ristrutturazioni in Italia.",
  },
  carpentiere: {
    slug: "carpentiere",
    label: "Carpentiere",
    labelPlural: "carpentieri",
    titleTag: "Preventivo Carpentiere e Fabbro | prevai – AI",
    metaDescription: "Preventivi per carpenteria metallica e falegnameria in 30 secondi. Software AI per carpentieri e fabbri italiani. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Carpentieri",
    intro: "Cancelli, recinzioni, strutture metalliche, pensiline, scale: ogni lavoro di carpenteria ha misure precise e materiali specifici. prevai calcola i kg di ferro, i metri lineari di profilato e le ore di saldatura partendo da una semplice descrizione testuale.",
    benefits: [
      { title: "Calcolo materiali automatico", desc: "Descrivi la struttura e l'AI stima kg di ferro, lamiera, profilati e viti. Preventivo più accurato, meno sprechi." },
      { title: "Voci separate: materiali e manodopera", desc: "Il documento distingue chiaramente il costo dei materiali dalle ore di lavorazione. Trasparenza totale verso il cliente." },
      { title: "Professionalità immediata", desc: "Un preventivo ordinato e firmato vale più di uno scritto a mano. Aumenta la percezione di qualità del tuo lavoro." },
      { title: "Velocità di risposta", desc: "Manda il preventivo prima della concorrenza. Chi arriva primo spesso vince il lavoro." },
    ],
    useCases: ["Cancelli e recinzioni in ferro e acciaio", "Strutture metalliche e capriati", "Pensiline e tettoie in ferro", "Scale interne ed esterne in ferro", "Balconi e ringhiere in acciaio inox", "Soppalchi e strutture industriali"],
    jsonLdDescription: "Software di preventivazione AI per carpentieri e fabbri italiani.",
  },
  falegname: {
    slug: "falegname",
    label: "Falegname",
    labelPlural: "falegnami",
    titleTag: "Preventivo Falegname e Mobilificio | prevai – AI",
    metaDescription: "Crea preventivi per falegnameria, mobili su misura e serramenti in 30 secondi. Software AI per falegnami italiani. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Falegnami",
    intro: "Armadi su misura, cucine, serramenti, pavimenti in legno: il preventivo di un falegname deve spiegare materiali, essenze, finiture e ore di lavorazione. prevai capisce la terminologia del legno — rovere, abete, essenza laccata, bordo ABS — e genera un documento professionale in 30 secondi.",
    benefits: [
      { title: "Terminologia del legno integrata", desc: "L'AI riconosce essenze, finiture, spessori e sistemi di montaggio. Scrivi come parli con i tuoi fornitori." },
      { title: "Voci per materiale e lavorazione", desc: "Pannelli, bordi, cerniere, binari cassetti, ore di falegnameria: ogni voce separata per massima chiarezza." },
      { title: "Immagine professionale", desc: "Un preventivo ben strutturato vale più di mille parole. Il cliente percepisce qualità ancor prima di vedere il lavoro finito." },
      { title: "Meno tempo in ufficio, più in officina", desc: "Riduzione drastica dei tempi amministrativi. Ogni ora risparmiata sul preventivo è un'ora in più di produzione." },
    ],
    useCases: ["Armadi e cabine armadio su misura", "Cucine in legno massello e laminato", "Serramenti in legno e legno-alluminio", "Pavimenti in parquet e listoni di legno", "Porte interne su misura", "Arredamento bagno e librerie su misura"],
    jsonLdDescription: "Software di preventivazione AI per falegnami italiani.",
  },
  termoidraulico: {
    slug: "termoidraulico",
    label: "Termoidraulico",
    labelPlural: "termoidraulici",
    titleTag: "Preventivo Termoidraulico Online | prevai – AI",
    metaDescription: "Software preventivi per termoidraulici: caldaie, climatizzatori, pavimento radiante. AI in 30 secondi. Per professionisti italiani.",
    h1: "Preventivi per",
    h1Highlight: "Termoidraulici",
    intro: "L'installazione di un impianto di riscaldamento o raffrescamento richiede un preventivo dettagliato: caldaia, collettori, tubazioni, radiatori o pannelli radianti, valvole termostatiche, collaudo. prevai gestisce tutta la complessità termotecnica e genera un documento professionale in 30 secondi.",
    benefits: [
      { title: "Impianti complessi semplificati", desc: "Caldaia a condensazione, impianto radiante, split e VMC: ogni sistema ha le sue voci. prevai le organizza automaticamente." },
      { title: "Prezzi aggiornati al mercato", desc: "L'AI suggerisce prezzi tipici per caldaie, pompe di calore e impianti radianti nel mercato italiano. Modificabili in un clic." },
      { title: "Documentazione per detrazioni fiscali", desc: "I clienti spesso chiedono il preventivo per la pratica Ecobonus o Conto Termico. Il documento prevai è adatto allo scopo." },
      { title: "Risposta rapida, più lavori", desc: "Chi manda il preventivo per primo ha un vantaggio competitivo enorme. Con prevai lo mandi in 2 minuti dall'ispezione." },
    ],
    useCases: ["Installazione caldaie a condensazione e pompe di calore", "Impianti di riscaldamento a pavimento radiante", "Climatizzatori e impianti di raffrescamento", "Sostituzione radiatori e corpi scaldanti", "Impianti solari termici", "Manutenzione impianti termici e caldaie"],
    jsonLdDescription: "Software di preventivazione AI per termoidraulici italiani.",
  },
  freelance: {
    slug: "freelance",
    label: "Freelance",
    labelPlural: "freelance e consulenti",
    titleTag: "Preventivo per Freelance e Consulenti | prevai",
    metaDescription: "Crea preventivi professionali per consulenza, marketing, design e IT in 30 secondi. Software AI per freelance italiani. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Freelance",
    intro: "Come freelance, ogni proposta commerciale è un'occasione per trasmettere professionalità. Un preventivo ben strutturato fa la differenza tra un cliente che accetta e uno che passa al concorrente. prevai genera in 30 secondi una proposta commerciale dettagliata con attività, ore stimate, tariffe e condizioni di pagamento.",
    benefits: [
      { title: "Proposta commerciale professionale", desc: "Non un semplice preventivo: una vera proposta di valore con descrizione delle attività, deliverable e modalità di lavoro." },
      { title: "Tariffe orarie e forfait", desc: "Gestisci sia preventivi a tariffa oraria che a corpo/forfait. L'AI adatta il formato in base alla tipologia di servizio." },
      { title: "Condizioni di pagamento chiare", desc: "Specifica acconto, milestone e saldo. Riduci i ritardi nei pagamenti con termini scritti e firmati dal cliente." },
      { title: "Immagine da professionista", desc: "Un documento con il tuo logo e intestazione trasmette serietà. Il cliente ti percepisce come un partner affidabile." },
    ],
    useCases: ["Web developer e sviluppatori software", "Designer grafici e UX/UI designer", "Consulenti di marketing e SEO", "Copywriter e content creator", "Fotografi e videomaker professionisti", "Consulenti aziendali e business coach"],
    jsonLdDescription: "Software di preventivazione AI per freelance e consulenti italiani.",
  },
  geometra: {
    slug: "geometra",
    label: "Geometra",
    labelPlural: "geometri",
    titleTag: "Preventivo per Geometri e Studi Tecnici | prevai",
    metaDescription: "Software preventivi per geometri e studi tecnici: perizie, pratiche edilizie, direzione lavori. AI in 30 secondi per professionisti italiani.",
    h1: "Preventivi per",
    h1Highlight: "Geometri",
    intro: "Un geometra offre una gamma ampia di prestazioni professionali: perizie, rilievi, pratiche al catasto, DIA e SCIA, direzione lavori, certificazioni energetiche. Ogni prestazione ha una tariffa professionale diversa. prevai genera preventivi tecnici dettagliati in linea con le prassi degli studi tecnici italiani.",
    benefits: [
      { title: "Onorari professionali strutturati", desc: "Distingui onorario professionale, spese vive e oneri previdenziali. Il documento rispetta le convenzioni dei preventivi di studio tecnico." },
      { title: "Terminologia tecnica corretta", desc: "L'AI conosce il lessico del settore: perizia estimativa, computo metrico estimativo, SCIA, CILA, relazione asseverata." },
      { title: "Più pratiche, stesso tempo", desc: "Genera il preventivo per ogni pratica in pochi secondi. Dedica più tempo alle attività tecniche ad alto valore aggiunto." },
      { title: "Dashboard studio tecnico", desc: "Tutti i preventivi e le pratiche organizzati per cliente. Gestione clienti PMI leggera ma efficace per il tuo studio." },
    ],
    useCases: ["Perizie estimative e relazioni di stima", "Pratiche catastali e variazioni planimetriche", "SCIA, CILA e pratiche edilizie", "Direzione lavori e contabilità di cantiere", "APE – Attestati di Prestazione Energetica", "Rilievi topografici e frazionamenti"],
    jsonLdDescription: "Software di preventivazione AI per geometri e studi tecnici italiani.",
  },
};

export const DEFAULT_SECTOR: SectorData = {
  slug: "professionista",
  label: "Professionista",
  labelPlural: "professionisti",
  titleTag: "Preventivi Online per Professionisti | prevai – AI",
  metaDescription: "Crea preventivi professionali in 30 secondi con l'AI. Software di preventivazione digitale per artigiani, PMI e professionisti italiani. Gratis.",
  h1: "Preventivi per",
  h1Highlight: "Professionisti",
  intro: "prevai è il software di preventivazione con intelligenza artificiale pensato per artigiani, PMI e professionisti italiani. Descrivi il lavoro in linguaggio naturale e ottieni un preventivo professionale completo in 30 secondi.",
  benefits: [
    { title: "Velocità", desc: "30 secondi per un preventivo completo. Mandalo al cliente ancora in cantiere." },
    { title: "Professionalità", desc: "Documento con intestazione, voci dettagliate, IVA e condizioni di pagamento." },
    { title: "Zero errori", desc: "Calcoli automatici. L'AI non sbaglia mai i totali." },
    { title: "Archivio digitale", desc: "Tutti i tuoi preventivi accessibili sempre, da qualsiasi dispositivo." },
  ],
  useCases: ["Artigiani", "Imprese edili", "Imbianchini", "Elettricisti", "Idraulici", "Freelance e consulenti"],
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
  { name: "Forlì", slug: "forli", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["cesena", "rimini", "ravenna", "bologna", "pesaro"] },
  { name: "Cesena", slug: "cesena", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["forli", "rimini", "ravenna", "pesaro", "ancona"] },
  { name: "Rimini", slug: "rimini", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["cesena", "forli", "pesaro", "ravenna", "ancona"] },
  { name: "Piacenza", slug: "piacenza", region: "Emilia-Romagna", regionSlug: "emilia-romagna", nearbySlug: ["parma", "cremona", "pavia", "lodi", "reggio-emilia"] },
  // Friuli-Venezia Giulia
  { name: "Trieste", slug: "trieste", region: "Friuli-Venezia Giulia", regionSlug: "friuli-venezia-giulia", nearbySlug: ["gorizia", "udine", "pordenone", "treviso", "venezia"] },
  { name: "Udine", slug: "udine", region: "Friuli-Venezia Giulia", regionSlug: "friuli-venezia-giulia", nearbySlug: ["trieste", "pordenone", "gorizia", "treviso", "belluno"] },
  { name: "Pordenone", slug: "pordenone", region: "Friuli-Venezia Giulia", regionSlug: "friuli-venezia-giulia", nearbySlug: ["udine", "trieste", "treviso", "venezia", "belluno"] },
  { name: "Gorizia", slug: "gorizia", region: "Friuli-Venezia Giulia", regionSlug: "friuli-venezia-giulia", nearbySlug: ["trieste", "udine", "pordenone", "venezia", "treviso"] },
  // Trentino-Alto Adige
  { name: "Trento", slug: "trento", region: "Trentino-Alto Adige", regionSlug: "trentino-alto-adige", nearbySlug: ["bolzano", "verona", "vicenza", "brescia", "sondrio"] },
  { name: "Bolzano", slug: "bolzano", region: "Trentino-Alto Adige", regionSlug: "trentino-alto-adige", nearbySlug: ["trento", "verona", "brescia", "sondrio", "vicenza"] },
  // Toscana
  { name: "Firenze", slug: "firenze", region: "Toscana", regionSlug: "toscana", nearbySlug: ["prato", "pistoia", "siena", "arezzo", "pisa"] },
  { name: "Arezzo", slug: "arezzo", region: "Toscana", regionSlug: "toscana", nearbySlug: ["firenze", "siena", "perugia", "grosseto", "pisa"] },
  { name: "Grosseto", slug: "grosseto", region: "Toscana", regionSlug: "toscana", nearbySlug: ["siena", "livorno", "pisa", "arezzo", "viterbo"] },
  { name: "Livorno", slug: "livorno", region: "Toscana", regionSlug: "toscana", nearbySlug: ["pisa", "firenze", "grosseto", "la-spezia", "lucca"] },
  { name: "Lucca", slug: "lucca", region: "Toscana", regionSlug: "toscana", nearbySlug: ["pisa", "pistoia", "massa", "la-spezia", "firenze"] },
  { name: "Massa", slug: "massa", region: "Toscana", regionSlug: "toscana", nearbySlug: ["la-spezia", "lucca", "pisa", "livorno", "pistoia"] },
  { name: "Pisa", slug: "pisa", region: "Toscana", regionSlug: "toscana", nearbySlug: ["livorno", "lucca", "firenze", "massa", "la-spezia"] },
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

// Mapping settore → città (usato per sitemap e linking interno)
export const SECTOR_CITIES: Record<string, string[]> = Object.fromEntries(
  Object.keys(SECTORS).map((s) => [s, CITIES.map((c) => c.slug)])
);
