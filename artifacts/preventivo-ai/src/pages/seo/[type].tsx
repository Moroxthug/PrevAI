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
