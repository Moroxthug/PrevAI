// V2-4: il calcolatore v1 come funzione pura. I numeri attesi sono quelli che
// v1 ha scritto davvero in `client_data.incentivesData` dei preventivi in
// produzione (dump 2026-09-21), così la parità con v1 è verificata sui dati reali.
import assert from "node:assert/strict";
import { calcolaIncentiviPreventivo, comuneDaCap, riepilogoIncentivi } from "./calc.js";
import type { IncentiveCatalogItem } from "@workspace/db";
import { test } from "vitest";

function item(overrides: Partial<IncentiveCatalogItem>): IncentiveCatalogItem {
  return {
    id: "id", userId: null, level: "statale", codice: "TEST", titolo: "Programma", descrizione: "desc", regione: null, comune: null,
    categoriaIntervento: "tutti", tipoAgevolazione: "detrazione_10_anni", percentualeMassima: "50.00", massimaleSpesa: null, massimaleContributo: null,
    requisitiIseeMax: null, scadenza: null, stato: "active", fonteUfficialeUrl: null, isVerifiedByAi: true, humanVerified: false, lastCheckedAt: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

const catalog: IncentiveCatalogItem[] = [
  item({ codice: "BONUS_CASA_50", humanVerified: true }),
  item({ codice: "ECOBONUS_65" }),
  item({ codice: "BARRIERE_75" }),
  item({ codice: "LOMBARDIA_EFF_2026", level: "regionale", regione: "Lombardia", titolo: "Bando Efficienza Energetica e Riscaldamento Regione Lombardia 2026", tipoAgevolazione: "fondo_perduto", massimaleContributo: "5000.00" }),
  item({ codice: "MILANO_FACCIATE_2026", level: "comunale", regione: "Lombardia", comune: "Milano", titolo: "Bando Comune di Milano - Rinnovo Facciate ed Efficienza Condominiale/Residenziale", tipoAgevolazione: "fondo_perduto", massimaleContributo: "3000.00" }),
];

test("incentives/calc: prima casa, Lombardia, ISEE sotto 30k (preventivo reale v1)", () => {
  const r = calcolaIncentiviPreventivo({ totaleLavori: 11378, tipoImmobile: "prima_casa", obiettivoLavori: "ristrutturazione", fasciaIsee: "sotto_30k", regione: "Lombardia", cap: "", catalog });
  assert.equal(r.scontoIvaStimato, 1138);
  assert.equal(r.importoBonusStatale, 5689);
  assert.equal(r.detrazioneFiscaleAnnua, 569);
  assert.equal(r.importoBandoRegionale, 6250); // 5000 × 1,25 maggiorazione ISEE
  assert.equal(r.esborsoImmediatoStimato, 3990);
  assert.equal(r.bonusStataleHumanVerified, true);
  assert.equal(r.bandoRegionaleHumanVerified, false);
  assert.equal(r.incentivesData.bonusStataleApplicato, "Bonus Ristrutturazione Edilizia 50% (Detrazione 10 anni) (~€5689)"); // it-IT non raggruppa le migliaia sotto 5 cifre (CLDR), come in v1
  assert.equal(r.incentivesData.bandoRegionaleApplicato, "Bando Efficienza Energetica e Riscaldamento Regione Lombardia 2026 (Fondo Perduto) (~€6250)");
});

test("incentives/calc: CAP 20100 → bando comunale di Milano (preventivo reale v1)", () => {
  const r = calcolaIncentiviPreventivo({ totaleLavori: 6662, tipoImmobile: "prima_casa", obiettivoLavori: "ristrutturazione", fasciaIsee: "sopra_30k", regione: "Lombardia", cap: "20100", catalog });
  assert.equal(comuneDaCap("20100"), "Milano");
  assert.equal(r.scontoIvaStimato, 666);
  assert.equal(r.importoBonusStatale, 3331);
  assert.equal(r.esborsoImmediatoStimato, 2996);
  assert.equal(r.importoBandoRegionale, 3000); // il bando comunale (dal CAP) vince su quello regionale
});

test("incentives/calc: ufficio → nessuna detrazione; seconda casa → aliquota ridotta; barriere invariato", () => {
  const ufficio = calcolaIncentiviPreventivo({ totaleLavori: 10000, tipoImmobile: "ufficio", catalog });
  assert.equal(ufficio.importoBonusStatale, 0);
  assert.equal(ufficio.scontoIvaStimato, 0);
  assert.match(ufficio.bonusStataleApplicato, /non applicabile/);

  const seconda = calcolaIncentiviPreventivo({ totaleLavori: 10000, tipoImmobile: "seconda_casa", obiettivoLavori: "efficienza", catalog });
  assert.equal(seconda.importoBonusStatale, 5000);
  assert.match(seconda.bonusStataleApplicato, /aliquota ridotta 50%/);

  const barriere = calcolaIncentiviPreventivo({ totaleLavori: 10000, tipoImmobile: "seconda_casa", obiettivoLavori: "barriere", catalog });
  assert.equal(barriere.importoBonusStatale, 7500);
  assert.equal(barriere.bonusStataleCodice, "BARRIERE_75");
});

test("incentives/calc: massimale 48.000 € e riepilogo email", () => {
  const r = calcolaIncentiviPreventivo({ totaleLavori: 200000, catalog });
  assert.equal(r.importoBonusStatale, 48000);
  assert.equal(r.detrazioneFiscaleAnnua, 4800);
  const impresa = riepilogoIncentivi(r, { perImpresa: true });
  assert.match(impresa, /STIMA PRELIMINARE AGEVOLAZIONI/);
  assert.match(impresa, /Nessuno a sportello/);
  assert.match(riepilogoIncentivi(r, { perImpresa: false }), /Esborso immediato stimato/);
});
