import { useState } from "react";
import {
  useGetSubscription, useCreateCustomerPortalSession, useCreateCheckoutSession, useGetPlans, getGetSubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Crown, Zap, CheckCircle2, XCircle, CalendarDays, BarChart3, AlertCircle, RefreshCw, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { AddonBillingCard } from "@/components/addon-billing-card";
import { NOTA_IVA, isPianoInAbbonamento, type Periodicita } from "@/lib/prezzi";
import { usageApi } from "@/lib/usage-api";
import { SettingsSection } from "./ui";

// APP-1b: "Piano e fatturazione" e "Utilizzo" diventano una sola sezione.

const PLAN_LABEL: Record<string, string> = { monthly_starter: "Starter", monthly_pro: "Pro", monthly_elite: "Elite" };
/** "Pro" da "monthly_pro"; null senza piano. */
export const planLabelOf = (plan: string | null | undefined): string | null => (plan ? PLAN_LABEL[plan] ?? null : null);

/** App e piano → Piano e fatturazione: l'abbonamento, l'utilizzo del mese e PrevAI Fisco. */
export function PlanSection() {
  return (
    <SettingsSection title="Piano e fatturazione" intro="Il tuo abbonamento, quanto hai usato questo mese e i moduli aggiuntivi. Pagamenti e fatture passano dal portale Stripe.">
      <BillingTab />
      <UsageTab />
    </SettingsSection>
  );
}

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const { t } = useLanguage();
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("dashboard.billing.quotesUsed")}</span><span className="font-semibold">{used} / {limit}</span></div>
      <div className="hbar">
        <i style={{ width: `${pct}%`, background: pct >= 90 ? "var(--red)" : pct >= 70 ? "var(--yellow-dark)" : "var(--navy)" }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{t("dashboard.settings.whatsapp.remaining").replace("{count}", String(limit - used))}</span><span>{t("dashboard.billing.pctUsed").replace("{pct}", String(pct))}</span></div>
    </div>
  );
}

function PlanFeature({ text, ok }: { text: string; ok: boolean }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-foreground" : "text-muted-foreground line-through opacity-50"}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
      {text}
    </li>
  );
}

