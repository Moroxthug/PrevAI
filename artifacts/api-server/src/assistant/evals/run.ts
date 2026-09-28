// APP-8h — runs the assistant's test set against the real model.
//
//   pnpm --filter @workspace/api-server eval:assistant [--model gpt-4o] [--only tag|id,…] [--concurrency 4] [--repeat 1] [--min 0.85]
//
// Needs GROQ_API_KEY (the dev key in .env is enough); no database: each case
// gets the same system prompt and tool list the app would send for that role
// and screen (made-up company and ids), one call to the model, and — when the
// case has `after` — the made-up tool result and one more call. Nothing runs:
// only the tool the model reaches for is recorded.
//
// Writes .qa/assistant-evals/<date>-<model>.json and .md; exit 1 when any wrong
// action, 2 when accuracy is under --min. `--model` takes "gpt-4o" (what the
// app asks for: the Groq client turns it into openai/gpt-oss-120b) or a Groq
// model id to compare (openai/gpt-oss-20b, qwen/qwen3.6-27b…).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AssistantEvalCase } from "./cases.js";
import type { CaseRun, Move } from "./grade.js";

// Like vitest.setup.ts: only what module loading checks. Nothing is queried or decrypted.
process.env.DATABASE_URL ??= "postgres://eval@127.0.0.1:1/none?sslmode=disable";
process.env.BETTER_AUTH_SECRET ??= "eval-secret-not-for-production-use-0000";
process.env.TOKEN_ENCRYPTION_KEY ??= "0".repeat(64);
if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
  console.error("Serve GROQ_API_KEY (per esempio: node --env-file=../../.env …).");
  process.exit(3);
}

const { openai } = await import("@workspace/integrations-openai-ai-server");
const { assistantSystemPrompt } = await import("../service.js");
const { levelsFor, toolsFor } = await import("../permissions.js");
const { TOOL_DEFINITIONS } = await import("../tools.js");
const { aiUsageCostCents } = await import("../../lib/usage.js");
const { ASSISTANT_EVAL_SET } = await import("./cases-app8h.js");
const { gradeCase, summarize } = await import("./grade.js");
const { NO_TOOL } = await import("./cases.js");

type Msg = Parameters<typeof openai.chat.completions.create>[0]["messages"][number];

const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : dflt;
};
const MODEL = opt("model", "gpt-4o");
const ONLY = opt("only", "").split(",").filter(Boolean);
const CONCURRENCY = Math.max(1, Number(opt("concurrency", "4")));
const REPEAT = Math.max(1, Number(opt("repeat", "1")));
const MIN = Number(opt("min", "0"));

// ── The made-up company and screens ──────────────────────────────────────────

const JOB_ID = "7d0c1a2e-0000-4000-8000-000000000001";
const JOB_BLOCK = `\nCantiere corrente (gli strumenti lo usano come default): id ${JOB_ID} — "Rifacimento bagno via Roma 12" per Luca Neri, stato active, 40% completato, 2026-09-14 → 2026-10-31, valore 9800.00 EUR IVA inclusa.`;
const hint = (where: string, job: boolean) => `\nIn questo momento l'utente sta guardando ${where}. Quando dice "questo", "qui" o non nomina altro, intende questo${job ? "; gli strumenti usano questo cantiere come default" : ""}.`;
const SCREENS: Record<NonNullable<AssistantEvalCase["screen"]>, { line: string; job: boolean }> = {
  home: { line: "", job: false },
  job: { line: hint(`il cantiere id ${JOB_ID} — "Rifacimento bagno via Roma 12" per Luca Neri, stato active, 40% completato, 2026-09-14 → 2026-10-31`, true), job: true },
  quote: { line: hint(`il preventivo id 5a1b2c3d-0000-4000-8000-000000000014 (14/2026) per Marco Venturi, totale 8.540,00 € IVA inclusa, pronto — "Ristrutturazione cucina: demolizioni, impianti, piastrelle e mobili"`, false), job: false },
  invoice: { line: hint(`la fattura id 9e8f7a6b-0000-4000-8000-000000000007 (2026-0007) a Luca Neri, totale 3.050,00 €, incassati 0,00 €, stato sent, scadenza 2026-10-10`, true), job: true },
  leads: { line: hint("la pagina con le richieste", false), job: false },
};

