import { describe, expect, it } from "vitest";
import {
  calcola,
  coefficienteDiAteco,
  gruppoAtecoDi,
  motoreRevisionato,
  normalizzaGiorniPromemoria,
  prospettoF24,
  regoleDiAnno,
  simula,
  type IngressoCalcolo,
} from "@workspace/config";

// A-2: il motore è una funzione pura, quindi si prova senza database e senza
// mock. I numeri esatti qui sotto sono calcolati a mano dai parametri 2026 e
// servono da rete: se qualcuno tocca `regole/2026.ts` senza volerlo, saltano.

const BASE: IngressoCalcolo = {
  anno: 2026,
  codiceAteco: "43.22.01",
  coefficientePercent: 86,
  gestione: "artigiani",
  riduzione: "nessuna",
  annoInizioAttivita: 2020,
  requisitiStartup: false,
  incassatiCents: 4_200_000,
  fatturatoNonIncassatoCents: 0,
  pipelineCents: 0,
  contributiVersatiCents: 452_136,
  accontiVersatiCents: 0,
  impostaAnnoPrecedenteCents: 0,
  bolloCents: 0,
  margineSicurezzaPercent: 10,
  meseCorrente: 1,
};

describe("coefficiente di redditività (F5)", () => {
  it("dà 86 % a tutto il gruppo delle costruzioni", () => {
    for (const codice of ["41.20.00", "42.11.00", "43.22.01", "43.99.09", "4334"]) {
      expect(coefficienteDiAteco(codice).coefficientePercent).toBe(86);
    }
  });

  it("preferisce il prefisso più specifico", () => {
    // 46 è commercio all'ingrosso (40 %), ma 46.1 sono gli intermediari (62 %).
    expect(coefficienteDiAteco("46.90.00").coefficientePercent).toBe(40);
    expect(coefficienteDiAteco("46.11.00").coefficientePercent).toBe(62);
    expect(coefficienteDiAteco("47.82.00").coefficientePercent).toBe(54);
  });

  it("cade sul residuale 67 % quando il codice non è in tabella", () => {
    const r = coefficienteDiAteco("99.99.99");
    expect(r.coefficientePercent).toBe(67);
    expect(r.riconosciuto).toBe(false);
    expect(gruppoAtecoDi("")).toBeNull();
  });
});

describe("calcolo base (G1)", () => {
  const calcolo = calcola(BASE);

  it("applica il coefficiente e deduce i contributi versati", () => {
    // 42.000 × 86 % = 36.120 ; 36.120 − 4.521,36 = 31.598,64
    expect(calcolo.imponibileCents).toBe(3_159_864);
  });

  it("calcola l'imposta sostitutiva al 15 %", () => {
    expect(calcolo.aliquotaPercent).toBe(15);
    expect(calcolo.startupAttiva).toBe(false);
    expect(calcolo.impostaCents).toBe(473_980);
  });

  it("calcola fissi ed eccedenza INPS sul reddito forfettario, non sull'imponibile", () => {
    // La base INPS è 36.120 € (senza dedurre i contributi): 18.808 × 24 % di
    // fissi + (36.120 − 18.808) × 24 % di eccedenza + 7,44 di maternità.
    expect(calcolo.contributi.redditoCents).toBe(3_612_000);
    expect(calcolo.contributi.fissiCents).toBe(451_392);
    expect(calcolo.contributi.eccedenzaCents).toBe(415_488);
    expect(calcolo.contributi.maternitaCents).toBe(744);
    expect(calcolo.contributi.totaleCents).toBe(867_624);
  });

  it("non presenta il risultato come verificato finché D6 è aperta", () => {
    expect(calcolo.revisionato).toBe(false);
    expect(calcolo.regoleNonRevisionate).toContain("F7");
    expect(motoreRevisionato(regoleDiAnno(2026))).toBe(false);
  });

  it("spiega ogni importo che mostra", () => {
    const ids = calcolo.spiegazioni.map((s) => s.id);
    expect(ids).toEqual(["imponibile", "imposta", "contributi", "da_mettere_via"]);
    for (const s of calcolo.spiegazioni) {
      expect(s.formula.length).toBeGreaterThan(0);
      expect(s.passaggi.length).toBeGreaterThan(0);
      expect(s.fonte.length).toBeGreaterThan(0);
    }
  });
});

