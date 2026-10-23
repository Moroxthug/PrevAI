// Modelli di preventivo in Word (.docx) scaricabili gratis, uno per mestiere.
// Chi cerca "modello preventivo word" vuole un file da scaricare: la pagina
// /preventivi/modello-word/ e gli articoli fac-simile/modello li offrono qui.
// I .docx in public/modelli/ si rigenerano da questi dati con
// `pnpm --filter @workspace/preventivo-ai gen:modelli-word` (vanno committati).

export interface VoceModello {
  /** Riga di capitolo (intestazione su tutta la larghezza) invece di una voce. */
  capitolo?: string;
  descrizione?: string;
  /** Unità di misura: mq, ml, cad, h, a corpo… */
  um?: string;
}

export interface ModelloWord {
  slug: string;
  /** Nome breve del mestiere, per le schede di download. */
  mestiere: string;
  /** Titolo del documento e della scheda. */
  titolo: string;
  /** Una riga che dice cosa contiene il modello. */
  descrizione: string;
  /** Oggetto precompilato del preventivo. */
  oggetto: string;
  voci: VoceModello[];
  /** Condizioni specifiche del mestiere, oltre a quelle comuni. */
  condizioni: string[];
  /** Cosa escludere esplicitamente (evita le contestazioni). */
  esclusioni: string[];
  /** Pagina di settore collegata (/preventivi/:slug/). */
  settore: string;
  /** Articolo del blog collegato, se c'è. */
  articolo?: string;
}

export const MODELLI_WORD_DIR = "/modelli";

export function fileModello(m: ModelloWord): string {
  return `${MODELLI_WORD_DIR}/modello-preventivo-${m.slug}.docx`;
}

