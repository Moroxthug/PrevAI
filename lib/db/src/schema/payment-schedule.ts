import { z } from "zod/v4";

// Structured payment schedule attached to quotes (and later copied onto
// contracts). This is what drives deposit / progress / final invoicing:
// the free-text `condizioniPagamento` lines stay as the human-readable
// rendering, the schedule is the machine-readable source of truth.

export const paymentTermTypeSchema = z.enum([
  "deposit",
  "milestone",
  "completion",
  "holdback_release",
]);

export const paymentTriggerSchema = z.enum([
  "on_signing", // due when the contract is signed
  "milestone", // due when the linked milestone is completed (milestoneKey)
  "on_completion", // due at substantial completion / final walkthrough
  "days_after_signing", // due N days after signing (offsetDays)
  "holdback_release", // due once the lien holdback period expires
]);

export const paymentTermSchema = z.object({
  id: z.string().min(1),
  type: paymentTermTypeSchema,
  label: z.string().min(1).max(200),
  trigger: paymentTriggerSchema,
  /** Key of the milestone that releases this term (trigger = "milestone"). Assigned in Phase 2. */
  milestoneKey: z.string().max(100).optional(),
  /** Offset used by "days_after_signing". */
  offsetDays: z.number().int().min(0).max(3650).optional(),
  amountType: z.enum(["percent", "fixed"]),
  /** Percentuale del totale contratto (0-100) o importo fisso in EUR (non centesimi — come i totali del preventivo). */
  value: z.number().min(0),
  /** Invoice due N days after issue (net terms). */
  dueDays: z.number().int().min(0).max(365).default(15),
});

export const paymentScheduleSchema = z.object({
  /** V2-2: EUR. "CAD" accettato solo per righe importate da QuoteAI. */
  currency: z.enum(["EUR", "CAD"]).default("EUR"),
  terms: z.array(paymentTermSchema).min(1).max(20),
  holdback: z
    .object({
      enabled: z.boolean().default(false),
      /** Ritenuta a garanzia contrattuale (art. 1666 c.c.; prassi 5-10 %). */
      percent: z.number().min(0).max(50).default(10),
    })
    .default({ enabled: false, percent: 10 }),
  /** true when derived automatically from free text, false once the user has edited it. */
  derived: z.boolean().default(true),
});

export type PaymentTerm = z.infer<typeof paymentTermSchema>;
export type PaymentSchedule = z.infer<typeof paymentScheduleSchema>;
export type PaymentTrigger = z.infer<typeof paymentTriggerSchema>;

export const DEFAULT_PAYMENT_TERMS_TEXT = [
  "30% acconto alla firma del contratto",
  "30% a completamento prima fase lavori",
  "30% a completamento seconda fase lavori",
  "10% saldo a fine lavori",
];

export function defaultPaymentSchedule(): PaymentSchedule {
  return {
    currency: "EUR",
    derived: true,
    holdback: { enabled: false, percent: 10 },
    terms: [
      { id: "t1", type: "deposit", label: "Acconto alla firma del contratto", trigger: "on_signing", amountType: "percent", value: 30, dueDays: 0 },
      { id: "t2", type: "milestone", label: "A completamento prima fase lavori", trigger: "milestone", amountType: "percent", value: 30, dueDays: 15 },
      { id: "t3", type: "milestone", label: "A completamento seconda fase lavori", trigger: "milestone", amountType: "percent", value: 30, dueDays: 15 },
      { id: "t4", type: "completion", label: "Saldo a fine lavori", trigger: "on_completion", amountType: "percent", value: 10, dueDays: 15 },
    ],
  };
}

const PERCENT_RE = /(\d{1,3}(?:[.,]\d+)?)\s*%/;
const FIXED_RE = /(?:€|EUR\s?|\$|CAD\s?)\s?(\d[\d.,]*)|(\d[\d.,]*)\s?(?:€|EUR\b|euro\b)/i;
const NET_DAYS_RE = /net\s*(\d{1,3})|(?:within|entro)\s*(\d{1,3})\s*(?:days|giorni)|(\d{1,3})\s*(?:days?|giorni|gg)\s*(?:after|from|of|d\.?f\.?|data|dalla?)\s*(?:the\s*)?(?:invoice|fattura|f\.?m\.?)?/i;

/** "1.234,56" / "1,234.56" / "2.000" / "2000" → numero (separatore decimale = ultimo tra . e , se seguito da 1-2 cifre). */
function parseAmount(raw: string): number {
  const s = raw.trim();
  const dec = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (dec < 0) return Number(s.replace(/[^\d]/g, ""));
  const decimals = s.slice(dec + 1).replace(/[^\d]/g, "");
  const intPart = s.slice(0, dec).replace(/[^\d]/g, "");
  if (decimals.length === 3) return Number(intPart + decimals); // "2.000" → 2000
  return Number(intPart + "." + (decimals || "0"));
}