describe("aliquota start-up (F7)", () => {
  it("vale per i primi cinque periodi d'imposta", () => {
    const apertoNel2026 = calcola({ ...BASE, requisitiStartup: true, annoInizioAttivita: 2026 });
    expect(apertoNel2026.startupAttiva).toBe(true);
    expect(apertoNel2026.aliquotaPercent).toBe(5);

    const quintoAnno = calcola({ ...BASE, requisitiStartup: true, annoInizioAttivita: 2022 });
    expect(quintoAnno.startupAttiva).toBe(true);

    const sestoAnno = calcola({ ...BASE, requisitiStartup: true, annoInizioAttivita: 2021 });
    expect(sestoAnno.startupAttiva).toBe(false);
    expect(sestoAnno.aliquotaPercent).toBe(15);
  });

  it("non si applica senza i requisiti dichiarati", () => {
    expect(calcola({ ...BASE, requisitiStartup: false, annoInizioAttivita: 2026 }).aliquotaPercent).toBe(15);
  });
});

describe("riduzioni contributive (F11)", () => {
  it("il 35 % sconta fissi ed eccedenza ma non la maternità", () => {
    const piena = calcola(BASE).contributi;
    const ridotta = calcola({ ...BASE, riduzione: "forfettari_35" }).contributi;
    expect(ridotta.scontoCents).toBe(Math.round(((piena.fissiCents + piena.eccedenzaCents) * 35) / 100));
    expect(ridotta.maternitaCents).toBe(piena.maternitaCents);
    expect(ridotta.totaleCents).toBe(piena.fissiCents + piena.eccedenzaCents - ridotta.scontoCents + piena.maternitaCents);
  });

  it("il 50 % dei nuovi iscritti sconta il doppio del 35 %… cioè di più", () => {
    const r35 = calcola({ ...BASE, riduzione: "forfettari_35" }).contributi.totaleCents;
    const r50 = calcola({ ...BASE, riduzione: "nuovi_iscritti_50" }).contributi.totaleCents;
    expect(r50).toBeLessThan(r35);
  });

  it("non si applicano fuori dalle gestioni artigiani e commercianti", () => {
    const separata = calcola({ ...BASE, gestione: "gestione_separata", riduzione: "forfettari_35" });
    expect(separata.contributi.scontoCents).toBe(0);
    expect(separata.contributi.fissiCents).toBe(0);
  });

  it("con una cassa professionale non inventa contributi", () => {
    const cassa = calcola({ ...BASE, gestione: "cassa_professionale" });
    expect(cassa.contributi.totaleCents).toBe(0);
  });
});

describe("monitor della soglia (F1/F2)", () => {
  it("sotto i tre quarti non allarma", () => {
    expect(calcola(BASE).soglia.livello).toBe("ok");
  });

  it("conta anche il fatturato non ancora incassato", () => {
    const s = calcola({ ...BASE, incassatiCents: 5_000_000, fatturatoNonIncassatoCents: 2_000_000 }).soglia;
    expect(s.maturatoCents).toBe(7_000_000);
    expect(s.livello).toBe("attenzione");
    expect(s.margineCents).toBe(1_500_000);
  });

  it("segnala la pipeline che farebbe sforare senza dire che hai già sforato", () => {
    const s = calcola({ ...BASE, incassatiCents: 6_000_000, pipelineCents: 3_000_000 }).soglia;
    expect(s.livello).toBe("vicino");
    expect(s.maturatoCents).toBe(6_000_000);
    expect(s.proiezioneCents).toBe(9_000_000);
  });

  it("distingue l'uscita differita da quella immediata", () => {
    expect(calcola({ ...BASE, incassatiCents: 9_100_000 }).soglia.livello).toBe("superata");
    expect(calcola({ ...BASE, incassatiCents: 10_400_000 }).soglia.livello).toBe("fuori_regime");
  });
});

describe("scadenze (F12/F13)", () => {
  const calcolo = calcola(BASE);

  it("mette saldo e acconti nell'anno successivo, in ordine di data", () => {
    const date = calcolo.scadenze.map((s) => s.data);
    expect([...date].sort()).toEqual(date);
    expect(calcolo.scadenze.find((s) => s.id === "saldo_primo_acconto")?.data).toBe("2027-06-30");
    expect(calcolo.scadenze.find((s) => s.id === "secondo_acconto")?.data).toBe("2027-11-30");
  });

  it("spezza i contributi fissi in quattro rate, l'ultima a febbraio", () => {
    const rate = calcolo.scadenze.filter((s) => s.id.startsWith("inps_fissi_"));
    expect(rate).toHaveLength(4);
    expect(rate[3]!.data).toBe("2027-02-16");
  });

  it("include il termine della dichiarazione, senza importo", () => {
    const dich = calcolo.scadenze.find((s) => s.id === "dichiarazione");
    expect(dich?.data).toBe("2027-10-30");
    expect(dich?.importoCents).toBe(0);
  });

  it("non chiede acconti quando l'imposta è sotto la soglia minima", () => {
    const minuscolo = calcola({ ...BASE, incassatiCents: 30_000, contributiVersatiCents: 0 });
    expect(minuscolo.impostaCents).toBeLessThan(5_165);
    expect(minuscolo.scadenze.find((s) => s.id === "secondo_acconto")).toBeUndefined();
  });
});

