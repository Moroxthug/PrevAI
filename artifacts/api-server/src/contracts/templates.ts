import type { ContractDocument, ContractSection, ContractVariables } from "@workspace/db";
import { MARKET, LEGAL, fmtEur, fmtIsoDateLong, type Lang } from "@workspace/config";

// ── Libreria template contratti ──────────────────────────────────────────────
// Contratto d'appalto per lavori edili e di ristrutturazione (artt. 1655 ss.
// c.c.) a favore di privati e piccole imprese. Un solo template italiano
// ("IT"); le clausole cambiano solo in base alle variabili (ritenuta a
// garanzia, contratto concluso fuori dai locali commerciali, garanzia).
//
// GATE DI REVISIONE LEGALE: il testo è un punto di partenza basato sulle norme
// citate (Codice Civile, Codice del Consumo D.Lgs. 206/2005, D.Lgs. 231/2002,
// D.Lgs. 81/2008). Va rivisto da un legale prima di presentare i contratti
// come "conformi". Incrementare TEMPLATE_VERSION a ogni modifica del testo
// delle clausole, così i contratti firmati conservano traccia della versione.

export const TEMPLATE_VERSION = 2;

export type { Lang };

/** V2-2: un unico template italiano. Le chiavi canadesi (ON/BC/AB/QC/CA) restano solo nei contratti storici. */
export type TemplateKey = "IT";

export function templateKeyForProvince(_province: string | null | undefined): TemplateKey {
  return "IT";
}

function money(n: number): string {
  return fmtEur(n);
}

// ── Testi delle clausole ─────────────────────────────────────────────────────

const TITLE = "Contratto d'appalto per lavori di costruzione e ristrutturazione";

const HEADINGS: Record<string, string> = {
  parties: "1. Parti",
  scope: "2. Oggetto dei lavori",
  price: "3. Corrispettivo",
  payment: "4. Condizioni di pagamento",
  schedule: "5. Tempi di esecuzione",
  changes: "6. Varianti in corso d'opera",
  permits: "7. Titoli abilitativi, norme e sicurezza",
  materials: "8. Materiali, regola d'arte e garanzia",
  site: "9. Condizioni del cantiere e accesso",
  insurance: "10. Assicurazioni e regolarità contributiva",
  holdback: "11. Ritenuta a garanzia e collaudo",
  consumer: "12. Diritto di recesso",
  termination: "13. Risoluzione e recesso dal contratto",
  disputes: "14. Controversie e legge applicabile",
  general: "15. Disposizioni generali",
  signatures: "16. Firme",
};

