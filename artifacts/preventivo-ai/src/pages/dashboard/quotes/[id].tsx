import { useParams } from "wouter";
import { useGetQuote, useGetBusinessProfile, useGenerateQuotePdf, useGetPlans, useUpdateQuote, useCreateCheckoutSession, getGetQuoteQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, Lock, CheckCircle2, Edit2, Save, FileText } from "lucide-react";
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

  const initializedForId = useRef<string | null>(null);

  useEffect(() => {
    if (quote && initializedForId.current !== id) {
      initializedForId.current = id || null;
      setClientName(quote.clientData?.nome || "");
      setClientAddress(quote.clientData?.indirizzo || "");
    }
  }, [quote, id]);

  const handleSaveClient = () => {
    if (!id) return;
    updateQuote.mutate({
      id,
      data: {
        clientData: { nome: clientName, indirizzo: clientAddress }
      }
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
        // Open a new window and document write the HTML so browser can print it
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.htmlContent);
          printWindow.document.close();
          // Give it a moment to load styles before printing
          setTimeout(() => {
            printWindow.print();
          }, 500);
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
      data: { quoteId: id, planType: planType as any }
    }, {
      onSuccess: (result) => {
        window.location.href = result.url;
      }
    });
  };

  if (isLoadingQuote || isLoadingProfile) {
    return <div className="p-8 space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!quote) return <div>Preventivo non trovato</div>;

  const isLocked = quote.status !== "unlocked";
  const formatCurrency = (amount: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dettaglio Preventivo</h1>
          <div className="flex items-center gap-3 mt-2">
            {isLocked ? (
              <Badge variant="outline" className="text-muted-foreground"><Lock className="h-3 w-3 mr-1" /> Bozza Bloccata</Badge>
            ) : (
              <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Sbloccato</Badge>
            )}
            <span className="text-sm text-muted-foreground">Creato il {format(new Date(quote.createdAt), 'dd MMMM yyyy', { locale: it })}</span>
          </div>
        </div>
        <Button onClick={handleDownload} disabled={generatePdf.isPending} className="gap-2">
          {generatePdf.isPending ? <Skeleton className="h-4 w-4 rounded-full" /> : <Download className="h-4 w-4" />}
          {isLocked ? "Sblocca & Scarica PDF" : "Scarica / Stampa PDF"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 relative">
          <Card className="overflow-hidden bg-white text-black min-h-[800px] border shadow-lg relative">
            {isLocked && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 flex items-center justify-center opacity-[0.03]">
                <div className="text-[120px] font-black -rotate-45 whitespace-nowrap text-black select-none tracking-widest">
                  BOZZA NON VALIDA
                </div>
              </div>
            )}
            
            <div className="p-8 sm:p-12">
              <div className="flex justify-between items-start border-b pb-8 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">{profile?.companyName || "La Tua Azienda"}</h2>
                  {profile?.vatNumber && <div className="text-slate-500 mt-1 text-sm">P.IVA: {profile.vatNumber}</div>}
                  {profile?.address && <div className="text-slate-500 text-sm">{profile.address}</div>}
                  {profile?.phone && <div className="text-slate-500 text-sm">{profile.phone}</div>}
                  {profile?.email && <div className="text-slate-500 text-sm">{profile.email}</div>}
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-slate-200 uppercase tracking-widest mb-2">Preventivo</div>
                  <div className="text-slate-700 font-medium">Data: {format(new Date(quote.createdAt), 'dd/MM/yyyy')}</div>
                </div>
              </div>

              <div className="mb-8">
                <div className="font-semibold text-slate-700 mb-2">Spett.le Cliente:</div>
                {isEditingClient ? (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-md border border-slate-200">
                    <Input 
                      value={clientName} 
                      onChange={e => setClientName(e.target.value)} 
                      placeholder="Nome Cliente"
                      className="bg-white"
                    />
                    <Input 
                      value={clientAddress} 
                      onChange={e => setClientAddress(e.target.value)} 
                      placeholder="Indirizzo"
                      className="bg-white"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingClient(false)}>Annulla</Button>
                      <Button size="sm" onClick={handleSaveClient} disabled={updateQuote.isPending}><Save className="h-4 w-4 mr-2" /> Salva</Button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative">
                    <div className="text-slate-800 font-medium text-lg">{quote.clientData?.nome || "Nome Non Specificato"}</div>
                    <div className="text-slate-600">{quote.clientData?.indirizzo || "Indirizzo Non Specificato"}</div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-0 -right-10 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-slate-800"
                      onClick={() => setIsEditingClient(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {quote.descrizioneGenerale && (
                <div className="mb-8 text-slate-700 text-sm bg-slate-50 p-4 rounded border border-slate-100 italic">
                  "{quote.descrizioneGenerale}"
                </div>
              )}

              <table className="w-full mb-8 text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-slate-800">
                    <th className="py-3 text-left font-semibold">Descrizione Lavori / Forniture</th>
                    <th className="py-3 text-right font-semibold">Quantità</th>
                    <th className="py-3 text-right font-semibold">Prezzo Unit.</th>
                    <th className="py-3 text-right font-semibold">Totale</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 divide-y divide-slate-100">
                  {quote.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-4 pr-4">{item.descrizione}</td>
                      <td className="py-4 text-right whitespace-nowrap">{item.quantita} {item.unita}</td>
                      <td className="py-4 text-right whitespace-nowrap">{formatCurrency(item.prezzoUnitario)}</td>
                      <td className="py-4 text-right whitespace-nowrap">{formatCurrency(item.totale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end pt-4">
                <div className="w-64 space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Imponibile:</span>
                    <span>{formatCurrency(quote.subtotale)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>IVA ({quote.ivaPercentuale}%):</span>
                    <span>{formatCurrency(quote.ivaValore)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg text-slate-800 pt-3 border-t-2 border-slate-800">
                    <span>Totale:</span>
                    <span>{formatCurrency(quote.totale)}</span>
                  </div>
                </div>
              </div>
              
              {quote.note && (
                <div className="mt-16 pt-8 border-t border-slate-200 text-xs text-slate-500">
                  <strong>Note: </strong> {quote.note}
                </div>
              )}
            </div>
          </Card>
        </div>

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
                Modifica Intestazione
              </Button>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" /> 
                Input Originale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">
                "{quote.rawInput}"
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isPaywallOpen} onOpenChange={setIsPaywallOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sblocca il Preventivo</DialogTitle>
            <DialogDescription>
              Questo preventivo è in bozza e ha un watermark. Scegli un piano per rimuovere il watermark, scaricare il PDF pulito e inviarlo al cliente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {plans?.map((plan) => (
              <Card key={plan.id} className={`flex flex-col ${plan.id.includes('premium') || plan.id.includes('oneshot_clean') ? 'border-primary ring-1 ring-primary' : ''}`}>
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
                    variant={plan.id.includes('premium') || plan.id.includes('oneshot_clean') ? 'default' : 'outline'}
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