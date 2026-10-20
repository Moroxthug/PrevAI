import { JOB_ROLES, SENSITIVE_KEYS, type JobRole, type SensitiveKey, type SensitiveOverrides } from "@workspace/db";

// POCKET-5 (riga 62, QuoteAI 128.7): i mestieri e con cosa parte ognuno. Il ruolo con cui una persona entra (titolare, amministratore, ufficio, capo cantiere,
// contabile, solo lettura) decide cosa le permette il server; il mestiere decide cosa mostra per primo il telefono e come partono i quattro accessi delicati.
// A una persona si dà un mestiere, o ha quello più vicino al suo ruolo.

export type Access = "owner" | "admin" | "office" | "foreman" | "viewer" | "bookkeeper";

/** The four switches in the order the board draws them, as each role starts. */
const START: Record<JobRole, [boolean, boolean, boolean, boolean]> = {
  owner: [true, true, true, true],
  officeManager: [false, true, true, true],
  estimator: [false, true, false, false],
  projectManager: [false, true, true, false],
  dispatcher: [false, false, true, false],
  bookkeeper: [true, true, true, true],
  safety: [false, false, false, false],
  foreman: [false, false, true, false],
  crew: [false, false, false, false],
};

export function defaultSensitive(role: JobRole): Record<SensitiveKey, boolean> {
  const s = START[role];
  return { payRates: s[0], margins: s[1], approveTime: s[2], sendInvoices: s[3] };
}

/** What the person has: the role's starting point with their own exceptions on top. The owner always has all four. */
export function effectiveSensitive(role: JobRole, overrides: SensitiveOverrides | null | undefined, isOwner = false): Record<SensitiveKey, boolean> {
  if (isOwner || role === "owner") return { payRates: true, margins: true, approveTime: true, sendInvoices: true };
  const base = defaultSensitive(role);
  for (const k of SENSITIVE_KEYS) if (typeof overrides?.[k] === "boolean") base[k] = overrides[k]!;
  return base;
}

/** Only what differs from the role's start is kept, so a role's default can move without leaving stale copies. */
export function cleanOverrides(role: JobRole, wanted: SensitiveOverrides): SensitiveOverrides {
  const base = defaultSensitive(role);
  const out: SensitiveOverrides = {};
  for (const k of SENSITIVE_KEYS) if (typeof wanted[k] === "boolean" && wanted[k] !== base[k]) out[k] = wanted[k];
  return out;
}

/** The job role someone has before anyone gives them one: the closest to what they can do. */
export function defaultJobRole(access: Access): JobRole {
  switch (access) {
    case "owner": return "owner";
    case "admin": case "office": return "officeManager";
    case "foreman": return "foreman";
    case "bookkeeper": return "bookkeeper";
    case "viewer": return "safety";
  }
}

export const isJobRole = (s: string): s is JobRole => (JOB_ROLES as readonly string[]).includes(s);

/** Le Home per ruolo sono del piano Elite (in QuoteAI Business): sotto, tutti hanno la Home del titolare. */
export const roleHomesIncluded = (plan: string): boolean => plan === "monthly_elite";