function setup(c: AssistantEvalCase) {
  const screen = SCREENS[c.screen ?? "home"];
  const levels = levelsFor(c.role ?? "owner", [], true);
  const tools = toolsFor(TOOL_DEFINITIONS, levels);
  const system = assistantSystemPrompt({ company: "Edilizia Prova Srl", province: "BG", today: "2026-09-28", jobBlock: screen.job ? JOB_BLOCK : "", screenLine: screen.line, levels });
  return { tools, messages: [{ role: "system", content: system }, { role: "user", content: c.say }] as Msg[] };
}

// ── One call ─────────────────────────────────────────────────────────────────

type CallOut = { move: Move; call?: { id: string; name: string; arguments: string }; ms: number; model: string; prompt: number; completion: number };

function refused(err: unknown): string | null {
  const e = err as { code?: string; error?: { code?: string; failed_generation?: string }; message?: string } | null;
  if (e?.code !== "tool_use_failed" && e?.error?.code !== "tool_use_failed") return null;
  const text = `${e?.error?.failed_generation ?? ""} ${e?.message ?? ""}`;
  return /"name"\s*:\s*"(\w+)"/.exec(text)?.[1] ?? /\b(propose_\w+|find|brief_me|open_screen|get_\w+|list_\w+)\b/.exec(text)?.[1] ?? "?";
}

async function call(messages: Msg[], tools: ReturnType<typeof setup>["tools"]): Promise<CallOut> {
  const body: { messages: Msg[] } & Record<string, unknown> = { model: MODEL, temperature: 0.2, max_completion_tokens: 1200, messages, tools, tool_choice: "auto" as const, ...(MODEL.includes("gpt-oss") ? { reasoning_effort: "low" as const } : {}) };
  const t0 = performance.now();
  let retried = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await openai.chat.completions.create(body as unknown as Parameters<typeof openai.chat.completions.create>[0], { timeout: 60_000 });
      const r = res as Awaited<ReturnType<typeof openai.chat.completions.create>> & { choices: { message: { tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]; usage?: { prompt_tokens: number; completion_tokens: number }; model: string };
      const tc = r.choices[0]?.message.tool_calls?.[0];
      return {
        move: { tool: tc?.function.name ?? NO_TOOL, ...(retried ? { retried: true } : {}) },
        call: tc ? { id: tc.id, name: tc.function.name, arguments: tc.function.arguments } : undefined,
        ms: Math.round(performance.now() - t0),
        model: r.model,
        prompt: r.usage?.prompt_tokens ?? 0,
        completion: r.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      const tool = refused(err);
      // As the app does (service.ts): a badly formed call to a tool it has gets one more try, told what was wrong.
      const offered = tools.some((t) => t.type === "function" && t.function.name === tool);
      if (tool && offered && !retried) {
        retried = true;
        body.messages = [...messages, { role: "system", content: `La chiamata a ${tool} aveva argomenti non validi. Riprova: ometti i campi che non conosci e usa solo i valori ammessi dallo schema.` }];
        continue;
      }
      if (tool) {
        const e = err as { error?: { failed_generation?: string }; message?: string };
        return { move: { tool, refused: true, detail: String(e.error?.failed_generation ?? e.message ?? "").slice(0, 300) }, ms: Math.round(performance.now() - t0), model: MODEL, prompt: 0, completion: 0 };
      }
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < 4) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
      throw err;
    }
  }
}

