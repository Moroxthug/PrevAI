import type { ParametriAnno, Regola, RegolaId } from "../types";

// ── Regime forfettario, anno d'imposta 2026 ──────────────────────────────────
// Questo file è la versione 2026 del motore. **Non si modifica in corso d'anno
// per "aggiustare" un caso**: si scrive `2027.ts` e si lascia il 2026 com'era,
// perché un ricalcolo retroattivo cambierebbe numeri già mostrati all'utente e
// già usati per versare.
//
// Stato della revisione (D6, docs/PIANO-AZIONE.md): **nessuna regola è ancora
// stata confermata da un commercialista**. I valori vengono dalla ricerca di
// `AMMINISTRAZIONE-PLAN.md` §3 e §13 (fonti primarie: L. 190/2014 art. 1 commi
// 54-89, L. 207/2024, Circ. INPS 14/2026, DPR 435/2001). Finché `revisione.stato`
// resta `non_revisionata`, il motore marca ogni risultato come non verificato e
// l'interfaccia lo dice a chiare lettere: è il freno che tiene A-2 dentro il
// perimetro "strumento, non consulenza" (AMMINISTRAZIONE-PLAN.md §5).
//
// Come si chiude la revisione: si compila la colonna Esito di
// `docs/compliance/REVISIONE-COMMERCIALISTA.md`, si riportano qui `stato`, `da`
// e `il` regola per regola, e si inseriscono i valori attesi dei 5 casi golden
// in `golden.ts`.

const DA_REVISIONARE = { stato: "non_revisionata" } as const;

function regola(id: RegolaId, titolo: string, fonte: string): Regola {
  return { id, titolo, fonte, revisione: { ...DA_REVISIONARE } };
}

const REGOLE_2026: Record<RegolaId, Regola> = {
  F1: regola("F1", "Soglia di ricavi per restare nel regime: 85.000 €", "L. 190/2014 art. 1 c. 54, come modificato dalla L. 197/2022"),
  F2: regola("F2", "Uscita immediata oltre 100.000 €, differita fra 85.001 e 100.000 €", "L. 190/2014 art. 1 c. 71"),
  F3: regola("F3", "Spese per lavoro dipendente e collaboratori entro 20.000 € lordi", "L. 190/2014 art. 1 c. 54 lett. b"),
  F4: regola("F4", "Redditi da lavoro dipendente dell'anno precedente entro 35.000 €", "L. 207/2024 (conferma per il 2025 e il 2026)"),
  F5: regola("F5", "Coefficiente di redditività per codice ATECO", "Allegato 2 L. 145/2018, con la classificazione ATECO 2025"),
  F6: regola("F6", "Deduzione dei contributi previdenziali versati nell'anno (criterio di cassa)", "L. 190/2014 art. 1 c. 64"),
  F7: regola("F7", "Imposta sostitutiva del 15 %, ridotta al 5 % per i primi cinque anni", "L. 190/2014 art. 1 c. 65"),
  F8: regola("F8", "Imposta di bollo di 2 € sulle fatture oltre 77,47 €, versata per trimestre", "DPR 642/1972 art. 13 Tariffa; Ris. AdE 42/E 2019"),
  F9: regola("F9", "Diciture obbligatorie in fattura e natura N2.2", "L. 190/2014 art. 1 c. 58 e 67"),
  F10: regola("F10", "Contributi INPS artigiani e commercianti 2026: minimale, aliquote, rate", "Circolare INPS 14/2026"),
  F11: regola("F11", "Riduzione contributiva del 35 % per forfettari e del 50 % per i nuovi iscritti", "L. 190/2014 art. 1 c. 77; L. 207/2024 c. 186"),
  F12: regola("F12", "Saldo e acconti dell'imposta sostitutiva: percentuali, soglie e scadenze", "DPR 435/2001 art. 17; L. 97/1977 art. 1"),
  F13: regola("F13", "Termine di invio del modello Redditi PF e quadro LM", "Provvedimenti annuali dell'Agenzia delle Entrate"),
  F14: regola("F14", "Fattura elettronica obbligatoria e conservazione decennale", "D.L. 36/2022 art. 18; DPR 633/1972; art. 2220 c.c."),
  F15: regola("F15", "Ciclo passivo: reverse charge e acquisti intracomunitari del forfettario", "L. 190/2014 art. 1 c. 58-60"),
  F16: regola("F16", "Formula del \"quanto mettere via\" e margine di sicurezza", "Elaborazione PrevAI sulle regole F5, F6, F7, F10, F12"),
  // ── A-3: compilazione del modello F24 ──────────────────────────────────────
  F17: regola("F17", "Codici tributo dell'imposta sostitutiva nel modello F24: 1792 saldo, 1790 primo acconto, 1791 secondo acconto", "Ris. AdE 59/E del 2015"),
  F18: regola("F18", "Sezione INPS del modello F24: causali AF/AP (artigiani), CF/CP (commercianti), codice sede e matricola", "Circolare INPS 98/2001; istruzioni del modello F24"),
  F19: regola("F19", "Codici tributo e scadenze dell'imposta di bollo virtuale: 2521-2524, versamento trimestrale", "Ris. AdE 42/E del 2019; DM 4/12/2020"),
  // ── A-4: chiusura d'anno ───────────────────────────────────────────────────
  // Il modello Redditi PF per l'anno d'imposta 2026 esce nella primavera del
  // 2027: i numeri di rigo qui sono quelli del modello precedente e vanno
  // riconfrontati col modello vero prima di ogni stagione dichiarativa.
  F20: regola("F20", "Righi del quadro LM (sezione II, forfettari) e del quadro RR in cui riportare ricavi, contributi, imposta e acconti", "Istruzioni del modello Redditi PF, fascicolo 3, quadri LM e RR"),
};

