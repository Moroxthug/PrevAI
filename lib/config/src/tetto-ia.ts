// SEC-2 (docs/CONTROLLO-FASE-41.md §3, riga 43) — tetto mensile ai costi IA per impresa.
//
// Ogni chiamata a un modello si registra in usage_events (centesimi di
// dollaro). Prima di una nuova chiamata il server somma il mese e, sopra il
// tetto, non chiama più il modello fino al primo del mese: le funzioni con
// l'IA rispondono 429 AI_BUDGET, il widget salva comunque la richiesta senza
// stima (una chiave pubblica non deve poter spegnere i contatti di un'impresa).
//
// Il tetto è una rete di sicurezza contro abusi e errori, non un limite
// d'uso venduto: un preventivo con l'IA costa una frazione di centesimo, quindi
// un'impresa normale non ci arriva mai.

import { PREZZI_PIANI, type PianoInAbbonamento } from "./piani";
import { USD_TO_EUR_APPROX } from "./assistente-costi";

/** Percentuale del prezzo mensile del piano che l'IA può costare in un mese. */
export const TETTO_IA_PERCENTUALE_PIANO = 30;

/** Tetto minimo (piano gratuito, prova, preventivi singoli): 3 €. */
export const TETTO_IA_MINIMO_EUR_CENTS = 300;

/** Sopra questa quota del tetto lo staff riceve un avviso (una volta al mese). */
export const TETTO_IA_AVVISO_QUOTA = 0.8;

/**
 * Tetto del mese in centesimi di euro. `override` viene da ai_budgets:
 * `undefined` = nessuna riga (vale il piano), `null` = nessun tetto per
 * quell'impresa, un numero = quel tetto.
 */
export function tettoIaEurCents(piano: string | null | undefined, override?: number | null): number | null {
  if (override === null) return null;
  if (typeof override === "number" && Number.isFinite(override) && override >= 0) return Math.round(override);
  const prezzo = piano && piano in PREZZI_PIANI ? PREZZI_PIANI[piano as PianoInAbbonamento].mensileCents : 0;
  return Math.max(TETTO_IA_MINIMO_EUR_CENTS, Math.round((prezzo * TETTO_IA_PERCENTUALE_PIANO) / 100));
}

export type StatoTettoIa = {
  spesaEurCents: number;
  tettoEurCents: number | null;
  superato: boolean;
  avviso: boolean;
};

/** usage_events è in centesimi di dollaro: qui si passa in euro e si confronta col tetto. */
export function statoTettoIa(spesaUsdCents: number, tettoEurCents: number | null): StatoTettoIa {
  const spesaEurCents = Math.round(spesaUsdCents * USD_TO_EUR_APPROX * 100) / 100;
  if (tettoEurCents === null) return { spesaEurCents, tettoEurCents, superato: false, avviso: false };
  return {
    spesaEurCents,
    tettoEurCents,
    superato: spesaEurCents >= tettoEurCents,
    avviso: spesaEurCents >= tettoEurCents * TETTO_IA_AVVISO_QUOTA,
  };
}

export const MESSAGGIO_TETTO_IA =
  "Questo mese l'IA ha raggiunto il limite di spesa previsto per il tuo piano. Riprende il primo del mese: se ti serve prima, scrivi all'assistenza.";