// ── A-3 ──────────────────────────────────────────────────────────────────────

describe("righe del modello F24 (F17/F18)", () => {
  const calcolo = calcola(BASE);

  it("mette saldo, primo acconto ed eccedenza contributiva in un solo F24", () => {
    const giugno = calcolo.scadenze.find((s) => s.id === "saldo_primo_acconto")!;
    const codici = giugno.righe.filter((r) => r.sezione === "erario").map((r) => r.codiceTributo);
    expect(codici).toContain("1792"); // saldo
    expect(codici).toContain("1790"); // primo acconto
    // L'impresa di BASE incassa 42.000 €: il reddito supera il minimale, quindi
    // c'è anche l'eccedenza contributiva, che sta nella sezione INPS.
    const inps = giugno.righe.find((r) => r.sezione === "inps");
    expect(inps?.causale).toBe("AP");
    expect(inps?.periodoDa).toBe("01/2026");
    expect(inps?.periodoA).toBe("12/2026");
    expect(giugno.importoCents).toBe(giugno.righe.reduce((s, r) => s + r.importoCents, 0));
  });

  it("dà al secondo acconto il suo codice, diverso da quello del primo", () => {
    const novembre = calcolo.scadenze.find((s) => s.id === "secondo_acconto")!;
    expect(novembre.righe).toHaveLength(1);
    expect(novembre.righe[0]!.codiceTributo).toBe("1791");
    // L'anno di riferimento dell'acconto è quello a cui l'acconto si riferisce,
    // non quello d'imposta appena chiuso: sbagliarlo manda il versamento
    // sull'anno storto.
    expect(novembre.righe[0]!.annoRiferimento).toBe(2027);
  });

  it("dà a ogni rata dei fissi la causale INPS e il suo trimestre di competenza", () => {
    const rate = calcolo.scadenze.filter((s) => s.id.startsWith("inps_fissi_"));
    expect(rate.map((r) => r.righe[0]!.causale)).toEqual(["AF", "AF", "AF", "AF"]);
    expect(rate[0]!.righe[0]!.periodoDa).toBe("01/2026");
    expect(rate[0]!.righe[0]!.periodoA).toBe("03/2026");
    expect(rate[3]!.righe[0]!.periodoA).toBe("12/2026");
  });

  it("usa le causali dei commercianti per chi sta in quella gestione", () => {
    const commerciante = calcola({ ...BASE, gestione: "commercianti" });
    const rata = commerciante.scadenze.find((s) => s.id === "inps_fissi_1")!;
    expect(rata.righe[0]!.causale).toBe("CF");
  });

  it("lascia la dichiarazione senza righe: è un adempimento, non un versamento", () => {
    expect(calcolo.scadenze.find((s) => s.id === "dichiarazione")!.righe).toEqual([]);
  });
});

