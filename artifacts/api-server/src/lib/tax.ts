import { DEFAULT_TAX_RATE } from "@workspace/db";

/**
 * Aliquota IVA da salvare su un preventivo appena generato. Il prompt dice
 * all'AI di non inventare aliquote, quindi di solito torna 0/undefined: in
 * quel caso vale l'aliquota ordinaria (22 %). Un'aliquota positiva prodotta
 * esplicitamente dall'AI (l'utente ha scritto "IVA al 10 %") vince.
 *
 * In QuoteAI la provincia decideva l'aliquota (ON → 13, QC → 14.975…); in
 * Italia l'IVA è nazionale, quindi `province` non incide più. Il parametro
 * resta per non toccare i chiamanti — V2-3 (docs/PIANO-AZIONE.md).
 */
export function resolveQuoteTaxRate(aiRate: number | null | undefined, _province?: string | null | undefined): number {
  if (typeof aiRate === "number" && Number.isFinite(aiRate) && aiRate > 0) return aiRate;
  return DEFAULT_TAX_RATE;
}
