import { fmtEurCents, fmtPercent } from "../format";
import { motoreRevisionato, nonRevisionate, regoleDiAnno } from "./regole/index";
import type { Calcolo, IngressoCalcolo, RegolaId, Spiegazione } from "./types";

// ── A-4: utile netto e chiusura d'anno ───────────────────────────────────────
// Due cose pure, come il resto del motore: nessun database, nessuna data di
// sistema. Chi chiama passa i numeri già letti.
//
// 1. **L'utile netto dopo le tasse.** Nel forfettario i costi veri non
//    riducono le tasse: l'imposta si calcola sugli incassi per il coefficiente
//    ATECO, che *presume* una quota di costi uguale per tutti. È la cosa meno
//    intuitiva del regime e quella che più cambia il conto a fine anno, quindi
//    il calcolo la mette in chiaro invece di nasconderla: costi reali e costi
//    presunti stanno uno accanto all'altro. Senza suggerire nulla — dire "ti
//    conviene l'ordinario" è una consulenza (AMMINISTRAZIONE-PLAN.md §5).
//
// 2. **Il prospetto per la dichiarazione.** Righi del quadro LM (sezione II) e
//    del quadro RR riempiti coi numeri del motore. È un prospetto da ricopiare
//    o da consegnare al commercialista: PrevAI non compila né invia la
//    dichiarazione, che fatta in modo sistematico e a pagamento è esattamente
//    la fattispecie di Cass. SS.UU. 11545/2012. I numeri di rigo sono la regola
//    F20 e nascono da revisionare, come tutte le altre.

const c = (n: number) => Math.round(n);

export type IngressoUtile = {
  anno: number;
  /** Incassi di fatture nell'anno (criterio di cassa): sono i ricavi del forfettario. */
  incassiCents: number;
  /** Entrate registrate a mano che sono ricavi (un rimborso, un lavoro non fatturato). */
  altriRicaviCents: number;
  /** Costi pagati: spese di cantiere, fatture di acquisto collegate, movimenti di costo. */
  costiCents: number;
  /** Il calcolo del motore per lo stesso anno: imposta, contributi e bollo di competenza. */
  calcolo: Pick<Calcolo, "impostaCents" | "contributi" | "bolloCents" | "coefficientePercent" | "revisionato" | "regoleNonRevisionate">;
};

export type UtileNetto = {
  anno: number;
  ricaviCents: number;
  costiCents: number;
  /** Ricavi − costi: quanto è rimasto prima di tasse e contributi. */
  margineCents: number;
  impostaCents: number;
  contributiCents: number;
  bolloCents: number;
  caricoFiscaleCents: number;
  /** Margine − carico fiscale di competenza dell'anno. Può essere negativo. */
  utileNettoCents: number;
  /** Utile netto su ricavi, in percentuale con un decimale. 0 se non ci sono ricavi. */
  utileSuRicaviPercent: number;
  /** Costi che il coefficiente dà per scontati: ricavi × (100 − coefficiente). */
  costiPresuntiCents: number;
  /** Costi reali − costi presunti: positivo = spendi più di quanto il regime presume. */
  scartoCostiCents: number;
  revisionato: boolean;
  regoleNonRevisionate: readonly RegolaId[];
  spiegazioni: readonly Spiegazione[];
};

