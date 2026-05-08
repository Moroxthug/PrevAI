import { useGetSubscription, useCreateCustomerPortalSession } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Crown,
  Zap,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  BarChart3,
  ArrowUpRight,
  RefreshCw,
  XCircle,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-violet-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Preventivi usati</span>
        <span className="font-semibold">
          {used} / {limit}
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{limit - used} rimanenti questo mese</span>
        <span>{pct}% usato</span>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { data: sub, isLoading } = useGetSubscription();
  const createPortal = useCreateCustomerPortalSession();
  const { toast } = useToast();

  const handleManage = () => {
    createPortal.mutate(undefined, {
      onSuccess: (r) => {
        window.location.href = r.url;
      },
      onError: () =>
        toast({
          title: "Errore apertura portale",
          variant: "destructive",
        }),
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const isStarter = sub?.plan === "monthly_starter";
  const isPro = sub?.plan === "monthly_pro";
  const isActive = sub?.isActive ?? false;

  const isElite = sub?.plan === "monthly_elite";
  const planLabel = isPro ? "Pro" : isStarter ? "Starter" : isElite ? "Elite" : null;
  const planPrice = isPro ? "€49/mese" : isStarter ? "€19/mese" : isElite ? "€59/mese" : null;

  const renewalDate = sub?.periodEnd
    ? new Date(sub.periodEnd).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const resetDate = sub?.quotaResetDate
    ? new Date(sub.quotaResetDate).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "long",
      })
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Piano & Fatturazione</h1>
        <p className="text-muted-foreground mt-1">
          Gestisci il tuo abbonamento e monitora l'utilizzo.
        </p>
      </div>

      {/* Current plan card */}
      {isActive ? (
        <Card
          className={`border-2 ${isPro ? "border-amber-300 bg-gradient-to-br from-amber-50 to-violet-50" : "border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50"}`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className={`h-11 w-11 rounded-xl flex items-center justify-center ${isPro ? "bg-amber-100" : "bg-violet-100"}`}
                >
                  {isPro ? (
                    <Crown className="h-6 w-6 text-amber-600" />
                  ) : (
                    <Zap className="h-6 w-6 text-violet-500" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-xl">PrevAI {planLabel}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {planPrice}
                  </p>
                </div>
              </div>
              <Badge
                className={`text-xs ${isPro ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-violet-100 text-violet-700 border-violet-200"}`}
                variant="outline"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Attivo
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Quota bar — only for Starter */}
            {isStarter &&
              sub.quotaUsed != null &&
              sub.quotaLimit != null && (
                <div className="bg-white/70 rounded-xl p-4 border border-violet-100">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-semibold">Utilizzo Mensile</span>
                  </div>
                  <QuotaBar
                    used={sub.quotaUsed}
                    limit={sub.quotaLimit}
                  />
                  {resetDate && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Quota si azzera il {resetDate}
                    </p>
                  )}
                  {(sub.quotaRemaining ?? 0) <= 3 && (sub.quotaRemaining ?? 0) > 0 && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Stai per esaurire i preventivi del mese. Passa a Pro per illimitati.
                    </div>
                  )}
                  {(sub.quotaRemaining ?? 0) === 0 && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Quota mensile esaurita. I nuovi preventivi saranno bloccati fino al rinnovo.
                    </div>
                  )}
                </div>
              )}

            {/* Plan features */}
            <div className="bg-white/70 rounded-xl p-4 border border-violet-100">
              <div className="text-sm font-semibold mb-3">Incluso nel tuo piano</div>
              <ul className="space-y-2">
                {isPro ? (
                  <>
                    <PlanFeature text="Preventivi illimitati" ok />
                    <PlanFeature text="PDF senza filigrana" ok />
                    <PlanFeature text="Tuo logo aziendale sui PDF" ok />
                    <PlanFeature text="Branding completamente personalizzabile" ok />
                    <PlanFeature text="Priorità generazione AI" ok />
                  </>
                ) : (
                  <>
                    <PlanFeature text={`Fino a ${sub?.quotaLimit ?? 20} preventivi al mese`} ok />
                    <PlanFeature text="PDF professionale scaricabile" ok />
                    <PlanFeature text="Supporto email" ok />
                    <PlanFeature text="PDF senza filigrana" ok={false} />
                    <PlanFeature text="Logo aziendale personalizzato" ok={false} />
                  </>
                )}
              </ul>
            </div>

            {/* Renewal info */}
            {renewalDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                Prossimo rinnovo: <span className="font-medium text-foreground">{renewalDate}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-1">
              {isStarter && (
                <Button onClick={handleManage} disabled={createPortal.isPending} className="gap-2">
                  {createPortal.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crown className="h-4 w-4" />
                  )}
                  Passa a Pro
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleManage}
                disabled={createPortal.isPending}
                className="gap-2"
              >
                <ArrowUpRight className="h-4 w-4" />
                Gestisci abbonamento
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Gestito tramite Stripe — annulla in qualsiasi momento dal portale.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* No active subscription */
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle>Nessun abbonamento attivo</CardTitle>
                <CardDescription className="mt-0.5">
                  Scegli un piano per sbloccare i preventivi.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/quotes"
              className="btn-gradient inline-flex h-10 items-center justify-center px-5 text-sm font-semibold gap-2"
            >
              <Crown className="h-4 w-4" />
              Scegli un piano
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Compare plans — only shown to non-Pro */}
      {!isPro && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confronto Piani</CardTitle>
            <CardDescription>Cosa ottieni passando a Pro.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Zap className="h-4 w-4 text-violet-500" />
                  Starter — €19/mese
                </div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                    10 preventivi/mese
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                    PDF professionale
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground line-through opacity-50">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    Logo personalizzato
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground line-through opacity-50">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    PDF senza filigrana
                  </li>
                </ul>
              </div>
              <div className="space-y-2 border-l pl-4">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Pro — €49/mese
                </div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    Preventivi illimitati
                  </li>
                  <li className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    PDF premium
                  </li>
                  <li className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    Tuo logo aziendale
                  </li>
                  <li className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    Nessuna filigrana
                  </li>
                </ul>
              </div>
            </div>
            {isStarter && (
              <div className="mt-5 pt-4 border-t flex justify-end">
                <Button
                  onClick={handleManage}
                  disabled={createPortal.isPending}
                  size="sm"
                  className="gap-2"
                >
                  {createPortal.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Crown className="h-3.5 w-3.5" />
                  )}
                  Passa a Pro →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlanFeature({ text, ok }: { text: string; ok: boolean }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-foreground" : "text-muted-foreground line-through opacity-50"}`}>
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 shrink-0" />
      )}
      {text}
    </li>
  );
}
