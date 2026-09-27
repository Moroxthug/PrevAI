// A-5: testi dei prezzi dei piani, tutti da @workspace/config (piani.ts).
// Nessuna pagina scrive più un importo a mano.

import { PREZZI_PIANI, PREZZI_IVA_INCLUSA, formatPrezzo, type PianoInAbbonamento } from "@workspace/config";

export type Periodicita = "mensile" | "annuale";

export function isPianoInAbbonamento(id: string | null | undefined): id is PianoInAbbonamento {
  return !!id && id in PREZZI_PIANI;
}

/** "19 €/mese" · "190 €/anno". */
export function prezzoPianoTesto(piano: PianoInAbbonamento, periodicita: Periodicita = "mensile"): string {
  const p = PREZZI_PIANI[piano];
  return periodicita === "annuale" ? `${formatPrezzo(p.annualeCents)}/anno` : `${formatPrezzo(p.mensileCents)}/mese`;
}

/** "Starter — 19 €/mese". */
export function etichettaPiano(piano: PianoInAbbonamento): string {
  return `${PREZZI_PIANI[piano].nome} — ${prezzoPianoTesto(piano)}`;
}

/** Il numero di preventivi al mese del piano, per le chiavi con `{count}`. */
export function preventiviMese(piano: PianoInAbbonamento): number | null {
  return PREZZI_PIANI[piano].preventiviMese;
}

export const NOTA_IVA = PREZZI_IVA_INCLUSA ? "IVA inclusa" : "+ IVA";
