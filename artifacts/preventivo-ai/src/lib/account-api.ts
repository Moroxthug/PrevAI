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

// ── GDPR-1: "Scarica i tuoi dati" ────────────────────────────────────────────

export type AccountExportDto = {
  id: string;
  stato: "in_preparazione" | "pronta" | "errore" | "scaduta";
  createdAt: string;
  readyAt: string | null;
  expiresAt: string | null;
  /** Only when ready: part 1 is the data, the others the files. */
  parts: { n: number; kind: "dati" | "file"; bytes: number; files: number }[];
  fileCount: number | null;
  filesDone: number;
  tableCount: number | null;
  rowCount: number | null;
  totalBytes: number | null;
  /** Files that vanished or were too big while the ZIP was being made. */
  skippedFiles: string[];
};

export type AccountExportStatus = {
  /** False until migration 0017 runs: the page then points to privacy@prevai.it. */
  available: boolean;
  /** Only the business owner acting as themselves exports the company. */
  canExport: boolean;
  ttlDays: number;
  /** One export a day: when the next one can be asked. */
  nextAllowedAt: string | null;
  exports: AccountExportDto[];
};

export const ACCOUNT_EXPORT_KEY = ["account-export"] as const;

export const exportApi = {
  status: () => req<AccountExportStatus>("/api/account/export"),
  request: (password: string) => req<{ export: AccountExportDto }>("/api/account/export", { method: "POST", body: JSON.stringify({ password }) }),
  advance: (id: string) => req<{ export: AccountExportDto }>(`/api/account/export/${id}/continue`, { method: "POST" }),
  partUrl: (id: string, n: number) => req<{ url: string }>(`/api/account/export/${id}/parts/${n}`),
};

export const fmtBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB`;
