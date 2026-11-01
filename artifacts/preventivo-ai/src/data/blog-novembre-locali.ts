// Corpi degli articoli locali di novembre 2026 (metadati in
// ./blog-novembre-index.ts). Ogni dato di città viene da ./citta/fatti.ts e
// ./citta/profili.ts (fonti pubbliche, vedi lì): le tabelle si generano da
// quei dati, così pagine città e articoli non possono divergere. Nessun
// indice di prezzo per città.
import { FATTI_CITTA, RISCALDAMENTO, SISMICA_AG, TRASMITTANZA_MAX, num, type FattiCitta } from "./citta/fatti.js";
import { PROFILI_CITTA } from "./citta/profili.js";

const CITTA = Object.values(FATTI_CITTA);
const f = (slug: string): FattiCitta => {
  const c = FATTI_CITTA[slug];
  if (!c) throw new Error(`blog-novembre-locali: città "${slug}" senza dati verificati`);
  return c;
};
const p = (slug: string) => PROFILI_CITTA[slug]!;

function orario(z: FattiCitta["zonaClimatica"]): string {
  const r = RISCALDAMENTO[z];
  return r.ore === null ? "nessun limite" : `${r.dal} – ${r.al}, ${r.ore} h/giorno`;
}

/** Per la prosa: "dal 15 ottobre al 15 aprile, per al massimo 14 ore al giorno". */
function periodo(z: FattiCitta["zonaClimatica"]): string {
  const r = RISCALDAMENTO[z];
  return r.ore === null ? "senza limiti di periodo e di orario" : `dal ${r.dal} al ${r.al}, per al massimo ${r.ore} ore al giorno`;
}

const righeClimatiche = [...CITTA]
  .sort((a, b) => b.gradiGiorno - a.gradiGiorno)
  .map((c) => {
    const t = TRASMITTANZA_MAX[c.zonaClimatica];
    return `    <tr><td>${c.nome} (${c.provincia})</td><td>${c.zonaClimatica}</td><td>${num(c.gradiGiorno)}</td><td>${orario(c.zonaClimatica)}</td><td>${num(t.pareti, 2)}</td><td>${num(t.finestre, 2)}</td></tr>`;
  })
  .join("\n");

const righeSismiche = [...CITTA]
  .sort((a, b) => a.zonaSismica - b.zonaSismica || a.nome.localeCompare(b.nome, "it"))
  .map((c) => `    <tr><td>${c.nome} (${c.provincia})</td><td>${c.regione}</td><td>${c.sismicaEtichetta ?? c.zonaSismica}</td><td>${SISMICA_AG[c.zonaSismica]}</td></tr>`)
  .join("\n");

const cittaPerZona = (z: 1 | 2 | 3 | 4) => CITTA.filter((c) => c.zonaSismica === z).map((c) => c.nome).join(", ");

/** Riquadro "i dati della città" in testa agli articoli di ristrutturazione. */
function datiCitta(slug: string): string {
  const c = f(slug);
  const t = TRASMITTANZA_MAX[c.zonaClimatica];
  return `<table>
  <thead>
    <tr><th>${c.nome}: dato</th><th>Valore</th><th>Fonte</th></tr>
  </thead>
  <tbody>
    <tr><td>Popolazione</td><td>${num(c.popolazione)} abitanti</td><td>ISTAT, stima al 1/1/2026</td></tr>
    <tr><td>Zona climatica e gradi giorno</td><td>${c.zonaClimatica}, ${num(c.gradiGiorno)} GG</td><td>D.P.R. 412/1993, tabella A</td></tr>
    <tr><td>Periodo di accensione del riscaldamento</td><td>${orario(c.zonaClimatica)}</td><td>D.P.R. 74/2013</td></tr>
    <tr><td>Zona sismica</td><td>${c.sismicaEtichetta ?? c.zonaSismica} (accelerazione ${SISMICA_AG[c.zonaSismica]})</td><td>classificazione regionale</td></tr>
    <tr><td>Trasmittanza massima per le detrazioni: pareti / finestre</td><td>${num(t.pareti, 2)} / ${num(t.finestre, 2)} W/m²K</td><td>D.M. 6/8/2020, Allegato E</td></tr>
  </tbody>
</table>`;
}

