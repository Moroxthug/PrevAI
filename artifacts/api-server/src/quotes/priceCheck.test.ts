// PREZZI-1 (riga 53) — il controllo prezzi del preventivo: abbinamento per
// nome e unità con listino, scontrini e storico, soglia del 5 %, sotto costo,
// margine per voce e conti del riprezzo.
import assert from "node:assert/strict";
import { test } from "vitest";
import { nameTokens, matchScore, normalizeUnit, learnedReferences, historyReferences, priceCheckChapters, repriceChapters, type PriceReference } from "./priceCheck.js";

test("priceCheck — parole e unità", () => {
  assert.deepEqual([...nameTokens("Fornitura e posa di piastrelle 60x60")].sort(), ["60x60", "piastrell"]);
  assert.equal(matchScore(nameTokens("Piastrella gres 60x60"), nameTokens("Piastrelle")), 1);
  assert.equal(matchScore(nameTokens("Pittura lavabile pareti"), nameTokens("Pittura")), 1);
  assert.equal(matchScore(nameTokens("Cucina su misura"), nameTokens("Bagno completo")), 0);
  assert.equal(normalizeUnit("m²"), "mq");
  assert.equal(normalizeUnit("Mq."), "mq");
  assert.equal(normalizeUnit("ore"), "h");
  assert.equal(normalizeUnit("a corpo"), "corpo");
  assert.equal(normalizeUnit("pz"), "cad");
  assert.equal(normalizeUnit(null), "");
});

test("priceCheck — scontrini: servono 3, media degli ultimi 5, fornitore più frequente", () => {
  const rows = [
    { workType: "Piastrelle 60x60", unitPrice: "20.00", unit: "mq", vendor: "Leroy Merlin" },
    { workType: "piastrelle 60x60", unitPrice: "19.00", unit: "mq", vendor: "Bricoman" },
    { workType: "Piastrelle 60x60 ", unitPrice: "21.00", unit: "mq", vendor: "Leroy Merlin" },
    { workType: "Piastrelle 60x60", unitPrice: "18.00", unit: "mq", vendor: null },
    { workType: "Piastrelle 60x60", unitPrice: "17.00", unit: "mq", vendor: null },
    { workType: "Piastrelle 60x60", unitPrice: "1.00", unit: "mq", vendor: null }, // sesto, il più vecchio: ignorato
    { workType: "Cartongesso", unitPrice: "6", unit: "mq", vendor: null },
    { workType: "Cartongesso", unitPrice: "7", unit: "mq", vendor: null }, // solo due: saltato
  ];
  const refs = learnedReferences(rows);
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0], { key: "scontrini:piastrelle 60x60", name: "Piastrelle 60x60", unit: "mq", unitPrice: 19, source: "scontrini", sampleCount: 5, vendor: "Leroy Merlin" });
});

test("priceCheck — storico: stesse parole e stessa unità, mediana con almeno 3 righe", () => {
  const riga = (descrizione: string, um: string, prezzoUnitario: number) => ({ descrizione, um, quantita: 1, prezzoUnitario, totale: prezzoUnitario });
  const past = [
    [{ lettera: "A", titolo: "x", subtotale: 0, voci: [riga("Tinteggiatura pareti", "mq", 10), riga("Demolizione tramezzo", "mq", 40)] }],
    [{ lettera: "A", titolo: "x", subtotale: 0, voci: [riga("Tinteggiatura delle pareti", "mq", 14), riga("Tinteggiatura pareti", "ml", 99)] }],
    [{ lettera: "A", titolo: "x", subtotale: 0, voci: [riga("Tinteggiatura pareti", "m²", 12), riga("Impianto", "a corpo", 5000)] }],
  ];
  const refs = historyReferences(past);
  assert.equal(refs.length, 1);
  assert.equal(refs[0]!.source, "storico");
  assert.equal(refs[0]!.unitPrice, 12);
  assert.equal(refs[0]!.sampleCount, 3);
});

test("priceCheck — voci segnalate, sotto costo, margine e riprezzo", () => {
  const refs: PriceReference[] = [
    { key: "listino:1", name: "Piastrelle 60x60", unit: "mq", unitPrice: 50, source: "listino", sampleCount: 1, vendor: null },
    { key: "scontrini:p", name: "Piastrelle 60x60", unit: "mq", unitPrice: 54, source: "scontrini", sampleCount: 4, vendor: "Bricoman" },
    { key: "listino:2", name: "Cartongesso lastra", unit: "mq", unitPrice: 14, source: "listino", sampleCount: 1, vendor: null },
    { key: "listino:3", name: "Pittura", unit: "mq", unitPrice: 2.5, source: "listino", sampleCount: 1, vendor: null },
    { key: "scontrini:c", name: "Colla", unit: "sacco", unitPrice: 12, source: "scontrini", sampleCount: 3, vendor: null },
  ];
  const capitoli = [
    { lettera: "A", titolo: "Posa", subtotale: 0, voci: [
      { descrizione: "Piastrelle gres 60x60", um: "mq", quantita: 100, prezzoUnitario: 50, totale: 5000 }, // costo 54: sotto costo, margine −8 %
      { descrizione: "Cartongesso lastre", um: "mq", quantita: 40, prezzoUnitario: 13.8, totale: 552 }, // listino 14: +1,4 %, sotto soglia
      { descrizione: "Pittura pareti", um: "h", quantita: 10, prezzoUnitario: 60, totale: 600 }, // unità diversa: nessun abbinamento
      { descrizione: "Pulizia cantiere", um: "a corpo", quantita: 1, prezzoUnitario: 300, totale: 300 }, // a corpo: saltata
      { descrizione: "Pittura", um: "mq", quantita: 200, prezzoUnitario: 3, totale: 600 }, // listino 2,50: −16,7 %
      { descrizione: "Colla per piastrelle", um: "sacco", quantita: 20, prezzoUnitario: 20, totale: 400 }, // costo 12: margine 40 %, non segnalata (il costo non è un bersaglio)
    ] },
  ];
  const check = priceCheckChapters(capitoli, refs, new Date("2026-09-30T12:00:00Z"));
  assert.equal(check.linesChecked, 6); // tutte con un prezzo; «a corpo» conta ma non si abbina
  assert.deepEqual(
    check.findings.map((f) => [f.chapter, f.index, f.source, f.referenceUnitPrice, f.changePct, f.deltaTotal, f.belowCost, f.marginPct]),
    [
      ["A", 0, "scontrini", 54, 8, 400, true, -8],
      ["A", 4, "listino", 2.5, -16.7, -100, false, null],
    ],
  );
  assert.equal(check.belowCostCount, 1);
  assert.equal(check.deltaTotal, 300);

  // Riprezzo della voce 0 con sconto 10 % e IVA 22 %: i totali ripartono dalle voci.
  const r = repriceChapters(capitoli, [{ chapter: "A", index: 0, unitPrice: 54 }], 22, 10);
  assert.equal(r.applied, 1);
  assert.equal(r.capitoli[0]!.voci[0]!.totale, 5400);
  assert.equal(r.subtotale, 5400 + 552 + 600 + 300 + 600 + 400);
  assert.deepEqual(r.sconto, { percentuale: 10, importoScontato: 7066.8 });
  assert.equal(r.ivaValore, 1554.7);
  assert.equal(r.totale, 8621.5);
  const same = repriceChapters(capitoli, [{ chapter: "A", index: 0, unitPrice: 50 }], 0, 0);
  assert.equal(same.applied, 0);
  assert.equal(same.sconto, null);
  assert.equal(same.totale, 7452);
});
