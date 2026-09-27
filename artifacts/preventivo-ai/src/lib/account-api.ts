// APP-1c: cancellazione dell'account in autonomia — same hand-written fetch
// pattern as security-api.ts. The server keys everything on the signed-in
// PERSON, not on the org they are acting in.

export type AccountDeletionDto = { id: string; requestedAt: string; scheduledFor: string; ownsOrg: boolean };

export type AccountDeletionStatus = {
  /** False until migration 0010 runs: the page then points to privacy@prevai.it. */
  available: boolean;
  graceDays: number;
  /** The person owns a company: deleting the account deletes the company too. */
  ownsOrg: boolean;
  own: AccountDeletionDto | null;
  /** The owner of the org this person works in asked to delete it. */
  org: { scheduledFor: string } | null;
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new Error(body.message || body.error || `Request failed (${res.status})`);
  return body;
}

export const ACCOUNT_DELETION_KEY = ["account-deletion"] as const;

export const accountApi = {
  deletionStatus: () => req<AccountDeletionStatus>("/api/account/deletion"),
  requestDeletion: (body: { password: string; confirm: "ELIMINA"; reason?: string }) =>
    req<{ own: AccountDeletionDto }>("/api/account/deletion", { method: "POST", body: JSON.stringify(body) }),
  cancelDeletion: () => req<{ own: null }>("/api/account/deletion", { method: "DELETE" }),
};

export const fmtDeletionDate = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