export const MODELLI_WORD: ModelloWord[] = [
  {
    slug: "generico",
    mestiere: "Qualsiasi mestiere",
    titolo: "Modello preventivo generico",
    descrizione: "Struttura completa per qualsiasi lavoro: intestazione, cliente, voci, IVA, condizioni e firma per accettazione.",
    oggetto: "Esecuzione dei lavori descritti di seguito presso l'immobile del cliente",
    voci: [
      { capitolo: "Lavori" },
      { descrizione: "Voce 1 — descrivere il lavoro, il materiale e la marca", um: "cad" },
      { descrizione: "Voce 2 — descrivere il lavoro, il materiale e la marca", um: "mq" },
      { descrizione: "Voce 3 — descrivere il lavoro, il materiale e la marca", um: "ml" },
      { descrizione: "Manodopera non compresa nelle voci precedenti", um: "h" },
      { capitolo: "Oneri" },
      { descrizione: "Trasporto, carico e smaltimento dei materiali di risulta", um: "a corpo" },
    ],
    condizioni: [],
    esclusioni: ["Opere non descritte nelle voci", "Pratiche edilizie e oneri comunali, se non indicati"],
    settore: "come-fare-preventivo",
    articolo: "fac-simile-preventivo",
  },
  {
    slug: "impianto-elettrico",
    mestiere: "Elettricista",
    titolo: "Modello preventivo impianto elettrico",
    descrizione: "Quadro, linee, punti luce, prese, impianto di terra e Dichiarazione di Conformità (D.M. 37/2008) già in elenco.",
    oggetto: "Rifacimento / realizzazione dell'impianto elettrico dell'unità immobiliare",
    voci: [
      { capitolo: "1. Quadro elettrico e protezioni" },
      { descrizione: "Quadro elettrico da incasso ___ moduli, interruttore generale magnetotermico differenziale", um: "cad" },
      { descrizione: "Interruttori magnetotermici per circuito (luci, prese, cucina, bagno, clima)", um: "cad" },
      { descrizione: "Montante dal contatore al quadro, cavo FG16OR16 sezione ___ mm²", um: "ml" },
      { capitolo: "2. Distribuzione e punti" },
      { descrizione: "Punto luce interrotto (tubo corrugato, cavo, scatola, frutto e placca serie ___)", um: "cad" },
      { descrizione: "Punto luce deviato / invertito", um: "cad" },
      { descrizione: "Punto presa 10/16 A bipasso o Schuko", um: "cad" },
      { descrizione: "Punto presa dedicata 16 A (forno, lavatrice, lavastoviglie, piano a induzione)", um: "cad" },
      { descrizione: "Punto presa TV / dati RJ45", um: "cad" },
      { capitolo: "3. Impianto di terra e opere accessorie" },
      { descrizione: "Impianto di terra: dispersore, conduttori di protezione, collegamenti equipotenziali bagno", um: "a corpo" },
      { descrizione: "Tracce a muro e ripristino (se a carico dell'elettricista)", um: "ml" },
      { capitolo: "4. Certificazioni" },
      { descrizione: "Dichiarazione di Conformità ai sensi del D.M. 37/2008 con schema e relazione dei materiali", um: "a corpo" },
    ],
    condizioni: [
      "Materiali di serie ___ (marca e modello indicati in ogni voce).",
      "La Dichiarazione di Conformità viene consegnata a fine lavori ed è compresa nel prezzo.",
    ],
    esclusioni: ["Opere murarie oltre alle tracce indicate", "Corpi illuminanti e lampadine", "Pratiche con il distributore per aumento di potenza"],
    settore: "elettricista",
    articolo: "modello-preventivo-impianto-elettrico",
  },
  {
    slug: "idraulico",
    mestiere: "Idraulico",
    titolo: "Modello preventivo idraulico",
    descrizione: "Adduzione, scarichi, sanitari, collaudo e Dichiarazione di Conformità per bagno, cucina o impianto completo.",
    oggetto: "Lavori idraulici presso l'unità immobiliare del cliente",
    voci: [
      { capitolo: "1. Smontaggi" },
      { descrizione: "Smontaggio sanitari e rubinetteria esistenti, compreso smaltimento", um: "a corpo" },
      { capitolo: "2. Impianto" },
      { descrizione: "Rete di adduzione acqua calda/fredda in multistrato Ø ___, con collettore", um: "a corpo" },
      { descrizione: "Rete di scarico in PP/PVC Ø ___ fino alla colonna", um: "a corpo" },
      { descrizione: "Punto acqua (attacco sanitario o elettrodomestico)", um: "cad" },
      { descrizione: "Spostamento scarico o colonna", um: "cad" },
      { capitolo: "3. Posa sanitari" },
      { descrizione: "Posa WC sospeso con cassetta a incasso (sanitario escluso / incluso: ___)", um: "cad" },
      { descrizione: "Posa lavabo con mobile e miscelatore", um: "cad" },
      { descrizione: "Posa piatto doccia e miscelatore termostatico", um: "cad" },
      { capitolo: "4. Collaudo e certificazioni" },
      { descrizione: "Prova di tenuta dell'impianto e collaudo", um: "a corpo" },
      { descrizione: "Dichiarazione di Conformità ai sensi del D.M. 37/2008", um: "a corpo" },
    ],
    condizioni: ["Marca e modello di sanitari e rubinetteria indicati in ogni voce, o forniti dal cliente."],
    esclusioni: ["Opere murarie, tracce e piastrelle", "Fornitura sanitari, se non indicata", "Interventi sulle parti condominiali"],
    settore: "idraulico",
    articolo: "fac-simile-preventivo-idraulico",
  },
  {
    slug: "lavori-edili",
    mestiere: "Impresa edile",
    titolo: "Modello preventivo lavori edili",
    descrizione: "Capitoli per demolizioni, murature, intonaci, massetti e smaltimenti: la base per ristrutturazioni e opere murarie.",
    oggetto: "Opere edili di ristrutturazione presso l'immobile del cliente",
    voci: [
      { capitolo: "1. Cantiere" },
      { descrizione: "Allestimento cantiere, protezioni e pulizia finale", um: "a corpo" },
      { capitolo: "2. Demolizioni" },
      { descrizione: "Demolizione tramezzi in laterizio, spessore ___ cm", um: "mq" },
      { descrizione: "Demolizione pavimenti e massetto", um: "mq" },
      { descrizione: "Rimozione rivestimenti", um: "mq" },
      { capitolo: "3. Opere murarie" },
      { descrizione: "Nuovi tramezzi in laterizio / cartongesso, spessore ___ cm", um: "mq" },
      { descrizione: "Intonaco civile su pareti e soffitti", um: "mq" },
      { descrizione: "Massetto in sabbia e cemento, spessore ___ cm", um: "mq" },
      { descrizione: "Assistenza muraria agli impianti (tracce e chiusure)", um: "a corpo" },
      { capitolo: "4. Smaltimenti" },
      { descrizione: "Carico, trasporto e conferimento in discarica autorizzata dei materiali di risulta", um: "a corpo" },
    ],
    condizioni: ["Le quantità a misura sono rilevate in contraddittorio a fine lavori.", "Eventuali opere strutturali richiedono progetto e pratica a parte."],
    esclusioni: ["Pratiche edilizie (CILA/SCIA) e direzione lavori", "Impianti, pavimenti e serramenti, se non indicati", "Occupazione di suolo pubblico"],
    settore: "edilizia",
    articolo: "modello-preventivo-lavori-edili-word",
  },
  {
    slug: "tinteggiatura",
    mestiere: "Imbianchino",
    titolo: "Modello preventivo tinteggiatura",
    descrizione: "Preparazione delle superfici, stuccature, mani di pittura al mq e protezioni: per interni ed esterni.",
    oggetto: "Tinteggiatura di pareti e soffitti dei locali indicati",
    voci: [
      { capitolo: "1. Preparazione" },
      { descrizione: "Protezione di pavimenti, infissi e arredi con teli e nastro", um: "a corpo" },
      { descrizione: "Raschiatura delle parti incoerenti e stuccatura di crepe e fori", um: "mq" },
      { descrizione: "Rasatura completa (dove necessaria)", um: "mq" },
      { capitolo: "2. Tinteggiatura" },
      { descrizione: "Fissativo / isolante di fondo", um: "mq" },
      { descrizione: "Pittura lavabile traspirante, 2 mani, colore ___ (marca e prodotto ___)", um: "mq" },
      { descrizione: "Tinteggiatura soffitti, 2 mani", um: "mq" },
      { descrizione: "Pittura antimuffa nei locali umidi", um: "mq" },
      { capitolo: "3. Finiture" },
      { descrizione: "Verniciatura termosifoni / ringhiere", um: "cad" },
      { descrizione: "Pulizia finale e smaltimento", um: "a corpo" },
    ],
    condizioni: ["Superfici misurate vuoto per pieno, detraendo le aperture oltre ___ mq.", "Colori diversi per parete: ___ € in più per colore."],
    esclusioni: ["Spostamento dei mobili pesanti", "Trattamento di infiltrazioni o umidità di risalita"],
    settore: "imbianchino",
    articolo: "fac-simile-preventivo-tinteggiatura",
  },
  {
    slug: "ristrutturazione-bagno",
    mestiere: "Ristrutturazione bagno",
    titolo: "Modello preventivo ristrutturazione bagno",
    descrizione: "Demolizione, impianti, impermeabilizzazione, piastrelle e sanitari: tutto il bagno chiavi in mano, voce per voce.",
    oggetto: "Ristrutturazione completa del bagno (superficie ___ mq)",
    voci: [
      { capitolo: "1. Demolizioni" },
      { descrizione: "Demolizione pavimento, rivestimento e sanitari esistenti", um: "a corpo" },
      { descrizione: "Smaltimento dei materiali di risulta", um: "a corpo" },
      { capitolo: "2. Impianti" },
      { descrizione: "Rifacimento impianto idraulico (adduzione e scarichi)", um: "a corpo" },
      { descrizione: "Adeguamento impianto elettrico del bagno (punti IP44, equipotenziale)", um: "a corpo" },
      { capitolo: "3. Opere murarie e finiture" },
      { descrizione: "Massetto e impermeabilizzazione zona doccia", um: "mq" },
      { descrizione: "Fornitura e posa pavimento in gres ___ x ___", um: "mq" },
      { descrizione: "Fornitura e posa rivestimento pareti, altezza ___ cm", um: "mq" },
      { capitolo: "4. Sanitari e arredo" },
      { descrizione: "Fornitura e posa WC e bidet sospesi", um: "cad" },
      { descrizione: "Fornitura e posa mobile lavabo con miscelatore", um: "cad" },
      { descrizione: "Fornitura e posa piatto doccia e box cristallo ___ x ___", um: "cad" },
      { capitolo: "5. Certificazioni" },
      { descrizione: "Dichiarazioni di Conformità impianto idraulico ed elettrico (D.M. 37/2008)", um: "a corpo" },
    ],
    condizioni: ["Per la detrazione fiscale il pagamento avviene con bonifico parlante.", "Le piastrelle scelte dal cliente oltre ___ €/mq sono addebitate a parte."],
    esclusioni: ["Accessori bagno e specchi, se non indicati", "Pratica edilizia, se necessaria"],
    settore: "ristrutturazione",
    articolo: "esempio-preventivo-ristrutturazione-bagno",
  },
  {
    slug: "posa-piastrelle",
    mestiere: "Piastrellista",
    titolo: "Modello preventivo posa piastrelle",
    descrizione: "Posa al mq per formato, massetto, battiscopa, fughe e tagli: pavimenti e rivestimenti di bagno e cucina.",
    oggetto: "Posa di pavimenti e rivestimenti nei locali indicati",
    voci: [
      { capitolo: "1. Preparazione" },
      { descrizione: "Rimozione pavimento esistente e pulizia del fondo", um: "mq" },
      { descrizione: "Autolivellante / rasatura del massetto", um: "mq" },
      { capitolo: "2. Posa" },
      { descrizione: "Posa pavimento in gres formato 30x30 / 60x60 / ___, colla classe C2", um: "mq" },
      { descrizione: "Posa grandi formati (oltre 60x120) con doppia spalmatura", um: "mq" },
      { descrizione: "Posa rivestimento a parete, altezza ___ cm", um: "mq" },
      { descrizione: "Posa a spina di pesce / diagonale (maggiorazione)", um: "mq" },
      { capitolo: "3. Finiture" },
      { descrizione: "Battiscopa", um: "ml" },
      { descrizione: "Stuccatura fughe con stucco ___ (cementizio / epossidico)", um: "mq" },
      { descrizione: "Profili, paraspigoli e tagli speciali", um: "ml" },
    ],
    condizioni: ["Sfrido calcolato al ___ % sul materiale fornito.", "Il fondo deve essere asciutto e planare; correzioni oltre 3 mm a parte."],
    esclusioni: ["Fornitura delle piastrelle, se non indicata", "Massetti nuovi, se non indicati"],
    settore: "piastrellista",
    articolo: "costo-posa-piastrelle-bagno-cucina",
  },
  {
    slug: "condizionatori",
    mestiere: "Installatore clima",
    titolo: "Modello preventivo installazione condizionatori",
    descrizione: "Unità interne ed esterne, linee frigorifere, scarico condensa, staffe, vuoto e carica, certificazione F-gas.",
    oggetto: "Fornitura e installazione impianto di climatizzazione",
    voci: [
      { capitolo: "1. Fornitura" },
      { descrizione: "Unità esterna inverter marca ___ modello ___, ___ kW (___ BTU), classe ___", um: "cad" },
      { descrizione: "Unità interna a parete ___ BTU", um: "cad" },
      { capitolo: "2. Installazione" },
      { descrizione: "Linee frigorifere in rame coibentato fino a ___ m per unità", um: "ml" },
      { descrizione: "Metri di linea oltre quelli inclusi", um: "ml" },
      { descrizione: "Scarico condensa (a gravità / con pompa)", um: "cad" },
      { descrizione: "Staffe o supporti per unità esterna, antivibranti", um: "cad" },
      { descrizione: "Collegamento elettrico dalla presa / linea dedicata", um: "cad" },
      { descrizione: "Carotaggio o foro passante a parete", um: "cad" },
      { capitolo: "3. Messa in funzione" },
      { descrizione: "Prova di tenuta, vuoto, carica e collaudo", um: "a corpo" },
      { descrizione: "Registrazione dell'impianto nella banca dati F-gas", um: "a corpo" },
    ],
    condizioni: ["Installazione eseguita da impresa certificata F-gas.", "Garanzia del produttore attivata a nome del cliente."],
    esclusioni: ["Opere murarie e canaline estetiche, se non indicate", "Ponteggi o piattaforme per installazioni in quota", "Permessi condominiali"],
    settore: "condizionatori",
    articolo: "prezzi-condizionatori-installazione-2026",
  },
  {
    slug: "giardiniere",
    mestiere: "Giardiniere",
    titolo: "Modello preventivo giardiniere",
    descrizione: "Taglio prato, potature, siepi, smaltimento del verde e contratto di manutenzione periodica.",
    oggetto: "Lavori di manutenzione del verde presso il giardino del cliente",
    voci: [
      { capitolo: "1. Interventi" },
      { descrizione: "Taglio prato con raccolta dell'erba", um: "mq" },
      { descrizione: "Taglio e sagomatura siepi, altezza fino a ___ m", um: "ml" },
      { descrizione: "Potatura alberi, altezza ___ m (con / senza piattaforma)", um: "cad" },
      { descrizione: "Pulizia aiuole e diserbo manuale", um: "mq" },
      { descrizione: "Fornitura e posa piante / tappeto erboso", um: "mq" },
      { capitolo: "2. Smaltimento" },
      { descrizione: "Raccolta, trasporto e conferimento degli scarti verdi", um: "a corpo" },
      { capitolo: "3. Manutenzione periodica (facoltativa)" },
      { descrizione: "Canone di manutenzione: ___ interventi l'anno", um: "a corpo" },
    ],
    condizioni: ["Interventi in date concordate; pioggia o neve spostano l'intervento senza costi."],
    esclusioni: ["Abbattimenti che richiedono autorizzazione comunale", "Riparazione dell'impianto di irrigazione, se non indicata"],
    settore: "giardiniere",
    articolo: "preventivo-giardiniere",
  },
];

export function modelloPerSlug(slug: string): ModelloWord | undefined {
  return MODELLI_WORD.find((m) => m.slug === slug);
}
