// Il contratto deve riportare lo stesso imponibile del preventivo: `importoScontato` è l'imponibile già
// scontato (Phase 67), non lo sconto — sottrarlo di nuovo dava 1.000 € di imponibile su un lavoro da 9.000 €.
import { describe, expect, test } from "vitest";
import { buildVariablesFromQuote } from "../contracts/service.js";
import type { quotesTable } from "@workspace/db";

const quote = {
  id: "11111111-2222-3333-4444-555555555555",
  capitoli: [
    { lettera: "A", titolo: "Demolizioni", subtotale: 4000, voci: [] },
    { lettera: "B", titolo: "Finiture", subtotale: 6000, voci: [] },
  ],
  sconto: { percentuale: 10, importoScontato: 9000 },
  ivaPercentuale: "10",
  numeroPreventivoData: "N° 3.2026 del 20/09/2026",
  clientData: { nome: "Giulia Verdi", indirizzo: "Via Roma 1", codiceFiscale: "VRDGLI80A41F205X" },
  paymentSchedule: null,
  condizioniPagamento: ["30% acconto alla firma", "70% a fine lavori"],
  descrizioneGenerale: "Ristrutturazione",
} as unknown as typeof quotesTable.$inferSelect;

describe("buildVariablesFromQuote", () => {
  test("lo sconto del 10 % su 10.000 € lascia 9.000 € di imponibile, IVA 10 % → 9.900 €", () => {
    const v = buildVariablesFromQuote({ quote, profile: undefined, client: undefined, contractNumber: "CTR-1", province: "MI", language: "it" });
    expect(v.discount).toEqual({ percent: 10, amount: 1000 });
    expect(v.subtotal).toBe(9000);
    expect(v.taxTotal).toBe(900);
    expect(v.total).toBe(9900);
  });

  test("senza sconto niente riga di sconto", () => {
    const v = buildVariablesFromQuote({ quote: { ...quote, sconto: null }, profile: undefined, client: undefined, contractNumber: "CTR-1", province: "MI", language: "it" });
    expect(v.discount).toBeNull();
    expect(v.subtotal).toBe(10000);
    expect(v.total).toBe(11000);
  });
});
