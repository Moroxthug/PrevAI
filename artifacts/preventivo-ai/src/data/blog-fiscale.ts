// A-5: corpi degli articoli SEO sulle tasse del forfettario.
//
// Soglie, aliquote e l'esempio numerico non sono scritti a mano: vengono dalle
// regole del motore (`regoleDiAnno`) e da `calcola()` sul caso golden G1. Se
// il commercialista corregge una regola (D6), l'articolo si aggiorna al build
// successivo invece di restare a dire il numero vecchio.

import { CASI_GOLDEN, calcola, fmtEurCents, fmtPercent, regoleDiAnno, type IngressoCalcolo } from "@workspace/config";

const ANNO = 2026;
const P = regoleDiAnno(ANNO);
const INPS = P.inps.artigiani!;

const G1 = CASI_GOLDEN.find((c) => c.id === "G1")!.ingresso;
const esempio = calcola(G1);

// Soglia: 70.000 € incassati, 8.000 € fatturati e non incassati, 15.000 € di preventivi accettati.
const ingressoSoglia: IngressoCalcolo = { ...G1, incassatiCents: 7_000_000, fatturatoNonIncassatoCents: 800_000, pipelineCents: 1_500_000, meseCorrente: 9 };
const soglia = calcola(ingressoSoglia).soglia;

const eur = fmtEurCents;
const pct = fmtPercent;

const FONTI = `
<h2>Fonti</h2>
<ul>
  <li>Legge 190/2014, art. 1, commi 54-89 (regime forfettario), come modificata dalla Legge 145/2018</li>
  <li>INPS, circolare sui contributi di artigiani e commercianti per il ${ANNO}</li>
</ul>
<p><em>Questo articolo è informazione generale, non consulenza fiscale: per la tua situazione verifica i numeri con un commercialista.</em></p>
`;

