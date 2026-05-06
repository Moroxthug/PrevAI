import { useGetQuoteStats, useGetSubscription } from "@workspace/api-client-react";
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
} from "lucide-react";
import { useUser } from "@clerk/react";

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  if (!plan) return null;
  const isPro = plan === "monthly_pro";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
        isPro
          ? "bg-amber-100 text-amber-700 border border-amber-200"
          : "bg-violet-100 text-violet-700 border border-violet-200"
      }`}
    >
      {isPro ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
      {isPro ? "Pro" : "Starter"}
    </span>
  );
}

const STAT_CARDS = [
  {
    key: "thisMonth" as const,
    label: "Questo Mese",
    icon: CalendarDays,
    color: "text-violet-500",
    accent: "bg-violet-50",
    gradient: "from-violet-500/10 to-violet-500/5",
    border: "border-violet-200",
  },
  {
    key: "unlocked" as const,
    label: "Sbloccati",
    icon: CheckCircle2,
    color: "text-emerald-500",
    accent: "bg-emerald-50",
    gradient: "from-emerald-500/10 to-emerald-500/5",
    border: "border-emerald-200",
  },
  {
    key: "unlockedRevenue" as const,
    label: "Fatturato Sbloccato",
    icon: TrendingUp,
    color: "text-blue-500",
    accent: "bg-blue-50",
    gradient: "from-blue-500/10 to-blue-500/5",
    border: "border-blue-200",
    isCurrency: true,
  },
  {
    key: "avgValue" as const,
    label: "Valore Medio",
    icon: Sparkles,
    color: "text-amber-500",
    accent: "bg-amber-50",
    gradient: "from-amber-500/10 to-amber-500/5",
    border: "border-amber-200",
    isCurrency: true,
  },
];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "unlocked":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="h-3 w-3" /> Sbloccato
        </span>
      );
    case "pending_payment":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
          In attesa
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
          <Lock className="h-3 w-3" /> Bozza
        </span>
      );
  }
}

export default function DashboardHome() {
  const { data: stats, isLoading: isLoadingStats } = useGetQuoteStats();
  const { data: subscription } = useGetSubscription();
  const { user } = useUser();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

  const recentQuotes = stats?.recentQuotes || [];
  const firstName = user?.firstName || "ciao";

  if (isLoadingStats) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-500 to-cyan-500 p-6 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 60%)" }} />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Ciao, {firstName}!</h1>
              {subscription?.isActive && <PlanBadge plan={subscription.plan} />}
            </div>
            <p className="text-white/75 text-sm">
              {subscription?.isActive
                ? `Piano ${subscription.plan === "monthly_pro" ? "Pro attivo" : "Starter attivo"} — preventivi illimitati`
                : "Hai " + (stats?.total ?? 0) + " preventivi totali nel tuo archivio."}
            </p>
          </div>
          <Link
            href="/dashboard/new"
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-colors backdrop-blur-sm border border-white/20"
          >
            <Plus className="h-4 w-4" />
            Nuovo
          </Link>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, accent, border, isCurrency }) => {
          const raw = stats?.[key] ?? 0;
          const value = isCurrency ? formatCurrency(raw as number) : String(raw);
          return (
            <div
              key={key}
              className={`bg-white rounded-2xl border ${border} p-4 shadow-sm hover-elevate transition-all`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <div className={`h-7 w-7 rounded-lg ${accent} flex items-center justify-center`}>
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 truncate">{value}</div>
            </div>
          );
        })}
      </div>

      {/* ── Subscription upsell (only if not subscribed) ────────── */}
      {!subscription?.isActive && (stats?.total ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-100 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Sblocca tutti i preventivi</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Con il piano Pro tutti i preventivi vengono sbloccati automaticamente.
              </div>
            </div>
          </div>
          <Link
            href="/dashboard/quotes"
            className="shrink-0 btn-gradient inline-flex h-9 items-center justify-center px-4 text-sm font-semibold"
          >
            Passa a Pro
          </Link>
        </div>
      )}

      {/* ── Recent quotes ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Preventivi Recenti</h2>
            <p className="text-xs text-gray-400 mt-0.5">Ultimi {recentQuotes.length} generati</p>
          </div>
          <Link
            href="/dashboard/quotes"
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors"
          >
            Vedi tutti <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentQuotes.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div
              className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(6,182,212,0.08))" }}
            >
              <FileText className="h-7 w-7 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Nessun preventivo ancora</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto mb-5">
              Descrivi un lavoro e l'AI genera un preventivo professionale in pochi secondi.
            </p>
            <Link
              href="/dashboard/new"
              className="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold gap-2"
            >
              <Plus className="h-4 w-4" />
              Crea il primo preventivo
            </Link>
          </div>
        ) : (
          <div>
            {recentQuotes.map((quote, idx) => (
              <Link
                key={quote.id}
                href={`/dashboard/quotes/${quote.id}`}
                className={`flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/80 transition-colors cursor-pointer ${
                  idx !== recentQuotes.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.10), rgba(6,182,212,0.10))" }}
                  >
                    <FileText className="h-3.5 w-3.5 text-violet-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {quote.clientData?.nome || "Cliente non specificato"}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={quote.status} />
                      <span className="text-[11px] text-gray-400">
                        {new Date(quote.createdAt).toLocaleDateString("it-IT")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="font-bold text-sm text-gray-900">
                    {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(quote.totale)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick actions ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link
          href="/dashboard/new"
          className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:border-violet-200 hover:bg-violet-50/30 transition-all group shadow-sm"
        >
          <div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center">
            <Plus className="h-4 w-4 text-violet-500" />
          </div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-violet-700">Nuovo preventivo</span>
        </Link>
        <Link
          href="/dashboard/quotes"
          className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:border-blue-200 hover:bg-blue-50/30 transition-all group shadow-sm"
        >
          <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center">
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Tutti i preventivi</span>
        </Link>
        <Link
          href="/dashboard/profile"
          className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group shadow-sm"
        >
          <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">Profilo azienda</span>
        </Link>
      </div>
    </div>
  );
}