const CLAUSES = {
  price: (v: ContractVariables): string =>
    `Il Committente si obbliga a corrispondere all'Appaltatore il corrispettivo di **${money(v.total)}** (${money(v.subtotal)} oltre IVA di legge) per i Lavori, come dettagliato nella tabella prezzi che segue. Il corrispettivo è a corpo per i Lavori descritti all'art. 2 e può essere modificato solo con variante scritta ai sensi dell'art. 6 (art. 1659 c.c.).`,
  payment: (v: ContractVariables): string => {
    const holdback = v.paymentSchedule.holdback.enabled
      ? ` Su ogni pagamento in acconto sarà trattenuta una ritenuta a garanzia del ${v.paymentSchedule.holdback.percent} %, svincolata secondo l'art. 11.`
      : "";
    return `I pagamenti sono dovuti secondo il piano di pagamento riportato di seguito. Ogni fattura è pagabile entro il numero di giorni indicato dalla data di emissione. Sugli importi non pagati alla scadenza decorrono gli interessi di mora ai sensi del ${LEGAL.moraRiferimento} (per i consumatori, gli interessi legali ex art. 1284 c.c.). L'Appaltatore può sospendere i Lavori quando una fattura è scaduta da oltre 10 giorni e i termini di esecuzione si intendono prorogati di pari durata.${holdback}\n\nModalità di pagamento accettate: bonifico bancario, assegno o altra modalità concordata per iscritto. Per importi pari o superiori a € 5.000 non è ammesso il contante (art. 49 D.Lgs. 231/2007).`;
  },
  changes:
    `Qualsiasi variante ai Lavori (aggiunte, eliminazioni, sostituzioni o modifiche richieste dal Committente o rese necessarie da condizioni impreviste o da prescrizioni delle autorità) deve essere documentata con una variante scritta che ne indichi contenuto, prezzo ed effetto sui tempi (artt. 1659-1661 c.c.). L'Appaltatore non è tenuto a eseguire le lavorazioni variate finché la variante non è approvata per iscritto (anche in via elettronica) dal Committente. Corrispettivo e tempi sono adeguati da ogni variante approvata.`,
  permits:
    `Salvo diversa indicazione all'art. 2, l'Appaltatore predispone la documentazione tecnica necessaria per i titoli abilitativi richiesti dai Lavori (CILA, SCIA o permesso di costruire) tramite il tecnico incaricato; oneri di urbanizzazione, diritti di segreteria e onorari professionali non sono compresi nel corrispettivo e saranno fatturati a parte. I Lavori sono eseguiti nel rispetto delle norme tecniche applicabili, del regolamento edilizio comunale e del D.Lgs. 81/2008 in materia di sicurezza; ove previsto, il Committente nomina il coordinatore per la sicurezza. Il Committente è responsabile di ottenere le autorizzazioni eventualmente richieste dal condominio, dal proprietario o da altri terzi.`,
  materials: (v: ContractVariables): string =>
    `L'Appaltatore fornisce materiali nuovi della qualità descritta all'art. 2 ed esegue i Lavori a regola d'arte (art. 1662 c.c.). L'Appaltatore garantisce l'esecuzione per **${v.warrantyMonths} mesi** dalla fine dei lavori e corregge senza addebito i difetti di esecuzione denunciati per iscritto in tale periodo. Le garanzie dei produttori su materiali, apparecchi e impianti sono trasferite al Committente. La garanzia non copre la normale usura, i danni causati da terzi, l'uso improprio, la mancata manutenzione o i materiali forniti dal Committente. Restano ferme le garanzie di legge per difformità e vizi dell'opera (${LEGAL.garanziaRiferimento}: denuncia entro ${LEGAL.garanziaDenunciaGiorni} giorni dalla scoperta, azione entro ${LEGAL.garanziaAnni} anni dalla consegna) e per rovina e gravi difetti degli immobili (art. 1669 c.c., ${LEGAL.garanziaGraviDifettiAnni} anni), nonché, ove applicabili, le tutele del Codice del Consumo.`,
  site:
    `Il Committente garantisce all'Appaltatore un accesso ragionevole al cantiere negli orari di lavoro, fornisce acqua ed energia elettrica e rimuove o protegge i beni personali presenti nell'area dei lavori. Se l'Appaltatore rileva condizioni che non potevano ragionevolmente essere previste (tra cui danni nascosti, amianto, muffe, carenze strutturali o opere esistenti non conformi), ne informa il Committente e ogni lavorazione aggiuntiva è gestita come variante ai sensi dell'art. 6. L'Appaltatore mantiene il cantiere ragionevolmente pulito e smaltisce i rifiuti di cantiere a fine lavori secondo la normativa vigente.`,
  insurance:
    `L'Appaltatore mantiene una polizza di responsabilità civile verso terzi e prestatori d'opera (RCT/RCO) con massimale non inferiore a € 1.000.000 per sinistro, è in regola con gli obblighi contributivi e assicurativi (DURC regolare) e ne fornisce prova a richiesta. Il Committente resta responsabile dell'assicurazione dell'immobile e del suo contenuto. Nessuna delle parti risponde verso l'altra dei danni indiretti o consequenziali, salvo dolo o colpa grave.`,
  holdback: (v: ContractVariables): string => {
    const pct = v.paymentSchedule.holdback.percent;
    return v.paymentSchedule.holdback.enabled
      ? `Il Committente trattiene, a garanzia della corretta esecuzione, il ${pct} % del valore dei Lavori su ogni pagamento (art. 1666 c.c.). La ritenuta è svincolata entro 30 giorni dal collaudo o dall'accettazione dell'opera, che si intende avvenuta se il Committente non procede alla verifica entro 30 giorni dall'invito dell'Appaltatore o la riceve senza riserve (art. 1665 c.c.).`
      : `Le parti convengono che nessuna ritenuta a garanzia sarà trattenuta sui pagamenti in acconto. Il Committente ha diritto di verificare l'opera prima di riceverla; l'opera si intende accettata se il Committente non procede alla verifica entro 30 giorni dall'invito dell'Appaltatore o la riceve senza riserve (art. 1665 c.c.).`;
  },
  consumer: (v: ContractVariables): string => {
    // Il diritto di recesso di 14 giorni si applica ai contratti conclusi
    // fuori dai locali commerciali con un consumatore (art. 52 Cod. Consumo).
    if (!v.directAgreement) {
      return `Il presente contratto non è stato concluso fuori dai locali commerciali dell'Appaltatore né a distanza. Nessuna disposizione del presente contratto limita i diritti che il Committente, se consumatore, ha ai sensi del Codice del Consumo (D.Lgs. 206/2005).`;
    }
    return `**Diritto di recesso.** Il presente contratto è stato concluso fuori dai locali commerciali dell'Appaltatore. Se il Committente è un consumatore, ai sensi degli ${LEGAL.recessoRiferimento} può recedere senza motivazione entro **${LEGAL.recessoGiorni} giorni** dalla conclusione del contratto, inviando all'Appaltatore, all'indirizzo indicato nel contratto, una dichiarazione esplicita con qualsiasi mezzo idoneo a provarne la data (raccomandata, PEC, email). Se il Committente chiede espressamente che i Lavori inizino durante il periodo di recesso e poi recede, è tenuto a corrispondere un importo proporzionale a quanto eseguito fino alla comunicazione del recesso (art. 57 Cod. Consumo). Entro 14 giorni dal recesso l'Appaltatore rimborsa le somme ricevute, dedotto quanto sopra.`;
  },
  termination:
    `Ciascuna parte può risolvere il presente contratto con comunicazione scritta se l'altra parte commette un inadempimento grave e non vi pone rimedio entro dieci (10) giorni dalla diffida scritta (art. 1454 c.c.). Il Committente può recedere dal contratto anche a lavori iniziati, tenendo indenne l'Appaltatore delle spese sostenute, dei lavori eseguiti e del mancato guadagno (art. 1671 c.c.). In caso di risoluzione l'Appaltatore lascia il cantiere in condizioni di sicurezza e consegna i materiali già pagati dal Committente.`,
  disputes:
    `Le parti tenteranno anzitutto di comporre bonariamente ogni controversia. In mancanza di accordo entro 30 giorni, ciascuna parte potrà proporre la mediazione ai sensi del D.Lgs. 28/2010 prima di avviare un giudizio, salvo i provvedimenti urgenti. Il presente contratto è regolato dalla legge italiana. Per le controversie con un consumatore è competente il foro del luogo di residenza o domicilio del consumatore (${LEGAL.foroConsumatore}); negli altri casi è competente il foro della sede dell'Appaltatore.`,
  general: (v: ContractVariables): string =>
    `Il presente contratto, compreso il preventivo su cui si basa (${v.quoteNumber}) e ogni variante approvata, costituisce l'intero accordo tra le parti e sostituisce ogni precedente intesa. Può essere modificato solo per iscritto. L'eventuale nullità di una clausola non pregiudica la validità delle altre. Il Committente non può cedere il contratto senza il consenso dell'Appaltatore; il subappalto è ammesso nei limiti dell'art. 1656 c.c. Le comunicazioni possono essere inviate via email o PEC agli indirizzi indicati nel contratto. Le firme elettroniche apposte tramite ${MARKET.brand} hanno l'efficacia prevista dal ${LEGAL.firmaRiferimento}. I dati personali sono trattati nel rispetto del ${LEGAL.privacyRiferimento}.`,
  signatures:
    `Con la sottoscrizione, ciascuna parte dichiara di aver letto e compreso il presente contratto, incluso il diritto di recesso di cui all'art. 12, e di accettarne integralmente il contenuto. Ai sensi degli artt. 1341 e 1342 c.c. il Committente approva specificamente gli artt. 4 (interessi di mora e sospensione), 8 (limiti di garanzia), 10 (esclusione danni indiretti), 13 (risoluzione) e 14 (foro competente).`,
};

