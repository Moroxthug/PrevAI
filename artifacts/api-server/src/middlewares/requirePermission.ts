import type { Request, Response, NextFunction } from "express";
import { roleCan, type PermissionArea, type PermissionAction } from "@workspace/config";
import { getActorRole } from "./authMiddleware.js";

// La matrice (ruolo × area → livello) vive in @workspace/config/permessi.ts: la usa anche l'app.
export { roleCan, type PermissionArea, type PermissionAction } from "@workspace/config";

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
