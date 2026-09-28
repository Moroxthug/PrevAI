// APP-8a — streamed turns. The model's answer arrives in chunks; this file
// puts the chunks back together (text + tool calls, which also arrive in
// pieces) and names what the assistant is doing while a tool runs, so the
// screen can say "Guardo il cantiere…" instead of three dots.
import type { AssistantActionRow, AssistantMessage, AssistantProposal } from "@workspace/db";

/** What the server sends while a turn runs (one SSE event each). */
export type TurnEvent =
  | { type: "progress"; tool: string; label: string }
  | { type: "delta"; text: string }
  | { type: "message"; message: AssistantMessage }
  | { type: "proposal"; proposal: AssistantProposal; action?: AssistantActionRow | null }
  // APP-8c: open_screen — the app goes to this page.
  | { type: "navigate"; path: string; label: string };

/** APP-8h: usage_events.related_entity_type of the assistant's tokens (activity.ts adds them up per company). */
export const ASSISTANT_USAGE_ENTITY = "assistant_turn";

export type TokenUsage = { prompt_tokens: number; completion_tokens: number };

/** APP-8h: where a streamed chunk carries the token count — `usage` (OpenAI, stream_options) or `x_groq.usage` (Groq). */
export function chunkUsage(chunk: { usage?: Partial<TokenUsage> | null; x_groq?: { usage?: Partial<TokenUsage> | null } | null }): TokenUsage | null {
  const u = chunk.usage ?? chunk.x_groq?.usage;
  if (!u || (u.prompt_tokens == null && u.completion_tokens == null)) return null;
  return { prompt_tokens: u.prompt_tokens ?? 0, completion_tokens: u.completion_tokens ?? 0 };
}

/** Adds up the tokens of every round of a turn. */
export function addUsage(a: TokenUsage | null, b: TokenUsage | null): TokenUsage | null {
  if (!a) return b;
  if (!b) return a;
  return { prompt_tokens: a.prompt_tokens + b.prompt_tokens, completion_tokens: a.completion_tokens + b.completion_tokens };
}

export type StreamedCall = { id: string; name: string; arguments: string };

type ChunkDelta = {
  content?: string | null;
  tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
};

/** Accumulates one streamed completion. Tool calls come as fragments keyed by `index`. */
export class CompletionAccumulator {
  text = "";
  /** APP-8h: the tokens of this call (the last chunk carries them) and the model that answered. */
  usage: TokenUsage | null = null;
  model: string | null = null;
  private calls = new Map<number, StreamedCall>();

  /** Returns the text added by this chunk ("" if none), so the caller can forward it. */
  push(delta: ChunkDelta | undefined | null): string {
    if (!delta) return "";
    for (const tc of delta.tool_calls ?? []) {
      const cur = this.calls.get(tc.index) ?? { id: "", name: "", arguments: "" };
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) cur.name += tc.function.name;
      if (tc.function?.arguments) cur.arguments += tc.function.arguments;
      this.calls.set(tc.index, cur);
    }
    const piece = delta.content ?? "";
    this.text += piece;
    return piece;
  }

  toolCalls(): StreamedCall[] {
    return [...this.calls.entries()].sort((a, b) => a[0] - b[0]).map(([i, c]) => ({ ...c, id: c.id || `call_${i}` })).filter((c) => c.name);
  }
}

const LABELS: Record<string, string> = {
  get_job_summary: "Guardo il cantiere",
  list_jobs: "Guardo i cantieri",
  list_costs: "Guardo i costi",
  list_invoices: "Guardo le fatture",
  list_time_entries: "Guardo le ore",
  get_schedule_risks: "Controllo il cronoprogramma",
  get_company_overview: "Guardo i numeri dell'impresa",
  brief_me: "Preparo il riepilogo",
  find: "Cerco",
  get_quote: "Leggo il preventivo",
  open_screen: "Apro la schermata",
  propose_draft_quote: "Scrivo la bozza del preventivo",
  propose_send_quote: "Preparo l'invio del preventivo",
  propose_send_contract: "Preparo l'invio del contratto",
  propose_reply_lead: "Preparo il messaggio",
  propose_message_client: "Scrivo l'email",
  propose_update_client: "Preparo la modifica del cliente",
  propose_job_note: "Scrivo la nota",
  propose_call: "Cerco il numero",
};

export function progressLabel(tool: string): string {
  if (LABELS[tool]) return LABELS[tool]!;
  if (tool.startsWith("propose_")) return "Preparo la proposta";
  return "Controllo i dati";
}

/** APP-8c: the tool a refused generation tried to call, if Groq says. */
export function failedToolName(err: unknown): string | null {
  const e = err as { error?: { failed_generation?: string } } | null;
  const g = e?.error?.failed_generation;
  if (typeof g !== "string") return null;
  return /"name"\s*:\s*"([\w-]+)"/.exec(g)?.[1] ?? null;
}

/** APP-8c: optional arguments may arrive as null (the schemas allow it); the tools want them left out. */
export function dropNulls(args: unknown): unknown {
  if (!args || typeof args !== "object" || Array.isArray(args)) return args;
  return Object.fromEntries(Object.entries(args as Record<string, unknown>).filter(([, v]) => v !== null));
}

/** One SSE frame. `data` is JSON on a single line, as the spec wants. */
export function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
