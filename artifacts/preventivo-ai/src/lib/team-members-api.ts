// Fetch client for Phase 7 team accounts: member management, the public
// invite accept flow, and the org switcher.
import { apiRequest as req, apiJson as json } from "./jobs-api";

export type TeamMemberRole = "admin" | "office" | "foreman" | "bookkeeper" | "viewer";
type TeamMemberStatus = "invited" | "active" | "suspended";

export type TeamMemberDto = {
  id: string;
  email: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  invitedAt: string;
  joinedAt: string | null;
  inviteExpiresAt: string | null;
  /** TEAM-1: posto creato con un codice d'accesso invece che con un'email. */
  viaCode: boolean;
  label: string | null;
};

export type SeatsDto = { used: number; included: number; extra: number; limit: number; extraPurchasable: boolean };
export type LeaderboardRow = { userId: string; name: string; isOwner: boolean; quotesSent: number; quotesWon: number; winRate: number | null; invoicedCents: number };

export type OrgDto = { orgId: string; companyName: string; role: "owner" | TeamMemberRole; isOwn: boolean };

export const teamMembersApi = {
  list: () => req<{ items: TeamMemberDto[]; seats: SeatsDto }>("/api/team/members"),
  createCode: (role: TeamMemberRole, label?: string) => req<{ code: string; expiresAt: string; memberId: string }>("/api/team/codes", { method: "POST", body: json({ role, label: label || undefined }) }),
  leaderboard: (days = 90) => req<{ days: number; since: string; items: LeaderboardRow[] }>(`/api/team/leaderboard?days=${days}`),
  invite: (email: string, role: TeamMemberRole, send = true) => req<{ url: string; expiresAt: string; emailed: boolean }>("/api/team/members/invite", { method: "POST", body: json({ email, role, send }) }),
  resend: (id: string) => req<{ url: string; expiresAt: string; emailed: boolean }>(`/api/team/members/${id}/resend`, { method: "POST" }),
  update: (id: string, body: { role?: TeamMemberRole; status?: "active" | "suspended" }) => req<{ member: TeamMemberDto }>(`/api/team/members/${id}`, { method: "PUT", body: json(body) }),
  remove: (id: string) => req<{ success: true }>(`/api/team/members/${id}`, { method: "DELETE" }),

  orgs: () => req<{ items: OrgDto[]; activeOrgId: string }>("/api/team/orgs"),
  switchOrg: (orgId: string) => req<{ orgId: string; role: string }>("/api/team/switch", { method: "POST", body: json({ orgId }) }),
};

export type InvitePreviewDto = { companyName: string; email: string; role: TeamMemberRole };

export const teamInviteApi = {
  redeemCode: (code: string) => req<{ member: TeamMemberDto; companyName: string }>("/api/team/code/redeem", { method: "POST", body: json({ code }) }),
  preview: (token: string) => req<InvitePreviewDto>(`/api/team/invite/${token}`),
  accept: (token: string) => req<{ member: TeamMemberDto }>(`/api/team/invite/${token}/accept`, { method: "POST" }),
};
