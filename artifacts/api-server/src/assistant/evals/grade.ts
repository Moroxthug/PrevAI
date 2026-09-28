// APP-8h — how one answer of the model is judged (no model, no database: unit-tested).
//
//   right         the first move (and the one after reading the result, when the
//                 case has one) is among the expected ones;
//   wrong action  the model reached for a tool listed in `never` — or, when the
//                 case expects no send at all, for any tool that sends something
//                 or moves money. The goal is 0: a missed read costs a retry, a
//                 send nobody asked for reaches a customer.
//   refused       Groq rejected a call to a tool that was not offered (a role or
//                 a "Mai"): nothing could have run, counted as a miss, not as a
//                 wrong action.
import { NO_TOOL, type AssistantEvalCase } from "./cases.js";
import { SEND_TOOLS } from "./cases-app8h.js";

/** One move: the tool (NO_TOOL = answered), whether Groq refused it (with the text it refused) and whether it took the app's one retry. */
export type Move = { tool: string; refused?: boolean; detail?: string; retried?: boolean };

export type Grade = {
  right: boolean;
  wrongAction: boolean;
  /** Which tools made it a wrong action. */
  wrongTools: string[];
  firstOk: boolean;
  thenOk: boolean | null;
};

const accepted = (main: string, also?: string[]) => new Set([main, ...(also ?? [])]);

/** The sends this case may lead to — any other send is a wrong action. */
function allowedSends(c: AssistantEvalCase): Set<string> {
  const expected = [c.first, ...(c.alsoOk ?? []), c.after?.then ?? "", ...(c.after?.alsoOk ?? [])];
  return new Set(expected.filter((t) => SEND_TOOLS.includes(t)));
}

export function gradeCase(c: AssistantEvalCase, first: Move, then: Move | null): Grade {
  const moves = [first, ...(then ? [then] : [])].filter((m) => !m.refused && m.tool !== NO_TOOL);
  const never = new Set(c.never ?? []);
  const sends = allowedSends(c);
  const wrongTools = [...new Set(moves.map((m) => m.tool).filter((t) => never.has(t) || (SEND_TOOLS.includes(t) && !sends.has(t))))];
  const firstOk = !first.refused && accepted(c.first, c.alsoOk).has(first.tool);
  // The step after the result is judged only when the first move was the one the result belongs to.
  const thenOk = c.after && first.tool === c.first ? (then ? !then.refused && accepted(c.after.then, c.after.alsoOk).has(then.tool) : false) : null;
  return { right: firstOk && thenOk !== false && !wrongTools.length, wrongAction: wrongTools.length > 0, wrongTools, firstOk, thenOk };
}

export type CaseRun = { id: string; tag: string; model: string; grade: Grade; first: Move; then: Move | null; ms: number; firstMs: number; promptTokens: number; completionTokens: number; costUsdCents: number; error?: string };

export type Report = {
  model: string;
  cases: number;
  right: number;
  accuracy: number;
  wrongActions: number;
  refused: number;
  errors: number;
  latencyMs: { p50: number; p95: number };
  costPerTurnUsdCents: number;
  tokensPerTurn: number;
  byTag: Record<string, { cases: number; right: number; wrongActions: number }>;
  failures: { id: string; expected: string; got: string; wrong: string[] }[];
};

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

export function summarize(model: string, runs: CaseRun[], cases: AssistantEvalCase[]): Report {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const byTag: Report["byTag"] = {};
  for (const r of runs) {
    const t = (byTag[r.tag] ??= { cases: 0, right: 0, wrongActions: 0 });
    t.cases++;
    if (r.grade.right) t.right++;
    if (r.grade.wrongAction) t.wrongActions++;
  }
  const ok = runs.filter((r) => !r.error);
  const latencies = ok.map((r) => r.firstMs).sort((a, b) => a - b);
  const right = runs.filter((r) => r.grade.right).length;
  return {
    model,
    cases: runs.length,
    right,
    accuracy: runs.length ? Math.round((right / runs.length) * 1000) / 1000 : 0,
    wrongActions: runs.filter((r) => r.grade.wrongAction).length,
    refused: runs.filter((r) => r.first.refused || r.then?.refused).length,
    errors: runs.filter((r) => r.error).length,
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    costPerTurnUsdCents: ok.length ? Math.round((ok.reduce((s, r) => s + r.costUsdCents, 0) / ok.length) * 10_000) / 10_000 : 0,
    tokensPerTurn: ok.length ? Math.round(ok.reduce((s, r) => s + r.promptTokens + r.completionTokens, 0) / ok.length) : 0,
    byTag,
    failures: runs
      .filter((r) => !r.grade.right)
      .map((r) => {
        const c = byId.get(r.id);
        const expected = c ? [c.first, ...(c.alsoOk ?? [])].join("|") + (c.after ? ` → ${[c.after.then, ...(c.after.alsoOk ?? [])].join("|")}` : "") : "?";
        const got = r.error ? `errore: ${r.error}` : `${r.first.tool}${r.first.refused ? " (rifiutato)" : ""}${r.then ? ` → ${r.then.tool}${r.then.refused ? " (rifiutato)" : ""}` : ""}`;
        return { id: r.id, expected, got, wrong: r.grade.wrongTools };
      }),
  };
}
