import { describe, expect, it } from "vitest";
import { calcola, calcolaUtileNetto, guidaFaiDaTe, prospettoDichiarazione, type IngressoCalcolo } from "@workspace/config";
import { primaNotaCsv, type VocePrimaNota } from "./service.js";

// ── A-4: utile netto e prospetto per la dichiarazione ────────────────────────
// Funzioni pure del motore, provate col motore vero e non con un finto: se il
// prospetto e il calcolo si separano, deve saltare qui.

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
  meseCorrente: 12,
};

describe("utile netto dopo le tasse", () => {
  const calcolo = calcola(BASE);

  it("sottrae ai ricavi i costi pagati e il carico fiscale di competenza", () => {
    const u = calcolaUtileNetto({ anno: 2026, incassiCents: 4_200_000, altriRicaviCents: 0, costiCents: 900_000, calcolo });
    // 42.000 × 86 % = 36.120; − 4.521,36 di contributi = 31.598,64; × 15 % = 4.739,80
    expect(calcolo.impostaCents).toBe(473_980);
    expect(u.margineCents).toBe(3_300_000);
    expect(u.caricoFiscaleCents).toBe(calcolo.impostaCents + calcolo.contributi.totaleCents);
    expect(u.utileNettoCents).toBe(3_300_000 - u.caricoFiscaleCents);
    expect(u.revisionato).toBe(false);
  });

  it("mette accanto ai costi reali quelli che il coefficiente dà per scontati", () => {
    const u = calcolaUtileNetto({ anno: 2026, incassiCents: 4_200_000, altriRicaviCents: 0, costiCents: 900_000, calcolo });
    expect(u.costiPresuntiCents).toBe(588_000); // 14 % di 42.000
    expect(u.scartoCostiCents).toBe(312_000);
    expect(u.spiegazioni.map((s) => s.id)).toEqual(["utile_netto", "costi_presunti"]);
  });

  it("gli altri ricavi contano nell'utile ma non nei costi presunti", () => {
    const u = calcolaUtileNetto({ anno: 2026, incassiCents: 4_200_000, altriRicaviCents: 100_000, costiCents: 0, calcolo });
    expect(u.ricaviCents).toBe(4_300_000);
    expect(u.costiPresuntiCents).toBe(588_000);
  });

  it("senza ricavi la percentuale è zero e non una divisione per zero", () => {
    const vuoto = calcola({ ...BASE, incassatiCents: 0, contributiVersatiCents: 0 });
    const u = calcolaUtileNetto({ anno: 2026, incassiCents: 0, altriRicaviCents: 0, costiCents: 0, calcolo: vuoto });
    expect(u.utileSuRicaviPercent).toBe(0);
    // I contributi fissi si pagano anche a reddito zero: l'utile è negativo, e va detto.
    expect(u.utileNettoCents).toBeLessThan(0);
  });
});

