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
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
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
        return <Badge variant="default" className="bg-green-600">Sbloccato</Badge>;
      case 'pending_payment':
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 border-amber-500/30">In attesa</Badge>;
      default:
        return <Badge variant="outline">Bozza</Badge>;
    }
  };

  const recentQuotes = stats?.recentQuotes || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Bentornato</h1>
          <p className="text-muted-foreground mt-1">Ecco il riepilogo della tua attività.</p>
        </div>
        <Button asChild className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90">
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" />
            Crea Preventivo
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate transition-all border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totale Preventivi</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate transition-all border-l-4 border-l-green-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fatturato Potenziale</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Dai preventivi sbloccati</p>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate transition-all border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Attesa</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingPayment || 0}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bozze</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.draft || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Preventivi Recenti</CardTitle>
              <CardDescription>I tuoi ultimi 5 preventivi generati.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-primary">
              <Link href="/dashboard/quotes">
                Vedi tutti <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentQuotes.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/30">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-20" />
                <h3 className="text-lg font-medium text-foreground mb-1">Nessun preventivo</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                  Non hai ancora creato nessun preventivo. Inizia ora descrivendo il lavoro.
                </p>
                <Button asChild variant="outline">
                  <Link href="/dashboard/new">Crea il tuo primo preventivo</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentQuotes.map((quote) => (
                  <div key={quote.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <Link href={`/dashboard/quotes/${quote.id}`} className="font-medium hover:underline focus:outline-none">
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
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(quote.totale)}</div>
                      <Button variant="link" size="sm" asChild className="px-0 h-auto text-primary">
                        <Link href={`/dashboard/quotes/${quote.id}`}>Apri</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}