// ── Fallback per le sezioni redatte dall'IA ──────────────────────────────────

export function fallbackScope(v: ContractVariables, _lang?: Lang): string {
  const intro = `L'Appaltatore eseguirà le seguenti lavorazioni presso il cantiere (${v.siteAddress}) in conformità al preventivo ${v.quoteNumber}:`;
  const lines = v.priceLines.map((l) => `- ${l.label}`).join("\n");
  const outro = `Tutto quanto non espressamente descritto sopra è escluso dal corrispettivo.`;
  return `${intro}\n\n${lines}\n\n${outro}`;
}

export function fallbackSchedule(v: ContractVariables, _lang?: Lang): string {
  const start = v.startDate ? fmtIsoDateLong(v.startDate) : null;
  return `I Lavori inizieranno ${start ? `il ${start}` : "in una data concordata per iscritto tra le parti"}${v.estimatedDurationWeeks ? ` e avranno una durata stimata di circa ${v.estimatedDurationWeeks} settimana/e` : ""}, fatti salvi il rilascio dei titoli abilitativi, i tempi di consegna dei materiali e le condizioni meteorologiche. Le date sono stime in buona fede; l'Appaltatore comunicherà al Committente ogni ritardo significativo e i termini saranno adeguati di conseguenza.`;
}

