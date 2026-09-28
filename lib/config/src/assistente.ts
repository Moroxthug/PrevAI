// APP-8b (docs/PIANO-AZIONE.md riga 33, docs/ASSISTENTE-PLAN.md §4) — cosa
// l'assistente può fare da solo.
//
// Every action the assistant can take has a level, chosen by the owner in
// Impostazioni → Assistente, optionally narrower for one role:
//   "auto"  — Lo fa: runs at once, shows a "fatto" card with Annulla where it can be undone;
//   "ask"   — Chiede prima: a card the person confirms (the only behaviour before APP-8b);
//   "never" — Mai: the tool is not even offered to the model.
// Money and customer-facing actions can never become "auto" (the floor), and the
// role always wins: a person whose role can't do the action never gets the tool,
// whatever the setting. Reading is always on and is not in this catalog.
//
// Shared by the API (which enforces it) and the web app (which draws the
// settings). No dependencies.

export const ASSISTANT_LEVELS = ["auto", "ask", "never"] as const;
export type AssistantLevel = (typeof ASSISTANT_LEVELS)[number];

/** The actions, one per kind of proposal card (lib/db assistant.ts PROPOSAL_KINDS). */
export const ASSISTANT_ACTIONS = [
  "cost_entry", "milestone_update", "task", "job_note", "update_client",
  "invoice", "draft_quote",
  "send_invoice", "record_payment", "send_quote", "send_contract", "reply_lead", "message_client",
] as const;
export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number];

export const ASSISTANT_GROUPS = ["notes", "drafts", "money"] as const;
export type AssistantGroup = (typeof ASSISTANT_GROUPS)[number];

export const ASSISTANT_GROUP_LABEL: Record<AssistantGroup, { title: string; desc: string }> = {
  notes: { title: "Note e attività", desc: "Restano dentro l'impresa: costi, attività, note, date e stato delle fasi, dati dei clienti." },
  drafts: { title: "Bozze", desc: "Una bozza non parte: la rileggi prima di mandarla." },
  money: { title: "Soldi e clienti", desc: "Quello che esce verso un cliente o tocca un incasso chiede sempre prima." },
};

/** Team roles as stored on organization_members (plus the account owner). Strings, so this file needs no db import. */
export type AssistantTeamRole = "owner" | "admin" | "office" | "foreman" | "bookkeeper" | "viewer";
export const ASSISTANT_ROLE_LABEL: Record<Exclude<AssistantTeamRole, "owner">, string> = {
  admin: "Amministratore",
  office: "Ufficio",
  foreman: "Capo cantiere",
  bookkeeper: "Contabile",
  viewer: "Solo lettura",
};

export type AssistantActionDef = {
  label: string;
  group: AssistantGroup;
  /** The level when the owner has not chosen one. */
  default: AssistantLevel;
  /** The most the owner can allow: "ask" means it can never run by itself. */
  max: AssistantLevel;
  /** What the person's role needs (the same areas as requirePermission). */
  needs: { area: "jobs" | "costs" | "invoicing" | "quotes" | "contracts" | "leads"; action: "edit" | "full" };
  /** "Lo fa" shows Annulla for a few seconds (apply.ts undoAction). */
  undoable: boolean;
};

export const ASSISTANT_ACTION_DEFS: Record<AssistantAction, AssistantActionDef> = {
  cost_entry: { label: "Aggiungere un costo", group: "notes", default: "auto", max: "auto", needs: { area: "costs", action: "edit" }, undoable: true },
  task: { label: "Aggiungere un'attività", group: "notes", default: "auto", max: "auto", needs: { area: "jobs", action: "edit" }, undoable: true },
  // Completing a phase can draft its invoice (automation) — not undoable, but still internal.
  milestone_update: { label: "Cambiare date o stato di una fase", group: "notes", default: "auto", max: "auto", needs: { area: "jobs", action: "edit" }, undoable: false },
  invoice: { label: "Preparare la bozza di una fattura", group: "drafts", default: "auto", max: "auto", needs: { area: "invoicing", action: "edit" }, undoable: true },
  send_invoice: { label: "Inviare una fattura al cliente", group: "money", default: "ask", max: "ask", needs: { area: "invoicing", action: "edit" }, undoable: false },
  record_payment: { label: "Registrare un incasso", group: "money", default: "ask", max: "ask", needs: { area: "invoicing", action: "edit" }, undoable: false },
  // ── APP-8c ──
  // A job note stays on the job (needs migration 0011: until then the tool is not offered).
  job_note: { label: "Scrivere una nota sul cantiere", group: "notes", default: "auto", max: "auto", needs: { area: "jobs", action: "edit" }, undoable: true },
  // A client's contact details feed every later send, so by default it asks; the owner may let it run.
  update_client: { label: "Aggiornare i dati di un cliente", group: "notes", default: "ask", max: "auto", needs: { area: "quotes", action: "edit" }, undoable: true },
  draft_quote: { label: "Preparare la bozza di un preventivo", group: "drafts", default: "auto", max: "auto", needs: { area: "quotes", action: "edit" }, undoable: true },
  send_quote: { label: "Inviare un preventivo al cliente", group: "money", default: "ask", max: "ask", needs: { area: "quotes", action: "edit" }, undoable: false },
  send_contract: { label: "Inviare un contratto da firmare", group: "money", default: "ask", max: "ask", needs: { area: "contracts", action: "edit" }, undoable: false },
  reply_lead: { label: "Rispondere a una richiesta", group: "money", default: "ask", max: "ask", needs: { area: "leads", action: "edit" }, undoable: false },
  message_client: { label: "Scrivere un'email a un cliente", group: "money", default: "ask", max: "ask", needs: { area: "leads", action: "edit" }, undoable: false },
};

/** How many seconds "Annulla" stays on a card that ran by itself (the server allows a little more for slow networks). */
export const ASSISTANT_UNDO_SECONDS = 10;

const RANK: Record<AssistantLevel, number> = { never: 0, ask: 1, auto: 2 };

/** Never more than the action allows: an "auto" stored for a money action reads as "ask". */
export function clampAssistantLevel(action: AssistantAction, level: AssistantLevel): AssistantLevel {
  const max = ASSISTANT_ACTION_DEFS[action].max;
  return RANK[level] > RANK[max] ? max : level;
}

/** A stored setting: `role` null = the whole company, otherwise only that role. */
export type AssistantPermissionSetting = { action: string; role: string | null; level: string };

function isLevel(v: unknown): v is AssistantLevel {
  return typeof v === "string" && (ASSISTANT_LEVELS as readonly string[]).includes(v);
}

/**
 * The level one person gets for one action: the role's own setting, else the
 * company's, else the default — then clamped. `roleAllows` is whether the
 * person's role may do the action by hand; if not, the answer is always "never".
 */
export function effectiveAssistantLevel(action: AssistantAction, role: AssistantTeamRole, rows: readonly AssistantPermissionSetting[], roleAllows: boolean): AssistantLevel {
  if (!roleAllows) return "never";
  const own = rows.find((r) => r.action === action && r.role === role && isLevel(r.level));
  const company = rows.find((r) => r.action === action && (r.role === null || r.role === "") && isLevel(r.level));
  const level = (own?.level ?? company?.level ?? ASSISTANT_ACTION_DEFS[action].default) as AssistantLevel;
  return clampAssistantLevel(action, level);
}

export function isAssistantAction(v: unknown): v is AssistantAction {
  return typeof v === "string" && (ASSISTANT_ACTIONS as readonly string[]).includes(v);
}