function BillingTab() {
  const { t } = useLanguage();
  const { data: sub, isLoading } = useGetSubscription();
  const { data: plans } = useGetPlans();
  const createPortal = useCreateCustomerPortalSession();
  const createCheckout = useCreateCheckoutSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  // A-5: ogni piano si compra anche annuale (dieci mensilità).
  const [periodicita, setPeriodicita] = useState<Periodicita>("mensile");

  const handleManage = () => {
    createPortal.mutate(undefined, {
      onSuccess: (r) => { window.open(r.url, "_blank"); },
      onError: () => {
        toast({ title: t("dashboard.settings.billing.portalUnavailableTitle"), description: t("dashboard.settings.billing.portalUnavailableDesc"), variant: "destructive" });
      },
    });
  };

  const handleCheckout = (planId: string) => {
    setLoadingPlanId(planId);
    createCheckout.mutate(
      { data: { planType: planId as "monthly_starter" | "monthly_pro" | "monthly_elite" | "oneshot_watermark" | "oneshot_clean", billing: periodicita } },
      {
        onSuccess: (r) => { window.location.href = r.url; },
        onError: () => {
          setLoadingPlanId(null);
          toast({ title: t("dashboard.settings.billing.errorStartPayment"), variant: "destructive" });
        },
      }
    );
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/payments/sync-subscription", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as { synced: boolean; active?: boolean; plan?: string; message?: string };
      if (data.synced && data.active) {
        await queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
        toast({ title: t("dashboard.settings.billing.syncedTitle"), description: t("dashboard.settings.billing.syncedDesc").replace("{plan}", data.plan ?? "") });
      } else {
        toast({ title: t("dashboard.settings.billing.noSubFoundTitle"), description: data.message ?? t("dashboard.settings.billing.checkStripeDesc"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("dashboard.settings.billing.errorSync"), variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;
  const isStarter = sub?.plan === "monthly_starter";
  const isPro = sub?.plan === "monthly_pro";
  const isElite = sub?.plan === "monthly_elite";
  const isActive = sub?.isActive ?? false;
  const planLabel = isElite ? "Elite" : isPro ? "Pro" : isStarter ? "Starter" : null;
  // A-5: chi è già abbonato può pagare un prezzo storico (es. Elite a 59 € prima
  // del listino a 79 €), che non conserviamo: l'importo vero lo mostra il portale
  // Stripe. Qui si dice solo "Mensile" / "Annuale", mai un listino che potrebbe non essere il suo.
  const planPrice = isPianoInAbbonamento(sub?.plan) ? "Importo e rinnovo nel portale Stripe" : null;
  const renewalDate = sub?.periodEnd ? new Date(sub.periodEnd).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) : null;
  const resetDate = sub?.quotaResetDate ? new Date(sub.quotaResetDate).toLocaleDateString("it-IT", { day: "2-digit", month: "long" }) : null;
  const subscriptionPlans = Array.isArray(plans) ? plans.filter((p) => !!p.interval) : [];

  return (
    <div className="space-y-6">
      {isActive ? (
        <div className={cn("card", `border-2 ${isElite ? "border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50" : isPro ? "border-amber-300 bg-gradient-to-br from-amber-50 to-navy-50" : "border-navy-200 bg-gradient-to-br from-navy-50 to-teal-50"}`)}>
          <div className="card-head pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center ${isElite ? "bg-amber-200" : isPro ? "bg-amber-100" : "bg-navy-100"}`}>
                  {isElite ? <Crown className="h-6 w-6 text-amber-700" /> : isPro ? <Crown className="h-6 w-6 text-amber-600" /> : <Zap className="h-6 w-6 text-navy-500" />}
                </div>
                <div>
                  <h2 className="text-xl">PrevAI {planLabel}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{planPrice}</p>
                </div>
              </div>
              <span className={cn("chip", isElite ? "chip-yellow" : isPro ? "chip-purple" : "chip-teal")}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.billing.active")}
              </span>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {isStarter && sub.quotaUsed != null && sub.quotaLimit != null && (
              <div className="bg-card/70 rounded-[var(--radius)] p-4 border border-navy-100">
                <div className="flex items-center gap-2 mb-3"><BarChart3 className="h-4 w-4 text-navy-500" /><span className="text-sm font-semibold">{t("dashboard.billing.monthlyUsage")}</span></div>
                <QuotaBar used={sub.quotaUsed} limit={sub.quotaLimit} />
                {resetDate && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><RefreshCw className="h-3 w-3" />{t("dashboard.billing.quotaResetsOn").replace("{date}", resetDate)}</p>}
                {(sub.quotaRemaining ?? 0) <= 3 && (sub.quotaRemaining ?? 0) > 0 && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[var(--radius-sm)] p-2.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{t("dashboard.settings.billing.almostOutShort")}
                  </div>
                )}
              </div>
            )}
            <div className="bg-card/70 rounded-[var(--radius)] p-4 border border-navy-100">
              <div className="text-sm font-semibold mb-3">{t("dashboard.billing.includedInPlan")}</div>
              <ul className="space-y-2">
                {isElite ? (
                  <><PlanFeature text={t("dashboard.billing.feature.unlimitedQuotes")} ok /><PlanFeature text={t("dashboard.billing.feature.noWatermark")} ok /><PlanFeature text={t("dashboard.billing.feature.ownLogo")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.allTemplates")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.unlimitedNotesUpload")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.unlimitedVoice")} ok /></>
                ) : isPro ? (
                  <><PlanFeature text={t("dashboard.settings.billing.feature.quotes60PerMonth")} ok /><PlanFeature text={t("dashboard.billing.feature.noWatermark")} ok /><PlanFeature text={t("dashboard.billing.feature.ownLogo")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.allTemplates")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.notesUpload30")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.voiceRecording30")} ok /></>
                ) : (
                  <><PlanFeature text={t("dashboard.settings.billing.feature.quotesPerMonthCount").replace("{count}", String(sub?.quotaLimit ?? 10))} ok /><PlanFeature text={t("dashboard.settings.billing.feature.pdfWithLogo")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.templateStandard")} ok /><PlanFeature text={t("dashboard.settings.billing.feature.pdfNoWatermarkFalse")} ok={false} /><PlanFeature text={t("dashboard.settings.billing.feature.templateProPremium")} ok={false} /></>
                )}
              </ul>
            </div>
            {renewalDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />{t("dashboard.billing.nextRenewal")} <span className="font-medium text-foreground">{renewalDate}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              {(isStarter || isPro) && (
                <button onClick={handleManage} disabled={createPortal.isPending} className="btn btn-navy gap-2">
                  {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}{isStarter ? t("dashboard.billing.upgradeToPro") : t("dashboard.settings.billing.upgradeToElite")}
                </button>
              )}
              <button onClick={handleManage} disabled={createPortal.isPending} className="btn btn-outline-navy gap-2">
                <ArrowUpRight className="h-4 w-4" />{t("dashboard.billing.manageSubscription")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.billing.managedByStripeShort")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card border-dashed">
            <div className="card-head">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-muted flex items-center justify-center"><XCircle className="h-5 w-5 text-muted-foreground" /></div>
                  <div><h2>{t("dashboard.billing.noActiveSubTitle")}</h2><p className="sub mt-0.5">{t("dashboard.settings.billing.noActiveSubDesc")}</p></div>
                </div>
                <button onClick={handleSync} disabled={isSyncing} className="btn btn-outline-navy btn-sm gap-2 shrink-0">
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t("dashboard.settings.billing.verifySubscription")}
                </button>
              </div>
            </div>
          </div>

          {subscriptionPlans.length > 0 && (
            <div role="radiogroup" aria-label="Periodicità" className="flex gap-2 items-center flex-wrap">
              {(["mensile", "annuale"] as const).map((i) => (
                <button key={i} type="button" role="radio" aria-checked={periodicita === i} className={cn("btn btn-sm", periodicita === i ? "btn-navy" : "btn-outline-navy")} onClick={() => setPeriodicita(i)}>
                  {i === "mensile" ? "Mensile" : "Annuale — 2 mesi gratis"}
                </button>
              ))}
              <span className="text-xs text-muted-foreground">Prezzi {NOTA_IVA}</span>
            </div>
          )}
          {subscriptionPlans.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-4">
              {subscriptionPlans.map((plan) => {
                const isPlanPro = plan.id === "monthly_pro";
                const isPlanElite = plan.id === "monthly_elite";
                return (
                  <div key={plan.id} className={cn("card", `flex flex-col ${isPlanPro ? "border-2 border-navy-300 shadow-lg" : isPlanElite ? "border-2 border-amber-300" : ""}`)}>
                    <div className="card-head pb-2">
                      {isPlanPro && <span className="text-[10px] font-bold text-navy-600 uppercase tracking-wider">{t("dashboard.settings.billing.mostPopular")}</span>}
                      {isPlanElite && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{t("dashboard.settings.billing.unlimited")}</span>}
                      <h2 className="text-lg">{plan.name}</h2>
                      <p className="text-2xl font-extrabold">{periodicita === "annuale" && plan.annualPrice ? plan.annualPrice : plan.price} €<span className="text-sm font-normal text-muted-foreground">{periodicita === "annuale" && plan.annualPrice ? "/anno" : t("dashboard.quoteDetail.perMonth")}</span></p>
                    </div>
                    <div className="p-5 flex-1 pb-0">
                      <ul className="space-y-1.5 mb-4">
                        {plan.features.map((f: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isPlanPro ? "text-navy-500" : isPlanElite ? "text-amber-500" : "text-muted-foreground"}`} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="card-foot pt-3">
                      <button className={cn("btn btn-navy", `w-full gap-2 ${isPlanPro ? "btn-gradient" : isPlanElite ? "bg-amber-500 hover:bg-amber-600 text-white border-0" : ""}`)}
                        
                        onClick={() => handleCheckout(plan.id)}
                        disabled={loadingPlanId === plan.id}>
                        {loadingPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                        {loadingPlanId === plan.id ? t("dashboard.settings.billing.pleaseWait") : t("dashboard.settings.billing.choosePlan").replace("{name}", plan.name)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {isActive && (isStarter || isPro) && (
        <div className="card">
          <div className="p-5 pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium">{t("dashboard.settings.billing.undetectedSubTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.billing.undetectedSubDesc")}</p>
              </div>
              <button onClick={handleSync} disabled={isSyncing} className="btn btn-outline-navy btn-sm gap-2 shrink-0">
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t("dashboard.settings.billing.verifySubscription")}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddonBillingCard />
    </div>
  );
}

function UsageMeter({ label, used, allowance }: { label: string; used: number; allowance: number | null }) {
  const pct = allowance ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {used} {allowance !== null ? `/ ${allowance}` : "(illimitato)"}
        </span>
      </div>
      {allowance !== null && (
        <div className="hbar">
          <i style={{ width: `${pct}%`, background: pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--yellow-dark)" : "var(--green)" }} />
        </div>
      )}
    </div>
  );
}

function UsageTab() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({ queryKey: ["usage-summary"], queryFn: usageApi.summary });

  if (isLoading) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;
  if (!data) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t("dashboard.settings.tabs.usage")}</h2>
        <p className="sub">{t("dashboard.settings.usage.subtitle")}</p>
      </div>
      <div className="p-5 space-y-5">
        <UsageMeter label={t("dashboard.settings.usage.receiptScans")} used={data.receiptScans.used} allowance={data.receiptScans.allowance} />
        <UsageMeter label={t("dashboard.settings.usage.whatsappMessages")} used={data.whatsappMessages.used} allowance={data.whatsappMessages.allowance} />
        <p className="text-xs text-muted-foreground pt-2 border-t">{t("dashboard.settings.usage.resetNote")}</p>
      </div>
    </div>
  );
}