export function calcolaUtileNetto(ingresso: IngressoUtile): UtileNetto {
  const { calcolo } = ingresso;
  const ricaviCents = Math.max(0, ingresso.incassiCents) + Math.max(0, ingresso.altriRicaviCents);
  const costiCents = Math.max(0, ingresso.costiCents);
  const margineCents = ricaviCents - costiCents;
  const contributiCents = calcolo.contributi.totaleCents;
  const caricoFiscaleCents = calcolo.impostaCents + contributiCents + calcolo.bolloCents;
  const utileNettoCents = margineCents - caricoFiscaleCents;
  // I costi presunti si misurano sugli incassi di fattura, gli stessi su cui
  // il motore applica il coefficiente: gli "altri ricavi" manuali non sono
  // detto che siano ricavi d'impresa, e lì decide il commercialista.
  const costiPresuntiCents = c((Math.max(0, ingresso.incassiCents) * (100 - calcolo.coefficientePercent)) / 100);
  const utileSuRicaviPercent = ricaviCents > 0 ? Math.round((utileNettoCents / ricaviCents) * 1000) / 10 : 0;

  const spiegazioni: Spiegazione[] = [
    {
      id: "utile_netto",
      titolo: "Da dove esce l'utile netto",
      formula: "ricavi incassati − costi pagati − imposta − contributi − bollo dell'anno",
      passaggi: [
        { etichetta: "Incassi di fatture", valore: fmtEurCents(Math.max(0, ingresso.incassiCents)) },
        ...(ingresso.altriRicaviCents > 0 ? [{ etichetta: "Altre entrate registrate come ricavo", valore: fmtEurCents(ingresso.altriRicaviCents) }] : []),
        { etichetta: "Costi pagati", valore: "− " + fmtEurCents(costiCents) },
        { etichetta: "Imposta sostitutiva di competenza", valore: "− " + fmtEurCents(calcolo.impostaCents) },
        { etichetta: "Contributi previdenziali di competenza", valore: "− " + fmtEurCents(contributiCents) },
        ...(calcolo.bolloCents > 0 ? [{ etichetta: "Imposta di bollo", valore: "− " + fmtEurCents(calcolo.bolloCents) }] : []),
      ],
      risultatoCents: utileNettoCents,
      regole: ["F5", "F6", "F7", "F10"],
      fonte: "Elaborazione PrevAI sui numeri del motore fiscale dello stesso anno",
    },
    {
      id: "costi_presunti",
      titolo: "Perché i costi non abbassano le tasse",
      formula: "incassi × (100 % − coefficiente di redditività)",
      passaggi: [
        { etichetta: "Incassi di fatture", valore: fmtEurCents(Math.max(0, ingresso.incassiCents)) },
        { etichetta: "Coefficiente di redditività", valore: fmtPercent(calcolo.coefficientePercent) },
        { etichetta: "Quota di costi che il regime dà per scontata", valore: fmtPercent(100 - calcolo.coefficientePercent) },
        { etichetta: "Costi reali registrati", valore: fmtEurCents(costiCents) },
      ],
      risultatoCents: costiPresuntiCents,
      regole: ["F5"],
      fonte: "L. 190/2014 art. 1 c. 64 e allegato 2 L. 145/2018",
    },
  ];

  return {
    anno: ingresso.anno,
    ricaviCents,
    costiCents,
    margineCents,
    impostaCents: calcolo.impostaCents,
    contributiCents,
    bolloCents: calcolo.bolloCents,
    caricoFiscaleCents,
    utileNettoCents,
    utileSuRicaviPercent,
    costiPresuntiCents,
    scartoCostiCents: costiCents - costiPresuntiCents,
    revisionato: calcolo.revisionato,
    regoleNonRevisionate: calcolo.regoleNonRevisionate,
    spiegazioni,
  };
}

// ── Prospetto per la dichiarazione ───────────────────────────────────────────

export type QuadroDichiarazione = "LM" | "RR";

export type RigoDichiarazione = {
  quadro: QuadroDichiarazione;
  /** Numero di rigo sul modello (`LM34`), o la sezione quando il rigo dipende dal caso. */
  rigo: string;
  descrizione: string;
  /** Il valore come va scritto: un importo, un codice, una percentuale. */
  valore: string;
  /** Presente solo quando il valore è un importo. */
  importoCents?: number;
  nota?: string;
};

export type ProspettoDichiarazione = {
  /** Anno d'imposta. */
  anno: number;
  /** Anno in cui si presenta la dichiarazione (modello Redditi PF `anno + 1`). */
  annoPresentazione: number;
  /** Termine di invio telematico, `YYYY-MM-DD`. */
  termineInvio: string;
  righi: readonly RigoDichiarazione[];
  /** Imposta a debito (positiva) o a credito (negativa) dopo gli acconti. */
  saldoCents: number;
  revisionato: boolean;
  regole: readonly RegolaId[];
  regoleNonRevisionate: readonly RegolaId[];
  avvertenze: readonly string[];
};

export type IngressoProspetto = {
  ingresso: Pick<IngressoCalcolo, "anno" | "codiceAteco" | "incassatiCents" | "contributiVersatiCents" | "gestione">;
  calcolo: Pick<Calcolo, "coefficientePercent" | "aliquotaPercent" | "imponibileCents" | "impostaCents" | "contributi" | "startupAttiva">;
  /** Solo gli **acconti** versati per l'anno (codici 1790 e 1791): il saldo dell'anno prima non c'entra. */
  accontiVersatiCents: number;
};

