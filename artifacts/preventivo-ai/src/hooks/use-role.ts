import { useCallback } from "react";
import { roleCan, type HomeTeamRole, type PermissionAction, type PermissionArea } from "@workspace/config";
import { useHome } from "@/lib/home-api";

// AGENDA-1 (riga 51): nascondere i comandi che il server rifiuterebbe al ruolo
// di chi guarda (un lettore non vede "Aggiungi blocco"). Il ruolo arriva da
// GET /api/home (APP-7), la tabella è la stessa del server (@workspace/config).
// Finché non si sa, si mostra tutto come al titolare: decide comunque il server.

const ROLES: readonly string[] = ["owner", "admin", "office", "foreman", "bookkeeper", "viewer"] satisfies HomeTeamRole[];

export function useCan(): (area: PermissionArea, action: PermissionAction) => boolean {
  const { data: home } = useHome();
  const role = (home && ROLES.includes(home.role) ? home.role : "owner") as HomeTeamRole;
  return useCallback((area, action) => roleCan(role, area, action), [role]);
}
