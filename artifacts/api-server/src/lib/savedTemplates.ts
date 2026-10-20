// POCKET-5 (riga 62, QuoteAI 128.4 e 128.10): il testo che il titolare ha salvato nell'app in Impostazioni → Modelli dei
// messaggi (business_profiles.pocket_settings.templates, chiavi come "f1_it"). Un testo salvato sostituisce quello standard;
// gli {spazi} si riempiono qui. Nessun testo salvato (o vuoto) = il testo standard, quindi per un'impresa che non ha mai
// aperto la schermata non cambia niente. PrevAI parla solo italiano.

export type TemplateVars = Partial<Record<"first" | "link" | "job" | "amount" | "due" | "inv" | "me" | "co" | "eta" | "review" | "sign", string>>;

export function savedTemplate(pocketSettings: unknown, id: string): string | null {
  const page = (pocketSettings as { templates?: Record<string, unknown> } | null | undefined)?.templates;
  const v = page?.[`${id}_it`];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Riempie gli {spazi}; uno senza valore si toglie con lo spazio prima, così un link che manca non lascia un buco. */
export function fillTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\s?\{(\w+)\}/g, (m, k: string) => {
    const v = (vars as Record<string, string | undefined>)[k];
    return v ? (m.startsWith(" ") ? ` ${v}` : v) : "";
  }).replace(/[ \t]{2,}/g, " ").trim();
}
