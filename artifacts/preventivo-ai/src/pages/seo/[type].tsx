import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { ArrowRight, CheckCircle2, Clock, FileText, Shield, TrendingUp, Star, Building2 } from "lucide-react";

interface SectorData {
  slug: string;
  titleTag: string;
  metaDescription: string;
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

const SECTORS: Record<string, SectorData> = {
  imbianchino: {
    slug: "imbianchino",
    titleTag: "Preventivo Imbianchino Online | prevai – AI in 30s",
    metaDescription:
      "Crea preventivi per lavori di tinteggiatura e imbiancatura in 30 secondi con l'AI. Software di preventivazione digitale per imbianchini italiani. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Imbianchini",
    intro:
      "Smetti di perdere serate a fare preventivi su Excel o carta. Con prevai descrivi i lavori di tinteggiatura a parole tue — rasatura, due mani di pittura lavabile, rifinitura soffitti — e il motore AI genera un preventivo professionale con descrizioni tecniche, quantità in mq, prezzi unitari e IVA calcolata in automatico. In 30 secondi, dal tuo smartphone.",
    h2Benefits: "Perché gli imbianchini scelgono prevai",
    benefits: [
      {
        title: "Preventivo dal cantiere",
        desc: "Apri prevai dallo smartphone mentre sei ancora dal cliente. Descrivi i lavori in dialogo naturale e ottieni un documento pronto in un minuto.",
      },
      {
        title: "Calcolo mq automatico",
        desc: "L'AI stima le superfici, i litri di vernice e le ore di lavoro in base alla descrizione. Niente più calcoli manuali sbagliati.",
      },
      {
        title: "Documento professionale",
        desc: "Il preventivo include intestazione aziendale, voce per voce con U.M., prezzi unitari, subtotali e IVA. Trasmette fiducia al cliente.",
      },
      {
        title: "Archivio digitale",
        desc: "Tutti i tuoi preventivi salvati e accessibili da qualsiasi dispositivo. Trova subito il documento del cliente senza cercare tra le carte.",
      },
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
    titleTag: "Preventivo Elettricista Online | prevai – AI in 30s",
    metaDescription:
      "Software preventivi per elettricisti: crea offerte per impianti elettrici, quadri, cablaggio in 30 secondi. AI pensata per elettricisti italiani. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Elettricisti",
    intro:
      "Ogni lavoro elettrico richiede un preventivo dettagliato: impianto, quadro elettrico, punti luce, prese, cablaggio dati. prevai capisce la terminologia tecnica degli elettricisti e genera un documento professionale con computo metrico, unità di misura e prezzi. Dal piccolo intervento domestico all'impianto industriale, in 30 secondi.",
    h2Benefits: "Perché gli elettricisti scelgono prevai",
    benefits: [
      {
        title: "Terminologia tecnica integrata",
        desc: "L'AI conosce cavi FG16OR16, quadri elettrici, differenziali, interruttori magnetotermici, punti luce e prese. Niente traduzione: scrivi come parli.",
      },
      {
        title: "Computo metrico professionale",
        desc: "Il preventivo include metri di cavo, numero di punti luce, ore di manodopera e materiali. Un documento che ogni tecnico e committente capisce.",
      },
      {
        title: "Più preventivi, più lavori vinti",
        desc: "Chi risponde prima vince il lavoro. Con prevai mandi il preventivo mentre sei ancora dal cliente. Aumenti il tasso di conversione.",
      },
      {
        title: "Storico clienti e lavori",
        desc: "Archivia tutti i preventivi per cliente. Hai subito a disposizione lo storico dei lavori per ogni committente.",
      },
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
      { q: "Funziona anche per preventivi di grandi impianti industriali?", a: "Sì, prevai supporta preventivi multi-capitolo (Computo Metrico Dettagliato) ideali per impianti complessi con molte voci." },
    ],
    jsonLdDescription: "Software di preventivazione AI per elettricisti italiani. Genera preventivi per impianti elettrici in 30 secondi.",
  },

  idraulico: {
    slug: "idraulico",
    titleTag: "Preventivo Idraulico Online | prevai – AI in 30s",
    metaDescription:
      "Crea preventivi per impianti idraulici, termici e sanitari in 30 secondi. Software AI per idraulici e termoidraulici italiani. Niente Excel. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Idraulici",
    intro:
      "Impianti idrici, termici, sanitari: ogni lavoro idraulico ha voci di costo specifiche e difficili da comunicare al cliente. prevai capisce la terminologia tecnica — raccordi, tubazioni, collettori, caldaia, termostato — e genera un preventivo chiaro e professionale in 30 secondi. Il cliente capisce cosa paga, tu vinci più lavori.",
    h2Benefits: "Perché gli idraulici scelgono prevai",
    benefits: [
      {
        title: "Dal guasto al preventivo in 60 secondi",
        desc: "Sei ancora a casa del cliente quando il guasto è risolto? Genera subito il preventivo per il preventivo del prossimo lavoro.",
      },
      {
        title: "Prezzi per impianti e materiali",
        desc: "L'AI conosce il costo medio di tubi in rame, raccordi, valvole, caldaie a condensazione e lavori sanitari nel mercato italiano.",
      },
      {
        title: "Preventivi multi-voce chiari",
        desc: "Ogni intervento diviso in voci: manodopera, materiali, smaltimento. Il cliente vede la trasparenza e si fida.",
      },
      {
        title: "Firma digitale e accettazione",
        desc: "Invia il PDF via WhatsApp o email. Il cliente può approvarlo direttamente dal telefono prima dell'intervento.",
      },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi l'intervento", desc: "Scrivi: 'Sostituzione caldaia a condensazione 24kW, smontaggio vecchia caldaia, nuovi raccordi gas e acqua, collaudo impianto'." },
      { step: "2. Il motore AI calcola tutto", desc: "prevai identifica materiali e manodopera, stima i costi e struttura il documento con computo metrico e IVA." },
      { step: "3. Invia e vinci il lavoro", desc: "PDF professionale con il tuo logo. Il cliente lo riceve in un minuto e risponde subito." },
    ],
    h2UseCases: "Lavori tipici per idraulici",
    useCases: [
      "Sostituzione caldaia a condensazione",
      "Rifacimento impianto idrico appartamento",
      "Installazione impianti radianti a pavimento",
      "Interventi su scarichi e fognature",
      "Manutenzione e collaudo impianti termici",
      "Installazione sanitari e rubinetteria",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso fare un preventivo per urgenze anche dal telefono?", a: "Sì. prevai è ottimizzato per mobile. In 30 secondi hai un preventivo professionale anche in emergenza." },
      { q: "Come gestisco i preventivi non accettati?", a: "prevai archivia tutti i preventivi con stato (bozza, accettato). Puoi ricontattare i clienti che non hanno ancora risposto." },
      { q: "Funziona per piccole riparazioni e per grandi impianti?", a: "Sì, sia per piccoli interventi (sostituzione rubinetto) che per impianti complessi multi-capitolo (rifacimento impianto condominiale)." },
    ],
    jsonLdDescription: "Software di preventivazione AI per idraulici italiani. Genera preventivi per impianti idraulici e termici in 30 secondi.",
  },

  edilizia: {
    slug: "edilizia",
    titleTag: "Preventivi per Imprese Edili | prevai – AI in 30s",
    metaDescription:
      "Software preventivi per imprese edili: muratura, fondazioni, strutture, finiture. Computo metrico AI in 30 secondi. Per PMI italiane del settore edile.",
    h1: "Preventivi per",
    h1Highlight: "Imprese Edili",
    intro:
      "Un'impresa edile gestisce cantieri con decine di voci di costo: muratura, fondazioni, solai, intonaci, finiture. Creare un computo metrico corretto richiede ore. Con prevai descrivi il cantiere in linguaggio naturale e l'AI genera un preventivo strutturato con capitoli, voci, quantità e prezzi. Quello che prima richiedeva una serata, ora richiede 30 secondi.",
    h2Benefits: "Perché le imprese edili scelgono prevai",
    benefits: [
      {
        title: "Computo metrico multi-capitolo",
        desc: "Preventivi organizzati in capitoli (Fondazioni, Murature, Finiture) con Quadro Sintetico e Computo Dettagliato. Standard professionale cantieristico.",
      },
      {
        title: "Logo aziendale e intestazione",
        desc: "Ogni preventivo riporta il tuo logo, partita IVA, indirizzo e contatti. Il documento rispecchia l'identità della tua impresa.",
      },
      {
        title: "Riduzione tempi amministrativi",
        desc: "Meno tempo su scartoffie, più tempo in cantiere. prevai taglia del 90% il tempo speso nella preparazione dei preventivi.",
      },
      {
        title: "Gestione clienti PMI",
        desc: "Dashboard con tutti i preventivi, stato avanzamento e storico clienti. Un sistema gestionale leggero per la tua impresa.",
      },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi il cantiere", desc: "Scrivi: 'Costruzione villetta bifamiliare 120mq: fondazioni in cls armato, muratura portante, solaio latero-cemento, intonaco civile interno ed esterno'." },
      { step: "2. L'AI genera il computo", desc: "prevai struttura il preventivo in capitoli con tutte le voci, le unità di misura (mq, mc, ml) e i prezzi unitari." },
      { step: "3. PDF professionale pronto", desc: "Scarica il documento con Quadro Sintetico e Computo Dettagliato. Pronto per essere allegato all'offerta commerciale." },
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
      { q: "prevai è adatto per imprese edili con più dipendenti?", a: "Sì, il piano Pro (79€/mese) offre preventivi illimitati per tutte le commesse dell'impresa, indipendentemente dal numero di cantieri aperti." },
      { q: "Posso allegare planimetrie o file al preventivo?", a: "Il PDF generato contiene il computo metrico completo. Per allegare planimetrie puoi unirlo ad altri documenti con qualsiasi PDF editor." },
      { q: "I prezzi suggeriti sono aggiornati al mercato italiano?", a: "L'AI si basa su prezzi tipici del mercato edile italiano. Puoi sempre modificare ogni voce per adattarla al tuo prezzario o al capitolato richiesto." },
    ],
    jsonLdDescription: "Software di preventivazione AI per imprese edili italiane. Genera computi metrici e preventivi per cantieri in 30 secondi.",
  },

  ristrutturazione: {
    slug: "ristrutturazione",
    titleTag: "Preventivo Ristrutturazione Casa | prevai – AI",
    metaDescription:
      "Preventivi per ristrutturazioni complete in 30 secondi. AI pensata per geometri, imprese e artigiani del settore ristrutturazione in Italia. Provalo gratis.",
    h1: "Preventivi per",
    h1Highlight: "Ristrutturazioni",
    intro:
      "Una ristrutturazione coinvolge più categorie di lavori: demolizioni, muratura, impianti, finiture, serramenti. Coordinare tutto in un unico preventivo è complesso. prevai aggrega tutte le voci in un documento multi-capitolo strutturato, con Quadro Sintetico e Computo Dettagliato, che il cliente può confrontare con altri preventivi. Professionale, preciso, in 30 secondi.",
    h2Benefits: "Perché scegliere prevai per le ristrutturazioni",
    benefits: [
      {
        title: "Preventivo multi-categoria",
        desc: "Un solo documento per tutti i lavori: demolizioni, impianti elettrici, idraulici, pavimenti, tinteggiatura. Tutto organizzato in capitoli.",
      },
      {
        title: "Bonus edilizi e detrazioni",
        desc: "Menziona nel testo se il lavoro rientra in Superbonus, Bonus Ristrutturazioni o Ecobonus e l'AI include le note fiscali nel documento.",
      },
      {
        title: "Trasparenza verso il cliente",
        desc: "Il cliente vede ogni voce di costo. La trasparenza riduce le contestazioni e accelera la firma del contratto.",
      },
      {
        title: "Aggiornamento preventivi",
        desc: "Se il committente chiede varianti, modifica il preventivo in pochi secondi e invia il documento aggiornato.",
      },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi la ristrutturazione", desc: "Scrivi: 'Ristrutturazione appartamento 80mq: demolizione tramezzi, nuovo impianto elettrico e idraulico, pavimento in gres, tinteggiatura, infissi in PVC'." },
      { step: "2. L'AI organizza tutto", desc: "prevai divide il lavoro in capitoli tematici con voci dettagliate, quantità stimate e prezzi di mercato." },
      { step: "3. Documento professionale", desc: "PDF con intestazione, Quadro Sintetico e Computo Dettagliato. Allegalo al contratto d'appalto o alla richiesta di bonus fiscale." },
    ],
    h2UseCases: "Interventi di ristrutturazione tipici",
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
    jsonLdDescription: "Software di preventivazione AI per ristrutturazioni residenziali e commerciali in Italia. Preventivi multi-capitolo in 30 secondi.",
  },

  carpentiere: {
    slug: "carpentiere",
    titleTag: "Preventivo Carpentiere e Fabbro | prevai – AI",
    metaDescription:
      "Preventivi per lavori di carpenteria metallica e falegnameria in 30 secondi. Software AI per carpentieri e fabbri italiani. Provalo gratis senza carta di credito.",
    h1: "Preventivi per",
    h1Highlight: "Carpentieri",
    intro:
      "Cancelli, recinzioni, strutture metalliche, pensiline, scale: ogni lavoro di carpenteria ha misure precise e materiali specifici. prevai calcola i kg di ferro, i metri lineari di profilato e le ore di saldatura partendo da una descrizione testuale. Il preventivo che prima facevi a mano in un'ora, ora è pronto in 30 secondi.",
    h2Benefits: "Perché i carpentieri scelgono prevai",
    benefits: [
      {
        title: "Calcolo materiali automatico",
        desc: "Descrivi la struttura e l'AI stima kg di ferro, lamiera, profilati e viti. Margine di errore ridotto, preventivo più accurato.",
      },
      {
        title: "Voci separate: materiali e manodopera",
        desc: "Il documento distingue chiaramente il costo dei materiali dalle ore di lavorazione. Trasparenza totale verso il cliente.",
      },
      {
        title: "Professionalità immediata",
        desc: "Un preventivo ordinato e firmato vale più di uno scritto a mano. Aumenta la percezione di qualità del tuo lavoro.",
      },
      {
        title: "Velocità di risposta",
        desc: "Manda il preventivo prima della concorrenza. Chi arriva primo spesso vince il lavoro.",
      },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi la lavorazione", desc: "Scrivi: 'Cancello scorrevole in ferro zincato 4x2m, motore automazione incluso, n.2 pilastri in ferro 10x10 murati, verniciatura grigio antracite'." },
      { step: "2. L'AI calcola i costi", desc: "prevai identifica materiali, quantità, ore di saldatura e verniciatura. Genera un preventivo strutturato con tutte le voci." },
      { step: "3. PDF professionale", desc: "Documento con il tuo logo e partita IVA. Invialo via WhatsApp al cliente in 2 minuti dall'ispezione." },
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
    jsonLdDescription: "Software di preventivazione AI per carpentieri e fabbri italiani. Preventivi per strutture metalliche in 30 secondi.",
  },

  falegname: {
    slug: "falegname",
    titleTag: "Preventivo Falegname e Mobilificio | prevai – AI",
    metaDescription:
      "Crea preventivi per lavori di falegnameria, mobili su misura e serramenti in 30 secondi. Software AI per falegnami italiani. Provalo gratis.",
    h1: "Preventivi per",
    h1Highlight: "Falegnami",
    intro:
      "Armadi su misura, cucine, serramenti, pavimenti in legno: il preventivo di un falegname deve spiegare materiali, essenze, finiture e ore di lavorazione. prevai capisce la terminologia del legno — rovere, abete, essenza laccata, bordo ABS — e genera un documento che vale quanto una presentazione commerciale. In 30 secondi.",
    h2Benefits: "Perché i falegnami scelgono prevai",
    benefits: [
      {
        title: "Terminologia del legno integrata",
        desc: "L'AI riconosce essenze, finiture, spessori e sistemi di montaggio. Scrivi come parli con i tuoi fornitori.",
      },
      {
        title: "Voci per materiale e lavorazione",
        desc: "Pannelli, bordi, cerniere, binari cassetti, ore di falegnameria: ogni voce separata per massima chiarezza.",
      },
      {
        title: "Immagine professionale",
        desc: "Un preventivo ben strutturato vale più di mille parole. Il cliente percepisce qualità ancor prima di vedere il lavoro finito.",
      },
      {
        title: "Meno tempo in ufficio, più in officina",
        desc: "Riduzione drastica dei tempi amministrativi. Ogni ora risparmiata sul preventivo è un'ora in più di produzione.",
      },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi il mobile o il lavoro", desc: "Scrivi: 'Armadio guardaroba su misura 3m x 2,4m in laminato bianco lucido, 4 ante scorrevoli con specchio, interni con cassettiere e ripiani regolabili'." },
      { step: "2. L'AI struttura il preventivo", desc: "prevai separa i materiali (pannelli, bordi, accessori) dalla manodopera (taglio, montaggio, finitura) con prezzi e quantità." },
      { step: "3. PDF con il tuo brand", desc: "Documento professionale con intestazione della tua falegnameria. Il cliente lo conserva e lo confronta con fiducia." },
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
    jsonLdDescription: "Software di preventivazione AI per falegnami italiani. Preventivi per mobili su misura e serramenti in 30 secondi.",
  },

  termoidraulico: {
    slug: "termoidraulico",
    titleTag: "Preventivo Termoidraulico Online | prevai – AI",
    metaDescription:
      "Software preventivi per termoidraulici: impianti di riscaldamento, caldaie, climatizzatori, pavimento radiante. AI in 30 secondi. Per professionisti italiani.",
    h1: "Preventivi per",
    h1Highlight: "Termoidraulici",
    intro:
      "L'installazione di un impianto di riscaldamento o raffrescamento richiede un preventivo dettagliato: caldaia, collettori, tubazioni, radiatori o pannelli radianti, valvole termostatiche, collaudo. prevai gestisce tutta la complessità termotecnica e genera un documento professionale in 30 secondi, con voci separate per impianto termico e idraulico.",
    h2Benefits: "Perché i termoidraulici scelgono prevai",
    benefits: [
      {
        title: "Impianti complessi semplificati",
        desc: "Caldaia a condensazione, impianto radiante, split e VMC: ogni sistema ha le sue voci. prevai le organizza automaticamente.",
      },
      {
        title: "Prezzi aggiornati al mercato",
        desc: "L'AI suggerisce prezzi tipici per caldaie, pompe di calore e impianti radianti nel mercato italiano. Modificabili in un clic.",
      },
      {
        title: "Documentazione per detrazioni fiscali",
        desc: "I clienti spesso chiedono il preventivo per la pratica Ecobonus o Conto Termico. Il documento prevai è adatto allo scopo.",
      },
      {
        title: "Risposta rapida, più lavori",
        desc: "Chi manda il preventivo per primo ha un vantaggio competitivo enorme. Con prevai lo mandi in 2 minuti dall'ispezione.",
      },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi l'impianto", desc: "Scrivi: 'Sostituzione caldaia con pompa di calore aria-acqua 12kW, 8 radiatori in alluminio, 3 valvole termostatiche, collaudo e attestato di efficienza'." },
      { step: "2. L'AI calcola il preventivo", desc: "prevai genera le voci per apparecchiature, tubazioni, raccordi e manodopera con subtotali e IVA al 10% o 22%." },
      { step: "3. PDF professionale in un clic", desc: "Invia il documento via email o WhatsApp. Il cliente lo usa anche per la pratica di finanziamento o detraibilità fiscale." },
    ],
    h2UseCases: "Lavori tipici per termoidraulici",
    useCases: [
      "Installazione caldaie a condensazione e pompe di calore",
      "Impianti di riscaldamento a pavimento radiante",
      "Climatizzatori e impianti di raffrescamento",
      "Sostituzione radiatori e corpi scaldanti",
      "Impianti solari termici e fotovoltaici ibridi",
      "Manutenzione ordinaria e straordinaria impianti termici",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso indicare l'aliquota IVA ridotta al 10% per impianti residenziali?", a: "Sì. Nel testo specifica che si tratta di abitazione principale e prevai applicherà l'aliquota IVA corretta al documento." },
      { q: "Come gestisco i preventivi con fornitura e posa?", a: "prevai separa automaticamente i costi di fornitura materiali dai costi di posa e manodopera, come richiesto per le detrazioni fiscali." },
      { q: "Funziona per la manutenzione annuale degli impianti?", a: "Sì, perfetto anche per piccoli interventi di manutenzione periodica, con possibilità di creare preventivi ricorrenti simili in pochi secondi." },
    ],
    jsonLdDescription: "Software di preventivazione AI per termoidraulici italiani. Preventivi per impianti termici e idraulici in 30 secondi.",
  },

  freelance: {
    slug: "freelance",
    titleTag: "Preventivo per Freelance e Consulenti | prevai",
    metaDescription:
      "Crea preventivi professionali per servizi di consulenza, marketing, design e IT in 30 secondi. Software AI per freelance italiani. Prova gratis.",
    h1: "Preventivi per",
    h1Highlight: "Freelance",
    intro:
      "Come freelance, ogni proposta commerciale è un'occasione per trasmettere professionalità. Un preventivo ben strutturato fa la differenza tra un cliente che accetta e uno che passa al concorrente. prevai genera in 30 secondi una proposta commerciale dettagliata con descrizione delle attività, ore stimate, tariffe e condizioni di pagamento. Per consulenti, designer, sviluppatori e professionisti di ogni settore.",
    h2Benefits: "Perché i freelance scelgono prevai",
    benefits: [
      {
        title: "Proposta commerciale professionale",
        desc: "Non un semplice preventivo: una vera proposta di valore con descrizione delle attività, deliverable e modalità di lavoro.",
      },
      {
        title: "Tariffe orarie e forfait",
        desc: "Gestisci sia preventivi a tariffa oraria che a corpo/forfait. L'AI adatta il formato in base alla tipologia di servizio.",
      },
      {
        title: "Condizioni di pagamento chiare",
        desc: "Specifica acconto, milestone e saldo. Riduci i ritardi nei pagamenti con termini scritti e firmati dal cliente.",
      },
      {
        title: "Immagine da professionista",
        desc: "Un documento con il tuo logo e intestazione trasmette serietà. Il cliente ti percepisce come un partner affidabile.",
      },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi il progetto", desc: "Scrivi: 'Sviluppo sito web aziendale in WordPress: design grafico personalizzato, 8 pagine, SEO base, formazione cliente, 3 mesi di supporto inclusi'." },
      { step: "2. L'AI struttura la proposta", desc: "prevai divide il progetto in fasi con ore stimate, tariffe e deliverable. Aggiunge automaticamente le condizioni di pagamento." },
      { step: "3. Invia e chiudi il contratto", desc: "PDF professionale con il tuo brand. Il cliente firma digitalmente e hai conferma del lavoro." },
    ],
    h2UseCases: "Profili freelance che usano prevai",
    useCases: [
      "Web developer e sviluppatori software",
      "Designer grafici e UX/UI designer",
      "Consulenti di marketing e SEO",
      "Copywriter e content creator",
      "Fotografi e videomaker professionisti",
      "Consulenti aziendali e coach",
    ],
    h2Faq: "Domande frequenti",
    faq: [
      { q: "Posso usarlo anche senza partita IVA?", a: "Sì. prevai funziona anche per chi emette ricevute fiscali o è in regime forfettario. Puoi personalizzare la sezione fiscale del documento." },
      { q: "Come gestisco preventivi in inglese per clienti esteri?", a: "Al momento prevai genera documenti in italiano. Per clienti esteri puoi modificare manualmente le sezioni o contattarci per supporto." },
      { q: "Posso allegare un portfolio o case study al preventivo?", a: "Il preventivo PDF si integra facilmente con altri documenti. Puoi unirlo al tuo portfolio in un unico file da inviare al cliente." },
    ],
    jsonLdDescription: "Software di preventivazione AI per freelance e consulenti italiani. Preventivi professionali per servizi di consulenza in 30 secondi.",
  },

  geometra: {
    slug: "geometra",
    titleTag: "Preventivo per Geometri e Studi Tecnici | prevai",
    metaDescription:
      "Software preventivi per geometri e studi tecnici: perizie, pratiche edilizie, direzione lavori, rilievi. AI in 30 secondi. Per professionisti tecnici italiani.",
    h1: "Preventivi per",
    h1Highlight: "Geometri",
    intro:
      "Un geometra offre una gamma ampia di prestazioni professionali: perizie, rilievi, pratiche al catasto, DIA e SCIA, direzione lavori, certificazioni energetiche. Ogni prestazione ha una tariffa professionale diversa. prevai genera preventivi tecnici dettagliati con descrizione delle attività, onorari e spese, in linea con le prassi professionali degli studi tecnici italiani.",
    h2Benefits: "Perché i geometri scelgono prevai",
    benefits: [
      {
        title: "Onorari professionali strutturati",
        desc: "Distingui onorario professionale, spese vive e oneri previdenziali. Il documento rispetta le convenzioni dei preventivi di studio tecnico.",
      },
      {
        title: "Terminologia tecnica corretta",
        desc: "L'AI conosce il lessico del settore: perizia estimativa, computo metrico estimativo, relazione tecnica asseverata, SCIA, CILA.",
      },
      {
        title: "Più pratiche, stesso tempo",
        desc: "Genera il preventivo per ogni pratica in pochi secondi. Dedica più tempo alle attività tecniche ad alto valore aggiunto.",
      },
      {
        title: "Dashboard studio tecnico",
        desc: "Tutti i preventivi e le pratiche organizzati per cliente. Una gestione clienti PMI leggera ma efficace per il tuo studio.",
      },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi la prestazione", desc: "Scrivi: 'Perizia estimativa immobile residenziale 120mq, visura catastale, planimetria, relazione tecnica estimativa, due sopralluoghi inclusi'." },
      { step: "2. L'AI struttura il preventivo", desc: "prevai genera le voci per onorario, rimborso spese e oneri previdenziali con IVA professionale (22%)." },
      { step: "3. PDF per il cliente", desc: "Documento professionale da allegare all'incarico professionale. Il cliente firma e autorizzi l'avvio delle pratiche." },
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
    jsonLdDescription: "Software di preventivazione AI per geometri e studi tecnici italiani. Preventivi per prestazioni professionali tecniche in 30 secondi.",
  },

  muratore: {
    slug: "muratore",
    titleTag: "Preventivo Muratore Online | Offerta Muratura AI – prevai",
    metaDescription: "Crea preventivi per lavori di muratura, fondazioni, demolizioni e opere edili in 30 secondi. Software AI per muratori e imprese edili italiane. Provalo gratis.",
    h1: "Preventivi per",
    h1Highlight: "Muratori",
    intro: "Ogni lavoro di muratura ha voci specifiche: fondazioni, tramezzi, intonaci, massetti, cordoli. Spiegarlo al cliente in modo chiaro richiede tempo. Con prevai descrivi le opere murarie in linguaggio naturale e ottieni un'offerta commerciale strutturata con capitoli, quantità in mc e mq, prezzi unitari e IVA. Dal piccolo intervento di riparazione al cantiere di nuova costruzione, in 30 secondi.",
    h2Benefits: "Perché i muratori scelgono prevai",
    benefits: [
      { title: "Computo metrico professionale", desc: "Voci in mc, mq, ml per murature, fondazioni e intonaci. Il committente vede esattamente cosa paga per ogni lavorazione." },
      { title: "Calcolo manodopera e materiali", desc: "L'AI stima le ore di manodopera e i materiali (mattoni, cemento, sabbia, ferro) in base alla descrizione del lavoro." },
      { title: "Documento valido per appalti", desc: "Il preventivo ha la struttura di un computo metrico estimativo, riconoscibile da committenti privati e pubblici." },
      { title: "Risposta rapida al cliente", desc: "Genera il preventivo dal cantiere in 30 secondi. Chi risponde prima vince spesso il lavoro." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi le opere murarie", desc: "Scrivi: 'Realizzazione tramezzi in laterizio 8cm per 45mq, intonaco civile su pareti interne 80mq, massetto in cls per pavimento 60mq spessore 6cm'." },
      { step: "2. L'AI genera il computo", desc: "prevai struttura il preventivo con voci separate per fondazioni, murature, intonaci e opere accessorie, con quantità e prezzi unitari." },
      { step: "3. PDF pronto per il committente", desc: "Documento professionale con la tua intestazione aziendale. Invialo via email o WhatsApp e aspetta la conferma." },
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
    jsonLdDescription: "Software di preventivazione AI per muratori italiani. Preventivi per lavori di muratura, fondazioni e opere edili in 30 secondi.",
  },

  giardiniere: {
    slug: "giardiniere",
    titleTag: "Preventivo Giardiniere Online | Manutenzione Giardino – prevai",
    metaDescription: "Crea preventivi per giardinaggio, manutenzione giardino e progettazione verde in 30 secondi. Software AI per giardinieri italiani. Provalo gratis.",
    h1: "Preventivi per",
    h1Highlight: "Giardinieri",
    intro: "Taglio erba, potatura siepi, realizzazione aiuole, impianti di irrigazione: ogni servizio di giardinaggio ha un costo difficile da comunicare al cliente. prevai capisce il linguaggio del verde — essenze, mq di prato, ml di siepe — e genera un preventivo professionale con voci dettagliate e prezzi. Dal piccolo giardino privato alla manutenzione di aree condominiali, in 30 secondi.",
    h2Benefits: "Perché i giardinieri scelgono prevai",
    benefits: [
      { title: "Voci per ogni servizio verde", desc: "Taglio erba, potatura, concimazione, trattamenti fitosanitari, impianti irrigazione: ogni servizio con la sua voce e prezzo unitario." },
      { title: "Contratti di manutenzione annuali", desc: "Crea preventivi per abbonamenti di manutenzione mensile o stagionale. Il cliente capisce cosa riceve per ogni intervento." },
      { title: "Dal sopralluogo al preventivo in 2 minuti", desc: "Sei ancora in giardino? Genera l'offerta dallo smartphone e inviala al cliente prima ancora di uscire dal cancello." },
      { title: "Professionalità che fa la differenza", desc: "Un documento strutturato convince più clienti rispetto a un preventivo scritto a mano. Aumenta il tasso di chiusura dei preventivi." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi i lavori in giardino", desc: "Scrivi: 'Manutenzione giardino 500mq: taglio prato ogni 2 settimane, potatura siepe di ligustro 30ml, trattamento antiparassitario piante da frutto, concimazione stagionale'." },
      { step: "2. L'AI calcola tutto", desc: "prevai genera le voci di servizio con frequenza, quantità e prezzi unitari. Calcola automaticamente i totali con IVA." },
      { step: "3. Preventivo professionale pronto", desc: "PDF con la tua intestazione e logo. Il cliente lo conserva come riferimento e autorizza l'avvio dei lavori." },
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
    jsonLdDescription: "Software di preventivazione AI per giardinieri italiani. Preventivi per manutenzione giardino e giardinaggio in 30 secondi.",
  },

  piastrellista: {
    slug: "piastrellista",
    titleTag: "Preventivo Piastrellista | Posa Piastrelle Online – prevai",
    metaDescription: "Crea preventivi per posa piastrelle, gres porcellanato, rivestimenti e mosaici in 30 secondi. Software AI per piastrellisti italiani. Provalo gratis.",
    h1: "Preventivi per",
    h1Highlight: "Piastrellisti",
    intro: "Posa di gres porcellanato, rivestimento bagni, pavimenti in cotto, mosaici: ogni lavoro di piastrellatura ha voci specifiche che i clienti faticano a capire. prevai trasforma la tua descrizione tecnica — formato piastrella, tipo di posa, spessore del massetto, fughe — in un preventivo professionale con mq, prezzi unitari e totali. In 30 secondi, direttamente dal cantiere.",
    h2Benefits: "Perché i piastrellisti scelgono prevai",
    benefits: [
      { title: "Calcolo mq automatico", desc: "Descrivi le superfici e l'AI calcola i mq da posare includendo gli scarti tipici per formato e tipo di posa." },
      { title: "Voci per tipo di materiale", desc: "Gres porcellanato, cotto, marmo, mosaico: ogni materiale con il suo prezzo. Il cliente vede esattamente cosa sta acquistando." },
      { title: "Preparazione del fondo inclusa", desc: "L'AI riconosce le voci accessorie: rasatura, massetto, impermeabilizzazione, rimozione vecchio pavimento. Niente dimenticanze." },
      { title: "Preventivo dal cliente in 60 secondi", desc: "Fai il sopralluogo, descrivi i lavori, invia il PDF. Tutto in meno di due minuti prima di uscire dall'appartamento." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi la posa", desc: "Scrivi: 'Posa gres porcellanato 60x60 in soggiorno 35mq posa sfalsata, rivestimento bagno 15mq fino a soffitto, rimozione vecchio pavimento inclusa'." },
      { step: "2. L'AI struttura le voci", desc: "prevai separa rimozione, preparazione del fondo, materiali e posa con quantità in mq e prezzi unitari per ogni fase." },
      { step: "3. PDF da inviare subito", desc: "Il documento ha la tua intestazione aziendale. Invialo su WhatsApp al cliente per l'approvazione immediata." },
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
      { q: "Come gestisco preventivi con più ambienti?", a: "Descrivi ogni ambiente nel testo ('bagno 8mq, soggiorno 35mq, disimpegno 6mq') e prevai crea voci separate per ciascuno." },
      { q: "Posso usarlo anche per preventivi di rivestimento scale o terrazzi?", a: "Sì. Scale, terrazzi, balconi e facciate rientrano tutti nelle voci che prevai riconosce e quantifica automaticamente." },
    ],
    jsonLdDescription: "Software di preventivazione AI per piastrellisti italiani. Preventivi per posa piastrelle e rivestimenti in 30 secondi.",
  },

  serramentista: {
    slug: "serramentista",
    titleTag: "Preventivo Serramentista | Infissi e Finestre Online – prevai",
    metaDescription: "Crea preventivi per infissi, finestre, porte, portoni e serramenti in PVC, alluminio e legno in 30 secondi. Software AI per serramentisti italiani.",
    h1: "Preventivi per",
    h1Highlight: "Serramentisti",
    intro: "Finestre in PVC, porte blindate, portoni sezionali, infissi in alluminio a taglio termico: ogni prodotto ha caratteristiche tecniche precise che il cliente deve capire per scegliere. prevai traduce le specifiche tecniche dei tuoi serramenti in un preventivo chiaro e professionale con descrizioni, quantità, prezzi e posa inclusa. In 30 secondi, direttamente dallo showroom o dal cantiere.",
    h2Benefits: "Perché i serramentisti scelgono prevai",
    benefits: [
      { title: "Specifiche tecniche nel documento", desc: "Trasmittanza termica, classe acustica, colore RAL, tipo di vetro: prevai include tutte le caratteristiche tecniche che il cliente vuole vedere." },
      { title: "Fornitura e posa separati", desc: "Il preventivo distingue chiaramente il costo del prodotto dalla posa. Trasparenza che genera fiducia e riduce le trattative." },
      { title: "Bonus finestre e Ecobonus", desc: "Se il lavoro rientra nel Bonus Infissi o nell'Ecobonus 50%, includilo nella descrizione e prevai aggiunge le note fiscali." },
      { title: "Da più preventivi a più commesse", desc: "Con prevai rispondi a più richieste nello stesso tempo. Più preventivi inviati = più lavori vinti." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi i serramenti", desc: "Scrivi: '5 finestre PVC bianco a taglio termico 100x140, doppio vetro basso emissivo, 1 porta-finestra 90x210, smontaggio vecchi infissi incluso'." },
      { step: "2. L'AI genera le voci", desc: "prevai crea voci per ogni tipo di serramento con descrizione tecnica, prezzo unitario, quantità e posa. Aggiunge IVA al 10% se residenziale." },
      { step: "3. Preventivo per il Bonus Infissi", desc: "Il documento è strutturato per essere allegato alla pratica del Bonus Infissi o dell'Ecobonus, con la separazione fornitura/posa." },
    ],
    h2UseCases: "Lavori tipici per serramentisti",
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
    jsonLdDescription: "Software di preventivazione AI per serramentisti italiani. Preventivi per infissi, finestre e porte in 30 secondi.",
  },

  tetto: {
    slug: "tetto",
    titleTag: "Preventivo Rifacimento Tetto | Coperture Online – prevai",
    metaDescription: "Crea preventivi per rifacimento tetto, coperture, impermeabilizzazioni e lattonerie in 30 secondi. Software AI per imprese di coperture italiane. Provalo gratis.",
    h1: "Preventivi per",
    h1Highlight: "Coperture e Tetti",
    intro: "Rifacimento del manto di tegole, impermeabilizzazione terrazzo, lattoneria, isolamento: ogni lavoro di copertura ha costi elevati e voci tecniche complesse. Il cliente ha bisogno di un preventivo dettagliato per capire cosa sta pagando. prevai genera un computo metrico professionale per opere di copertura con mq, prezzi unitari e capitoli distinti per materiali e manodopera. In 30 secondi.",
    h2Benefits: "Perché le imprese di coperture scelgono prevai",
    benefits: [
      { title: "Voci tecniche per le coperture", desc: "Tegole marsigliesi, lamiera, guaine bituminose, pannelli sandwich, lattoneria: prevai conosce i materiali e i prezzi di mercato italiani." },
      { title: "Capitoli separati per ogni lavorazione", desc: "Smontaggio vecchio manto, posa isolante, nuova copertura, lattoneria e grondaie: ogni fase nel suo capitolo con costi distinti." },
      { title: "Preventivo per Superbonus e detrazioni", desc: "I lavori di coibentazione del tetto spesso rientrano nel Superbonus o Ecobonus. prevai struttura il documento per supportare la pratica." },
      { title: "Velocità = più lavori", desc: "Chi fa il sopralluogo e manda il preventivo in giornata ha un vantaggio enorme sulla concorrenza. Con prevai ci vuole un minuto." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi la copertura", desc: "Scrivi: 'Rifacimento tetto a falde 180mq: rimozione tegole esistenti, impermeabilizzazione con guaina, nuovo manto in tegole marsigliesi, grondaie e pluviali in rame'." },
      { step: "2. L'AI struttura il computo", desc: "prevai genera i capitoli per demolizione, impermeabilizzazione, copertura e lattoneria con quantità in mq e ml e prezzi unitari di mercato." },
      { step: "3. Documento professionale per il committente", desc: "PDF con Quadro Sintetico e Computo Dettagliato. Allegalo all'offerta commerciale o alla pratica di detrazione fiscale." },
    ],
    h2UseCases: "Lavori tipici per coperture",
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
    jsonLdDescription: "Software di preventivazione AI per imprese di coperture italiane. Preventivi per rifacimento tetti e coperture in 30 secondi.",
  },

  condizionatori: {
    slug: "condizionatori",
    titleTag: "Preventivo Condizionatore e Climatizzatore | prevai – AI",
    metaDescription: "Crea preventivi per installazione condizionatori, climatizzatori, pompe di calore e ventilazione in 30 secondi. Software AI per installatori italiani. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Impianti di Climatizzazione",
    intro: "Installazione split, pompe di calore, VMC, impianti VRF multi-split: ogni lavoro di climatizzazione ha specifiche tecniche precise e costi che cambiano in base alla potenza, alla marca e alla complessità dell'installazione. prevai genera preventivi professionali per impianti di climatizzazione con voci per apparecchiatura, installazione, canalizzazioni e assistenza. In 30 secondi.",
    h2Benefits: "Perché gli installatori di condizionatori scelgono prevai",
    benefits: [
      { title: "Schede tecniche nel preventivo", desc: "Potenza in kW/BTU, classe energetica, marca e modello: ogni apparecchio descritto con le specifiche che il cliente vuole vedere prima di decidere." },
      { title: "Voci per fornitura e installazione", desc: "Il documento separa il costo dell'unità dal lavoro di installazione. Trasparenza che riduce le discussioni sul prezzo." },
      { title: "Ecobonus pompe di calore", desc: "Le pompe di calore aria-acqua rientrano nell'Ecobonus 65%. prevai include le note fiscali se menzioni il tipo di intervento." },
      { title: "Da sopralluogo a preventivo in 2 minuti", desc: "Fai la valutazione tecnica, descrivi i lavori a voce o per scritto e invia il PDF al cliente prima ancora di salire in auto." },
    ],
    h2HowItWorks: "Come funziona: 3 passi",
    howItWorks: [
      { step: "1. Descrivi l'impianto", desc: "Scrivi: 'Installazione climatizzatore dual split 9000+12000 BTU inverter classe A++, unità esterna 5,3kW, canalizzazione 3ml per unità, messa in funzione e collaudo'." },
      { step: "2. L'AI genera il preventivo", desc: "prevai crea le voci per unità interne, unità esterna, linea frigorífera, scarico condensa e installazione elettrica con prezzi di mercato." },
      { step: "3. PDF tecnico pronto", desc: "Documento con specifiche tecniche e prezzi. Il cliente lo usa anche per confrontare offerte o per la pratica Ecobonus." },
    ],
    h2UseCases: "Lavori tipici per installatori di climatizzazione",
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
    jsonLdDescription: "Software di preventivazione AI per installatori di climatizzatori italiani. Preventivi per condizionatori e pompe di calore in 30 secondi.",
  },

  pittore: {
    slug: "pittore",
    titleTag: "Preventivo Pittore Edile | Verniciatura Online – prevai",
    metaDescription: "Crea preventivi per pittura edile, verniciatura facciate, tinteggiatura interni ed esterni in 30 secondi. Software AI per pittori edili italiani. Gratis.",
    h1: "Preventivi per",
    h1Highlight: "Pittori Edili",
    intro: "Tinteggiatura di interni, verniciatura di facciate, rifinitura di serramenti, stucchi decorativi: il lavoro del pittore edile richiede preventivi dettagliati con mq, tipo di prodotto e numero di mani. prevai capisce la differenza tra primer, pittura lavabile, smalto al quarzo, silossanica — e genera un'offerta commerciale professionale con voci distinte per ogni lavorazione. In 30 secondi.",
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
      { q: "Posso inserire il numero di mani e il tipo di primer nel preventivo?", a: "Assolutamente. Includi questi dettagli nella descrizione e prevai li riporterà fedelmente nel documento. Più dettagli = preventivo più professionale." },
      { q: "Come gestisco preventivi per condomini con ponteggio?", a: "Aggiungi il costo del ponteggio nella descrizione e prevai lo inserisce come voce separata nel computo. Puoi indicare il costo mensile o a corpo." },
    ],
    jsonLdDescription: "Software di preventivazione AI per pittori edili italiani. Preventivi per tinteggiatura e verniciatura in 30 secondi.",
  },

  pavimentista: {
    slug: "pavimentista",
    titleTag: "Preventivo Posa Pavimento | Pavimentista Online – prevai",
    metaDescription: "Crea preventivi per posa parquet, laminato, pavimenti in resina, moquette e massetti in 30 secondi. Software AI per pavimentisti italiani. Provalo gratis.",
    h1: "Preventivi per",
    h1Highlight: "Pavimentisti",
    intro: "Parquet prefinito, laminato, resina epossidica, pavimento in vinile, moquette: ogni tipo di pavimentazione ha costi di fornitura e posa diversi. Il cliente ha bisogno di un preventivo chiaro che spieghi cosa sta acquistando. prevai genera offerte commerciali professionali per lavori di pavimentazione con mq, tipo di prodotto, preparazione del fondo e finitura. In 30 secondi.",
    h2Benefits: "Perché i pavimentisti scelgono prevai",
    benefits: [
      { title: "Voci per fornitura e posa separate", desc: "Il documento distingue il costo del materiale (parquet, resina, laminato) dall'installazione e dalla preparazione del fondo. Trasparenza totale." },
      { title: "Preparazione del fondo inclusa", desc: "L'AI include automaticamente le voci per rasatura, massetto livellante e primer quando sono necessari. Niente dimenticanze che erodono il margine." },
      { title: "Calcolo mq con percentuale di scarto", desc: "L'AI stima i mq da ordinare includendo lo scarto tipico per il formato e il tipo di posa. Ordini giusti, zero sprechi." },
      { title: "Dal sopralluogo al PDF in 60 secondi", desc: "Misuri, descrivi, invii. Il cliente riceve il preventivo prima che tu sia risalito in auto. Chi arriva prima vince." },
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
      { q: "Posso fare preventivi per pavimenti in resina di grandi superfici?", a: "Sì, perfetto per resine epossidiche in ambito industriale, commerciale o residenziale. Prevai gestisce qualsiasi superficie con voci per primer, strato di fondo e finitura." },
      { q: "Il preventivo è adatto anche per la lucidatura di parquet esistenti?", a: "Assolutamente. Descrivi il tipo di intervento (carteggiatura, verniciatura, trattamento ad olio) e prevai genera le voci con prezzi al mq." },
    ],
    jsonLdDescription: "Software di preventivazione AI per pavimentisti italiani. Preventivi per posa parquet, resina e pavimenti in 30 secondi.",
  },

  "modello-excel": {
    slug: "modello-excel",
    titleTag: "Modello Preventivo Excel Gratis | Alternativa Migliore – prevai",
    metaDescription: "Cerchi un modello preventivo Excel gratis? prevai è meglio: genera preventivi professionali in 30 secondi con l'AI, senza formule, senza errori. Prova gratis.",
    h1: "Basta con il",
    h1Highlight: "Preventivo su Excel",
    intro: "Scarichi un modello preventivo Excel, passi mezz'ora a impostare le formule, inserisci i dati uno per uno, controlli i calcoli, salvi come PDF — e alla fine il documento sembra ancora amatoriale. Con prevai descrivi il lavoro a parole e in 30 secondi hai un'offerta commerciale professionale, con voci dettagliate, calcolo IVA automatico e intestazione aziendale. Nessuna formula. Nessun errore.",
    h2Benefits: "Perché prevai è meglio di un foglio Excel",
    benefits: [
      { title: "Nessuna formula da impostare", desc: "Con Excel devi costruire o adattare il modello ogni volta. Con prevai descrivi il lavoro e il preventivo è già strutturato e calcolato." },
      { title: "PDF professionale in un clic", desc: "Niente conversioni da .xlsx a PDF. Il documento è già formattato come un preventivo professionale, pronto da inviare al cliente." },
      { title: "Calcoli sempre corretti", desc: "Le formule Excel si rompono. L'AI di prevai calcola IVA, subtotali e totali senza mai sbagliare, anche su preventivi complessi multi-capitolo." },
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
    titleTag: "Modello Preventivo Word Gratis | Preventivo Online AI – prevai",
    metaDescription: "Cerchi un modello preventivo Word da scaricare? prevai genera preventivi professionali in 30 secondi con l'AI. Niente template Word, niente formattazione manuale.",
    h1: "Dimentica il",
    h1Highlight: "Template Preventivo Word",
    intro: "Hai scaricato un template preventivo Word, passato mezz'ora a formattare la tabella, inserito i dati manualmente e alla fine il documento non sembra professionale quanto vorresti. Con prevai non devi trovare template, non devi formattare nulla: descrivi il lavoro a parole e in 30 secondi hai un preventivo impaginato, calcolato e pronto per il cliente. Molto meglio di qualsiasi modello Word.",
    h2Benefits: "Perché prevai è meglio di un template Word",
    benefits: [
      { title: "Nessun template da scaricare", desc: "Con Word devi trovare il modello giusto, adattarlo, controllare che la formattazione non si sia rotta. Con prevai digiti il lavoro e il preventivo è fatto." },
      { title: "Calcoli automatici inclusi", desc: "Word non calcola. Con prevai IVA, subtotali e totali sono calcolati dall'AI in automatico, senza errori e senza calcolatrice." },
      { title: "Struttura professionale predefinita", desc: "Ogni preventivo ha intestazione aziendale, numero documento, dati cliente, voci dettagliate con U.M. e totali. Struttura da studio commercialista." },
      { title: "Logo e brand aziendale inclusi", desc: "Il tuo logo appare automaticamente su ogni preventivo. Con Word devi inserirlo manualmente su ogni file e la posizione cambia sempre." },
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
    titleTag: "Come Fare un Preventivo Professionale Online | Guida prevai",
    metaDescription: "Scopri come fare un preventivo professionale per la tua attività in 30 secondi. Guida pratica per artigiani, PMI e freelance italiani. Niente Excel, niente errori.",
    h1: "Come Fare un",
    h1Highlight: "Preventivo Professionale",
    intro: "Un preventivo professionale non è solo un elenco di voci e prezzi: è un documento commerciale che trasmette fiducia, giustifica il prezzo e accelera la decisione del cliente. Per farlo bene servono: intestazione aziendale, voci dettagliate con unità di misura, prezzi unitari, subtotali, IVA corretta e condizioni di pagamento chiare. Con prevai tutto questo viene generato automaticamente in 30 secondi. Senza Excel, senza Word, senza errori.",
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
    titleTag: "Preventivi Online Gratis | Software Preventivi Gratuito – prevai",
    metaDescription: "Crea preventivi online gratis con prevai. Software di preventivazione gratuito per artigiani e PMI italiane. Inizia subito senza carta di credito.",
    h1: "Preventivi Online",
    h1Highlight: "Gratuiti per Iniziare",
    intro: "Cerchi un software per fare preventivi online gratis? prevai ti permette di iniziare senza carta di credito: crea il tuo account, descrivi il lavoro a parole e genera il tuo primo preventivo professionale in 30 secondi. Il piano Starter da 29€/mese include 20 preventivi al mese — più che sufficienti per piccole attività. Per chi lavora di più, il piano Pro offre preventivi illimitati.",
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

const DEFAULT_SECTOR: SectorData = {
  slug: "professionista",
  titleTag: "Preventivi Online per Professionisti | prevai – AI",
  metaDescription:
    "Crea preventivi professionali in 30 secondi con l'AI. Software di preventivazione digitale per artigiani, PMI e professionisti italiani. Provalo gratis.",
  h1: "Preventivi per",
  h1Highlight: "Professionisti",
  intro:
    "prevai è il software di preventivazione con intelligenza artificiale pensato per artigiani, PMI e professionisti italiani. Descrivi il lavoro in linguaggio naturale e ottieni un preventivo professionale completo in 30 secondi. Niente Excel, niente fogli scritti a mano, niente errori.",
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
  jsonLdDescription: "Software di preventivazione AI per artigiani e professionisti italiani. Preventivi professionali in 30 secondi.",
};

const RELATED_SECTORS: Record<string, { slug: string; label: string }[]> = {
  imbianchino: [
    { slug: "pittore", label: "Pittori Edili" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "muratore", label: "Muratori" },
    { slug: "pavimentista", label: "Pavimentisti" },
    { slug: "modello-excel", label: "Alternativa Excel" },
  ],
  pittore: [
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "muratore", label: "Muratori" },
    { slug: "serramentista", label: "Serramentisti" },
    { slug: "modello-word", label: "Alternativa Word" },
  ],
  elettricista: [
    { slug: "idraulico", label: "Idraulici" },
    { slug: "termoidraulico", label: "Termoidraulici" },
    { slug: "condizionatori", label: "Climatizzatori" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
  ],
  idraulico: [
    { slug: "termoidraulico", label: "Termoidraulici" },
    { slug: "elettricista", label: "Elettricisti" },
    { slug: "condizionatori", label: "Climatizzatori" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "muratore", label: "Muratori" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
  ],
  edilizia: [
    { slug: "muratore", label: "Muratori" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "tetto", label: "Coperture e Tetti" },
    { slug: "geometra", label: "Geometri" },
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "modello-excel", label: "Alternativa Excel" },
  ],
  ristrutturazione: [
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "muratore", label: "Muratori" },
    { slug: "idraulico", label: "Idraulici" },
    { slug: "elettricista", label: "Elettricisti" },
    { slug: "serramentista", label: "Serramentisti" },
    { slug: "piastrellista", label: "Piastrellisti" },
  ],
  carpentiere: [
    { slug: "falegname", label: "Falegnami" },
    { slug: "muratore", label: "Muratori" },
    { slug: "serramentista", label: "Serramentisti" },
    { slug: "tetto", label: "Coperture e Tetti" },
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
  ],
  falegname: [
    { slug: "carpentiere", label: "Carpentieri" },
    { slug: "serramentista", label: "Serramentisti" },
    { slug: "pavimentista", label: "Pavimentisti" },
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "modello-word", label: "Alternativa Word" },
  ],
  termoidraulico: [
    { slug: "idraulico", label: "Idraulici" },
    { slug: "elettricista", label: "Elettricisti" },
    { slug: "condizionatori", label: "Climatizzatori" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
  ],
  freelance: [
    { slug: "geometra", label: "Geometri" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "modello-word", label: "Alternativa Word" },
    { slug: "modello-excel", label: "Alternativa Excel" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "pittore", label: "Pittori Edili" },
  ],
  geometra: [
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "freelance", label: "Freelance" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "muratore", label: "Muratori" },
    { slug: "tetto", label: "Coperture e Tetti" },
  ],
  muratore: [
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "tetto", label: "Coperture e Tetti" },
    { slug: "geometra", label: "Geometri" },
  ],
  giardiniere: [
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "modello-excel", label: "Alternativa Excel" },
    { slug: "freelance", label: "Freelance" },
    { slug: "pavimentista", label: "Pavimentisti" },
    { slug: "pittore", label: "Pittori Edili" },
  ],
  piastrellista: [
    { slug: "pavimentista", label: "Pavimentisti" },
    { slug: "muratore", label: "Muratori" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "falegname", label: "Falegnami" },
    { slug: "modello-excel", label: "Alternativa Excel" },
  ],
  serramentista: [
    { slug: "falegname", label: "Falegnami" },
    { slug: "carpentiere", label: "Carpentieri" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "tetto", label: "Coperture e Tetti" },
    { slug: "muratore", label: "Muratori" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
  ],
  tetto: [
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "muratore", label: "Muratori" },
    { slug: "serramentista", label: "Serramentisti" },
    { slug: "carpentiere", label: "Carpentieri" },
    { slug: "geometra", label: "Geometri" },
    { slug: "modello-excel", label: "Alternativa Excel" },
  ],
  condizionatori: [
    { slug: "termoidraulico", label: "Termoidraulici" },
    { slug: "idraulico", label: "Idraulici" },
    { slug: "elettricista", label: "Elettricisti" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
  ],
  pavimentista: [
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "falegname", label: "Falegnami" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "muratore", label: "Muratori" },
    { slug: "modello-word", label: "Alternativa Word" },
  ],
  "modello-excel": [
    { slug: "modello-word", label: "Alternativa Word" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "idraulico", label: "Idraulici" },
  ],
  "modello-word": [
    { slug: "modello-excel", label: "Alternativa Excel" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "elettricista", label: "Elettricisti" },
    { slug: "carpentiere", label: "Carpentieri" },
    { slug: "freelance", label: "Freelance" },
  ],
  "come-fare-preventivo": [
    { slug: "modello-excel", label: "Alternativa Excel" },
    { slug: "modello-word", label: "Alternativa Word" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "freelance", label: "Freelance" },
  ],
  "preventivi-gratis": [
    { slug: "modello-excel", label: "Alternativa Excel" },
    { slug: "modello-word", label: "Alternativa Word" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "idraulico", label: "Idraulici" },
    { slug: "elettricista", label: "Elettricisti" },
  ],
};

export default function SeoLanding() {
  const params = useParams();
  const slug = (params as { type?: string }).type ?? "professionista";
  const s = SECTORS[slug] ?? DEFAULT_SECTOR;

  useEffect(() => {
    document.title = s.titleTag;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = s.metaDescription;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "prevai",
      description: s.jsonLdDescription,
      url: `https://www.prevai.it/seo/${s.slug}`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "it",
    };
    let script = document.getElementById("seo-page-jsonld") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "seo-page-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      document.title = "prevai – Preventivi Facili";
      script?.remove();
    };
  }, [s]);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-24 pb-20">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
            <Star className="h-3.5 w-3.5 fill-current" />
            Pensato per il mercato italiano
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
            {s.h1}{" "}
            <span className="gradient-text">{s.h1Highlight}</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            {s.intro}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Crea il tuo preventivo in 60 secondi
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="#come-funziona"
              className="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Come funziona
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-5">Nessuna carta di credito richiesta · Preventivo pronto in 30 secondi</p>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">{s.h2Benefits}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {s.benefits.map((b) => (
              <div key={b.title} className="card-soft bg-white p-7 rounded-2xl flex flex-col">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center mb-5 text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                >
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{b.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="come-funziona" className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">{s.h2HowItWorks}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {s.howItWorks.map((step, i) => (
              <div key={i} className="relative">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                >
                  {i + 1}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{step.step}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use cases ────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{s.h2UseCases}</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {s.useCases.map((uc) => (
              <div key={uc} className="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 card-soft">
                <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-sm text-gray-700">{uc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── "Pensato per il mercato italiano" ────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="rounded-2xl p-10 md:p-14 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(6,182,212,0.06))" }}>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>
                  <Building2 className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Pensato per il mercato italiano</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600 leading-relaxed">
                <div>
                  <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-violet-500" /> IVA italiana integrata
                  </div>
                  <p>Il calcolo dell'IVA al 4%, 10% o 22% è automatico. prevai conosce le aliquote per ogni categoria di lavoro nel contesto normativo italiano.</p>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-500" /> Dati aziendali italiani
                  </div>
                  <p>Partita IVA, Codice Fiscale, REA: tutti i campi dell'intestazione rispettano il formato dei documenti commerciali italiani.</p>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-500" /> Lessico tecnico in italiano
                  </div>
                  <p>L'AI è addestrata sul lessico tecnico delle PMI italiane. Capisce il dialetto del tuo mestiere, non devi usare un linguaggio formale.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{s.h2Faq}</h2>
          </div>
          <div className="space-y-4">
            {s.faq.map((f) => (
              <div key={f.q} className="bg-white rounded-2xl p-6 card-soft">
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vedi anche ───────────────────────────────────── */}
      {RELATED_SECTORS[slug] && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900">Vedi anche</h2>
              <p className="text-sm text-gray-500 mt-2">Altre categorie di preventivi che potrebbero interessarti</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {RELATED_SECTORS[slug].map((r) => (
                <Link
                  key={r.slug}
                  href={`/seo/${r.slug}`}
                  className="flex items-center gap-3 bg-gray-50 hover:bg-violet-50 border border-gray-100 hover:border-violet-200 rounded-xl px-5 py-3.5 transition-colors group"
                >
                  <ArrowRight className="h-4 w-4 text-violet-400 group-hover:text-violet-600 shrink-0" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-violet-700">Preventivi per {r.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA finale ───────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-violet-500" />
            <span className="text-sm font-semibold text-violet-600">Risparmia ore ogni settimana</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Pronto a creare il tuo primo preventivo{" "}
            <span className="gradient-text">in 30 secondi</span>?
          </h2>
          <p className="text-lg text-gray-500 mb-10">
            Unisciti a centinaia di {s.h1Highlight.toLowerCase()} italiani che usano prevai ogni giorno.
            Nessuna carta di credito. Nessun impegno.
          </p>
          <Link
            href="/sign-up"
            className="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold"
          >
            Inizia Gratuitamente
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
