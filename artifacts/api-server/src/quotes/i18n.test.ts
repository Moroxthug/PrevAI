// V2-2 — scomposizione IVA e presentazione italiana dei preventivi.
import { describe, it, expect } from "vitest";
import { quoteTaxLines, splitTaxRate, normalizeProvince, regioneDiProvincia } from "@workspace/db";
import { fmtMoney, fmtRate, quoteTaxLinesFor, resolveQuoteLanguage } from "./i18n.js";

/** it-IT può raggruppare con U+00A0; confronto su spazi semplici. */
const plain = (s: string) => s.replace(new RegExp(`[${String.fromCharCode(0xa0)}${String.fromCharCode(0x202f)}]`, "g"), " ");

describe("splitTaxRate", () => {
  it("riconosce le aliquote di legge", () => {
    expect(splitTaxRate(22).map((c) => c.code)).toEqual(["IVA22"]);
    expect(splitTaxRate(10).map((c) => c.code)).toEqual(["IVA10"]);
    expect(splitTaxRate(4).map((c) => c.code)).toEqual(["IVA4"]);
  });
  it("0 = nessuna riga, aliquota sconosciuta = riga generica", () => {
    expect(splitTaxRate(0)).toEqual([]);
    expect(splitTaxRate(7)).toEqual([{ code: "TAX", label: "Imposta", rate: 7 }]);
  });
});

describe("quoteTaxLines", () => {
  it("l'importo coincide esattamente con l'IVA memorizzata", () => {
    const lines = quoteTaxLines(1234.56, 22, 271.6);
    expect(lines.map((l) => [l.code, l.amount])).toEqual([["IVA22", 271.6]]);
  });
  it("usa l'imponibile scontato come base", () => {
    const lines = quoteTaxLinesFor({ subtotale: "1000", ivaPercentuale: "10", ivaValore: "90", sconto: { importoScontato: 900 } }, null);
    expect(lines.map((l) => [l.code, l.amount, plain(l.display)])).toEqual([["IVA10", 90, "IVA 10 %"]]);
  });
  it("mostra una riga generica per un'aliquota inserita a mano", () => {
    const [line] = quoteTaxLinesFor({ subtotale: "100", ivaPercentuale: "7", ivaValore: "7" }, null);
    expect(plain(line.display)).toBe("IVA (7 %)");
  });
});

describe("presentazione", () => {
  it("formatta importi e percentuali in italiano", () => {
    expect(plain(fmtMoney(12345.5))).toBe("€ 12.345,50");
    expect(plain(fmtRate(9.975))).toBe("9,975 %");
  });
  it("la lingua del documento è sempre l'italiano", () => {
    expect(resolveQuoteLanguage({ clientLanguage: "en", province: "MI" })).toBe("it");
  });
});

describe("province italiane", () => {
  it("normalizza sigla e nome", () => {
    expect(normalizeProvince("mi")).toBe("MI");
    expect(normalizeProvince("Milano")).toBe("MI");
    expect(normalizeProvince("prov. di Roma")).toBe("RM");
    expect(normalizeProvince("Reggio nell'Emilia")).toBe("RE");
    expect(normalizeProvince("Ontario")).toBeNull();
  });
  it("ricava la regione", () => {
    expect(regioneDiProvincia("BO")).toBe("Emilia-Romagna");
    expect(regioneDiProvincia("XX")).toBeNull();
  });
});
