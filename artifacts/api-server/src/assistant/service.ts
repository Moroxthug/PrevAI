// Phase 5 — assistant conversation runner. One turn = user message →
// (model → tool calls → results)* → final answer. Every message is stored;
// propose_* calls become assistant_proposals rows the UI renders as cards.
// APP-8a: the model's answer is streamed (onEvent gets text as it is written
// and a line for each tool it runs), and the turn knows which screen the
// user is on (context.ts) — one conversation follows them around the app.
import { openai, type OpenAI } from "@workspace/integrations-openai-ai-server";
import {
  db,
  assistantConversationsTable,
  assistantMessagesTable,
  assistantProposalsTable,
  projectsTable,
  clientsTable,
  businessProfilesTable,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantProposal,
  type AssistantToolCall,
  assistantConversationActorsTable,
  assistantActionsTable,
  type AssistantActionRow,
  type TeamMemberRole,
} from "@workspace/db";
import { and, asc, desc, eq, isNull, inArray, or, type SQL } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { toIsoDate } from "../jobs/dates.js";
import { TOOL_DEFINITIONS, PROPOSAL_TOOLS, runReadTool, validateProposal, type ToolContext } from "./tools.js";
import { resolvePageContext, type PageContext } from "./context.js";
import { CompletionAccumulator, progressLabel, type TurnEvent } from "./stream.js";
import { assistantV2Ready, resolveLevels, toolsFor, permissionsParagraph, proposalOutcome, type AssistantLevels } from "./permissions.js";
import { runProposal, ProposalError } from "./apply.js";

export type Lang = "it";
const MAX_ROUNDS = 6;
const HISTORY_LIMIT = 40;
const MODEL = "gpt-4o";

// ── Conversations ────────────────────────────────────────────────────────────

/**
 * APP-8b — who is talking: the company (`orgId`, what every table is keyed by),
 * the person (`actorId`) and their role. With migration 0013 each person has
 * their own conversations; a thread with no owner row is the account owner's
 * (every thread from before APP-8b). Without it the company shares them, as before.
 */
export type Who = { orgId: string; actorId: string; role: TeamMemberRole };

/**
 * The conversations this person may open, newest first, narrowed by `extra`.
 * Before migration 0013 the owner table does not exist, so there is no join:
 * the company's conversations, as before APP-8b.
 */
async function myConversations(who: Who, extra: SQL | undefined, limit: number): Promise<(AssistantConversation & { projectName: string | null })[]> {
  const company = eq(assistantConversationsTable.userId, who.orgId);
  if (!(await assistantV2Ready())) {
    const rows = await db
      .select({ c: assistantConversationsTable, projectName: projectsTable.name })
      .from(assistantConversationsTable)
      .leftJoin(projectsTable, eq(projectsTable.id, assistantConversationsTable.projectId))
      .where(and(company, extra))
      .orderBy(desc(assistantConversationsTable.lastMessageAt))
      .limit(limit);
    return rows.map((r) => ({ ...r.c, projectName: r.projectName ?? null }));
  }
  const own = eq(assistantConversationActorsTable.actorUserId, who.actorId);
  // The owner also keeps every thread that has no owner row (all of them before APP-8b).
  const person = who.actorId === who.orgId ? or(own, isNull(assistantConversationActorsTable.conversationId)) : own;
  const rows = await db
    .select({ c: assistantConversationsTable, projectName: projectsTable.name })
    .from(assistantConversationsTable)
    .leftJoin(assistantConversationActorsTable, eq(assistantConversationActorsTable.conversationId, assistantConversationsTable.id))
    .leftJoin(projectsTable, eq(projectsTable.id, assistantConversationsTable.projectId))
    .where(and(company, person, extra))
    .orderBy(desc(assistantConversationsTable.lastMessageAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.c, projectName: r.projectName ?? null }));
}

export async function getOrCreateConversation(who: Who, projectId: string | null): Promise<AssistantConversation> {
  const [existing] = await myConversations(who, projectId ? eq(assistantConversationsTable.projectId, projectId) : isNull(assistantConversationsTable.projectId), 1);
  if (existing) return existing;
  const [created] = await db.insert(assistantConversationsTable).values({ userId: who.orgId, projectId, title: "" }).returning();
  if (await assistantV2Ready()) await db.insert(assistantConversationActorsTable).values({ conversationId: created!.id, userId: who.orgId, actorUserId: who.actorId });
  return created!;
}

