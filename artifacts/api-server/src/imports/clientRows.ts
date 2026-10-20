// POCKET-5 (riga 62, QuoteAI 128.5): le righe di un foglio che il telefono ha abbinato ai clienti, divise in ciò che si aggiunge subito, ciò che sembra un cliente
// che l'impresa ha già (decide la persona) e ciò che non va nella riga. Pura: la rotta legge i clienti e scrive le righe. Telefoni italiani (+39).

export type ClientRow = { row: number; name: string; phone?: string; email?: string; address?: string; notes?: string };
export type ExistingClient = { id: string; name: string; email: string | null; phone: string | null; dedupKey: string };

export type RowError = { row: number; name: string; why: "no_name" | "short_phone" | "bad_email" };
export type RowMatch = { row: number; name: string; existingId: string; existingName: string; why: "email" | "phone" };
export type Plan = { clean: ClientRow[]; matches: RowMatch[]; errors: RowError[]; skipped: number };

const key = (r: { name: string; email?: string | null; phone?: string | null }): string => `${r.name.trim().toLowerCase()}|${(r.email ?? "").trim().toLowerCase()}|${(r.phone ?? "").trim().toLowerCase()}`;

const onlyDigits = (s: string | null | undefined): string => (s ?? "").split("").filter((c) => c >= "0" && c <= "9").join("");
/** The national number: the digits without a leading 0039 or 39 (an Italian number written with its country code). */
export const national = (s: string | null | undefined): string => {
  const d = onlyDigits(s);
  if (d.startsWith("0039")) return d.slice(4);
  if (d.startsWith("39") && d.length >= 11) return d.slice(2);
  return d;
};

/** An Italian phone is 6 to 11 digits once the country code is off (a mobile is 10, a landline 6 to 11); anything shorter is a typo. */
export const phoneOk = (p: string | undefined): boolean => { const d = national(p); return d.length >= 6 && d.length <= 11; };

export function planClientRows(rows: ClientRow[], existing: ExistingClient[]): Plan {
  const clean: ClientRow[] = [];
  const matches: RowMatch[] = [];
  const errors: RowError[] = [];
  let skipped = 0;
  const seen = new Set(existing.map((c) => c.dedupKey));
  const byEmail = new Map<string, ExistingClient>();
  const byPhone = new Map<string, ExistingClient>();
  for (const c of existing) {
    if (c.email) byEmail.set(c.email.trim().toLowerCase(), c);
    if (national(c.phone).length >= 6) byPhone.set(national(c.phone), c);
  }
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) { errors.push({ row: r.row, name: "", why: "no_name" }); continue; }
    if (r.email && !r.email.includes("@")) { errors.push({ row: r.row, name, why: "bad_email" }); continue; }
    if (r.phone && r.phone.trim() && !phoneOk(r.phone)) { errors.push({ row: r.row, name, why: "short_phone" }); continue; }
    const k = key({ name, email: r.email, phone: r.phone });
    if (seen.has(k)) { skipped++; continue; }
    const hit = (r.email && byEmail.get(r.email.trim().toLowerCase())) || (r.phone && national(r.phone).length >= 6 ? byPhone.get(national(r.phone)) : undefined) || null;
    if (hit) { matches.push({ row: r.row, name, existingId: hit.id, existingName: hit.name, why: r.email && byEmail.get(r.email.trim().toLowerCase()) ? "email" : "phone" }); seen.add(k); continue; }
    seen.add(k);
    clean.push({ ...r, name });
  }
  return { clean, matches, errors, skipped };
}