async function runCase(c: AssistantEvalCase): Promise<CaseRun> {
  const { tools, messages } = setup(c);
  const base = { id: c.id, tag: c.tag ?? "altro" };
  try {
    const first = await call(messages, tools);
    let then: CallOut | null = null;
    if (c.after && first.call && first.call.name === c.first) {
      const next: Msg[] = [
        ...messages,
        { role: "assistant", content: null, tool_calls: [{ id: first.call.id, type: "function", function: { name: first.call.name, arguments: first.call.arguments } }] },
        { role: "tool", tool_call_id: first.call.id, content: JSON.stringify(c.after.result) },
      ];
      then = await call(next, tools);
    }
    const model = first.model;
    const promptTokens = first.prompt + (then?.prompt ?? 0);
    const completionTokens = first.completion + (then?.completion ?? 0);
    return { ...base, model, grade: gradeCase(c, first.move, then?.move ?? null), first: first.move, then: then?.move ?? null, ms: first.ms + (then?.ms ?? 0), firstMs: first.ms, promptTokens, completionTokens, costUsdCents: aiUsageCostCents(model, { prompt_tokens: promptTokens, completion_tokens: completionTokens }) };
  } catch (err) {
    const first: Move = { tool: "errore" };
    return { ...base, model: MODEL, grade: gradeCase(c, first, null), first, then: null, ms: 0, firstMs: 0, promptTokens: 0, completionTokens: 0, costUsdCents: 0, error: (err as Error).message.slice(0, 200) };
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────

const cases = ASSISTANT_EVAL_SET.filter((c) => !ONLY.length || ONLY.includes(c.id) || ONLY.includes(c.tag ?? ""));
const queue = Array.from({ length: REPEAT }, () => cases).flat();
const runs: CaseRun[] = [];
let done = 0;
const started = Date.now();
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const r = await runCase(c);
      runs.push(r);
      done++;
      if (!r.grade.right) console.log(`  ✗ ${r.id}: ${r.error ?? `${r.first.tool}${r.then ? ` → ${r.then.tool}` : ""}`}${r.grade.wrongAction ? `  AZIONE SBAGLIATA (${r.grade.wrongTools.join(", ")})` : ""}`);
      if (done % 20 === 0) console.log(`  … ${done}/${cases.length * REPEAT}`);
    }
  }),
);

const actualModel = runs.find((r) => !r.error)?.model ?? MODEL;
const report = summarize(actualModel, runs, cases);
const eur = (usdCents: number) => `${((usdCents * 0.86) / 100).toFixed(5)} €`;
const md = [
  `# Prove dell'assistente — ${actualModel} (${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC)`,
  "",
  `Casi: **${report.cases}** · giusti: **${report.right}** (${(report.accuracy * 100).toFixed(1)} %) · **azioni sbagliate: ${report.wrongActions}** · rifiutati da Groq: ${report.refused} · errori: ${report.errors}`,
  `Latenza del primo passo: mediana ${report.latencyMs.p50} ms, 95° percentile ${report.latencyMs.p95} ms · ${report.tokensPerTurn} token e ${eur(report.costPerTurnUsdCents)} per turno (${report.costPerTurnUsdCents} centesimi di dollaro) · durata ${Math.round((Date.now() - started) / 1000)} s`,
  "",
  "| Gruppo | Casi | Giusti | Azioni sbagliate |",
  "|---|---|---|---|",
  ...Object.entries(report.byTag).sort().map(([t, v]) => `| ${t} | ${v.cases} | ${v.right} | ${v.wrongActions} |`),
  "",
  report.failures.length ? "## Sbagliati" : "Nessun caso sbagliato.",
  "",
  ...report.failures.map((f) => `- \`${f.id}\` atteso ${f.expected}, fatto ${f.got}${f.wrong.length ? ` — **azione sbagliata**: ${f.wrong.join(", ")}` : ""}`),
  "",
].join("\n");

const dir = join(process.cwd(), ".qa", "assistant-evals");
mkdirSync(dir, { recursive: true });
const stem = `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}-${actualModel.replace(/[^\w.-]+/g, "_")}`;
writeFileSync(join(dir, `${stem}.json`), JSON.stringify({ report, runs }, null, 2));
writeFileSync(join(dir, `${stem}.md`), md);
console.log(`\n${md}\nReport: ${join(dir, stem)}.{md,json}`);
process.exit(report.wrongActions > 0 ? 1 : report.accuracy < MIN ? 2 : 0);