export type LoadedConversation = { conversation: AssistantConversation; messages: AssistantMessage[]; proposals: AssistantProposal[]; actions: Map<string, AssistantActionRow> };

export async function loadConversation(who: Who, id: string): Promise<LoadedConversation | null> {
  const [conversation] = await myConversations(who, eq(assistantConversationsTable.id, id), 1);
  if (!conversation) return null;
  const [messages, proposals] = await Promise.all([
    db.select().from(assistantMessagesTable).where(eq(assistantMessagesTable.conversationId, id)).orderBy(asc(assistantMessagesTable.createdAt)).limit(400),
    db.select().from(assistantProposalsTable).where(eq(assistantProposalsTable.conversationId, id)).orderBy(asc(assistantProposalsTable.createdAt)),
  ]);
  return { conversation, messages, proposals, actions: await actionsFor(proposals.map((p) => p.id)) };
}

/** Every conversation of this person, newest first: the main one and the older per-job ones (APP-8a keeps them readable). */
export async function listConversations(who: Who): Promise<(AssistantConversation & { projectName: string | null })[]> {
  return myConversations(who, undefined, 50);
}

export async function clearConversation(who: Who, id: string): Promise<boolean> {
  const loaded = await loadConversation(who, id);
  if (!loaded) return false;
  await db.delete(assistantConversationsTable).where(and(eq(assistantConversationsTable.id, id), eq(assistantConversationsTable.userId, who.orgId)));
  return true;
}

/** The action rows (Lo fa / confirmed, undone) of some proposals; empty before migration 0013. */
export async function actionsFor(proposalIds: string[]): Promise<Map<string, AssistantActionRow>> {
  if (!proposalIds.length || !(await assistantV2Ready())) return new Map();
  const rows = await db.select().from(assistantActionsTable).where(inArray(assistantActionsTable.proposalId, proposalIds));
  return new Map(rows.map((r) => [r.proposalId, r]));
}

// ── System prompt ────────────────────────────────────────────────────────────

async function buildSystemPrompt(params: { userId: string; projectId: string | null; language: Lang; now: Date; screenLine: string; levels: AssistantLevels }): Promise<{ prompt: string; province: string | null }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, params.userId));
  const company = profile?.companyName || "the company";
  let province = profile?.province ?? null;
  let jobBlock = "";
  if (params.projectId) {
    const [p] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, params.projectId), eq(projectsTable.userId, params.userId)));
    if (p) {
      province = p.province ?? province;
      const client = p.clientId ? (await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, p.clientId)))[0] : null;
      jobBlock = `\nCantiere corrente (gli strumenti lo usano come default): id ${p.id} — "${p.name}"${client ? ` per ${client.name}` : ""}, stato ${p.status}, ${p.progressPercent}% completato, ${toIsoDate(p.plannedStart ?? p.startDate) ?? "?"} → ${toIsoDate(p.plannedEnd ?? p.endDate) ?? "?"}, valore ${((p.contractValueCents + p.changeOrdersCents) / 100).toFixed(2)} EUR IVA inclusa.`;
    }
  }
  const langLine = "Rispondi sempre in italiano.";
  const prompt = `Sei l'assistente di cantiere dentro PrevAI, un'app di gestione lavori edili usata da ${company}, impresa italiana${province ? ` con sede in provincia di ${province}` : ""}. Oggi è ${toIsoDate(params.now)}.
${langLine}
${jobBlock}${params.screenLine}

Aiuti l'impresa a gestire i cantieri: cronoprogramma, budget vs costi, ore, fatture e cassa. Usa gli strumenti per consultare i dati prima di rispondere — non inventare mai cifre. Gli importi sono in EUR; precisa se una cifra è IVA esclusa o inclusa quando conta.

${permissionsParagraph(params.levels)}

Sii conciso: paragrafi brevi o elenchi puntati, niente titoli, niente riempitivi. Quando noti un rischio (budget superato, milestone in ritardo, lavori non fatturati, fattura scaduta) segnalalo una volta con il numero a supporto.`;
  return { prompt, province };
}

