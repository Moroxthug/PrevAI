import { fmtEurCents, fmtPercent } from "../format";
import { coefficienteDiAteco } from "./ateco";
import { motoreRevisionato, nonRevisionate, regoleDiAnno } from "./regole/index";
import type {
  Calcolo,
  Contributi,
  IngressoCalcolo,
  LivelloSoglia,
  MonitorSoglia,
  ParametriAnno,
  ParametriInps,
  RegolaId,
  Scadenza,
  Spiegazione,
} from "./types";

// ── A-2: il calcolo ──────────────────────────────────────────────────────────
// Funzione pura: dentro i numeri dell'anno, fuori gli importi **con la loro
// spiegazione**. Nessun accesso al database, nessuna data "di sistema" letta
// di nascosto (l'anno e il mese arrivano dall'ingresso), così i test golden
// sono riproducibili a distanza di anni.
//
// Due scelte di modellazione che vale la pena dire ad alta voce, perché non
// sono ovvie e sono quelle su cui il commercialista va sentito:
//
// 1. **La base INPS non è la base fiscale.** I contributi si calcolano sul
//    reddito forfettario (incassi × coefficiente); l'imposta sostitutiva si
//    calcola su quello **meno** i contributi versati nell'anno. Dedurre i
//    contributi anche dalla base INPS sarebbe un errore a favore dell'utente,
//    che si accorgerebbe del buco solo a saldo. → domanda F10/F6.
// 2. **Criterio di cassa ovunque.** Conta ciò che è stato incassato e ciò che
//    è stato versato, non ciò che è stato fatturato. Il fatturato non incassato
//    non fa imposta, ma pesa sul monitor della soglia: → `MonitorSoglia`.

const c = (n: number) => Math.round(n);

function percentuale(baseCents: number, percent: number): number {
  return c((baseCents * percent) / 100);
}

