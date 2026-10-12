// Group: the server calls (routes/groups.ts). Every change is the owner's or an admin's; the server says no to anyone else.
import { api } from "./api";
import type { GroupOverview, GroupResponse } from "./group";

const id = encodeURIComponent;

export const groupApi = {
  get: () => api<GroupResponse>("/api/group"),
  overview: () => api<GroupOverview>("/api/group/overview?months=6"),
  start: (name: string) => api<{ group: unknown }>("/api/group", { method: "POST", body: { name } }),
  invite: (orgId: string) => api<{ group: unknown }>("/api/group/companies", { method: "POST", body: { orgId } }),
  accept: () => api<{ group: unknown }>("/api/group/accept", { method: "POST", body: {} }),
  decline: () => api<{ group: null }>("/api/group/decline", { method: "POST", body: {} }),
  leave: (orgId: string) => api<{ group: unknown }>(`/api/group/companies/${id(orgId)}`, { method: "DELETE" }),
};