// ── History → OpenAI messages ────────────────────────────────────────────────

function toOpenAiMessages(rows: AssistantMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  for (const m of rows) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "assistant") {
      if (m.toolCalls && m.toolCalls.length) out.push({ role: "assistant", content: m.content || null, tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.arguments } })) });
      else out.push({ role: "assistant", content: m.content });
    } else if (m.role === "tool" && m.toolCallId) out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
  }
  // A tool message whose assistant turn fell outside the window would break the API — drop leading orphans.
  while (out.length && out[0]!.role === "tool") out.shift();
  return out;
}

// ── Turn ─────────────────────────────────────────────────────────────────────

export type TurnResult = { messages: AssistantMessage[]; proposals: AssistantProposal[]; actions: Map<string, AssistantActionRow> };

/** One call to the model, streamed: text goes out as it is written, tool calls are collected. */
async function streamRound(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], tools: OpenAI.Chat.Completions.ChatCompletionTool[], noTools: boolean, signal: AbortSignal | undefined, emit: (e: TurnEvent) => void): Promise<CompletionAccumulator> {
  const stream = await openai.chat.completions.create(
    { model: MODEL, temperature: 0.2, max_completion_tokens: 1200, messages, tools, tool_choice: noTools ? "none" : "auto", stream: true },
    { timeout: 45_000, signal },
  );
  const acc = new CompletionAccumulator();
  for await (const chunk of stream) {
    const piece = acc.push(chunk.choices[0]?.delta as Parameters<CompletionAccumulator["push"]>[0]);
    if (piece) emit({ type: "delta", text: piece });
  }
  return acc;
}

/** Groq's answer when the model calls a tool that was not in the request (a "Mai" one). */
function isRefusedToolCall(err: unknown): boolean {
  const e = err as { code?: string; error?: { code?: string } } | null;
  return e?.code === "tool_use_failed" || e?.error?.code === "tool_use_failed";
}

