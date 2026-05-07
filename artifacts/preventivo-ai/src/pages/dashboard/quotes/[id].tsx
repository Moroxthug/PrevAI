import { useParams, useSearch } from "wouter";
import { useGetQuote, useGetBusinessProfile, useGenerateQuotePdf, useGetPlans, useUpdateQuote, useCreateCheckoutSession, useVerifyPayment, useGetSubscription, useUnlockQuoteWithSubscription, useCreateCustomerPortalSession, useRegenerateQuote, useDuplicateQuote, useUpgradeToCapitolatoPro, useGenerateQuotePdfPro, getGetQuoteQueryKey, getVerifyPaymentQueryKey, getListQuotesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Download, Lock, CheckCircle2, Edit2, Save, FileText, ChevronDown, ChevronRight, Plus, Trash2, X, Pencil, Sparkles, AlertTriangle, RefreshCw, Loader2, Copy, Star, FileDown, LayoutTemplate } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
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
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const paymentResult = searchParams.get("payment");

  const { data: quote, isLoading: isLoadingQuote } = useGetQuote(id || "");
  const { data: profile, isLoading: isLoadingProfile } = useGetBusinessProfile();
  const { data: plans } = useGetPlans();
  const generatePdf = useGenerateQuotePdf();
  const updateQuote = useUpdateQuote();
  const createCheckout = useCreateCheckoutSession();
  const upgradeToCapitolato = useUpgradeToCapitolatoPro();
  const generatePdfPro = useGenerateQuotePdfPro();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Subscription status
  const { data: subscription } = useGetSubscription();
  const unlockWithSub = useUnlockQuoteWithSubscription();
  const createPortal = useCreateCustomerPortalSession();
  const regenerateQuote = useRegenerateQuote();
  const duplicateQuote = useDuplicateQuote();
  const [, navigate] = useLocation();

  // Regen panel state
  const [isRegenOpen, setIsRegenOpen] = useState(false);
  const [regenDescription, setRegenDescription] = useState("");

  const handleUpgrade = () => {
    createPortal.mutate(undefined, {
      onSuccess: (result) => { window.location.href = result.url; },
      onError: () => {
        toast({ title: "Errore", description: "Impossibile aprire il portale di gestione", variant: "destructive" });
      }
    });
  };

  // Auto-unlock if user has active subscription and quote is locked
  const [subUnlockDone, setSubUnlockDone] = useState(false);
  useEffect(() => {
    if (
      subscription?.isActive &&
      quote?.status !== "unlocked" &&
      id &&
      !subUnlockDone
    ) {
      setSubUnlockDone(true);
      unlockWithSub.mutate({ data: { quoteId: id } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(id) });
        },
      });
    }
  }, [subscription, quote?.status, id, subUnlockDone, unlockWithSub, queryClient]);

  // When returning from Stripe with ?payment=success, verify and unlock the quote
  const [verifyDone, setVerifyDone] = useState(false);
  const verifyEnabled = !!id && paymentResult === "success" && !verifyDone && quote?.status !== "unlocked";
  const { data: verifyData } = useVerifyPayment(id || "", {
    query: {
      queryKey: getVerifyPaymentQueryKey(id || ""),
      enabled: verifyEnabled,
      refetchInterval: verifyEnabled ? 2000 : false,
    },
  });

  useEffect(() => {
    if (verifyData?.status === "unlocked" && !verifyDone) {
      setVerifyDone(true);
      queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(id || "") });
      toast({ title: "Pagamento confermato!", description: "Il preventivo è stato sbloccato." });
    }
  }, [verifyData, verifyDone, id, queryClient, toast]);

  const [localTemplateId, setLocalTemplateId] = useState<string>("standard");

  useEffect(() => {
    setLocalTemplateId(quote?.templateId ?? "standard");
  }, [quote?.templateId]);

  const [isCapitolatoDialogOpen, setIsCapitolatoDialogOpen] = useState(false);
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
  const [editCondizioniPagamento, setEditCondizioniPagamento] = useState<string[]>([]);
  const [editClientNome, setEditClientNome] = useState("");
  const [editClientIndirizzo, setEditClientIndirizzo] = useState("");
  const [editClientCitta, setEditClientCitta] = useState("");
  const [editClientCap, setEditClientCap] = useState("");
  const [editClientProvincia, setEditClientProvincia] = useState("");
  const [editClientCF, setEditClientCF] = useState("");
  const [editClientPIVA, setEditClientPIVA] = useState("");

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
      onSuccess: (result) => {
        openPdfWindow(result.htmlContent);
        // Refresh quote to pick up the new pdfDownloadedAt (editing lock)
        queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(id) });
      },
      onError: () => {
        toast({ title: "Errore", description: "Impossibile generare il PDF", variant: "destructive" });
      }
    });
  };

  const handleRegenerate = () => {
    if (!id) return;
    regenerateQuote.mutate({
      id,
      data: {
        newDescription: regenDescription.trim() || undefined,
        keepClientData: true,
      },
    }, {
      onSuccess: (updatedQuote) => {
        setIsRegenOpen(false);
        setRegenDescription("");
        setIsEditMode(false);
        initializedForId.current = null; // force re-init of edit state
        queryClient.setQueryData(getGetQuoteQueryKey(id), updatedQuote);
        toast({ title: "Preventivo rigenerato con AI", description: "Il contenuto è stato aggiornato." });
      },
      onError: () => {
        toast({ title: "Errore rigenerazione", description: "Impossibile rigenerare il preventivo", variant: "destructive" });
      },
    });
  };

  const handleUpgradeToCapitolato = () => {
    if (!id) return;
    if (!isPro) { setIsPaywallOpen(true); return; }
    setIsCapitolatoDialogOpen(true);
  };

  const handleConfirmCapitolatoUpgrade = () => {
    if (!id) return;
    upgradeToCapitolato.mutate({ id }, {
      onSuccess: (updatedQuote) => {
        setIsCapitolatoDialogOpen(false);
        queryClient.setQueryData(getGetQuoteQueryKey(id), updatedQuote);
        toast({ title: "Capitolato Pro attivato!", description: "Le descrizioni sono state arricchite con terminologia professionale." });
      },
      onError: (err: unknown) => {
        setIsCapitolatoDialogOpen(false);
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Impossibile arricchire il preventivo";
        toast({ title: "Errore", description: msg, variant: "destructive" });
      },
    });
  };

  const handleDownloadProPdf = () => {
    if (!id || !quote) return;
    generatePdfPro.mutate({ id }, {
      onSuccess: (result) => {
        const pdfFullUrl = result.pdfUrl.startsWith("/api") ? result.pdfUrl : `/api/storage${result.pdfUrl}`;
        window.open(pdfFullUrl, "_blank");
        queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(id) });
        toast({ title: "PDF Pro generato!", description: "Il PDF professionale è pronto per il download." });
      },
      onError: () => {
        toast({ title: "Errore", description: "Impossibile generare il PDF professionale", variant: "destructive" });
      },
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
    setEditCondizioniPagamento(
      Array.isArray(quote.condizioniPagamento) ? [...quote.condizioniPagamento] : []
    );
    setEditClientNome(quote.clientData?.nome || "");
    setEditClientIndirizzo(quote.clientData?.indirizzo || "");
    setEditClientCitta(quote.clientData?.citta || "");
    setEditClientCap(quote.clientData?.cap || "");
    setEditClientProvincia(quote.clientData?.provincia || "");
    setEditClientCF(quote.clientData?.codiceFiscale || "");
    setEditClientPIVA(quote.clientData?.partitaIva || "");
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

    const updatedClientData = {
      nome: editClientNome.trim() || (quote?.clientData?.nome ?? ""),
      indirizzo: editClientIndirizzo.trim() || (quote?.clientData?.indirizzo ?? ""),
      ...(editClientCitta.trim() && { citta: editClientCitta.trim() }),
      ...(editClientCap.trim() && { cap: editClientCap.trim() }),
      ...(editClientProvincia.trim() && { provincia: editClientProvincia.trim() }),
      ...(editClientCF.trim() && { codiceFiscale: editClientCF.trim() }),
      ...(editClientPIVA.trim() && { partitaIva: editClientPIVA.trim() }),
    };

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
        condizioniPagamento: editCondizioniPagamento,
        clientData: updatedClientData,
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

  const isPro = subscription?.isActive && subscription?.plan === "monthly_pro";
  // Pro subscribers can always download — paywall only applies to Starter and one-shot
  const isLocked = quote.status !== "unlocked" && !isPro;
  // Editing is permanently locked once the PDF has been downloaded
  const isEditLocked = !!quote.pdfDownloadedAt;
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
  const companyLogoUrl = quote.companySnapshot?.logoUrl || profile?.logoUrl || "";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dettaglio Preventivo</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {isLocked ? (
              <Badge variant="outline" className="text-muted-foreground"><Lock className="h-3 w-3 mr-1" /> Bozza Bloccata</Badge>
            ) : (
              <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Sbloccato</Badge>
            )}
            {quote.capitolatoPro && (
              <Badge className="bg-violet-600 text-white gap-1">
                <Star className="h-3 w-3" />
                Capitolato Pro
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-slate-500">
              <LayoutTemplate className="h-3 w-3" />
              {localTemplateId === "arosio" ? "Arosio" : localTemplateId === "mariagrazia" ? "MariaGrazia" : "Standard"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Creato il {format(new Date(quote.createdAt), "dd MMMM yyyy", { locale: it })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isEditLocked && (
            <Button
              variant={isEditMode ? "default" : "outline"}
              className="gap-2"
              onClick={isEditMode ? () => setIsEditMode(false) : enterEditMode}
            >
              {isEditMode ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {isEditMode ? "Chiudi Editor" : "Modifica"}
            </Button>
          )}
          {!isEditLocked && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setIsRegenOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              Rigenera
            </Button>
          )}
          <Button
            onClick={isLocked ? handleUnlock : handleDownload}
            disabled={generatePdf.isPending}
            className="gap-2"
            variant={isLocked ? "default" : "outline"}
          >
            {generatePdf.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : isLocked ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            Scarica PDF
          </Button>
          {!quote.capitolatoPro && (
            <Button
              variant="outline"
              className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50"
              onClick={handleUpgradeToCapitolato}
              disabled={upgradeToCapitolato.isPending}
            >
              {upgradeToCapitolato.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Star className="h-4 w-4" />}
              {isPro ? "Migliora in Capitolato Pro" : "Capitolato Pro"}
              {!isPro && <Lock className="h-3 w-3 ml-1 opacity-60" />}
            </Button>
          )}
          {quote.capitolatoPro && isPro && quote.status === "unlocked" && (
            <Button
              variant="outline"
              className="gap-2 border-violet-400 text-violet-800 hover:bg-violet-50"
              onClick={handleDownloadProPdf}
              disabled={generatePdfPro.isPending}
            >
              {generatePdfPro.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <FileDown className="h-4 w-4" />}
              Scarica PDF Professionale
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main preview card */}
        <div className="md:col-span-2 relative">
          <Card className="overflow-hidden bg-white text-black border shadow-lg relative">
  
            {/* Edit mode top banner */}
            {isEditMode && !isEditLocked && (
              <div className="bg-violet-50 border-b-2 border-violet-200 px-5 py-3 flex items-center justify-between gap-4 sticky top-0 z-20">
                <span className="text-xs font-semibold text-violet-700 flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Modalità modifica — clicca su qualsiasi campo per modificarlo
                </span>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setIsEditMode(false)} className="h-7 text-xs gap-1">
                    <X className="h-3 w-3" /> Annulla
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={updateQuote.isPending} className="h-7 text-xs gap-1">
                    <Save className="h-3 w-3" />
                    {updateQuote.isPending ? "Salvataggio..." : "Salva modifiche"}
                  </Button>
                </div>
              </div>
            )}

            {/* Template-reactive preview banner */}
            {localTemplateId !== "standard" && (
              <div className={cn(
                "px-5 py-2 flex items-center gap-2 text-xs font-semibold border-b",
                localTemplateId === "arosio"
                  ? "bg-slate-900 text-white border-slate-700"
                  : "bg-amber-50 text-amber-900 border-amber-200"
              )}>
                <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
                {localTemplateId === "arosio"
                  ? "Template Arosio — capitolato numerato con subtotali per capitolo"
                  : "Template MariaGrazia — lista numerata con header OFFERTA"}
                <span className="ml-auto opacity-60 font-normal">Anteprima • il PDF finale rispecchia questo stile</span>
              </div>
            )}

            <div className={cn("p-8 sm:p-10", !isEditMode && "pointer-events-none select-none")}>
              {/* Company header */}
              <div className={cn(
                "flex justify-between items-start pb-6 mb-6 border-b-2",
                localTemplateId === "arosio" ? "border-slate-900" : "border-slate-800"
              )}>
                <div>
                  {companyLogoUrl && (
                    <img
                      src={companyLogoUrl}
                      alt="Logo"
                      className="max-h-14 max-w-[160px] object-contain mb-2"
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
              {isEditMode ? (
                <div className="text-center mb-2 space-y-1">
                  <input
                    value={editTitolo1}
                    onChange={e => setEditTitolo1(e.target.value)}
                    className="w-full text-sm font-bold uppercase tracking-wide text-slate-800 text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-violet-300 focus:border-violet-400 focus:outline-none"
                    placeholder="Titolo documento..."
                  />
                  <input
                    value={editTitolo2}
                    onChange={e => setEditTitolo2(e.target.value)}
                    className="w-full text-xs text-slate-500 italic text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-violet-300 focus:border-violet-400 focus:outline-none"
                    placeholder="Sottotitolo / oggetto..."
                  />
                </div>
              ) : (
                quote.titoloPreventivoRiga1 && (
                  <div className="text-center mb-1">
                    <div className="text-sm font-bold uppercase tracking-wide text-slate-800">{quote.titoloPreventivoRiga1}</div>
                    {quote.titoloPreventivoRiga2 && (
                      <div className="text-xs text-slate-500 italic mt-0.5">{quote.titoloPreventivoRiga2}</div>
                    )}
                  </div>
                )
              )}

              {/* Client section */}
              <div className="mt-5 mb-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Spett.le Committente</div>
                {isEditMode ? (
                  <div className="space-y-2 bg-violet-50/60 border border-violet-200 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={editClientNome}
                        onChange={e => setEditClientNome(e.target.value)}
                        placeholder="Nome / Ragione Sociale"
                        className="col-span-2 text-sm text-slate-800 bg-white border border-violet-200 rounded px-2 py-1.5 focus:outline-none focus:border-violet-400"
                      />
                      <input
                        value={editClientIndirizzo}
                        onChange={e => setEditClientIndirizzo(e.target.value)}
                        placeholder="Via / Piazza"
                        className="col-span-2 text-xs text-slate-700 bg-white border border-violet-200 rounded px-2 py-1.5 focus:outline-none focus:border-violet-400"
                      />
                      <input
                        value={editClientCitta}
                        onChange={e => setEditClientCitta(e.target.value)}
                        placeholder="Comune"
                        className="text-xs text-slate-700 bg-white border border-violet-200 rounded px-2 py-1.5 focus:outline-none focus:border-violet-400"
                      />
                      <div className="flex gap-1">
                        <input
                          value={editClientCap}
                          onChange={e => setEditClientCap(e.target.value)}
                          placeholder="CAP"
                          maxLength={5}
                          className="w-20 text-xs text-slate-700 bg-white border border-violet-200 rounded px-2 py-1.5 focus:outline-none focus:border-violet-400"
                        />
                        <input
                          value={editClientProvincia}
                          onChange={e => setEditClientProvincia(e.target.value.toUpperCase())}
                          placeholder="Prov"
                          maxLength={2}
                          className="w-14 text-xs text-slate-700 bg-white border border-violet-200 rounded px-2 py-1.5 focus:outline-none focus:border-violet-400"
                        />
                      </div>
                      <input
                        value={editClientCF}
                        onChange={e => setEditClientCF(e.target.value.toUpperCase())}
                        placeholder="Codice Fiscale"
                        maxLength={16}
                        className="text-xs text-slate-700 bg-white border border-violet-200 rounded px-2 py-1.5 focus:outline-none focus:border-violet-400"
                      />
                      <input
                        value={editClientPIVA}
                        onChange={e => setEditClientPIVA(e.target.value)}
                        placeholder="Partita IVA"
                        maxLength={13}
                        className="text-xs text-slate-700 bg-white border border-violet-200 rounded px-2 py-1.5 focus:outline-none focus:border-violet-400"
                      />
                    </div>
                  </div>
                ) : isEditingClient ? (
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
                      {quote.clientData?.citta && (
                        <div className="text-slate-400 text-xs mt-0.5">
                          {[quote.clientData.citta, quote.clientData.cap, quote.clientData.provincia].filter(Boolean).join(" ")}
                        </div>
                      )}
                      {(quote.clientData?.codiceFiscale || quote.clientData?.partitaIva) && (
                        <div className="text-slate-400 text-xs">
                          {quote.clientData.codiceFiscale && `C.F.: ${quote.clientData.codiceFiscale}`}
                          {quote.clientData.codiceFiscale && quote.clientData.partitaIva && " · "}
                          {quote.clientData.partitaIva && `P.IVA: ${quote.clientData.partitaIva}`}
                        </div>
                      )}
                    </div>
                    {!isEditLocked && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => setIsEditingClient(true)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Quadro Sintetico — shown for Standard template in edit mode or view mode */}
              {localTemplateId === "standard" && (isEditMode ? editCapitoli.length > 0 : hasCapitoli) && (
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
                      {(isEditMode ? editCapitoli : capitoli).map((cap, i) => {
                        const sub = isEditMode
                          ? (cap as typeof editCapitoli[0]).voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0)
                          : (cap as typeof capitoli[0]).subtotale;
                        return (
                          <tr key={cap.lettera} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="py-2 px-3 text-slate-700">{cap.lettera}. {cap.titolo}</td>
                            <td className="py-2 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(sub)}</td>
                            <td className="py-2 px-3 text-slate-400 italic hidden sm:table-cell">{cap.osservazione ?? "Voce ordinaria"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Chapter detail sections — branched by template */}
              {isEditMode ? (
                /* ── INLINE EDIT MODE (shared across all templates) ── */
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">2. Computo Metrico Dettagliato</div>
                  <div className="space-y-4">
                    {editCapitoli.map((cap, capIdx) => {
                      const capSub = cap.voci.reduce((s, v) => s + Number(v.quantita) * Number(v.prezzoUnitario), 0);
                      return (
                        <div key={capIdx} className="border-2 border-violet-200 rounded-lg overflow-hidden">
                          {/* Chapter header — editable */}
                          <div className="bg-violet-50 px-3 py-2 flex items-center gap-2 border-b border-violet-100">
                            <span className="text-sm font-bold text-slate-400 shrink-0">{cap.lettera}.</span>
                            <input
                              value={cap.titolo}
                              onChange={e => updateCapitolo(capIdx, "titolo", e.target.value)}
                              className="flex-1 text-sm font-semibold text-slate-800 bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-violet-300 focus:border-violet-400 focus:outline-none min-w-0"
                              placeholder="Titolo capitolo..."
                            />
                            <input
                              value={cap.osservazione ?? ""}
                              onChange={e => updateCapitolo(capIdx, "osservazione", e.target.value)}
                              className="w-28 text-xs text-slate-500 bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-violet-300 focus:border-violet-400 focus:outline-none hidden sm:block"
                              placeholder="Osservazione"
                            />
                            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap shrink-0">{formatCurrency(capSub)}</span>
                            <button
                              onClick={() => removeCapitolo(capIdx)}
                              className="text-red-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors shrink-0"
                              title="Elimina capitolo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {/* Voci table — fully editable */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-700 text-white">
                                  <th className="py-1.5 px-3 text-left font-medium">Descrizione</th>
                                  <th className="py-1.5 px-1 text-center font-medium w-14">U.M.</th>
                                  <th className="py-1.5 px-1 text-center font-medium w-16">Q.tà</th>
                                  <th className="py-1.5 px-1 text-right font-medium w-24">P.u. (€)</th>
                                  <th className="py-1.5 px-3 text-right font-medium w-20">Totale</th>
                                  <th className="w-6"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {cap.voci.map((voce, vi) => {
                                  const vTot = Number(voce.quantita) * Number(voce.prezzoUnitario);
                                  return (
                                    <tr key={vi} className={vi % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                                      <td className="py-1 px-2">
                                        <input
                                          value={voce.descrizione}
                                          onChange={e => updateVoce(capIdx, vi, "descrizione", e.target.value)}
                                          className="w-full bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-violet-200 focus:border-violet-400 focus:outline-none text-slate-700"
                                          placeholder="Descrizione voce..."
                                        />
                                      </td>
                                      <td className="py-1 px-1">
                                        <input
                                          value={voce.um}
                                          onChange={e => updateVoce(capIdx, vi, "um", e.target.value)}
                                          className="w-full text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-violet-200 focus:border-violet-400 focus:outline-none text-slate-600"
                                        />
                                      </td>
                                      <td className="py-1 px-1">
                                        <input
                                          type="number"
                                          value={voce.quantita}
                                          onChange={e => updateVoce(capIdx, vi, "quantita", e.target.value === "" ? 0 : Number(e.target.value))}
                                          className="w-full text-center bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-violet-200 focus:border-violet-400 focus:outline-none text-slate-600"
                                          min={0} step={0.01}
                                        />
                                      </td>
                                      <td className="py-1 px-1">
                                        <input
                                          type="number"
                                          value={voce.prezzoUnitario}
                                          onChange={e => updateVoce(capIdx, vi, "prezzoUnitario", e.target.value === "" ? 0 : Number(e.target.value))}
                                          className="w-full text-right bg-transparent border border-transparent rounded px-1 py-0.5 hover:border-violet-200 focus:border-violet-400 focus:outline-none text-slate-600"
                                          min={0} step={0.01}
                                        />
                                      </td>
                                      <td className="py-1 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                                        {formatCurrency(vTot)}
                                      </td>
                                      <td className="py-1 px-1">
                                        <button
                                          onClick={() => removeVoce(capIdx, vi)}
                                          className="text-red-300 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition-colors"
                                          title="Elimina voce"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {/* Chapter footer */}
                          <div className="bg-slate-50 border-t border-slate-100 px-3 py-2 flex items-center justify-between">
                            <button
                              onClick={() => addVoce(capIdx)}
                              className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1 hover:bg-violet-50 rounded px-2 py-1 transition-colors"
                            >
                              <Plus className="h-3 w-3" /> Aggiungi voce
                            </button>
                            <span className="text-xs font-bold text-slate-700">
                              Subtotale: {formatCurrency(capSub)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {/* Add chapter */}
                    <button
                      onClick={addCapitolo}
                      className="w-full py-2.5 text-xs text-violet-600 hover:text-violet-800 font-medium border-2 border-dashed border-violet-200 hover:border-violet-400 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Aggiungi capitolo
                    </button>
                  </div>
                </div>
              ) : localTemplateId === "arosio" && hasCapitoli ? (
                /* ── AROSIO VIEW: numbered sections, dark navy headers, subtotals ── */
                <div className="mb-6">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="py-2 px-3 text-center w-10 font-semibold">N°</th>
                        <th className="py-2 px-3 text-left font-semibold">Descrizione</th>
                        <th className="py-2 px-2 text-center w-10 font-semibold">U.M.</th>
                        <th className="py-2 px-2 text-right w-20 font-semibold">P.U.</th>
                        <th className="py-2 px-3 text-right w-24 font-semibold">Totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capitoli.map((cap, ci) => (
                        <>
                          <tr key={`hdr-${cap.lettera}`}>
                            <td colSpan={5} className="py-2 px-3 font-bold text-white text-xs tracking-wider uppercase bg-slate-800">
                              {String(ci + 1).padStart(2, "0")}_ {cap.titolo.toUpperCase()}
                            </td>
                          </tr>
                          {cap.voci.map((voce, vi) => (
                            <tr key={`${cap.lettera}-${vi}`} className={vi % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="py-2 px-3 text-center text-slate-500 font-medium">{ci + 1}.{vi + 1}</td>
                              <td className="py-2 px-3 text-slate-700">{voce.descrizione}</td>
                              <td className="py-2 px-2 text-center text-slate-500">{voce.um}</td>
                              <td className="py-2 px-2 text-right text-slate-600 whitespace-nowrap">{formatCurrency(voce.prezzoUnitario)}</td>
                              <td className="py-2 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(voce.totale)}</td>
                            </tr>
                          ))}
                          <tr key={`sub-${cap.lettera}`} className="bg-slate-200 border-t border-slate-300">
                            <td colSpan={4} className="py-1.5 px-3 text-right font-bold text-slate-700 text-xs">
                              {String.fromCharCode(65 + ci)}_ TOTALE (IVA esclusa)
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">{formatCurrency(cap.subtotale)}</td>
                          </tr>
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : localTemplateId === "mariagrazia" && hasCapitoli ? (
                /* ── MARIAGRAZIA VIEW: flat numbered list across all chapters ── */
                <div className="mb-6">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-700 text-white">
                        <th className="py-2 px-2 text-center w-8 font-semibold">N°</th>
                        <th className="py-2 px-3 text-left font-semibold">Descrizione</th>
                        <th className="py-2 px-2 text-center w-10 font-semibold">U.M.</th>
                        <th className="py-2 px-2 text-center w-10 font-semibold">Q.tà</th>
                        <th className="py-2 px-2 text-right w-20 font-semibold">P.U.</th>
                        <th className="py-2 px-3 text-right w-24 font-semibold">Totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capitoli.flatMap((cap) => cap.voci.map(v => ({ ...v, chapter: cap.titolo }))).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="py-2 px-2 text-center font-semibold text-slate-500">{i + 1}</td>
                          <td className="py-2 px-3 text-slate-700">{row.descrizione}</td>
                          <td className="py-2 px-2 text-center text-slate-500">{row.um}</td>
                          <td className="py-2 px-2 text-center text-slate-500">{row.quantita}</td>
                          <td className="py-2 px-2 text-right text-slate-600 whitespace-nowrap">{formatCurrency(row.prezzoUnitario)}</td>
                          <td className="py-2 px-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(row.totale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : hasCapitoli ? (
                /* ── STANDARD VIEW: collapsible chapters ── */
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
                /* ── LEGACY ITEMS (no chapters, any template) ── */
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
                  {isEditMode ? (() => {
                    const editSub = editCapitoli.reduce((s, cap) => s + cap.voci.reduce((cs, v) => cs + Number(v.quantita) * Number(v.prezzoUnitario), 0), 0);
                    const editImponibile = editScontoPerc > 0 ? editSub * (1 - editScontoPerc / 100) : editSub;
                    const editIvaVal = editImponibile * (editIvaPerc / 100);
                    const editTot = editImponibile + editIvaVal;
                    return (
                      <>
                        <div className="flex justify-between px-4 py-2.5 text-slate-600 border-b border-slate-100">
                          <span>Imponibile totale:</span>
                          <span className="font-medium">{formatCurrency(editSub)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 gap-3">
                          <label className="text-slate-600 text-xs shrink-0">Sconto (%):</label>
                          <input
                            type="number"
                            value={editScontoPerc}
                            onChange={e => setEditScontoPerc(Math.max(0, Math.min(100, Number(e.target.value))))}
                            className="w-16 text-right bg-violet-50 border border-violet-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:border-violet-400"
                            min={0} max={100} step={1}
                          />
                        </div>
                        {editScontoPerc > 0 && (
                          <div className="flex justify-between px-4 py-2 text-green-700 border-b border-slate-100">
                            <span className="text-xs">Imponibile scontato:</span>
                            <span className="font-medium">{formatCurrency(editImponibile)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 gap-3">
                          <label className="text-slate-600 text-xs shrink-0">IVA (%):</label>
                          <input
                            type="number"
                            value={editIvaPerc}
                            onChange={e => setEditIvaPerc(Math.max(0, Number(e.target.value)))}
                            className="w-16 text-right bg-violet-50 border border-violet-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:border-violet-400"
                            min={0} step={1}
                          />
                        </div>
                        <div className="flex justify-between px-4 py-2 text-slate-600 border-b border-slate-100">
                          <span className="text-xs">IVA:</span>
                          <span className="font-medium">{formatCurrency(editIvaVal)}</span>
                        </div>
                        <div className="flex justify-between px-4 py-3 bg-slate-800 text-white font-bold text-base">
                          <span>TOTALE</span>
                          <span>{formatCurrency(editTot)}</span>
                        </div>
                      </>
                    );
                  })() : (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* Condizioni di pagamento */}
              {isEditMode ? (
                <div className="mb-6 border-2 border-violet-200 rounded-lg p-4 bg-violet-50/40">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                    <span>Condizioni di Pagamento</span>
                    <button
                      onClick={() => setEditCondizioniPagamento(prev => [...prev, ""])}
                      className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1 hover:bg-violet-100 rounded px-2 py-1 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Aggiungi
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editCondizioniPagamento.map((cond, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          value={cond}
                          onChange={e => setEditCondizioniPagamento(prev => prev.map((c, ci) => ci === i ? e.target.value : c))}
                          placeholder="Es. 30% acconto alla firma del contratto"
                          className="flex-1 text-xs text-slate-700 bg-white border border-violet-200 rounded px-2 py-1.5 focus:outline-none focus:border-violet-400"
                        />
                        <button
                          onClick={() => setEditCondizioniPagamento(prev => prev.filter((_, ci) => ci !== i))}
                          className="text-red-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {editCondizioniPagamento.length === 0 && (
                      <p className="text-xs text-slate-400 italic">Nessuna condizione. Clicca Aggiungi per inserirne una.</p>
                    )}
                  </div>
                </div>
              ) : condizioniPagamento.length > 0 ? (
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
              ) : null}

              {/* Notes */}
              {isEditMode ? (
                <div className="pt-4 border-t border-violet-100">
                  <div className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Note finali</div>
                  <textarea
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    className="w-full text-xs text-slate-500 bg-violet-50/50 border border-violet-200 rounded p-2 focus:outline-none focus:border-violet-400 resize-none min-h-[60px]"
                    placeholder="Note finali, condizioni aggiuntive..."
                  />
                </div>
              ) : (
                quote.note && (
                  <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">
                    <strong>Note: </strong>{quote.note}
                  </div>
                )
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Azioni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={isLocked ? handleUnlock : handleDownload}
                disabled={generatePdf.isPending}
                className="w-full justify-start gap-2"
                variant={isLocked ? "default" : "outline"}
              >
                {generatePdf.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : isLocked ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                Scarica PDF
              </Button>
              {!isEditLocked && (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={isEditMode ? () => setIsEditMode(false) : enterEditMode}
                  >
                    <Pencil className="h-4 w-4" />
                    {isEditMode ? "Chiudi Editor" : "Modifica Preventivo"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-violet-600 border-violet-200 hover:bg-violet-50"
                    onClick={() => setIsRegenOpen(true)}
                  >
                    <Sparkles className="h-4 w-4" />
                    Rigenera con AI
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={duplicateQuote.isPending}
                onClick={() => {
                  if (!id) return;
                  duplicateQuote.mutate({ id }, {
                    onSuccess: (newQuote) => {
                      queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
                      toast({ title: "Preventivo duplicato", description: "Reindirizzamento al nuovo preventivo…" });
                      navigate(`/dashboard/quotes/${newQuote.id}`);
                    },
                    onError: () => toast({ title: "Errore durante la duplicazione", variant: "destructive" }),
                  });
                }}
              >
                {duplicateQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Duplica preventivo
              </Button>
              {isEditLocked && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Preventivo scaricato — modifiche disabilitate.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Template picker */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                Template PDF
              </CardTitle>
              <CardDescription className="text-xs">
                {isEditLocked ? "Bloccato dopo il primo download" : "Scegli il layout del tuo PDF"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {(
                [
                  { id: "standard", label: "Standard", desc: "Computo metrico con quadro sintetico e blocco firma", proOnly: false },
                  { id: "arosio", label: "Arosio", desc: "Capitolato numerato con sezioni e subtotali per capitolo", proOnly: true },
                  { id: "mariagrazia", label: "MariaGrazia", desc: "Lista numerata pulita con header OFFERTA aziendale", proOnly: true },
                ] as const
              ).map(tmpl => {
                const isActive = localTemplateId === tmpl.id;
                const isLockable = isEditLocked;
                const requiresPro = tmpl.proOnly && !isPro;
                const isClickable = !isLockable && !requiresPro;
                const isProClickable = !isLockable && isPro;
                return (
                  <button
                    key={tmpl.id}
                    disabled={isLockable}
                    onClick={() => {
                      if (isLockable) return;
                      if (requiresPro) { setIsPaywallOpen(true); return; }
                      if (isActive || !id) return;
                      // Optimistic update
                      setLocalTemplateId(tmpl.id);
                      updateQuote.mutate({ id, data: { templateId: tmpl.id } }, {
                        onSuccess: (updated) => {
                          queryClient.setQueryData(getGetQuoteQueryKey(id), updated);
                          toast({ title: "Template aggiornato", description: `Template "${tmpl.label}" selezionato.` });
                        },
                        onError: () => {
                          // Rollback
                          setLocalTemplateId(quote.templateId ?? "standard");
                          toast({ title: "Errore", description: "Impossibile cambiare template", variant: "destructive" });
                        },
                      });
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all",
                      isActive
                        ? "border-violet-400 bg-violet-50 text-violet-900 ring-1 ring-violet-300"
                        : isClickable || isProClickable
                          ? "border-slate-200 hover:border-violet-300 hover:bg-slate-50 text-slate-700 cursor-pointer"
                          : requiresPro
                            ? "border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-600 cursor-pointer"
                            : "border-slate-200 opacity-50 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      {isActive && <CheckCircle2 className="h-3 w-3 text-violet-600 shrink-0" />}
                      {tmpl.label}
                      {tmpl.proOnly && !isPro && (
                        <span className="ml-auto text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 leading-none">PRO</span>
                      )}
                      {isEditLocked && <Lock className="h-3 w-3 ml-auto text-slate-400 shrink-0" />}
                    </div>
                    <div className="text-slate-500 mt-0.5 leading-snug">{tmpl.desc}</div>
                  </button>
                );
              })}
              {isEditLocked && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5 border border-amber-200">
                  Template bloccato dopo il primo download.
                </p>
              )}
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

      {/* ── CAPITOLATO PRO DIALOG ── */}
      <Dialog open={isCapitolatoDialogOpen} onOpenChange={setIsCapitolatoDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-violet-600" />
              Migliora in Capitolato Pro
            </DialogTitle>
            <DialogDescription>
              L'AI riscriverà ogni voce del preventivo con terminologia professionale da Capitolato Speciale d'Appalto (3–5 frasi tecniche, materiali con normative UNI/CEI, inclusioni ed esclusioni). Le quantità e i prezzi rimangono invariati.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-violet-50 border border-violet-200 px-4 py-3 text-sm text-violet-800 space-y-1">
            <p className="font-semibold">Cosa verrà aggiornato:</p>
            <ul className="list-disc list-inside space-y-0.5 text-violet-700">
              <li>Descrizioni di ogni voce in stile capitolato</li>
              <li>Specifiche tecniche e normative</li>
              <li>Elenco inclusi/esclusi per ogni voce</li>
            </ul>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setIsCapitolatoDialogOpen(false)} disabled={upgradeToCapitolato.isPending}>
              Annulla
            </Button>
            <Button
              onClick={handleConfirmCapitolatoUpgrade}
              disabled={upgradeToCapitolato.isPending}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {upgradeToCapitolato.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              {upgradeToCapitolato.isPending ? "Miglioramento in corso..." : "Migliora ora"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI REGEN DIALOG ── */}
      <Dialog open={isRegenOpen} onOpenChange={setIsRegenOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Rigenera con AI
            </DialogTitle>
            <DialogDescription>
              L'AI riscriverà il preventivo mantenendo i dati del committente. Puoi descrivere cosa cambiare o lasciare vuoto per rigenerare dalla descrizione originale.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm text-muted-foreground italic">
              "{quote.rawInput}"
            </div>
            <div className="space-y-1.5">
              <Label>Nuove istruzioni (opzionale)</Label>
              <Textarea
                value={regenDescription}
                onChange={e => setRegenDescription(e.target.value)}
                placeholder="Es: aggiungi anche la tinteggiatura del soffitto, aumenta la superficie delle pareti a 120mq..."
                className="resize-none min-h-[90px]"
                disabled={regenerateQuote.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Se vuoti, viene usata la descrizione originale. Se compili, la sostituisce completamente.
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => { setIsRegenOpen(false); setRegenDescription(""); }} disabled={regenerateQuote.isPending}>
                Annulla
              </Button>
              <Button onClick={handleRegenerate} disabled={regenerateQuote.isPending} className="gap-2">
                {regenerateQuote.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generazione in corso...</>
                ) : (
                  <><RefreshCw className="h-4 w-4" /> Rigenera</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Paywall dialog */}
      <Dialog open={isPaywallOpen} onOpenChange={setIsPaywallOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <div className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogHeader>
              {subscription?.isActive && subscription?.plan === "monthly_starter" ? (
                <>
                  <DialogTitle className="text-lg">Passa al Piano Pro</DialogTitle>
                  <DialogDescription className="text-sm">
                    Sei su <strong>Starter</strong> — i tuoi preventivi includono la filigrana PrevAI e il logo PrevAI.<br/>
                    Passa a <strong>Pro</strong> per PDF puliti con il tuo logo aziendale.
                  </DialogDescription>
                </>
              ) : (
                <>
                  <DialogTitle className="text-lg">Sblocca il Preventivo</DialogTitle>
                  <DialogDescription className="text-sm">
                    Scegli un piano per scaricare il PDF.
                  </DialogDescription>
                </>
              )}
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {/* If user is on Starter → show upgrade card */}
            {subscription?.isActive && subscription?.plan === "monthly_starter" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary ring-1 ring-primary bg-gradient-to-br from-violet-50 to-cyan-50 p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">⭐</div>
                    <div>
                      <div className="font-bold text-base">PrevAI Pro — €79/mese</div>
                      <div className="text-xs text-muted-foreground">PDF senza filigrana, con il tuo logo aziendale</div>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {["PDF puliti senza filigrana", "Usa il tuo logo aziendale", "Preventivi illimitati", "Branding completamente tuo"].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    onClick={handleUpgrade}
                    disabled={createPortal.isPending}
                  >
                    {createPortal.isPending ? "Apertura portale..." : "Passa a Pro →"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Gestisci il tuo abbonamento su Stripe • Annulla in qualsiasi momento
                  </p>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">oppure acquisto singolo</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* One-shot plans for Starter users too */}
                <div className="grid grid-cols-2 gap-3">
                  {plans?.filter(p => !p.interval).map((plan, idx) => {
                    const isClean = plan.id === "oneshot_clean";
                    return (
                      <div
                        key={plan.id}
                        className={`rounded-lg border p-3 flex flex-col hover:bg-muted/40 transition-colors ${isClean ? "border-primary/30" : ""}`}
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      >
                        <div className="font-medium text-sm mb-0.5">{plan.name}</div>
                        <div className="text-xs text-muted-foreground mb-2">{plan.features[0]}</div>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="font-bold text-sm">€{plan.price}</span>
                          <Button size="sm" variant={isClean ? "default" : "outline"} className="h-7 text-xs px-3"
                            onClick={() => handleCheckout(plan.id)} disabled={createCheckout.isPending}>
                            {createCheckout.isPending ? "..." : "Acquista"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Subscription plans */}
                <div className="grid grid-cols-2 gap-3">
                  {plans?.filter(p => p.interval).map((plan, idx) => {
                    const isPro = plan.id === "monthly_pro";
                    return (
                      <div
                        key={plan.id}
                        className={`plan-card-enter relative rounded-lg border p-3 flex flex-col ${
                          isPro ? "border-primary ring-1 ring-primary shadow-sm" : ""
                        }`}
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      >
                        {isPro && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                              ⭐ Pro
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">{plan.name}</span>
                          {!isPro && (
                            <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full uppercase">
                              Starter
                            </span>
                          )}
                        </div>
                        <div className="mb-2">
                          <span className="text-xl font-bold">€{plan.price}</span>
                          <span className="text-muted-foreground text-xs">/mese</span>
                        </div>
                        {isPro && (
                          <div className="text-[10px] text-primary font-semibold mb-2">✓ PDF senza filigrana, logo tuo</div>
                        )}
                        <ul className="space-y-1 mb-3 flex-1">
                          {plan.features.slice(0, 4).map((feature, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                              <CheckCircle2 className={`h-3 w-3 shrink-0 mt-0.5 ${isPro ? "text-primary" : "text-muted-foreground/60"}`} />
                              <span className="text-xs">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <Button size="sm" className="w-full text-xs h-8" variant={isPro ? "default" : "outline"}
                          onClick={() => handleCheckout(plan.id)} disabled={createCheckout.isPending}>
                          {createCheckout.isPending ? "..." : isPro ? "Scegli Pro" : "Scegli Starter"}
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">oppure acquisto singolo</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* One-shot plans */}
                <div className="grid grid-cols-2 gap-3">
                  {plans?.filter(p => !p.interval).map((plan, idx) => {
                    const isClean = plan.id === "oneshot_clean";
                    return (
                      <div
                        key={plan.id}
                        className={`plan-card-enter rounded-lg border p-3 flex flex-col hover:bg-muted/40 transition-colors ${
                          isClean ? "border-primary/30" : ""
                        }`}
                        style={{ animationDelay: `${(idx + 2) * 0.05}s` }}
                      >
                        <div className="font-medium text-sm mb-0.5">{plan.name}</div>
                        <div className="text-xs text-muted-foreground mb-2">{plan.features[0]}</div>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="font-bold text-sm">€{plan.price}</span>
                          <Button size="sm" variant={isClean ? "default" : "outline"} className="h-7 text-xs px-3"
                            onClick={() => handleCheckout(plan.id)} disabled={createCheckout.isPending}>
                            {createCheckout.isPending ? "..." : "Acquista"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
