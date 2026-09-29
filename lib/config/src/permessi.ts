import type { HomeTeamRole } from "./home";

// AGENDA-1 (riga 51): la matrice dei permessi per ruolo, spostata qui da
// api-server/src/middlewares/requirePermission.ts così la legge anche l'app
// (useCan, per nascondere i comandi che il server rifiuterebbe). Il server
// resta l'unico che decide: qui c'è solo la tabella.

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

const MATRIX: Record<HomeTeamRole, Record<PermissionArea, LivelloPermesso>> = {
  owner: { quotes: "full", contracts: "full", jobs: "full", costs: "full", invoicing: "full", team: "full", analytics: "full", settings: "full", leads: "full", integrations: "full", security: "full", imports: "full", fiscale: "full" },
  admin: { quotes: "full", contracts: "full", jobs: "full", costs: "full", invoicing: "full", team: "full", analytics: "full", settings: "view", leads: "full", integrations: "view", security: "view", imports: "full", fiscale: "view" },
  office: { quotes: "full", contracts: "edit", jobs: "full", costs: "full", invoicing: "full", team: "view", analytics: "view", settings: "view", leads: "full", integrations: "view", security: "view", imports: "edit", fiscale: "none" },
  foreman: { quotes: "view", contracts: "view", jobs: "edit", costs: "edit", invoicing: "view", team: "view", analytics: "view", settings: "view", leads: "view", integrations: "view", security: "view", imports: "view", fiscale: "none" },
  // APP-7: il contabile emette e incassa, registra i costi e legge le scadenze fiscali
  // (è il suo lavoro: l'unica eccezione alla chiusura dell'area fiscale di A-2). Non cambia
  // il profilo fiscale, non manda nulla al commercialista, non tocca preventivi e cantieri.
  bookkeeper: { quotes: "view", contracts: "view", jobs: "view", costs: "full", invoicing: "full", team: "view", analytics: "view", settings: "view", leads: "view", integrations: "view", security: "view", imports: "edit", fiscale: "view" },
  viewer: { quotes: "view", contracts: "view", jobs: "view", costs: "view", invoicing: "view", team: "view", analytics: "view", settings: "view", leads: "view", integrations: "view", security: "view", imports: "view", fiscale: "none" },
};

export function roleCan(role: HomeTeamRole, area: PermissionArea, action: PermissionAction): boolean {
  return RANK[MATRIX[role][area]] >= RANK[action];
}
