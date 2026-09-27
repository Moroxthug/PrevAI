import { PROVINCE_ITALIANE } from "@workspace/config";
// Client-side types/helpers for the structured payment schedule. The server
// (lib/db/src/schema/payment-schedule.ts) is the source of truth; this file
// mirrors the shape and the arithmetic so the editor can validate live.

export type PaymentTermType = "deposit" | "milestone" | "completion" | "holdback_release";
export type PaymentTrigger = "on_signing" | "milestone" | "on_completion" | "days_after_signing" | "holdback_release";

export type PaymentTerm = {
  id: string;
  type: PaymentTermType;
  label: string;
  trigger: PaymentTrigger;
  milestoneKey?: string;
  offsetDays?: number;
  amountType: "percent" | "fixed";
  value: number;
  dueDays: number;
};

export type PaymentSchedule = {
  currency: "EUR";
  terms: PaymentTerm[];
  holdback: { enabled: boolean; percent: number };
  derived: boolean;
};

/** Province italiane per i selettori (sigla + nome), da @workspace/config. */
export const PROVINCE_SELECT: { code: string; name: string }[] = PROVINCE_ITALIANE.map((p) => ({ code: p.sigla, name: p.nome }));

export function newTermId(): string {
  return `t${Math.random().toString(36).slice(2, 8)}`;
}

export function triggerForType(type: PaymentTermType): PaymentTrigger {
  switch (type) {
    case "deposit": return "on_signing";
    case "completion": return "on_completion";
    case "holdback_release": return "holdback_release";
    default: return "milestone";
  }
}

export function paymentTermAmount(term: PaymentTerm, total: number): number {
  const raw = term.amountType === "percent" ? (total * term.value) / 100 : term.value;
  return Math.round(raw * 100) / 100;
}

export function scheduleTotal(schedule: PaymentSchedule, total: number): number {
  return Math.round(schedule.terms.reduce((s, t) => s + paymentTermAmount(t, total), 0) * 100) / 100;
}

/** Returns a translation key describing the problem, or null when valid. */
export function validateSchedule(schedule: PaymentSchedule, total: number): "sum" | "signing" | "empty" | null {
  if (schedule.terms.length === 0) return "empty";
  if (total > 0 && Math.abs(scheduleTotal(schedule, total) - total) > 1) return "sum";
  if (schedule.terms.filter((t) => t.trigger === "on_signing").length > 1) return "signing";
  return null;
}
