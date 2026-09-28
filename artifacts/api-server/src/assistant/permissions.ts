// APP-8b — what the assistant may do for this person (docs/ASSISTENTE-PLAN.md §4).
//
// Checked twice on the server: the tools offered to the model are filtered by
// level (a "never" tool is not in the list at all), and every proposal is
// checked again before it runs — by the turn ("auto" runs at once, "ask" stores
// a card) and by /confirm (the role must still allow it). The role always wins:
// the setting can only narrow what a person can already do by hand.
import { db, type AssistantActionRow, assistantPermissionsTable, assistantConversationsTable, assistantConversationActorsTable, type TeamMemberRole } from "@workspace/db";
import { ASSISTANT_ACTIONS, ASSISTANT_ACTION_DEFS, ASSISTANT_UNDO_SECONDS, effectiveAssistantLevel, type AssistantAction, type AssistantLevel } from "@workspace/config";
import { and, eq, sql } from "drizzle-orm";
import type { OpenAI } from "@workspace/integrations-openai-ai-server";
import { roleCan } from "../middlewares/requirePermission.js";
import { PROPOSAL_TOOLS } from "./tools.js";

export type AssistantLevels = Record<AssistantAction, AssistantLevel>;

/** Whether the person's role may do this by hand (the same matrix as the screens). */
export function roleAllowsAction(role: TeamMemberRole, action: AssistantAction): boolean {
  const need = ASSISTANT_ACTION_DEFS[action].needs;
  return roleCan(role, need.area, need.action);
}

/** The level of every action for one person. `rows` = the company's saved settings (none before migration 0013). */
export function levelsFor(role: TeamMemberRole, rows: readonly { action: string; role: string; level: string }[], ready: boolean): AssistantLevels {
  const out = {} as AssistantLevels;
  for (const action of ASSISTANT_ACTIONS) {
    const allows = roleAllowsAction(role, action);
    // Before the migration nothing runs by itself: every allowed action asks, as before APP-8b.
    out[action] = !ready ? (allows ? "ask" : "never") : effectiveAssistantLevel(action, role, rows, allows);
  }
  return out;
}

/** The tool list for the model: read tools always, a propose_* tool only when its action is not "never". */
export function toolsFor<T extends OpenAI.Chat.Completions.ChatCompletionTool>(all: readonly T[], levels: AssistantLevels): T[] {
  return all.filter((t) => {
    const kind = t.type === "function" ? PROPOSAL_TOOLS[t.function.name] : undefined;
    return !kind || levels[kind] !== "never";
  });
}

/** APP-8b: what the model is told about each action, from this person's levels. */
export function permissionsParagraph(levels: AssistantLevels): string {
  const names = (lv: string) => ASSISTANT_ACTIONS.filter((a) => levels[a] === lv).map((a) => ASSISTANT_ACTION_DEFS[a].label.toLowerCase());
  const auto = names("auto");
  const ask = names("ask");
  const never = names("never");
  const lines = [
    "Non modifichi i dati scrivendo: usi gli strumenti propose_*, e ogni strumento dice nel risultato cosa è successo.",
    auto.length ? `Queste azioni le fai subito, senza chiedere (l'utente vede una scheda "fatto" con Annulla): ${auto.join("; ")}. Quando il risultato dice status "done", la scheda mostra già i dettagli: conferma con una sola frase breve, scritta una volta sola.` : "",
    ask.length ? `Queste azioni chiedono conferma (l'utente vede una scheda e conferma): ${ask.join("; ")}. Quando il risultato dice status "pending_confirmation", spiega brevemente cosa farà la scheda e che nulla accade finché non conferma; non dire mai che è stato fatto.` : "",
    never.length ? `Queste azioni non sono disponibili per questa persona (impostazione dell'impresa o ruolo): ${never.join("; ")}. Se te le chiede, dillo e suggerisci di farle dalla schermata o di chiedere al titolare.` : "",
    "Se uno strumento restituisce un errore, spiegalo e suggerisci l'alternativa più vicina.",
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * APP-8b — what happens when the model calls a propose_* tool:
 *   "reject" — the action is "never" for this person: nothing is stored;
 *   "card"   — "ask": a card the person confirms (nothing runs until then);
 *   "run"    — "auto": it runs now. Only once migration 0013 has run, so the action row
 *              (and with it Annulla) exists — before that everything is a card, as before APP-8b.
 */
export function proposalOutcome(level: AssistantLevels[AssistantAction], ready: boolean): "reject" | "card" | "run" {
  if (level === "never") return "reject";
  return level === "auto" && ready ? "run" : "card";
}

/** When Annulla stops working for an action that ran by itself, or null when it can't be undone. */
export function undoDeadline(action: Pick<AssistantActionRow, "level" | "kind" | "executedAt" | "undoneAt"> | null | undefined): Date | null {
  if (!action || action.level !== "auto" || action.undoneAt || !ASSISTANT_ACTION_DEFS[action.kind].undoable) return null;
  return new Date(action.executedAt.getTime() + ASSISTANT_UNDO_SECONDS * 1000);
}

// ── Migration 0013 ───────────────────────────────────────────────────────────
// Once the three tables exist they stay: "ready" is remembered for good, "not
// ready" is asked again after a minute (the owner may run it while we're up).

let readyCache: { ready: boolean; at: number } | null = null;

export async function assistantV2Ready(): Promise<boolean> {
  if (readyCache && (readyCache.ready || Date.now() - readyCache.at < 60_000)) return readyCache.ready;
  try {
    const r = await db.execute<{ ready: boolean }>(sql`select (to_regclass('public.assistant_permissions') is not null and to_regclass('public.assistant_conversation_actors') is not null and to_regclass('public.assistant_actions') is not null) as ready`);
    const row = r.rows[0];
    readyCache = { ready: Boolean(row?.ready), at: Date.now() };
  } catch {
    readyCache = { ready: false, at: Date.now() };
  }
  return readyCache.ready;
}

/** Tests only. */
export function resetAssistantV2ReadyCache(value: boolean | null = null): void {
  readyCache = value === null ? null : { ready: value, at: Date.now() };
}

export async function loadPermissionRows(orgUserId: string): Promise<{ action: string; role: string; level: string }[]> {
  return db.select({ action: assistantPermissionsTable.action, role: assistantPermissionsTable.role, level: assistantPermissionsTable.level }).from(assistantPermissionsTable).where(eq(assistantPermissionsTable.userId, orgUserId));
}

/**
 * Whether this person may act on a conversation's cards: it is the company's and,
 * once migration 0013 has run, theirs (a thread with no owner row is the account owner's).
 */
export async function ownsConversation(who: { orgId: string; actorId: string }, conversationId: string): Promise<boolean> {
  const [conv] = await db.select({ id: assistantConversationsTable.id }).from(assistantConversationsTable).where(and(eq(assistantConversationsTable.id, conversationId), eq(assistantConversationsTable.userId, who.orgId)));
  if (!conv) return false;
  if (!(await assistantV2Ready())) return true;
  const [owner] = await db.select({ actor: assistantConversationActorsTable.actorUserId }).from(assistantConversationActorsTable).where(eq(assistantConversationActorsTable.conversationId, conversationId));
  return owner ? owner.actor === who.actorId : who.actorId === who.orgId;
}

/** Everything a turn or a confirmation needs to know about one person. */
export async function resolveLevels(orgUserId: string, role: TeamMemberRole): Promise<{ ready: boolean; levels: AssistantLevels }> {
  const ready = await assistantV2Ready();
  const rows = ready ? await loadPermissionRows(orgUserId) : [];
  return { ready, levels: levelsFor(role, rows, ready) };
}
