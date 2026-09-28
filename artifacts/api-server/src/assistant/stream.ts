// APP-8a — streamed turns. The model's answer arrives in chunks; this file
// puts the chunks back together (text + tool calls, which also arrive in
// pieces) and names what the assistant is doing while a tool runs, so the
// screen can say "Guardo il cantiere…" instead of three dots.
import type { AssistantMessage, AssistantProposal } from "@workspace/db";

/** What the server sends while a turn runs (one SSE event each). */
export type TurnEvent =
  | { type: "progress"; tool: string; label: string }
  | { type: "delta"; text: string }
  | { type: "message"; message: AssistantMessage }
  | { type: "proposal"; proposal: AssistantProposal };

export type StreamedCall = { id: string; name: string; arguments: string };

type ChunkDelta = {
  content?: string | null;
  tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
};

/** Accumulates one streamed completion. Tool calls come as fragments keyed by `index`. */
export class CompletionAccumulator {
  text = "";
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
};

export function progressLabel(tool: string): string {
  if (LABELS[tool]) return LABELS[tool]!;
  if (tool.startsWith("propose_")) return "Preparo la proposta";
  return "Controllo i dati";
}

/** One SSE frame. `data` is JSON on a single line, as the spec wants. */
export function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
