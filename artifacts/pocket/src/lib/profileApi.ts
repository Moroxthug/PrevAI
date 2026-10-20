// The company's profile and a person's own choices: the server calls (routes/business-profile.ts, routes/member-prefs.ts, routes/push.ts, routes/fiscale.ts).
import { api } from "./api";
import { uploadFile, type UploadFile } from "./jobUpload";
import type { Profile, ProfilePatch } from "./profile";

export type MemberPrefs = { voice?: "ember" | "tide" | "stone"; speak?: boolean; confirmSend?: boolean; jobTitle?: string; mobile?: string; signature?: string; home?: { order?: string[]; on?: Record<string, boolean>; tabs?: string[]; density?: 0 | 1 } };
export type Numbers = { made: number; sent: number; won: number; wonPercent: number | null; invoicedCents: number; jobs: number; activeJobs: number };
/** `scope`: PrevAI keeps no "made by" on quotes and invoices, so the numbers are the company's ("company"). */
export type MyNumbers = { period: "month" | "quarter" | "year"; scope?: "person" | "company"; now: Numbers; before: Numbers; months: { month: string; sent: number; won: number; invoicedCents: number }[] };
/** The push kinds this person may get (their role sees the area) and the ones they switched off. */
export type PushPrefs = { categories: string[]; muted: string[] };
type PushConfig = { kinds: { kind: string; allowed: boolean }[]; muted: string[] };
/** PrevAI Fisco's own profile: only the regime is read here (forfettario: no IVA on invoices). */
export type FiscalProfile = { profilo: { regime: "forfettario" | "altro" } };

export const profileApi = {
  get: () => api<Profile>("/api/business-profile"),
  /** Only what is given changes. */
  save: (patch: ProfilePatch) => api<Profile>("/api/business-profile", { method: "PUT", body: patch }),
  logo: (file: UploadFile) => uploadFile<{ logoUrl: string }>("/api/business-profile/logo", "logo", file, {}),
  numbers: (period: "month" | "quarter" | "year") => api<MyNumbers>(`/api/me/numbers?period=${period}`),
  prefs: () => api<{ preferences: MemberPrefs }>("/api/me/preferences"),
  savePrefs: (p: MemberPrefs) => api<{ preferences: MemberPrefs }>("/api/me/preferences", { method: "PUT", body: p }),
  push: async (): Promise<PushPrefs> => {
    const c = await api<PushConfig>("/api/push/config");
    return { categories: c.kinds.filter((k) => k.allowed).map((k) => k.kind), muted: c.muted };
  },
  savePush: async (muted: string[]): Promise<PushPrefs> => {
    const r = await api<{ muted: string[] }>("/api/push/preferences", { method: "PUT", body: { muted } });
    const c = await api<PushConfig>("/api/push/config");
    return { categories: c.kinds.filter((k) => k.allowed).map((k) => k.kind), muted: r.muted };
  },
  fiscal: () => api<FiscalProfile>("/api/fiscale/profilo"),
};
