import { useListQuotes, useDeleteQuote } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, FileText, Trash2, Eye } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuotesQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function QuotesList() {
  const { data: quotes, isLoading } = useListQuotes();
  const deleteQuote = useDeleteQuote();
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unlocked':
        return <Badge variant="default" className="bg-green-600">Sbloccato</Badge>;
      case 'pending_payment':
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">In attesa</Badge>;
      default:
        return <Badge variant="outline">Bozza</Badge>;
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo preventivo?")) return;
    
    deleteQuote.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Preventivo eliminato" });
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      },
      onError: () => {
        toast({ title: "Errore durante l'eliminazione", variant: "destructive" });
      }
    });
  };

  const filteredQuotes = quotes?.filter(q => 
    q.clientData?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.descrizioneGenerale?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">I Miei Preventivi</h1>
          <p className="text-muted-foreground">Gestisci e visualizza tutti i preventivi generati.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm w-full sm:w-[300px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cerca cliente o descrizione..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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
          {searchTerm ? (
            <p className="text-muted-foreground">Nessun risultato corrisponde alla tua ricerca.</p>
          ) : (
            <Button asChild className="mt-4">
              <Link href="/dashboard/new">Crea il tuo primo preventivo</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuotes.map((quote, i) => (
            <Card key={quote.id} className="hover-elevate transition-all overflow-hidden animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 50}ms` }}>
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 hidden sm:flex">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <Link href={`/dashboard/quotes/${quote.id}`} className="font-semibold text-lg hover:text-primary hover:underline focus:outline-none line-clamp-1">
                        {quote.clientData?.nome || "Cliente Non Specificato"}
                      </Link>
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {quote.descrizioneGenerale || "Nessuna descrizione"}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {getStatusBadge(quote.status)}
                        <span>{format(new Date(quote.createdAt), 'dd MMMM yyyy', { locale: it })}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-0 pt-3 sm:pt-0">
                    <div className="font-bold text-lg">{formatCurrency(quote.totale)}</div>
                    
                    <div className="flex items-center gap-1">
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={`/dashboard/quotes/${quote.id}`}>
                          <Eye className="h-4 w-4 mr-2" /> Visualizza
                        </Link>
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Menu opzioni</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/quotes/${quote.id}`} className="cursor-pointer w-full flex items-center">
                              <Eye className="mr-2 h-4 w-4" /> Apri dettaglio
                            </Link>
                          </DropdownMenuItem>
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