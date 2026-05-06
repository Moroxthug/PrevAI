import { useListQuotes, useDeleteQuote, useDuplicateQuote, getListQuotesQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, FileText, Trash2, Eye, Copy, ChevronDown, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type StatusFilter = "all" | "draft" | "unlocked" | "pending_payment";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Tutti",
  draft: "Bozza",
  unlocked: "Sbloccato",
  pending_payment: "In attesa",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);

function StatusBadge({ status }: { status: string }) {
  if (status === "unlocked")
    return <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-0">Sbloccato</Badge>;
  if (status === "pending_payment")
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">In attesa</Badge>;
  return <Badge variant="outline" className="text-slate-500">Bozza</Badge>;
}

export default function QuotesList() {
  const { data: quotes, isLoading } = useListQuotes();
  const deleteQuote = useDeleteQuote();
  const duplicateQuote = useDuplicateQuote();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleDelete = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo preventivo?")) return;
    deleteQuote.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Preventivo eliminato" });
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      },
      onError: () => toast({ title: "Errore durante l'eliminazione", variant: "destructive" }),
    });
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    duplicateQuote.mutate({ id }, {
      onSuccess: (newQuote) => {
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
        toast({ title: "Preventivo duplicato" });
        navigate(`/dashboard/quotes/${newQuote.id}`);
      },
      onError: () => toast({ title: "Errore durante la duplicazione", variant: "destructive" }),
      onSettled: () => setDuplicatingId(null),
    });
  };

  const filteredQuotes = (quotes ?? []).filter(q => {
    const matchesSearch =
      !searchTerm ||
      q.clientData?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.descrizioneGenerale?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = quotes
    ? {
        all: quotes.length,
        draft: quotes.filter(q => q.status === "draft").length,
        unlocked: quotes.filter(q => q.status === "unlocked").length,
        pending_payment: quotes.filter(q => q.status === "pending_payment").length,
      }
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">I Miei Preventivi</h1>
          <p className="text-muted-foreground">Gestisci e visualizza tutti i preventivi generati.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-[260px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cerca cliente o descrizione…"
              className="pl-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1.5 shrink-0">
                <span>{STATUS_LABELS[statusFilter]}</span>
                {counts && statusFilter !== "all" && (
                  <Badge className="h-4 min-w-4 px-1 text-[10px] bg-violet-100 text-violet-700 border-0 ml-0.5">
                    {counts[statusFilter]}
                  </Badge>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map(s => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="flex items-center justify-between"
                >
                  <span className={statusFilter === s ? "font-semibold" : ""}>{STATUS_LABELS[s]}</span>
                  {counts && (
                    <span className="text-xs text-muted-foreground">{counts[s]}</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nessun preventivo trovato</h3>
          {searchTerm || statusFilter !== "all" ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">Nessun risultato per i filtri applicati.</p>
              <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>
                Rimuovi filtri
              </Button>
            </div>
          ) : (
            <Button asChild className="mt-4">
              <Link href="/dashboard/new">Crea il tuo preventivo in 60 secondi!</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuotes.map((quote, i) => (
            <Card
              key={quote.id}
              className="hover-elevate transition-all overflow-hidden animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 hidden sm:flex">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/quotes/${quote.id}`}
                        className="font-semibold text-lg hover:text-primary hover:underline focus:outline-none line-clamp-1"
                      >
                        {quote.clientData?.nome || "Cliente Non Specificato"}
                      </Link>
                      <div className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                        {quote.descrizioneGenerale || "Nessuna descrizione"}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <StatusBadge status={quote.status} />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(quote.createdAt), "dd MMM yyyy", { locale: it })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-0 pt-3 sm:pt-0 shrink-0">
                    <div className="font-bold text-lg tabular-nums">{formatCurrency(quote.totale)}</div>

                    <div className="flex items-center gap-1">
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={`/dashboard/quotes/${quote.id}`}>
                          <Eye className="h-4 w-4 mr-1.5" /> Apri
                        </Link>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            {duplicatingId === quote.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <MoreVertical className="h-4 w-4" />}
                            <span className="sr-only">Opzioni</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/quotes/${quote.id}`} className="cursor-pointer w-full flex items-center">
                              <Eye className="mr-2 h-4 w-4" /> Visualizza
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(quote.id)}
                            disabled={duplicatingId === quote.id}
                            className="cursor-pointer"
                          >
                            <Copy className="mr-2 h-4 w-4" /> Duplica
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(quote.id)}
                            className="text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
