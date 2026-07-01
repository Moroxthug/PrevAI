import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useCreateQuote, useGetBusinessProfile, useGetSubscription } from "@workspace/api-client-react";
import {
  Sparkles, Mic, ImagePlus, ArrowRight, Loader2,
  X, User, Lock, Bot, PencilLine, FileText, FileSpreadsheet,
  LayoutTemplate, CheckCircle2, BookOpen
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useClientMemory } from "@/hooks/use-client-memory";
import type { SavedClient } from "@/hooks/use-client-memory";
import ManualQuoteBuilder from "@/components/manual-quote-builder";
import { PriceCatalogSection } from "@/components/price-catalog-section";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_SIZE_MB = 5;
const MAX_DOC_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MAX_DOC_SIZE_BYTES = MAX_DOC_SIZE_MB * 1024 * 1024;
const MAX_ATTACHMENTS = 3;

const EXAMPLES = [
  { label: "Imbianchino", text: "Tinteggiatura completa appartamento 100mq, inclusa rasatura soffitti e due mani di pittura traspirante. Aggiungere smaltatura 5 infissi." },
  { label: "Elettricista", text: "Rifacimento completo impianto elettrico appartamento 80mq. 50 punti luce, quadro generale nuovo, certificazione di conformità." },
  { label: "Idraulico", text: "Sostituzione caldaia a condensazione 24kW inclusa rimozione vecchia, lavaggio impianto e installazione termostato smart." },
  { label: "Ristrutturazione", text: "Ristrutturazione bagno completo 8mq: rimozione rivestimenti, nuova piastrellatura, sostituzione sanitari e rubinetteria, nuovo box doccia." },
  { label: "Muratore", text: "Realizzazione muro divisorio in laterizio 15mq, intonaco civile su ambo i lati, rasatura e predisposizione per piastrellatura." },
];

function getMaxPhotos(plan: string | null | undefined, isActive: boolean): number {
  if (!isActive) return 0;
  if (plan === "monthly_elite") return 5;
  if (plan === "monthly_pro") return 3;
  if (plan === "monthly_starter") return 1;
  return 0;
}

interface ClientForm {
  nome: string;
  indirizzo: string;
  citta: string;
  cap: string;
  provincia: string;
  codiceFiscale: string;
  partitaIva: string;
}
const emptyClient: ClientForm = {
  nome: "", indirizzo: "", citta: "", cap: "", provincia: "", codiceFiscale: "", partitaIva: "",
};

// ─── Shared client selector used in both tabs ───────────────────────────────
interface ClientSelectorProps {
  clientMode: "none" | "saved" | "new";
  setClientMode: (m: "none" | "saved" | "new") => void;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  clientForm: ClientForm;
  setClientForm: (fn: (prev: ClientForm) => ClientForm) => void;
  rememberClient: boolean;
  setRememberClient: (v: boolean) => void;
  savedClients: SavedClient[];
  selectSavedClient: (c: SavedClient) => void;
  clearClient: () => void;
  disabled?: boolean;
}

