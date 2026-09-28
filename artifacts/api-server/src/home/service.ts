// APP-7 (docs/PIANO-AZIONE.md riga 31, da QuoteAI Phase 132): la home per ruolo.
//
// Which sections a role may see is decided here, from the same permission
// matrix every route uses; the catalog, the role defaults and the rules for a
// valid layout live in @workspace/config (home.ts) so the web app draws the
// same thing. A saved layout is re-checked on every read, so changing a
// person's role (or the matrix) can only ever take sections away from them.

import {
  HOME_DEFAULTS,
  HOME_KIND_OF_ROLE,
  HOME_KIND_ROLE,
  HOME_SECTIONS,
  HOME_SECTION_NEEDS,
  normalizeHomeLayout,
  type HomeKind,
  type HomeLayout,
  type HomeSectionId,
} from "@workspace/config";
import { db, homeLayoutsTable, type TeamMemberRole } from "@workspace/db";
import { roleCan } from "../middlewares/requirePermission.js";

export function homeKindOf(role: TeamMemberRole): HomeKind {
  return HOME_KIND_OF_ROLE[role];
}

/** The sections this role may have on its home, in catalog order. */
export function allowedSections(role: TeamMemberRole): HomeSectionId[] {
  return HOME_SECTIONS.filter((id) => {
    const need = HOME_SECTION_NEEDS[id];
    return !need || roleCan(role, need.area, need.action);
  });
}

/** A kind's starting home: the owner's saved one if any, else the built-in one — both cut to what the kind may see. */
export function startingLayout(kind: HomeKind, ownerDefault: unknown): HomeLayout {
  const allowed = allowedSections(HOME_KIND_ROLE[kind]);
  const builtin = normalizeHomeLayout(HOME_DEFAULTS[kind], allowed, HOME_DEFAULTS[kind]);
  return ownerDefault ? normalizeHomeLayout(ownerDefault, allowed, builtin) : builtin;
}

/**
 * What this person sees: their own layout, else their kind's starting one,
 * cut to their own role (an admin shares the owner's home but not every area).
 */
export function effectiveLayout(role: TeamMemberRole, own: unknown, ownerDefault: unknown): { layout: HomeLayout; source: "user" | "role" | "builtin" } {
  const kind = homeKindOf(role);
  const allowed = allowedSections(role);
  const start = normalizeHomeLayout(startingLayout(kind, ownerDefault), allowed, HOME_DEFAULTS[kind]);
  if (own) return { layout: normalizeHomeLayout(own, allowed, start), source: "user" };
  return { layout: start, source: ownerDefault ? "role" : "builtin" };
}

/** Upserts one saved home of a company (`subject` = `user:<id>` or `role:<kind>`). */
export async function saveHomeLayout(userId: string, subject: string, layout: HomeLayout): Promise<void> {
  await db
    .insert(homeLayoutsTable)
    .values({ userId, subject, layout })
    .onConflictDoUpdate({ target: [homeLayoutsTable.userId, homeLayoutsTable.subject], set: { layout, updatedAt: new Date() } });
}
