// Profili locali scritti a mano, uno per città: patrimonio edilizio, logistica
// del cantiere, rischi documentati, vincoli. Solo fatti verificabili (eventi
// storici, siti UNESCO con anno di iscrizione, reti di teleriscaldamento
// esistenti, quartieri reali): niente percentuali di costo o "trend" stimati.
// Le pagine usano questi campi solo dove servono al mestiere della pagina.

export interface ProfiloCitta {
  /** Com'è fatto il costruito: epoche, tipologie, quartieri. */
  costruito: string;
  /** Quartieri reali citati come esempio (3–4). */
  quartieri: string[];
  /** Cosa cambia nel cantiere: accessi, trasporti, ZTL, pendenze. */
  cantiere: string;
  /** Eventi o condizioni documentate rilevanti per chi lavora sugli edifici. */
  rischi?: string;
  /** Sito UNESCO che tocca il tessuto urbano (nome e anno). */
  unesco?: string;
  /** Rete di teleriscaldamento cittadina (gestore). */
  teleriscaldamento?: string;
  /** Città sul mare: salsedine su facciate, serramenti, impianti esterni. */
  costiera?: boolean;
  /** Città su lago, laguna o fiume con umidità ambientale marcata. */
  umida?: string;
  /** Materiale da costruzione tipico del centro storico. */
  materiale?: string;
}

