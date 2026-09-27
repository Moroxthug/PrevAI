import type { Request, Response, NextFunction } from "express";
import type { TeamMemberRole } from "@workspace/db";
import { getActorRole } from "./authMiddleware.js";

// ── Phase 7 permission matrix (docs/GROWTH-PLATFORM-PLAN.md §3.2) ───────────
// A starting point, not a spec — refine per-role behaviour as real usage
// surfaces gaps. Owner/admin always pass; requirePermission only exists to
// hold back office/foreman/viewer from actions their role shouldn't reach.

export type PermissionArea = "quotes" | "contracts" | "jobs" | "costs" | "invoicing" | "team" | "analytics" | "settings" | "leads" | "integrations" | "security" | "imports" | "fiscale";
export type PermissionAction = "view" | "edit" | "full";

/**
 * A-2: `"none"` esiste solo dentro la matrice, non fra le azioni richiedibili.
 * Serve per l'area `fiscale`, la prima che non è "meno o più" per ruolo ma
 * **chiusa**: la posizione fiscale dell'impresa (quanto incassa, quanto deve,
 * quanto è vicina alla soglia) non è un dato di lavoro, e un capo cantiere o
 * un collaboratore non hanno motivo di vederla. Prima di A-2 ogni ruolo poteva
 * almeno leggere ogni area, e non andava bene per questi dati.
 */
type LivelloPermesso = PermissionAction | "none";

const RANK: Record<LivelloPermesso, number> = { none: -1, view: 0, edit: 1, full: 2 };

const MATRIX: Record<TeamMemberRole, Record<PermissionArea, LivelloPermesso>> = {
  owner: { quotes: "full", contracts: "full", jobs: "full", costs: "full", invoicing: "full", team: "full", analytics: "full", settings: "full", leads: "full", integrations: "full", security: "full", imports: "full", fiscale: "full" },
  admin: { quotes: "full", contracts: "full", jobs: "full", costs: "full", invoicing: "full", team: "full", analytics: "full", settings: "view", leads: "full", integrations: "view", security: "view", imports: "full", fiscale: "view" },
  office: { quotes: "full", contracts: "edit", jobs: "full", costs: "full", invoicing: "full", team: "view", analytics: "view", settings: "view", leads: "full", integrations: "view", security: "view", imports: "edit", fiscale: "none" },
  foreman: { quotes: "view", contracts: "view", jobs: "edit", costs: "edit", invoicing: "view", team: "view", analytics: "view", settings: "view", leads: "view", integrations: "view", security: "view", imports: "view", fiscale: "none" },
  viewer: { quotes: "view", contracts: "view", jobs: "view", costs: "view", invoicing: "view", team: "view", analytics: "view", settings: "view", leads: "view", integrations: "view", security: "view", imports: "view", fiscale: "none" },
};

export function roleCan(role: TeamMemberRole, area: PermissionArea, action: PermissionAction): boolean {
  return RANK[MATRIX[role][area]] >= RANK[action];
}

/** Wrap after `requireAuth`. Blocks a role that doesn't meet `action` on `area`. */
// Generic over P for the same reason requireAuth is (see authMiddleware.ts):
// without it, req.params in a route that also passes requireAuth<P> collapses
// to string | string[] and every `eq(table.id, id)` stops typechecking.
export function requirePermission(area: PermissionArea, action: PermissionAction) {
  return <P = Record<string, string>>(_req: Request<P>, res: Response, next: NextFunction): void => {
    const role = getActorRole(res);
    if (!roleCan(role, area, action)) {
      res.status(403).json({ error: "FORBIDDEN", message: `Your role (${role}) doesn't have ${action} access to ${area}.` });
      return;
    }
    next();
  };
}
