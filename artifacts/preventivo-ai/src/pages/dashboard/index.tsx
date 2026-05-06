import { useGetQuoteStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, Clock, CheckCircle2, Plus, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const STAT_CARDS = [
  {
    key: "total" as const,
    label: "Totale Preventivi",
    icon: FileText,
    color: "text-violet-500",
    accent: "bg-violet-50",
    border: "border-l-violet-400",
  },
  {
    key: "totalRevenue" as const,
    label: "Fatturato Potenziale",
    icon: TrendingUp,
    color: "text-emerald-500",
    accent: "bg-emerald-50",
    border: "border-l-emerald-400",
    sub: "Dai preventivi sbloccati",
    isCurrency: true,
  },
  {
    key: "pendingPayment" as const,
    label: "In Attesa",
    icon: Clock,
    color: "text-amber-500",
    accent: "bg-amber-50",
    border: "border-l-amber-400",
  },
  {
    key: "draft" as const,
    label: "Bozze",
    icon: CheckCircle2,
    color: "text-blue-500",
    accent: "bg-blue-50",
    border: "border-l-blue-400",
  },
];

export default function DashboardHome() {
  const { data: stats, isLoading } = useGetQuoteStats();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "unlocked":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-medium">
            Sbloccato
          </Badge>
        );
      case "pending_payment":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-medium">
            In attesa
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-500 border-gray-200 font-medium">
            Bozza
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-l-4 border-l-gray-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const recentQuotes = stats?.recentQuotes || [];

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bentornato</h1>
          <p className="text-gray-500 mt-1.5">Ecco il riepilogo della tua attività.</p>
        </div>
        <Link
          href="/dashboard/new"
          className="btn-gradient inline-flex h-10 items-center justify-center px-5 text-sm font-semibold gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuovo Preventivo
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, accent, border, sub, isCurrency }) => {
          const raw = stats?.[key] ?? 0;
          const value = isCurrency ? formatCurrency(raw as number) : String(raw);
          return (
            <div
              key={key}
              className={`bg-white rounded-2xl border-l-4 ${border} p-5 shadow-sm hover-elevate transition-all`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">{label}</span>
                <div className={`h-8 w-8 rounded-lg ${accent} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Recent Quotes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Preventivi Recenti</h2>
            <p className="text-sm text-gray-500 mt-0.5">I tuoi ultimi 5 preventivi generati.</p>
          </div>
          <Link
            href="/dashboard/quotes"
            className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
          >
            Vedi tutti <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="px-6 pb-6">
          {recentQuotes.length === 0 ? (
            <div className="text-center py-14 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/40">
              <div
                className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(6,182,212,0.08))" }}
              >
                <FileText className="h-7 w-7 text-violet-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Nessun preventivo ancora</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                Descrivi un lavoro e lascia che l'AI generi un preventivo professionale in pochi secondi.
              </p>
              <Link
                href="/dashboard/new"
                className="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold gap-2"
              >
                <Plus className="h-4 w-4" />
                Crea il tuo primo preventivo
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="quote-row flex items-center justify-between py-4 px-3 rounded-xl -mx-3 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.10), rgba(6,182,212,0.10))" }}
                    >
                      <FileText className="h-4 w-4 text-violet-500" />
                    </div>
                    <div>
                      <Link
                        href={`/dashboard/quotes/${quote.id}`}
                        className="font-medium text-gray-900 hover:text-violet-600 transition-colors text-sm"
                      >
                        {quote.clientData?.nome || "Cliente Non Specificato"}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(quote.status)}
                        <span className="text-xs text-gray-400">
                          {new Date(quote.createdAt).toLocaleDateString("it-IT")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div className="font-bold text-sm text-gray-900">
                      {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(quote.totale)}
                    </div>
                    <Link
                      href={`/dashboard/quotes/${quote.id}`}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
