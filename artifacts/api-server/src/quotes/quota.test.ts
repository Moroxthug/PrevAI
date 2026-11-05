import { describe, expect, it } from "vitest";
import type { ImportedQuoteExtraction } from "@workspace/db";
import { buildImportedPricesContext, contaVerificati } from "./quota";
import { pdfConMarchio } from "./pdf";

const vecchio = (over: Partial<ImportedQuoteExtraction> = {}): ImportedQuoteExtraction => ({
  clientName: "Rossi", email: null, phone: null, address: null, city: null, province: null, postalCode: null, date: null,
  status: "accepted", items: [{ description: "Tinteggiatura", quantity: 1, unitPrice: 100, total: 100 }], total: 100, notes: null, confidence: "high",
  ...over,
});

describe("vecchi preventivi verificati (PREZZI-2)", () => {
  it("contano quelli con voci, totale e lettura sicura", () => {
    expect(contaVerificati([vecchio(), vecchio({ clientName: "Bianchi" }), vecchio({ clientName: "Verdi", confidence: "medium" })])).toBe(3);
  });

  it("non contano le letture dubbie, quelli vuoti e i senza totale", () => {
    expect(contaVerificati([vecchio({ confidence: "low" }), vecchio({ items: [] }), vecchio({ total: 0 }), vecchio({ total: null })])).toBe(0);
  });

  it("lo stesso preventivo caricato due volte conta una volta", () => {
    expect(contaVerificati([vecchio(), vecchio({ clientName: " rossi " }), vecchio({ total: 200 })])).toBe(2);
  });
});

describe("marchio PrevAI sul PDF (PREZZI-2)", () => {
  const attivo = (subscriptionPlan: string) => ({ subscriptionPlan, subscriptionStatus: "active" });

  it("resta solo sul piano gratuito", () => {
    expect(pdfConMarchio({ unlockedWithPlan: "trial" }, null)).toBe(true);
    expect(pdfConMarchio({ unlockedWithPlan: null }, { subscriptionPlan: null, subscriptionStatus: null })).toBe(true);
  });

  it("nessun piano a pagamento lo porta, ingresso compreso", () => {
    for (const p of ["monthly_starter", "monthly_clienti", "monthly_pro", "monthly_elite"]) expect(pdfConMarchio({ unlockedWithPlan: null }, attivo(p))).toBe(false);
  });

  it("singoli e pacchetti restano puliti, anche quelli comprati prima", () => {
    for (const via of ["oneshot_clean", "oneshot_watermark", "pack_5", "monthly_starter"]) expect(pdfConMarchio({ unlockedWithPlan: via }, null)).toBe(false);
  });
});

describe("prezzi dei vecchi preventivi per l'IA (PREZZI-2)", () => {
  it("elenca le voci col prezzo, dal più recente, senza doppioni", () => {
    const testo = buildImportedPricesContext([
      { items: [{ descrizione: "Rasatura pareti", unita: "mq", prezzoUnitario: 12 }] },
      { items: [{ descrizione: "rasatura pareti", unita: "mq", prezzoUnitario: 9 }, { descrizione: "Senza prezzo", prezzoUnitario: 0 }] },
    ]);
    expect(testo).toContain("Rasatura pareti (mq): 12€/unità");
    expect(testo).not.toContain("9€");
    expect(testo).not.toContain("Senza prezzo");
  });

  it("senza voci utili non aggiunge niente al prompt", () => {
    expect(buildImportedPricesContext([{ items: null }, { items: [] }])).toBe("");
  });
});
