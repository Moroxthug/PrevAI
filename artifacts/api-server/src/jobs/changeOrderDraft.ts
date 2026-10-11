// POCKET-3 (da QuoteAI 126.4): la variante abbozzata da quello che l'impresa ha detto o scritto. L'IA propone titolo, voci con quantità e prezzo
// e i giorni in più; non salva niente: l'app mostra le voci e il titolare controlla ogni prezzo prima di inviare.
import { recordAiUsage } from "../lib/usage.js";

type DraftItem = { descrizione: string; um: string; quantita: number; prezzoUnitario: number };
export type ChangeOrderDraft = { title: string; description: string; scheduleDeltaDays: number; items: DraftItem[] };

/** Il JSON dell'IA → una bozza usabile (voci senza descrizione o con prezzo non valido cadono), o null. */
export function parseDraft(raw: string): ChangeOrderDraft | null {
  let p: { title?: unknown; description?: unknown; days?: unknown; items?: unknown };
  try { p = JSON.parse(raw); } catch { return null; }
  if (!p || !Array.isArray(p.items)) return null;
  const items = (p.items as Record<string, unknown>[])
    .map((i): DraftItem => ({ descrizione: String(i.descrizione ?? "").trim().slice(0, 200), um: String(i.um ?? "").trim().slice(0, 12), quantita: Number(i.quantita), prezzoUnitario: Number(i.prezzoUnitario) }))
    .filter((i) => i.descrizione && Number.isFinite(i.prezzoUnitario) && i.prezzoUnitario >= 0 && i.prezzoUnitario < 1_000_000)
    .map((i) => ({ ...i, quantita: Number.isFinite(i.quantita) && i.quantita > 0 && i.quantita < 100_000 ? i.quantita : 1 }))
    .slice(0, 20);
  if (!items.length) return null;
  const days = Number(p.days);
  return {
    title: String(p.title ?? "").trim().slice(0, 120),
    description: String(p.description ?? "").trim().slice(0, 1000),
    scheduleDeltaDays: Number.isInteger(days) && days >= -60 && days <= 120 ? days : 0,
    items,
  };
}

export async function draftChangeOrder(params: { userId: string; jobName: string; text: string }): Promise<ChangeOrderDraft | null> {
  const { openai } = await import("@workspace/integrations-openai-ai-server"); // il client vuole una chiave: i test della bozza non la usano
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  const system = "Sei un capocantiere italiano che prepara varianti in corso d'opera per ristrutturazioni. Dalla richiesta del cliente scrivi poche voci chiare con unità di misura (n, mq, ml, ore, a corpo), quantità e prezzo unitario in euro IVA esclusa, a prezzi di mercato italiani realistici, e i giorni lavorativi in più (0 se nessuno). Non inventare lavori che non sono stati chiesti. Rispondi SOLO in JSON.";
  const user = `Cantiere: ${params.jobName}\nRichiesta: ${params.text.slice(0, 1500)}\n\nRestituisci: {"title":"<titolo breve, max 60 caratteri>","description":"<una frase>","days":<intero>,"items":[{"descrizione":"...","um":"...","quantita":<numero>,"prezzoUnitario":<euro>}]}`;
  const completion = await openai.chat.completions.create(
    { model, temperature: 0.2, max_completion_tokens: 700, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] },
    { timeout: 20_000 },
  );
  recordAiUsage({ userId: params.userId, model, kind: "ai_text", usage: completion.usage, relatedEntityType: "change_order_draft" });
  return parseDraft(completion.choices[0]?.message?.content ?? "{}");
}
