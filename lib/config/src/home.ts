// APP-7 (docs/PIANO-AZIONE.md riga 31, da QuoteAI Phase 132) — la home per ruolo.
//
// Every person opens the dashboard on the home that fits their job: the owner
// sees everything, the office sees money and quotes, the site foreman sees the
// jobs and the hours, the bookkeeper sees invoices and tax deadlines. Each
// person can then show/hide and reorder the sections and pick their phone tabs
// ("Personalizza la home"), always choosing among what their role may see:
// hiding never reveals anything, and "Serve a te" can be folded but never
// removed. The owner can change each role's starting layout.
//
// Shared by the API (which decides what a role may see and stores layouts) and
// the web app (which draws them). No dependencies.

/** The sections of the home, in the order a brand-new catalog would show them. */
export const HOME_SECTIONS = ["needs-you", "composer", "stats", "invoices", "fisco", "jobs", "hours", "recent-quotes", "revenue"] as const;
export type HomeSectionId = (typeof HOME_SECTIONS)[number];

/** The one section nobody can hide: what is waiting on this person. */
export const HOME_PINNED: HomeSectionId = "needs-you";

/** The kinds of home. Several team roles share one (owner and admin both get the owner's). */
export const HOME_KINDS = ["titolare", "ufficio", "capocantiere", "contabile", "lettore"] as const;
export type HomeKind = (typeof HOME_KINDS)[number];

/** Team roles as stored on organization_members (plus the account owner). Kept as strings so this file needs no db import. */
export type HomeTeamRole = "owner" | "admin" | "office" | "foreman" | "bookkeeper" | "viewer";

export const HOME_KIND_OF_ROLE: Record<HomeTeamRole, HomeKind> = {
  owner: "titolare",
  admin: "titolare",
  office: "ufficio",
  foreman: "capocantiere",
  bookkeeper: "contabile",
  viewer: "lettore",
};

/** The role whose permissions decide what a kind of home may show (the narrowest role that has that home). */
export const HOME_KIND_ROLE: Record<HomeKind, HomeTeamRole> = {
  titolare: "admin",
  ufficio: "office",
  capocantiere: "foreman",
  contabile: "bookkeeper",
  lettore: "viewer",
};

export const HOME_KIND_LABEL: Record<HomeKind, string> = {
  titolare: "Titolare",
  ufficio: "Ufficio",
  capocantiere: "Capocantiere",
  contabile: "Contabile",
  lettore: "Sola lettura",
};

/**
 * What a section needs to be shown at all, as a permission area and level of
 * the API's matrix. `null` = every role. The API is the one that checks it
 * (and every section's data comes from routes that check it again).
 */
export const HOME_SECTION_NEEDS: Record<HomeSectionId, { area: "quotes" | "jobs" | "invoicing" | "fiscale"; action: "view" | "edit" } | null> = {
  "needs-you": null,
  composer: { area: "quotes", action: "edit" },
  stats: null,
  invoices: { area: "invoicing", action: "view" },
  fisco: { area: "fiscale", action: "view" },
  jobs: { area: "jobs", action: "view" },
  hours: { area: "jobs", action: "edit" },
  "recent-quotes": { area: "quotes", action: "view" },
  revenue: { area: "quotes", action: "view" },
};

export const HOME_PERIODS = ["m", "q", "y"] as const;
export type HomePeriod = (typeof HOME_PERIODS)[number];

/** Phone tabs after "Oggi": at most this many, picked from the sections the plan and role show. */
export const HOME_MAX_TABS = 3;

export type HomeLayout = {
  /** Shown sections, top to bottom. Always starts with (or contains) "needs-you". */
  order: HomeSectionId[];
  /** "Serve a te" folded to its title and count. */
  needsYouCollapsed: boolean;
  /** Phone tabs after "Oggi" (dashboard paths). Empty = the kind's default. */
  tabs: string[];
  /** The number strip's period. */
  period: HomePeriod;
};

/** Where each kind of home starts. Sections a role can't see are dropped by normalizeHomeLayout. */
export const HOME_DEFAULTS: Record<HomeKind, HomeLayout> = {
  titolare: { order: ["needs-you", "composer", "stats", "recent-quotes", "jobs", "revenue"], needsYouCollapsed: false, tabs: ["/dashboard/quotes", "/dashboard/jobs", "/dashboard/invoices"], period: "m" },
  ufficio: { order: ["needs-you", "composer", "invoices", "stats", "recent-quotes", "jobs"], needsYouCollapsed: false, tabs: ["/dashboard/quotes", "/dashboard/invoices", "/dashboard/clients"], period: "m" },
  capocantiere: { order: ["needs-you", "jobs", "hours"], needsYouCollapsed: false, tabs: ["/dashboard/jobs", "/dashboard/team", "/dashboard/quotes"], period: "m" },
  contabile: { order: ["needs-you", "invoices", "fisco", "stats"], needsYouCollapsed: false, tabs: ["/dashboard/invoices", "/dashboard/fisco", "/dashboard/clients"], period: "m" },
  lettore: { order: ["needs-you", "stats", "recent-quotes", "jobs"], needsYouCollapsed: false, tabs: ["/dashboard/quotes", "/dashboard/jobs", "/dashboard/invoices"], period: "m" },
};

const TAB_RE = /^\/dashboard(\/[a-z0-9-]+){1,2}$/;

/**
 * Brings any stored or submitted layout back inside the rules: only sections
 * the role may see, each once, "Serve a te" always there, at most three valid
 * tabs, a known period. Anything missing comes from `fallback`.
 */
export function normalizeHomeLayout(input: unknown, allowed: readonly HomeSectionId[], fallback: HomeLayout): HomeLayout {
  const src = (input && typeof input === "object" ? input : {}) as Partial<Record<keyof HomeLayout, unknown>>;
  const ok = new Set<string>(allowed);
  const order: HomeSectionId[] = [];
  const rawOrder = Array.isArray(src.order) ? src.order : fallback.order;
  for (const id of rawOrder) {
    if (typeof id === "string" && ok.has(id) && !order.includes(id as HomeSectionId)) order.push(id as HomeSectionId);
  }
  if (!order.includes(HOME_PINNED)) order.unshift(HOME_PINNED);

  const tabs: string[] = [];
  const rawTabs = Array.isArray(src.tabs) ? src.tabs : fallback.tabs;
  for (const tab of rawTabs) {
    if (typeof tab === "string" && TAB_RE.test(tab) && !tabs.includes(tab) && tabs.length < HOME_MAX_TABS) tabs.push(tab);
  }

  const period = (HOME_PERIODS as readonly unknown[]).includes(src.period) ? (src.period as HomePeriod) : fallback.period;
  const needsYouCollapsed = typeof src.needsYouCollapsed === "boolean" ? src.needsYouCollapsed : fallback.needsYouCollapsed;
  return { order, needsYouCollapsed, tabs, period };
}
