import { useGetQuoteStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, Clock, CheckCircle2, Plus, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function DashboardHome() {
  const { data: stats, isLoading } = useGetQuoteStats();

  if (isLoading) {
    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="border-l-4 border-l-muted">
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unlocked':
        return <Badge variant="default" className="bg-green-600 text-white">Sbloccato</Badge>;
      case 'pending_payment':
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 border border-amber-500/30">In attesa</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Bozza</Badge>;
    }
  };

  const recentQuotes = stats?.recentQuotes || [];

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Bentornato</h1>
          <p className="text-muted-foreground mt-1.5">Ecco il riepilogo della tua attività.</p>
        </div>
        <Button asChild size="lg" className="gap-2 shadow-sm transition-all hover:scale-105">
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" />
            Nuovo Preventivo
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate transition-all border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totale Preventivi</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate transition-all border-l-4 border-l-green-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fatturato Potenziale</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Dai preventivi sbloccati</p>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate transition-all border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Attesa</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold">{stats?.pendingPayment || 0}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bozze</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold">{stats?.draft || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Quotes */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
          <div>
            <CardTitle className="text-lg">Preventivi Recenti</CardTitle>
            <CardDescription className="mt-0.5">I tuoi ultimi 5 preventivi generati.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-primary hover:text-primary">
            <Link href="/dashboard/quotes">
              Vedi tutti <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {recentQuotes.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/20">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/30 mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-1">Nessun preventivo ancora</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                Descrivi un lavoro e lascia che l'AI generi un preventivo professionale in pochi secondi.
              </p>
              <Button asChild>
                <Link href="/dashboard/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Crea il tuo primo preventivo
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {recentQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="quote-row flex items-center justify-between py-4 px-3 rounded-lg -mx-3 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-full bg-primary/8 flex items-center justify-center text-primary shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <Link href={`/dashboard/quotes/${quote.id}`} className="font-medium hover:underline focus:outline-none text-sm">
                        {quote.clientData?.nome || "Cliente Non Specificato"}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(quote.status)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(quote.createdAt).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div className="font-bold text-sm">{formatCurrency(quote.totale)}</div>
                    <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary px-2">
                      <Link href={`/dashboard/quotes/${quote.id}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
