import { getTaxProfile, type InvoiceLine, type InvoiceTaxLine, type InvoiceStatus, type PaymentTerm } from "@workspace/db";

// ── Invoice math ─────────────────────────────────────────────────────────────
// Pure functions, no DB: everything that turns a payment schedule, a
// province and a holdback percentage into the cents printed on an invoice.
// Unit-run by `scripts` / the Phase 4 smoke test.
//
// Ritenuta a garanzia (art. 1666 c.c., prassi appalti privati): trattenuta
// sull'IMPONIBILE dei lavori; l'IVA sulla parte trattenuta si applica quando
// la ritenuta viene svincolata (collaudo / fine garanzia). Quindi un SAL
// applica l'IVA su (imponibile − ritenuta) e il documento di svincolo fattura
// gli importi trattenuti più la relativa IVA.

export type InvoiceAmounts = {
  subtotalCents: number;
  holdbackPercent: number;
  holdbackCents: number;
  taxableCents: number;
  taxLines: InvoiceTaxLine[];
  taxCents: number;
  totalCents: number;
};

export type RegistrationNumbers = { vatNumber?: string | null };

function round(n: number): number {
  return Math.round(n);
}

/** Scomposizione IVA su un imponibile in centesimi, con la P. IVA accanto alla riga. `taxCode` è il regime (IVA22/IVA10/…); in assenza, aliquota ordinaria. */
export function taxLinesFor(taxableCents: number, taxCode: string | null | undefined, reg: RegistrationNumbers = {}): InvoiceTaxLine[] {
  const profile = getTaxProfile(taxCode);
  return profile.components.map((c) => ({
    code: c.code,
    label: c.label,
    rate: c.rate,
    // Rate is a percent (13 → 13%); amounts stay integer cents.
    amountCents: round((taxableCents * c.rate) / 100),
    registrationNumber: reg.vatNumber ?? null,
  }));
}

export function sumLines(lines: InvoiceLine[]): number {
  return lines.reduce((s, l) => s + l.amountCents, 0);
}

export function lineFrom(description: string, unitCents: number, quantity = 1): InvoiceLine {
  return { description, quantity, unitCents, amountCents: round(quantity * unitCents) };
}

/**
 * Computes holdback, taxable base, taxes and total for a set of lines.
 * `holdbackPercent` = 0 for deposits, manual invoices and the release itself.
 */
export function computeInvoiceAmounts(params: { lines: InvoiceLine[]; taxCode: string | null | undefined; holdbackPercent?: number; registration?: RegistrationNumbers }): InvoiceAmounts {
  const subtotalCents = sumLines(params.lines);
  const holdbackPercent = Math.max(0, Math.min(50, Math.round(params.holdbackPercent ?? 0)));
  // Never withhold on a negative (credit) invoice.
  const holdbackCents = subtotalCents > 0 ? round((subtotalCents * holdbackPercent) / 100) : 0;
  const taxableCents = subtotalCents - holdbackCents;
  const taxLines = taxLinesFor(taxableCents, params.taxCode, params.registration);
  const taxCents = taxLines.reduce((s, l) => s + l.amountCents, 0);
  return { subtotalCents, holdbackPercent, holdbackCents, taxableCents, taxLines, taxCents, totalCents: taxableCents + taxCents };
}

/**
 * Pre-tax value of a payment term. Percent terms apply to the contract's
 * pre-tax subtotal; fixed terms are expressed incl. tax in the schedule (they
 * match the quote total), so the tax is backed out with the contract's rate.
 */
export function termSubtotalCents(term: Pick<PaymentTerm, "amountType" | "value">, contract: { subtotalCents: number; totalCents: number }): number {
  if (term.amountType === "percent") return round((contract.subtotalCents * term.value) / 100);
  const fixedIncl = round(term.value * 100);
  if (contract.totalCents <= 0 || contract.subtotalCents <= 0) return fixedIncl;
  return round((fixedIncl * contract.subtotalCents) / contract.totalCents);
}

/**
 * The final invoice bills whatever is still unbilled: the job's pre-tax value
 * (contract + signed change orders) minus the pre-tax subtotal of every
 * non-void invoice issued so far. This absorbs rounding and change orders
 * without a separate reconciliation step. Never negative.
 */
export function finalInvoiceSubtotalCents(params: { jobSubtotalCents: number; invoicedSubtotalCents: number }): number {
  return Math.max(0, params.jobSubtotalCents - params.invoicedSubtotalCents);
}

/** Giorni dopo la fine lavori per lo svincolo della ritenuta a garanzia (art. 1666 c.c.: termine contrattuale, di prassi 30-60 giorni dal collaudo). */
export function lienPeriodDays(_province?: string | null | undefined): number {
  return 60;
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/**
 * Status after payments: paid when the balance is covered, partially paid
 * when something was received, overdue when unpaid past the due date.
 * Drafts and voids never change.
 */
export function statusAfterPayment(params: { status: InvoiceStatus; totalCents: number; paidCents: number; dueDate: Date; now?: Date }): InvoiceStatus {
  const { status, totalCents, paidCents } = params;
  if (status === "draft" || status === "void") return status;
  // Credit notes (negative totals) are "paid" the moment they are applied.
  if (totalCents <= 0) return "paid";
  if (paidCents >= totalCents) return "paid";
  const now = params.now ?? new Date();
  if (paidCents > 0) return "partially_paid";
  if (now > params.dueDate) return "overdue";
  // A customer's bank-transfer self-report holds until the contractor confirms
  // or rejects it — it isn't a byproduct of the payment math, only of those
  // two explicit actions (see invoices/service.ts).
  if (status === "pending_confirmation") return "pending_confirmation";
  return status === "viewed" ? "viewed" : "sent";
}

/** Outstanding balance, never negative for display purposes. */
export function balanceCents(inv: { totalCents: number; paidCents: number }): number {
  return Math.max(0, inv.totalCents - inv.paidCents);
}

export type AgingBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

export function agingBucket(dueDate: Date, now = new Date()): AgingBucket {
  const days = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000);
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90_plus";
}

/** Accounts-receivable aging over open invoices. */
export function arAging(invoices: { status: InvoiceStatus; totalCents: number; paidCents: number; dueDate: Date }[], now = new Date()): Record<AgingBucket, number> & { totalCents: number; overdueCents: number } {
  const out = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalCents: 0, overdueCents: 0 };
  for (const inv of invoices) {
    if (inv.status === "draft" || inv.status === "void" || inv.status === "paid") continue;
    const bal = balanceCents(inv);
    if (bal <= 0) continue;
    const b = agingBucket(inv.dueDate, now);
    out[b] += bal;
    out.totalCents += bal;
    if (b !== "current") out.overdueCents += bal;
  }
  return out;
}

/** Reminder schedule (days past due) shared by the cron and the UI hint. */
export const REMINDER_AFTER_DAYS = [3, 7, 14] as const;
