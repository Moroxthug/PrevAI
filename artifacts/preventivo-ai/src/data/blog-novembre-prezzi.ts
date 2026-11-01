// Corpi degli articoli "quanto costa" di novembre 2026 (metadati in
// ./blog-novembre-index.ts). Le fasce sono riferimenti di mercato IVA esclusa,
// coerenti con i prezzari regionali dei lavori pubblici e con gli altri
// articoli del blog; le norme citate sono indicate per numero.
import { TRASMITTANZA_MAX, num } from "./citta/fatti.js";

const T = TRASMITTANZA_MAX;

export const BLOG_NOVEMBRE_PREZZI: Record<string, string> = {
  "quanto-costa-cappotto-termico": `
<p>Nel 2026 un cappotto termico costa in media <strong>tra 55 e 130 € al metro quadro di facciata</strong>, posa e finitura comprese, a seconda dell'isolante e dello spessore. Il ponteggio è quasi sempre una voce a parte e aggiunge 10–25 € al mq. Per una villetta con 200 mq di pareti esterne si arriva così a 15.000–30.000 €, per una facciata condominiale il conto si fa voce per voce. Qui trovi i prezzi per materiale, gli spessori che servono nella tua zona climatica e un esempio di preventivo.</p>

<h2>Prezzi del cappotto termico al mq per isolante</h2>
<p>Il sistema a cappotto (in sigla ETICS) comprende pannello isolante, collante, tasselli, rasatura armata con rete, profili di partenza e d'angolo e finitura colorata. Le fasce 2026 per il solo sistema posato, senza ponteggio:</p>
<table>
  <thead>
    <tr><th>Isolante (spessore tipico)</th><th>Prezzo posato</th><th>Quando si usa</th></tr>
  </thead>
  <tbody>
    <tr><td>EPS bianco 10–12 cm</td><td>55–80 €/mq</td><td>Il più diffuso, ottimo rapporto prezzo/prestazioni</td></tr>
    <tr><td>EPS grafitato 10–14 cm</td><td>60–90 €/mq</td><td>Isola di più a pari spessore: utile dove lo spazio è poco</td></tr>
    <tr><td>Lana di roccia 10–14 cm</td><td>75–110 €/mq</td><td>Incombustibile, richiesta su edifici alti e per l'acustica</td></tr>
    <tr><td>Fibra di legno 12–16 cm</td><td>85–130 €/mq</td><td>Traspirante e con buona inerzia termica, per chi vuole materiali naturali</td></tr>
  </tbody>
</table>
<p>I prezzi salgono con facciate molto frastagliate (balconi, lesene, molte finestre), con le finiture a spessore o ai silicati e quando bisogna prima risanare l'intonaco. Scendono sulle grandi superfici lisce, dove la squadra lavora a ritmo pieno.</p>

<h2>Le voci che fanno la differenza tra due preventivi</h2>
<ul>
  <li><strong>Ponteggio</strong>: montaggio, smontaggio e noleggio per la durata del cantiere. Per un cappotto si calcolano 2–3 mesi. Vedi la guida su <a href="/blog/quanto-costa-ponteggio/">quanto costa un ponteggio</a>.</li>
  <li><strong>Davanzali e soglie</strong>: con 12 cm di isolante in più il davanzale esistente non sporge più. Prolunghe in alluminio o davanzali nuovi valgono 40–120 € al metro lineare.</li>
  <li><strong>Spallette delle finestre</strong>: isolarle con 2–3 cm evita i ponti termici; si contano a metro lineare (15–35 €/ml).</li>
  <li><strong>Pluviali, cavi, condizionatori, insegne</strong>: vanno smontati e rimontati più in fuori. Spesso sono "a corpo".</li>
  <li><strong>Zoccolatura</strong>: nella parte bassa, a contatto con l'umidità, serve un isolante specifico (XPS o EPS per zoccolatura), che costa di più.</li>
  <li><strong>Pratica edilizia e relazione energetica</strong>: per accedere alle detrazioni servono asseverazione dei requisiti e comunicazione all'ENEA entro 90 giorni dalla fine dei lavori.</li>
</ul>

<h2>Che spessore serve nella tua zona climatica</h2>
<p>Per le detrazioni la parete isolata deve rispettare la trasmittanza massima del D.M. 6/8/2020 (Allegato E), che dipende dalla zona climatica del comune:</p>
<table>
  <thead>
    <tr><th>Zona climatica</th><th>Trasmittanza massima pareti</th><th>Spessore indicativo (EPS grafitato su muratura media)</th></tr>
  </thead>
  <tbody>
    <tr><td>A e B</td><td>${num(T.A.pareti, 2)} W/m²K</td><td>6–8 cm</td></tr>
    <tr><td>C</td><td>${num(T.C.pareti, 2)} W/m²K</td><td>8–10 cm</td></tr>
    <tr><td>D</td><td>${num(T.D.pareti, 2)} W/m²K</td><td>10–12 cm</td></tr>
    <tr><td>E</td><td>${num(T.E.pareti, 2)} W/m²K</td><td>12–14 cm</td></tr>
    <tr><td>F</td><td>${num(T.F.pareti, 2)} W/m²K</td><td>14–16 cm</td></tr>
  </tbody>
</table>
<p>Lo spessore esatto lo dà il calcolo sulla stratigrafia reale del muro: un muro in pietra da 50 cm e una parete a cassa vuota anni '70 partono da valori molto diversi. La zona climatica delle principali città è nella guida alle <a href="/blog/zone-climatiche-citta-italiane/">zone climatiche delle città italiane</a>.</p>

<h2>Esempio di preventivo: villetta con 180 mq di facciata</h2>
<p>Cappotto in EPS grafitato 12 cm, zona climatica E, facciata in buono stato:</p>
<table>
  <thead>
    <tr><th>Voce</th><th>Q.tà</th><th>Prezzo</th><th>Importo</th></tr>
  </thead>
  <tbody>
    <tr><td>Ponteggio: montaggio, smontaggio e primo mese</td><td>200 mq</td><td>10 €</td><td>2.000 €</td></tr>
    <tr><td>Noleggio ponteggio mesi successivi</td><td>200 mq × 2</td><td>1,80 €</td><td>720 €</td></tr>
    <tr><td>Sistema a cappotto EPS grafitato 12 cm, rasatura armata e finitura</td><td>180 mq</td><td>72 €</td><td>12.960 €</td></tr>
    <tr><td>Zoccolatura in EPS per zoccolatura, h 50 cm</td><td>40 ml</td><td>38 €</td><td>1.520 €</td></tr>
    <tr><td>Isolamento spallette e profili con rete</td><td>90 ml</td><td>22 €</td><td>1.980 €</td></tr>
    <tr><td>Prolunghe davanzali in alluminio preverniciato</td><td>12 ml</td><td>65 €</td><td>780 €</td></tr>
    <tr><td>Smontaggio e rimontaggio pluviali e unità esterne</td><td>a corpo</td><td></td><td>650 €</td></tr>
    <tr><td><strong>Imponibile</strong></td><td></td><td></td><td><strong>20.610 €</strong></td></tr>
  </tbody>
</table>
<p>Sono circa 115 € al mq di facciata tutto compreso. Con IVA al 10% (intervento su abitazione) il totale è 22.671 €. Sulla scelta dell'aliquota vedi la guida all'<a href="/blog/iva-lavori-edili/">IVA sui lavori edili</a>.</p>

<h2>Detrazioni nel 2026</h2>
<p>Il cappotto rientra nella detrazione per la riqualificazione energetica: nel 2026 è del 50% sull'abitazione principale e del 36% sulle altre unità, in 10 rate annuali, a patto di rispettare le trasmittanze della tabella e di inviare la pratica all'ENEA. Sulle parti comuni dei condomini la detrazione segue le stesse regole, ripartita per millesimi. Le aliquote cambiano spesso con la legge di bilancio: verificate sempre con il commercialista prima di firmare.</p>

<h2>Cosa controllare nel preventivo del cappotto</h2>
<ul>
  <li>tipo e marca dell'isolante, spessore e conducibilità (λ) dichiarata;</li>
  <li>sistema certificato completo (collante, rete, rasante, finitura dello stesso produttore) e posa secondo la UNI/TR 11715;</li>
  <li>numero e tipo di tasselli per mq;</li>
  <li>ponteggio compreso o escluso, e per quanti mesi;</li>
  <li>davanzali, spallette, zoccolatura e smontaggi: inclusi o a parte;</li>
  <li>asseverazione e pratica ENEA comprese, se servono le detrazioni.</li>
</ul>
<p>Chi fa il preventivo può partire dal <a href="/preventivi/edilizia/">generatore di preventivi per imprese edili</a>: descrivi la facciata e ottieni tutte le voci con quantità e IVA in pochi secondi.</p>

<h2>Domande frequenti</h2>
<h3>Quanto costa un cappotto per una casa di 100 mq?</h3>
<p>Una casa di 100 mq calpestabili su un piano ha di solito 110–150 mq di pareti esterne. Con EPS e ponteggio il costo va da 9.000 a 17.000 € IVA esclusa.</p>
<h3>Si può fare il cappotto solo su una parete?</h3>
<p>Sì, ma conviene isolare almeno le pareti più esposte a nord e quelle dei locali più freddi. In condominio il cappotto su una sola facciata richiede comunque la delibera dell'assemblea, perché tocca l'aspetto esterno dell'edificio.</p>
<h3>Il cappotto interno costa meno?</h3>
<p>Il materiale costa di più al mq (pannelli accoppiati al cartongesso), ma non serve il ponteggio: 40–80 €/mq. Si perde però spazio interno e i ponti termici dei solai restano. Vedi <a href="/blog/quanto-costa-cartongesso/">quanto costa il cartongesso</a>.</p>
<h3>Quanto tempo serve?</h3>
<p>Per una villetta 3–6 settimane di lavoro a ponteggio montato, meteo permettendo: colle e rasanti non si applicano sotto i 5 °C né con pioggia.</p>
`,

  "quanto-costa-cartongesso": `
<p>Il cartongesso nel 2026 costa <strong>35–60 € al mq per una parete divisoria</strong> e <strong>28–50 € al mq per un controsoffitto</strong>, posa compresa, con stuccatura dei giunti pronta per la pittura. I prezzi salgono con lastre speciali, doppia lastra, isolante acustico e lavorazioni a misura come velette, nicchie e gole luminose. Ecco le fasce per ogni tipo di lavoro e cosa deve esserci nel preventivo.</p>

<h2>Prezzi del cartongesso al mq nel 2026</h2>
<table>
  <thead>
    <tr><th>Lavorazione</th><th>Prezzo posato</th></tr>
  </thead>
  <tbody>
    <tr><td>Parete divisoria, struttura 50–75 mm, una lastra per lato, lana minerale nell'intercapedine</td><td>35–50 €/mq</td></tr>
    <tr><td>Parete divisoria, doppia lastra per lato (più rigida e più isolante acusticamente)</td><td>45–60 €/mq</td></tr>
    <tr><td>Controparete su muro esistente, con isolante</td><td>30–50 €/mq</td></tr>
    <tr><td>Controsoffitto piano, struttura appesa e una lastra</td><td>28–40 €/mq</td></tr>
    <tr><td>Controsoffitto con isolante acustico o termico</td><td>38–55 €/mq</td></tr>
    <tr><td>Veletta, gola luminosa, cornice ribassata</td><td>30–60 € al metro lineare</td></tr>
    <tr><td>Nicchia o libreria in cartongesso</td><td>a corpo, 250–800 €</td></tr>
  </tbody>
</table>
<p>Le fasce comprendono struttura metallica, lastre, viti, nastro e stuccatura a tre mani dei giunti. Sono escluse di solito la pittura (vedi <a href="/blog/quanto-costa-tinteggiatura-appartamento/">quanto costa tinteggiare</a>), le porte e i passaggi degli impianti.</p>

<h2>Lastre speciali: quando servono e quanto costano in più</h2>
<ul>
  <li><strong>Idrorepellente</strong> (tipo H secondo la UNI EN 520, di solito verde): obbligatoria nei bagni e nelle cucine. +3–6 €/mq.</li>
  <li><strong>Ignifuga</strong> (tipo F, spesso rosa): per i locali dove serve resistenza al fuoco, come autorimesse e vani tecnici. +4–8 €/mq.</li>
  <li><strong>Ad alta densità o fonoisolante</strong>: tra camere e soggiorno o tra appartamenti. +5–10 €/mq.</li>
  <li><strong>Rinforzata</strong> per appendere pensili e mensole pesanti, o in alternativa traversi in legno o metallo dentro la parete: da prevedere prima di chiudere.</li>
</ul>

<h2>Esempio di preventivo: dividere un soggiorno e abbassare il corridoio</h2>
<table>
  <thead>
    <tr><th>Voce</th><th>Q.tà</th><th>Prezzo</th><th>Importo</th></tr>
  </thead>
  <tbody>
    <tr><td>Parete divisoria, struttura 75 mm, doppia lastra per lato, lana minerale 60 mm</td><td>14 mq</td><td>55 €</td><td>770 €</td></tr>
    <tr><td>Telaio per porta e rinforzi</td><td>1</td><td>120 €</td><td>120 €</td></tr>
    <tr><td>Controsoffitto corridoio, una lastra, stuccatura</td><td>9 mq</td><td>34 €</td><td>306 €</td></tr>
    <tr><td>Veletta con gola per striscia LED</td><td>6 ml</td><td>45 €</td><td>270 €</td></tr>
    <tr><td>Fori per faretti</td><td>6</td><td>12 €</td><td>72 €</td></tr>
    <tr><td>Protezioni, pulizia e trasporto sfridi</td><td>a corpo</td><td></td><td>150 €</td></tr>
    <tr><td><strong>Imponibile</strong></td><td></td><td></td><td><strong>1.688 €</strong></td></tr>
  </tbody>
</table>
<p>Il lavoro richiede di solito 3–4 giorni per una squadra di due persone, più i tempi di asciugatura dello stucco. Gli impianti elettrici dentro la parete (prese, interruttori, faretti) sono dell'elettricista e vanno nel suo preventivo.</p>

<h2>Cosa fa salire il prezzo</h2>
<h3>Altezze e superfici piccole</h3>
<p>Sopra i 3 metri servono trabattelli e più tempo; sotto i 10 mq il lavoro paga lo stesso la chiamata, il carico e lo scarico, e il prezzo al mq sale.</p>
<h3>Finitura</h3>
<p>Lo standard è la stuccatura dei giunti (livello di finitura base). Per pareti che verranno illuminate di taglio o dipinte con colori scuri serve la rasatura completa, che aggiunge 6–10 €/mq.</p>
<h3>Acustica</h3>
<p>Una parete tra due appartamenti deve rispettare i requisiti acustici passivi (D.P.C.M. 5/12/1997): doppia lastra, doppia struttura e isolante, con costi che arrivano a 70–90 €/mq.</p>

<h2>Serve un permesso per una parete in cartongesso?</h2>
<p>Spostare o creare tramezzi interni senza toccare le strutture è manutenzione straordinaria: serve la CILA, presentata da un tecnico al Comune prima di iniziare (art. 6-bis del D.P.R. 380/2001). Chi la omette rischia una sanzione di 1.000 €. Un controsoffitto o una controparete senza cambi di distribuzione rientrano invece nell'edilizia libera. Per i dettagli vedi <a href="/blog/lavori-casa-senza-permessi-rischi/">lavori in casa senza permessi</a>.</p>

<h2>Domande frequenti</h2>
<h3>Conviene il cartongesso o il mattone forato?</h3>
<p>Il cartongesso costa più o meno come un tramezzo in forati intonacato su entrambi i lati, ma si posa in metà tempo, non porta acqua nel cantiere e pesa molto meno sul solaio. Il forato resta preferibile dove si appendono carichi pesanti senza progettarli prima.</p>
<h3>Quanto costa un controsoffitto per tutta la casa?</h3>
<p>Per 80 mq di controsoffitto piano servono 2.300–3.200 € IVA esclusa, pittura esclusa.</p>
<h3>Che IVA si applica?</h3>
<p>Su un'abitazione si applica di norma il 10%, perché è manutenzione o ristrutturazione. Vedi la guida all'<a href="/blog/iva-lavori-edili/">IVA sui lavori edili</a>.</p>
`,

  "quanto-costa-massetto": `
<p>Un massetto nel 2026 costa <strong>15–25 € al mq</strong> in sabbia e cemento tradizionale per 5–6 cm, <strong>20–35 € al mq</strong> se autolivellante o per riscaldamento a pavimento, e <strong>18–30 € al mq</strong> se alleggerito per coprire gli impianti. Il prezzo dipende soprattutto dallo spessore, dal tipo di impasto e da come il materiale arriva al piano. Ecco le fasce, i tempi di asciugatura da mettere in programma e le voci che non devono mancare nel preventivo.</p>

<h2>Tipi di massetto e prezzi al mq</h2>
<table>
  <thead>
    <tr><th>Tipo</th><th>Spessore tipico</th><th>Prezzo posato</th></tr>
  </thead>
  <tbody>
    <tr><td>Sabbia e cemento tradizionale, tirato a staggia</td><td>5–6 cm</td><td>15–25 €/mq</td></tr>
    <tr><td>Premiscelato a presa rapida (posa in pochi giorni)</td><td>4–6 cm</td><td>22–35 €/mq</td></tr>
    <tr><td>Alleggerito (cemento cellulare o con argilla espansa), sopra gli impianti</td><td>6–10 cm</td><td>18–30 €/mq</td></tr>
    <tr><td>Autolivellante a base cemento o anidrite</td><td>3–5 cm</td><td>20–35 €/mq</td></tr>
    <tr><td>Massetto per pannelli radianti</td><td>3–5 cm sopra i tubi</td><td>20–35 €/mq</td></tr>
    <tr><td>Rasatura autolivellante di regolarizzazione</td><td>3–10 mm</td><td>10–18 €/mq</td></tr>
  </tbody>
</table>
<p>Ogni centimetro in più di massetto sabbia-cemento aggiunge indicativamente 2–3 €/mq. Sotto i 30–40 mq il prezzo al mq sale, perché i costi fissi (betoniera o pompa, trasporto, squadra) restano gli stessi.</p>

<h2>Le voci da mettere nel preventivo</h2>
<ul>
  <li><strong>Demolizione del vecchio massetto</strong>, se c'è: 12–25 €/mq, smaltimento a parte (vedi <a href="/blog/quanto-costa-smaltimento-macerie/">quanto costa smaltire le macerie</a>).</li>
  <li><strong>Strato di separazione</strong> (nylon o feltro) e <strong>fascia perimetrale</strong> comprimibile lungo i muri: evitano crepe e trasmissione del rumore.</li>
  <li><strong>Rete elettrosaldata o fibre</strong>, se richieste dal tipo di pavimento o dallo spessore.</li>
  <li><strong>Giunti</strong> di frazionamento nelle superfici grandi e sulle soglie.</li>
  <li><strong>Trasporto al piano</strong>: con pompa per sottofondi o a secchi. Nei centri storici senza accesso per i mezzi è una voce importante.</li>
  <li><strong>Isolante acustico anticalpestio</strong> sotto il massetto nei solai tra appartamenti: 6–12 €/mq.</li>
</ul>

<h2>Esempio: massetto per un appartamento di 70 mq</h2>
<table>
  <thead>
    <tr><th>Voce</th><th>Q.tà</th><th>Prezzo</th><th>Importo</th></tr>
  </thead>
  <tbody>
    <tr><td>Alleggerito sopra impianti, 7 cm</td><td>70 mq</td><td>22 €</td><td>1.540 €</td></tr>
    <tr><td>Materassino anticalpestio e fascia perimetrale</td><td>70 mq</td><td>8 €</td><td>560 €</td></tr>
    <tr><td>Massetto sabbia-cemento 5 cm con rete, tirato a staggia</td><td>70 mq</td><td>19 €</td><td>1.330 €</td></tr>
    <tr><td>Pompa per sottofondi e trasporto</td><td>a corpo</td><td></td><td>350 €</td></tr>
    <tr><td><strong>Imponibile</strong></td><td></td><td></td><td><strong>3.780 €</strong></td></tr>
  </tbody>
</table>
<p>Sono 54 €/mq per il pacchetto completo sotto il pavimento: alleggerito, isolamento e massetto. Senza alleggerito e anticalpestio si scende a circa 25 €/mq.</p>

<h2>Tempi di asciugatura: la voce che nessuno scrive</h2>
<p>Il massetto in sabbia e cemento tradizionale asciuga lentamente: la regola di cantiere è circa una settimana per centimetro in buone condizioni, quindi un mese e mezzo per 5–6 cm. Prima di posare parquet o resine bisogna misurare l'umidità residua con l'igrometro a carburo: per il legno su massetto cementizio il riferimento è il 2% (UNI 10329 e UNI 11371). I premiscelati rapidi permettono la posa delle piastrelle in 24–48 ore e del legno in pochi giorni, e costano di più proprio per questo.</p>
<p>Scrivere nel preventivo i tempi di asciugatura e chi esegue la misura evita la contestazione più comune: il parquet che si alza perché posato su un massetto ancora umido.</p>

<h2>Domande frequenti</h2>
<h3>Qual è lo spessore minimo di un massetto?</h3>
<p>Per un massetto sabbia-cemento aderente bastano 3–4 cm; se è galleggiante su isolante o separato dal solaio servono almeno 4–5 cm, di più con riscaldamento a pavimento secondo le indicazioni del sistema.</p>
<h3>Il massetto è compreso nel prezzo della posa del pavimento?</h3>
<p>Quasi mai: la posa delle piastrelle o del parquet si quota a parte. Vedi i <a href="/blog/prezzi-posa-pavimento-gres-parquet/">prezzi della posa dei pavimenti</a>.</p>
<h3>Si può posare il nuovo pavimento sopra il vecchio?</h3>
<p>Sì, se il vecchio è stabile e planare e se le porte e le soglie lo permettono: con piastrelle sottili o un autolivellante di pochi millimetri si evita la demolizione e il nuovo massetto.</p>
`,

  "quanto-costa-impermeabilizzazione-terrazzo": `
<p>Impermeabilizzare un terrazzo nel 2026 costa <strong>25–45 € al mq con guaina bituminosa</strong>, <strong>30–60 € al mq con guaina liquida o resina</strong> applicata sopra il pavimento esistente, e <strong>120–220 € al mq per il rifacimento completo</strong> con demolizione, nuovo massetto in pendenza, impermeabilizzazione e pavimento. La scelta dipende da dove entra l'acqua e da quanto è ancora sano il pavimento. Ecco come si legge il preventivo.</p>

<h2>Prezzi al mq per tipo di intervento</h2>
<table>
  <thead>
    <tr><th>Intervento</th><th>Prezzo indicativo</th></tr>
  </thead>
  <tbody>
    <tr><td>Guaina bituminosa a doppio strato (UNI EN 13707), su lastrico non pedonabile</td><td>25–45 €/mq</td></tr>
    <tr><td>Guaina ardesiata a vista come strato finale</td><td>+5–8 €/mq</td></tr>
    <tr><td>Guaina liquida poliuretanica o cementizia sopra il pavimento esistente</td><td>30–60 €/mq</td></tr>
    <tr><td>Resina trasparente su piastrelle (senza demolire)</td><td>35–60 €/mq</td></tr>
    <tr><td>Rifacimento completo: demolizione, massetto in pendenza, impermeabilizzazione, nuovo pavimento da esterno</td><td>120–220 €/mq</td></tr>
    <tr><td>Sigillatura di giunti e raccordi con il muro</td><td>15–30 € al metro lineare</td></tr>
  </tbody>
</table>

<h2>Dove entra davvero l'acqua</h2>
<p>Prima del prezzo conta la diagnosi. Nella maggior parte dei terrazzi l'acqua entra da pochi punti, e un'impermeabilizzazione sulla superficie non li risolve se non viene curata la parte perimetrale:</p>
<ul>
  <li><strong>risvolti contro i muri</strong> e le soglie delle porte finestre, spesso troppo bassi;</li>
  <li><strong>bocchettoni e pluviali</strong>, dove la guaina deve entrare nello scarico con un pezzo dedicato;</li>
  <li><strong>pendenze</strong> insufficienti, sotto l'1–1,5%, che lasciano ristagni;</li>
  <li><strong>giunti</strong> tra pavimento e parapetto, fughe rotte, soglie in pietra senza gocciolatoio.</li>
</ul>
<p>Un buon preventivo descrive questi punti uno per uno. Se riporta solo "impermeabilizzazione terrazzo, 60 mq", chiedete come vengono trattati i risvolti e gli scarichi.</p>

<h2>Esempio: rifacimento di un terrazzo di 30 mq</h2>
<table>
  <thead>
    <tr><th>Voce</th><th>Q.tà</th><th>Prezzo</th><th>Importo</th></tr>
  </thead>
  <tbody>
    <tr><td>Demolizione pavimento e massetto esistenti</td><td>30 mq</td><td>22 €</td><td>660 €</td></tr>
    <tr><td>Carico, trasporto e conferimento macerie</td><td>a corpo</td><td></td><td>450 €</td></tr>
    <tr><td>Massetto in pendenza (1,5%) sabbia-cemento</td><td>30 mq</td><td>26 €</td><td>780 €</td></tr>
    <tr><td>Doppia guaina bituminosa con risvolti di 20 cm</td><td>30 mq</td><td>38 €</td><td>1.140 €</td></tr>
    <tr><td>Bocchettoni a collare e raccordo ai pluviali</td><td>2</td><td>90 €</td><td>180 €</td></tr>
    <tr><td>Pavimento in gres da esterno R11, posa a colla</td><td>30 mq</td><td>70 €</td><td>2.100 €</td></tr>
    <tr><td>Battiscopa e soglie</td><td>24 ml</td><td>25 €</td><td>600 €</td></tr>
    <tr><td><strong>Imponibile</strong></td><td></td><td></td><td><strong>5.910 €</strong></td></tr>
  </tbody>
</table>
<p>Sono 197 €/mq: un terrazzo piccolo paga i costi fissi di demolizione e smaltimento. Su 80–100 mq il prezzo al mq scende verso la parte bassa della fascia.</p>

<h2>Terrazzo in condominio: chi paga</h2>
<p>Se il terrazzo è di uso esclusivo ma fa da copertura agli appartamenti sottostanti, le spese di riparazione si dividono per legge: un terzo a chi ne ha l'uso esclusivo e due terzi a tutti i condomini a cui fa da copertura, in base ai millesimi (art. 1126 del Codice civile). Per l'impresa significa che il committente può essere il condominio, con le regole dei <a href="/blog/preventivo-lavori-condominio/">preventivi per lavori condominiali</a>.</p>

<h2>Garanzia</h2>
<p>Oltre alla garanzia biennale per i difetti (art. 1667 c.c.), le infiltrazioni da una copertura sono state più volte considerate dalla Cassazione "gravi difetti" ai sensi dell'art. 1669 c.c., con responsabilità dell'appaltatore per dieci anni. Ragione in più per descrivere con precisione i materiali e la posa. Vedi anche la guida sulla <a href="/blog/garanzia-lavori-artigiani-diritti/">garanzia sui lavori degli artigiani</a>.</p>

<h2>Domande frequenti</h2>
<h3>Si può impermeabilizzare senza togliere il pavimento?</h3>
<p>Sì, con guaine liquide o resine trasparenti, se il pavimento è ben aderente e le pendenze funzionano. È la soluzione più rapida (1–3 giorni), ma non corregge le pendenze sbagliate.</p>
<h3>Quanto dura un'impermeabilizzazione?</h3>
<p>Una guaina bituminosa protetta dal pavimento dura 20–30 anni; una guaina liquida a vista va ispezionata ogni anno e ripresa dopo 8–15 anni a seconda del prodotto e dell'esposizione.</p>
<h3>È detraibile?</h3>
<p>Il rifacimento dell'impermeabilizzazione è manutenzione straordinaria e rientra nella detrazione per ristrutturazione (50% sull'abitazione principale e 36% sulle altre nel 2026); sulle parti comuni dei condomini rientra anche la manutenzione ordinaria.</p>
`,

  "quanto-costa-pompa-di-calore": `
<p>Nel 2026 una pompa di calore aria-acqua per riscaldare una casa costa, installata, <strong>tra 7.000 e 14.000 €</strong> per potenze da 6 a 12 kW; un sistema <strong>ibrido</strong> (pompa di calore più caldaia a condensazione) <strong>6.000–10.000 €</strong>; uno <strong>scaldacqua a pompa di calore</strong> per l'acqua calda sanitaria <strong>1.500–3.000 €</strong>. Il prezzo cambia con la potenza, con l'impianto che c'è già e con i lavori accessori. Ecco cosa comprende un preventivo completo e cosa fa salire il conto.</p>

<h2>Prezzi indicativi per tipo di impianto</h2>
<table>
  <thead>
    <tr><th>Impianto</th><th>Potenza tipica</th><th>Prezzo installato (IVA esclusa)</th></tr>
  </thead>
  <tbody>
    <tr><td>Scaldacqua a pompa di calore 200–300 litri</td><td>—</td><td>1.500–3.000 €</td></tr>
    <tr><td>Aria-acqua monoblocco per appartamento</td><td>6–8 kW</td><td>7.000–10.000 €</td></tr>
    <tr><td>Aria-acqua split con accumulo ACS, casa singola</td><td>9–12 kW</td><td>10.000–14.000 €</td></tr>
    <tr><td>Sistema ibrido factory made</td><td>caldaia 25–35 kW + PdC 4–8 kW</td><td>6.000–10.000 €</td></tr>
    <tr><td>Aria-aria multisplit (riscaldamento e raffrescamento)</td><td>3 unità interne</td><td>4.000–7.000 €</td></tr>
  </tbody>
</table>
<p>Per i condizionatori aria-aria vedi anche i <a href="/blog/prezzi-condizionatori-installazione-2026/">prezzi dei condizionatori</a>; per chi resta sulla caldaia, il <a href="/blog/costo-sostituzione-caldaia-condensazione/">costo della caldaia a condensazione</a>.</p>

<h2>Cosa comprende un preventivo completo</h2>
<ul>
  <li><strong>Dimensionamento</strong>: la potenza si calcola sulle dispersioni della casa e sulla temperatura esterna di progetto del comune, non "a occhio" dalla vecchia caldaia, che quasi sempre era sovradimensionata.</li>
  <li><strong>Unità esterna e supporti</strong>: staffe o basamento, antivibranti, distanze da finestre e confini, scarico della condensa (che d'inverno può ghiacciare).</li>
  <li><strong>Accumulo</strong> per l'acqua calda sanitaria ed eventuale puffer tecnico.</li>
  <li><strong>Lato impianto</strong>: lavaggio dell'impianto esistente, defangatore, vaso d'espansione, eventuale separatore idraulico.</li>
  <li><strong>Elettrico</strong>: linea dedicata dal quadro e, spesso, aumento della potenza del contatore (da 3 a 4,5 o 6 kW).</li>
  <li><strong>Smontaggio e smaltimento</strong> della vecchia caldaia.</li>
  <li><strong>Certificazioni</strong>: Dichiarazione di Conformità (D.M. 37/2008), libretto d'impianto e, per i gas fluorurati, intervento di un tecnico e di un'impresa certificati F-gas con comunicazione alla banca dati nazionale.</li>
</ul>

<h2>Quando la pompa di calore funziona bene</h2>
<p>Una pompa di calore rende di più quando l'acqua di mandata è a bassa temperatura (35–45 °C). Funziona al meglio con pavimenti radianti o ventilconvettori, e su radiatori esistenti solo se la casa è ben isolata o i radiatori sono generosi. Nelle zone climatiche E e F, con molte ore di accensione e temperature sotto zero, conviene valutare un ibrido o un intervento di isolamento prima della sostituzione. La zona del tuo comune è nella guida alle <a href="/blog/zone-climatiche-citta-italiane/">zone climatiche delle città italiane</a>.</p>

<h2>Esempio di preventivo: appartamento di 90 mq con radiatori</h2>
<table>
  <thead>
    <tr><th>Voce</th><th>Q.tà</th><th>Prezzo</th><th>Importo</th></tr>
  </thead>
  <tbody>
    <tr><td>Pompa di calore aria-acqua monoblocco 8 kW, R290</td><td>1</td><td>5.900 €</td><td>5.900 €</td></tr>
    <tr><td>Bollitore ACS 200 l</td><td>1</td><td>1.100 €</td><td>1.100 €</td></tr>
    <tr><td>Staffe, antivibranti, scarico condensa</td><td>a corpo</td><td></td><td>350 €</td></tr>
    <tr><td>Lavaggio impianto, defangatore magnetico, vaso d'espansione</td><td>a corpo</td><td></td><td>550 €</td></tr>
    <tr><td>Collegamenti idraulici e manodopera installazione</td><td>a corpo</td><td></td><td>1.400 €</td></tr>
    <tr><td>Linea elettrica dedicata dal quadro</td><td>a corpo</td><td></td><td>350 €</td></tr>
    <tr><td>Smontaggio e smaltimento caldaia esistente</td><td>1</td><td>180 €</td><td>180 €</td></tr>
    <tr><td>Messa in servizio, DiCo, libretto d'impianto</td><td>a corpo</td><td></td><td>250 €</td></tr>
    <tr><td><strong>Imponibile</strong></td><td></td><td></td><td><strong>10.080 €</strong></td></tr>
  </tbody>
</table>
<p>L'aliquota IVA dipende dall'intervento e dalla regola dei beni significativi: la guida all'<a href="/blog/iva-lavori-edili/">IVA sui lavori edili</a> spiega come calcolarla.</p>

<h2>Incentivi</h2>
<p>La sostituzione dell'impianto di climatizzazione invernale con una pompa di calore può accedere alla detrazione per la riqualificazione energetica (nel 2026 50% sull'abitazione principale, 36% sulle altre) oppure al Conto Termico del GSE, che è un contributo diretto e non una detrazione. I due incentivi non si sommano sulla stessa spesa e hanno requisiti tecnici diversi: va scelto prima di comprare la macchina, perché il Conto Termico richiede prodotti con prestazioni minime precise.</p>

<h2>Domande frequenti</h2>
<h3>Quanto consuma una pompa di calore?</h3>
<p>Con un COP stagionale di 3, ogni kWh elettrico produce circa 3 kWh di calore. Il risparmio rispetto al gas dipende dai prezzi dell'energia del momento e dall'isolamento della casa.</p>
<h3>Serve un permesso per l'unità esterna?</h3>
<p>In genere è edilizia libera, ma in condominio contano il regolamento e il decoro della facciata, e nei centri storici o sugli edifici vincolati può servire l'autorizzazione paesaggistica.</p>
<h3>Chi la può installare?</h3>
<p>Un'impresa abilitata per gli impianti termici (D.M. 37/2008) e, per le macchine con gas fluorurati, certificata F-gas. Per i preventivi c'è il <a href="/preventivi/termoidraulico/">generatore di preventivi per termoidraulici</a>.</p>
`,

  "quanto-costa-smaltimento-macerie": `
<p>Smaltire le macerie di un cantiere nel 2026 costa <strong>80–150 € per un big bag da 1 mc</strong> ritirato, <strong>300–700 € per un cassone scarrabile</strong> da 6–10 mc (noleggio, trasporto e conferimento di inerti puliti), oppure <strong>15–40 € a tonnellata</strong> se si porta il materiale all'impianto in proprio. I rifiuti misti, il cartongesso e soprattutto l'amianto costano molto di più. Ecco i prezzi, le regole e come scriverlo nel preventivo.</p>

<h2>Prezzi indicativi dello smaltimento</h2>
<table>
  <thead>
    <tr><th>Servizio</th><th>Prezzo indicativo</th></tr>
  </thead>
  <tbody>
    <tr><td>Big bag 1 mc: fornitura, ritiro con gru e conferimento</td><td>80–150 €</td></tr>
    <tr><td>Cassone scarrabile 6–10 mc, inerti puliti</td><td>300–700 €</td></tr>
    <tr><td>Cassone con rifiuti misti da demolizione</td><td>500–1.100 €</td></tr>
    <tr><td>Conferimento in impianto di inerti (mattoni, calcestruzzo, ceramica)</td><td>15–40 €/t</td></tr>
    <tr><td>Conferimento di rifiuti misti da costruzione e demolizione</td><td>80–180 €/t</td></tr>
    <tr><td>Cartongesso e materiali a base di gesso</td><td>100–200 €/t</td></tr>
    <tr><td>Rimozione e smaltimento di lastre in cemento-amianto (ditta specializzata)</td><td>15–35 €/mq oltre al piano di lavoro</td></tr>
  </tbody>
</table>
<p>Le tariffe degli impianti variano molto da provincia a provincia: per un preventivo preciso chiedete il listino dell'impianto più vicino. Un mc di macerie miste pesa circa 1,2–1,6 tonnellate.</p>

<h2>Quante macerie fa un lavoro</h2>
<ul>
  <li><strong>Bagno completo</strong> (rivestimenti, pavimento, massetto, sanitari): 2–4 mc.</li>
  <li><strong>Demolizione di un tramezzo</strong> in forati da 8 cm: circa 0,1 mc per mq di parete.</li>
  <li><strong>Pavimento con massetto</strong>: 0,06–0,1 mc per mq.</li>
  <li><strong>Appartamento di 80 mq da ristrutturare</strong> completamente: 15–30 mc.</li>
</ul>

<h2>Le regole da rispettare</h2>
<p>Le macerie sono rifiuti speciali e il loro produttore è l'impresa che esegue i lavori. In pratica:</p>
<ul>
  <li>i rifiuti vanno separati per codice EER: 17 01 07 per i miscugli di cemento, mattoni e ceramica; 17 09 04 per i rifiuti misti dell'attività di costruzione e demolizione; 17 08 02 per il cartongesso;</li>
  <li>il trasporto avviene con il <strong>formulario di identificazione del rifiuto</strong> (art. 193 del D.Lgs. 152/2006);</li>
  <li>chi trasporta i propri rifiuti con il proprio furgone deve essere iscritto all'<strong>Albo nazionale gestori ambientali</strong> in categoria 2-bis;</li>
  <li>l'amianto (17 06 05*) si rimuove solo con un'impresa iscritta in categoria 10 e con un piano di lavoro notificato all'ASL (art. 256 del D.Lgs. 81/2008).</li>
</ul>
<p>Lasciare le macerie nel cassonetto o farle sparire "in nero" espone a sanzioni penali per gestione illecita di rifiuti, e il committente che lo sa ne risponde con l'impresa.</p>

<h2>Come scriverlo nel preventivo</h2>
<p>Lo smaltimento è una delle voci che più spesso finisce "dimenticata" e poi aggiunta a fine lavori. Due modi corretti di indicarlo:</p>
<ul>
  <li><strong>a corpo</strong>, quando la quantità è prevedibile: "Carico, trasporto e conferimento in impianto autorizzato delle macerie prodotte, con formulario: 650 €";</li>
  <li><strong>a misura</strong>, quando non lo è: "Conferimento a 120 €/t, quantità secondo i formulari, stimate 4 t", con le copie dei formulari consegnate al cliente.</li>
</ul>
<p>Nelle ristrutturazioni con detrazione, i formulari dimostrano anche che i lavori sono stati fatti. Per un esempio completo vedi il <a href="/blog/preventivo-ristrutturazione-casa-esempio/">preventivo di ristrutturazione passo per passo</a>.</p>

<h2>Domande frequenti</h2>
<h3>Posso portare le macerie all'isola ecologica?</h3>
<p>Molti comuni accettano piccole quantità di inerti prodotte da privati che fanno lavori in proprio, ma non quelle prodotte da un'impresa nell'ambito del suo lavoro.</p>
<h3>Il cassone sulla strada richiede un permesso?</h3>
<p>Sì: occupare il suolo pubblico richiede la concessione del Comune e il pagamento del canone unico. Va considerato nel preventivo insieme al cassone.</p>
<h3>Quanto costa la demolizione?</h3>
<p>Indicativamente 15–30 €/mq per i tramezzi, 10–20 €/mq per il pavimento, 12–25 €/mq per il massetto, smaltimento escluso. Vedi anche i <a href="/blog/prezzi-muratore-lavori-edilizi/">prezzi del muratore</a>.</p>
`,

  "quanto-costa-impianto-fotovoltaico": `
<p>Un impianto fotovoltaico domestico chiavi in mano costa nel 2026 indicativamente <strong>4.500–7.000 € per 3 kW</strong>, <strong>6.500–9.500 € per 4,5 kW</strong> e <strong>8.000–12.000 € per 6 kW</strong>, senza batteria. Un accumulo da 5 kWh aggiunge 3.000–5.000 €. Il prezzo dipende dal tetto, dalla qualità dei componenti e da quanto lavoro elettrico serve. Ecco cosa deve comprendere il preventivo.</p>

<h2>Prezzi indicativi per taglia</h2>
<table>
  <thead>
    <tr><th>Potenza</th><th>Pannelli (circa 430–450 W)</th><th>Superficie di tetto</th><th>Prezzo senza batteria</th></tr>
  </thead>
  <tbody>
    <tr><td>3 kW</td><td>7</td><td>14–18 mq</td><td>4.500–7.000 €</td></tr>
    <tr><td>4,5 kW</td><td>10–11</td><td>20–25 mq</td><td>6.500–9.500 €</td></tr>
    <tr><td>6 kW</td><td>14</td><td>28–34 mq</td><td>8.000–12.000 €</td></tr>
    <tr><td>Accumulo 5 kWh</td><td>—</td><td>—</td><td>+3.000–5.000 €</td></tr>
    <tr><td>Accumulo 10 kWh</td><td>—</td><td>—</td><td>+5.500–8.500 €</td></tr>
  </tbody>
</table>
<p>Gli importi sono IVA esclusa. Il costo al kW scende con la taglia, perché progetto, pratiche e installazione dell'inverter pesano allo stesso modo su un impianto piccolo e su uno grande.</p>

<h2>Cosa comprende un preventivo completo</h2>
<ul>
  <li>moduli (marca, potenza, garanzia di prodotto e di rendimento);</li>
  <li>inverter, ottimizzatori se servono per ombreggiamenti;</li>
  <li>struttura di fissaggio adatta alla copertura (tegole, lamiera, piano con zavorre);</li>
  <li>quadri di campo e di protezione, cavi solari e linea fino al quadro di casa;</li>
  <li>ponteggio o linea vita, se il tetto non è accessibile in sicurezza;</li>
  <li>pratiche: comunicazione al Comune quando serve, richiesta di connessione al distributore (per i piccoli impianti domestici con il Modello Unico), registrazione su Terna Gaudì;</li>
  <li>Dichiarazione di Conformità (D.M. 37/2008) e collaudo.</li>
</ul>
<p>La voce che più spesso manca è la sicurezza del lavoro in quota: senza ponteggio o linea vita non si sale su un tetto, e montarli costa. Vedi <a href="/blog/quanto-costa-ponteggio/">quanto costa un ponteggio</a>.</p>

<h2>Permessi</h2>
<p>Sui tetti degli edifici l'installazione di pannelli aderenti o integrati, con la stessa inclinazione della falda, è in genere attività libera (art. 7-bis del D.Lgs. 28/2011, come modificato nel 2022), salvo gli immobili vincolati e le aree tutelate dal Codice dei beni culturali, dove serve l'autorizzazione. In condominio conta il regolamento; il singolo condomino può installare sul lastrico comune nei limiti dell'art. 1122-bis del Codice civile, informando l'amministratore.</p>

<h2>IVA e detrazioni</h2>
<p>La fornitura con posa di un impianto fotovoltaico per uso domestico sconta l'IVA al 10% (Tabella A, parte III, del D.P.R. 633/1972). L'impianto su un'abitazione rientra nella detrazione per ristrutturazione, che nel 2026 è del 50% sull'abitazione principale e del 36% sulle altre, in 10 anni. Le regole sugli incentivi cambiano spesso: fate sempre verificare dal commercialista.</p>

<h2>Esempio di preventivo: 4,5 kW su tetto a falde</h2>
<table>
  <thead>
    <tr><th>Voce</th><th>Q.tà</th><th>Prezzo</th><th>Importo</th></tr>
  </thead>
  <tbody>
    <tr><td>Moduli monocristallini 440 W</td><td>10</td><td>160 €</td><td>1.600 €</td></tr>
    <tr><td>Inverter ibrido 5 kW</td><td>1</td><td>1.500 €</td><td>1.500 €</td></tr>
    <tr><td>Struttura per tegole, ganci e binari</td><td>a corpo</td><td></td><td>650 €</td></tr>
    <tr><td>Quadri di protezione, cavi e linea al quadro generale</td><td>a corpo</td><td></td><td>700 €</td></tr>
    <tr><td>Montaggio, cablaggio e messa in servizio</td><td>a corpo</td><td></td><td>1.700 €</td></tr>
    <tr><td>Linea vita temporanea / sicurezza in quota</td><td>a corpo</td><td></td><td>450 €</td></tr>
    <tr><td>Pratiche di connessione, Gaudì, DiCo</td><td>a corpo</td><td></td><td>400 €</td></tr>
    <tr><td><strong>Imponibile</strong></td><td></td><td></td><td><strong>7.000 €</strong></td></tr>
    <tr><td>IVA 10%</td><td></td><td></td><td>700 €</td></tr>
    <tr><td><strong>Totale</strong></td><td></td><td></td><td><strong>7.700 €</strong></td></tr>
  </tbody>
</table>

<h2>Domande frequenti</h2>
<h3>Quanto produce un impianto da 3 kW?</h3>
<p>Dipende da latitudine, orientamento e ombre: indicativamente 3.300–4.500 kWh l'anno, di più al Sud. Il simulatore pubblico PVGIS della Commissione europea dà la stima per il proprio indirizzo.</p>
<h3>Chi può installarlo?</h3>
<p>Un'impresa abilitata per gli impianti elettrici (D.M. 37/2008, lettera a). Per i preventivi c'è il <a href="/preventivi/elettricista/">generatore di preventivi per elettricisti</a>.</p>
<h3>Serve aumentare la potenza del contatore?</h3>
<p>Non per l'impianto in sé. Può servire se insieme si installano pompa di calore, piano a induzione o wallbox: vedi <a href="/blog/quanto-costa-impianto-elettrico/">quanto costa rifare l'impianto elettrico</a>.</p>
`,

  "quanto-costa-ponteggio": `
<p>Un ponteggio per lavori di facciata costa nel 2026 <strong>8–15 € al mq di facciata</strong> per montaggio, smontaggio e primo mese di noleggio, più <strong>1–2,50 € al mq per ogni mese successivo</strong>. A questo si aggiungono, quando serve, l'occupazione del suolo pubblico, le reti e i teli, il parapetto in copertura e la mantovana. È la voce più sottovalutata nei preventivi di facciate, tetti e cappotti: ecco come si calcola.</p>

<h2>Prezzi indicativi del ponteggio</h2>
<table>
  <thead>
    <tr><th>Voce</th><th>Prezzo indicativo</th></tr>
  </thead>
  <tbody>
    <tr><td>Ponteggio a tubi e giunti o a telai: montaggio, smontaggio, primo mese</td><td>8–15 €/mq</td></tr>
    <tr><td>Noleggio dal secondo mese</td><td>1–2,50 €/mq al mese</td></tr>
    <tr><td>Teli o reti di protezione</td><td>1–3 €/mq</td></tr>
    <tr><td>Mantovana parasassi</td><td>15–30 € al metro lineare</td></tr>
    <tr><td>Parapetto provvisorio in copertura</td><td>15–35 € al metro lineare</td></tr>
    <tr><td>Piano di montaggio (PiMUS) e progetto oltre i 20 m</td><td>a corpo, 300–1.500 €</td></tr>
    <tr><td>Trabattello per lavori piccoli</td><td>noleggio 60–150 € a settimana</td></tr>
  </tbody>
</table>
<p>La superficie si misura in proiezione verticale: lunghezza del ponteggio per la sua altezza, compreso il piano oltre l'ultimo impalcato. Una facciata di 15 m per 10 m di altezza è circa 165 mq di ponteggio.</p>

<h2>Gli obblighi da mettere in conto</h2>
<ul>
  <li><strong>PiMUS</strong>: il piano di montaggio, uso e smontaggio è obbligatorio (art. 136 del D.Lgs. 81/2008) e il montaggio lo fanno lavoratori formati.</li>
  <li><strong>Progetto</strong>: oltre i 20 metri di altezza, o se lo schema non è tra quelli autorizzati dal fabbricante, serve un progetto firmato da un ingegnere o un architetto (art. 133).</li>
  <li><strong>Suolo pubblico</strong>: se il ponteggio occupa marciapiede o strada serve la concessione del Comune e si paga il canone unico patrimoniale (L. 160/2019). Le tariffe le decide ogni Comune e dipendono dalla zona e dai mesi.</li>
  <li><strong>Segnalazione e illuminazione</strong> notturna degli ingombri, e il passaggio protetto per i pedoni quando il ponteggio è sul marciapiede.</li>
</ul>

<h2>Come scriverlo nel preventivo senza perderci</h2>
<p>Il rischio, per l'impresa, è stimare due mesi di ponteggio e tenerlo montato quattro per colpa di pioggia, varianti o ritardi del committente. Tre accorgimenti:</p>
<ol>
  <li>separare <strong>montaggio e primo mese</strong> dal <strong>noleggio dei mesi successivi</strong>, con il prezzo al mese;</li>
  <li>scrivere che i mesi oltre quelli previsti, se dovuti a cause del committente, si pagano al prezzo indicato;</li>
  <li>indicare l'occupazione del suolo pubblico "a carico del committente, al costo" oppure stimata a parte, perché la tariffa la fissa il Comune.</li>
</ol>
<p>Lo stesso principio vale per tutte le voci che dipendono dal tempo: vedi la guida alle <a href="/blog/varianti-in-corso-opera/">varianti in corso d'opera</a>.</p>

<h2>Esempio: facciata di una palazzina</h2>
<table>
  <thead>
    <tr><th>Voce</th><th>Q.tà</th><th>Prezzo</th><th>Importo</th></tr>
  </thead>
  <tbody>
    <tr><td>Ponteggio a telai: montaggio, smontaggio e primo mese</td><td>420 mq</td><td>10 €</td><td>4.200 €</td></tr>
    <tr><td>Noleggio secondo e terzo mese</td><td>420 mq × 2</td><td>1,60 €</td><td>1.344 €</td></tr>
    <tr><td>Teli di protezione</td><td>420 mq</td><td>1,80 €</td><td>756 €</td></tr>
    <tr><td>Mantovana sul lato strada</td><td>25 ml</td><td>22 €</td><td>550 €</td></tr>
    <tr><td>PiMUS</td><td>a corpo</td><td></td><td>350 €</td></tr>
    <tr><td><strong>Imponibile</strong></td><td></td><td></td><td><strong>7.200 €</strong></td></tr>
  </tbody>
</table>
<p>Oltre il terzo mese: 672 € al mese. Occupazione di suolo pubblico secondo la tariffa del Comune, a carico del committente. Il resto del preventivo di facciata è nell'<a href="/blog/esempio-preventivo-ristrutturazione-facciata/">esempio di preventivo per una facciata</a>.</p>

<h2>Domande frequenti</h2>
<h3>Il ponteggio si può detrarre?</h3>
<p>Sì, come spesa accessoria all'intervento che lo rende necessario: segue la detrazione dei lavori di facciata, tetto o cappotto.</p>
<h3>Quando basta un trabattello?</h3>
<p>Per lavori brevi e localizzati fino a qualche metro di altezza, su suolo piano e stabile: riparazioni di gronde, una facciata bassa, una sola finestra.</p>
<h3>Chi è responsabile del ponteggio?</h3>
<p>L'impresa che lo monta e quella che lo usa, ciascuna per la sua parte. Nei cantieri con più imprese il coordinatore per la sicurezza lo disciplina nel PSC.</p>
`,
};