function classify(text: string): { type: PaymentTerm["type"]; trigger: PaymentTrigger } {
  const t = text.toLowerCase();
  if (/holdback|ritenuta|svincolo/.test(t)) return { type: "holdback_release", trigger: "holdback_release" };
  if (/deposit|acconto|anticipo|caparra|firma|signing|signature|accettazione|acceptance|upfront|up-front|booking|retainer|ordine/.test(t)) {
    return { type: "deposit", trigger: "on_signing" };
  }
  // "Substantial completion" / "SAL" è una fase intermedia, non il saldo.
  if (/substantial|\bsal\b|stato avanzamento|fase|avanzamento/.test(t)) return { type: "milestone", trigger: "milestone" };
  if (/final|completion|walkthrough|walk-through|handover|hand-over|balance|saldo|fine lavori|ultimazione|consegna|collaudo/.test(t)) {
    return { type: "completion", trigger: "on_completion" };
  }
  return { type: "milestone", trigger: "milestone" };
}

/**
 * Best-effort parser that turns the AI-written payment terms
 * ("35% upon substantial completion", "$2,000 deposit on signing") into a
 * structured schedule. Falls back to the default 15/35/35/15 split when the
 * text cannot be interpreted or the percentages do not add up.
 */
export function derivePaymentScheduleFromText(
  lines: string[] | null | undefined,
  quoteTotal: number,
): PaymentSchedule {
  const clean = (lines ?? []).map((l) => (l ?? "").trim()).filter(Boolean);
  if (clean.length === 0) return defaultPaymentSchedule();

  const terms: PaymentTerm[] = [];

  clean.forEach((line, i) => {
    const pct = PERCENT_RE.exec(line);
    const fixed = FIXED_RE.exec(line);
    const net = NET_DAYS_RE.exec(line);
    const dueDays = net ? Number(net[1] ?? net[2] ?? net[3]) : undefined;
    const { type, trigger } = classify(line);

    if (pct) {
      terms.push({
        id: `t${i + 1}`,
        type,
        label: line.replace(PERCENT_RE, "").replace(/^[\s\-–:,]+/, "").trim() || line,
        trigger,
        amountType: "percent",
        value: Number(pct[1].replace(",", ".")),
        dueDays: dueDays ?? (trigger === "on_signing" ? 0 : 15),
      });
    } else if (fixed && quoteTotal > 0) {
      terms.push({
        id: `t${i + 1}`,
        type,
        label: line.replace(FIXED_RE, "").replace(/^[\s\-–:,]+/, "").trim() || line,
        trigger,
        amountType: "fixed",
        value: parseAmount(fixed[1] ?? fixed[2] ?? "0"),
        dueDays: dueDays ?? (trigger === "on_signing" ? 0 : 15),
      });
    }
    // Lines like "Payment by e-transfer or cheque" are conditions, not
    // tranches: they are simply skipped.
  });

  const percentSum = terms.filter((t) => t.amountType === "percent").reduce((s, t) => s + t.value, 0);
  const fixedSum = terms.filter((t) => t.amountType === "fixed").reduce((s, t) => s + t.value, 0);
  const coveredPercent = percentSum + (quoteTotal > 0 ? (fixedSum / quoteTotal) * 100 : 0);

  const usable = terms.length > 0 && Math.abs(coveredPercent - 100) <= 1.5;
  if (!usable) {
    // Single "100% on completion" style quotes are still valid.
    if (terms.length === 1 && terms[0].amountType === "percent" && terms[0].value === 100) {
      return { currency: "EUR", derived: true, holdback: { enabled: false, percent: 10 }, terms };
    }
    return defaultPaymentSchedule();
  }

  return {
    currency: "EUR",
    derived: true,
    holdback: { enabled: false, percent: 10 },
    terms,
  };
}

/** Importo (EUR, 2 decimali) di una rata rispetto al totale contratto. */
export function paymentTermAmount(term: PaymentTerm, total: number): number {
  const raw = term.amountType === "percent" ? (total * term.value) / 100 : term.value;
  return Math.round(raw * 100) / 100;
}

/** Validates that a user-edited schedule covers exactly 100% of the total (±$1). */
export function validatePaymentSchedule(schedule: PaymentSchedule, total: number): string | null {
  const sum = schedule.terms.reduce((s, t) => s + paymentTermAmount(t, total), 0);
  if (total > 0 && Math.abs(sum - total) > 1) {
    return `Payment terms add up to ${sum.toFixed(2)} but the quote total is ${total.toFixed(2)}.`;
  }
  const signing = schedule.terms.filter((t) => t.trigger === "on_signing");
  if (signing.length > 1) return "Only one term can be due on signing.";
  return null;
}

/** Human-readable lines for PDFs / emails, kept in sync with the structured schedule. */
export function paymentScheduleToText(schedule: PaymentSchedule): string[] {
  return schedule.terms.map((t) => {
    const amount = t.amountType === "percent" ? `${t.value}%` : `€ ${t.value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
    return `${amount} ${t.label}`.trim();
  });
}