// ── Composizione del documento ───────────────────────────────────────────────

export function buildContractDocument(params: {
  templateKey: TemplateKey;
  language: Lang;
  variables: ContractVariables;
  scopeBody: string;
  scheduleBody: string;
}): ContractDocument {
  const { templateKey: key, language: lang, variables: v } = params;
  const h = (k: string) => HEADINGS[k];

  const sections: ContractSection[] = [
    { key: "parties", heading: h("parties"), body: "", kind: "data", editable: false },
    { key: "scope", heading: h("scope"), body: params.scopeBody, kind: "ai", editable: true },
    { key: "price", heading: h("price"), body: CLAUSES.price(v), kind: "data", editable: false },
    { key: "payment", heading: h("payment"), body: CLAUSES.payment(v), kind: "data", editable: false },
    { key: "schedule", heading: h("schedule"), body: params.scheduleBody, kind: "ai", editable: true },
    { key: "changes", heading: h("changes"), body: CLAUSES.changes, kind: "legal", editable: false },
    { key: "permits", heading: h("permits"), body: CLAUSES.permits, kind: "legal", editable: false },
    { key: "materials", heading: h("materials"), body: CLAUSES.materials(v), kind: "legal", editable: false },
    { key: "site", heading: h("site"), body: CLAUSES.site, kind: "legal", editable: false },
    { key: "insurance", heading: h("insurance"), body: CLAUSES.insurance, kind: "legal", editable: false },
    { key: "holdback", heading: h("holdback"), body: CLAUSES.holdback(v), kind: "legal", editable: false },
    { key: "consumer", heading: h("consumer"), body: CLAUSES.consumer(v), kind: "legal", editable: false },
    { key: "termination", heading: h("termination"), body: CLAUSES.termination, kind: "legal", editable: false },
    { key: "disputes", heading: h("disputes"), body: CLAUSES.disputes, kind: "legal", editable: false },
    { key: "general", heading: h("general"), body: CLAUSES.general(v), kind: "legal", editable: false },
    { key: "signatures", heading: h("signatures"), body: CLAUSES.signatures, kind: "data", editable: false },
  ];

  return {
    templateKey: key,
    templateVersion: TEMPLATE_VERSION,
    language: lang,
    title: TITLE,
    sections,
  };
}

/**
 * Rigenera ogni sezione non modificabile dalle variabili correnti mantenendo
 * i testi IA/modificabili che l'utente può aver cambiato. Usata dopo che
 * l'impresa modifica le variabili (data inizio, ritenuta, contratto fuori sede…).
 */
export function refreshLockedSections(doc: ContractDocument, variables: ContractVariables): ContractDocument {
  const scope = doc.sections.find((s) => s.key === "scope")?.body ?? fallbackScope(variables);
  const schedule = doc.sections.find((s) => s.key === "schedule")?.body ?? fallbackSchedule(variables);
  return buildContractDocument({ templateKey: "IT", language: MARKET.lang, variables, scopeBody: scope, scheduleBody: schedule });
}
