// ── POCKET-4 (QuoteAI 127.8): quali fatture e costi sono fra due imprese dello stesso gruppo ──
// Pura, quindi provata. Una vista di insieme che somma la fattura dell'impresa A all'impresa B e il costo di B per lo stesso lavoro conta il
// lavoro due volte (una come ricavo, una come costo) e gonfia entrambi: quelle righe si tolgono dai totali del gruppo e si mostrano a parte.
// Si riconosce da ciò che i documenti già portano: prima la P. IVA, poi l'email, poi il nome dell'impresa senza la forma societaria.

export type GroupCompanyKey = { orgId: string; name: string; email: string | null; businessNumber: string | null };

export type PartyLike = { name?: string | null; email?: string | null; businessNumber?: string | null; vatNumber?: string | null };

// Solo le forme societarie: «edilizia» o «costruzioni» distinguono due imprese dello stesso titolare, non si tolgono.
const SUFFIXES = new Set(["srl", "srls", "spa", "sas", "snc", "sapa", "scarl", "soc", "societa", "ditta", "ss"]);

export function normalizeCompanyName(name: string | null | undefined): string {
  if (!name) return "";
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1]!)) words.pop();
  return words.join(" ");
}

/** Le 11 cifre della partita IVA (o del codice fiscale numerico) di una persona giuridica, senza «IT» e senza spazi. */
export function partitaIva11(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/^\s*IT/i, "").replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

/** L'impresa del gruppo che un cliente o un fornitore è, diversa da `selfOrgId` — o null. */
export function matchGroupCompany(party: PartyLike, companies: GroupCompanyKey[], selfOrgId: string): string | null {
  const others = companies.filter((c) => c.orgId !== selfOrgId);
  const piva = partitaIva11(party.businessNumber) ?? partitaIva11(party.vatNumber);
  if (piva) {
    const hit = others.find((c) => partitaIva11(c.businessNumber) === piva);
    if (hit) return hit.orgId;
  }
  const email = party.email?.trim().toLowerCase();
  if (email) {
    const hit = others.find((c) => c.email && c.email.trim().toLowerCase() === email);
    if (hit) return hit.orgId;
  }
  const name = normalizeCompanyName(party.name);
  if (name.length >= 3) {
    const hit = others.find((c) => normalizeCompanyName(c.name) === name);
    if (hit) return hit.orgId;
  }
  return null;
}
