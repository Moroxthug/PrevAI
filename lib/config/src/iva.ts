/**
 * Regime IVA italiano (DPR 633/1972). Tenuto in codice, non in tabella:
 * le aliquote cambiano raramente e ogni documento contabile deve poterle
 * calcolare senza round-trip al DB. Aggiornare qui e in docs/RUNBOOKS.md.
 */
export type IvaCode = "IVA22" | "IVA10" | "IVA4" | "RC" | "SP" | "ESENTE" | "TAX";
export type TaxProfileCode = Exclude<IvaCode, "TAX">;

export type TaxComponent = {
  /** "TAX" solo per un'aliquota inserita a mano che non corrisponde a nessun regime. */
  code: IvaCode;
  label: string;
  /** Percentuale, es. 22 per 22 %. */
  rate: number;
  /** Dicitura obbligatoria in fattura/preventivo per le operazioni senza IVA. */
  legalNote?: string;
};

export type TaxProfile = {
  /** Identificatore stabile del regime (in QuoteAI era la provincia). */
  code: TaxProfileCode;
  /** Nome breve per i selettori. */
  name: string;
  /** Quando si applica (testo di aiuto). */
  hint: string;
  components: TaxComponent[];
  /** Somma delle aliquote dei componenti. */
  totalRate: number;
};

const P = (code: TaxProfileCode, name: string, hint: string, components: TaxComponent[]): TaxProfile => ({
  code,
  name,
  hint,
  components,
  totalRate: Math.round(components.reduce((s, c) => s + c.rate, 0) * 1000) / 1000,
});

/** Aliquote in vigore (2026). */
export const TAX_PROFILES: Record<TaxProfileCode, TaxProfile> = {
  IVA22: P("IVA22", "IVA 22 % (ordinaria)", "Aliquota ordinaria: nuove costruzioni non prima casa, forniture, servizi generici.", [{ code: "IVA22", label: "IVA", rate: 22 }]),
  IVA10: P("IVA10", "IVA 10 % (ristrutturazioni)", "Manutenzione ordinaria e straordinaria su immobili a prevalente destinazione abitativa, restauro e ristrutturazione (Tab. A parte III, n. 127-terdecies/quaterdecies). Beni significativi: 10 % solo fino a concorrenza della manodopera.", [{ code: "IVA10", label: "IVA", rate: 10 }]),
  IVA4: P("IVA4", "IVA 4 % (prima casa)", "Costruzione o ampliamento prima casa, abbattimento barriere architettoniche (Tab. A parte II, n. 39 e 41-ter).", [{ code: "IVA4", label: "IVA", rate: 4 }]),
  RC: P("RC", "Inversione contabile (reverse charge)", "Subappalti in edilizia e servizi di pulizia, demolizione, installazione impianti e completamento su edifici verso soggetti passivi IVA (art. 17 c. 6 lett. a e a-ter).", [{ code: "RC", label: "IVA", rate: 0, legalNote: "Operazione soggetta a inversione contabile ai sensi dell'art. 17, comma 6, DPR 633/1972 — IVA assolta dal committente." }]),
  SP: P("SP", "Split payment (PA)", "Fatture verso Pubbliche Amministrazioni e società partecipate (art. 17-ter): l'IVA è esposta ma versata dall'ente.", [{ code: "SP", label: "IVA", rate: 22, legalNote: "Scissione dei pagamenti ai sensi dell'art. 17-ter DPR 633/1972." }]),
  ESENTE: P("ESENTE", "Esente / non imponibile", "Operazioni esenti (art. 10) o fuori campo; regime forfettario (art. 1 c. 54-89 L. 190/2014).", [{ code: "ESENTE", label: "IVA", rate: 0, legalNote: "Operazione senza applicazione dell'IVA." }]),
};

export const DEFAULT_TAX_CODE: TaxProfileCode = "IVA22";
export const DEFAULT_TAX_RATE = TAX_PROFILES[DEFAULT_TAX_CODE].totalRate;

/** Dicitura forfettario (art. 1 c. 54-89 L. 190/2014) — usata quando il profilo aziendale è forfettario. */
export const FORFETTARIO_NOTE = "Operazione senza applicazione dell'IVA ai sensi dell'art. 1, commi 54-89, L. 190/2014 e s.m.i. — regime forfettario. Non soggetta a ritenuta d'acconto ai sensi dell'art. 1, comma 67.";

/** Imposta di bollo: € 2 sui documenti senza IVA oltre € 77,47 (DPR 642/1972, art. 13 Tariffa). */
export const BOLLO = { importo: 2, soglia: 77.47 } as const;

/** Ritenuta d'acconto sui compensi professionali (art. 25 DPR 600/1973) — non si applica agli artigiani/imprese. */
export const RITENUTA_ACCONTO_PERCENT = 20;

export function isTaxCode(value: unknown): value is TaxProfileCode {
  return typeof value === "string" && value in TAX_PROFILES;
}

export function getTaxProfile(code: string | null | undefined): TaxProfile {
  return isTaxCode(code) ? TAX_PROFILES[code] : TAX_PROFILES[DEFAULT_TAX_CODE];
}

/** Il profilo la cui aliquota totale coincide con `rate` (22 → IVA22, 10 → IVA10, 4 → IVA4). 0 è ambiguo: null. */
export function taxProfileForRate(rate: number): TaxProfile | null {
  if (!(rate > 0)) return null;
  return (Object.values(TAX_PROFILES) as TaxProfile[]).find((p) => p.code !== "SP" && Math.abs(p.totalRate - rate) < 0.01) ?? null;
}

export type TaxBreakdownLine = TaxComponent & { amount: number };

/** Scomposizione IVA (2 decimali EUR) su un imponibile. */
export function computeTax(subtotal: number, code: string | null | undefined): { profile: TaxProfile; lines: TaxBreakdownLine[]; total: number } {
  const profile = getTaxProfile(code);
  const lines = profile.components.map((c) => ({ ...c, amount: Math.round(subtotal * c.rate) / 100 }));
  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  return { profile, lines, total };
}

/**
 * I preventivi memorizzano una sola aliquota totale (`ivaPercentuale`). Se
 * coincide con un regime, il documento mostra quel componente ("IVA 10 %");
 * un'aliquota a mano che non corrisponde a nulla è una riga generica
 * "Imposta (x %)"; 0 = nessuna riga (esente / reverse charge, gestiti
 * dalla dicitura legale del profilo aziendale).
 */
export function splitTaxRate(rate: number): TaxComponent[] {
  if (!(rate > 0)) return [];
  const match = taxProfileForRate(rate);
  if (match) return match.components;
  return [{ code: "TAX", label: "Imposta", rate }];
}

/**
 * Righe IVA di un preventivo: gli importi sommano esattamente a `taxTotal`
 * (l'`ivaValore` memorizzato) — l'ultima riga assorbe l'arrotondamento.
 */
export function quoteTaxLines(taxable: number, rate: number, taxTotal: number): TaxBreakdownLine[] {
  const components = splitTaxRate(rate);
  if (components.length === 0) return [];
  const lines = components.map((c) => ({ ...c, amount: Math.round(taxable * c.rate) / 100 }));
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  const drift = Math.round((taxTotal - sum) * 100) / 100;
  if (drift !== 0) lines[lines.length - 1].amount = Math.round((lines[lines.length - 1].amount + drift) * 100) / 100;
  return lines;
}

/** Importo dell'imposta di bollo dovuta su un documento senza IVA. */
export function bolloDovuto(importoSenzaIva: number, taxRate: number): number {
  return taxRate === 0 && importoSenzaIva > BOLLO.soglia ? BOLLO.importo : 0;
}
