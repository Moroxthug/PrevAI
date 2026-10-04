// Onboarding's calls the generated hooks don't cover (the web app's saveDetails, saveSetup, invite
// and makeCodes). The wrapped fetch in api.ts adds the token and the acting company.
import { api } from "./api";
import { kvSet } from "./kv";
import { API_ROLE, type CompanySetup, type PersonRole } from "./onboarding";

export const onboardingApi = {
  /** Provincia, numero REA e IBAN (il nome dell'impresa non serve). */
  saveDetails: (body: { province: string | null; reaNumber: string | null; iban: string | null }) =>
    api("/api/business-profile", { method: "PUT", body }),
  /** Che lavoro fai e quanto è grande l'impresa: il server non ha ancora dove tenerlo, resta sul telefono. */
  saveSetup: (body: CompanySetup) => kvSet("prevai.companySetup", JSON.stringify(body)),
  invite: (email: string, role: PersonRole) =>
    api("/api/team/members/invite", { method: "POST", body: { email: email.trim(), role: API_ROLE[role], send: true } }),
  /** Un codice per volta: il server ne rilascia uno a ogni chiamata. */
  async makeCodes(count: number) {
    const codes: { id: string; code: string }[] = [];
    for (let i = 0; i < count; i++) {
      const made = await api<{ code: string; memberId: string }>("/api/team/codes", { method: "POST", body: { role: API_ROLE.crew } });
      codes.push({ id: made.memberId, code: made.code });
    }
    return { codes };
  },
};