describe("prospetto per la dichiarazione (F20)", () => {
  const calcolo = calcola(BASE);

  it("riempie i righi LM coi numeri del motore", () => {
    const p = prospettoDichiarazione({ ingresso: BASE, calcolo, accontiVersatiCents: 0 });
    const rigo = (r: string) => p.righi.filter((x) => x.rigo === r);
    const [ateco, coefficiente, ricavi] = rigo("LM22");
    expect(ateco!.valore).toBe("43.22.01");
    expect(coefficiente!.valore).toContain("86");
    expect(ricavi!.importoCents).toBe(4_200_000);
    expect(ricavi!.valore).toContain("42.000,00");
    expect(rigo("LM34")[0]!.importoCents).toBe(3_612_000);
    expect(rigo("LM35")[0]!.importoCents).toBe(452_136);
    expect(rigo("LM36")[0]!.importoCents).toBe(calcolo.imponibileCents);
    expect(rigo("LM39")[0]!.importoCents).toBe(473_980);
    expect(rigo("LM46")[0]!.importoCents).toBe(473_980);
    expect(p.saldoCents).toBe(473_980);
    expect(p.termineInvio).toBe("2027-10-30");
    expect(p.annoPresentazione).toBe(2027);
  });

  it("con acconti oltre l'imposta il saldo diventa un credito (LM47)", () => {
    const p = prospettoDichiarazione({ ingresso: BASE, calcolo, accontiVersatiCents: 500_000 });
    expect(p.righi.some((r) => r.rigo === "LM46")).toBe(false);
    expect(p.righi.find((r) => r.rigo === "LM47")!.importoCents).toBe(26_020);
    expect(p.saldoCents).toBe(-26_020);
  });

  it("i contributi dedotti non superano il reddito", () => {
    const piccolo = { ...BASE, incassatiCents: 300_000 }; // reddito 2.580 €, contributi 4.521,36 €
    const p = prospettoDichiarazione({ ingresso: piccolo, calcolo: calcola(piccolo), accontiVersatiCents: 0 });
    const lm35 = p.righi.find((r) => r.rigo === "LM35")!;
    expect(lm35.importoCents).toBe(258_000);
    expect(lm35.nota).toContain("non si deduce");
    expect(p.righi.find((r) => r.rigo === "LM39")!.importoCents).toBe(0);
  });

  it("aggiunge il quadro RR per artigiani e commercianti, non per le casse private", () => {
    expect(prospettoDichiarazione({ ingresso: BASE, calcolo, accontiVersatiCents: 0 }).righi.some((r) => r.quadro === "RR")).toBe(true);
    const cassa = { ...BASE, gestione: "cassa_professionale" as const };
    expect(prospettoDichiarazione({ ingresso: cassa, calcolo: calcola(cassa), accontiVersatiCents: 0 }).righi.some((r) => r.quadro === "RR")).toBe(false);
  });

  it("dice che non è la dichiarazione, che i righi vanno riconfrontati e che le regole non sono revisionate", () => {
    const p = prospettoDichiarazione({ ingresso: BASE, calcolo, accontiVersatiCents: 0 });
    expect(p.revisionato).toBe(false);
    expect(p.regoleNonRevisionate).toContain("F20");
    expect(p.avvertenze.join(" ")).toContain("non la dichiarazione");
    expect(p.avvertenze.join(" ")).toContain("Redditi PF 2027");
  });

  it("dice quando un anno è calcolato con le regole di un altro anno", () => {
    const vecchio = { ...BASE, anno: 2025 };
    const p = prospettoDichiarazione({ ingresso: vecchio, calcolo: calcola(vecchio), accontiVersatiCents: 0 });
    expect(p.avvertenze.join(" ")).toContain("ha usato quelle del 2026");
    expect(prospettoDichiarazione({ ingresso: BASE, calcolo, accontiVersatiCents: 0 }).avvertenze.join(" ")).not.toContain("ha usato quelle");
  });

  it("la guida porta il termine dell'anno giusto", () => {
    expect(guidaFaiDaTe(2026).some((g) => g.testo.includes("30/10/2027"))).toBe(true);
  });
});

describe("CSV della prima nota", () => {
  it("usa punto e virgola, virgola decimale, BOM e virgolette solo dove servono", () => {
    const voce: VocePrimaNota = {
      chiave: "costo:1",
      fonte: "costo",
      id: "1",
      data: "2026-03-05",
      tipo: "uscita",
      importoCents: 123_456,
      descrizione: 'Piastrelle "bagno"; lotto 2',
      controparte: "Ceramiche Srl",
      categoria: "Materiali",
      incideSulUtile: true,
      inBanca: false,
      collegamento: { tipo: "cantiere", id: "p", etichetta: "Casa Rossi" },
    };
    const csv = primaNotaCsv([voce]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [intestazione, riga] = csv.slice(1).trim().split("\r\n");
    expect(intestazione!.split(";")).toHaveLength(10);
    expect(riga).toBe('05/03/2026;Uscita;Materiali;"Piastrelle ""bagno""; lotto 2";Ceramiche Srl;;1234,56;sì;no;Cantiere Casa Rossi');
  });
});
