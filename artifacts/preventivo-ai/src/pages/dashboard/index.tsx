import { useGetQuoteStats, useGetSubscription, useCreateCustomerPortalSession, useGetTrialStatus } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  TrendingUp,
  CalendarDays,
  Sparkles,
  Plus,
  ArrowRight,
  Crown,
  Zap,
  Lock,
  CheckCircle2,
  MessageSquare,
  Download,
  Building2,
  Clock,
  Gift,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  if (!plan) return null;
  const isPro = plan === "monthly_pro";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
        isPro
          ? "bg-amber-100 text-amber-700 border border-amber-200"
          : "bg-violet-100 text-violet-700 border border-violet-200"
      }`}
    >
      {isPro ? <Crown className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
      {isPro ? "Pro" : "Starter"}
    </span>
  );
}

const STAT_CARDS = [
  { key: "thisMonth" as const, label: "Questo Mese", icon: CalendarDays, color: "text-violet-500", accent: "bg-violet-50", border: "border-violet-200" },
  { key: "unlocked" as const, label: "Sbloccati", icon: CheckCircle2, color: "text-emerald-500", accent: "bg-emerald-50", border: "border-emerald-200" },
  { key: "unlockedRevenue" as const, label: "Fatturato Sbloccato", icon: TrendingUp, color: "text-blue-500", accent: "bg-blue-50", border: "border-blue-200", isCurrency: true },
  { key: "avgValue" as const, label: "Valore Medio", icon: Sparkles, color: "text-amber-500", accent: "bg-amber-50", border: "border-amber-200", isCurrency: true },
];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "unlocked":
      return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full"><CheckCircle2 className="h-2.5 w-2.5" /> Sbloccato</span>;
    case "pending_payment":
      return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">In attesa</span>;
    default:
      return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full"><Lock className="h-2.5 w-2.5" /> Bozza</span>;
  }
}

function StarterUpgradeCard() {
  const createPortal = useCreateCustomerPortalSession();
  return (
    <div className="bg-gradient-to-r from-amber-50 to-violet-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <Crown className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <div className="font-semibold text-gray-900 text-sm">Passa a Pro — PDF senza filigrana</div>
          <div className="text-xs text-gray-500 mt-0.5">Sei su Starter: i PDF hanno filigrana e logo PrevAI. Pro ti dà il tuo logo e PDF puliti.</div>
        </div>
      </div>
      <button
        onClick={() => createPortal.mutate(undefined, { onSuccess: (r) => { window.location.href = r.url; } })}
        disabled={createPortal.isPending}
        className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold disabled:opacity-60"
      >
        {createPortal.isPending ? "..." : "Upgrade"}
      </button>
    </div>
  );
}

function OnboardingView() {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-6 pb-5 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.12))" }}>
            <Sparkles className="h-6 w-6 text-violet-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Benvenuto su PrevAI!</h2>
          <p className="text-xs text-gray-500 max-w-md mx-auto mb-5">
            Genera il tuo primo preventivo professionale in meno di 60 secondi.
            Descrivi il lavoro e l'AI crea un computo metrico prezzato pronto da inviare al cliente.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-left">
            {[
              { icon: Building2, num: "1", title: "Completa il profilo", desc: "Aggiungi ragione sociale, P.IVA e logo aziendale per PDF personalizzati.", href: "/dashboard/profile", cta: "Vai al profilo →" },
              { icon: MessageSquare, num: "2", title: "Descrivi il lavoro", desc: "Scrivi in italiano cosa devi fare: l'AI capisce e crea il preventivo.", href: "/dashboard/new", cta: "Crea preventivo →" },
              { icon: Download, num: "3", title: "Scarica il PDF", desc: "Preview immediata, poi sblocca e scarica il PDF professionale.", href: null, cta: null },
            ].map(({ icon: Icon, num, title, desc, href, cta }) => (
              <div key={num} className="rounded-lg bg-gray-50 border border-gray-100 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-5 w-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{num}</span>
                  <Icon className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-sm font-semibold text-gray-900">{title}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-1.5">{desc}</p>
                {href && cta && <Link href={href} className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors">{cta}</Link>}
              </div>
            ))}
          </div>
          <Link href="/dashboard/new" className="btn-gradient inline-flex h-9 items-center justify-center px-6 text-sm font-semibold gap-2">
            <Plus className="h-3.5 w-3.5" />
            Crea il tuo preventivo in 60 secondi!
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Link href="/dashboard/profile" className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-2.5 hover:border-violet-200 hover:bg-violet-50/30 transition-all group shadow-sm">
          <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center"><Building2 className="h-3.5 w-3.5 text-violet-500" /></div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-violet-700">Profilo azienda</span>
        </Link>
        <Link href="/dashboard/billing" className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-2.5 hover:border-amber-200 hover:bg-amber-50/30 transition-all group shadow-sm">
          <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center"><Crown className="h-3.5 w-3.5 text-amber-500" /></div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-amber-700">Piani e prezzi</span>
        </Link>
        <Link href="/dashboard/new" className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-2.5 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group shadow-sm">
          <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5 text-emerald-500" /></div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">Crea preventivo</span>
        </Link>
      </div>
    </div>
  );
}

function TrialBanner({ downloadsUsed, downloadsLimit, daysLeft }: { downloadsUsed: number; downloadsLimit: number; daysLeft: number | null | undefined }) {
  const remaining = downloadsLimit - downloadsUsed;
  return (
    <div className="bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          <Gift className="h-4 w-4 text-violet-600" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm">
            Prova gratuita attiva
            {typeof daysLeft === "number" && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full">
                <Clock className="h-2.5 w-2.5" />
                {daysLeft === 0 ? "Scade oggi" : `${daysLeft} giorn${daysLeft === 1 ? "o" : "i"} riman${daysLeft === 1 ? "e" : "ono"}`}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {remaining > 0
              ? `Hai ancora ${remaining} download gratuito${remaining > 1 ? "" : ""} su ${downloadsLimit} — PDF senza costi!`
              : "Hai esaurito i download gratuiti. Abbonati per continuare."}
          </div>
        </div>
      </div>
      {remaining > 0 ? (
        <Link href="/dashboard/new" className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold gap-1">
          <Sparkles className="h-3 w-3" />
          Crea ora
        </Link>
      ) : (
        <Link href="/dashboard/billing" className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold">
          Abbonati
        </Link>
      )}
    </div>
  );
}

export default function DashboardHome() {
  const { data: stats, isLoading: isLoadingStats } = useGetQuoteStats();
  const { data: subscription } = useGetSubscription();
  const { data: trialStatus } = useGetTrialStatus();
  const { user } = useAuth();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

  const recentQuotes = stats?.recentQuotes || [];
  const firstName = user?.name?.split(" ")?.[0] || "";
  const isNewUser = !isLoadingStats && (stats?.total ?? 0) === 0;

  if (isLoadingStats) {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-52 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 via-violet-500 to-cyan-500 px-5 py-4 text-white shadow-md">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 60%)" }} />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg font-bold tracking-tight">{firstName ? `Ciao, ${firstName}!` : "Bentornato!"}</h1>
              {subscription?.isActive && <PlanBadge plan={subscription.plan} />}
            </div>
            <p className="text-white/75 text-xs">
              {isNewUser
                ? "Benvenuto! Crea il tuo primo preventivo in 60 secondi."
                : subscription?.isActive
                  ? `Piano ${subscription.plan === "monthly_pro" ? "Pro attivo" : "Starter attivo"} — preventivi illimitati`
                  : "Hai " + (stats?.total ?? 0) + " preventivi totali nel tuo archivio."}
            </p>
          </div>
          <Link href="/dashboard/new" className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors backdrop-blur-sm border border-white/20">
            <Plus className="h-3.5 w-3.5" />
            Nuovo
          </Link>
        </div>
      </div>

      {/* Free trial banner — show when trial is active and no paid subscription */}
      {trialStatus?.isTrialActive && !subscription?.isActive && (
        <TrialBanner
          downloadsUsed={trialStatus.trialDownloadsUsed}
          downloadsLimit={trialStatus.trialDownloadsLimit}
          daysLeft={trialStatus.trialDaysLeft}
        />
      )}

      {/* Onboarding vs normal view */}
      {isNewUser ? (
        <OnboardingView />
      ) : (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {STAT_CARDS.map(({ key, label, icon: Icon, color, accent, border, isCurrency }) => {
              const raw = stats?.[key] ?? 0;
              const value = isCurrency ? formatCurrency(raw as number) : String(raw);
              return (
                <div key={key} className={`bg-white rounded-xl border ${border} p-3 shadow-sm hover-elevate transition-all`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">{label}</span>
                    <div className={`h-6 w-6 rounded-md ${accent} flex items-center justify-center`}>
                      <Icon className={`h-3 w-3 ${color}`} />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-gray-900 truncate">{value}</div>
                </div>
              );
            })}
          </div>

          {/* Subscription upsell */}
          {!subscription?.isActive && (
            <div className="bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-100 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                  <Crown className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Sblocca tutti i preventivi</div>
                  <div className="text-xs text-gray-500 mt-0.5">Con il piano Pro tutti i preventivi vengono sbloccati automaticamente.</div>
                </div>
              </div>
              <Link href="/dashboard/billing" className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3 text-xs font-semibold">
                Passa a Pro
              </Link>
            </div>
          )}

          {/* Starter → Pro upsell */}
          {subscription?.isActive && subscription?.plan === "monthly_starter" && <StarterUpgradeCard />}

          {/* Recent quotes */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Preventivi Recenti</h2>
                <p className="text-xs text-gray-400 mt-0.5">Ultimi {recentQuotes.length} generati</p>
              </div>
              <Link href="/dashboard/quotes" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors">
                Vedi tutti <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div>
              {recentQuotes.map((quote, idx) => (
                <Link
                  key={quote.id}
                  href={`/dashboard/quotes/${quote.id}`}
                  className={`flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/80 transition-colors cursor-pointer ${idx !== recentQuotes.length - 1 ? "border-b border-gray-50" : ""}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.10), rgba(6,182,212,0.10))" }}>
                      <FileText className="h-3 w-3 text-violet-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{quote.clientData?.nome || "Cliente non specificato"}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StatusBadge status={quote.status} />
                        <span className="text-[10px] text-gray-400">{new Date(quote.createdAt).toLocaleDateString("it-IT")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <span className="font-bold text-sm text-gray-900">
                      {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(quote.totale)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-gray-300" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Link href="/dashboard/new" className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-2.5 hover:border-violet-200 hover:bg-violet-50/30 transition-all group shadow-sm">
              <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center"><Plus className="h-3.5 w-3.5 text-violet-500" /></div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-violet-700">Nuovo preventivo</span>
            </Link>
            <Link href="/dashboard/quotes" className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-2.5 hover:border-blue-200 hover:bg-blue-50/30 transition-all group shadow-sm">
              <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center"><FileText className="h-3.5 w-3.5 text-blue-500" /></div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Tutti i preventivi</span>
            </Link>
            <Link href="/dashboard/profile" className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-2.5 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group shadow-sm">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5 text-emerald-500" /></div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">Profilo azienda</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