describe("prospetto F24 (A-3)", () => {
  const giugno = calcola(BASE).scadenze.find((s) => s.id === "saldo_primo_acconto")!;
  const CONTRIBUENTE = {
    denominazione: "Impianti Rossi",
    codiceFiscale: "RSSMRA80A01F205X",
    partitaIva: "12345678903",
    comune: "Milano",
    provincia: "MI",
    matricolaInps: "1234567890",
    sedeInps: "4700",
  };

  it("divide le righe fra sezione Erario e sezione INPS", () => {
    const p = prospettoF24(giugno, CONTRIBUENTE, { revisionato: false });
    expect(p.sezioni.map((s) => s.sezione)).toEqual(["erario", "inps"]);
    expect(p.totaleCents).toBe(giugno.importoCents);
    expect(p.sezioni.reduce((s, sez) => s + sez.totaleCents, 0)).toBe(giugno.importoCents);
  });

  it("segna i campi INPS mancanti invece di inventarli", () => {
    const p = prospettoF24(giugno, { ...CONTRIBUENTE, matricolaInps: "", sedeInps: "" }, { revisionato: false });
    expect(p.campiMancanti).toContain("Matricola INPS");
    expect(p.campiMancanti).toContain("Codice sede INPS");
    expect(p.avvertenze.some((a) => a.includes("estratto conto contributivo"))).toBe(true);
  });

  it("avverte sempre che non è il modello ufficiale, e in più che non è revisionato", () => {
    const nonRevisionato = prospettoF24(giugno, CONTRIBUENTE, { revisionato: false });
    expect(nonRevisionato.avvertenze[0]).toContain("non il modello F24 ufficiale");
    expect(nonRevisionato.avvertenze.some((a) => a.includes("non sono ancora stati verificati"))).toBe(true);

    const revisionato = prospettoF24(giugno, CONTRIBUENTE, { revisionato: true });
    expect(revisionato.avvertenze.some((a) => a.includes("non sono ancora stati verificati"))).toBe(false);
  });

  it("non chiede i dati INPS a chi versa solo in sezione Erario", () => {
    const bollo = {
      ...giugno,
      id: "bollo_t1",
      righe: giugno.righe.filter((r) => r.sezione === "erario"),
    };
    const p = prospettoF24(bollo, { ...CONTRIBUENTE, matricolaInps: "", sedeInps: "" }, { revisionato: true });
    expect(p.campiMancanti).toEqual([]);
    expect(p.sezioni).toHaveLength(1);
  });
});

describe("soglie dei promemoria (A-3)", () => {
  it("ordina, deduplica e tiene solo valori sensati", () => {
    expect(normalizzaGiorniPromemoria([3, 15, 3, -2, 500, 7])).toEqual([15, 7, 3]);
  });

  it("cade sul default quando non resta niente di valido", () => {
    expect(normalizzaGiorniPromemoria(["x", null])).toEqual([15, 3]);
    expect(normalizzaGiorniPromemoria(undefined)).toEqual([15, 3]);
  });

  it("non tiene più di quattro soglie: oltre sono rumore", () => {
    expect(normalizzaGiorniPromemoria([1, 3, 7, 15, 30, 60])).toHaveLength(4);
  });
});

describe("quanto mettere via (F16)", () => {
  it("somma imposta, contributi e bollo, toglie il già versato e aggiunge il margine", () => {
    const calcolo = calcola({ ...BASE, bolloCents: 4_000, meseCorrente: 1 });
    const residuo = calcolo.impostaCents + calcolo.contributi.totaleCents + 4_000 - BASE.contributiVersatiCents;
    expect(calcolo.daMettereViaCents).toBe(residuo + Math.round((residuo * 10) / 100));
    expect(calcolo.daMettereViaMensileCents).toBe(Math.round(calcolo.daMettereViaCents / 12));
  });

  it("concentra l'accantonamento sui mesi che restano", () => {
    const gennaio = calcola({ ...BASE, meseCorrente: 1 });
    const novembre = calcola({ ...BASE, meseCorrente: 11 });
    expect(novembre.daMettereViaMensileCents).toBeGreaterThan(gennaio.daMettereViaMensileCents);
  });
});

describe("simulatore", () => {
  it("dice quanto resta in tasca di un lavoro nuovo", () => {
    const s = simula(BASE, 1_000_000);
    expect(s.deltaImpostaCents).toBeGreaterThan(0);
    expect(s.deltaContributiCents).toBeGreaterThan(0);
    expect(s.nettoCents).toBe(1_000_000 - s.deltaImpostaCents - s.deltaContributiCents);
    expect(s.nettoPercent).toBeGreaterThan(50);
    expect(s.avviso).toBeNull();
  });

  it("avvisa quando quel lavoro, da solo, fa uscire dal regime", () => {
    const s = simula({ ...BASE, incassatiCents: 8_000_000 }, 3_000_000);
    expect(s.cambiaLaSoglia).toBe(true);
    expect(s.avviso).toContain("100.000");
  });

  it("non cambia il calcolo di partenza", () => {
    const prima = calcola(BASE).impostaCents;
    simula(BASE, 5_000_000);
    expect(calcola(BASE).impostaCents).toBe(prima);
  });
});

describe("versioni delle regole", () => {
  it("usa l'ultima versione disponibile per gli anni futuri e lo dichiara", () => {
    const futuro = calcola({ ...BASE, anno: 2030 });
    expect(futuro.anno).toBe(2030);
    expect(futuro.annoRegole).toBe(2026);
  });
});