function iso(anno: number, mese: number, giorno: number): string {
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

/** Il 5 % vale per i primi `anniStartup` periodi d'imposta, contando anche quello di apertura. */
export function aliquotaApplicabile(ingresso: IngressoCalcolo, p: ParametriAnno): { percent: number; startupAttiva: boolean } {
  const { requisitiStartup, annoInizioAttivita, anno } = ingresso;
  const dentroIlQuinquennio =
    annoInizioAttivita !== null && anno >= annoInizioAttivita && anno - annoInizioAttivita < p.anniStartup;
  const startupAttiva = requisitiStartup && dentroIlQuinquennio;
  return { percent: startupAttiva ? p.aliquotaStartupPercent : p.aliquotaOrdinariaPercent, startupAttiva };
}

function riduzionePercent(ingresso: IngressoCalcolo, p: ParametriAnno): number {
  // Le riduzioni contributive esistono solo nelle gestioni artigiani e
  // commercianti: in gestione separata non c'è nulla da ridurre.
  if (ingresso.gestione !== "artigiani" && ingresso.gestione !== "commercianti") return 0;
  if (ingresso.riduzione === "forfettari_35") return p.riduzioneForfettariPercent;
  if (ingresso.riduzione === "nuovi_iscritti_50") return p.riduzioneNuoviIscrittiPercent;
  return 0;
}

/**
 * Contributi previdenziali dovuti per l'anno. `redditoCents` è il reddito
 * forfettario (incassi × coefficiente), **non** l'imponibile fiscale.
 */
export function calcolaContributi(redditoCents: number, ingresso: IngressoCalcolo, p: ParametriAnno): Contributi {
  const parametri: ParametriInps | null = p.inps[ingresso.gestione];
  const versatiCents = Math.max(0, ingresso.contributiVersatiCents);
  if (!parametri) {
    // Cassa professionale o nessuna gestione: non inventiamo un importo.
    return { redditoCents, fissiCents: 0, eccedenzaCents: 0, maternitaCents: 0, scontoCents: 0, totaleCents: 0, versatiCents, residuoCents: 0 };
  }

  const reddito = Math.max(0, redditoCents);
  const tetto = parametri.massimaleCents > 0 ? Math.min(reddito, parametri.massimaleCents) : reddito;

  const fissiCents = percentuale(parametri.minimaleCents, parametri.aliquotaPercent);

  // Eccedenza in due scaglioni: sopra `scaglioneSuperioreCents` l'aliquota
  // cresce di un punto.
  const inizioEccedenza = parametri.minimaleCents;
  const confine = parametri.scaglioneSuperioreCents > 0 ? parametri.scaglioneSuperioreCents : tetto;
  const primoScaglione = Math.max(0, Math.min(tetto, confine) - inizioEccedenza);
  const secondoScaglione = Math.max(0, tetto - Math.max(inizioEccedenza, confine));
  const eccedenzaCents =
    percentuale(primoScaglione, parametri.aliquotaPercent) +
    percentuale(secondoScaglione, parametri.aliquotaPercent + parametri.aliquotaAggiuntivaPercent);

  // Lo sconto non tocca il contributo di maternità: è una somma fissa dovuta
  // da tutti gli iscritti.
  const rid = riduzionePercent(ingresso, p);
  const scontoCents = percentuale(fissiCents + eccedenzaCents, rid);
  const totaleCents = fissiCents + eccedenzaCents - scontoCents + parametri.maternitaCents;

  return {
    redditoCents: reddito,
    fissiCents,
    eccedenzaCents,
    maternitaCents: parametri.maternitaCents,
    scontoCents,
    totaleCents,
    versatiCents,
    residuoCents: Math.max(0, totaleCents - versatiCents),
  };
}

/**
 * Monitor della soglia. Guarda tre numeri diversi e li tiene separati apposta:
 * quello che hai incassato, quello che hai già emesso, e quello che hai in
 * mano ma non ancora fatturato. È l'unico punto del modulo in cui un lavoro
 * ancora da fare cambia un semaforo, e l'artigiano deve poter vedere quale dei
 * tre lo sta muovendo.
 */
export function monitoraSoglia(ingresso: IngressoCalcolo, p: ParametriAnno): MonitorSoglia {
  const maturatoCents = Math.max(0, ingresso.incassatiCents) + Math.max(0, ingresso.fatturatoNonIncassatoCents);
  const proiezioneCents = maturatoCents + Math.max(0, ingresso.pipelineCents);
  const soglia = p.sogliaRicaviCents;
  const uscita = p.sogliaUscitaImmediataCents;
  const percentualeConsumata = soglia > 0 ? Math.round((maturatoCents / soglia) * 1000) / 10 : 0;

  let livello: LivelloSoglia = "ok";
  let conseguenza =
    "Sei dentro il regime forfettario. La soglia si misura sui ricavi dell'anno solare.";
  if (maturatoCents > uscita) {
    livello = "fuori_regime";
    conseguenza =
      "Hai superato i 100.000 € di ricavi: l'uscita dal regime forfettario è immediata e l'IVA va applicata a partire dall'operazione che ha fatto superare la soglia. Questa è una situazione da portare a un commercialista adesso, non a fine anno.";
  } else if (maturatoCents > soglia) {
    livello = "superata";
    conseguenza =
      "Hai superato gli 85.000 € ma non i 100.000 €: resti forfettario fino al 31 dicembre ed esci dal regime dal 1° gennaio dell'anno prossimo, con IVA, registri e dichiarazione ordinaria.";
  } else if (proiezioneCents > soglia) {
    livello = "vicino";
    conseguenza =
      "Sei ancora sotto la soglia, ma con il lavoro che hai già accettato la supereresti. Vale la pena sapere entro quando incassare, perché conta la data dell'incasso, non quella della fattura.";
  } else if (maturatoCents >= percentuale75(soglia)) {
    livello = "attenzione";
    conseguenza = "Hai superato i tre quarti della soglia: da qui in avanti ogni fattura conta.";
  }

  return {
    livello,
    maturatoCents,
    proiezioneCents,
    sogliaCents: soglia,
    sogliaUscitaImmediataCents: uscita,
    margineCents: Math.max(0, soglia - maturatoCents),
    percentuale: percentualeConsumata,
    conseguenza,
  };
}

function percentuale75(n: number): number {
  return c(n * 0.75);
}

/**
 * Scadenze generate dal calcolo: saldo, acconti e rate INPS. Il bollo ha il
 * suo calendario trimestrale nel modulo Fatture SDI (A-1) e non viene
 * duplicato qui; A-3 unirà i due in un unico scadenzario.
 */
function scadenzeDi(ingresso: IngressoCalcolo, p: ParametriAnno, impostaCents: number, contributi: Contributi): Scadenza[] {
  const anno = ingresso.anno;
  const prossimo = anno + 1;
  const scadenze: Scadenza[] = [];

  const saldoCents = Math.max(0, impostaCents - Math.max(0, ingresso.accontiVersatiCents));
  const { acconti } = p;
  const base = impostaCents;
  const dovutiAcconti = base > acconti.sogliaNonDovutoCents;
  const rataUnica = dovutiAcconti && base < acconti.sogliaRataUnicaCents;
  const primoAccontoCents = !dovutiAcconti ? 0 : rataUnica ? 0 : percentuale(base, acconti.primaRatePercent);
  const secondoAccontoCents = !dovutiAcconti ? 0 : rataUnica ? base : percentuale(base, acconti.secondaRatePercent);

  scadenze.push({
    id: "saldo_primo_acconto",
    etichetta: rataUnica
      ? `Saldo imposta sostitutiva ${anno}`
      : `Saldo imposta sostitutiva ${anno} e primo acconto ${prossimo}`,
    data: iso(prossimo, acconti.scadenzaSaldoEPrimoAcconto.mese, acconti.scadenzaSaldoEPrimoAcconto.giorno),
    importoCents: saldoCents + primoAccontoCents,
    codiceTributo: "1790",
    regole: ["F7", "F12"],
  });
  if (secondoAccontoCents > 0) {
    scadenze.push({
      id: "secondo_acconto",
      etichetta: rataUnica ? `Acconto imposta sostitutiva ${prossimo} (rata unica)` : `Secondo acconto imposta sostitutiva ${prossimo}`,
      data: iso(prossimo, acconti.scadenzaSecondoAcconto.mese, acconti.scadenzaSecondoAcconto.giorno),
      importoCents: secondoAccontoCents,
      codiceTributo: "1791",
      regole: ["F12"],
    });
  }

  const parametri = p.inps[ingresso.gestione];
  if (parametri && parametri.rateFisse.length > 0) {
    const rid = riduzionePercent(ingresso, p);
    const fissiNetti = contributi.fissiCents - percentuale(contributi.fissiCents, rid) + contributi.maternitaCents;
    const perRata = c(fissiNetti / parametri.rateFisse.length);
    parametri.rateFisse.forEach((rata, i) => {
      scadenze.push({
        id: `inps_fissi_${i + 1}`,
        etichetta: `${i + 1}ª rata contributi fissi INPS ${anno}`,
        data: iso(rata.annoSuccessivo ? prossimo : anno, rata.mese, rata.giorno),
        importoCents: perRata,
        regole: ["F10", "F11"],
      });
    });
    const eccedenzaNetta = contributi.eccedenzaCents - percentuale(contributi.eccedenzaCents, rid);
    if (eccedenzaNetta > 0) {
      scadenze.push({
        id: "inps_eccedenza",
        etichetta: `Contributi INPS ${anno} sul reddito oltre il minimale`,
        data: iso(prossimo, acconti.scadenzaSaldoEPrimoAcconto.mese, acconti.scadenzaSaldoEPrimoAcconto.giorno),
        importoCents: eccedenzaNetta,
        regole: ["F10"],
      });
    }
  }

  scadenze.push({
    id: "dichiarazione",
    etichetta: `Invio del modello Redditi PF ${prossimo} (quadro LM, anno d'imposta ${anno})`,
    data: iso(prossimo, p.scadenzaDichiarazione.mese, p.scadenzaDichiarazione.giorno),
    importoCents: 0,
    regole: ["F13"],
  });

  return scadenze.sort((a, b) => a.data.localeCompare(b.data));
}

/** Il calcolo completo dell'anno. */
export function calcola(ingresso: IngressoCalcolo): Calcolo {
  const p = regoleDiAnno(ingresso.anno);
  const { percent: aliquotaPercent, startupAttiva } = aliquotaApplicabile(ingresso, p);

  const coefficientePercent =
    ingresso.coefficientePercent > 0 ? ingresso.coefficientePercent : coefficienteDiAteco(ingresso.codiceAteco).coefficientePercent;

  const incassati = Math.max(0, ingresso.incassatiCents);
  const redditoForfettarioCents = percentuale(incassati, coefficientePercent);
  const contributi = calcolaContributi(redditoForfettarioCents, ingresso, p);
  const imponibileCents = Math.max(0, redditoForfettarioCents - Math.max(0, ingresso.contributiVersatiCents));
  const impostaCents = percentuale(imponibileCents, aliquotaPercent);
  const bolloCents = Math.max(0, ingresso.bolloCents);

  const totaleDovutoCents = impostaCents + contributi.totaleCents + bolloCents;
  const giaVersatoCents = Math.max(0, ingresso.accontiVersatiCents) + contributi.versatiCents;
  const residuoCents = Math.max(0, totaleDovutoCents - giaVersatoCents);
  const margine = ingresso.margineSicurezzaPercent >= 0 ? ingresso.margineSicurezzaPercent : p.margineSicurezzaPercent;
  const daMettereViaCents = residuoCents + percentuale(residuoCents, margine);
  const mesiRestanti = Math.max(1, 12 - Math.min(12, Math.max(1, ingresso.meseCorrente)) + 1);
  const daMettereViaMensileCents = c(daMettereViaCents / mesiRestanti);

  const soglia = monitoraSoglia(ingresso, p);
  const scadenze = scadenzeDi(ingresso, p, impostaCents, contributi);

  // Aliquota marginale: quanto va messo da parte su **ogni euro nuovo** che
  // entra. È il numero che serve davvero mentre si lavora, più della somma
  // annuale: si applica a un incasso alla volta.
  const parametriInps = p.inps[ingresso.gestione];
  const sopraIlMinimale = parametriInps !== null && redditoForfettarioCents > parametriInps.minimaleCents;
  const aliquotaInpsMarginale = !parametriInps || !sopraIlMinimale
    ? 0
    : (parametriInps.aliquotaPercent + (redditoForfettarioCents > parametriInps.scaglioneSuperioreCents && parametriInps.scaglioneSuperioreCents > 0 ? parametriInps.aliquotaAggiuntivaPercent : 0)) *
      (1 - riduzionePercent(ingresso, p) / 100);
  const percentualeSuIncassi =
    Math.round(((coefficientePercent / 100) * (aliquotaPercent + aliquotaInpsMarginale) * (1 + margine / 100)) * 10) / 10;

  const regoleUsate: RegolaId[] = ["F1", "F5", "F6", "F7", "F10", "F11", "F12", "F16"];
  if (bolloCents > 0) regoleUsate.push("F8");
  if (soglia.livello === "superata" || soglia.livello === "fuori_regime") regoleUsate.push("F2");

  const spiegazioni: Spiegazione[] = [
    {
      id: "imponibile",
      titolo: "Da dove esce l'imponibile",
      formula: "incassi dell'anno × coefficiente di redditività − contributi versati",
      passaggi: [
        { etichetta: "Incassato nel " + ingresso.anno, valore: fmtEurCents(incassati) },
        { etichetta: `Coefficiente ATECO ${ingresso.codiceAteco || "—"}`, valore: fmtPercent(coefficientePercent) },
        { etichetta: "Reddito forfettario", valore: fmtEurCents(redditoForfettarioCents) },
        { etichetta: "Contributi previdenziali versati nell'anno", valore: "− " + fmtEurCents(Math.max(0, ingresso.contributiVersatiCents)) },
      ],
      risultatoCents: imponibileCents,
      regole: ["F5", "F6"],
      fonte: "L. 190/2014 art. 1 c. 64 e allegato 2 L. 145/2018",
    },
    {
      id: "imposta",
      titolo: startupAttiva ? "Imposta sostitutiva al 5 % (start-up)" : "Imposta sostitutiva",
      formula: "imponibile × aliquota sostitutiva",
      passaggi: [
        { etichetta: "Imponibile", valore: fmtEurCents(imponibileCents) },
        { etichetta: "Aliquota", valore: fmtPercent(aliquotaPercent) },
        ...(startupAttiva && ingresso.annoInizioAttivita !== null
          ? [{ etichetta: "Quinquennio start-up", valore: `${ingresso.annoInizioAttivita}–${ingresso.annoInizioAttivita + p.anniStartup - 1}` }]
          : []),
      ],
      risultatoCents: impostaCents,
      regole: ["F7"],
      fonte: "L. 190/2014 art. 1 c. 65",
    },
    {
      id: "contributi",
      titolo: "Contributi previdenziali dovuti per l'anno",
      formula: "quota fissa sul minimale + quota sul reddito eccedente − riduzione + contributo maternità",
      passaggi: [
        { etichetta: "Reddito su cui si calcolano", valore: fmtEurCents(contributi.redditoCents) },
        { etichetta: "Quota fissa (sul minimale)", valore: fmtEurCents(contributi.fissiCents) },
        { etichetta: "Quota sull'eccedenza", valore: fmtEurCents(contributi.eccedenzaCents) },
        ...(contributi.scontoCents > 0 ? [{ etichetta: "Riduzione richiesta", valore: "− " + fmtEurCents(contributi.scontoCents) }] : []),
        ...(contributi.maternitaCents > 0 ? [{ etichetta: "Contributo maternità", valore: fmtEurCents(contributi.maternitaCents) }] : []),
        { etichetta: "Già versato nell'anno", valore: "− " + fmtEurCents(contributi.versatiCents) },
      ],
      risultatoCents: contributi.totaleCents,
      regole: ["F10", "F11"],
      fonte: "Circolare INPS 14/2026",
    },
    {
      id: "da_mettere_via",
      titolo: "Quanto mettere via",
      formula: "(imposta + contributi + bollo − già versato) + margine di sicurezza",
      passaggi: [
        { etichetta: "Imposta sostitutiva", valore: fmtEurCents(impostaCents) },
        { etichetta: "Contributi dell'anno", valore: fmtEurCents(contributi.totaleCents) },
        ...(bolloCents > 0 ? [{ etichetta: "Imposta di bollo sulle fatture", valore: fmtEurCents(bolloCents) }] : []),
        { etichetta: "Già versato", valore: "− " + fmtEurCents(giaVersatoCents) },
        { etichetta: "Margine di sicurezza", valore: fmtPercent(margine) },
        { etichetta: "Mesi che restano nell'anno", valore: String(mesiRestanti) },
      ],
      risultatoCents: daMettereViaCents,
      regole: ["F16"],
      fonte: "Elaborazione PrevAI — da confermare in sede di revisione (F16)",
    },
  ];

  return {
    anno: ingresso.anno,
    annoRegole: p.anno,
    revisionato: motoreRevisionato(p),
    regoleNonRevisionate: nonRevisionate(p, regoleUsate),
    coefficientePercent,
    aliquotaPercent,
    startupAttiva,
    imponibileCents,
    impostaCents,
    contributi,
    bolloCents,
    totaleDovutoCents,
    daMettereViaCents,
    daMettereViaMensileCents,
    percentualeSuIncassi,
    soglia,
    scadenze,
    spiegazioni,
  };
}

export type Simulazione = {
  importoCents: number;
  /** Il calcolo così com'è oggi. */
  attuale: Calcolo;
  /** Il calcolo se quell'incasso arrivasse davvero. */
  conIlLavoro: Calcolo;
  /** Quanto cresce l'imposta sostitutiva. */
  deltaImpostaCents: number;
  /** Quanto crescono i contributi. */
  deltaContributiCents: number;
  /** Quanto resta in tasca: importo − imposta − contributi. */
  nettoCents: number;
  /** Percentuale dell'importo che resta in tasca. */
  nettoPercent: number;
  /** true se quel lavoro, da solo, fa passare una soglia. */
  cambiaLaSoglia: boolean;
  avviso: string | null;
};

/**
 * "Se accetto questo cantiere, cosa mi resta?" — la domanda che l'artigiano si
 * fa davvero. Si risponde ricalcolando tutto due volte invece di applicare
 * un'aliquota marginale a mano: così scalini, minimale e soglie compaiono da
 * soli, senza casi particolari scritti a parte.
 */
export function simula(ingresso: IngressoCalcolo, importoCents: number): Simulazione {
  const importo = Math.max(0, Math.round(importoCents));
  const attuale = calcola(ingresso);
  const conIlLavoro = calcola({ ...ingresso, incassatiCents: ingresso.incassatiCents + importo });

  const deltaImpostaCents = conIlLavoro.impostaCents - attuale.impostaCents;
  const deltaContributiCents = conIlLavoro.contributi.totaleCents - attuale.contributi.totaleCents;
  const nettoCents = importo - deltaImpostaCents - deltaContributiCents;
  const cambiaLaSoglia = conIlLavoro.soglia.livello !== attuale.soglia.livello;

  let avviso: string | null = null;
  if (conIlLavoro.soglia.livello === "fuori_regime" && attuale.soglia.livello !== "fuori_regime") {
    avviso =
      "Con questo incasso superi i 100.000 €: l'uscita dal regime sarebbe immediata e su quell'operazione andrebbe applicata l'IVA. Prima di accettarlo, sentine un commercialista.";
  } else if (conIlLavoro.soglia.livello === "superata" && attuale.soglia.livello !== "superata") {
    avviso =
      "Con questo incasso superi gli 85.000 €: resteresti forfettario fino a fine anno e usciresti dal regime dal 1° gennaio successivo.";
  }

  return {
    importoCents: importo,
    attuale,
    conIlLavoro,
    deltaImpostaCents,
    deltaContributiCents,
    nettoCents,
    nettoPercent: importo > 0 ? Math.round((nettoCents / importo) * 1000) / 10 : 0,
    cambiaLaSoglia,
    avviso,
  };
}
