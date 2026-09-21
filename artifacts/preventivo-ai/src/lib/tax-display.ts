// Phase 71 / V2-2: helper di presentazione per le righe IVA che l'API
// restituisce sui preventivi (`taxLines`) e per l'anteprima live del builder
// manuale. Le aliquote arrivano da GET /api/tax-profiles — mai una copia lato client.
import type { QuoteTaxLine, TaxProfile } from "@workspace/api-client-react";

type Lang = "it";

/** "22 %" / "9,975 %" — spazio prima del simbolo (norma tipografica italiana). */
function fmtRate(rate: number): string {
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(rate)} %`;
}

/** "IVA 22 %" oppure "Imposta (7 %)" per la riga generica. */
export function taxLineLabel(line: { code: string; label: string; rate: number }, _lang: Lang, genericLabel: string): string {
  if (line.code === "TAX") return `${genericLabel} (${fmtRate(line.rate)})`;
  return `${line.label} ${fmtRate(line.rate)}`;
}

/** "IVA 10 %" — il riepilogo mostrato accanto al regime in un selettore. */
export function profileSummary(profile: TaxProfile, _lang?: Lang): string {
  return profile.components.map((c) => `${c.label} ${fmtRate(c.rate)}`).join(" + ");
}

/**
 * Anteprima lato client degli importi per un imponibile; rispecchia
 * `quoteTaxLines` in lib/config (l'ultima riga assorbe l'arrotondamento così
 * la somma coincide con il totale arrotondato).
 */
export function previewTaxLines(taxable: number, profile: TaxProfile | null): QuoteTaxLine[] {
  if (!profile) return [];
  const total = Math.round(taxable * profile.totalRate) / 100;
  const lines = profile.components.map((c) => ({ code: c.code as QuoteTaxLine["code"], label: c.label, rate: c.rate, amount: Math.round(taxable * c.rate) / 100 }));
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  const drift = Math.round((total - sum) * 100) / 100;
  if (drift !== 0 && lines.length > 0) lines[lines.length - 1].amount = Math.round((lines[lines.length - 1].amount + drift) * 100) / 100;
  return lines;
}