function iso(anno: number, mese: number, giorno: number): string {
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

export function prospettoDichiarazione({ ingresso, calcolo, accontiVersatiCents }: IngressoProspetto): ProspettoDichiarazione {
  const p = regoleDiAnno(ingresso.anno);
  const redditoLordoCents = calcolo.contributi.redditoCents;
  // I contributi si deducono fino a capienza del reddito: il motore azzera
  // l'imponibile invece di andare sotto zero, e la differenza è ciò che si è
  // davvero dedotto (F6).
  const contributiDedottiCents = Math.max(0, redditoLordoCents - calcolo.imponibileCents);
  const acconti = Math.max(0, accontiVersatiCents);
  const saldoCents = calcolo.impostaCents - acconti;

  const righi: RigoDichiarazione[] = [
    { quadro: "LM", rigo: "LM22", descrizione: "Codice attività (ATECO)", valore: ingresso.codiceAteco || "—", nota: ingresso.codiceAteco ? undefined : "Manca il codice ATECO nel profilo fiscale." },
    { quadro: "LM", rigo: "LM22", descrizione: "Coefficiente di redditività", valore: fmtPercent(calcolo.coefficientePercent) },
    {
      quadro: "LM",
      rigo: "LM22",
      descrizione: "Ricavi o compensi incassati nell'anno",
      valore: fmtEurCents(ingresso.incassatiCents),
      importoCents: ingresso.incassatiCents,
      nota: "Criterio di cassa: gli incassi dell'anno, non le fatture emesse. Una fattura di dicembre incassata a gennaio va nell'anno dopo.",
    },
    { quadro: "LM", rigo: "LM34", descrizione: "Reddito lordo (ricavi × coefficiente)", valore: fmtEurCents(redditoLordoCents), importoCents: redditoLordoCents },
    {
      quadro: "LM",
      rigo: "LM35",
      descrizione: "Contributi previdenziali versati nell'anno e dedotti",
      valore: fmtEurCents(contributiDedottiCents),
      importoCents: contributiDedottiCents,
      nota:
        contributiDedottiCents < Math.max(0, ingresso.contributiVersatiCents)
          ? `Hai versato ${fmtEurCents(ingresso.contributiVersatiCents)}: la parte che supera il reddito non si deduce qui.`
          : undefined,
    },
    { quadro: "LM", rigo: "LM36", descrizione: "Reddito netto", valore: fmtEurCents(calcolo.imponibileCents), importoCents: calcolo.imponibileCents },
    {
      quadro: "LM",
      rigo: "LM37",
      descrizione: "Perdite degli anni precedenti",
      valore: fmtEurCents(0),
      importoCents: 0,
      nota: "PrevAI non conosce le perdite degli anni precedenti: se ne hai, questo rigo e quelli sotto cambiano.",
    },
    { quadro: "LM", rigo: "LM38", descrizione: "Reddito soggetto a imposta sostitutiva", valore: fmtEurCents(calcolo.imponibileCents), importoCents: calcolo.imponibileCents },
    {
      quadro: "LM",
      rigo: "LM39",
      descrizione: `Imposta sostitutiva (${fmtPercent(calcolo.aliquotaPercent)}${calcolo.startupAttiva ? ", start-up" : ""})`,
      valore: fmtEurCents(calcolo.impostaCents),
      importoCents: calcolo.impostaCents,
    },
    {
      quadro: "LM",
      rigo: "LM45",
      descrizione: "Acconti versati per l'anno",
      valore: fmtEurCents(acconti),
      importoCents: acconti,
      nota: "Solo i versamenti registrati in PrevAI con codice 1790 o 1791. Se ne hai fatti fuori da PrevAI, aggiungili.",
    },
    saldoCents >= 0
      ? { quadro: "LM", rigo: "LM46", descrizione: "Imposta a debito (saldo da versare)", valore: fmtEurCents(saldoCents), importoCents: saldoCents }
      : { quadro: "LM", rigo: "LM47", descrizione: "Imposta a credito", valore: fmtEurCents(-saldoCents), importoCents: -saldoCents },
  ];

  const inps = p.inps[ingresso.gestione];
  if (inps && (ingresso.gestione === "artigiani" || ingresso.gestione === "commercianti")) {
    const k = calcolo.contributi;
    righi.push(
      { quadro: "RR", rigo: "RR sez. I", descrizione: `Reddito d'impresa ai fini contributivi (gestione ${ingresso.gestione})`, valore: fmtEurCents(k.redditoCents), importoCents: k.redditoCents },
      { quadro: "RR", rigo: "RR sez. I", descrizione: "Contributi sul minimale (quota fissa)", valore: fmtEurCents(k.fissiCents), importoCents: k.fissiCents },
      { quadro: "RR", rigo: "RR sez. I", descrizione: "Contributi sul reddito eccedente il minimale", valore: fmtEurCents(k.eccedenzaCents), importoCents: k.eccedenzaCents },
      ...(k.scontoCents > 0
        ? [{ quadro: "RR" as const, rigo: "RR sez. I", descrizione: "Riduzione contributiva applicata", valore: "− " + fmtEurCents(k.scontoCents), importoCents: -k.scontoCents }]
        : []),
      { quadro: "RR", rigo: "RR sez. I", descrizione: "Contributi versati nell'anno", valore: fmtEurCents(k.versatiCents), importoCents: k.versatiCents },
    );
  } else if (ingresso.gestione === "gestione_separata") {
    righi.push({
      quadro: "RR",
      rigo: "RR sez. II",
      descrizione: "Gestione separata: reddito e contributi",
      valore: fmtEurCents(calcolo.contributi.totaleCents),
      importoCents: calcolo.contributi.totaleCents,
      nota: "Per la gestione separata il quadro RR ha una sezione propria: controllala col commercialista.",
    });
  }

  const regole: RegolaId[] = ["F5", "F6", "F7", "F10", "F12", "F13", "F20"];
  const revisionato = motoreRevisionato(p);
  const annoPresentazione = ingresso.anno + 1;
  const avvertenze = [
    "Questo è un prospetto, non la dichiarazione: i numeri vanno ricopiati nel modello Redditi PF (o consegnati al tuo commercialista). PrevAI non compila né invia dichiarazioni.",
    `I numeri di rigo sono quelli del modello dell'anno precedente: il modello Redditi PF ${annoPresentazione} va controllato quando esce, perché i righi possono cambiare.`,
    // Il motore ha le regole solo per alcuni anni: per gli altri usa le più
    // vicine. Per un anno già chiuso è la differenza fra un numero giusto e
    // uno plausibile, quindi va detto.
    ...(p.anno !== ingresso.anno
      ? [`Per il ${ingresso.anno} PrevAI non ha ancora le regole di quell'anno e ha usato quelle del ${p.anno}: soglie, aliquote INPS e minimali possono essere diversi.`]
      : []),
    ...(revisionato ? [] : ["Le regole usate per questi numeri non sono ancora state verificate da un commercialista: non usarle per dichiarare senza un controllo professionale."]),
  ];

  return {
    anno: ingresso.anno,
    annoPresentazione,
    termineInvio: iso(annoPresentazione, p.scadenzaDichiarazione.mese, p.scadenzaDichiarazione.giorno),
    righi,
    saldoCents,
    revisionato,
    regole,
    regoleNonRevisionate: nonRevisionate(p, regole),
    avvertenze,
  };
}

// ── Guida al fai-da-te ───────────────────────────────────────────────────────
// Presentare da sé la dichiarazione è un diritto del contribuente e non
// richiede intermediari (AMMINISTRAZIONE-PLAN.md §3): la guida dice dove
// cliccare e che cosa confrontare, non che cosa scegliere.

export type PassoGuida = { titolo: string; testo: string };

export function guidaFaiDaTe(anno: number): readonly PassoGuida[] {
  const p = regoleDiAnno(anno);
  const termine = `${p.scadenzaDichiarazione.giorno}/${p.scadenzaDichiarazione.mese}/${anno + 1}`;
  return [
    { titolo: "Entra nell'area riservata", testo: "Sul sito dell'Agenzia delle Entrate, con SPID, CIE o CNS. Non serve nessun intermediario." },
    {
      titolo: "Apri la dichiarazione precompilata",
      testo: `Scegli il modello Redditi Persone Fisiche per l'anno ${anno}. Per chi ha partita IVA l'Agenzia precompila una parte dei dati partendo dalle fatture elettroniche.`,
    },
    {
      titolo: "Confronta il quadro LM con questo prospetto",
      testo: "Rigo per rigo. Se i ricavi precompilati sono diversi dai nostri, di solito è perché l'Agenzia parte dalle fatture emesse e il forfettario conta gli incassi: una fattura non ancora pagata non è un ricavo dell'anno.",
    },
    { titolo: "Controlla il quadro RR dei contributi", testo: "Reddito, contributi sul minimale e sull'eccedenza, riduzione se l'hai chiesta, contributi già versati." },
    {
      titolo: "Guarda il riepilogo di saldo e acconti",
      testo: "Il saldo e il primo acconto si versano insieme con un F24 solo: lo trovi già compilato nello scadenzario di PrevAI.",
    },
    { titolo: "Invia e conserva la ricevuta", testo: `Il termine per l'invio telematico è il ${termine}. Scarica la ricevuta di presentazione e tienila con i documenti dell'anno.` },
    {
      titolo: "Se qualcosa non torna, fermati",
      testo: "Un valore che non sai spiegare è il momento di sentire un commercialista: puoi mandargli questo pacchetto in sola lettura dalla sezione «Condividi col commercialista».",
    },
  ];
}
