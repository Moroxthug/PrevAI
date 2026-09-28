import { Router } from "express";
import { z } from "zod";
import { db, projectsTable, businessProfilesTable, assistantPermissionsTable, hasFeature, minimumPlanFor, type AssistantMessage, type AssistantProposal, type AssistantActionRow, type TeamMemberRole } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId, getActorRole } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { getOrCreateConversation, loadConversation, listConversations, clearConversation, runAssistantTurn, type Lang, type Who } from "../assistant/service.js";
import { pageContextSchema } from "../assistant/context.js";
import { sseFrame, type TurnEvent } from "../assistant/stream.js";
import { confirmProposal, dismissProposal, undoProposal, undoDeadline, ProposalError } from "../assistant/apply.js";
import { assistantV2Ready, levelsFor, loadPermissionRows, roleAllowsAction, loadVoiceConfirmMax, voiceConfirmMaxFrom, withUnavailable } from "../assistant/permissions.js";
import { jobNotesReady } from "../assistant/ready.js";
import { roleCan } from "../middlewares/requirePermission.js";
import { ASSISTANT_ACTIONS, ASSISTANT_LEVELS, ASSISTANT_SPEECH_MAX_CHARS, ASSISTANT_VOICE_CONFIRM_OPTIONS, ASSISTANT_VOICE_CONFIRM_SETTING, ASSISTANT_TTS, clampAssistantLevel, isAssistantAction, spokenText } from "@workspace/config";
import { speechProvider, synthesize, voiceMinutesIncluded, voiceMinutesUsed } from "../assistant/speech.js";
import { writeAudit } from "../lib/notifications.js";

// ── Phase 5: job assistant ───────────────────────────────────────────────────
// Gate: "assistant" (Elite). Reads are free-form; writes only happen when
// the user confirms a proposal card.
// APP-8a: one conversation for the company (the per-job ones stay readable),
// opened from any screen with that screen as context, answers streamed (SSE).

const router = Router();
const chatLimiter = userRateLimiter({ windowMs: 60 * 60 * 1000, max: 120, message: "Hourly assistant limit reached. Try again later." });

async function requireAssistant(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "assistant")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("assistant") };
}

export function serializeMessage(m: AssistantMessage) {
  return { id: m.id, role: m.role, content: m.content, toolCalls: m.toolCalls?.map((c) => ({ id: c.id, name: c.name })) ?? null, toolCallId: m.toolCallId, toolName: m.toolName, createdAt: m.createdAt.toISOString() };
}

/** APP-8b: `action` says whether the card ran by itself ("Lo fa") and until when Annulla works. */
export function serializeProposal(p: AssistantProposal, action?: AssistantActionRow | null) {
  const undoUntil = undoDeadline(action);
  return { auto: action?.level === "auto", undoUntil: undoUntil?.toISOString() ?? null, id: p.id, messageId: p.messageId, projectId: p.projectId, kind: p.kind, summary: p.summary, payload: p.payload, status: p.status, resultEntityType: p.resultEntityType, resultEntityId: p.resultEntityId, error: p.error, resolvedAt: p.resolvedAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString() };
}

const turnBody = z.object({ content: z.string().trim().min(1).max(4000), language: z.enum(["it"]).optional(), context: pageContextSchema.nullish() });

/** APP-8b: the company, the person and their role. */
function whoOf(res: Parameters<typeof getUserId>[0]): Who {
  return { orgId: getUserId(res), actorId: getActorUserId(res), role: getActorRole(res) };
}

function langOf(_req: { headers: Record<string, unknown>; body?: unknown }): Lang {
  return "it";
}

