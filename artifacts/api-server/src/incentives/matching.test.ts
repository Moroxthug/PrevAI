// vitest suite (Phase 61 → V2-4): catalogo v1 (statale/regionale/comunale, regione/comune).
import assert from "node:assert/strict";
import { inferInterventionCategories, matchIncentivesForQuote, categoryMatches, placeMatches } from "./matching.js";
import type { IncentiveCatalogItem } from "@workspace/db";
import { test } from "vitest";

function item(overrides: Partial<IncentiveCatalogItem>): IncentiveCatalogItem {
  return {
    id: "id",
    userId: null,
    level: "statale",
    codice: "TEST",
    titolo: "Programma di prova",
    descrizione: "desc",
    regione: null,
    comune: null,
    categoriaIntervento: "tutti",
    tipoAgevolazione: "detrazione_10_anni",
    percentualeMassima: "50.00",
    massimaleSpesa: null,
    massimaleContributo: null,
    requisitiIseeMax: null,
    scadenza: null,
    stato: "active",
    fonteUfficialeUrl: null,
    isVerifiedByAi: true,
    humanVerified: false,
    lastCheckedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

test("incentives/matching: categorie dal testo", () => {
  assert.deepEqual(inferInterventionCategories("Installazione pompa di calore e nuovi infissi"), ["efficienza_energetica"]);
  assert.deepEqual(inferInterventionCategories("Rifacimento bagno con doccia a filo pavimento").sort(), ["bagno", "barriere_architettoniche", "pavimenti", "ristrutturazione"]);
  assert.deepEqual(inferInterventionCategories("Riparazione della recinzione"), []);
});

test("incentives/matching: compatibilità categoria (regole v1)", () => {
  assert.equal(categoryMatches("bagno", "tutti"), true);
  assert.equal(categoryMatches("bagno", "barriere_architettoniche"), true);
  assert.equal(categoryMatches("elettrico", "efficienza_energetica"), true);
  assert.equal(categoryMatches("tinteggiatura", "efficienza_energetica"), false);
  assert.equal(categoryMatches("tinteggiatura", "ristrutturazione"), true);
});

test("incentives/matching: regione/comune tolleranti", () => {
  assert.equal(placeMatches("Emilia-Romagna", "emilia romagna"), true);
  assert.equal(placeMatches("Milano", "Comune di Milano"), true);
  assert.equal(placeMatches("Lombardia", "Piemonte"), false);
  assert.equal(placeMatches(null, "Lombardia"), false);
});

test("incentives/matching: filtro per preventivo", () => {
  const statale = item({ id: "statale", codice: "BONUS_CASA_50" });
  const lombardia = item({ id: "lombardia", level: "regionale", regione: "Lombardia", categoriaIntervento: "efficienza_energetica" });
  const piemonte = item({ id: "piemonte", level: "regionale", regione: "Piemonte", categoriaIntervento: "efficienza_energetica" });
  const milano = item({ id: "milano", level: "comunale", regione: "Lombardia", comune: "Milano", categoriaIntervento: "tutti" });
  const chiuso = item({ id: "chiuso", stato: "closed" });
  const catalog = [statale, lombardia, piemonte, milano, chiuso];

  // Cantiere a Milano, lavori energetici: statale + regionale Lombardia + comunale Milano; mai Piemonte né chiusi.
  const ids = (r: IncentiveCatalogItem[]) => r.map((x) => x.id).sort();
  assert.deepEqual(ids(matchIncentivesForQuote(catalog, { regione: "Lombardia", comune: "Milano", categories: ["efficienza_energetica"] })), ["lombardia", "milano", "statale"]);
  // Stessa regione, altro comune: il bando comunale di Milano non vale.
  assert.deepEqual(ids(matchIncentivesForQuote(catalog, { regione: "Lombardia", comune: "Bergamo", categories: ["efficienza_energetica"] })), ["lombardia", "statale"]);
  // Senza comune noto, i bandi comunali della regione vengono proposti.
  assert.deepEqual(ids(matchIncentivesForQuote(catalog, { regione: "Lombardia", categories: ["efficienza_energetica"] })), ["lombardia", "milano", "statale"]);
  // Nessuna categoria dedotta → si considera "ristrutturazione": il bando energetico non vale, quelli "tutti" sì.
  assert.deepEqual(ids(matchIncentivesForQuote(catalog, { regione: "Lombardia", comune: "Milano", categories: [] })), ["milano", "statale"]);
  // Regione ignota: solo statali.
  assert.deepEqual(ids(matchIncentivesForQuote(catalog, { regione: null, categories: ["efficienza_energetica"] })), ["statale"]);
});
