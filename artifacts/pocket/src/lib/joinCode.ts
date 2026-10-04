// The access code a crew member joins with (api-server routes/team-members.ts): 8 letters and digits,
// shown XXXX-XXXX. The server forgives case, spaces, dashes and look-alike letters; the phone only
// keeps letters and digits, upper-cased, so the boxes show what was typed.
import type { TeamRole } from "./api";

export const CODE_LENGTH = 8;
export const CODE_HALF = CODE_LENGTH / 2;

/** What was typed or pasted → at most 8 upper-case letters and digits. */
export function cleanCode(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

export function isCodeComplete(code: string): boolean {
  return cleanCode(code).length === CODE_LENGTH;
}

/** XXXX-XXXX (the dash only once there is something after it). */
export function formatCode(code: string): string {
  const c = cleanCode(code);
  return c.length > CODE_HALF ? `${c.slice(0, CODE_HALF)}-${c.slice(CODE_HALF)}` : c;
}

/** The board has two looks: crew (no cost access) and foreman (an account is needed, job costs show). */
export type CodeKind = "crew" | "foreman";

export function kindForRole(role: TeamRole | string): CodeKind {
  return role === "foreman" || role === "admin" ? "foreman" : "crew";
}

export type CodeProblem = "invalid" | "used" | "expired" | "own" | "member" | "offline" | "failed";

/** The server's answer to a preview or a redeem → what the screen says. */
export function codeProblem(failure: { status: number; code?: string }): CodeProblem {
  if (failure.status === 0) return "offline";
  switch (failure.code) {
    case "NOT_FOUND": return "invalid";
    case "ALREADY_USED":
    case "CODE_USED": return "used";
    case "BAD_CODE": return "invalid";
    case "EXPIRED": return "expired";
    case "OWN_COMPANY": return "own";
    case "ALREADY_MEMBER": return "member";
  }
  if (failure.status === 404) return "invalid";
  if (failure.status === 409) return "used";
  if (failure.status === 410) return "expired";
  return "failed";
}
