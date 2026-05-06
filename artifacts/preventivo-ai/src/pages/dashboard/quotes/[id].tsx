import { useParams } from "wouter";
import { useGetQuote, useGetBusinessProfile, useGenerateQuotePdf, useGetPlans, useUpdateQuote, useCreateCheckoutSession, getGetQuoteQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Download, Lock, CheckCircle2, Edit2, Save, FileText, ChevronDown, ChevronRight, Plus, Trash2, X, Pencil } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type EditVoce = {
  descrizione: string;
  um: string;
  quantita: number;
  prezzoUnitario: number;
};

type EditCapitolo = {
  lettera: string;
  titolo: string;
  osservazione: string;
  voci: EditVoce[];
};

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

  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitolo1, setEditTitolo1] = useState("");
  const [editTitolo2, setEditTitolo2] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editScontoPerc, setEditScontoPerc] = useState(0);
  const [editIvaPerc, setEditIvaPerc] = useState(22);
  const [editCapitoli, setEditCapitoli] = useState<EditCapitolo[]>([]);

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

  const openPdfWindow = (htmlContent: string) => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 500);
    }
  };

  const handleDownload = () => {
    if (!id || !quote) return;
    generatePdf.mutate({ id }, {
      onSuccess: (result) => { openPdfWindow(result.htmlContent); },
      onError: () => {
        toast({ title: "Errore", description: "Impossibile generare il PDF", variant: "destructive" });
      }
    });
  };

  const handleUnlock = () => { setIsPaywallOpen(true); };

  const handleCheckout = (planType: string) => {
    if (!id) return;
    createCheckout.mutate({
      data: { quoteId: id, planType: planType as Parameters<typeof createCheckout.mutate>[0]["data"]["planType"] }
    }, {
      onSuccess: (result) => { window.location.href = result.url; }
    });
  };

  const enterEditMode = () => {
    if (!quote) return;
    setEditTitolo1(quote.titoloPreventivoRiga1 || "");
    setEditTitolo2(quote.titoloPreventivoRiga2 || "");
    setEditNote(quote.note || "");
    setEditScontoPerc(quote.sconto?.percentuale ?? 0);
    setEditIvaPerc(quote.ivaPercentuale ?? 22);
    setEditCapitoli(
      (quote.capitoli ?? []).map(cap => ({
        lettera: cap.lettera,
        titolo: cap.titolo,
        osservazione: cap.osservazione ?? "",
        voci: cap.voci.map(v => ({
          descrizione: v.descrizione,
          um: v.um,
          quantita: v.quantita,
          prezzoUnitario: v.prezzoUnitario,
        })),
      }))
    );
    setIsEditMode(true);
  };

  const handleSaveEdit = () => {
    if (!id) return;
    const newCapitoli = editCapitoli.map(cap => ({
      lettera: cap.lettera,
      titolo: cap.titolo,
      osservazione: cap.osservazione,
      voci: cap.voci.map(v => ({
        descrizione: v.descrizione,
        um: v.um,
        quantita: Number(v.quantita),
        prezzoUnitario: Number(v.prezzoUnitario),
        totale: Number(v.quantita) * Number(v.prezzoUnitario),
      })),
      subtotale: cap.voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0),
    }));

    const subtotale = newCapitoli.reduce((s, cap) => s + cap.subtotale, 0);
    const imponibile = editScontoPerc > 0 ? subtotale * (1 - editScontoPerc / 100) : subtotale;
    const ivaValore = imponibile * (editIvaPerc / 100);
    const totale = imponibile + ivaValore;
    const sconto = editScontoPerc > 0
      ? { percentuale: editScontoPerc, importoScontato: imponibile }
      : null;

    updateQuote.mutate({
      id,
      data: {
        capitoli: newCapitoli,
        titoloPreventivoRiga1: editTitolo1 || null,
        titoloPreventivoRiga2: editTitolo2 || null,
        note: editNote,
        sconto,
        subtotale,
        ivaPercentuale: editIvaPerc,
        ivaValore,
        totale,
      }
    }, {
      onSuccess: (updatedQuote) => {
        setIsEditMode(false);
        toast({ title: "Preventivo aggiornato con successo" });
        queryClient.setQueryData(getGetQuoteQueryKey(id), updatedQuote);
      },
      onError: () => {
        toast({ title: "Errore", description: "Impossibile salvare le modifiche", variant: "destructive" });
      }
    });
  };

  const updateVoce = (capIdx: number, voceIdx: number, field: keyof EditVoce, value: string | number) => {
    setEditCapitoli(prev => prev.map((cap, ci) =>
      ci !== capIdx ? cap : {
        ...cap,
        voci: cap.voci.map((v, vi) =>
          vi !== voceIdx ? v : { ...v, [field]: value }
        )
      }
    ));
  };

  const addVoce = (capIdx: number) => {
    setEditCapitoli(prev => prev.map((cap, ci) =>
      ci !== capIdx ? cap : {
        ...cap,
        voci: [...cap.voci, { descrizione: "", um: "a.c.", quantita: 1, prezzoUnitario: 0 }]
      }
    ));
  };

  const removeVoce = (capIdx: number, voceIdx: number) => {
    setEditCapitoli(prev => prev.map((cap, ci) =>
      ci !== capIdx ? cap : { ...cap, voci: cap.voci.filter((_, vi) => vi !== voceIdx) }
    ));
  };

  const updateCapitolo = (capIdx: number, field: keyof Omit<EditCapitolo, "voci">, value: string) => {
    setEditCapitoli(prev => prev.map((cap, ci) =>
      ci !== capIdx ? cap : { ...cap, [field]: value }
    ));
  };

  const addCapitolo = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const usedLetters = new Set(editCapitoli.map(c => c.lettera));
    const nextLetter =
      [...letters].find(l => !usedLetters.has(l)) ??
      String(editCapitoli.length + 1);
    setEditCapitoli(prev => [
      ...prev,
      { lettera: nextLetter, titolo: "Nuovo Capitolo", osservazione: "Voce ordinaria", voci: [] }
    ]);
  };

  const removeCapitolo = (capIdx: number) => {
    setEditCapitoli(prev => prev.filter((_, ci) => ci !== capIdx));
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

  const companyName = quote.companySnapshot?.companyName || profile?.companyName || "La Tua Azienda";
  const companyVat = quote.companySnapshot?.vatNumber || profile?.vatNumber;
  const companyAddress = quote.companySnapshot?.address || profile?.address;
  const companyPhone = quote.companySnapshot?.phone || profile?.phone;
  const companyEmail = quote.companySnapshot?.email || profile?.email;
  const companyLogoUrl = isLocked
    ? "/prevai-logo.png"
    : (quote.companySnapshot?.logoUrl || profile?.logoUrl || "");

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
        <div className="flex gap-2">
          <Button
            variant={isEditMode ? "default" : "outline"}
            className="gap-2"
            onClick={isEditMode ? () => setIsEditMode(false) : enterEditMode}
          >
            {isEditMode ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {isEditMode ? "Annulla Modifica" : "Modifica Preventivo"}
          </Button>
          {!isLocked && (
            <Button onClick={handleDownload} variant="outline" disabled={generatePdf.isPending} className="gap-2">
              {generatePdf.isPending ? <Skeleton className="h-4 w-4 rounded-full" /> : <Download className="h-4 w-4" />}
              Scarica / Stampa PDF
            </Button>
          )}
          {isLocked && (
            <Button onClick={handleUnlock} className="gap-2">
              <Lock className="h-4 w-4" />
              Sblocca PDF Pulito
            </Button>
          )}
        </div>
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
                  {companyLogoUrl && (
                    <img
                      src={companyLogoUrl}
                      alt={isLocked ? "prevai" : "Logo"}
                      className={isLocked ? "h-7 mb-2 object-contain" : "max-h-14 max-w-[160px] object-contain mb-2"}
                    />
                  )}
                  <h2 className="text-xl font-bold text-slate-800">{companyName}</h2>
                  {companyVat && <div className="text-slate-500 text-xs mt-1">P.IVA: {companyVat}</div>}
                  {companyAddress && <div className="text-slate-500 text-xs">{companyAddress}</div>}
                  {companyPhone && <div className="text-slate-500 text-xs">{companyPhone}</div>}
                  {companyEmail && <div className="text-slate-500 text-xs">{companyEmail}</div>}
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
        <div className="space-y-4">
          {/* Thumbnail for locked quotes */}
          {isLocked && (
            <Card className="overflow-hidden">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Anteprima PDF
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative overflow-hidden bg-slate-100" style={{ height: 170 }}>
                  {/* Scaled-down document preview — non-interactive */}
                  <div
                    className="absolute top-0 left-0 bg-white origin-top-left"
                    style={{
                      transform: "scale(0.27)",
                      width: 900,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    <div className="p-8 text-black text-xs">
                      <div className="flex justify-between border-b-2 border-slate-800 pb-4 mb-4">
                        <div>
                          {companyLogoUrl && (
                            <img
                              src={companyLogoUrl}
                              alt={isLocked ? "prevai" : "Logo"}
                              className={isLocked ? "h-4 mb-1 object-contain" : "max-h-8 max-w-[80px] object-contain mb-1"}
                            />
                          )}
                          <div className="text-xl font-bold text-slate-800">{companyName}</div>
                          {companyVat && <div className="text-slate-500 text-xs mt-1">P.IVA: {companyVat}</div>}
                          {companyAddress && <div className="text-slate-500 text-xs">{companyAddress}</div>}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400 uppercase tracking-wider">Preventivo</div>
                          {quote.numeroPreventivoData && <div className="text-sm font-bold text-slate-700 mt-1">{quote.numeroPreventivoData}</div>}
                        </div>
                      </div>
                      {quote.titoloPreventivoRiga1 && (
                        <div className="text-center mb-4">
                          <div className="text-sm font-bold uppercase tracking-wide text-slate-800">{quote.titoloPreventivoRiga1}</div>
                          {quote.titoloPreventivoRiga2 && <div className="text-xs text-slate-500 italic mt-1">{quote.titoloPreventivoRiga2}</div>}
                        </div>
                      )}
                      <div className="bg-slate-50 border border-slate-200 rounded px-4 py-3 mb-4">
                        <div className="font-semibold text-slate-800">{quote.clientData?.nome}</div>
                        <div className="text-slate-500 text-xs">{quote.clientData?.indirizzo}</div>
                      </div>
                      {capitoli.slice(0, 3).map((cap, i) => (
                        <div key={cap.lettera} className={`flex justify-between px-3 py-2 text-xs ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                          <span className="text-slate-700">{cap.lettera}. {cap.titolo}</span>
                          <span className="font-medium text-slate-800 whitespace-nowrap">{formatCurrency(cap.subtotale)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between px-3 py-3 bg-slate-800 text-white font-bold mt-4 rounded">
                        <span>TOTALE</span>
                        <span>{formatCurrency(quote.totale)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Blur overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background/70 pointer-events-none" />
                  <div className="absolute bottom-0 inset-x-0 flex flex-col items-center justify-end p-3">
                    <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleUnlock}>
                      <Lock className="h-3 w-3" />
                      Sblocca per il PDF pulito
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Azioni Rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLocked && (
                <Button onClick={handleUnlock} className="w-full justify-start gap-2">
                  <Lock className="h-4 w-4" />
                  Sblocca PDF Pulito
                </Button>
              )}
              {!isLocked && (
                <Button onClick={handleDownload} disabled={generatePdf.isPending} className="w-full justify-start gap-2" variant="outline">
                  <Download className="h-4 w-4" />
                  Scarica PDF
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={isEditMode ? () => setIsEditMode(false) : enterEditMode}
              >
                <Pencil className="h-4 w-4" />
                {isEditMode ? "Chiudi Editor" : "Modifica Voci"}
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
            <CardHeader className="pb-2">
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

      {/* ── EDIT PANEL ── */}
      {isEditMode && (
        <Card className="border-primary/40 shadow-md animate-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-primary" />
                  Modifica Preventivo
                </CardTitle>
                <CardDescription className="mt-1">Modifica le voci, i prezzi e i titoli. Il totale verrà ricalcolato automaticamente al salvataggio.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditMode(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Annulla
                </Button>
                <Button onClick={handleSaveEdit} disabled={updateQuote.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateQuote.isPending ? "Salvataggio..." : "Salva Modifiche"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-8">
            {/* Titoli */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Titoli Documento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Titolo riga 1</Label>
                  <Input
                    value={editTitolo1}
                    onChange={e => setEditTitolo1(e.target.value)}
                    placeholder="Analisi Economica e Computo Metrico Prezzato"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Titolo riga 2 (sottotitolo)</Label>
                  <Input
                    value={editTitolo2}
                    onChange={e => setEditTitolo2(e.target.value)}
                    placeholder="Intervento di... – Comune (Prov)"
                  />
                </div>
              </div>
            </div>

            {/* Capitoli */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Capitoli e Voci</h3>
              <div className="space-y-6">
                {editCapitoli.map((cap, capIdx) => {
                  const capSubtotale = cap.voci.reduce(
                    (s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0
                  );
                  return (
                    <div key={capIdx} className="border rounded-lg overflow-hidden">
                      {/* Chapter header */}
                      <div className="bg-slate-50 px-4 py-3 flex items-center gap-3 border-b">
                        <span className="text-sm font-bold text-slate-500 w-8 shrink-0">{cap.lettera}.</span>
                        <Input
                          value={cap.titolo}
                          onChange={e => updateCapitolo(capIdx, "titolo", e.target.value)}
                          className="font-semibold text-sm h-8 flex-1"
                          placeholder="Titolo capitolo"
                        />
                        <Input
                          value={cap.osservazione}
                          onChange={e => updateCapitolo(capIdx, "osservazione", e.target.value)}
                          className="text-xs h-8 w-40 text-muted-foreground"
                          placeholder="Osservazione"
                        />
                        <span className="text-sm font-semibold text-slate-700 whitespace-nowrap shrink-0">
                          {formatCurrency(capSubtotale)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => removeCapitolo(capIdx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Voci table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600">
                              <th className="py-2 px-3 text-left font-medium text-xs">Descrizione</th>
                              <th className="py-2 px-2 text-center font-medium text-xs w-16">U.M.</th>
                              <th className="py-2 px-2 text-center font-medium text-xs w-20">Q.tà</th>
                              <th className="py-2 px-2 text-center font-medium text-xs w-28">P.U. (€)</th>
                              <th className="py-2 px-3 text-right font-medium text-xs w-28">Totale</th>
                              <th className="w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {cap.voci.map((voce, vi) => {
                              const voceTotal = Number(voce.quantita) * Number(voce.prezzoUnitario);
                              return (
                                <tr key={vi} className={cn("group", vi % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                                  <td className="py-1.5 px-3">
                                    <Input
                                      value={voce.descrizione}
                                      onChange={e => updateVoce(capIdx, vi, "descrizione", e.target.value)}
                                      className="h-8 text-xs border-transparent focus:border-input bg-transparent"
                                      placeholder="Descrizione lavorazione"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <Input
                                      value={voce.um}
                                      onChange={e => updateVoce(capIdx, vi, "um", e.target.value)}
                                      className="h-8 text-xs text-center border-transparent focus:border-input bg-transparent w-14"
                                      placeholder="mq"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <Input
                                      type="number"
                                      value={voce.quantita}
                                      onChange={e => updateVoce(capIdx, vi, "quantita", e.target.value === "" ? 0 : Number(e.target.value))}
                                      className="h-8 text-xs text-center border-transparent focus:border-input bg-transparent w-18"
                                      min={0}
                                      step={0.01}
                                    />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <Input
                                      type="number"
                                      value={voce.prezzoUnitario}
                                      onChange={e => updateVoce(capIdx, vi, "prezzoUnitario", e.target.value === "" ? 0 : Number(e.target.value))}
                                      className="h-8 text-xs text-right border-transparent focus:border-input bg-transparent w-26"
                                      min={0}
                                      step={0.01}
                                    />
                                  </td>
                                  <td className="py-1.5 px-3 text-right text-xs font-medium text-slate-700 whitespace-nowrap">
                                    {formatCurrency(voceTotal)}
                                  </td>
                                  <td className="py-1.5 px-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                                      onClick={() => removeVoce(capIdx, vi)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Add voce */}
                      <div className="px-4 py-2 bg-white border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-primary hover:text-primary"
                          onClick={() => addVoce(capIdx)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Aggiungi voce
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Add chapter */}
                <Button variant="outline" className="w-full gap-2 border-dashed" onClick={addCapitolo}>
                  <Plus className="h-4 w-4" />
                  Aggiungi Capitolo
                </Button>
              </div>
            </div>

            {/* Sconto e IVA */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sconto e IVA</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label>Sconto (%)</Label>
                  <Input
                    type="number"
                    value={editScontoPerc}
                    onChange={e => setEditScontoPerc(Math.max(0, Math.min(100, Number(e.target.value))))}
                    min={0}
                    max={100}
                    step={1}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>IVA (%)</Label>
                  <Input
                    type="number"
                    value={editIvaPerc}
                    onChange={e => setEditIvaPerc(Math.max(0, Number(e.target.value)))}
                    min={0}
                    step={1}
                    placeholder="22"
                  />
                </div>
                <div className="col-span-2 flex items-end">
                  <div className="bg-muted/50 rounded-lg px-4 py-2.5 w-full text-sm">
                    {(() => {
                      const sub = editCapitoli.reduce(
                        (s, cap) => s + cap.voci.reduce((cs, v) => cs + Number(v.quantita) * Number(v.prezzoUnitario), 0), 0
                      );
                      const imponibile = editScontoPerc > 0 ? sub * (1 - editScontoPerc / 100) : sub;
                      const iva = imponibile * (editIvaPerc / 100);
                      const tot = imponibile + iva;
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between text-muted-foreground"><span>Imponibile:</span><span>{formatCurrency(sub)}</span></div>
                          {editScontoPerc > 0 && <div className="flex justify-between text-green-600"><span>Dopo sconto:</span><span>{formatCurrency(imponibile)}</span></div>}
                          <div className="flex justify-between text-muted-foreground"><span>IVA {editIvaPerc}%:</span><span>{formatCurrency(iva)}</span></div>
                          <div className="flex justify-between font-bold border-t pt-1"><span>Totale:</span><span>{formatCurrency(tot)}</span></div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Note */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Note Finali</h3>
              <Textarea
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                placeholder="Preventivo valido 30 giorni dalla data di emissione..."
                className="resize-none min-h-[80px]"
              />
            </div>

            {/* Save row */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setIsEditMode(false)}>
                <X className="h-4 w-4 mr-2" />
                Annulla
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateQuote.isPending} size="lg">
                <Save className="h-4 w-4 mr-2" />
                {updateQuote.isPending ? "Salvataggio in corso..." : "Salva tutte le modifiche"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                    {createCheckout.isPending ? "..." : "Seleziona"}
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
