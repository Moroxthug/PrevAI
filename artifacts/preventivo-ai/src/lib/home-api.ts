// APP-7 — the home per ruolo and "Personalizza la home" (routes/home.ts on the server).
import { useQuery } from "@tanstack/react-query";
import type { HomeKind, HomeLayout, HomeSectionId } from "@workspace/config";
import { apiRequest as req, apiJson as json } from "@/lib/jobs-api";

type HomeRoleDto = { kind: HomeKind; allowed: HomeSectionId[]; layout: HomeLayout; custom: boolean };

export type HomeDto = {
  /** false until migration 0012 runs: the built-in home, nothing can be saved. */
  available: boolean;
  role: string;
  kind: HomeKind;
  allowed: HomeSectionId[];
  layout: HomeLayout;
  source: "user" | "role" | "builtin";
  /** Each kind's starting home — only for who manages the team. */
  roles: HomeRoleDto[] | null;
};

export const homeApi = {
  get: () => req<HomeDto>("/api/home"),
  save: (layout: HomeLayout) => req<{ layout: HomeLayout }>("/api/home", { method: "PUT", body: json(layout) }),
  reset: () => req<{ success: true }>("/api/home", { method: "DELETE" }),
  saveRole: (kind: HomeKind, layout: HomeLayout) => req<{ layout: HomeLayout }>(`/api/home/roles/${kind}`, { method: "PUT", body: json(layout) }),
  resetRole: (kind: HomeKind) => req<{ success: true }>(`/api/home/roles/${kind}`, { method: "DELETE" }),
};

export const HOME_QUERY_KEY = ["home"] as const;

/** The home layout, shared by the home page and the phone tabs. */
export function useHome() {
  return useQuery({ queryKey: HOME_QUERY_KEY, queryFn: homeApi.get, staleTime: 5 * 60_000 });
}