/** Permessi: uguali in tutta Italia (D.P.R. 380/2001), ripetuti negli articoli città. */
const PERMESSI = `<h2>Che permesso serve</h2>
<p>I titoli edilizi sono gli stessi in tutta Italia (D.P.R. 380/2001); cambia solo lo sportello a cui si presentano, il SUE del Comune, quasi sempre in via telematica:</p>
<ul>
  <li><strong>Edilizia libera</strong>: tinteggiature, sostituzione di pavimenti e rivestimenti, riparazione degli impianti senza modificarli. Non serve nessuna comunicazione.</li>
  <li><strong>CILA</strong> (art. 6-bis): manutenzione straordinaria senza parti strutturali, come spostare tramezzi, rifare gli impianti, unire o dividere stanze. La presenta un tecnico prima di iniziare; senza CILA la sanzione è di 1.000 €.</li>
  <li><strong>SCIA</strong> (artt. 22–23): interventi che toccano le strutture, il restauro e la ristrutturazione edilizia.</li>
  <li><strong>Autorizzazioni aggiuntive</strong>: per gli edifici vincolati serve l'autorizzazione della Soprintendenza (D.Lgs. 42/2004, art. 21), per le opere strutturali le procedure sismiche regionali, in condominio il rispetto del regolamento.</li>
</ul>
<p>Per cosa si rischia senza titolo vedi <a href="/blog/lavori-casa-senza-permessi-rischi/">lavori in casa senza permessi</a>; per sapere quando serve il tecnico, <a href="/blog/geometra-quando-serve-lavori-casa/">quando serve un geometra</a>.</p>`;

/** I costi di riferimento sono nazionali: si rimanda agli articoli con le fasce. */
const COSTI = `<p>Per i prezzi delle singole lavorazioni valgono le fasce nazionali, che nelle grandi città stanno di solito nella metà alta: <a href="/blog/quanto-costa-ristrutturare-bagno/">bagno</a>, <a href="/blog/quanto-costa-impianto-elettrico/">impianto elettrico</a>, <a href="/blog/costo-impianto-idraulico-appartamento/">impianto idraulico</a>, <a href="/blog/prezzi-posa-pavimento-gres-parquet/">pavimenti</a>, <a href="/blog/quanto-costa-tinteggiatura-appartamento/">tinteggiatura</a>, <a href="/blog/costo-serramenti-infissi-sostituzione/">infissi</a>. Il riferimento ufficiale per la regione è il prezzario regionale dei lavori pubblici (vedi la guida ai <a href="/blog/prezzari-regionali-lavori-edili/">prezzari regionali</a>). Un esempio di preventivo completo, voce per voce, è nel <a href="/blog/preventivo-ristrutturazione-casa-esempio/">preventivo di ristrutturazione passo per passo</a>.</p>`;