// GET /api/assistant/conversation?projectId=… — the conversation for a job (or the company one), created on first use
router.get("/assistant/conversation", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "The assistant requires the Elite plan" }); return; }
    const projectId = typeof req.query.projectId === "string" && req.query.projectId ? req.query.projectId : null;
    if (projectId) {
      const [p] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
      if (!p) { res.status(404).json({ error: "Not found" }); return; }
    }
    const conv = await getOrCreateConversation(whoOf(res), projectId);
    const loaded = await loadConversation(whoOf(res), conv.id);
    res.json({ conversation: { id: conv.id, projectId: conv.projectId, title: conv.title }, messages: loaded!.messages.map(serializeMessage), proposals: loaded!.proposals.map((p) => serializeProposal(p, loaded!.actions.get(p.id))) });
  } catch (err) {
    req.log.error({ err }, "Error loading assistant conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/assistant/conversations — the company's threads, newest first (the main one has projectId null)
router.get("/assistant/conversations", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const rows = await listConversations(whoOf(res));
    res.json({ conversations: rows.map((c) => ({ id: c.id, projectId: c.projectId, projectName: c.projectName, title: c.title, lastMessageAt: c.lastMessageAt.toISOString() })) });
  } catch (err) {
    req.log.error({ err }, "Error listing assistant conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/assistant/conversations/:id — one thread with its messages and cards
router.get("/assistant/conversations/:id", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const loaded = await loadConversation(whoOf(res), req.params.id as string);
    if (!loaded) { res.status(404).json({ error: "Not found" }); return; }
    const c = loaded.conversation;
    res.json({ conversation: { id: c.id, projectId: c.projectId, title: c.title }, messages: loaded.messages.map(serializeMessage), proposals: loaded.proposals.map((p) => serializeProposal(p, loaded.actions.get(p.id))) });
  } catch (err) {
    req.log.error({ err }, "Error loading assistant conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assistant/conversations/:id/stream { content, context? } — the same turn as /messages, sent as it happens:
//   event: progress {label}  ·  delta {text}  ·  message {message}  ·  proposal {proposal}  ·  navigate {path, label} (APP-8c)  ·  done {}  ·  error {message}
// The HTTP status is decided before the first byte (plan, body, thread); anything that fails later arrives as an `error` event.
router.post("/assistant/conversations/:id/stream", requireAuth, requirePermission("jobs", "view"), chatLimiter, async (req, res) => {
  const userId = getUserId(res);
  const gate = await requireAssistant(userId).catch(() => null);
  if (!gate) { res.status(500).json({ error: "Internal server error" }); return; }
  if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
  const body = turnBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
  const loaded = await loadConversation(whoOf(res), req.params.id as string).catch(() => null);
  if (!loaded) { res.status(404).json({ error: "Not found" }); return; }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  // Closing the sheet mid-answer stops the model instead of paying for words nobody reads.
  const abort = new AbortController();
  res.on("close", () => { if (!res.writableEnded) abort.abort(); });
  const send = (event: string, data: unknown) => { if (!res.writableEnded) res.write(sseFrame(event, data)); };
  const onEvent = (e: TurnEvent) => {
    if (e.type === "message") send("message", { message: serializeMessage(e.message) });
    else if (e.type === "proposal") send("proposal", { proposal: serializeProposal(e.proposal, e.action) });
    else if (e.type === "delta") send("delta", { text: e.text });
    else if (e.type === "navigate") send("navigate", { path: e.path, label: e.label });
    else send("progress", { tool: e.tool, label: e.label });
  };
  try {
    await runAssistantTurn({ conversation: loaded.conversation, who: whoOf(res), content: body.data.content, language: langOf(req), context: body.data.context, onEvent, signal: abort.signal, ip: req.ip });
    send("done", {});
  } catch (err) {
    if (!abort.signal.aborted) {
      req.log.error({ err }, "Assistant streamed turn failed");
      send("error", { error: "ASSISTANT_FAILED", message: "L'assistente non riesce a rispondere adesso. Riprova tra un momento." });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// POST /api/assistant/conversations/:id/messages { content, language?, context? } — the whole turn in one JSON answer
router.post("/assistant/conversations/:id/messages", requireAuth, requirePermission("jobs", "view"), chatLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const body = turnBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const loaded = await loadConversation(whoOf(res), req.params.id as string);
    if (!loaded) { res.status(404).json({ error: "Not found" }); return; }
    const result = await runAssistantTurn({ conversation: loaded.conversation, who: whoOf(res), content: body.data.content, language: langOf(req), context: body.data.context, ip: req.ip });
    res.json({ messages: result.messages.map(serializeMessage), proposals: result.proposals.map((p) => serializeProposal(p, result.actions.get(p.id))) });
  } catch (err) {
    req.log.error({ err }, "Assistant turn failed");
    res.status(502).json({ error: "ASSISTANT_FAILED", message: "The assistant could not answer right now. Try again in a moment." });
  }
});

// DELETE /api/assistant/conversations/:id — start over
router.delete("/assistant/conversations/:id", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const ok = await clearConversation(whoOf(res), req.params.id as string);
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error clearing assistant conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assistant/proposals/:id/confirm { via?: "tap" | "voice" }
// APP-8b: the role is checked per kind of card inside (a bookkeeper records a payment
// without jobs:edit; a foreman never sends an invoice), so the route only needs jobs:view.
router.post("/assistant/proposals/:id/confirm", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    // APP-8f: { via: "voice" } when the person said "sì" (above the owner's threshold → 409 TAP_REQUIRED).
    const via = (req.body as { via?: unknown } | undefined)?.via === "voice" ? "voice" : "tap";
    const out = await confirmProposal({ who: whoOf(res), proposalId: req.params.id as string, ip: req.ip, via });
    res.json({ proposal: serializeProposal(out.proposal, out.action), link: out.link });
  } catch (err) {
    if (err instanceof ProposalError) { res.status(err.status).json({ error: err.code, message: err.message }); return; }
    req.log.error({ err }, "Error confirming proposal");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assistant/proposals/:id/dismiss
router.post("/assistant/proposals/:id/dismiss", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const proposal = await dismissProposal({ who: whoOf(res), proposalId: req.params.id as string });
    res.json({ proposal: serializeProposal(proposal) });
  } catch (err) {
    if (err instanceof ProposalError) { res.status(err.status).json({ error: err.code, message: err.message }); return; }
    req.log.error({ err }, "Error dismissing proposal");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assistant/proposals/:id/undo — APP-8b: Annulla on a card that ran by itself ("Lo fa"), for a few seconds
router.post("/assistant/proposals/:id/undo", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const out = await undoProposal({ who: whoOf(res), proposalId: req.params.id as string, ip: req.ip });
    res.json({ proposal: serializeProposal(out.proposal, out.action) });
  } catch (err) {
    if (err instanceof ProposalError) { res.status(err.status).json({ error: err.code, message: err.message }); return; }
    req.log.error({ err }, "Error undoing proposal");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── APP-8b: Impostazioni → Assistente ─────────────────────────────────────────
// GET  /api/assistant/permissions  the company's choices, and what the caller gets
// PUT  /api/assistant/permissions  the owner saves them (the whole list replaces the old one)
// Inert until migrations/v2/0013_app8b_assistente.sql runs: GET says available: false
// (everything asks, as before), PUT answers 503.

const SETTABLE_ROLES = ["", "admin", "office", "foreman", "bookkeeper", "viewer"] as const;
const permissionsBody = z.object({
  settings: z.array(z.object({ action: z.enum(ASSISTANT_ACTIONS), role: z.enum(SETTABLE_ROLES), level: z.enum(ASSISTANT_LEVELS) })).max(ASSISTANT_ACTIONS.length * SETTABLE_ROLES.length),
  // APP-8f: above this amount (cents) a card takes the tap, the voice is not enough. Omitted = unchanged.
  voiceConfirmMaxCents: z.number().int().refine((n) => (ASSISTANT_VOICE_CONFIRM_OPTIONS as readonly number[]).includes(n)).optional(),
});

/** What each role can do by hand (the settings show "the role can't" instead of a choice), and whether the caller may change them. */
function permissionsExtras(role: TeamMemberRole) {
  const roleLimits = Object.fromEntries(SETTABLE_ROLES.filter((r) => r).map((r) => [r, ASSISTANT_ACTIONS.filter((a) => roleAllowsAction(r as TeamMemberRole, a))]));
  return { canEdit: roleCan(role, "settings", "full"), roleLimits };
}

router.get("/assistant/permissions", requireAuth, requirePermission("settings", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const ready = await assistantV2Ready();
    const rows = ready ? await loadPermissionRows(userId) : [];
    res.json({
      available: ready,
      settings: rows.filter((r) => isAssistantAction(r.action)).map((r) => ({ action: r.action, role: r.role, level: r.level })),
      voiceConfirmMaxCents: voiceConfirmMaxFrom(rows),
      mine: withUnavailable(levelsFor(getActorRole(res), rows, ready), { job_note: !(await jobNotesReady()) }),
      ...permissionsExtras(getActorRole(res)),
    });
  } catch (err) {
    req.log.error({ err }, "Error loading assistant permissions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/assistant/permissions", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    if (!(await assistantV2Ready())) { res.status(503).json({ error: "NOT_AVAILABLE", message: "I permessi dell'assistente non sono ancora disponibili." }); return; }
    const body = permissionsBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    // One row per (action, role); a money action is stored at most "ask" whatever was sent.
    const byKey = new Map(body.data.settings.map((s) => [`${s.action}|${s.role}`, { ...s, level: clampAssistantLevel(s.action, s.level) }]));
    // APP-8f: the voice threshold lives in the same table; kept when the body leaves it out.
    const voiceMax = body.data.voiceConfirmMaxCents ?? voiceConfirmMaxFrom(await loadPermissionRows(userId));
    const values = [...[...byKey.values()].map((s) => ({ userId, action: s.action as string, role: s.role as string, level: s.level as string })), { userId, action: ASSISTANT_VOICE_CONFIRM_SETTING, role: "", level: String(voiceMax) }];
    await db.transaction(async (tx) => {
      await tx.delete(assistantPermissionsTable).where(eq(assistantPermissionsTable.userId, userId));
      await tx.insert(assistantPermissionsTable).values(values);
    });
    await writeAudit({ userId, actorType: "user", actorId: getActorUserId(res), entityType: "assistant_permissions", entityId: userId, action: "updated", diff: { settings: [...byKey.values()], voiceConfirmMaxCents: voiceMax }, ip: req.ip });
    const rows = await loadPermissionRows(userId);
    res.json({ available: true, settings: rows.filter((r) => isAssistantAction(r.action)).map((r) => ({ action: r.action, role: r.role, level: r.level })), voiceConfirmMaxCents: voiceConfirmMaxFrom(rows), mine: withUnavailable(levelsFor(getActorRole(res), rows, true), { job_note: !(await jobNotesReady()) }), ...permissionsExtras(getActorRole(res)) });
  } catch (err) {
    req.log.error({ err }, "Error saving assistant permissions");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── APP-8e: risponde a voce (D17 aperta, speech.ts) ──────────────────────────
// GET dice all'app quale voce usare; POST trasforma una frase in audio con la
// chiave del fornitore, che resta qui. Senza chiave: 503 VOICE_BROWSER e
// l'app legge con la voce del browser.

const speechLimiter = userRateLimiter({ windowMs: 60 * 60 * 1000, max: 600, message: "Limite orario della voce raggiunto. Riprova più tardi." });
const speechBody = z.object({ text: z.string().trim().min(1).max(ASSISTANT_SPEECH_MAX_CHARS), rate: z.number().min(0.5).max(2).optional() });

router.get("/assistant/voice", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const provider = speechProvider();
    // APP-8f: confirmMaxCents — the owner's threshold for "sì" said out loud (the confirm route checks it again).
    res.json({ provider, voice: provider === "openai" ? ASSISTANT_TTS.voice : null, minutesUsed: provider === "openai" ? await voiceMinutesUsed(userId) : 0, minutesIncluded: voiceMinutesIncluded(), confirmMaxCents: await loadVoiceConfirmMax(userId) });
  } catch (err) {
    req.log.error({ err }, "Error loading assistant voice");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/assistant/speech", requireAuth, requirePermission("jobs", "view"), speechLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const body = speechBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    if (speechProvider() === "browser") { res.status(503).json({ error: "VOICE_BROWSER", message: "Sintesi vocale del server non attiva: usa la voce del browser." }); return; }
    const included = voiceMinutesIncluded();
    if (included !== null && (await voiceMinutesUsed(userId)) >= included) { res.status(402).json({ error: "VOICE_MINUTES_OVER", message: "Minuti di voce del mese finiti: l'assistente risponde per scritto." }); return; }
    const ctrl = new AbortController();
    res.on("close", () => { if (!res.writableEnded) ctrl.abort(); });
    const audio = await synthesize(userId, spokenText(body.data.text), body.data.rate ?? 1, ctrl.signal);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  } catch (err) {
    if (res.headersSent || res.destroyed) return;
    req.log.error({ err }, "Error synthesizing assistant speech");
    res.status(502).json({ error: "VOICE_FAILED", message: "La voce non è disponibile adesso." });
  }
});

export default router;