export async function runAssistantTurn(params: { conversation: AssistantConversation; who: Who; content: string; language: Lang; context?: PageContext | null; onEvent?: (e: TurnEvent) => void; signal?: AbortSignal; now?: Date; ip?: string | null }): Promise<TurnResult> {
  const now = params.now ?? new Date();
  const emit = params.onEvent ?? (() => {});
  const conv = params.conversation;
  const userId = params.who.orgId;
  const newMessages: AssistantMessage[] = [];
  const newProposals: AssistantProposal[] = [];
  const newActions = new Map<string, AssistantActionRow>();

  const insertMessage = async (values: Omit<typeof assistantMessagesTable.$inferInsert, "conversationId" | "userId">) => {
    const [row] = await db.insert(assistantMessagesTable).values({ conversationId: conv.id, userId, ...values }).returning();
    newMessages.push(row!);
    emit({ type: "message", message: row! });
    return row!;
  };

  await insertMessage({ role: "user", content: params.content });
  if (!conv.title) await db.update(assistantConversationsTable).set({ title: params.content.slice(0, 80) }).where(eq(assistantConversationsTable.id, conv.id));

  // The screen wins over the conversation's own job: in a job's old thread, asking from another job's page means that job.
  const screen = await resolvePageContext(userId, params.context);
  const projectId = screen.projectId ?? conv.projectId;
  const { ready, levels } = await resolveLevels(userId, params.who.role);
  const tools = toolsFor(TOOL_DEFINITIONS, levels);
  const { prompt, province } = await buildSystemPrompt({ userId, projectId, language: params.language, now, screenLine: screen.line, levels });
  const ctx: ToolContext = { userId, projectId, province, now };
  const history = await db.select().from(assistantMessagesTable).where(eq(assistantMessagesTable.conversationId, conv.id)).orderBy(desc(assistantMessagesTable.createdAt)).limit(HISTORY_LIMIT);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: prompt }, ...toOpenAiMessages(history.reverse())];

  let noTools = false;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const lastRound = round === MAX_ROUNDS - 1 || noTools;
    let acc: CompletionAccumulator;
    try {
      acc = await streamRound(messages, tools, lastRound, params.signal, emit);
    } catch (err) {
      // APP-8b: after an action is set to "Mai", the model may still reach for the tool it used earlier in
      // the thread; Groq then refuses the whole answer (tool_use_failed). Once per turn: say why, answer without tools.
      if (noTools || !isRefusedToolCall(err)) throw err;
      noTools = true;
      messages.push({ role: "system", content: "Lo strumento che hai provato a usare non è disponibile per questa persona. Rispondi senza strumenti: di' in una riga che questa azione non è disponibile e suggerisci di farla dalla schermata o di chiedere al titolare." });
      acc = await streamRound(messages, tools, true, params.signal, emit);
    }
    const calls = acc.toolCalls();
    if (!calls.length) {
      const text = acc.text.trim() || "Non ho nulla da aggiungere.";
      await insertMessage({ role: "assistant", content: text });
      break;
    }
    const stored: AssistantToolCall[] = calls.map((c) => ({ id: c.id, name: c.name, arguments: c.arguments }));
    const assistantRow = await insertMessage({ role: "assistant", content: acc.text, toolCalls: stored });
    messages.push({ role: "assistant", content: acc.text || null, tool_calls: calls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.arguments } })) });

    for (const call of calls) {
      emit({ type: "progress", tool: call.name, label: progressLabel(call.name) });
      let args: unknown;
      try { args = call.arguments ? JSON.parse(call.arguments) : {}; } catch { args = {}; }
      let result: unknown;
      const kind = PROPOSAL_TOOLS[call.name];
      try {
        if (kind) {
          const outcome = proposalOutcome(levels[kind], ready);
          // A "never" tool is not offered to the model; if it calls one anyway, nothing is stored.
          const v = outcome === "reject" ? null : await validateProposal(call.name, args, ctx);
          if (!v) result = { error: "Questa azione non è disponibile per questa persona." };
          else if (v.ok) {
            const [row] = await db.insert(assistantProposalsTable).values({ conversationId: conv.id, messageId: assistantRow.id, userId, projectId: v.proposal.projectId, kind: v.proposal.kind, summary: v.proposal.summary, payload: v.proposal.payload, status: "pending" }).returning();
            if (outcome === "run") {
              // "Lo fa": the same code as the Conferma button, recorded with level "auto".
              try {
                const done = await runProposal({ proposal: row!, who: params.who, level: "auto", ip: params.ip ?? null });
                newProposals.push(done.proposal);
                if (done.action) newActions.set(done.proposal.id, done.action);
                emit({ type: "proposal", proposal: done.proposal, action: done.action });
                result = { proposal_id: row!.id, status: "done", summary: v.proposal.summary, note: "Already done; the card shows the details and an Annulla button. Reply with one short sentence, once." };
              } catch (err) {
                const [failed] = await db.select().from(assistantProposalsTable).where(eq(assistantProposalsTable.id, row!.id));
                newProposals.push(failed ?? row!);
                emit({ type: "proposal", proposal: failed ?? row! });
                result = { error: err instanceof ProposalError ? err.message : "Non sono riuscito a farlo." };
              }
            } else {
              newProposals.push(row!);
              emit({ type: "proposal", proposal: row! });
              result = { proposal_id: row!.id, status: "pending_confirmation", summary: v.proposal.summary, note: "The user sees a card and must confirm. Do not say this was done." };
            }
          } else result = { error: v.error };
        } else {
          result = await runReadTool(call.name, args, ctx);
        }
      } catch (err) {
        logger.warn({ err, tool: call.name }, "assistant tool failed");
        result = { error: (err as Error).message };
      }
      const content = JSON.stringify(result).slice(0, 24_000);
      await insertMessage({ role: "tool", content, toolCallId: call.id, toolName: call.name });
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }

  await db.update(assistantConversationsTable).set({ lastMessageAt: new Date() }).where(eq(assistantConversationsTable.id, conv.id));
  return { messages: newMessages, proposals: newProposals, actions: newActions };
}

export async function proposalsByIds(userId: string, ids: string[]): Promise<AssistantProposal[]> {
  if (!ids.length) return [];
  return db.select().from(assistantProposalsTable).where(and(eq(assistantProposalsTable.userId, userId), inArray(assistantProposalsTable.id, ids)));
}