export const BLOG_NOVEMBRE_LOCALI: Record<string, string> = {
  "zone-climatiche-citta-italiane": `
<p>La <strong>zona climatica</strong> di un comune, da A (la più calda) a F (la più fredda), dipende dai suoi <strong>gradi giorno</strong> e decide due cose che entrano nei preventivi: il periodo in cui si può accendere il riscaldamento e la trasmittanza massima che pareti, coperture e finestre devono rispettare per accedere alle detrazioni. Qui trovi i dati di ${CITTA.length} città italiane, dalle fonti ufficiali, e come usarli.</p>

<h2>Cosa sono i gradi giorno</h2>
<p>I gradi giorno (GG) sono la somma, su tutti i giorni del periodo di riscaldamento, della differenza tra 20 °C e la temperatura media esterna del giorno. Più sono alti, più una casa ha bisogno di calore durante l'anno. Il D.P.R. 412/1993 assegna a ogni comune i suoi gradi giorno e la zona climatica: fino a 600 GG zona A, fino a 900 B, fino a 1.400 C, fino a 2.100 D, fino a 3.000 E, oltre F.</p>

<h2>Le città, dalla più fredda alla più calda</h2>
<table>
  <thead>
    <tr><th>Città</th><th>Zona</th><th>Gradi giorno</th><th>Accensione (D.P.R. 74/2013)</th><th>Pareti max W/m²K</th><th>Finestre max W/m²K</th></tr>
  </thead>
  <tbody>
${righeClimatiche}
  </tbody>
</table>
<p>Fonti: gradi giorno e zone dal D.P.R. 412/1993 aggiornato; periodi di accensione dal D.P.R. 74/2013; trasmittanze massime per le detrazioni dal D.M. 6/8/2020 "Requisiti", Allegato E. I Comuni possono ampliare il periodo di accensione con ordinanza in caso di freddo eccezionale.</p>

<h2>Cosa cambia nei preventivi</h2>
<h3>Serramenti</h3>
<p>Per la detrazione, la finestra nuova deve avere una trasmittanza Uw non superiore a quella della zona: ${num(TRASMITTANZA_MAX.E.finestre, 2)} W/m²K in zona E, ${num(TRASMITTANZA_MAX.C.finestre, 2)} in zona C. Il valore va scritto nel preventivo e nella dichiarazione del produttore. Vedi il <a href="/blog/costo-serramenti-infissi-sostituzione/">costo degli infissi</a>.</p>
<h3>Cappotto e coperture</h3>
<p>Lo spessore dell'isolante si sceglie per raggiungere la trasmittanza della zona: in zona E servono di solito 12–14 cm di EPS grafitato su una muratura media, in zona C 8–10 cm. Vedi <a href="/blog/quanto-costa-cappotto-termico/">quanto costa il cappotto termico</a> e il <a href="/blog/costo-rifacimento-tetto-materiali-prezzi/">costo del rifacimento del tetto</a>.</p>
<h3>Impianti di riscaldamento</h3>
<p>Nelle zone E e F, con molte ore di accensione, l'efficienza del generatore pesa di più sui consumi: una pompa di calore va dimensionata sulla temperatura esterna di progetto del comune, e spesso conviene isolare prima. Vedi <a href="/blog/quanto-costa-pompa-di-calore/">quanto costa una pompa di calore</a> e la <a href="/blog/normativa-impianti-termici-obblighi/">normativa sugli impianti termici</a>.</p>

<h2>Le pagine per città</h2>
<p>Per ogni città della tabella ci sono le pagine del generatore di preventivi con i dati locali applicati al mestiere, per esempio <a href="/preventivi/serramentista/milano/">serramentisti a Milano</a>, <a href="/preventivi/termoidraulico/torino/">termoidraulici a Torino</a>, <a href="/preventivi/serramentista/roma/">serramentisti a Roma</a>, <a href="/preventivi/condizionatori/palermo/">condizionatori a Palermo</a>.</p>

<h2>Domande frequenti</h2>
<h3>Come trovo la zona climatica di un comune che non è in tabella?</h3>
<p>Ogni comune ha la sua nella tabella A del D.P.R. 412/1993, aggiornata nel tempo; la trovi anche nella pagina del comune su molti siti di dati pubblici. Due comuni vicini possono avere zone diverse per l'altitudine.</p>
<h3>Conta la zona del comune o quella dell'edificio?</h3>
<p>Quella del comune, anche per le frazioni ad altitudine diversa, salvo i casi in cui il Comune abbia indicazioni proprie per le frazioni.</p>
<h3>La zona F non ha limiti di accensione?</h3>
<p>Esatto: nei comuni in zona F il D.P.R. 74/2013 non fissa né periodo né ore massime di accensione.</p>
`,

  "zone-sismiche-citta-italiane": `
<p>Tutto il territorio italiano è classificato in <strong>quattro zone sismiche</strong>, dalla 1 (pericolosità più alta) alla 4 (più bassa). Per chi lavora sugli edifici la zona conta quando l'intervento tocca le strutture: un'apertura in un muro portante, un solaio, una scala, un soppalco. Ecco le zone di ${CITTA.length} città italiane e cosa cambiano nel lavoro e nel preventivo.</p>

<h2>Le quattro zone</h2>
<p>La classificazione nasce dall'OPCM 3274/2003 ed è stata poi recepita e aggiornata da ogni Regione con proprie delibere. A ogni zona corrisponde un intervallo di accelerazione orizzontale massima attesa su suolo rigido (con probabilità del 10% in 50 anni, OPCM 3519/2006):</p>
<ul>
  <li><strong>Zona 1</strong>: ${SISMICA_AG[1]}</li>
  <li><strong>Zona 2</strong>: ${SISMICA_AG[2]}</li>
  <li><strong>Zona 3</strong>: ${SISMICA_AG[3]}</li>
  <li><strong>Zona 4</strong>: ${SISMICA_AG[4]}</li>
</ul>
<p>Per la progettazione, le Norme tecniche per le costruzioni (NTC 2018) usano poi la pericolosità calcolata punto per punto, non solo la zona.</p>

<h2>Le città per zona</h2>
<table>
  <thead>
    <tr><th>Città</th><th>Regione</th><th>Zona sismica</th><th>Accelerazione di riferimento</th></tr>
  </thead>
  <tbody>
${righeSismiche}
  </tbody>
</table>
<p>${f("roma").sismicaNota ?? ""} Fonte: classificazioni regionali vigenti. In sintesi, tra le città della tabella sono in zona 1 ${cittaPerZona(1)}; in zona 2 ${cittaPerZona(2)}; in zona 4 ${cittaPerZona(4)}.</p>

<h2>Cosa cambia per i lavori</h2>
<h3>Lavori che non toccano le strutture</h3>
<p>Tramezzi in cartongesso o forati, impianti, pavimenti, finiture: la zona sismica non cambia le procedure. Conta però il peso: sostituire un tramezzo leggero con uno in laterizio pieno, o fare un massetto molto spesso, aggiunge carico al solaio. Vedi <a href="/blog/quanto-costa-cartongesso/">il cartongesso</a> e <a href="/blog/quanto-costa-massetto/">il massetto</a>.</p>
<h3>Interventi strutturali</h3>
<p>Aprire un vano in un muro portante, rinforzare un solaio, rifare una scala: servono un progetto firmato da un ingegnere o un architetto e il deposito o l'autorizzazione presso l'ufficio sismico regionale (artt. 93–94 del D.P.R. 380/2001, con le procedure di ogni Regione). Nelle zone 1 e 2 molte Regioni richiedono l'autorizzazione preventiva invece del semplice deposito, con tempi più lunghi. Le NTC distinguono tra riparazioni o interventi locali, miglioramento e adeguamento sismico (§8.4).</p>
<h3>Nel preventivo</h3>
<ul>
  <li>separare le opere strutturali e indicare che si eseguono secondo il progetto e dopo il deposito o l'autorizzazione;</li>
  <li>prevedere le voci tipiche: cerchiature in acciaio per le aperture, puntellature, prove sui materiali;</li>
  <li>escludere o quotare a parte la progettazione e la direzione lavori strutturale, se non sono a carico dell'impresa.</li>
</ul>

<h2>Detrazioni per gli interventi antisismici</h2>
<p>Gli interventi di riduzione del rischio sismico rientrano tra quelli agevolati; nel 2026 seguono le stesse aliquote della detrazione per ristrutturazione (50% sull'abitazione principale, 36% sulle altre). Le regole e le scadenze cambiano spesso: vedi la <a href="/blog/bonus-edilizi-2026-guida-artigiani/">guida ai bonus edilizi 2026</a> e verificate con il commercialista.</p>

<h2>Le pagine per città</h2>
<p>Le pagine del generatore per i muratori e le imprese edili riportano zona sismica e carico neve della città, per esempio <a href="/preventivi/muratore/napoli/">muratori a Napoli</a>, <a href="/preventivi/muratore/catania/">a Catania</a>, <a href="/preventivi/edilizia/reggio-calabria/">imprese edili a Reggio Calabria</a>, <a href="/preventivi/muratore/brescia/">muratori a Brescia</a>.</p>

<h2>Domande frequenti</h2>
<h3>Per spostare un tramezzo serve il progetto strutturale?</h3>
<p>No, se il tramezzo non è portante. Ma va verificato: negli edifici in muratura alcune pareti interne sono portanti, e solo un tecnico può dirlo con certezza.</p>
<h3>La zona sismica cambia il prezzo dei lavori?</h3>
<p>Per i lavori non strutturali no. Per quelli strutturali, nelle zone più alte i calcoli e i dettagli richiesti fanno salire progettazione e opere.</p>
<h3>Dove trovo la zona di un comune?</h3>
<p>Negli elenchi della propria Regione, che pubblica la classificazione vigente, o nella mappa della pericolosità sismica dell'INGV per i valori puntuali.</p>
`,

  "ristrutturare-casa-milano": `
<p>Ristrutturare casa a Milano significa quasi sempre lavorare in condominio, in un edificio che può essere una casa di ringhiera di fine Ottocento o un condominio degli anni '60, con un furgone che deve entrare in Area B e spesso in Area C. Le regole edilizie sono quelle di tutta Italia; cambia il contesto, e il contesto pesa sul preventivo. Ecco cosa sapere prima di chiedere o di fare un preventivo a Milano.</p>

<h2>I dati di Milano che entrano nei lavori</h2>
${datiCitta("milano")}

<h2>Com'è fatta la città</h2>
<p>${p("milano").costruito} Quartieri come ${p("milano").quartieri.join(", ")} hanno edifici e problemi molto diversi tra loro: nelle case di ringhiera i solai in legno e le murature miste, nei condomini del dopoguerra impianti spesso da rifare e facciate con distacchi.</p>

<h2>Il cantiere a Milano</h2>
<ul>
  <li><strong>Mezzi</strong>: ${p("milano").cantiere}</li>
  <li><strong>Condominio</strong>: orari dei lavori rumorosi, protezione delle parti comuni, uso dell'ascensore per i materiali e comunicazione all'amministratore sono di solito previsti dal regolamento.</li>
  <li><strong>Suolo pubblico</strong>: cassoni per le macerie e ponteggi sul marciapiede richiedono la concessione del Comune e il pagamento del canone. Vedi <a href="/blog/quanto-costa-smaltimento-macerie/">quanto costa smaltire le macerie</a>.</li>
  <li><strong>Interrati</strong>: ${p("milano").rischi}</li>
</ul>

${PERMESSI}

<h2>Impianti e clima</h2>
<p>Milano è in zona climatica ${f("milano").zonaClimatica}, con ${num(f("milano").gradiGiorno)} gradi giorno: per le detrazioni le finestre nuove non devono superare ${num(TRASMITTANZA_MAX[f("milano").zonaClimatica].finestre, 2)} W/m²K. Molti condomini sono allacciati al teleriscaldamento (${p("milano").teleriscaldamento}): in quel caso l'intervento termico riguarda la sottostazione e la contabilizzazione, non una caldaia. Per le estati sempre più calde, la climatizzazione è ormai una voce frequente nelle ristrutturazioni: vedi i <a href="/blog/prezzi-condizionatori-installazione-2026/">prezzi dei condizionatori</a>.</p>

<h2>Cosa pesa sui costi</h2>
<p>Rispetto a un piccolo centro, a Milano pesano soprattutto la logistica (mezzi conformi, parcheggio, ascensore, scale), i tempi del condominio e il costo della manodopera. ${COSTI}</p>

<h2>Preventivi per Milano</h2>
<p>Le pagine del generatore per Milano applicano questi dati ai singoli mestieri: <a href="/preventivi/ristrutturazione/milano/">ristrutturazione</a>, <a href="/preventivi/elettricista/milano/">elettricisti</a>, <a href="/preventivi/idraulico/milano/">idraulici</a>, <a href="/preventivi/imbianchino/milano/">imbianchini</a>, <a href="/preventivi/serramentista/milano/">serramentisti</a>. Per l'area metropolitana ci sono anche <a href="/preventivi/ristrutturazione/monza/">Monza</a> e le altre città lombarde.</p>

<h2>Domande frequenti</h2>
<h3>Quanto tempo serve per ristrutturare un appartamento a Milano?</h3>
<p>Per un appartamento di 70–90 mq con impianti nuovi, bagno e pavimenti, di solito 2–4 mesi, a cui si aggiungono i tempi della CILA e degli eventuali permessi per il suolo pubblico.</p>
<h3>Serve avvisare l'amministratore?</h3>
<p>Sì, è buona norma e spesso lo prevede il regolamento; per i lavori che toccano parti comuni o strutture va comunicato per legge (art. 1122 c.c.).</p>
<h3>Come confronto i preventivi?</h3>
<p>Voce per voce, con le stesse quantità: vedi <a href="/blog/come-confrontare-preventivi-ristrutturazione/">come confrontare i preventivi di ristrutturazione</a>.</p>
`,

  "ristrutturare-casa-roma": `
<p>Roma è il comune più popoloso d'Italia e uno dei più vari da ristrutturare: palazzi storici nel centro UNESCO, palazzine del dopoguerra a Monteverde e al Tuscolano, quartieri recenti oltre il Raccordo. È anche l'unica grande città divisa in sottozone sismiche diverse per municipio. Ecco i dati e le regole che contano per chi ristruttura o fa preventivi a Roma.</p>

<h2>I dati di Roma che entrano nei lavori</h2>
${datiCitta("roma")}
<p>${f("roma").sismicaNota}</p>

<h2>Com'è fatta la città</h2>
<p>${p("roma").costruito} Nei quartieri come ${p("roma").quartieri.join(", ")} il patrimonio va dal palazzo umbertino in ${p("roma").materiale} alla palazzina in cemento armato degli anni '60.</p>

<h2>Il cantiere a Roma</h2>
<ul>
  <li><strong>Accessi</strong>: ${p("roma").cantiere}</li>
  <li><strong>Centro storico</strong>: il ${p("roma").unesco?.replace(/ \((\d{4})\)/, ", patrimonio UNESCO dal $1,")} comprende moltissimi edifici vincolati: per qualunque intervento su un immobile tutelato serve l'autorizzazione della Soprintendenza, e i tempi si allungano.</li>
  <li><strong>Strutture</strong>: nelle sottozone 2B le opere strutturali seguono procedure più rigorose; il progetto e il deposito vanno messi in conto prima dei lavori.</li>
  <li><strong>Macerie e ponteggi</strong>: concessione di suolo pubblico e orari di carico e scarico. Vedi <a href="/blog/quanto-costa-ponteggio/">quanto costa un ponteggio</a>.</li>
</ul>

${PERMESSI}

<h2>Impianti e clima</h2>
<p>Roma è in zona climatica ${f("roma").zonaClimatica} con ${num(f("roma").gradiGiorno)} gradi giorno: riscaldamento ${periodo(f("roma").zonaClimatica)}, e per le detrazioni finestre entro ${num(TRASMITTANZA_MAX[f("roma").zonaClimatica].finestre, 2)} W/m²K e pareti entro ${num(TRASMITTANZA_MAX[f("roma").zonaClimatica].pareti, 2)} W/m²K. Il raffrescamento estivo pesa quanto il riscaldamento: schermature, isolamento delle coperture e climatizzazione sono voci frequenti nei preventivi romani.</p>

<h2>Cosa pesa sui costi</h2>
<p>Nel centro storico pesano accessi, ZTL, vincoli e tempi delle autorizzazioni; nei quartieri esterni il lavoro è più simile a quello di qualunque grande città. ${COSTI}</p>

<h2>Preventivi per Roma</h2>
<p>Le pagine del generatore per Roma applicano questi dati ai singoli mestieri: <a href="/preventivi/ristrutturazione/roma/">ristrutturazione</a>, <a href="/preventivi/muratore/roma/">muratori</a>, <a href="/preventivi/elettricista/roma/">elettricisti</a>, <a href="/preventivi/idraulico/roma/">idraulici</a>, <a href="/preventivi/condizionatori/roma/">condizionatori</a>.</p>

<h2>Domande frequenti</h2>
<h3>Come so se il mio palazzo è vincolato?</h3>
<p>Lo indica la visura dei vincoli presso la Soprintendenza o il certificato di destinazione urbanistica; il tecnico che prepara la pratica lo verifica prima di iniziare.</p>
<h3>Per i lavori interni in centro storico serve la Soprintendenza?</h3>
<p>Se l'edificio è vincolato come bene culturale, sì, anche per molti lavori interni. Se si trova solo nell'area UNESCO ma non è vincolato, valgono le norme del piano regolatore per la Città storica.</p>
<h3>In quale sottozona sismica è il mio municipio?</h3>
<p>I municipi IV–IX sono in 2B, i municipi I–III e X–XV in 3A, l'isola amministrativa del municipio XV in 3B.</p>
`,

  "ristrutturare-casa-napoli": `
<p>Napoli è in zona sismica 2, sul mare, con un centro storico patrimonio UNESCO costruito in gran parte in tufo e un'area occidentale soggetta al bradisismo dei Campi Flegrei. Sono condizioni che chi ristruttura deve conoscere e che chi fa i preventivi deve mettere per iscritto. Ecco i dati e le regole che contano a Napoli.</p>

<h2>I dati di Napoli che entrano nei lavori</h2>
${datiCitta("napoli")}

<h2>Com'è fatta la città</h2>
<p>${p("napoli").costruito} Quartieri come ${p("napoli").quartieri.join(", ")} hanno condizioni molto diverse: murature in tufo e solai in legno o volte nel centro, palazzi ottocenteschi al Vomero e a Chiaia, cemento armato del dopoguerra in periferia.</p>

<h2>Il cantiere a Napoli</h2>
<ul>
  <li><strong>Trasporto dei materiali</strong>: ${p("napoli").cantiere}</li>
  <li><strong>Area flegrea</strong>: ${p("napoli").rischi} Prima di interventi su strutture in quell'area conviene informarsi presso il Comune sulle verifiche in corso.</li>
  <li><strong>Mare</strong>: la salsedine accelera il degrado di intonaci, ferri d'armatura dei balconi, serramenti e unità esterne dei condizionatori. Nei preventivi di facciata e balconi il trattamento dei ferri e i materiali resistenti alla corrosione non sono un optional.</li>
  <li><strong>Tufo</strong>: il ${p("napoli").materiale} è leggero e lavorabile ma assorbe acqua; intonaci e pitture devono essere traspiranti, e le aperture nei muri vanno progettate.</li>
</ul>

${PERMESSI}

<h2>Zona sismica 2: cosa cambia</h2>
<p>Napoli è in zona ${f("napoli").zonaSismica} (accelerazione ${SISMICA_AG[f("napoli").zonaSismica]}). Per i lavori che non toccano le strutture non cambia nulla; per aperture in muri portanti, solai, scale e soppalchi servono progetto strutturale e la procedura sismica della Regione Campania prima di iniziare. Vedi la guida alle <a href="/blog/zone-sismiche-citta-italiane/">zone sismiche delle città italiane</a>.</p>

<h2>Impianti e clima</h2>
<p>Napoli è in zona climatica ${f("napoli").zonaClimatica} con ${num(f("napoli").gradiGiorno)} gradi giorno: riscaldamento ${periodo(f("napoli").zonaClimatica)}. Per le detrazioni le finestre nuove non devono superare ${num(TRASMITTANZA_MAX[f("napoli").zonaClimatica].finestre, 2)} W/m²K. Con inverni miti ed estati calde la pompa di calore aria-aria o aria-acqua è spesso la scelta più sensata: vedi <a href="/blog/quanto-costa-pompa-di-calore/">quanto costa una pompa di calore</a>.</p>

<h2>Cosa pesa sui costi</h2>
<p>A Napoli pesano soprattutto il trasporto dei materiali nel centro, le opere su murature in tufo e la protezione dalla salsedine. ${COSTI}</p>

<h2>Preventivi per Napoli</h2>
<p>Le pagine del generatore per Napoli applicano questi dati ai singoli mestieri: <a href="/preventivi/ristrutturazione/napoli/">ristrutturazione</a>, <a href="/preventivi/muratore/napoli/">muratori</a>, <a href="/preventivi/elettricista/napoli/">elettricisti</a>, <a href="/preventivi/idraulico/napoli/">idraulici</a>. In Campania c'è anche la pagina di <a href="/preventivi/ristrutturazione/salerno/">Salerno</a>.</p>

<h2>Domande frequenti</h2>
<h3>Il mio palazzo nel centro storico è vincolato?</h3>
<p>Non tutti gli edifici del centro UNESCO sono vincolati come beni culturali: lo verifica il tecnico presso la Soprintendenza prima di presentare la pratica.</p>
<h3>Conviene fare una verifica strutturale prima di ristrutturare?</h3>
<p>In zona 2, e a maggior ragione nell'area flegrea, se si interviene sulle strutture è indispensabile; se si rifanno solo impianti e finiture è comunque utile far valutare lo stato di solai e balconi.</p>
<h3>I balconi sono a carico del condominio?</h3>
<p>Di norma i frontalini e le parti decorative che fanno parte della facciata sono comuni, la soletta del balcone aggettante è del proprietario. Dipende però dalla struttura e dal regolamento.</p>
`,

  "ristrutturare-casa-torino": `
<p>Torino ha un patrimonio edilizio riconoscibile: palazzi ottocenteschi con ballatoio, il centro barocco, i grandi quartieri operai del Novecento. E ha la rete di teleriscaldamento più estesa d'Italia, che cambia il modo di affrontare l'impianto termico in molti condomini. Ecco i dati e le regole che contano per chi ristruttura o fa preventivi a Torino.</p>

<h2>I dati di Torino che entrano nei lavori</h2>
${datiCitta("torino")}

<h2>Com'è fatta la città</h2>
<p>${p("torino").costruito} Nelle case a ballatoio di quartieri come ${p("torino").quartieri.slice(0, 2).join(" e ")} si lavora spesso su alloggi piccoli, uniti o riorganizzati, con bagni ricavati dove un tempo c'erano servizi sul ballatoio; nei quartieri del Novecento come ${p("torino").quartieri.slice(2).join(" e ")} su condomini con impianti da rifare.</p>

<h2>Il cantiere a Torino</h2>
<ul>
  <li><strong>Teleriscaldamento</strong>: ${p("torino").cantiere} Il gestore della rete è ${p("torino").teleriscaldamento}: per le modifiche all'allaccio si coordina con lui.</li>
  <li><strong>Ballatoi e cortili</strong>: materiali e macerie passano spesso dai ballatoi e dalle scale comuni; vanno protetti e il regolamento condominiale fissa orari e modalità.</li>
  <li><strong>Edifici storici</strong>: Torino fa parte del sito UNESCO ${p("torino").unesco?.replace(/ \((\d{4})\)/, ", iscritto nel $1")}. Sugli edifici vincolati serve l'autorizzazione della Soprintendenza.</li>
</ul>

${PERMESSI}

<h2>Impianti e clima</h2>
<p>Torino è in zona climatica ${f("torino").zonaClimatica} con ${num(f("torino").gradiGiorno)} gradi giorno, tra i valori più alti delle grandi città: riscaldamento ${periodo(f("torino").zonaClimatica)}. Per le detrazioni le pareti isolate non devono superare ${num(TRASMITTANZA_MAX[f("torino").zonaClimatica].pareti, 2)} W/m²K e le finestre ${num(TRASMITTANZA_MAX[f("torino").zonaClimatica].finestre, 2)} W/m²K. Con inverni così, l'isolamento di pareti, coperture e infissi ha un ritorno più rapido che nelle città del Sud: vedi <a href="/blog/quanto-costa-cappotto-termico/">quanto costa il cappotto termico</a> e il <a href="/blog/costo-serramenti-infissi-sostituzione/">costo degli infissi</a>.</p>

<h2>Cosa pesa sui costi</h2>
<p>A Torino pesano la logistica nei palazzi con ballatoio e cortile, il coordinamento con il teleriscaldamento e, negli alloggi vecchi, la quantità di impianti da rifare da zero. ${COSTI}</p>

<h2>Preventivi per Torino</h2>
<p>Le pagine del generatore per Torino applicano questi dati ai singoli mestieri: <a href="/preventivi/ristrutturazione/torino/">ristrutturazione</a>, <a href="/preventivi/termoidraulico/torino/">termoidraulici</a>, <a href="/preventivi/elettricista/torino/">elettricisti</a>, <a href="/preventivi/serramentista/torino/">serramentisti</a>.</p>

<h2>Domande frequenti</h2>
<h3>Con il teleriscaldamento posso mettere una pompa di calore?</h3>
<p>Tecnicamente sì, ma in un condominio allacciato la scelta riguarda di solito l'intero edificio e va decisa in assemblea, valutando il contratto con il gestore.</p>
<h3>Si può trasformare un ballatoio in una veranda?</h3>
<p>Chiudere un ballatoio modifica la facciata e crea volume o superficie: serve un titolo edilizio e, in condominio, il consenso previsto dal regolamento. Va verificato con il tecnico prima di qualunque preventivo.</p>
<h3>Che permesso serve per unire due alloggi?</h3>
<p>Di norma una CILA se non si toccano le strutture, una SCIA se si aprono vani in muri portanti. Va aggiornato anche il catasto.</p>
`,
};