export const BLOG_FISCALE_CONTENT: Record<string, string> = {
  "tasse-forfettario-elettricista-idraulico": `
<p>Nel regime forfettario le tasse non si calcolano sui costi che sostieni, ma su una percentuale fissa di quello che incassi. Per chi lavora negli impianti e nell'edilizia questa percentuale è la più alta della tabella, e per questo conviene sapere esattamente come funziona il calcolo.</p>

<h2>I tre numeri che decidono tutto</h2>
<ul>
  <li><strong>Coefficiente di redditività</strong>: per elettricisti, idraulici e le altre attività dei gruppi ATECO 41-43 è ${pct(esempio.coefficientePercent)}. Su 100 € incassati, ${esempio.coefficientePercent} € sono considerati reddito.</li>
  <li><strong>Imposta sostitutiva</strong>: ${pct(P.aliquotaOrdinariaPercent)} sul reddito, che scende al ${pct(P.aliquotaStartupPercent)} per i primi ${P.anniStartup} anni di una nuova attività con i requisiti di legge.</li>
  <li><strong>Contributi INPS artigiani</strong>: ${pct(INPS.aliquotaPercent)} del reddito, con un minimo annuo dovuto anche se guadagni meno (reddito minimale di ${eur(INPS.minimaleCents)}).</li>
</ul>

<h2>L'esempio: un idraulico che incassa ${eur(G1.incassatiCents)}</h2>
<p>Terzo anno di attività, aliquota ordinaria, nessuna riduzione contributiva, contributi fissi già versati nell'anno per ${eur(G1.contributiVersatiCents)}.</p>
<ul>
  <li>Reddito forfettario: ${eur(G1.incassatiCents)} × ${pct(esempio.coefficientePercent)}</li>
  <li>Contributi INPS dell'anno: <strong>${eur(esempio.contributi.totaleCents)}</strong></li>
  <li>Imponibile, cioè il reddito meno i contributi versati nell'anno: <strong>${eur(esempio.imponibileCents)}</strong></li>
  <li>Imposta sostitutiva al ${pct(esempio.aliquotaPercent)}: <strong>${eur(esempio.impostaCents)}</strong></li>
</ul>
<p>In tutto, fra imposta e contributi, <strong>${eur(esempio.impostaCents + esempio.contributi.totaleCents)}</strong> su ${eur(G1.incassatiCents)} incassati. I contributi sono deducibili nell'anno in cui li versi: per questo l'imponibile dipende da quando paghi le rate INPS, non solo da quanto guadagni.</p>

<h2>Perché conta la data dell'incasso</h2>
<p>Il forfettario segue il criterio di cassa: conta il giorno in cui il bonifico arriva, non la data della fattura. Una fattura di dicembre pagata a gennaio finisce nell'anno dopo, e sposta di un anno sia le tasse sia il conteggio per la soglia dei ricavi.</p>

<h2>Le scadenze da segnare</h2>
<ul>
  <li><strong>30 giugno</strong>: saldo dell'anno precedente e primo acconto dell'anno in corso, nello stesso F24</li>
  <li><strong>30 novembre</strong>: secondo acconto</li>
  <li><strong>16 maggio, 20 agosto, 16 novembre, 16 febbraio</strong>: le quattro rate dei contributi INPS fissi</li>
</ul>
<p>Un <a href="/amministrazione/">software che tiene insieme preventivi, fatture e tasse</a> fa questo calcolo a ogni incasso e ti dice quanto mettere via, invece di lasciarti la sorpresa a giugno.</p>
${FONTI}`,

  "soglia-85000-forfettario-calcolo": `
<p>Il regime forfettario ha un limite di ricavi: ${eur(P.sogliaRicaviCents)} l'anno. Superarlo non è un disastro, ma cambia le regole dall'anno dopo, o addirittura da subito. Ecco come si calcola e come accorgersene in tempo.</p>

<h2>Cosa conta nella soglia</h2>
<ul>
  <li>Contano i ricavi <strong>incassati</strong> nell'anno, per cassa: la data del pagamento, non quella della fattura.</li>
  <li>Non conta l'IVA, che nel forfettario non si applica.</li>
</ul>

<h2>Cosa succede se la superi</h2>
<ul>
  <li><strong>Fra ${eur(P.sogliaRicaviCents)} e ${eur(P.sogliaUscitaImmediataCents)}</strong>: resti forfettario fino al 31 dicembre, ed esci dal regime dall'anno successivo.</li>
  <li><strong>Oltre ${eur(P.sogliaUscitaImmediataCents)}</strong>: esci subito. Dalla fattura che fa superare il limite si applica l'IVA, e il reddito di quell'anno si determina con le regole ordinarie.</li>
</ul>

<h2>Il caso tipico dell'artigiano edile: il lavoro già accettato</h2>
<p>A settembre un impresario ha incassato ${eur(ingressoSoglia.incassatiCents)}, ha fatture emesse e non ancora pagate per ${eur(ingressoSoglia.fatturatoNonIncassatoCents)} e preventivi accettati da fatturare per ${eur(ingressoSoglia.pipelineCents)}. Guardando solo gli incassi sembra lontano dal limite; sommando tutto, a fine anno arriverebbe a <strong>${eur(soglia.proiezioneCents)}</strong>, cioè ${soglia.proiezioneCents > P.sogliaRicaviCents ? "oltre" : "sotto"} la soglia di ${eur(P.sogliaRicaviCents)}.</p>
<p>Nel forfettario il momento dell'incasso si può spesso concordare col cliente: sapere a settembre che il cantiere di novembre ti porterebbe oltre la soglia ti lascia il tempo di decidere quando farlo pagare, e di parlarne col commercialista.</p>

<h2>Come tenerla sotto controllo</h2>
<p>Serve un conto che sommi incassi, fatture aperte e lavoro accettato, aggiornato ogni volta che qualcosa cambia. È il principio del <a href="/amministrazione/">monitor della soglia di PrevAI</a>, che conta anche i preventivi accettati e non ancora fatturati.</p>
${FONTI}`,

  "quanto-mettere-da-parte-tasse-forfettario": `
<p>Il problema del forfettario non è il calcolo delle tasse, che è semplice: è che si pagano tutte insieme, mesi dopo aver incassato. Per non arrivare a giugno senza soldi serve una regola per accantonare a ogni incasso.</p>

<h2>Perché giugno è il mese difficile</h2>
<p>Il ${P.acconti.scadenzaSaldoEPrimoAcconto.giorno} giugno si versano in un solo F24 il saldo dell'imposta dell'anno prima e il primo acconto di quello in corso (${pct(P.acconti.primaRatePercent)} del totale degli acconti); il ${P.acconti.scadenzaSecondoAcconto.giorno} novembre il secondo acconto (${pct(P.acconti.secondaRatePercent)}). Chi è al primo anno non paga acconti, e al secondo anno si ritrova a pagare due anni di imposta quasi insieme.</p>

<h2>Quanto accantonare: l'esempio</h2>
<p>Riprendiamo l'idraulico che incassa ${eur(G1.incassatiCents)} l'anno: fra imposta e contributi il costo fiscale dell'anno è di <strong>${eur(esempio.totaleDovutoCents)}</strong>. Tolto quanto ha già versato e aggiunto un margine di sicurezza del ${pct(G1.margineSicurezzaPercent)}, a inizio anno deve mettere da parte circa <strong>${eur(esempio.daMettereViaMensileCents)} al mese</strong>. E su ogni euro che incassa da lì in avanti conviene accantonarne circa il <strong>${pct(esempio.percentualeSuIncassi)}</strong>: è la quota che quell'euro aggiunge fra imposta e contributi, margine compreso.</p>
<p>La percentuale cambia da impresa a impresa: con meno incassi pesano di più i contributi minimi INPS, che sono dovuti comunque; con l'aliquota start-up l'imposta è un terzo.</p>

<h2>Tre abitudini che funzionano</h2>
<ul>
  <li><strong>Un conto separato</strong> dove spostare la quota a ogni bonifico ricevuto, non a fine mese.</li>
  <li><strong>Ricalcolare dopo ogni incasso grosso</strong>: un cantiere importante cambia la percentuale.</li>
  <li><strong>Segnare anche i contributi fissi</strong>: sono quattro rate l'anno, e sono deducibili solo quando le paghi.</li>
</ul>
<p>Con il <a href="/amministrazione/">calcolo fiscale di PrevAI</a> la cifra da mettere via si aggiorna da sola a ogni incasso registrato sulle fatture, con la formula di ogni numero.</p>
${FONTI}`,
};