/**
 * Contributi fissi artigiani 2026: 18.808 € × 24 % = 4.513,92 €, più 7,44 € di
 * contributo maternità = **4.521,36 €** l'anno, in quattro rate uguali. È il
 * numero che va detto per primo a chi apre partita IVA: si paga anche con
 * reddito zero.
 *
 * `scaglioneSuperioreCents` e `massimaleCents` sono i due valori di cui siamo
 * meno sicuri (vengono per proporzione dagli anni precedenti, non da una
 * lettura diretta della circolare): la domanda è già in F10 della checklist.
 */
export const PARAMETRI_2026: ParametriAnno = {
  anno: 2026,
  sogliaRicaviCents: 8_500_000,
  sogliaUscitaImmediataCents: 10_000_000,
  sogliaSpeseLavoroCents: 2_000_000,
  sogliaRedditoDipendenteCents: 3_500_000,
  aliquotaOrdinariaPercent: 15,
  aliquotaStartupPercent: 5,
  anniStartup: 5,
  riduzioneForfettariPercent: 35,
  riduzioneNuoviIscrittiPercent: 50,
  riduzioneNuoviIscrittiMesi: 36,
  inps: {
    artigiani: {
      minimaleCents: 1_880_800,
      aliquotaPercent: 24,
      maternitaCents: 744,
      scaglioneSuperioreCents: 5_500_800,
      aliquotaAggiuntivaPercent: 1,
      massimaleCents: 9_241_300,
      rateFisse: [
        { giorno: 16, mese: 5 },
        { giorno: 20, mese: 8 },
        { giorno: 16, mese: 11 },
        { giorno: 16, mese: 2, annoSuccessivo: true },
      ],
      causaleFissi: "AF",
      causaleEccedenza: "AP",
    },
    commercianti: {
      minimaleCents: 1_880_800,
      aliquotaPercent: 24.48,
      maternitaCents: 744,
      scaglioneSuperioreCents: 5_500_800,
      aliquotaAggiuntivaPercent: 1,
      massimaleCents: 9_241_300,
      rateFisse: [
        { giorno: 16, mese: 5 },
        { giorno: 20, mese: 8 },
        { giorno: 16, mese: 11 },
        { giorno: 16, mese: 2, annoSuccessivo: true },
      ],
      causaleFissi: "CF",
      causaleEccedenza: "CP",
    },
    // Niente minimale: si versa solo sul reddito effettivo, a saldo e acconto.
    gestione_separata: {
      minimaleCents: 0,
      aliquotaPercent: 26.07,
      maternitaCents: 0,
      scaglioneSuperioreCents: 0,
      aliquotaAggiuntivaPercent: 0,
      massimaleCents: 12_060_700,
      rateFisse: [],
      // La gestione separata non ha fissi: si versa tutto a saldo e acconto,
      // con la stessa causale in entrambi i casi.
      causaleFissi: "PXX",
      causaleEccedenza: "PXX",
    },
    // Le casse private hanno regolamenti propri: non li indoviniamo.
    cassa_professionale: null,
    nessuna: null,
  },
  acconti: {
    sogliaNonDovutoCents: 5_165,
    sogliaRataUnicaCents: 25_752,
    primaRatePercent: 40,
    secondaRatePercent: 60,
    scadenzaSaldoEPrimoAcconto: { giorno: 30, mese: 6 },
    scadenzaSecondoAcconto: { giorno: 30, mese: 11 },
    codiceTributoSaldo: "1792",
    codiceTributoPrimoAcconto: "1790",
    codiceTributoSecondoAcconto: "1791",
  },
  scadenzaDichiarazione: { giorno: 30, mese: 10 },
  margineSicurezzaPercent: 10,
  regole: REGOLE_2026,
};
