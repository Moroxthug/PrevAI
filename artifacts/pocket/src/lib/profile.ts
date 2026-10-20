// The company's profile and the choices the Settings pages save (routes/business-profile.ts): its shape on the phone, the defaults where the server has
// nothing yet, and the small rules (the deposit that takes from the last payment, the net days, the holdback). Pure, so they are tested (profile.test.ts).

export type PaymentTerm = {
  id: string; type: "deposit" | "milestone" | "completion" | "holdback_release"; label: string;
  trigger: "on_signing" | "milestone" | "on_completion" | "days_after_signing" | "holdback_release"; milestoneKey?: string; offsetDays?: number;
  amountType: "percent" | "fixed"; value: number; dueDays: number;
};
export type PaymentSchedule = { currency: "EUR"; terms: PaymentTerm[]; holdback: { enabled: boolean; percent: number }; derived: boolean };

/** PrevAI's automations (lib/db business-profiles.ts AutomationSettings). There are no texts, so nothing about SMS. */
export type Automation = {
  notifyOnQuoteAccepted: boolean; autoDraftContract: boolean; autoSendInvoices: boolean; invoiceAutoSendAfterHours: number; invoiceReminders: boolean; scheduleReminders: boolean;
};

export type TaxPage = { split?: boolean; showAs?: "line" | "included"; perLine?: boolean; showNumber?: boolean; exempt?: { clientId: string; reason: "rebate" | "exempt" }[] };
export type QuotesPage = { goodBetterBest?: boolean; acceptanceEmail?: boolean; terms?: string; followupMessages?: string[]; followupOn?: boolean[]; followupDays?: number[]; reviewDelayDays?: number; leadFollowupDays?: number };
export type InvoicesPage = {
  numberPrefix?: string; nextNumber?: number; terms?: "receipt" | "net15" | "net30"; sendDelayDays?: number;
  reminderBefore?: boolean; reminderDue?: boolean; reminderAfter?: boolean; reminderBy?: "email" | "sms" | "both";
  payEtransfer?: boolean; payCheque?: boolean; chequePayableTo?: string; holdbackOn?: boolean; holdbackPercent?: number; holdbackReleaseDays?: number;
  lateFeeOn?: boolean; lateFeeRate?: number; lateFeeAfterDays?: number;
};
/** The quote defaults PrevAI's profile has no column for: kept on this page, not read by the quote maker yet. */
export type DefaultsPage = { validDays?: number; markup?: number; copyToMe?: boolean };
export type PocketSettings = { tax?: TaxPage; quotes?: QuotesPage; invoices?: InvoicesPage; defaults?: DefaultsPage } & Record<string, Record<string, unknown> | undefined>;

/** GET /api/business-profile in PrevAI: the Italian identity (P. IVA in `vatNumber`, codice fiscale, REA, IBAN, SdI) and what migration 0026 added for the app. */
export type Profile = {
  userId: string; companyName: string; vatNumber: string | null; address: string | null; logoUrl: string | null; phone: string | null; email: string | null;
  province: string | null; codiceFiscale: string | null; codiceSdi: string | null; reaNumber: string | null; iban: string | null;
  apiKey?: string | null; legalName: string | null; website: string | null; brandColor: string | null;
  defaultPaymentSchedule: PaymentSchedule | null;
  googleReviewUrl: string | null; secondaryReviewUrl: string | null; sendReviewRequests: boolean;
  automationSettings: Automation; pocketSettings: PocketSettings; plan: string; features: Record<string, boolean>;
};

export type ProfilePatch = Partial<Omit<Profile, "userId" | "plan" | "features" | "automationSettings" | "pocketSettings">> & {
  automationSettings?: Partial<Automation>;
  pocketSettings?: { [page: string]: Record<string, unknown> };
};

/** The server's own starting schedule (lib/db payment-schedule.ts), for a company that never set one. */
export function defaultSchedule(): PaymentSchedule {
  return {
    currency: "EUR", derived: true, holdback: { enabled: false, percent: 10 },
    terms: [
      { id: "t1", type: "deposit", label: "Acconto alla firma del contratto", trigger: "on_signing", amountType: "percent", value: 30, dueDays: 0 },
      { id: "t2", type: "milestone", label: "A completamento prima fase lavori", trigger: "milestone", amountType: "percent", value: 30, dueDays: 15 },
      { id: "t3", type: "milestone", label: "A completamento seconda fase lavori", trigger: "milestone", amountType: "percent", value: 30, dueDays: 15 },
      { id: "t4", type: "completion", label: "Saldo a fine lavori", trigger: "on_completion", amountType: "percent", value: 10, dueDays: 15 },
    ],
  };
}

/** The quote defaults with the board's starting values. */
export function defaultsOf(p: Pick<Profile, "pocketSettings"> | null | undefined): Required<DefaultsPage> {
  const d = p?.pocketSettings?.defaults ?? {};
  return { validDays: typeof d.validDays === "number" ? d.validDays : 30, markup: typeof d.markup === "number" ? d.markup : 0, copyToMe: d.copyToMe === true };
}

export const scheduleOf = (p: Pick<Profile, "defaultPaymentSchedule"> | null | undefined): PaymentSchedule => p?.defaultPaymentSchedule ?? defaultSchedule();

const isPercentDeposit = (t: PaymentTerm) => t.type === "deposit" && t.amountType === "percent";

/** The default deposit, in percent (0 when the schedule asks for none). */
export const depositOf = (s: PaymentSchedule): number => s.terms.find(isPercentDeposit)?.value ?? 0;

