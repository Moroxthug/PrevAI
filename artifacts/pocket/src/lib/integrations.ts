// Connected apps: the pure parts. The apps PrevAI really connects (as Integrations.dc.html draws a list of them) in seven groups, each in one of six states, and
// what the list shows from that: those connected on top, the rest as tiles (the ones that need a plan after the ones you can connect). Where the server has the
// app, its answers decide the state. QuoteAI's QuickBooks, Wave, Xero, Jobber, Home Depot Pro and HomeStars have no Italian counterpart here; SdI and the
// accountant's link come with the PrevAI Fisco add-on.
export type AppId = "sdi" | "comm" | "stripe" | "gcal" | "outlook" | "gmail" | "wa" | "meta" | "gbp" | "drive" | "imp";
export type Cat = "acct" | "pay" | "msg" | "cal" | "store" | "lead";
export const CATS: ("all" | Cat)[] = ["all", "acct", "pay", "msg", "cal", "store", "lead"];
export type State = "connected" | "attention" | "paused" | "none" | "soon" | "locked";

export type AppDef = { id: AppId; cat: Cat; icon: "bars" | "users" | "card" | "cal" | "mail" | "chat" | "funnel" | "star" | "cloud" | "export"; tone: string; /** The plan feature that unlocks it. */ feature?: string; /** Or the cheapest plan that includes it. */ minPlan?: string; /** The server has nothing for it yet. */ none?: boolean };

export const APPS: AppDef[] = [
  { id: "sdi", cat: "acct", icon: "bars", tone: "sage", feature: "sdi_invoicing" },
  { id: "comm", cat: "acct", icon: "users", tone: "teal", feature: "admin_suite" },
  { id: "stripe", cat: "pay", icon: "card", tone: "violet", feature: "invoice_card_payments" },
  { id: "gcal", cat: "cal", icon: "cal", tone: "azure", feature: "calendar_sync" },
  { id: "outlook", cat: "cal", icon: "cal", tone: "indigo", feature: "calendar_sync" },
  { id: "gmail", cat: "msg", icon: "mail", tone: "clay", feature: "gmail_send" },
  { id: "wa", cat: "msg", icon: "chat", tone: "sage" },
  { id: "meta", cat: "lead", icon: "funnel", tone: "sky", feature: "meta_lead_ads" },
  { id: "gbp", cat: "lead", icon: "star", tone: "gold" },
  { id: "drive", cat: "store", icon: "cloud", tone: "amber", none: true },
  { id: "imp", cat: "store", icon: "export", tone: "slate" },
];

export const isOn = (s: State): boolean => s === "connected" || s === "attention" || s === "paused";

const PLAN_ORDER = ["free", "monthly_starter", "monthly_pro", "monthly_elite"];
/** Does the plan (and its feature list from the server) include the app? */
export function unlocked(app: AppDef, plan: string, features: string[]): boolean {
  if (app.none) return true;
  if (app.minPlan) return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(app.minPlan);
  return !app.feature || features.includes(app.feature);
}

type Status = { connected?: boolean; available?: boolean; isEnabled?: boolean | null; chargesEnabled?: boolean } | null | undefined;

/** The shape most apps share: not set up on the server → soon; connected on or off; otherwise Connect. `attention` is a failure the owner should look at. */
export function stateOf(s: Status, attention = false): State {
  if (!s) return "none";
  if (!s.connected) return s.available === false ? "soon" : "none";
  if (attention) return "attention";
  return s.isEnabled === false ? "paused" : "connected";
}

type LogEntry = { entityType?: string; entityId?: string; milestoneId?: string; provider?: string; status: string };
/** The sync logs only grow (a retry adds a row), so an entity needs attention while its newest row, newest first, is a failure. */
export function unresolvedFailures<T extends LogEntry>(entries: readonly T[] | undefined): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of entries ?? []) {
    const key = `${e.provider ?? ""}:${e.entityType ?? ""}:${e.entityId ?? e.milestoneId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (e.status === "failed" && e.entityType !== "payment_pull") out.push(e);
  }
  return out;
}

/** The apps matching a category and a search (the name, or its words), in the board's order. */
export function visible(apps: AppDef[], cat: "all" | Cat, term: string, words: (id: AppId) => string): AppDef[] {
  const q = term.trim().toLowerCase();
  return apps.filter((a) => (cat === "all" || a.cat === cat) && (!q || words(a.id).toLowerCase().includes(q)));
}

/** The tiles: what can be connected first, then the coming soon, then what a plan unlocks. */
export function tileOrder(apps: AppDef[], states: Record<AppId, State>): AppDef[] {
  const rank = (s: State) => (s === "soon" ? 1 : s === "locked" ? 2 : 0);
  return apps.map((a, i) => ({ a, i })).sort((x, y) => rank(states[x.a.id]) - rank(states[y.a.id]) || x.i - y.i).map((x) => x.a);
}

export type Counts = { on: number; attention: number };
export function counts(states: Record<AppId, State>): Counts {
  const all = Object.values(states);
  return { on: all.filter(isOn).length, attention: all.filter((s) => s === "attention").length };
}

/** The plan (or the add-on) that includes the app, or null when every plan has it. The Fisco add-on brings SdI and the accountant's link. */
const FEATURE_PLAN: Record<string, string> = { sdi_invoicing: "fisco", admin_suite: "fisco", invoice_card_payments: "monthly_elite", calendar_sync: "monthly_elite", gmail_send: "monthly_elite", meta_lead_ads: "monthly_elite" };
export const requiredPlan = (app: AppDef): string | null => app.minPlan ?? (app.feature ? FEATURE_PLAN[app.feature] ?? "monthly_elite" : null);
