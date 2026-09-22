import type { IncentiveCatalogItem, QuoteIncentivesData } from "@workspace/db";
import { placeMatches } from "./matching.js";

// ── Calcolatore incentivi v1 (widget "Verifica incentivi ora") ───────────────
// Logica presa 1:1 da `POST /api/public/quotes/:id/incentives` di v1 e resa
// funzione pura: stesse regole, stessi campi in uscita (sono quelli salvati in
// `quotes.client_data.incentivesData` e stampati nel PDF). Le aliquote sono
// indicative e vanno confermate con il commercialista in A-0 (regole 2026).

export type TipoImmobile = "prima_casa" | "seconda_casa" | "condominio" | "ufficio" | string;
export type ObiettivoLavori = "ristrutturazione" | "efficienza" | "efficienza_energetica" | "barriere" | "barriere_architettoniche" | string;
export type FasciaIsee = "sotto_30k" | "sopra_30k" | string;

export interface IncentiveCalcInput {
  totaleLavori: number;
  tipoImmobile?: TipoImmobile;
  obiettivoLavori?: ObiettivoLavori;
  fasciaIsee?: FasciaIsee;
  regione?: string;
  cap?: string;
  /** Catalogo già filtrato sui bandi non chiusi. */
  catalog: IncentiveCatalogItem[];
}

export interface IncentiveCalcResult {
  totaleLavori: number;
  scontoIvaStimato: number;
  bonusStataleCodice: string;
  bonusStataleApplicato: string;
  bonusStataleHumanVerified: boolean;
  importoBonusStatale: number;
  bandoRegionaleApplicato: string;
  bandoRegionaleHumanVerified: boolean | null;
  importoBandoRegionale: number;
  esborsoImmediatoStimato: number;
  detrazioneFiscaleDecennale: number;
  detrazioneFiscaleAnnua: number;
  incentivesData: QuoteIncentivesData;
}

/** Massimale standard della detrazione statale (48.000 € = 50 % di 96.000 €). */
const MASSIMALE_DETRAZIONE_STATALE = 48_000;

/** Prefissi CAP dei capoluoghi con bandi comunali nel catalogo di default. */
const CAP_PREFIX_COMUNE: [string, string][] = [
  ["20", "Milano"],
  ["40", "Bologna"],
  ["00", "Roma"],
  ["10", "Torino"],
  ["80", "Napoli"],
  ["50", "Firenze"],
  ["16", "Genova"],
  ["30", "Venezia"],
];

export function comuneDaCap(cap: string | undefined): string | null {
  const c = (cap ?? "").trim();
  if (!/^\d{5}$/.test(c)) return null;
  return CAP_PREFIX_COMUNE.find(([prefix]) => c.startsWith(prefix))?.[1] ?? null;
}

const fmt = (n: number) => n.toLocaleString("it-IT");

