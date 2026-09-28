// Thin fetch client for the Phase 5 assistant endpoints.
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";
import type { AssistantAction, AssistantLevel } from "@workspace/config";

export type AssistantRole = "user" | "assistant" | "tool";
export type ProposalKind = "cost_entry" | "milestone_update" | "task" | "invoice" | "record_payment" | "send_invoice"
  // APP-8c
  | "draft_quote" | "send_quote" | "send_contract" | "reply_lead" | "message_client" | "update_client" | "job_note"
  // APP-8g
  | "call";
export type ProposalStatus = "pending" | "confirmed" | "dismissed" | "failed" | "undone";

export type AssistantMessageDto = {
  id: string;
  role: AssistantRole;
  content: string;
  toolCalls: { id: string; name: string }[] | null;
  toolCallId: string | null;
  toolName: string | null;
  createdAt: string;
};

export type ProposalDto = {
  /** APP-8b: it ran by itself ("Lo fa"), and until when Annulla works (null = it can't be undone). */
  auto: boolean;
  undoUntil: string | null;
  id: string;
  messageId: string | null;
  projectId: string | null;
  kind: ProposalKind;
  summary: string;
  payload: Record<string, unknown>;
  status: ProposalStatus;
  resultEntityType: string | null;
  resultEntityId: string | null;
  error: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type ConversationDto = { conversation: { id: string; projectId: string | null; title: string }; messages: AssistantMessageDto[]; proposals: ProposalDto[] };
export type TurnDto = { messages: AssistantMessageDto[]; proposals: ProposalDto[] };
export type ThreadDto = { id: string; projectId: string | null; projectName: string | null; title: string; lastMessageAt: string };

/** APP-8a: the screen the question is asked from (lib/assistant-context.ts). The server checks every id. */
export type PageContextDto = { path: string; projectId?: string | null; quoteId?: string | null; invoiceId?: string | null };

/** What a streamed turn sends, one at a time (routes/assistant.ts). */
export type TurnEventDto =
  | { type: "progress"; label: string }
  | { type: "delta"; text: string }
  | { type: "message"; message: AssistantMessageDto }
  | { type: "proposal"; proposal: ProposalDto }
  // APP-8c: open_screen — the app goes to this page once the answer is over.
  | { type: "navigate"; path: string; label: string };

/** APP-8b: one saved choice of Impostazioni → Assistente (role "" = the whole company). */
export type AssistantSettingDto = { action: AssistantAction; role: "" | "admin" | "office" | "foreman" | "bookkeeper" | "viewer"; level: AssistantLevel };
export type AssistantPermissionsDto = { available: boolean; settings: AssistantSettingDto[]; voiceConfirmMaxCents: number; mine: Record<AssistantAction, AssistantLevel>; canEdit: boolean; roleLimits: Record<Exclude<AssistantSettingDto["role"], "">, AssistantAction[]> };

/** APP-8h: one action of the assistant in Impostazioni → Assistente → Attività. */
export type ActivityItemDto = {
  id: string;
  proposalId: string;
  kind: ProposalKind;
  label: string;
  summary: string;
  level: "auto" | "ask";
  status: "done" | "undone";
  executedAt: string;
  undoneAt: string | null;
  undoUntil: string | null;
  actor: { id: string; name: string; mine: boolean };
  link: string | null;
};
export type ActivityDto = { available: boolean; everyone: boolean; items: ActivityItemDto[]; next: string | null };
export type AssistantUsageDto = { from: string; turns: number; tokens: number; voiceMinutes: number; voiceMinutesIncluded: number | null; seats: number };

export const assistantApi = {
  conversation: (projectId: string | null) => req<ConversationDto>(`/api/assistant/conversation${projectId ? `?projectId=${projectId}` : ""}`),
  byId: (id: string) => req<ConversationDto>(`/api/assistant/conversations/${id}`),
  threads: () => req<{ conversations: ThreadDto[] }>("/api/assistant/conversations"),
  send: (conversationId: string, content: string, language: "it", context?: PageContextDto | null) =>
    req<TurnDto>(`/api/assistant/conversations/${conversationId}/messages`, { method: "POST", body: json({ content, language, context }) }),
  clear: (conversationId: string) => req<{ success: true }>(`/api/assistant/conversations/${conversationId}`, { method: "DELETE" }),
  /** APP-8f: via "voice" = the person said "sì" (refused with 409 above the owner's threshold: the card stays). */
  confirm: (proposalId: string, via: "tap" | "voice" = "tap") => req<{ proposal: ProposalDto; link: string | null }>(`/api/assistant/proposals/${proposalId}/confirm`, { method: "POST", body: json({ via }) }),
  dismiss: (proposalId: string) => req<{ proposal: ProposalDto }>(`/api/assistant/proposals/${proposalId}/dismiss`, { method: "POST" }),
  undo: (proposalId: string) => req<{ proposal: ProposalDto }>(`/api/assistant/proposals/${proposalId}/undo`, { method: "POST" }),
  permissions: () => req<AssistantPermissionsDto>("/api/assistant/permissions"),
  savePermissions: (settings: AssistantSettingDto[], voiceConfirmMaxCents?: number) => req<AssistantPermissionsDto>("/api/assistant/permissions", { method: "PUT", body: json({ settings, voiceConfirmMaxCents }) }),
  stream: streamTurn,
  activity: (before?: string | null) => req<ActivityDto>(`/api/assistant/activity${before ? `?before=${encodeURIComponent(before)}` : ""}`),
  usage: () => req<AssistantUsageDto>("/api/assistant/usage"),
};

/**
 * APP-8a — one turn, streamed. Calls `onEvent` for each thing the server
 * sends and resolves when the turn is over. A proxy that buffers the answer
 * (or a server without streaming) still works: every event arrives at the
 * end, in order. Rejects with `code` like the JSON client on a refusal
 * before the stream starts, and with the server's message on an `error` event.
 */
export async function streamTurn(conversationId: string, content: string, context: PageContextDto | null, onEvent: (e: TurnEventDto) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`/api/assistant/conversations/${conversationId}/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: json({ content, language: "it", context }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; requiredPlan?: string };
    const err = new Error(body.message || body.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
    err.code = body.error;
    err.status = res.status;
    throw err;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  const state = { failure: null as string | null, done: false };
  const handle = (frame: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return;
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(data.join("\n")) as Record<string, unknown>; } catch { return; }
    if (event === "delta") onEvent({ type: "delta", text: String(payload.text ?? "") });
    else if (event === "progress") onEvent({ type: "progress", label: String(payload.label ?? "") });
    else if (event === "message") onEvent({ type: "message", message: payload.message as AssistantMessageDto });
    else if (event === "proposal") onEvent({ type: "proposal", proposal: payload.proposal as ProposalDto });
    else if (event === "navigate" && typeof payload.path === "string" && payload.path.startsWith("/dashboard")) onEvent({ type: "navigate", path: payload.path, label: String(payload.label ?? "") });
    else if (event === "error") state.failure = String(payload.message ?? "L'assistente non riesce a rispondere adesso.");
    else if (event === "done") state.done = true;
  };
  for (;;) {
    const { value, done: end } = await reader.read();
    if (value) buf += value.replace(/\r\n/g, "\n");
    let cut: number;
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      handle(buf.slice(0, cut));
      buf = buf.slice(cut + 2);
    }
    if (end) break;
  }
  if (buf.trim()) handle(buf);
  if (state.failure) throw new Error(state.failure);
  if (!state.done) throw new Error("La risposta si è interrotta. Riprova.");
}
