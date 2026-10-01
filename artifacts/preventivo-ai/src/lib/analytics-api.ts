// Thin fetch client for the Phase 5 analytics endpoints.
import { apiRequest as req } from "@/lib/jobs-api";
import type { CostCategory } from "@/lib/jobs-api";
import type { AgingDto } from "@/lib/invoices-api";

type CategoryPointDto = { category: CostCategory; plannedCents: number; actualCents: number; pendingCents: number; varianceCents: number; usedPercent: number | null };
type CurvePointDto = { week: string; actualCents: number; plannedCents: number; invoicedCents: number; collectedCents: number };
type MilestoneVarianceDto = { id: string; title: string; status: string; plannedDays: number | null; slipDays: number; state: "done_on_time" | "done_late" | "on_track" | "late" | "not_started_late" | "pending" };
type EarnedValueDto = {
  earnedCents: number;
  invoicedSubtotalCents: number;
  billingGapCents: number;
  budgetEarnedCents: number;
  costCents: number;
  costPerformance: number | null;
  projectedFinalCostCents: number | null;
  projectedMarginPercent: number | null;
};

export type JobAnalyticsDto = {
  subtotalCents: number;
  budgetCents: number;
  costCents: number;
  pendingCostCents: number;
  categories: CategoryPointDto[];
  curve: CurvePointDto[];
  schedule: { rows: MilestoneVarianceDto[]; daysBehind: number; lateCount: number; plannedEnd: string | null; forecastEnd: string | null };
  earned: EarnedValueDto;
  invoices: { invoicedCents: number; collectedCents: number; outstandingCents: number; overdueCents: number; draftCount: number; upcomingCents: number };
};

type MonthPointDto = { month: string; invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null };
type CashWeekDto = { week: string; dueCents: number; overdueCents: number; expectedCents: number; outflowCents: number; netCents: number; cumulativeCents: number };
export type RiskFlag = "over_budget" | "budget_burn" | "behind_schedule" | "overdue_invoices" | "billing_gap" | "unbilled_completion";
type JobRiskDto = { id: string; name: string; flags: RiskFlag[]; score: number; detail: { overBudgetCents: number; burnPercent: number | null; daysBehind: number; overdueCents: number; billingGapCents: number } };
type JobMarginDto = { id: string; name: string; clientName: string | null; status: string; subtotalCents: number; costCents: number; marginPercent: number | null; progressPercent: number };

export type CompanyAnalyticsDto = {
  months: MonthPointDto[];
  totals: { invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null; outstandingCents: number; overdueCents: number; pipelineCents: number };
  aging: AgingDto;
  cashFlow: CashWeekDto[];
  jobs: { byStatus: Record<string, number>; active: number; risks: JobRiskDto[]; margins: JobMarginDto[] };
};

export const analyticsApi = {
  job: (id: string) => req<JobAnalyticsDto>(`/api/jobs/${id}/analytics`),
  company: (months = 6) => req<CompanyAnalyticsDto>(`/api/analytics/company?months=${months}`),
};

// PREZZI-1 (riga 53): controllo prezzi del preventivo.
export type PriceCheckFindingDto = {
  chapter: string;
  index: number;
  description: string;
  um: string;
  quantita: number;
  quotedUnitPrice: number;
  referenceUnitPrice: number;
  referenceName: string;
  referenceUnit: string | null;
  source: "listino" | "scontrini" | "storico";
  sampleCount: number;
  vendor: string | null;
  changePct: number;
  deltaTotal: number;
  belowCost: boolean;
  marginPct: number | null;
};
export type PriceCheckDto = { checkedAt: string; thresholdPct: number; linesChecked: number; findings: PriceCheckFindingDto[]; belowCostCount: number; deltaTotal: number; editable: boolean; references: number };

export const priceCheckApi = {
  check: (quoteId: string) => req<PriceCheckDto>(`/api/quotes/${quoteId}/price-check`),
  reprice: (quoteId: string, items: { chapter: string; index: number; unitPrice: number }[]) =>
    req<{ applied: number; totale: { from: number; to: number } }>(`/api/quotes/${quoteId}/reprice`, { method: "POST", body: JSON.stringify({ items }) }),
};