export function calcolaIncentiviPreventivo(input: IncentiveCalcInput): IncentiveCalcResult {
  const tipoImmobile = input.tipoImmobile || "prima_casa";
  const obiettivoLavori = input.obiettivoLavori || "ristrutturazione";
  const fasciaIsee = input.fasciaIsee || "sopra_30k";
  const regione = (input.regione ?? "").trim();
  const cap = (input.cap ?? "").trim();
  const totaleLavori = Math.max(0, Number(input.totaleLavori) || 0);

  // 1. IVA agevolata 10 % (residenziale) contro il 22 % ordinario: risparmio ~10 % dell'imponibile
  const isResidenziale = tipoImmobile === "prima_casa" || tipoImmobile === "seconda_casa" || tipoImmobile === "condominio";
  const scontoIvaStimato = isResidenziale ? Math.round(totaleLavori * 0.10) : 0;

  // 2. Bonus statale compatibile. La detrazione IRPEF (ristrutturazione /
  // ecobonus) è riservata alle persone fisiche su immobili abitativi: un
  // ufficio non rientra; sulla seconda casa l'aliquota è ridotta. Il bonus
  // barriere architettoniche non è limitato alla prima casa.
  const isUfficio = tipoImmobile === "ufficio";
  const isSecondaCasa = tipoImmobile === "seconda_casa";

  let bonusStataleApplicato = "Bonus Ristrutturazione Edilizia 50% (Detrazione 10 anni)";
  let bonusStataleCodice = "BONUS_CASA_50";
  let percentualeBonusStatale = 0.50;
  let percentualeSecondaCasa = 0.36;

  if (obiettivoLavori === "efficienza" || obiettivoLavori === "efficienza_energetica") {
    bonusStataleApplicato = "Ecobonus 65% / Conto Termico GSE (Incentivo Diretto)";
    bonusStataleCodice = "ECOBONUS_65";
    percentualeBonusStatale = 0.65;
    percentualeSecondaCasa = 0.50;
  } else if (obiettivoLavori === "barriere" || obiettivoLavori === "barriere_architettoniche") {
    bonusStataleApplicato = "Bonus Abbattimento Barriere Architettoniche 75%";
    bonusStataleCodice = "BARRIERE_75";
    percentualeBonusStatale = 0.75;
    percentualeSecondaCasa = 0.75;
  }

  const bonusBarriere = bonusStataleCodice === "BARRIERE_75";
  if (isUfficio && !bonusBarriere) {
    bonusStataleApplicato = `${bonusStataleApplicato} — non applicabile: detrazione riservata a immobili ad uso abitativo`;
    percentualeBonusStatale = 0;
  } else if (isSecondaCasa && !bonusBarriere) {
    percentualeBonusStatale = percentualeSecondaCasa;
    bonusStataleApplicato = `${bonusStataleApplicato} — aliquota ridotta ${Math.round(percentualeSecondaCasa * 100)}% per seconda casa`;
  }

  const importoBonusStatale = Math.min(MASSIMALE_DETRAZIONE_STATALE, Math.round(totaleLavori * percentualeBonusStatale));

  const bonusStataleRecord = input.catalog.find((inc) => inc.codice === bonusStataleCodice);
  const bonusStataleHumanVerified = bonusStataleRecord?.humanVerified ?? false;

  // 3. Bando regionale o comunale (fondo perduto / contributo)
  let bandoRegionaleApplicato = "Nessun bando regionale a sportello specifico individuato (si applicano i Bonus Statali)";
  let importoBandoRegionale = 0;
  let bandoRegionaleHumanVerified: boolean | null = null;

  const comuneDalCap = comuneDaCap(cap);
  if (regione || comuneDalCap) {
    // Il comune (dal CAP) è più specifico della regione: se c'è un bando comunale
    // vince quello, altrimenti il primo regionale/comunale della regione.
    const aperti = input.catalog.filter((inc) => inc.stato !== "closed" && (inc.level === "regionale" || inc.level === "comunale"));
    const matchReg =
      (comuneDalCap ? aperti.find((inc) => inc.level === "comunale" && placeMatches(inc.comune, comuneDalCap)) : undefined) ??
      (regione ? aperti.find((inc) => placeMatches(inc.regione, regione)) : undefined);
    if (matchReg) {
      bandoRegionaleApplicato = `${matchReg.titolo} (${matchReg.tipoAgevolazione === "fondo_perduto" ? "Fondo Perduto" : "Contributo"})`;
      importoBandoRegionale = Number(matchReg.massimaleContributo) || 3000;
      bandoRegionaleHumanVerified = matchReg.humanVerified;
      if (fasciaIsee === "sotto_30k") importoBandoRegionale = Math.round(importoBandoRegionale * 1.25); // maggiorazione sociale ISEE
    }
  }

  // Esborso immediato: solo ciò che riduce davvero il pagamento in fase di
  // lavori (fondo perduto e IVA agevolata). Le detrazioni si recuperano in 10
  // anni di dichiarazione dei redditi e NON vanno sottratte come sconto cassa.
  const esborsoImmediatoStimato = Math.max(0, Math.round(totaleLavori - importoBandoRegionale - scontoIvaStimato));
  const detrazioneFiscaleAnnua = Math.round(importoBonusStatale / 10);

  const incentivesData: QuoteIncentivesData = {
    tipoImmobile,
    obiettivoLavori,
    fasciaIsee,
    regione,
    cap,
    bonusStataleApplicato: `${bonusStataleApplicato} (~€${fmt(importoBonusStatale)})`,
    bonusStataleHumanVerified,
    bandoRegionaleApplicato: importoBandoRegionale > 0 ? `${bandoRegionaleApplicato} (~€${fmt(importoBandoRegionale)})` : bandoRegionaleApplicato,
    bandoRegionaleHumanVerified,
    scontoIvaStimato,
    esborsoImmediatoStimato,
    detrazioneFiscaleDecennale: importoBonusStatale,
    detrazioneFiscaleAnnua,
  };

  return {
    totaleLavori,
    scontoIvaStimato,
    bonusStataleCodice,
    bonusStataleApplicato,
    bonusStataleHumanVerified,
    importoBonusStatale,
    bandoRegionaleApplicato,
    bandoRegionaleHumanVerified,
    importoBandoRegionale,
    esborsoImmediatoStimato,
    detrazioneFiscaleDecennale: importoBonusStatale,
    detrazioneFiscaleAnnua,
    incentivesData,
  };
}

/** Riepilogo testuale per le email (impresa e cliente), come in v1. */
export function riepilogoIncentivi(r: IncentiveCalcResult, opts: { perImpresa: boolean }): string {
  const bando = r.importoBandoRegionale > 0 ? `${r.bandoRegionaleApplicato} (~€${fmt(r.importoBandoRegionale)})` : "Nessuno a sportello";
  const righe = [
    `• Bonus Statale Compatibile: ${r.bonusStataleApplicato} (~€${fmt(r.importoBonusStatale)}, detrazione IRPEF in 10 quote annuali da ~€${fmt(r.detrazioneFiscaleAnnua)})`,
    `• Bando Regionale/Comunale: ${bando}`,
    `• Risparmio IVA 10%: ~€${fmt(r.scontoIvaStimato)}`,
  ];
  const d = r.incentivesData;
  if (opts.perImpresa) {
    return [
      "🏛️ STIMA PRELIMINARE AGEVOLAZIONI (da confermare in sede di sopralluogo tecnico e fiscale):",
      `• Immobile: ${d.tipoImmobile} | Obiettivo: ${d.obiettivoLavori} | ISEE: ${d.fasciaIsee}`,
      ...righe,
      `👉 ESBORSO IMMEDIATO STIMATO (esclusa detrazione, recuperata in 10 anni): ~€${fmt(r.esborsoImmediatoStimato)}`,
    ].join("\n");
  }
  return [
    `Immobile: ${d.tipoImmobile} | Obiettivo: ${d.obiettivoLavori}`,
    ...righe,
    `• Esborso immediato stimato (esclusa detrazione, recuperata in 10 anni): ~€${fmt(r.esborsoImmediatoStimato)}`,
  ].join("\n");
}
