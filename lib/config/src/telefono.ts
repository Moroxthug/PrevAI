// APP-8g (docs/PIANO-AZIONE.md riga 38) — un numero di telefono pronto per
// "apri il telefono": la forma da comporre (`tel:`) e quella da leggere.
//
// I numeri arrivano scritti a mano (clienti, richieste, fornitori, squadra):
// "333 123 4567", "02/1234567", "0039 333…", "+39 (0)2 …". Senza prefisso si
// intende un numero italiano. Shared by the API (the card) and the web app
// (the link and the QR). No dependencies.

export type TelefonoChiamata = {
  /** What goes after `tel:`: "+" and digits only. */
  dial: string;
  /** As shown on the card and read aloud: the company's own spacing, or mobile numbers as 333 123 4567. */
  display: string;
};

/** The number to dial, or null when it is not a phone number (too short, letters, an email). */
export function telefonoPerChiamata(raw: string | null | undefined): TelefonoChiamata | null {
  const written = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!written || /[a-z@]/i.test(written.replace(/^tel:/i, ""))) return null;
  // "+39 (0)2…": in Italy the 0 is dialled; abroad the (0) is left out.
  const italian = /^(tel:)?\s*(\+|00)\s*39/i.test(written);
  let s = written.replace(/^tel:/i, "").replace(/\(0\)/g, italian ? "0" : "").replace(/[\s./()-]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (!/^\+?\d+$/.test(s)) return null;
  let dial: string;
  if (s.startsWith("+")) dial = s;
  // Italian numbers: mobiles start with 3, landlines with 0 (the 0 stays after +39).
  else if (/^3\d{8,9}$/.test(s) || /^0\d{5,10}$/.test(s)) dial = `+39${s}`;
  else if (/^39(3\d{8,9}|0\d{5,10})$/.test(s)) dial = `+${s}`;
  else return null;
  const digits = dial.slice(1);
  if (digits.length < 8 || digits.length > 15) return null;
  const national = dial.startsWith("+39") ? dial.slice(3) : null;
  const hasSpacing = /[\s./-]/.test(written.replace(/^(\+|00)\d{2}\s/, ""));
  const display = hasSpacing
    ? written.replace(/^tel:/i, "")
    : national && /^3\d{9}$/.test(national)
      ? `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
      : national ?? dial;
  return { dial, display };
}
