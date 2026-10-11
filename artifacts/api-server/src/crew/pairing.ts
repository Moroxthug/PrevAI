// POCKET-3 (da QuoteAI 126): abbinare il telefono della squadra. Il titolare fa un codice per un operaio; l'operaio lo scrive sul telefono e riceve
// il token del suo link personale, su cui girano le schermate della squadra. Il codice ha l'hash, dura 7 giorni e funziona una volta.
// Base32 di Crockford senza I, L, O, U: niente da scambiare su uno schermo di telefono.
import { randomBytes } from "node:crypto";

export const PAIRING_DAYS = 7;
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 6; // 30 bit, mostrati come 123-ABC: il disegno ha sei caselle. Un solo uso, 7 giorni e 20 tentativi ogni 15 minuti per indirizzo bastano.

export function newPairingCode(): string {
  const bytes = randomBytes(LENGTH);
  let out = "";
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[bytes[i]! % 32];
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

/** Quello che una persona ha scritto → il codice canonico, o null: maiuscole, spazi, trattini e lettere simili sono perdonati. */
export function normalizePairingCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length !== LENGTH || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}
