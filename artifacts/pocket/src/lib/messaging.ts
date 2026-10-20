// WhatsApp: the pure parts. A number the person typed becomes the international form the server keeps.

/** A number the person typed for WhatsApp: digits with an optional + (or 00); an Italian mobile (3xx…) or landline (0…) without one gets +39. */
export function waNumber(raw: string): string | null {
  const t = raw.trim();
  const digits = t.replace(/\D/g, "");
  if (t.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.startsWith("00")) return digits.length >= 10 && digits.length <= 17 ? `+${digits.slice(2)}` : null;
  if (digits.startsWith("39") && digits.length >= 11 && digits.length <= 13) return `+${digits}`;
  if (/^[03]\d{5,10}$/.test(digits)) return `+39${digits}`;
  return null;
}
