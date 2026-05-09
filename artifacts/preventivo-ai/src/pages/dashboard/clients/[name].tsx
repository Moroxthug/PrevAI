import { useParams, Link } from "wouter";
import { useListClientQuotes, getListClientQuotesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Euro, FileText } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export default function ClientDetailPage() {
  const params = useParams<{ name: string }>();
  const clientName = decodeURIComponent(params.name ?? "");

  const { data: quotes, isLoading } = useListClientQuotes(
    encodeURIComponent(clientName),
    { query: { queryKey: getListClientQuotesQueryKey(encodeURIComponent(clientName)), enabled: !!clientName } }
  );

  const totalValue = quotes?.reduce((sum, q) => sum + q.totale, 0) ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/clients" className="text-muted-foreground hover:text-gray-900 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-violet-700 uppercase">
                {clientName.slice(0, 2)}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{clientName}</h1>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preventivi</span>
              <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                <FileText className="h-4 w-4 text-violet-500" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{quotes?.length ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valore totale</span>
              <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                <Euro className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quotes list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Preventivi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-4">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          ) : !quotes || quotes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nessun preventivo trovato per questo cliente.
            </div>
          ) : (
            <div className="divide-y">
              {quotes.map((q) => (
                <Link
                  key={q.id}
                  href={`/dashboard/quotes/${q.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {q.titoloPreventivoRiga2 || q.descrizioneGenerale || "Preventivo"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(q.createdAt), "dd MMM yyyy", { locale: it })}
                      {q.numeroPreventivoData && (
                        <span className="ml-2 text-gray-400">— {q.numeroPreventivoData}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      q.status === "unlocked" ? "bg-violet-100 text-violet-700" :
                      q.status === "pending_payment" ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {q.status === "unlocked" ? "Sbloccato" : q.status === "pending_payment" ? "In attesa" : "Bozza"}
                    </span>
                    <span className="font-semibold text-sm">{formatCurrency(q.totale)}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
