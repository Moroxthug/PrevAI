// Corpi delle guide pratiche e dei confronti di novembre 2026 (metadati in
// ./blog-novembre-index.ts). Norme citate per numero; esempi con cifre che
// tornano.

export const BLOG_NOVEMBRE_GUIDE: Record<string, string> = {
  "software-preventivi-edili": `
<p>Un software per preventivi edili deve fare quattro cose bene: trasformare un sopralluogo in voci con quantità e prezzi, applicare l'IVA giusta, produrre un documento che il cliente capisce e firma, e seguire il lavoro dopo la firma con varianti e stati di avanzamento. Excel, i programmi di computo metrico e i generatori con l'intelligenza artificiale ci arrivano in modi diversi. Questa guida aiuta a scegliere senza perdere settimane in prove.</p>

<h2>Le tre famiglie di strumenti</h2>
<table>
  <thead>
    <tr><th></th><th>Excel o Word</th><th>Software di computo metrico</th><th>Generatore di preventivi con IA</th></tr>
  </thead>
  <tbody>
    <tr><td>Pensato per</td><td>Chi fa pochi preventivi</td><td>Tecnici e appalti strutturati</td><td>Artigiani e imprese che preventivano ogni giorno</td></tr>
    <tr><td>Tempo per un preventivo</td><td>30–90 minuti</td><td>Ore, ma con grande dettaglio</td><td>Pochi minuti dalla descrizione del lavoro</td></tr>
    <tr><td>Voci e prezzi</td><td>Da copiare a mano</td><td>Da prezzario regionale o listini</td><td>Proposte dal sistema, da verificare e correggere</td></tr>
    <tr><td>IVA e totali</td><td>Formule da mantenere</td><td>Automatici</td><td>Automatici, con aliquota per tipo di lavoro</td></tr>
    <tr><td>Documento per il cliente</td><td>Dipende da chi lo impagina</td><td>Tecnico, poco leggibile per un privato</td><td>PDF pronto da inviare</td></tr>
    <tr><td>Dopo la firma</td><td>Nulla</td><td>Contabilità lavori e SAL</td><td>Dipende dal prodotto: contratto, cantiere, fattura</td></tr>
  </tbody>
</table>
<p>Non esiste lo strumento migliore in assoluto. Chi partecipa a gare pubbliche ha bisogno di un computo metrico sul prezzario regionale; chi fa dieci sopralluoghi a settimana da privati ha bisogno soprattutto di velocità e di un documento chiaro.</p>

<h2>Cosa deve saper fare per l'edilizia</h2>
<h3>Voci a misura e a corpo</h3>
<p>Un preventivo edile mescola voci a misura (mq di intonaco, ml di battiscopa, punti luce) e voci a corpo (smaltimenti, pratiche, assistenze murarie). Lo strumento deve gestirle entrambe e mostrare quantità, unità e prezzo unitario. Se non sai la differenza tra le due, parti dalla guida al <a href="/blog/computo-metrico-estimativo/">computo metrico estimativo</a>.</p>
<h3>IVA agevolata e beni significativi</h3>
<p>Nell'edilizia l'IVA cambia con il tipo di intervento: 10% sulle manutenzioni delle abitazioni, con il calcolo dei beni significativi per infissi, caldaie e sanitari; 4% sulla prima casa; 22% sugli immobili non abitativi; reverse charge nei subappalti. Un software che applica il 22% a tutto obbliga a ricalcolare a mano. Le regole sono nella guida all'<a href="/blog/iva-lavori-edili/">IVA sui lavori edili</a>.</p>
<h3>Varianti e stati di avanzamento</h3>
<p>Nei lavori che durano settimane il preventivo cambia: lavori extra, materiali diversi, pagamenti a fasi. Serve poter creare una variante collegata al preventivo originale e un SAL che mostri cosa è stato fatto e cosa resta da pagare. Vedi le guide alle <a href="/blog/varianti-in-corso-opera/">varianti in corso d'opera</a> e al <a href="/blog/sal-stato-avanzamento-lavori/">SAL</a>.</p>
<h3>Invio e firma</h3>
<p>Il preventivo che arriva per primo vince spesso il lavoro. Conta poterlo inviare dal cantiere, via WhatsApp o email, e sapere quando il cliente lo apre. Vedi <a href="/blog/preventivo-whatsapp-artigiani-vantaggi/">perché i preventivi su WhatsApp funzionano</a>.</p>
<h3>Dati in Italia ed Europa</h3>
<p>I preventivi contengono dati personali dei clienti: indirizzi, telefoni, a volte situazioni familiari. Il fornitore deve trattarli secondo il GDPR e dire dove sono conservati.</p>

<h2>Le domande da fare prima di abbonarsi</h2>
<ul>
  <li>Posso provarlo gratis con un preventivo vero, non con un esempio?</li>
  <li>I prezzi proposti si possono correggere e il sistema impara i miei?</li>
  <li>Il documento ha il mio logo, i miei dati e le mie condizioni di pagamento?</li>
  <li>Gestisce l'IVA al 10% e i beni significativi?</li>
  <li>Funziona dal telefono, in cantiere, anche con poca rete?</li>
  <li>Posso esportare i miei dati se smetto di usarlo?</li>
  <li>Quanto costa davvero all'anno, con tutti gli utenti della squadra?</li>
</ul>

<h2>Dove si colloca PrevAI</h2>
<p>PrevAI è un generatore di preventivi con l'intelligenza artificiale pensato per artigiani e imprese edili italiane: descrivi il lavoro a voce o per iscritto e ottieni in pochi secondi un preventivo con voci, quantità, prezzi e IVA, che puoi correggere e inviare come PDF. Dopo la firma lo stesso lavoro diventa contratto, cantiere e fattura. Non sostituisce un software di computo metrico per le gare pubbliche, e non è pensato per farlo. Puoi provarlo gratis dal <a href="/preventivi/edilizia/">generatore di preventivi per imprese edili</a>. Per un confronto più ampio tra categorie di strumenti vedi anche il <a href="/blog/software-preventivi-artigiani-confronto/">confronto tra software per artigiani</a>.</p>

<h2>Domande frequenti</h2>
<h3>Esiste un software per preventivi edili gratis?</h3>
<p>Molti hanno un piano gratuito o una prova. Un foglio Excel ben fatto è gratis ma costa tempo: vedi il <a href="/blog/modello-preventivo-excel/">modello di preventivo Excel</a> e i <a href="/preventivi/modello-word/">modelli Word gratuiti</a>.</p>
<h3>Mi serve un software di computo metrico?</h3>
<p>Se partecipi ad appalti pubblici o lavori con progettisti che chiedono il computo sul prezzario regionale, sì. Per i preventivi ai privati di solito no.</p>
<h3>L'intelligenza artificiale sbaglia i prezzi?</h3>
<p>Può proporre prezzi lontani dai tuoi, soprattutto all'inizio. Per questo il preventivo va sempre riletto e corretto prima dell'invio: lo strumento fa risparmiare la scrittura, la responsabilità del prezzo resta tua.</p>
`,

  "computo-metrico-estimativo": `
<p>Il <strong>computo metrico estimativo</strong> è l'elenco di tutte le lavorazioni di un'opera, ognuna con la sua quantità misurata e il suo prezzo unitario, che moltiplicati danno il costo complessivo. È il documento con cui progettisti e imprese stimano un lavoro in modo verificabile. Il preventivo lo usa come base ma aggiunge condizioni, tempi e IVA. Ecco come si fa, passo per passo, e quando serve davvero.</p>

<h2>Computo metrico, computo estimativo e preventivo</h2>
<ul>
  <li><strong>Computo metrico</strong>: solo le quantità. Per ogni lavorazione, le misure (lunghezza, larghezza, altezza, numero) e il totale nella sua unità.</li>
  <li><strong>Computo metrico estimativo</strong>: le stesse quantità, moltiplicate per un prezzo unitario preso da un prezzario o da un'analisi prezzi.</li>
  <li><strong>Preventivo</strong>: la proposta commerciale dell'impresa al cliente. Può riprendere il computo, ma contiene anche prezzi propri, condizioni di pagamento, tempi, validità, IVA e firma.</li>
</ul>
<p>Negli appalti pubblici il computo metrico estimativo fa parte del progetto (D.Lgs. 36/2023, Allegato I.7). Nei lavori privati non è obbligatorio, ma è il modo più solido per far capire al cliente cosa paga e per confrontare offerte diverse.</p>

<h2>Come si fa un computo metrico estimativo</h2>
<ol>
  <li><strong>Dividere l'opera in lavorazioni</strong> nell'ordine del cantiere: demolizioni, opere murarie, impianti, sottofondi, pavimenti e rivestimenti, finiture, smaltimenti.</li>
  <li><strong>Scegliere la voce</strong> per ogni lavorazione, di solito con il codice del prezzario regionale, che descrive cosa è compreso (materiale, posa, sfridi, trasporti).</li>
  <li><strong>Misurare</strong> secondo le regole del prezzario: per esempio gli intonaci a mq, spesso "vuoto per pieno" con detrazione delle aperture sopra una certa superficie; i tubi a metro lineare; i sanitari a numero.</li>
  <li><strong>Scrivere le righe di misura</strong> per ogni ambiente, in modo che chiunque possa ricontrollarle: "Bagno: 2 × (2,40 + 1,80) × 2,20 = 18,48 mq".</li>
  <li><strong>Applicare il prezzo unitario</strong> e calcolare l'importo della voce.</li>
  <li><strong>Sommare</strong> per categoria e in totale. Gli oneri della sicurezza, quando c'è un PSC, si tengono separati.</li>
</ol>

<h2>Esempio: rifacimento di un bagno</h2>
<table>
  <thead>
    <tr><th>N.</th><th>Lavorazione</th><th>Misure</th><th>Quantità</th><th>Prezzo</th><th>Importo</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>Demolizione rivestimento ceramico</td><td>2 × (2,40 + 1,80) × 2,20 − 0,80 × 2,10 (porta)</td><td>16,80 mq</td><td>14 €</td><td>235,20 €</td></tr>
    <tr><td>2</td><td>Demolizione pavimento e massetto</td><td>2,40 × 1,80</td><td>4,32 mq</td><td>24 €</td><td>103,68 €</td></tr>
    <tr><td>3</td><td>Massetto sabbia-cemento 5 cm</td><td>2,40 × 1,80</td><td>4,32 mq</td><td>22 €</td><td>95,04 €</td></tr>
    <tr><td>4</td><td>Impermeabilizzazione cementizia zona doccia</td><td>(1,20 + 0,90) × 2,00 + 1,08</td><td>5,28 mq</td><td>35 €</td><td>184,80 €</td></tr>
    <tr><td>5</td><td>Posa pavimento in gres</td><td>2,40 × 1,80</td><td>4,32 mq</td><td>45 €</td><td>194,40 €</td></tr>
    <tr><td>6</td><td>Posa rivestimento in gres</td><td>come voce 1</td><td>16,80 mq</td><td>48 €</td><td>806,40 €</td></tr>
    <tr><td></td><td><strong>Totale opere edili</strong></td><td></td><td></td><td></td><td><strong>1.619,52 €</strong></td></tr>
  </tbody>
</table>
<p>A questo si aggiungono impianto idraulico, sanitari, smaltimenti e forniture. Il preventivo completo dello stesso tipo di lavoro è nell'<a href="/blog/esempio-preventivo-ristrutturazione-bagno/">esempio di preventivo per un bagno</a>.</p>

<h2>Da dove prendere i prezzi unitari</h2>
<ul>
  <li><strong>Prezzario regionale</strong>: pubblicato ogni anno da ogni Regione per i lavori pubblici, è il riferimento più usato anche nei privati e per le detrazioni. Vedi la guida ai <a href="/blog/prezzari-regionali-lavori-edili/">prezzari regionali</a>.</li>
  <li><strong>Prezzari editoriali</strong> come quelli DEI, usati soprattutto per opere specialistiche.</li>
  <li><strong>Analisi prezzi</strong>: per le lavorazioni che non sono in nessun prezzario si costruisce il prezzo da manodopera, materiali, noli, spese generali (di solito 13–17%) e utile d'impresa (10%).</li>
  <li><strong>I propri prezzi</strong>: per un'impresa il riferimento vero sono i propri costi. Vedi <a href="/blog/ricarico-margine-artigiano/">ricarico e margine</a>.</li>
</ul>

<h2>Errori frequenti</h2>
<ul>
  <li>misure senza riga di calcolo, impossibili da ricontrollare;</li>
  <li>voci del prezzario usate senza leggere cosa comprendono, contando due volte trasporti o sfridi;</li>
  <li>dimenticare le voci a corpo: smaltimenti, assistenze murarie agli impiantisti, pulizie finali;</li>
  <li>usare un prezzario di anni prima senza aggiornarlo.</li>
</ul>

<h2>Domande frequenti</h2>
<h3>Chi può fare un computo metrico?</h3>
<p>Chiunque può farlo per i lavori privati. Quando è parte di un progetto o di un'asseverazione per le detrazioni lo firma un tecnico abilitato (geometra, architetto, ingegnere).</p>
<h3>Che software si usa?</h3>
<p>I programmi di computo metrico importano i prezzari regionali e gestiscono contabilità e SAL. Per i preventivi ai privati basta spesso uno strumento più rapido: vedi la guida al <a href="/blog/software-preventivi-edili/">software per preventivi edili</a>.</p>
<h3>Il computo metrico vincola il prezzo?</h3>
<p>Dipende dal contratto: in un appalto "a corpo" il prezzo resta fisso, in uno "a misura" si paga sulle quantità effettivamente eseguite e misurate.</p>
`,

  "prezzari-regionali-lavori-edili": `
<p>Ogni Regione italiana pubblica un <strong>prezzario dei lavori pubblici</strong>: un elenco di migliaia di lavorazioni edili e impiantistiche, ciascuna con descrizione, unità di misura e prezzo, aggiornato di norma ogni anno. Nato per gli appalti pubblici, è diventato il riferimento anche nei lavori privati, perché è pubblico, gratuito e riconosciuto dalle norme sulle detrazioni. Ecco cosa contiene, dove trovarlo e come usarlo per fare preventivi con prezzi difendibili.</p>

<h2>Perché esistono e perché contano anche per i privati</h2>
<p>Il Codice dei contratti pubblici (D.Lgs. 36/2023, art. 41) chiede alle Regioni di aggiornare ogni anno i prezzari, che le stazioni appaltanti usano per stimare i lavori. Per i privati il prezzario conta per tre motivi:</p>
<ul>
  <li><strong>congruità delle spese per le detrazioni</strong>: per gli interventi di riqualificazione energetica il tecnico che assevera i costi li confronta con i prezzari regionali o, in mancanza, con i prezzari DEI (D.M. 6/8/2020 "Requisiti");</li>
  <li><strong>contenziosi</strong>: un consulente tecnico che deve stabilire se un prezzo è giusto parte quasi sempre dal prezzario della regione;</li>
  <li><strong>trattativa</strong>: un preventivo con prezzi vicini al prezzario è più facile da difendere davanti al cliente che confronta tre offerte.</li>
</ul>

<h2>Dove trovarli</h2>
<p>Ogni prezzario si scarica gratuitamente dal sito istituzionale della Regione, di solito nelle sezioni dedicate a lavori pubblici, infrastrutture o osservatorio dei contratti pubblici, in PDF e spesso anche in formati importabili dai software di computo. Alcune Regioni lo pubblicano insieme alle Camere di commercio o con articolazioni per provincia. Cercate "prezzario regionale" seguito dal nome della regione e dall'anno, e verificate sempre che il documento sia l'edizione in vigore e che provenga dal sito ufficiale.</p>

<h2>Come è fatta una voce del prezzario</h2>
<p>Ogni voce ha un codice, una descrizione che dice esattamente cosa è compreso, un'unità di misura e un prezzo. Per esempio, una voce di intonaco civile specifica gli strati, il materiale, se sono compresi i ponteggi fino a una certa altezza e come si misura. Molti prezzari indicano anche l'incidenza della manodopera, utile per capire quanto di quel prezzo è lavoro.</p>
<p>I prezzi comprendono già <strong>spese generali e utile d'impresa</strong> (nella maggior parte dei prezzari intorno al 15% e al 10%), ma non l'IVA. E le note introduttive, che pochi leggono, contengono le regole di misurazione: è lì che si scopre, per esempio, quando le aperture si detraggono dalle superfici.</p>

<h2>Come usarlo per i preventivi privati</h2>
<ol>
  <li><strong>Come controllo</strong>, non come listino: se il tuo prezzo di posa è molto sotto il prezzario, forse stai lavorando sottocosto; se è molto sopra, devi saper spiegare perché.</li>
  <li><strong>Per le voci che fai di rado</strong>: un'impresa che fa bagni e deve quotare un controsoffitto o un'impermeabilizzazione ha un riferimento serio da cui partire.</li>
  <li><strong>Per le descrizioni</strong>: riprendere le descrizioni del prezzario rende il preventivo preciso e confrontabile.</li>
  <li><strong>Per i lavori con detrazione</strong>: tenere i prezzi entro quelli del prezzario evita problemi di congruità.</li>
</ol>
<p>Ricorda però che il prezzario descrive un'impresa media che lavora in un cantiere pubblico: su lavori piccoli, in centri storici o con accessi difficili i costi reali sono spesso più alti, e va scritto nel preventivo perché.</p>

<h2>Prezzario e zone del Paese</h2>
<p>Le differenze tra prezzari di regioni diverse riflettono costi del lavoro e dei materiali diversi, ma anche scelte diverse nel modo di descrivere le voci: confrontare due regioni voce per voce richiede attenzione. Per i lavori in una città specifica, i dati che contano per il preventivo (zona climatica, zona sismica, vincoli) sono nelle pagine del generatore per città, per esempio <a href="/preventivi/ristrutturazione/milano/">preventivi di ristrutturazione a Milano</a> o <a href="/preventivi/ristrutturazione/roma/">a Roma</a>, e nelle guide alle <a href="/blog/zone-climatiche-citta-italiane/">zone climatiche</a> e alle <a href="/blog/zone-sismiche-citta-italiane/">zone sismiche</a>.</p>

<h2>Domande frequenti</h2>
<h3>Il prezzario è obbligatorio nei lavori privati?</h3>
<p>No. Nei lavori privati il prezzo è libero e lo decidono impresa e committente. Il prezzario diventa vincolante solo quando lo richiama una norma (per esempio la congruità per alcune detrazioni) o il contratto.</p>
<h3>Che differenza c'è con il prezzario DEI?</h3>
<p>Il DEI è un prezzario editoriale, a pagamento, molto dettagliato soprattutto per impianti e opere specialistiche. Le norme sulle detrazioni lo indicano come alternativa quando il prezzario regionale non contiene la voce.</p>
<h3>Come si usa in un computo metrico?</h3>
<p>Si cita il codice della voce, si misura secondo le sue regole e si moltiplica per il prezzo. La procedura completa è nella guida al <a href="/blog/computo-metrico-estimativo/">computo metrico estimativo</a>.</p>
`,

  "iva-lavori-edili": `
<p>Nel preventivo di un lavoro edile l'IVA può essere al <strong>22%</strong>, al <strong>10%</strong> o al <strong>4%</strong>, oppure non essere applicata affatto perché scatta il <strong>reverse charge</strong>. Dipende dal tipo di intervento, dall'immobile e da chi è il cliente. Sbagliare aliquota significa un preventivo sbagliato e, a volte, una sanzione. Ecco le regole del 2026 con gli esempi di calcolo, compreso quello dei beni significativi.</p>

<h2>Le aliquote in sintesi</h2>
<table>
  <thead>
    <tr><th>Situazione</th><th>Aliquota</th><th>Riferimento</th></tr>
  </thead>
  <tbody>
    <tr><td>Manutenzione ordinaria e straordinaria su abitazioni private</td><td>10% (con la regola dei beni significativi)</td><td>art. 7, c. 1, lett. b), L. 488/1999</td></tr>
    <tr><td>Restauro, risanamento conservativo, ristrutturazione edilizia</td><td>10% su tutto, compresi i beni finiti forniti</td><td>Tab. A, parte III, nn. 127-terdecies e 127-quaterdecies, D.P.R. 633/1972</td></tr>
    <tr><td>Costruzione della prima casa (non di lusso)</td><td>4%</td><td>Tab. A, parte II, n. 39</td></tr>
    <tr><td>Opere per l'abbattimento delle barriere architettoniche</td><td>4%</td><td>Tab. A, parte II, n. 41-ter</td></tr>
    <tr><td>Lavori su immobili non abitativi (negozi, uffici, capannoni)</td><td>22%</td><td>aliquota ordinaria</td></tr>
    <tr><td>Subappalti nel settore edile e servizi di demolizione, installazione impianti, completamento e pulizia tra soggetti IVA</td><td>reverse charge</td><td>art. 17, c. 6, lett. a) e a-ter), D.P.R. 633/1972</td></tr>
  </tbody>
</table>

<h2>Il 10% sulle manutenzioni e i beni significativi</h2>
<p>Sulla manutenzione ordinaria e straordinaria delle abitazioni l'IVA è al 10% sulla prestazione. Ma alcuni beni di valore, i <strong>beni significativi</strong> elencati dal D.M. 29/12/1999, hanno una regola speciale: ascensori e montacarichi, infissi esterni e interni, caldaie, videocitofoni, apparecchiature di condizionamento e riciclo dell'aria, sanitari e rubinetteria da bagno, impianti di sicurezza.</p>
<p>Per questi beni il 10% si applica solo fino alla differenza tra il valore complessivo dell'intervento e il valore del bene. La parte di valore del bene che supera questa differenza va al 22%.</p>
<h3>Esempio di calcolo</h3>
<p>Sostituzione di finestre: valore complessivo 10.000 €, di cui infissi (bene significativo) 6.000 € e posa e opere accessorie 4.000 €.</p>
<ul>
  <li>differenza tra totale e valore del bene: 10.000 − 6.000 = 4.000 €;</li>
  <li>al 10%: la posa (4.000 €) più la stessa quota degli infissi (4.000 €) = 8.000 € → 800 € di IVA;</li>
  <li>al 22%: la parte restante degli infissi, 2.000 € → 440 € di IVA;</li>
  <li>IVA totale 1.240 €, totale fattura 11.240 €.</li>
</ul>
<p>Se gli infissi valessero meno della metà del totale, tutto andrebbe al 10%. La fattura deve indicare separatamente il valore dei beni significativi (L. 205/2017, art. 1, c. 19), quindi conviene farlo già nel preventivo.</p>

<h2>Quando il 10% vale su tutto</h2>
<p>Se l'intervento è di restauro, risanamento conservativo o ristrutturazione edilizia (art. 3, c. 1, lettere c) e d), del D.P.R. 380/2001), l'aliquota del 10% si applica alle prestazioni e ai beni finiti forniti, senza il limite dei beni significativi. Serve però che l'intervento sia davvero qualificato così, di solito con il titolo edilizio corrispondente.</p>

<h2>Il reverse charge in edilizia</h2>
<p>Quando un'impresa lavora in subappalto per un'altra impresa del settore edile, la fattura si emette senza IVA, con la dicitura "inversione contabile" e il riferimento all'art. 17, c. 6, lett. a): l'IVA la integra il committente. Lo stesso vale, tra soggetti IVA, per i servizi di pulizia, demolizione, installazione di impianti e completamento relativi a edifici (lett. a-ter). Verso i privati il reverse charge non si applica mai.</p>
<p>Per l'impresa in regime forfettario la fattura è senza IVA in ogni caso, con la dicitura del regime: il preventivo non deve mostrare un'IVA che poi non verrà addebitata.</p>

<h2>Errori frequenti nei preventivi</h2>
<ul>
  <li>applicare il 22% a un privato per una manutenzione su casa sua, perdendo il lavoro per un prezzo più alto del dovuto;</li>
  <li>applicare il 10% su un negozio o un ufficio;</li>
  <li>dimenticare la regola dei beni significativi su infissi, caldaie e sanitari;</li>
  <li>presentare prezzi "IVA compresa" senza dire quale aliquota è compresa.</li>
</ul>
<p>Il generatore di PrevAI propone l'aliquota in base al tipo di lavoro descritto e la mostra voce per voce; prova dal <a href="/preventivi/edilizia/">generatore per imprese edili</a>. Per la fatturazione vedi anche la <a href="/blog/fatturazione-elettronica-artigiani-guida/">guida alla fatturazione elettronica</a>.</p>

<h2>Domande frequenti</h2>
<h3>Serve una dichiarazione del cliente per il 10%?</h3>
<p>Per la manutenzione su abitazioni non serve un modulo specifico, ma conviene indicare nel preventivo e in fattura l'indirizzo e la destinazione abitativa dell'immobile. Per il 4% sulla prima casa il cliente deve dichiarare di averne i requisiti.</p>
<h3>Il 10% vale anche per le seconde case?</h3>
<p>Sì: conta che l'immobile sia a prevalente destinazione abitativa privata, non che sia l'abitazione principale.</p>
<h3>E per i materiali comprati dal cliente?</h3>
<p>Se il cliente compra i materiali da solo, li paga con l'IVA del rivenditore (di norma 22%); il 10% si applica solo ai beni forniti dall'impresa nell'ambito dell'intervento.</p>
<p><em>Le regole fiscali cambiano: questa guida è un orientamento, non una consulenza. Verificate i casi concreti con il commercialista.</em></p>
`,

  "ricarico-margine-artigiano": `
<p>Ricarico e margine sembrano la stessa cosa ma non lo sono, e confonderli è uno dei modi più comuni in cui un artigiano guadagna meno di quanto pensa. Il <strong>ricarico</strong> è la percentuale che aggiungi al costo; il <strong>margine</strong> è la percentuale del prezzo di vendita che ti resta. Un ricarico del 25% dà un margine del 20%, non del 25%. Ecco le formule, una tabella di conversione e come applicarle ai materiali e alla manodopera.</p>

<h2>Le formule</h2>
<ul>
  <li><strong>Prezzo con ricarico</strong> = costo × (1 + ricarico)</li>
  <li><strong>Margine</strong> = (prezzo − costo) ÷ prezzo</li>
  <li><strong>Prezzo per ottenere un margine</strong> = costo ÷ (1 − margine)</li>
  <li><strong>Da ricarico a margine</strong>: margine = ricarico ÷ (1 + ricarico)</li>
  <li><strong>Da margine a ricarico</strong>: ricarico = margine ÷ (1 − margine)</li>
</ul>
<p>Esempio: un miscelatore costa 100 €. Con un ricarico del 30% lo metti a 130 €. Il margine è 30 ÷ 130 = 23,1%. Se volevi un margine del 30%, il prezzo doveva essere 100 ÷ 0,70 = 142,86 €.</p>

<h2>Tabella di conversione</h2>
<table>
  <thead>
    <tr><th>Ricarico</th><th>Margine</th></tr>
  </thead>
  <tbody>
    <tr><td>10%</td><td>9,1%</td></tr>
    <tr><td>15%</td><td>13,0%</td></tr>
    <tr><td>20%</td><td>16,7%</td></tr>
    <tr><td>25%</td><td>20,0%</td></tr>
    <tr><td>30%</td><td>23,1%</td></tr>
    <tr><td>40%</td><td>28,6%</td></tr>
    <tr><td>50%</td><td>33,3%</td></tr>
    <tr><td>100%</td><td>50,0%</td></tr>
  </tbody>
</table>

<h2>Il ricarico sui materiali</h2>
<p>I materiali che compri e rivendi al cliente hanno un costo che non è solo il prezzo del fornitore: ci sono il tempo per scegliere e ordinare, il ritiro, il trasporto, i resi, lo sfrido, il rischio di rottura e il capitale anticipato. Per questo un ricarico sui materiali è giusto e il cliente non deve sorprendersi. Nella pratica:</p>
<ul>
  <li>sui materiali di consumo e piccoli (raccordi, viti, colle) il ricarico è più alto, perché il loro costo di gestione pesa di più del prezzo;</li>
  <li>sui beni di valore scelti dal cliente (sanitari, caldaie, infissi) il ricarico è più basso, perché il cliente conosce il prezzo al pubblico;</li>
  <li>se il cliente compra da solo i materiali, quel costo di gestione non sparisce: va nella manodopera o in una voce di assistenza.</li>
</ul>

<h2>Il prezzo della manodopera</h2>
<p>Sulla manodopera non si parla di ricarico sul salario, ma di <strong>costo orario pieno</strong>: stipendio e contributi, oppure il tuo compenso e i tuoi contributi se lavori da solo, più furgone, attrezzi, assicurazione, commercialista, telefono, ore non fatturabili (sopralluoghi, preventivi, spostamenti, ferie, giorni di pioggia). Solo sopra questo costo pieno c'è il guadagno. Il calcolo passo per passo è nella guida su <a href="/blog/come-fare-prezzo-lavori/">come fissare il prezzo giusto dei lavori</a>.</p>

<h2>Esempio: preventivo di un bagno</h2>
<table>
  <thead>
    <tr><th>Voce</th><th>Costo</th><th>Ricarico</th><th>Prezzo</th></tr>
  </thead>
  <tbody>
    <tr><td>Sanitari e rubinetteria</td><td>1.200 €</td><td>15%</td><td>1.380 €</td></tr>
    <tr><td>Piastrelle e collanti</td><td>900 €</td><td>20%</td><td>1.080 €</td></tr>
    <tr><td>Materiale idraulico</td><td>350 €</td><td>35%</td><td>472,50 €</td></tr>
    <tr><td>Manodopera, 64 ore a costo pieno di 32 €/h</td><td>2.048 €</td><td>25%</td><td>2.560 €</td></tr>
    <tr><td><strong>Totale</strong></td><td><strong>4.498 €</strong></td><td></td><td><strong>5.492,50 €</strong></td></tr>
  </tbody>
</table>
<p>Il guadagno è 994,50 €: un margine del 18,1% sul prezzo, pur avendo usato ricarichi tra il 15 e il 35%. È il numero da guardare quando si decide se un lavoro vale la pena o se si può fare uno sconto.</p>

<h2>Gli sconti mangiano il margine più di quanto sembri</h2>
<p>Con un margine del 18%, uno sconto del 10% sul prezzo porta il margine a circa il 9%: il guadagno si dimezza. Prima di concedere uno sconto, conviene togliere qualcosa dal lavoro (una finitura, una voce opzionale) invece di abbassare il prezzo della stessa cosa. Vedi anche <a href="/blog/come-vincere-piu-lavori/">come vincere più lavori con i preventivi</a>.</p>

<h2>Domande frequenti</h2>
<h3>Qual è un ricarico normale sui materiali?</h3>
<p>Non c'è un valore di legge. Nella pratica si va dal 10–15% sui beni di valore al 30–50% sui piccoli materiali. Conta che il totale renda il margine che ti serve.</p>
<h3>Devo mostrare il ricarico al cliente?</h3>
<p>No. Il cliente vede il prezzo di vendita di ogni voce. Indicare marca e modello dei materiali, però, rende il prezzo più credibile.</p>
<h3>Il margine si calcola prima o dopo l'IVA?</h3>
<p>Sempre sugli importi senza IVA: per un'impresa in regime ordinario l'IVA non è né un costo né un ricavo.</p>
`,

  "sal-stato-avanzamento-lavori": `
<p>Il <strong>SAL, stato di avanzamento lavori</strong>, è il documento che misura quanta parte del lavoro è stata eseguita a una certa data e quanto il committente deve pagare per quella parte. Nei lavori pubblici è regolato in modo rigido; nei lavori privati è uno strumento libero ma molto utile per farsi pagare a fasi invece di anticipare settimane di materiali e manodopera. Ecco come impostarlo nel preventivo e come redigerlo.</p>

<h2>Cosa dice il Codice civile</h2>
<p>Per i lavori privati la regola di base è l'art. 1665 del Codice civile: salvo patto contrario, l'appaltatore ha diritto al pagamento quando l'opera è accettata dal committente. Ma l'art. 1666 prevede che, per le opere da eseguire per partite, ciascuna parte possa chiedere la verifica delle singole partite, e l'appaltatore possa domandare il pagamento in proporzione dell'opera eseguita. Il SAL è il modo pratico di farlo: va però previsto nel preventivo o nel contratto, altrimenti il cliente può pretendere di pagare tutto a fine lavori.</p>

<h2>Come impostare i pagamenti nel preventivo</h2>
<p>Due modi, a seconda della durata del cantiere:</p>
<ul>
  <li><strong>A fasi predefinite</strong>, per lavori fino a qualche settimana: acconto alla firma, poi una rata a fine di ogni fase chiara (demolizioni e impianti, massetti e pavimenti, finiture), saldo alla fine.</li>
  <li><strong>A SAL periodici</strong>, per cantieri lunghi: ogni 30 giorni, o al raggiungimento di un importo (per esempio ogni 15.000 € di lavori eseguiti), si misura il lavoro fatto e si emette la fattura corrispondente.</li>
</ul>
<p>In entrambi i casi conviene scrivere: chi misura e quando, entro quanti giorni il cliente paga, cosa succede se non paga (sospensione dei lavori dopo diffida), e se una piccola percentuale viene trattenuta fino al collaudo. Per l'acconto vedi anche <a href="/blog/acconti-pagamenti-lavori-casa-guida/">acconti e pagamenti nei lavori in casa</a>.</p>

<h2>Come si redige un SAL</h2>
<ol>
  <li>Riprendere le voci del preventivo o del computo, con quantità e prezzi.</li>
  <li>Per ogni voce indicare la quantità eseguita alla data del SAL, misurata o in percentuale (per le voci a corpo).</li>
  <li>Calcolare l'importo eseguito di ogni voce e il totale progressivo.</li>
  <li>Sottrarre quanto già fatturato con i SAL precedenti e l'acconto, se va scalato.</li>
  <li>Aggiungere eventuali varianti approvate per iscritto.</li>
  <li>Far firmare il SAL al committente o al direttore dei lavori e fatturare l'importo.</li>
</ol>

<h2>Esempio: ristrutturazione da 40.000 €</h2>
<table>
  <thead>
    <tr><th>Voce</th><th>Importo contratto</th><th>Eseguito</th><th>Importo eseguito</th></tr>
  </thead>
  <tbody>
    <tr><td>Demolizioni e smaltimenti</td><td>4.000 €</td><td>100%</td><td>4.000 €</td></tr>
    <tr><td>Impianto elettrico</td><td>7.500 €</td><td>70%</td><td>5.250 €</td></tr>
    <tr><td>Impianto idraulico</td><td>6.500 €</td><td>60%</td><td>3.900 €</td></tr>
    <tr><td>Massetti</td><td>3.500 €</td><td>0%</td><td>0 €</td></tr>
    <tr><td>Pavimenti e rivestimenti</td><td>11.000 €</td><td>0%</td><td>0 €</td></tr>
    <tr><td>Finiture e tinteggiature</td><td>7.500 €</td><td>0%</td><td>0 €</td></tr>
    <tr><td><strong>Totale lavori eseguiti al SAL 1</strong></td><td><strong>40.000 €</strong></td><td></td><td><strong>13.150 €</strong></td></tr>
    <tr><td>Meno metà dell'acconto alla firma (4.000 €, scalato su due SAL)</td><td></td><td></td><td>−2.000 €</td></tr>
    <tr><td><strong>Importo del SAL 1</strong></td><td></td><td></td><td><strong>11.150 € + IVA</strong></td></tr>
  </tbody>
</table>

<h2>SAL e detrazioni</h2>
<p>Per le detrazioni fiscali conta la data del pagamento con bonifico parlante, non la data del SAL: un SAL a dicembre pagato a gennaio entra nell'anno successivo. Con aliquote che cambiano da un anno all'altro, è un'informazione da dare al cliente prima di fissare le date dei pagamenti.</p>

<h2>Domande frequenti</h2>
<h3>Il SAL deve essere firmato dal direttore dei lavori?</h3>
<p>Nei lavori privati solo se il contratto lo prevede o se c'è un direttore dei lavori incaricato. In caso contrario basta la firma del committente.</p>
<h3>Si può sospendere il lavoro se il SAL non viene pagato?</h3>
<p>Se il contratto prevede i pagamenti a SAL e il cliente non paga, l'impresa può sospendere i lavori invocando l'eccezione di inadempimento (art. 1460 c.c.), meglio dopo una diffida scritta. Senza un accordo sui SAL è molto più difficile.</p>
<h3>Che differenza c'è con la contabilità lavori?</h3>
<p>Nei lavori pubblici il SAL è parte di una contabilità formale con libretto delle misure e registro di contabilità. Nei privati si usa una versione semplificata, come quella dell'esempio. Per strumenti che lo gestiscono vedi il <a href="/blog/software-preventivi-edili/">software per preventivi edili</a>.</p>
`,

  "varianti-in-corso-opera": `
<p>In quasi ogni cantiere arriva il momento in cui il cliente dice "già che ci siete…", oppure si apre un muro e si scopre un problema che nessuno poteva vedere. Sono le <strong>varianti in corso d'opera</strong>: se gestite a voce, sono la prima causa di liti sul conto finale. Il Codice civile dà regole chiare, e con un documento di una pagina si evitano quasi tutti i problemi.</p>

<h2>Cosa dice il Codice civile</h2>
<ul>
  <li><strong>Art. 1659 — variazioni concordate</strong>: l'appaltatore non può modificare le modalità dell'opera se il committente non le ha autorizzate, e l'autorizzazione si deve provare per iscritto. Senza autorizzazione scritta il rischio è non essere pagati per il lavoro in più.</li>
  <li><strong>Art. 1660 — variazioni necessarie</strong>: se per eseguire l'opera a regola d'arte servono variazioni al progetto e le parti non si accordano, le stabilisce il giudice con l'adeguamento del prezzo. Se superano un sesto del prezzo, l'appaltatore può recedere; se sono di notevole entità, può recedere il committente pagando un equo indennizzo.</li>
  <li><strong>Art. 1661 — variazioni ordinate dal committente</strong>: il committente può chiederle purché non superino un sesto del prezzo complessivo, e l'appaltatore ha diritto al compenso per i maggiori lavori anche se il prezzo era fissato a corpo.</li>
  <li><strong>Art. 1664 — onerosità</strong>: se per circostanze imprevedibili il costo di materiali o manodopera varia di oltre un decimo del prezzo, si può chiedere la revisione per la parte che eccede il decimo.</li>
</ul>

<h2>Il metodo in quattro passi</h2>
<ol>
  <li><strong>Fermarsi prima di eseguire.</strong> Ogni lavoro non previsto si descrive prima di farlo, non a fine cantiere.</li>
  <li><strong>Scrivere la variante.</strong> Un documento numerato e collegato al preventivo originale: cosa si aggiunge, cosa si toglie, quantità, prezzi, effetto sui tempi.</li>
  <li><strong>Farla firmare.</strong> Basta una firma su carta, una firma digitale o un'accettazione via email o WhatsApp in cui il cliente scrive chiaramente "approvo la variante n. 2 da 1.240 €". Il requisito è poterla provare per iscritto.</li>
  <li><strong>Aggiornare il totale.</strong> Il conto finale, o il SAL successivo, mostra il prezzo originale più le varianti approvate. Vedi la guida al <a href="/blog/sal-stato-avanzamento-lavori/">SAL</a>.</li>
</ol>

<h2>Esempio di variante</h2>
<table>
  <thead>
    <tr><th>Variante n. 1 al preventivo 2026/118</th><th>Q.tà</th><th>Prezzo</th><th>Importo</th></tr>
  </thead>
  <tbody>
    <tr><td>Aggiunta: rifacimento tratto di scarico in ghisa ammalorato, sostituito con PP insonorizzato</td><td>4 ml</td><td>85 €</td><td>340 €</td></tr>
    <tr><td>Aggiunta: presa 16 A per lavastoviglie spostata</td><td>1</td><td>110 €</td><td>110 €</td></tr>
    <tr><td>Aggiunta: rivestimento cucina in gres 60×120 invece di 20×20</td><td>8 mq</td><td>+25 €</td><td>200 €</td></tr>
    <tr><td>Tolta: tinteggiatura del ripostiglio (eseguita dal cliente)</td><td>14 mq</td><td>−9 €</td><td>−126 €</td></tr>
    <tr><td><strong>Totale variante</strong></td><td></td><td></td><td><strong>524 € + IVA</strong></td></tr>
  </tbody>
</table>
<p>Effetto sui tempi: +2 giorni lavorativi. Il totale del contratto passa da 18.300 € a 18.824 € IVA esclusa.</p>

<h2>Come prevenire le liti già nel preventivo</h2>
<ul>
  <li>scrivere cosa <strong>non</strong> è compreso: sorprese nei muri, impianti esistenti non a norma, smaltimento di materiali pericolosi;</li>
  <li>indicare i <strong>prezzi unitari</strong> delle voci più probabili da variare (punti luce aggiuntivi, mq in più di rivestimento), così la variante non diventa una trattativa;</li>
  <li>prevedere che i lavori in economia si paghino a un costo orario dichiarato;</li>
  <li>stabilire che nessuna variante si esegue senza approvazione scritta.</li>
</ul>
<p>Sono gli stessi punti che un cliente attento controlla: vedi le <a href="/blog/domande-da-fare-prima-firmare-preventivo/">domande da fare prima di firmare un preventivo</a> e la <a href="/blog/differenza-preventivo-contratto-appalto/">differenza tra preventivo e contratto d'appalto</a>.</p>

<h2>Domande frequenti</h2>
<h3>Il cliente mi ha chiesto il lavoro extra a voce: posso farmelo pagare?</h3>
<p>Se il cliente lo riconosce, sì. Se lo contesta, senza prova scritta dell'autorizzazione (art. 1659) è difficile. Un messaggio inviato prima di eseguire, con descrizione e prezzo, e la risposta del cliente, valgono molto.</p>
<h3>E se il problema è nascosto e non si può rimandare?</h3>
<p>Si documenta con foto, si avvisa subito il cliente con una proposta scritta e si esegue solo il minimo per la sicurezza in attesa della risposta. Vedi anche <a href="/blog/preventivi-foto-cantiere/">come usare le foto del cantiere</a>.</p>
<h3>Le varianti cambiano le detrazioni?</h3>
<p>Se modificano il tipo di intervento o servono a un titolo edilizio diverso, possono richiedere una variante alla pratica edilizia: va verificato con il tecnico.</p>
`,

  "preventivo-lavori-condominio": `
<p>Un preventivo per un condominio non si vince convincendo una persona, ma un'assemblea. Il committente è il condominio, rappresentato dall'amministratore; chi decide sono i condomini, con maggioranze fissate dal Codice civile; e la tua offerta verrà messa accanto ad almeno altre due. Ecco come costruire un preventivo che passa il confronto, quali documenti allegare e quali regole fiscali cambiano rispetto a un privato.</p>

<h2>Chi decide e come</h2>
<ul>
  <li><strong>Manutenzione ordinaria</strong>: la decide l'amministratore nei limiti del suo mandato, o l'assemblea a maggioranza semplice.</li>
  <li><strong>Manutenzione straordinaria di notevole entità</strong> (facciate, tetti, impianti centralizzati): serve una delibera con la maggioranza degli intervenuti che rappresenti almeno metà del valore dell'edificio, cioè 500 millesimi (art. 1136, commi 2 e 4, c.c.).</li>
  <li><strong>Fondo speciale</strong>: per le opere straordinarie l'assemblea deve costituire un fondo pari all'ammontare dei lavori (art. 1135 c.c.), o, se il contratto lo prevede, in base ai pagamenti dovuti a stati di avanzamento.</li>
  <li><strong>Lavori urgenti</strong>: l'amministratore può ordinarli e riferirne alla prima assemblea.</li>
</ul>
<p>Per l'impresa significa tempi lunghi tra sopralluogo e firma, e un preventivo che verrà letto da persone non tecniche. Conviene prevedere una validità dell'offerta più lunga del solito, 60–90 giorni, e dire come si aggiornano i prezzi se l'assemblea slitta.</p>

<h2>Come rendere il preventivo confrontabile</h2>
<p>L'amministratore di solito prepara una tabella con le offerte. Se la tua è scritta in modo diverso dalle altre, rischia di essere scartata o letta male. Aiuta:</p>
<ul>
  <li>seguire il <strong>capitolato</strong> o il computo del tecnico, se c'è, voce per voce e con la stessa numerazione;</li>
  <li>separare <strong>ponteggio, sicurezza e smaltimenti</strong> dalle lavorazioni, perché sono le voci su cui le offerte differiscono di più;</li>
  <li>indicare le <strong>quantità</strong> e chiarire se il prezzo è a corpo o a misura;</li>
  <li>dare un <strong>cronoprogramma</strong> e dire quanti giorni il ponteggio resterà davanti alle finestre;</li>
  <li>proporre <strong>pagamenti a SAL</strong>, coerenti con il fondo lavori (vedi la guida al <a href="/blog/sal-stato-avanzamento-lavori/">SAL</a>).</li>
</ul>
<p>Le stesse regole che usa un cliente per scegliere sono nella guida su <a href="/blog/come-confrontare-preventivi-ristrutturazione/">come confrontare i preventivi</a>.</p>

<h2>Documenti da allegare</h2>
<ul>
  <li>visura camerale e <strong>DURC</strong> in corso di validità: il committente deve verificare l'idoneità tecnico-professionale dell'impresa (art. 90, c. 9, del D.Lgs. 81/2008);</li>
  <li>polizza di responsabilità civile verso terzi, con massimali adeguati a un edificio abitato;</li>
  <li>schede tecniche dei materiali principali e, per i lavori energetici, le certificazioni richieste per le detrazioni;</li>
  <li>referenze di lavori simili, meglio se in condominio;</li>
  <li>dichiarazione sul contratto collettivo applicato ai dipendenti, sempre più spesso richiesta.</li>
</ul>

<h2>Regole fiscali diverse</h2>
<ul>
  <li><strong>Ritenuta del 4%</strong>: il condominio è sostituto d'imposta e trattiene il 4% sui corrispettivi per appalti di opere e servizi (art. 25-ter del D.P.R. 600/1973). In fattura va indicata la ritenuta. Le imprese in regime forfettario non la subiscono, e lo dichiarano in fattura.</li>
  <li><strong>IVA</strong>: sulle parti comuni di un edificio residenziale si applicano le aliquote ridotte delle abitazioni; per un condominio misto conta la prevalenza abitativa. Vedi l'<a href="/blog/iva-lavori-edili/">IVA sui lavori edili</a>.</li>
  <li><strong>Detrazioni</strong>: per le parti comuni la detrazione è ripartita tra i condomini per millesimi, e i pagamenti vanno fatti con bonifico parlante dal conto del condominio.</li>
</ul>

<h2>Errori che fanno perdere il lavoro</h2>
<ul>
  <li>preventivo "a corpo" senza quantità, impossibile da confrontare;</li>
  <li>ponteggio non compreso, mentre le altre offerte lo includono;</li>
  <li>nessun riferimento alla sicurezza per i residenti (passaggi protetti, orari, rumore);</li>
  <li>validità di 15 giorni, scaduta prima dell'assemblea.</li>
</ul>
<p>Per costruire velocemente un preventivo con tutte le voci separate c'è il <a href="/preventivi/edilizia/">generatore di preventivi per imprese edili</a>. Per i lavori di facciata vedi anche l'<a href="/blog/esempio-preventivo-ristrutturazione-facciata/">esempio di preventivo per una facciata</a>.</p>

<h2>Domande frequenti</h2>
<h3>Quanti preventivi chiede di solito un condominio?</h3>
<p>Non c'è un obbligo di legge, ma la prassi è di almeno tre offerte per i lavori straordinari, e molti regolamenti condominiali lo prevedono.</p>
<h3>Chi firma il contratto?</h3>
<p>L'amministratore, in esecuzione della delibera dell'assemblea. Conviene chiedere copia della delibera prima di iniziare.</p>
<h3>Chi paga se un condomino non versa la sua quota?</h3>
<p>Il creditore deve agire prima contro i condomini morosi; solo dopo può rivolgersi agli altri (art. 63 delle disposizioni di attuazione del Codice civile). Il fondo speciale serve proprio a ridurre questo rischio.</p>
`,

  "come-calcolare-mq-pareti-da-pitturare": `
<p>Per fare un preventivo di tinteggiatura serve un numero solo: i <strong>metri quadri da pitturare</strong>. Si calcolano moltiplicando il perimetro di ogni stanza per l'altezza delle pareti, aggiungendo il soffitto e togliendo, secondo una regola da dichiarare, porte e finestre. Ecco il metodo, un esempio completo, quanta pittura serve e come scriverlo nel preventivo.</p>

<h2>La formula</h2>
<ul>
  <li><strong>Pareti</strong> = perimetro della stanza × altezza</li>
  <li><strong>Soffitto</strong> = lunghezza × larghezza (la stessa superficie del pavimento)</li>
  <li><strong>Aperture</strong> = larghezza × altezza di porte e finestre</li>
  <li><strong>Mq da pitturare</strong> = pareti + soffitto − aperture da detrarre</li>
</ul>
<p>Esempio: camera di 4,00 × 3,50 m, altezza 2,70 m, una porta 0,80 × 2,10 e una finestra 1,20 × 1,40.</p>
<ul>
  <li>pareti: 2 × (4,00 + 3,50) × 2,70 = 40,50 mq;</li>
  <li>soffitto: 4,00 × 3,50 = 14,00 mq;</li>
  <li>aperture: 1,68 + 1,68 = 3,36 mq.</li>
</ul>
<p>Detraendo tutte le aperture si ottengono 51,14 mq; con la regola "vuoto per pieno" 54,50 mq.</p>

<h2>Detrarre le aperture o no?</h2>
<p>Molti prezzari regionali misurano intonaci e tinteggiature "vuoto per pieno": le aperture piccole non si detraggono, perché il tempo per lavorare attorno a stipiti e spallette compensa la superficie che manca, e si detraggono solo quelle sopra una certa superficie, spesso 4 mq. Altri imbianchini detraggono tutto e conteggiano a parte le spallette. Entrambi i metodi sono corretti, purché il preventivo dica quale si usa: è il motivo più comune per cui due offerte riportano mq diversi per la stessa casa. La regola esatta del prezzario della tua regione è nelle sue note di misurazione (vedi i <a href="/blog/prezzari-regionali-lavori-edili/">prezzari regionali</a>).</p>

<h2>Il calcolo veloce per un appartamento</h2>
<p>Quando non si può misurare stanza per stanza, per esempio per una prima stima al telefono, si può usare un'approssimazione: con altezze di 2,70 m le pareti di un appartamento sono di solito <strong>2,5–3,5 volte la superficie calpestabile</strong>, e con i soffitti si arriva a <strong>3,5–4,5 volte</strong>: più stanze piccole e corridoi ci sono, più il rapporto sale. Un appartamento di 80 mq ha quindi circa 280–360 mq da pitturare. È un ordine di grandezza da verificare al sopralluogo, non una misura da preventivo.</p>

<h2>Quanta pittura serve</h2>
<p>La resa è indicata sulla scheda tecnica del prodotto, di solito <strong>8–12 mq per litro per mano</strong> per le idropitture lavabili su fondo preparato. Formula:</p>
<p><strong>Litri</strong> = mq × numero di mani ÷ resa</p>
<p>Per 300 mq a due mani con resa 10 mq/l servono 60 litri, cioè quattro secchi da 14 litri più un 10–15% di margine per assorbimento e ritocchi. Il fissativo si calcola allo stesso modo con la sua resa.</p>

<h2>Come scriverlo nel preventivo</h2>
<table>
  <thead>
    <tr><th>Ambiente</th><th>Pareti</th><th>Soffitto</th><th>Totale mq</th></tr>
  </thead>
  <tbody>
    <tr><td>Soggiorno 5,20 × 4,10</td><td>50,22</td><td>21,32</td><td>71,54</td></tr>
    <tr><td>Camera 4,00 × 3,50</td><td>40,50</td><td>14,00</td><td>54,50</td></tr>
    <tr><td>Cameretta 3,20 × 3,00</td><td>33,48</td><td>9,60</td><td>43,08</td></tr>
    <tr><td>Corridoio 6,00 × 1,20</td><td>38,88</td><td>7,20</td><td>46,08</td></tr>
    <tr><td><strong>Totale (vuoto per pieno, h 2,70)</strong></td><td></td><td></td><td><strong>215,20</strong></td></tr>
  </tbody>
</table>
<p>Sotto la tabella vanno il tipo di pittura, il numero di mani, la preparazione (stuccature, fissativo, rasature) e il prezzo al mq. I prezzi di mercato sono nella guida su <a href="/blog/quanto-costa-tinteggiatura-appartamento/">quanto costa tinteggiare un appartamento</a> e le pitture nella guida ai <a href="/blog/tipi-pittura-pareti-quale-scegliere/">tipi di pittura</a>. Per il documento puoi partire dal <a href="/blog/fac-simile-preventivo-tinteggiatura/">fac simile di preventivo per tinteggiatura</a> o generarlo dal <a href="/preventivi/imbianchino/">generatore per imbianchini</a>.</p>

<h2>Domande frequenti</h2>
<h3>Le travi e le nicchie si misurano?</h3>
<p>Sì, sviluppando la superficie reale: una trave a vista si misura per il suo perimetro dipinto per la lunghezza. Spesso conviene un prezzo a parte, perché richiede più tempo.</p>
<h3>Le pareti del vano scala come si misurano?</h3>
<p>Come le altre, ma l'altezza varia: si usa l'altezza media di ogni rampa. Per i soffitti delle rampe si misura la superficie inclinata, non la proiezione.</p>
<h3>Conviene preventivare a mq o a corpo?</h3>
<p>Il prezzo a mq rende il preventivo confrontabile e semplifica le varianti ("se togliamo il corridoio, quanto risparmio?"). Il prezzo a corpo va bene per lavori piccoli.</p>
`,

  "come-calcolare-piastrelle-necessarie": `
<p>Quante piastrelle servono? La risposta è la superficie da coprire più una percentuale di <strong>sfrido</strong>, cioè di materiale che si perde nei tagli, nelle rotture e nella scelta dei pezzi. Lo sfrido va dal 5–10% per una posa dritta in un ambiente regolare al 15–20% per diagonali e formati grandi. Ecco il calcolo completo, dalle scatole al battiscopa, alla colla e al fugante.</p>

<h2>Il calcolo in quattro passi</h2>
<ol>
  <li><strong>Superficie netta</strong>: per il pavimento lunghezza × larghezza di ogni ambiente; per i rivestimenti perimetro × altezza del rivestimento, meno porte e finestre.</li>
  <li><strong>Sfrido</strong>: si aggiunge la percentuale del tipo di posa.</li>
  <li><strong>Scatole</strong>: si divide per i mq contenuti in una scatola e si arrotonda per eccesso.</li>
  <li><strong>Scorta</strong>: per ambienti importanti si tiene almeno una scatola in più dello stesso lotto per le riparazioni future.</li>
</ol>

<h2>Percentuali di sfrido indicative</h2>
<table>
  <thead>
    <tr><th>Posa</th><th>Sfrido</th></tr>
  </thead>
  <tbody>
    <tr><td>Dritta, formato medio (30×60, 60×60), ambiente regolare</td><td>5–10%</td></tr>
    <tr><td>Sfalsata o a correre</td><td>8–12%</td></tr>
    <tr><td>In diagonale</td><td>12–15%</td></tr>
    <tr><td>A spina di pesce, o ambienti con molti angoli</td><td>15–20%</td></tr>
    <tr><td>Grandi formati (120×120, 120×280) o lastre</td><td>10–20%, a seconda del taglio</td></tr>
    <tr><td>Rivestimenti di bagni e cucine con molte interruzioni</td><td>10–15%</td></tr>
  </tbody>
</table>

<h2>Esempio: bagno con pavimento e rivestimento</h2>
<p>Bagno di 2,50 × 2,00 m, rivestimento alto 2,20 m, porta 0,80 × 2,10, finestra 0,80 × 1,00 (davanzale a 1,20 m: la finestra occupa 1,00 × 0,80 = 0,80 mq dentro l'altezza del rivestimento).</p>
<ul>
  <li><strong>Pavimento</strong>: 2,50 × 2,00 = 5,00 mq; con il 10% di sfrido 5,50 mq. Scatole da 1,44 mq (60×60, 4 pezzi): 5,50 ÷ 1,44 = 3,8 → <strong>4 scatole</strong>.</li>
  <li><strong>Rivestimento</strong>: 2 × (2,50 + 2,00) × 2,20 = 19,80 mq, meno porta 1,68 e finestra 0,80 = 17,32 mq; con il 12% di sfrido 19,40 mq. Scatole da 1,08 mq (30×60, 6 pezzi): 19,40 ÷ 1,08 = 17,96 → <strong>18 scatole</strong>.</li>
</ul>
<p>Meglio aggiungere una scatola per ciascun materiale come scorta: piastrelle di lotti diversi possono avere tonalità diverse.</p>

<h2>Battiscopa, colla e fugante</h2>
<ul>
  <li><strong>Battiscopa</strong>: perimetro degli ambienti meno le porte, più 10% per tagli e angoli. Si misura in metri lineari.</li>
  <li><strong>Colla</strong>: dipende dalla spatola. Con una spatola dentata da 6–8 mm servono di solito 3–4 kg/mq; da 10 mm o con la doppia spalmatura dei grandi formati 5–7 kg/mq. Il dato esatto è nella scheda tecnica dell'adesivo.</li>
  <li><strong>Fugante</strong>: dipende da formato, spessore della piastrella e larghezza della fuga; per un 60×60 con fuga di 2 mm si usano poche centinaia di grammi al mq, per un 20×20 con fuga di 5 mm oltre 1 kg/mq. I produttori pubblicano la formula o un calcolatore.</li>
  <li><strong>Distanziatori e sistemi di livellamento</strong>, indispensabili sui grandi formati.</li>
</ul>

<h2>Nel preventivo</h2>
<p>Separate la <strong>fornitura</strong> (mq di piastrelle compreso lo sfrido, con marca e formato) dalla <strong>posa</strong> (mq netti posati). Se il cliente compra le piastrelle da solo, dite per iscritto quanti mq deve comprare e con quale sfrido: se ne mancano a metà lavoro, il fermo cantiere non è colpa vostra. I prezzi di posa sono nella guida sul <a href="/blog/costo-posa-piastrelle-bagno-cucina/">costo della posa delle piastrelle</a>; per i formati vedi <a href="/blog/gres-porcellanato-quale-scegliere/">come scegliere il gres porcellanato</a>. Il preventivo completo si genera dal <a href="/preventivi/piastrellista/">generatore per piastrellisti</a>.</p>

<h2>Domande frequenti</h2>
<h3>Lo sfrido si paga anche nella posa?</h3>
<p>No: la posa si paga sui mq effettivamente posati. Lo sfrido riguarda solo la fornitura del materiale.</p>
<h3>Le piastrelle avanzate si possono restituire?</h3>
<p>Molti rivenditori accettano le scatole integre entro un certo periodo, ma non è un obbligo: va chiesto al momento dell'acquisto.</p>
<h3>Come si calcola il rivestimento di una doccia in muratura?</h3>
<p>Si sviluppano tutte le superfici: pareti, piatto, eventuale muretto su tre lati e nicchie. Conviene uno sfrido più alto, intorno al 15%.</p>
`,
};
