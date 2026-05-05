import { useParams } from "wouter";
import { useGetQuote, useGetBusinessProfile, useGenerateQuotePdf, useGetPlans, useUpdateQuote, useCreateCheckoutSession, getGetQuoteQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, Lock, CheckCircle2, Edit2, Save, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function QuoteDetail() {
  const { id } = useParams();
  const { data: quote, isLoading: isLoadingQuote } = useGetQuote(id || "");
  const { data: profile, isLoading: isLoadingProfile } = useGetBusinessProfile();
  const { data: plans } = useGetPlans();
  const generatePdf = useGenerateQuotePdf();
  const updateQuote = useUpdateQuote();
  const createCheckout = useCreateCheckoutSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const initializedForId = useRef<string | null>(null);

  useEffect(() => {
    if (quote && initializedForId.current !== id) {
      initializedForId.current = id || null;
      setClientName(quote.clientData?.nome || "");
      setClientAddress(quote.clientData?.indirizzo || "");
      if (quote.capitoli && quote.capitoli.length > 0) {
        setExpandedChapters(new Set(quote.capitoli.map(c => c.lettera)));
      }
    }
  }, [quote, id]);

  const toggleChapter = (lettera: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(lettera)) next.delete(lettera);
      else next.add(lettera);
      return next;
    });
  };

  const handleSaveClient = () => {
    if (!id) return;
    updateQuote.mutate({
      id,
      data: { clientData: { nome: clientName, indirizzo: clientAddress } }
    }, {
      onSuccess: (updatedQuote) => {
        setIsEditingClient(false);
        toast({ title: "Dati cliente aggiornati" });
        queryClient.setQueryData(getGetQuoteQueryKey(id), updatedQuote);
      }
    });
  };

  const handleDownload = () => {
    if (!id || !quote) return;
    if (quote.status !== "unlocked") {
      setIsPaywallOpen(true);
      return;
    }
    generatePdf.mutate({ id }, {
      onSuccess: (result) => {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(result.htmlContent);
          printWindow.document.close();
          setTimeout(() => { printWindow.print(); }, 500);
        }
      },
      onError: () => {
        toast({ title: "Errore", description: "Impossibile generare il PDF", variant: "destructive" });
      }
    });
  };

  const handleCheckout = (planType: string) => {
    if (!id) return;
    createCheckout.mutate({
      data: { quoteId: id, planType: planType as Parameters<typeof createCheckout.mutate>[0]["data"]["planType"] }
    }, {
      onSuccess: (result) => { window.location.href = result.url; }
    });
  };

  if (isLoadingQuote || isLoadingProfile) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!quote) return <div>Preventivo non trovato</div>;

  const isLocked = quote.status !== "unlocked";
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);

  const hasCapitoli = Array.isArray(quote.capitoli) && quote.capitoli.length > 0;
  const capitoli = hasCapitoli ? quote.capitoli : [];
  const sconto = quote.sconto;
  const condizioniPagamento = Array.isArray(quote.condizioniPagamento) ? quote.condizioniPagamento : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dettaglio Preventivo</h1>
          <div className="flex items-center gap-3 mt-2">
            {isLocked ? (
              <Badge variant="outline" className="text-muted-foreground"><Lock className="h-3 w-3 mr-1" /> Bozza Bloccata</Badge>
            ) : (
              <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Sbloccato</Badge>
            )}
            <span className="text-sm text-muted-foreground">
              Creato il {format(new Date(quote.createdAt), "dd MMMM yyyy", { locale: it })}
            </span>
          </div>
        </div>
        <Button onClick={handleDownload} disabled={generatePdf.isPending} className="gap-2">
          {generatePdf.isPending ? <Skeleton className="h-4 w-4 rounded-full" /> : <Download className="h-4 w-4" />}
          {isLocked ? "Sblocca & Scarica PDF" : "Scarica / Stampa PDF"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main preview card */}
        <div className="md:col-span-2 relative">
          <Card className="overflow-hidden bg-white text-black border shadow-lg relative">
            {isLocked && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 flex items-center justify-center opacity-[0.03]">
                <div className="text-[120px] font-black -rotate-45 whitespace-nowrap text-black select-none tracking-widest">
                  BOZZA NON VALIDA
                </div>
              </div>
            )}

            <div className="p-8 sm:p-10">
              {/* Company header */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{profile?.companyName || "La Tua Azienda"}</h2>
                  {profile?.vatNumber && <div className="text-slate-500 text-xs mt-1">P.IVA: {profile.vatNumber}</div>}
                  {profile?.address && <div className="text-slate-500 text-xs">{profile.address}</div>}
                  {profile?.phone && <div className="text-slate-500 text-xs">{profile.phone}</div>}
                  {profile?.email && <div className="text-slate-500 text-xs">{profile.email}</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Preventivo</div>
                  {quote.numeroPreventivoData && (
                    <div className="text-sm font-bold text-slate-700 mt-1">{quote.numeroPreventivoData}</div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">Data: {format(new Date(quote.createdAt), "dd/MM/yyyy")}</div>
                </div>
              </div>

              {/* Document title */}
              {quote.titoloPreventivoRiga1 && (
                <div className="text-center mb-1">
                  <div className="text-sm font-bold uppercase tracking-wide text-slate-800">{quote.titoloPreventivoRiga1}</div>
                  {quote.titoloPreventivoRiga2 && (
                    <div className="text-xs text-slate-500 italic mt-0.5">{quote.titoloPreventivoRiga2}</div>
                  )}
                </div>
              )}

              {/* Client section */}
              <div className="mt-5 mb-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Spett.le Committente</div>
                {isEditingClient ? (
                  <div className="space-y-2 bg-slate-50 p-4 rounded border border-slate-200">
                    <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome / Ragione Sociale" className="bg-white" />
                    <Input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Indirizzo" className="bg-white" />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingClient(false)}>Annulla</Button>
                      <Button size="sm" onClick={handleSaveClient} disabled={updateQuote.isPending}><Save className="h-4 w-4 mr-2" />Salva</Button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative flex items-start gap-2 bg-slate-50 border border-slate-200 rounded px-4 py-3">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">{quote.clientData?.nome || "——"}</div>
                      {quote.clientData?.indirizzo && <div className="text-slate-500 text-sm">{quote.clientData.indirizzo}</div>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => setIsEditingClient(true)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Quadro Sintetico */}
              {hasCapitoli && (
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">1. Quadro Sintetico</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="py-2 px-3 text-left font-semibold">Capitolo</th>
                        <th className="py-2 px-3 text-right font-semibold">Importo netto</th>
                        <th className="py-2 px-3 text-left font-semibold hidden sm:table-cell">Osservazione</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capitoli.map((cap, i) => (
                        <tr key={cap.lettera} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="py-2 px-3 text-slate-700">{cap.lettera}. {cap.titolo}</td>
                          <td className="py-2 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(cap.subtotale)}</td>
                          <td className="py-2 px-3 text-slate-400 italic hidden sm:table-cell">{cap.osservazione ?? "Voce ordinaria"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Chapter detail sections */}
              {hasCapitoli ? (
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">2. Computo Metrico Dettagliato</div>
                  <div className="space-y-4">
                    {capitoli.map(cap => {
                      const isExpanded = expandedChapters.has(cap.lettera);
                      return (
                        <div key={cap.lettera} className="border border-slate-200 rounded overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-100 text-left hover:bg-slate-200 transition-colors"
                            onClick={() => toggleChapter(cap.lettera)}
                          >
                            <span className="font-bold text-slate-800 text-sm">{cap.lettera}. {cap.titolo}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-slate-700">{formatCurrency(cap.subtotale)}</span>
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                            </div>
                          </button>
                          {isExpanded && (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-700 text-white">
                                  <th className="py-1.5 px-3 text-left">Descrizione</th>
                                  <th className="py-1.5 px-2 text-center w-12">U.M.</th>
                                  <th className="py-1.5 px-2 text-center w-12">Q.tà</th>
                                  <th className="py-1.5 px-3 text-right w-24">P.u.</th>
                                  <th className="py-1.5 px-3 text-right w-24">Totale</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cap.voci.map((voce, vi) => (
                                  <tr key={vi} className={vi % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                    <td className="py-2 px-3 text-slate-700">{voce.descrizione}</td>
                                    <td className="py-2 px-2 text-center text-slate-500">{voce.um}</td>
                                    <td className="py-2 px-2 text-center text-slate-500">{voce.quantita}</td>
                                    <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">{formatCurrency(voce.prezzoUnitario)}</td>
                                    <td className="py-2 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(voce.totale)}</td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-200">
                                  <td colSpan={4} className="py-2 px-3 font-bold text-slate-700 text-right">Subtotale capitolo {cap.lettera}</td>
                                  <td className="py-2 px-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(cap.subtotale)}</td>
                                </tr>
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Legacy flat items fallback */
                <table className="w-full mb-6 text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-800 text-slate-800">
                      <th className="py-3 text-left font-semibold">Descrizione</th>
                      <th className="py-3 text-center font-semibold w-20">U.M.</th>
                      <th className="py-3 text-right font-semibold w-20">Q.tà</th>
                      <th className="py-3 text-right font-semibold w-28">P.u.</th>
                      <th className="py-3 text-right font-semibold w-28">Totale</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 divide-y divide-slate-100">
                    {quote.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-3 pr-4">{item.descrizione}</td>
                        <td className="py-3 text-center">{item.unita}</td>
                        <td className="py-3 text-right">{item.quantita}</td>
                        <td className="py-3 text-right whitespace-nowrap">{formatCurrency(item.prezzoUnitario)}</td>
                        <td className="py-3 text-right whitespace-nowrap">{formatCurrency(item.totale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Totals */}
              <div className="flex justify-end pt-2 mb-6">
                <div className="w-72 border border-slate-200 rounded overflow-hidden text-sm">
                  <div className="flex justify-between px-4 py-2.5 text-slate-600 border-b border-slate-100">
                    <span>Imponibile totale:</span>
                    <span className="font-medium">{formatCurrency(quote.subtotale)}</span>
                  </div>
                  {sconto && sconto.percentuale > 0 && (
                    <>
                      <div className="flex justify-between px-4 py-2.5 text-slate-600 border-b border-slate-100">
                        <span>Sconto ({sconto.percentuale}%):</span>
                        <span className="font-medium text-green-700">−{formatCurrency(quote.subtotale - sconto.importoScontato)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5 text-slate-600 border-b border-slate-100">
                        <span>Imponibile scontato:</span>
                        <span className="font-medium">{formatCurrency(sconto.importoScontato)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between px-4 py-2.5 text-slate-600 border-b border-slate-100">
                    <span>IVA ({quote.ivaPercentuale}%):</span>
                    <span className="font-medium">{formatCurrency(quote.ivaValore)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 bg-slate-800 text-white font-bold text-base">
                    <span>TOTALE</span>
                    <span>{formatCurrency(quote.totale)}</span>
                  </div>
                </div>
              </div>

              {/* Condizioni di pagamento */}
              {condizioniPagamento.length > 0 && (
                <div className="mb-6 border border-slate-200 rounded p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Condizioni di Pagamento</div>
                  <ul className="space-y-1.5">
                    {condizioniPagamento.map((cond, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="font-medium uppercase">{cond}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              {quote.note && (
                <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">
                  <strong>Note: </strong>{quote.note}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Azioni Rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleDownload} className="w-full justify-start gap-2" variant={isLocked ? "default" : "secondary"}>
                {isLocked ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {isLocked ? "Sblocca PDF" : "Scarica PDF"}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setIsEditingClient(true)}>
                <Edit2 className="h-4 w-4" />
                Modifica Committente
              </Button>
            </CardContent>
          </Card>

          {/* Summary card */}
          {hasCapitoli && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Riepilogo Capitoli</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {capitoli.map(cap => (
                  <div key={cap.lettera} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">{cap.lettera}. {cap.titolo}</span>
                    <span className="font-medium shrink-0">{formatCurrency(cap.subtotale)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between font-bold text-sm">
                  <span>Totale</span>
                  <span>{formatCurrency(quote.totale)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Input Originale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">"{quote.rawInput}"</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Paywall dialog */}
      <Dialog open={isPaywallOpen} onOpenChange={setIsPaywallOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sblocca il Preventivo</DialogTitle>
            <DialogDescription>
              Questo preventivo è in bozza. Scegli un piano per rimuovere il watermark, scaricare il PDF pulito e inviarlo al cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {plans?.map((plan) => (
              <Card key={plan.id} className={`flex flex-col ${plan.id.includes("premium") || plan.id.includes("oneshot_clean") ? "border-primary ring-1 ring-primary" : ""}`}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">€{plan.price}</span>
                    {plan.interval && <span className="text-muted-foreground text-sm">/{plan.interval}</span>}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <div className="p-4 pt-0 mt-auto">
                  <Button
                    className="w-full"
                    variant={plan.id.includes("premium") || plan.id.includes("oneshot_clean") ? "default" : "outline"}
                    onClick={() => handleCheckout(plan.id)}
                    disabled={createCheckout.isPending}
                  >
                    Acquista
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