function ClientSelector({
  clientMode, setClientMode, selectedClientId,
  clientForm, setClientForm, rememberClient, setRememberClient,
  savedClients, selectSavedClient, clearClient, disabled,
}: ClientSelectorProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Committente</span>
          {clientForm.nome && (
            <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
              {clientForm.nome}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">opzionale</span>
      </div>

      {savedClients.length > 0 && clientMode !== "new" && (
        <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
          {savedClients.slice(0, 6).map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectSavedClient(c)}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-all",
                selectedClientId === c.id
                  ? "border-violet-300 bg-violet-50 text-violet-700 font-semibold shadow-sm"
                  : "border-gray-200 text-gray-600 hover:border-violet-200 hover:bg-violet-50/50"
              )}
            >
              <User className="h-3 w-3" />
              {c.nome}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setClientMode("new"); }}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-all"
          >
            + Nuovo
          </button>
        </div>
      )}

      {clientMode === "saved" && selectedClientId && (
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {[clientForm.indirizzo, clientForm.citta, clientForm.provincia].filter(Boolean).join(", ") || "Nessun indirizzo salvato"}
          </span>
          <button type="button" onClick={clearClient} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">
            Rimuovi
          </button>
        </div>
      )}

      {savedClients.length === 0 && clientMode === "none" && (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => setClientMode("new")}
            className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/30 transition-all"
          >
            + Aggiungi dati committente
          </button>
        </div>
      )}

      {clientMode === "new" && (
        <div className="px-4 pb-4 pt-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200 border-t border-gray-50">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Nome / Ragione Sociale *</Label>
            <Input
              placeholder="Es. Rossi Mario"
              value={clientForm.nome}
              onChange={e => setClientForm(f => ({ ...f, nome: e.target.value }))}
              disabled={disabled}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Indirizzo</Label>
            <Input
              placeholder="Es. Via Garibaldi 10"
              value={clientForm.indirizzo}
              onChange={e => setClientForm(f => ({ ...f, indirizzo: e.target.value }))}
              disabled={disabled}
              className="h-9 text-sm"
            />
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-3 space-y-1">
              <Label className="text-xs font-medium text-gray-600">Comune</Label>
              <Input placeholder="Milano" value={clientForm.citta} onChange={e => setClientForm(f => ({ ...f, citta: e.target.value }))} disabled={disabled} className="h-9 text-sm" />
            </div>
            <div className="col-span-1 space-y-1">
              <Label className="text-xs font-medium text-gray-600">Prov.</Label>
              <Input placeholder="MI" value={clientForm.provincia} onChange={e => setClientForm(f => ({ ...f, provincia: e.target.value.toUpperCase() }))} disabled={disabled} className="h-9 text-sm" maxLength={2} />
            </div>
            <div className="col-span-1 space-y-1">
              <Label className="text-xs font-medium text-gray-600">CAP</Label>
              <Input placeholder="20100" value={clientForm.cap} onChange={e => setClientForm(f => ({ ...f, cap: e.target.value }))} disabled={disabled} className="h-9 text-sm" maxLength={5} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Codice Fiscale</Label>
              <Input placeholder="RSSMRA80A01H501Z" value={clientForm.codiceFiscale} onChange={e => setClientForm(f => ({ ...f, codiceFiscale: e.target.value.toUpperCase() }))} disabled={disabled} className="h-9 text-sm" maxLength={16} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">P. IVA</Label>
              <Input placeholder="IT12345678901" value={clientForm.partitaIva} onChange={e => setClientForm(f => ({ ...f, partitaIva: e.target.value }))} disabled={disabled} className="h-9 text-sm" maxLength={13} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberClient}
                onChange={e => setRememberClient(e.target.checked)}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              Ricorda questo cliente
            </label>
            <button
              type="button"
              onClick={clearClient}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function NewQuote() {
  const [activeTab, setActiveTab] = useState<"ai" | "manual" | "listino">("ai");

  const [input, setInput] = useState("");
  const [templateId, setTemplateId] = useState<"standard" | "arosio" | "mariagrazia">("standard");
  const [targetTotalEur, setTargetTotalEur] = useState<string>("");
  const [, setLocation] = useLocation();
  const createQuote = useCreateQuote();
  const { data: profile } = useGetBusinessProfile();
  const { data: subscription } = useGetSubscription();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { clients: savedClients, upsertClient } = useClientMemory();

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [docs, setDocs] = useState<File[]>([]);

  const maxPhotos = getMaxPhotos(subscription?.plan, !!subscription?.isActive);
  const photoAllowed = maxPhotos > 0;

  const [clientMode, setClientMode] = useState<"none" | "saved" | "new">("none");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClient);
  const [rememberClient, setRememberClient] = useState(false);

  useEffect(() => {
    const savedPrompt = sessionStorage.getItem("prevai:homepage_prompt");
    if (savedPrompt) {
      sessionStorage.removeItem("prevai:homepage_prompt");
      setInput(savedPrompt);
    }
    const savedClient = sessionStorage.getItem("prevai:selected_client");
    if (savedClient) {
      sessionStorage.removeItem("prevai:selected_client");
      try {
        const c = JSON.parse(savedClient) as SavedClient;
        setClientMode("saved");
        setSelectedClientId(c.id);
        setClientForm({
          nome: c.nome, indirizzo: c.indirizzo || "", citta: c.citta || "",
          cap: c.cap || "", provincia: c.provincia || "",
          codiceFiscale: c.codiceFiscale || "", partitaIva: c.partitaIva || "",
        });
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    return () => { photoPreviews.forEach(url => URL.revokeObjectURL(url)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const totalAttachments = photos.length + docs.length;
    const remaining = MAX_ATTACHMENTS - totalAttachments;
    if (remaining <= 0) {
      toast({ title: `Massimo ${MAX_ATTACHMENTS} allegati`, description: "Rimuovi un file per aggiungerne un altro.", variant: "destructive" });
      return;
    }
    const validImages: File[] = [];
    const validDocs: File[] = [];
    for (const file of arr.slice(0, remaining)) {
      const isImage = ALLOWED_TYPES.includes(file.type) || !!file.name.toLowerCase().match(/\.(heic|heif)$/);
      const isDoc = ALLOWED_DOC_TYPES.includes(file.type);
      if (!isImage && !isDoc) {
        toast({ title: "Formato non supportato", description: `${file.name}: usa JPG, PNG, WEBP, HEIC, PDF, DOCX o XLSX.`, variant: "destructive" });
        continue;
      }
      if (isImage && file.size > MAX_SIZE_BYTES) {
        toast({ title: "File troppo grande", description: `${file.name}: massimo ${MAX_SIZE_MB}MB per le foto.`, variant: "destructive" });
        continue;
      }
      if (isDoc && file.size > MAX_DOC_SIZE_BYTES) {
        toast({ title: "File troppo grande", description: `${file.name}: massimo ${MAX_DOC_SIZE_MB}MB per i documenti.`, variant: "destructive" });
        continue;
      }
      if (isImage) validImages.push(file);
      if (isDoc) validDocs.push(file);
    }
    const imagePreviews = validImages.map(f => URL.createObjectURL(f));
    setPhotos(prev => [...prev, ...validImages]);
    setPhotoPreviews(prev => [...prev, ...imagePreviews]);
    setDocs(prev => [...prev, ...validDocs]);
  }, [photos.length, docs.length, toast]);

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const removeDoc = (idx: number) => {
    setDocs(prev => prev.filter((_, i) => i !== idx));
  };

  const getClientData = () => {
    const f = clientForm;
    if (!f.nome.trim()) return undefined;
    return {
      nome: f.nome.trim(),
      indirizzo: f.indirizzo.trim(),
      ...(f.citta.trim() && { citta: f.citta.trim() }),
      ...(f.cap.trim() && { cap: f.cap.trim() }),
      ...(f.provincia.trim() && { provincia: f.provincia.trim() }),
      ...(f.codiceFiscale.trim() && { codiceFiscale: f.codiceFiscale.trim() }),
      ...(f.partitaIva.trim() && { partitaIva: f.partitaIva.trim() }),
    };
  };

  const handleAiSubmit = () => {
    if (!input.trim() || isAiSubmitting) return;
    const clientData = getClientData();
    if (rememberClient && clientData) upsertClient(clientData);

    const companySnapshot = profile
      ? {
          companyName: profile.companyName || "",
          ...(profile.vatNumber && { vatNumber: profile.vatNumber }),
          ...(profile.address && { address: profile.address }),
          ...(profile.phone && { phone: profile.phone }),
          ...(profile.email && { email: profile.email }),
          ...(profile.logoUrl && { logoUrl: profile.logoUrl }),
        }
      : undefined;

    const allAttachments = [...photos, ...docs];
    const parsedTarget = targetTotalEur.trim() !== "" ? Number(targetTotalEur.replace(/\./g, "").replace(",", ".")) : undefined;
    createQuote.mutate(
      {
        data: {
          rawInput: input,
          clientData: clientData ? JSON.stringify(clientData) : undefined,
          companySnapshot: companySnapshot ? JSON.stringify(companySnapshot) : undefined,
          images: allAttachments.length > 0 ? allAttachments : undefined,
          templateId,
          targetTotalEur: parsedTarget && !isNaN(parsedTarget) && parsedTarget > 0 ? parsedTarget : undefined,
        },
      },
      {
        onSuccess: (quote) => { setLocation(`/dashboard/quotes/${quote.id}`); },
        onError: (err: unknown) => {
          const e = err as { status?: number; data?: { error?: string; code?: string } };
          if (e.status === 429) {
            toast({ title: "Quota mensile raggiunta", description: "Hai raggiunto il limite del tuo piano. Passa a Pro per preventivi illimitati.", variant: "destructive" });
          } else if ((e.status === 422 || e.status === 400) && e.data?.error) {
            toast({ title: "Impossibile generare il preventivo", description: e.data.error, variant: "destructive" });
          } else {
            toast({ title: "Errore nella generazione", description: "Si è verificato un errore. Riprova tra qualche istante.", variant: "destructive" });
          }
        },
      }
    );
  };

  const isAiSubmitting = createQuote.isPending;
  const canAiSubmit = input.trim().length > 0 && !isAiSubmitting;

  const selectSavedClient = (c: SavedClient) => {
    setSelectedClientId(c.id);
    setClientMode("saved");
    setClientForm({
      nome: c.nome, indirizzo: c.indirizzo || "", citta: c.citta || "",
      cap: c.cap || "", provincia: c.provincia || "",
      codiceFiscale: c.codiceFiscale || "", partitaIva: c.partitaIva || "",
    });
  };

  const clearClient = () => {
    setClientMode("none");
    setSelectedClientId(null);
    setClientForm(emptyClient);
  };

  const planPhotoLabel = !subscription?.isActive
    ? null
    : subscription.plan === "monthly_starter"
      ? "1 foto/preventivo · Starter"
      : subscription.plan === "monthly_pro"
        ? "3 foto/preventivo · Pro"
        : "5 foto/preventivo · Elite";

  const clientData = getClientData();

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500 py-6 space-y-4">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Nuovo Preventivo</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Genera con AI o costruisci manualmente voce per voce.
        </p>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all",
            activeTab === "ai"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Bot className="h-4 w-4" />
          Genera con AI
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all",
            activeTab === "manual"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <PencilLine className="h-4 w-4" />
          Manuale
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("listino")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all",
            activeTab === "listino"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <BookOpen className="h-4 w-4" />
          Listino Prezzi
        </button>
      </div>

      {/* ══ AI TAB ══════════════════════════════════════════════════════════ */}
      {activeTab === "ai" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Template selector */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1">
              <LayoutTemplate className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Layout del preventivo</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "standard" as const, label: "Standard", desc: "Computo classico", proOnly: false },
                { id: "arosio" as const, label: "Professionale", desc: "Capitolato tecnico", proOnly: true },
                { id: "mariagrazia" as const, label: "Elegante", desc: "Offerta commerciale", proOnly: true },
              ]).map((tmpl) => {
                const isActive = templateId === tmpl.id;
                const isPro = subscription?.isActive && (subscription.plan === "monthly_pro" || subscription.plan === "monthly_elite");
                const requiresPro = tmpl.proOnly && !isPro;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      if (requiresPro) {
                        toast({ title: "Piano Pro richiesto", description: "Passa a Pro per usare questo template.", variant: "destructive" });
                        return;
                      }
                      setTemplateId(tmpl.id);
                    }}
                    className={cn(
                      "text-left px-3 py-2 rounded-xl border text-xs transition-all",
                      isActive
                        ? "border-violet-400 bg-violet-50 text-violet-900 ring-1 ring-violet-300"
                        : "border-gray-200 hover:border-violet-300 hover:bg-gray-50 text-gray-700"
                    )}
                  >
                    <div className="font-semibold flex items-center gap-1">
                      {isActive && <CheckCircle2 className="h-3 w-3 text-violet-600" />}
                      {tmpl.label}
                      {tmpl.proOnly && !isPro && (
                        <span className="ml-auto text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">PRO</span>
                      )}
                    </div>
                    <div className="text-gray-500 mt-0.5 leading-snug">{tmpl.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target total input */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2.5 shadow-sm">
            <span className="text-xs font-medium text-gray-500 shrink-0">Importo target (€)</span>
            <input
              type="text"
              inputMode="numeric"
              value={targetTotalEur}
              onChange={e => {
                const v = e.target.value.replace(/[^0-9.,]/g, "");
                setTargetTotalEur(v);
              }}
              placeholder="es. 180000"
              className="flex-1 text-sm outline-none placeholder:text-gray-300 text-gray-800 bg-transparent min-w-0 text-right font-mono"
              disabled={isAiSubmitting}
            />
            <span className="text-xs text-gray-400 shrink-0">IVA incl.</span>
          </div>

          {/* AI bar card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Photo strip */}
            {photos.length > 0 && (
              <div className="px-3 pt-3 flex gap-2 flex-wrap border-b border-gray-100 pb-3">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shrink-0">
                    <img src={src} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      disabled={isAiSubmitting}
                      className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-black rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5 text-white" />
                    </button>
                  </div>
                ))}
                {photos.length < maxPhotos && photos.length + docs.length < MAX_ATTACHMENTS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAiSubmitting}
                    className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 hover:border-violet-300 flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-violet-500 transition-colors text-[10px]"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    <span>Aggiungi</span>
                  </button>
                )}
              </div>
            )}

            {/* Document strip */}
            {docs.length > 0 && (
              <div className="px-3 pt-3 flex gap-2 flex-wrap border-b border-gray-100 pb-3">
                {docs.map((file, idx) => (
                  <div key={idx} className="relative group flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-700 shrink-0">
                    {file.type === "application/pdf" ? (
                      <FileText className="h-3.5 w-3.5 text-red-500" />
                    ) : file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ? (
                      <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeDoc(idx)}
                      disabled={isAiSubmitting}
                      className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photos.length + docs.length < MAX_ATTACHMENTS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAiSubmitting}
                    className="w-auto px-2 h-7 rounded-lg border-2 border-dashed border-gray-200 hover:border-violet-300 flex items-center gap-0.5 text-gray-400 hover:text-violet-500 transition-colors text-[10px]"
                  >
                    <ImagePlus className="h-3 w-3" />
                    <span>Aggiungi</span>
                  </button>
                )}
              </div>
            )}

            {/* Bar row */}
            <div className="flex items-center gap-2 px-3 py-3">
              <div className="group relative shrink-0">
                {photoAllowed ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAiSubmitting || photos.length >= maxPhotos}
                    title={`Allega foto o documenti (max ${maxPhotos} foto, max ${MAX_ATTACHMENTS} totali)`}
                    className={cn(
                      "h-8 w-8 flex items-center justify-center rounded-xl transition-colors",
                      photos.length > 0
                        ? "bg-violet-100 text-violet-600 hover:bg-violet-200"
                        : "text-gray-400 hover:bg-gray-100",
                      (isAiSubmitting || photos.length >= maxPhotos) && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-300 cursor-not-allowed"
                  >
                    <Lock className="h-4 w-4" />
                  </button>
                )}
                {!photoAllowed && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                    Disponibile con piano a pagamento
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                )}
              </div>

              <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && canAiSubmit) {
                    e.preventDefault();
                    handleAiSubmit();
                  }
                }}
                placeholder="Descrivi il lavoro e ottieni un preventivo in 30 secondi..."
                className="flex-1 text-sm outline-none placeholder:text-gray-400 text-gray-800 bg-transparent min-w-0"
                disabled={isAiSubmitting}
              />

              <div className="group relative shrink-0">
                <button
                  disabled
                  className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                  Funzione in arrivo
                  <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>

              <button
                onClick={handleAiSubmit}
                disabled={!canAiSubmit}
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all",
                  canAiSubmit ? "btn-gradient shadow-sm" : "bg-gray-100 cursor-not-allowed"
                )}
              >
                {isAiSubmitting
                  ? <Loader2 className="h-4 w-4 animate-spin text-white" />
                  : <ArrowRight className={cn("h-4 w-4", canAiSubmit ? "text-white" : "text-gray-300")} />
                }
              </button>
            </div>

            {photoAllowed && photos.length === 0 && docs.length === 0 && (
              <div className="px-3 pb-1.5 -mt-1 text-[11px] text-violet-500 font-medium">
                {planPhotoLabel} — clicca 📎 per foto o documenti PDF/Excel/Word
              </div>
            )}

            <div className="px-3 pb-3 border-t border-gray-50 pt-2.5">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mr-1">Es:</span>
                {EXAMPLES.map(ex => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => setInput(ex.text)}
                    disabled={isAiSubmitting}
                    className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-40"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,.pdf,.docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
            disabled={isAiSubmitting}
          />

          {/* Client selector for AI tab */}
          <ClientSelector
            clientMode={clientMode}
            setClientMode={setClientMode}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            clientForm={clientForm}
            setClientForm={setClientForm}
            rememberClient={rememberClient}
            setRememberClient={setRememberClient}
            savedClients={savedClients}
            selectSavedClient={selectSavedClient}
            clearClient={clearClient}
            disabled={isAiSubmitting}
          />
        </div>
      )}

      {/* ══ MANUAL TAB ══════════════════════════════════════════════════════ */}
      {activeTab === "manual" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Client selector for manual tab */}
          <ClientSelector
            clientMode={clientMode}
            setClientMode={setClientMode}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            clientForm={clientForm}
            setClientForm={setClientForm}
            rememberClient={rememberClient}
            setRememberClient={setRememberClient}
            savedClients={savedClients}
            selectSavedClient={selectSavedClient}
            clearClient={clearClient}
          />

          <ManualQuoteBuilder
            clientData={clientData}
            profileData={profile ?? undefined}
          />
        </div>
      )}

      {/* ══ LISTINO TAB ═════════════════════════════════════════════════════ */}
      {activeTab === "listino" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <Card className="p-4 border border-violet-105 bg-white shadow-xs">
            <PriceCatalogSection />
          </Card>
        </div>
      )}
    </div>
  );
}
