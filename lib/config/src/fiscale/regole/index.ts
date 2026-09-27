import type { ParametriAnno, RegolaId } from "../types";
import { PARAMETRI_2026 } from "./2026";

// Registro delle versioni del motore. Ogni gennaio si aggiunge l'anno nuovo e
// si lascia in piedi il precedente: una dichiarazione si può ancora rifare tre
// anni dopo, e va rifatta con le regole di allora.

const VERSIONI: readonly ParametriAnno[] = [PARAMETRI_2026];

export const ANNO_REGOLE_MINIMO = Math.min(...VERSIONI.map((v) => v.anno));
export const ANNO_REGOLE_MASSIMO = Math.max(...VERSIONI.map((v) => v.anno));

/**
 * Regole dell'anno richiesto. Se l'anno non esiste ancora (siamo a gennaio e
 * la legge di bilancio non è stata recepita) si usa l'ultima versione
 * disponibile: `Calcolo.annoRegole` lo dice, e l'interfaccia mostra
 * "regole 2026 applicate al 2027" invece di fingere una certezza.
 */
export function regoleDiAnno(anno: number): ParametriAnno {
  const esatta = VERSIONI.find((v) => v.anno === anno);
  if (esatta) return esatta;
  const precedenti = VERSIONI.filter((v) => v.anno < anno);
  if (precedenti.length > 0) return precedenti.reduce((a, b) => (a.anno > b.anno ? a : b));
  return VERSIONI.reduce((a, b) => (a.anno < b.anno ? a : b));
}

export function anniDisponibili(): readonly number[] {
  return VERSIONI.map((v) => v.anno).sort((a, b) => a - b);
}

/** Le regole che il commercialista non ha ancora confermato, fra quelle indicate. */
export function nonRevisionate(parametri: ParametriAnno, ids: readonly RegolaId[]): readonly RegolaId[] {
  return ids.filter((id) => parametri.regole[id].revisione.stato === "non_revisionata");
}

/** true solo quando **tutto** il motore è stato firmato: è la condizione di uscita di D6. */
export function motoreRevisionato(parametri: ParametriAnno): boolean {
  return Object.values(parametri.regole).every((r) => r.revisione.stato !== "non_revisionata");
}

export { PARAMETRI_2026 };