/**
 * The schedule with a new deposit: what the deposit gained comes off the last percentage payment, and what it lost goes back to it, so the terms
 * still add up. Null when the last payment can't give that much (the deposit would push it below nothing), or when there is no payment to move it to.
 */
export function withDeposit(s: PaymentSchedule, value: number, label: string): PaymentSchedule | null {
  const terms = s.terms.map((t) => ({ ...t }));
  const tail = terms.filter((t) => t.type !== "deposit" && t.type !== "holdback_release" && t.amountType === "percent").at(-1);
  if (!tail) return null;
  const dep = terms.find(isPercentDeposit);
  const delta = value - (dep?.value ?? 0);
  if (tail.value - delta < 0) return null;
  tail.value = Math.round((tail.value - delta) * 100) / 100;
  if (dep) dep.value = value;
  else terms.unshift({ id: `t${terms.length + 1}d`, type: "deposit", label, trigger: "on_signing", amountType: "percent", value, dueDays: 0 });
  return { ...s, terms: terms.filter((t) => t.type !== "deposit" || t.value > 0), derived: false };
}

export type Net = "receipt" | "net15" | "net30";
const NET_DAYS: Record<Net, number> = { receipt: 0, net15: 15, net30: 30 };
export const NETS: Net[] = ["receipt", "net15", "net30"];

/** The payment terms: the days an invoice gives, read from the payments after the deposit (the deposit is due on signing). */
export function netOf(s: PaymentSchedule): Net {
  const t = s.terms.find((x) => x.type !== "deposit" && x.type !== "holdback_release");
  const d = t?.dueDays ?? 15;
  return d <= 0 ? "receipt" : d <= 22 ? "net15" : "net30";
}

export function withNet(s: PaymentSchedule, net: Net): PaymentSchedule {
  return { ...s, derived: false, terms: s.terms.map((t) => (t.type === "deposit" || t.type === "holdback_release" ? t : { ...t, dueDays: NET_DAYS[net] })) };
}

export function withHoldback(s: PaymentSchedule, enabled: boolean, percent = s.holdback.percent): PaymentSchedule {
  return { ...s, derived: false, holdback: { enabled, percent } };
}

/** The day after which the invoices' send is delayed, from the server's hours (0 = sent as drafted). */
export const sendDelayDays = (a: Pick<Automation, "invoiceAutoSendAfterHours">): number => Math.round(a.invoiceAutoSendAfterHours / 24);

/** One value of a Settings page, read with its default. */
export function pageOf<K extends "tax" | "quotes" | "invoices">(p: Pick<Profile, "pocketSettings"> | null | undefined, key: K): NonNullable<PocketSettings[K]> {
  return (p?.pocketSettings?.[key] ?? {}) as NonNullable<PocketSettings[K]>;
}

/** A page the server keeps as sent (messaging, templates, widget): one value is read with its default. */
export function extraPage(p: Pick<Profile, "pocketSettings"> | null | undefined, key: string): Record<string, unknown> {
  return (p?.pocketSettings?.[key] ?? {}) as Record<string, unknown>;
}

export type BrandKey = "violet" | "harbour" | "forest" | "brick" | "teal" | "charcoal";
/** The brand colours the board offers (SetCompany swatches) are in theme/board.ts (src/ui stays free of typed colours); the first is the violet of the app. */
export const BRAND_KEYS: BrandKey[] = ["violet", "harbour", "forest", "brick", "teal", "charcoal"];

/** A partita IVA: 11 digits (an "IT" in front and spaces are ignored). True when it looks right; nothing is checked with the Agenzia delle Entrate. */
export const looksLikePiva = (v: string): boolean => /^\d{11}$/.test(v.replace(/\s+/g, "").replace(/^IT/i, ""));

/** A codice fiscale: 16 letters and digits for a person, or 11 digits for a company. */
export const looksLikeCf = (v: string): boolean => { const x = v.replace(/\s+/g, "").toUpperCase(); return /^[A-Z0-9]{16}$/.test(x) || /^\d{11}$/.test(x); };

/** The profile with a patch applied as the server will: pages and the automation settings change only the keys sent. */
export function applyPatch(p: Profile, patch: ProfilePatch): Profile {
  const { automationSettings, pocketSettings, ...rest } = patch;
  const pages: PocketSettings = { ...p.pocketSettings };
  for (const [k, v] of Object.entries(pocketSettings ?? {})) pages[k] = { ...(pages[k] ?? {}), ...v };
  return { ...p, ...rest, automationSettings: { ...p.automationSettings, ...(automationSettings ?? {}) }, pocketSettings: pages };
}

/** Which swatch a saved colour is (the violet when it is none of them). */
export const brandKeyOf = (hex: string | null | undefined, colours: Record<BrandKey, string>): BrandKey => BRAND_KEYS.find((k) => colours[k].toLowerCase() === (hex ?? "").toLowerCase()) ?? "violet";

/** The next pro-forma number as the server writes it (PF-2026-0004, invoices/service.ts): one more than the highest of this year's, or the first. */
export function nextInvoiceNumber(numbers: string[], year: number): string {
  const re = new RegExp(`^PF-${year}-(\\d+)$`);
  const top = numbers.reduce((n, x) => Math.max(n, Number(re.exec(x)?.[1] ?? 0)), 0);
  return `PF-${year}-${String(top + 1).padStart(4, "0")}`;
}