export const PROFILI_CITTA: Record<string, ProfiloCitta> = {
  milano: {
    costruito: "Convivono le case di ringhiera di fine Ottocento, i condomini del boom edilizio anni '50–'70 e le torri recenti di Porta Nuova e CityLife. Gran parte dei lavori riguarda appartamenti in condominio, con regolamenti condominiali e orari di cantiere da rispettare.",
    quartieri: ["Isola", "Navigli", "Città Studi", "Lorenteggio"],
    cantiere: "Per i furgoni contano Area B (accesso vietato ai veicoli più inquinanti in quasi tutto il territorio comunale) e Area C (ingresso a pagamento nella Cerchia dei Bastioni): un mezzo non conforme cambia i costi di trasferta.",
    rischi: "In diverse zone la falda è risalita negli ultimi decenni: cantine e box interrati con infiltrazioni sono un lavoro ricorrente.",
    teleriscaldamento: "A2A",
  },
  bergamo: {
    costruito: "La città è divisa tra Città Alta, il nucleo storico dentro le mura venete, e Città Bassa, con il centro piacentiniano e i quartieri residenziali del Novecento verso la pianura.",
    quartieri: ["Città Alta", "Borgo Santa Caterina", "Redona", "Longuelo"],
    cantiere: "In Città Alta le strade strette e la ZTL limitano i mezzi: materiali e smaltimenti richiedono veicoli piccoli e permessi di accesso.",
    unesco: "Opere di difesa veneziane tra XVI e XVII secolo (2017)",
    teleriscaldamento: "A2A",
  },
  brescia: {
    costruito: "Accanto al centro storico romano e medievale ci sono i villaggi Marcolini, quartieri di case unifamiliari costruiti in cooperativa tra anni '50 e '70, e una vasta edilizia condominiale e produttiva nella zona ovest.",
    quartieri: ["Centro storico", "Villaggio Prealpino", "Lamarmora", "San Polo"],
    cantiere: "Il teleriscaldamento, avviato a Brescia nel 1972 tra i primi in Italia, serve gran parte della città: molti edifici non hanno una caldaia propria ma una sottostazione di scambio.",
    rischi: "Brescia è in zona sismica 2; il terremoto di Salò del 24 novembre 2004 ha ricordato la sismicità del bacino del Garda.",
    unesco: "I Longobardi in Italia, con il complesso di Santa Giulia (2011)",
    teleriscaldamento: "A2A",
  },
  como: {
    costruito: "La città murata, con il centro medievale a pianta romana, è circondata da ville sul lungolago e da quartieri collinari; Como è anche una delle capitali del razionalismo, con la Casa del Fascio di Terragni.",
    quartieri: ["Città murata", "Borgovico", "Rebbio", "Camerlata"],
    cantiere: "Il centro murato è a traffico limitato e le strade collinari verso Brunate e Civiglio sono strette e ripide: conta la scelta del mezzo.",
    rischi: "Il lago esonda periodicamente su piazza Cavour e sul lungolago, con effetti su piani terra e cantine.",
    umida: "il lago",
  },
  cremona: {
    costruito: "Il centro medievale e rinascimentale attorno al Torrazzo convive con un'edilizia del Novecento più recente; nel territorio sono diffuse le cascine della pianura.",
    quartieri: ["Centro storico", "Po", "Cambonino", "Boschetto"],
    cantiere: "In centro ZTL e pavimentazioni storiche impongono mezzi leggeri; fuori dal centro i cantieri sono semplici da raggiungere.",
    umida: "la pianura del Po, con nebbie e umidità invernali",
  },
  lecco: {
    costruito: "Stretta tra il lago e le montagne (Resegone, Grigne), la città unisce il centro storico manzoniano ai quartieri nati attorno all'industria siderurgica e tessile.",
    quartieri: ["Pescarenico", "Germanedo", "Acquate", "Castello"],
    cantiere: "Molti rioni sono in pendenza, con accessi stretti: ponteggi e trasporto dei materiali vanno pianificati prima.",
    umida: "il lago",
  },
  lodi: {
    costruito: "Il centro storico conserva piazza della Vittoria porticata e palazzi settecenteschi; attorno, edilizia residenziale del secondo Novecento in crescita per la vicinanza a Milano.",
    quartieri: ["Centro storico", "Borgo Adda", "San Bernardo", "Faustina"],
    cantiere: "Nessuna difficoltà di accesso particolare fuori dal centro, che ha ZTL e pavimentazioni storiche.",
    rischi: "Nel novembre 2002 l'Adda esondò allagando i quartieri vicini al fiume: piani terra e cantine sono i punti da verificare.",
    umida: "l'Adda e la pianura irrigua",
  },
  mantova: {
    costruito: "Il centro rinascimentale dei Gonzaga è circondato su tre lati dai laghi formati dal Mincio; fuori dalle mura, quartieri residenziali del Novecento.",
    quartieri: ["Centro storico", "Valletta Paiolo", "Lunetta", "Cittadella"],
    cantiere: "Gran parte del centro è vincolata: facciate, coperture e serramenti richiedono materiali coerenti e l'autorizzazione della Soprintendenza.",
    rischi: "Il terremoto dell'Emilia del 2012 ha danneggiato edifici storici del mantovano, compreso il Palazzo Ducale.",
    unesco: "Mantova e Sabbioneta (2008)",
    umida: "i laghi del Mincio",
  },
  monza: {
    costruito: "Città densa della conurbazione milanese, con condomini anni '60–'70, villette verso la Brianza e il complesso della Villa Reale con il suo parco.",
    quartieri: ["Centro storico", "San Fruttuoso", "Cederna", "Triante"],
    cantiere: "Accessi semplici in gran parte della città; nel centro storico ZTL e aree pedonali.",
    rischi: "Il Lambro attraversa il centro e in passato è esondato (per esempio nel 2014): attenzione alle quote dei piani interrati vicino al fiume.",
  },
  pavia: {
    costruito: "Il centro medievale, con le torri e i palazzi dell'università fondata nel 1361, è circondato da quartieri novecenteschi e dal Borgo Ticino oltre il fiume.",
    quartieri: ["Centro storico", "Borgo Ticino", "Città Giardino", "Pavia Ovest"],
    cantiere: "Molti alloggi del centro sono affittati a studenti: gli interventi su bagni, cucine e impianti si concentrano nei mesi estivi.",
    rischi: "Il crollo della Torre Civica il 17 marzo 1989 è ancora oggi il caso di riferimento sulla manutenzione delle murature storiche.",
    umida: "il Ticino",
  },
  sondrio: {
    costruito: "Capoluogo della Valtellina: edifici in pietra nel centro e nelle contrade, condomini del secondo Novecento in fondovalle, baite e rustici sui versanti.",
    quartieri: ["Centro", "Scarpatetti", "Ponchiera", "Triasso"],
    cantiere: "Pendenze, strade di versante e stagione invernale accorciano i tempi utili per i lavori esterni.",
    rischi: "L'alluvione della Valtellina del 1987 ha lasciato un'attenzione costante a frane e drenaggi.",
  },
  varese: {
    costruito: "La 'città giardino' ha ville liberty e residenze d'inizio Novecento sui colli (Campo dei Fiori, Biumo) e quartieri popolari nelle ex aree industriali.",
    quartieri: ["Biumo", "Masnago", "Bosto", "Bizzozero"],
    cantiere: "Molte ville hanno giardini e accessi privati in pendenza: va previsto lo spazio per mezzi e stoccaggio.",
    unesco: "Sacri Monti del Piemonte e della Lombardia, con il Sacro Monte di Varese (2003)",
  },
  roma: {
    costruito: "Il comune più popoloso d'Italia va dal centro storico, con palazzi e chiese di ogni epoca, alle palazzine anni '50–'70 di quartieri come Monteverde e Tuscolano, fino alle borgate e ai quartieri recenti oltre il Grande Raccordo Anulare.",
    quartieri: ["Monteverde", "Prati", "Tuscolano", "Centocelle"],
    cantiere: "ZTL Centro Storico e Trastevere, occupazione di suolo pubblico e orari di carico e scarico pesano su ogni cantiere in centro.",
    unesco: "Centro storico di Roma (1980)",
    materiale: "tufo e laterizio",
  },
  napoli: {
    costruito: "Il centro storico greco-romano è costruito in gran parte in tufo giallo napoletano; attorno, i quartieri ottocenteschi (Vomero, Chiaia) e la periferia del secondo Novecento.",
    quartieri: ["Centro storico", "Vomero", "Chiaia", "Fuorigrotta"],
    cantiere: "Vicoli stretti, scale e assenza di spazi di sosta nel centro rendono il trasporto dei materiali una voce da quotare a parte.",
    rischi: "I quartieri occidentali rientrano nell'area dei Campi Flegrei soggetta a bradisismo; il D.L. 140/2023 ha previsto verifiche della vulnerabilità degli edifici in quell'area.",
    unesco: "Centro storico di Napoli (1995)",
    costiera: true,
    materiale: "tufo giallo napoletano",
  },
  torino: {
    costruito: "Palazzi ottocenteschi con ballatoio a San Salvario e Vanchiglia, il centro barocco e i grandi quartieri operai del Novecento come Mirafiori e Barriera di Milano.",
    quartieri: ["San Salvario", "Vanchiglia", "Mirafiori", "Barriera di Milano"],
    cantiere: "Torino ha la più estesa rete di teleriscaldamento d'Italia: in molti condomini l'intervento termico riguarda la sottostazione, non una caldaia.",
    unesco: "Residenze Sabaude (1997)",
    teleriscaldamento: "Iren",
  },
  bologna: {
    costruito: "Uno dei centri storici medievali più estesi d'Europa, porticato quasi ovunque, circondato dai quartieri del Novecento e dai colli a sud.",
    quartieri: ["Centro storico", "Bolognina", "San Donato", "Saragozza"],
    cantiere: "La ZTL del centro e i portici, che sono suolo pubblico ad uso pubblico, condizionano ponteggi e carichi.",
    rischi: "La pianura bolognese è soggetta a subsidenza, un fattore da considerare in fondazioni e pavimentazioni esterne.",
    unesco: "I portici di Bologna (2021)",
  },
  firenze: {
    costruito: "Il centro storico rinascimentale è costruito in pietra forte e pietra serena, con coperture in coppi e solai in legno; oltre i viali, quartieri ottocenteschi e del dopoguerra.",
    quartieri: ["Oltrarno", "Campo di Marte", "Rifredi", "Gavinana"],
    cantiere: "ZTL estesa, strade strette e regole sui mezzi pesanti nel centro: i cantieri lavorano con mezzi piccoli e orari stretti.",
    rischi: "L'alluvione dell'Arno del 4 novembre 1966 ha segnato la città: i piani terra dei quartieri lungo il fiume restano i più esposti.",
    unesco: "Centro storico di Firenze (1982)",
    materiale: "pietra forte e pietra serena",
  },
  genova: {
    costruito: "Il centro storico dei caruggi è uno dei più grandi d'Europa; la città si sviluppa in verticale sulle colline, con palazzi alti e collegamenti fatti di creuze, ascensori e funicolari.",
    quartieri: ["Centro storico", "Castelletto", "Albaro", "Sampierdarena"],
    cantiere: "Nei caruggi non entrano i furgoni: i materiali viaggiano a mano o con piccoli mezzi, e in collina contano pendenze e scale.",
    rischi: "Le alluvioni del Bisagno e del Fereggiano (2011, 2014) hanno colpito i quartieri a valle: quote e protezioni dei piani terra sono temi ricorrenti.",
    unesco: "Strade Nuove e sistema dei Palazzi dei Rolli (2006)",
    costiera: true,
  },
  venezia: {
    costruito: "Il comune unisce la città storica sulle isole, con edifici su fondazioni di pali in legno, e la terraferma di Mestre e Marghera, dove vive la maggior parte degli abitanti.",
    quartieri: ["Cannaregio", "Castello", "Mestre", "Marghera"],
    cantiere: "Nella città storica ogni materiale arriva in barca e va scaricato a mano: trasporto acqueo, carichi e smaltimenti sono voci di preventivo a sé.",
    rischi: "L'acqua alta colpisce i piani terra della città storica; il MOSE, operativo dal 2020, riduce gli allagamenti ma non elimina l'umidità di risalita.",
    unesco: "Venezia e la sua Laguna (1987)",
    costiera: true,
    umida: "la laguna",
  },
  palermo: {
    costruito: "Il centro storico (Kalsa, Albergheria, Capo, Vucciria) ha palazzi in calcarenite; l'espansione del dopoguerra, il cosiddetto sacco di Palermo, ha costruito gran parte dei condomini di viale della Libertà e delle periferie.",
    quartieri: ["Kalsa", "Albergheria", "Libertà", "Zen"],
    cantiere: "Nel centro storico le strade sono strette e la ZTL limita gli accessi: vanno previsti mezzi piccoli e permessi.",
    unesco: "Palermo arabo-normanna e le cattedrali di Cefalù e Monreale (2015)",
    costiera: true,
    materiale: "calcarenite",
  },
  catania: {
    costruito: "Ricostruita in stile barocco dopo il terremoto del 1693, la città usa largamente la pietra lavica dell'Etna; attorno al centro, quartieri del Novecento verso nord e il mare.",
    quartieri: ["Centro storico", "Borgo", "Ognina", "Librino"],
    cantiere: "Durante le fasi parossistiche dell'Etna la cenere vulcanica si deposita su tetti, terrazze e grondaie: pulizia e controllo degli scarichi sono interventi frequenti.",
    rischi: "Zona sismica 2: il terremoto del 1693 distrusse la città e ne ha determinato l'aspetto attuale.",
    unesco: "Città tardo barocche del Val di Noto (2002)",
    costiera: true,
    materiale: "pietra lavica",
  },
  bari: {
    costruito: "Bari Vecchia, il borgo medievale sul mare, si affianca al quartiere murattiano a scacchiera, costruito dal 1813, e all'espansione residenziale del secondo Novecento.",
    quartieri: ["Bari Vecchia", "Murat", "Poggiofranco", "Japigia"],
    cantiere: "A Bari Vecchia i vicoli escludono i mezzi: si lavora con trasporto a mano; nel Murattiano conta la ZTL.",
    costiera: true,
    materiale: "pietra calcarea",
  },
  verona: {
    costruito: "Il centro storico romano e scaligero dentro le mura, con l'Arena, è circondato da quartieri residenziali novecenteschi e dalla zona industriale a sud.",
    quartieri: ["Centro storico", "Veronetta", "Borgo Trento", "Borgo Roma"],
    cantiere: "La città storica è vincolata quasi per intero: interventi su facciate, coperture e serramenti passano dalla Soprintendenza.",
    rischi: "Verona è in zona sismica 2: il terremoto del 1117 è tra i più forti mai registrati nel Nord Italia.",
    unesco: "Città di Verona (2000)",
    teleriscaldamento: "AGSM AIM",
  },
  trieste: {
    costruito: "Città di impianto asburgico: palazzi ottocenteschi neoclassici e liberty nel Borgo Teresiano, edilizia popolare del Novecento sui colli e nel Carso.",
    quartieri: ["Borgo Teresiano", "San Giacomo", "Barcola", "Opicina"],
    cantiere: "Molte strade sono in forte pendenza, e la bora impone attenzione a ponteggi, teli e carichi sospesi nelle giornate di vento.",
    rischi: "La bora, con raffiche che superano i 100 km/h, sollecita coperture, serramenti e insegne.",
    costiera: true,
  },
  padova: {
    costruito: "Centro storico porticato attorno all'università fondata nel 1222, quartieri ottocenteschi e un'ampia espansione del dopoguerra verso l'Arcella e la zona industriale.",
    quartieri: ["Centro storico", "Arcella", "Portello", "Guizza"],
    cantiere: "Gli alloggi per studenti sono molti: gli interventi si concentrano tra un contratto e l'altro, spesso d'estate.",
    unesco: "Orto botanico (1997) e cicli affrescati del XIV secolo (2021)",
  },
  modena: {
    costruito: "Centro storico raccolto attorno al Duomo, quartieri del Novecento e una vasta area produttiva legata a ceramica, meccanica e agroalimentare.",
    quartieri: ["Centro storico", "Buon Pastore", "Sacca", "San Faustino"],
    cantiere: "Fuori dal centro (ZTL) i cantieri sono facilmente accessibili; frequenti i lavori su capannoni e spazi produttivi.",
    rischi: "Il terremoto dell'Emilia del 2012 ha colpito la provincia; le esondazioni di Secchia (2014) e Panaro (2020) hanno allagato aree vicine.",
    unesco: "Cattedrale, Torre Civica e Piazza Grande (1997)",
  },
  perugia: {
    costruito: "L'acropoli etrusca e medievale, in pietra, sta in cima al colle; i quartieri moderni scendono lungo i versanti fino a Ponte San Giovanni.",
    quartieri: ["Centro storico", "Elce", "Monteluce", "Ponte San Giovanni"],
    cantiere: "In centro strade strette, pendenze e ZTL: il trasporto dei materiali è spesso la voce più sottovalutata.",
    rischi: "Zona sismica 2: i terremoti umbri del 1997 e del 2016 hanno reso le verifiche strutturali una prassi.",
    materiale: "pietra calcarea e laterizio",
  },
  salerno: {
    costruito: "Centro storico medievale arroccato sotto il castello di Arechi, lungomare novecentesco e quartieri recenti verso la piana del Sele.",
    quartieri: ["Centro storico", "Torrione", "Pastena", "Mercatello"],
    cantiere: "Nel centro storico scale e vicoli in pendenza limitano i mezzi.",
    rischi: "Il terremoto dell'Irpinia del 1980 colpì anche Salerno; l'alluvione del 1954 resta un riferimento per il rischio idrogeologico dei torrenti.",
    costiera: true,
  },
  cagliari: {
    costruito: "I quattro quartieri storici (Castello, Marina, Stampace, Villanova) sono costruiti in pietra calcarea; attorno, l'espansione del Novecento verso Is Mirrionis e il Poetto.",
    quartieri: ["Castello", "Marina", "Stampace", "Villanova"],
    cantiere: "Castello sta su un colle con mura e strade strette: accessi e sosta dei mezzi vanno chiesti in anticipo.",
    costiera: true,
    materiale: "pietra calcarea",
  },
  ancona: {
    costruito: "Città portuale su un promontorio, con il centro storico sul colle Guasco e quartieri residenziali del Novecento sulle colline circostanti.",
    quartieri: ["Centro storico", "Piano San Lazzaro", "Pinocchio", "Torrette"],
    cantiere: "Pendenze e strade strette sui colli; in zona porto contano i permessi di accesso.",
    rischi: "Zona sismica 2: il terremoto del 1972 e la frana di Posatora del 1982 hanno segnato la città.",
    costiera: true,
  },
  "reggio-calabria": {
    costruito: "Dopo il terremoto del 1908 la città fu ricostruita con il piano De Nava, a maglia regolare e con edifici bassi; il lungomare Falcomatà ne è l'affaccio principale.",
    quartieri: ["Centro", "Santa Caterina", "Sbarre", "Pellaro"],
    cantiere: "Il tessuto regolare del centro facilita gli accessi; nelle frazioni collinari contano pendenze e strade strette.",
    rischi: "Zona sismica 1, la più alta: il terremoto del 28 dicembre 1908 distrusse la città insieme a Messina.",
    costiera: true,
  },
  sassari: {
    costruito: "Centro storico medievale attorno al Corso, quartieri ottocenteschi e un'ampia espansione residenziale del secondo Novecento; sede universitaria dal XVI secolo.",
    quartieri: ["Centro storico", "Monte Rosello", "Luna e Sole", "Santa Maria di Pisa"],
    cantiere: "Nel centro storico vicoli stretti e ZTL; fuori, accessi semplici.",
  },
  messina: {
    costruito: "Dopo il terremoto del 1908 la città fu ricostruita con norme antisismiche e altezze limitate; restano ancora aree di baraccamenti nate allora, oggetto di risanamento.",
    quartieri: ["Centro", "Giostra", "Santa Margherita", "Ganzirri"],
    cantiere: "Il centro è a maglia regolare; nei villaggi collinari e sulla riviera nord accessi più difficili.",
    rischi: "Zona sismica 1, la più alta: il terremoto del 28 dicembre 1908 è il più distruttivo della storia italiana.",
    costiera: true,
  },
  parma: {
    costruito: "Centro storico ducale e l'Oltretorrente sulla riva sinistra del torrente Parma, con quartieri residenziali del Novecento e aree produttive dell'agroalimentare.",
    quartieri: ["Centro storico", "Oltretorrente", "Montanara", "San Leonardo"],
    cantiere: "ZTL nel centro; fuori, accessi semplici. Una parte della città è servita dal teleriscaldamento.",
    teleriscaldamento: "Iren",
  },
  "reggio-emilia": {
    costruito: "Centro storico esagonale entro i viali, quartieri del Novecento e una vasta area produttiva meccanica e ceramica; a nord i ponti di Calatrava sull'A1.",
    quartieri: ["Centro storico", "Santa Croce", "Ospizio", "Rosta Nuova"],
    cantiere: "Accessi semplici fuori dal centro (ZTL); una parte della città è servita dal teleriscaldamento.",
    teleriscaldamento: "Iren",
  },
};
