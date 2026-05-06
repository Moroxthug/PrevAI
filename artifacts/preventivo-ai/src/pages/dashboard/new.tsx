import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useCreateQuote, useGetBusinessProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Loader2, Info, ImagePlus, X, Camera, ChevronDown, ChevronUp, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_FILES = 3;
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const EXAMPLES = [
  { label: "Imbianchino", text: "Tinteggiatura completa appartamento 100mq, inclusa rasatura soffitti e due mani di pittura traspirante. Aggiungere smaltatura 5 infissi." },
  { label: "Elettricista", text: "Rifacimento completo impianto elettrico appartamento 80mq. 50 punti luce, quadro generale nuovo, certificazione di conformità." },
  { label: "Idraulico", text: "Sostituzione caldaia a condensazione 24kW inclusa rimozione vecchia, lavaggio impianto e installazione termostato smart." },
  { label: "Ristrutturazione", text: "Ristrutturazione bagno completo 8mq: rimozione rivestimenti, nuova piastrellatura, sostituzione sanitari e rubinetteria, nuovo box doccia." },
  { label: "Muratore", text: "Realizzazione muro divisorio in laterizio 15mq, intonaco civile su ambo i lati, rasatura e predisposizione per piastrellatura." },
];

export default function NewQuote() {
  const [input, setInput] = useState("");
  const [, setLocation] = useLocation();
  const createQuote = useCreateQuote();
  const { data: profile } = useGetBusinessProfile();
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showClientForm, setShowClientForm] = useState(false);
  const [clientNome, setClientNome] = useState("");
  const [clientIndirizzo, setClientIndirizzo] = useState("");
  const [clientCodiceFiscale, setClientCodiceFiscale] = useState("");
  const [clientPartitaIva, setClientPartitaIva] = useState("");
  const [clientCitta, setClientCitta] = useState("");
  const [clientCap, setClientCap] = useState("");
  const [clientProvincia, setClientProvincia] = useState("");

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { photoPreviews.forEach(url => URL.revokeObjectURL(url)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 320) + "px";
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = MAX_FILES - photos.length;
    if (remaining <= 0) {
      toast({ title: "Massimo 3 foto", description: "Rimuovi una foto per aggiungerne un'altra.", variant: "destructive" });
      return;
    }
    const valid: File[] = [];
    for (const file of fileArray.slice(0, remaining)) {
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.toLowerCase().match(/\.(heic|heif)$/)) {
        toast({ title: "Formato non supportato", description: `${file.name}: usa JPG, PNG, WEBP o HEIC.`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast({ title: "File troppo grande", description: `${file.name}: massimo ${MAX_SIZE_MB}MB.`, variant: "destructive" });
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;
    const newPreviews = valid.map(f => URL.createObjectURL(f));
    setPhotos(prev => [...prev, ...valid]);
    setPhotoPreviews(prev => [...prev, ...newPreviews]);
  }, [photos.length, toast]);

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!input.trim() || isSubmitting) return;

    const clientData = clientNome.trim()
      ? {
          nome: clientNome.trim(),
          indirizzo: clientIndirizzo.trim(),
          ...(clientCodiceFiscale.trim() && { codiceFiscale: clientCodiceFiscale.trim() }),
          ...(clientPartitaIva.trim() && { partitaIva: clientPartitaIva.trim() }),
          ...(clientCitta.trim() && { citta: clientCitta.trim() }),
          ...(clientCap.trim() && { cap: clientCap.trim() }),
          ...(clientProvincia.trim() && { provincia: clientProvincia.trim() }),
        }
      : undefined;

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

    createQuote.mutate({
      data: {
        rawInput: input,
        clientData: clientData ? JSON.stringify(clientData) : undefined,
        companySnapshot: companySnapshot ? JSON.stringify(companySnapshot) : undefined,
        images: photos.length > 0 ? photos : undefined,
      }
    }, {
      onSuccess: (quote) => { setLocation(`/dashboard/quotes/${quote.id}`); },
      onError: (err: unknown) => {
        const status = (err as { status?: number })?.status;
        if (status === 429) {
          toast({ title: "Quota mensile raggiunta", description: "Hai usato tutti i 20 preventivi del piano Starter. Passa a Pro per illimitati.", variant: "destructive" });
        } else {
          toast({ title: "Errore nella generazione", description: "Si è verificato un errore. Riprova tra qualche istante.", variant: "destructive" });
        }
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && input.trim() && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isSubmitting = createQuote.isPending;

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500 py-4">
      {/* Company badge */}
      {profile?.companyName && (
        <div className="flex items-center gap-2 mb-6 px-1">
          {profile.logoUrl && (
            <img src={profile.logoUrl} alt="Logo" className="h-6 max-w-[60px] object-contain" />
          )}
          <span className="text-xs text-gray-500 font-medium">{profile.companyName}</span>
          {profile.vatNumber && <span className="text-xs text-gray-400">· {profile.vatNumber}</span>}
          <Link href="/dashboard/settings/account" className="ml-auto text-xs text-violet-500 hover:text-violet-700 font-medium">
            Modifica →
          </Link>
        </div>
      )}

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Nuovo Preventivo</h1>
        <p className="text-muted-foreground text-sm mt-1">Descrivi il lavoro in linguaggio naturale e l'AI genererà un preventivo professionale.</p>
      </div>

      {/* Main chat-style input card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Photo thumbnails strip */}
        {photos.length > 0 && (
          <div className="px-4 pt-3 flex gap-2 flex-wrap border-b border-gray-100 pb-3">
            {photoPreviews.map((src, idx) => (
              <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shrink-0">
                <img src={src} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  disabled={isSubmitting}
                  className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-black rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5 text-white" />
                </button>
              </div>
            ))}
            {photos.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 hover:border-violet-300 flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-violet-500 transition-colors text-[10px]"
              >
                <ImagePlus className="h-4 w-4" />
                <span>Aggiungi</span>
              </button>
            )}
          </div>
        )}

        {/* Textarea */}
        <div className="px-4 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            placeholder="Es. Devo tinteggiare un appartamento di 80mq con due mani di pittura lavabile. Includere la rasatura di una parete rovinata in soggiorno e la pittura di 4 porte in legno smaltate di bianco..."
            className="w-full resize-none text-base bg-transparent border-0 outline-none placeholder:text-gray-400 text-gray-800 min-h-[100px] max-h-[320px]"
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            rows={4}
          />
        </div>

        {/* Bottom bar */}
        <div className="px-4 pb-4 flex items-center gap-2">
          {/* Photo button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || photos.length >= MAX_FILES}
            title="Allega foto (appunti, listini, cantiere)"
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center transition-colors",
              photos.length > 0
                ? "bg-violet-100 text-violet-600 hover:bg-violet-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200",
              (isSubmitting || photos.length >= MAX_FILES) && "opacity-40 cursor-not-allowed"
            )}
          >
            <Camera className="h-4 w-4" />
          </button>
          {photos.length > 0 && (
            <span className="text-xs text-violet-600 font-medium">{photos.length}/{MAX_FILES} foto</span>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
            disabled={isSubmitting}
          />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Keyboard hint */}
          {input.trim() && !isSubmitting && (
            <span className="text-[11px] text-gray-400 hidden sm:block">⌘↵ per inviare</span>
          )}

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isSubmitting}
            className="gap-2 px-5 h-9"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {photos.length > 0 ? "Analisi foto..." : "Generazione..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Genera
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>

        {/* Quick examples */}
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mr-1">Esempi:</span>
            {EXAMPLES.map(ex => (
              <button
                key={ex.label}
                type="button"
                onClick={() => { setInput(ex.text); setTimeout(autoResize, 0); }}
                disabled={isSubmitting}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-40"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Client data — collapsible */}
      <div className="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowClientForm(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <User className="h-4 w-4 text-gray-400" />
            Dati committente
            {clientNome.trim() && (
              <span className="text-xs font-normal text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{clientNome}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!clientNome.trim() && <span className="text-xs text-gray-400">opzionale</span>}
            {showClientForm ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>

        {showClientForm && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-xs text-gray-500">I dati del committente appariranno sul preventivo. Se non li inserisci, l'AI userà un segnaposto.</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label htmlFor="clientNome" className="text-xs font-medium text-gray-600">Nome / Ragione Sociale</Label>
                <Input id="clientNome" placeholder="Es. Rossi Mario" value={clientNome} onChange={e => setClientNome(e.target.value)} disabled={isSubmitting} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="clientIndirizzo" className="text-xs font-medium text-gray-600">Indirizzo (Via / Piazza)</Label>
                <Input id="clientIndirizzo" placeholder="Es. Via Garibaldi 10" value={clientIndirizzo} onChange={e => setClientIndirizzo(e.target.value)} disabled={isSubmitting} className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="clientCitta" className="text-xs font-medium text-gray-600">Comune</Label>
                  <Input id="clientCitta" placeholder="Milano" value={clientCitta} onChange={e => setClientCitta(e.target.value)} disabled={isSubmitting} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clientProvincia" className="text-xs font-medium text-gray-600">Prov.</Label>
                  <Input id="clientProvincia" placeholder="MI" value={clientProvincia} onChange={e => setClientProvincia(e.target.value.toUpperCase())} disabled={isSubmitting} className="h-9 text-sm" maxLength={2} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="clientCap" className="text-xs font-medium text-gray-600">CAP</Label>
                  <Input id="clientCap" placeholder="20100" value={clientCap} onChange={e => setClientCap(e.target.value)} disabled={isSubmitting} className="h-9 text-sm" maxLength={5} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clientCf" className="text-xs font-medium text-gray-600">Codice Fiscale</Label>
                  <Input id="clientCf" placeholder="RSSMRA80A01H501Z" value={clientCodiceFiscale} onChange={e => setClientCodiceFiscale(e.target.value.toUpperCase())} disabled={isSubmitting} className="h-9 text-sm" maxLength={16} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="clientPiva" className="text-xs font-medium text-gray-600">Partita IVA</Label>
                <Input id="clientPiva" placeholder="IT12345678901" value={clientPartitaIva} onChange={e => setClientPartitaIva(e.target.value)} disabled={isSubmitting} className="h-9 text-sm" maxLength={13} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profile missing notice */}
      {!profile?.companyName && (
        <div className="mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            Nessun profilo aziendale configurato.{" "}
            <Link href="/dashboard/settings/account" className="underline font-medium">Configura ora</Link>{" "}
            per avere il tuo logo e dati azienda sui preventivi.
          </span>
        </div>
      )}

      {/* How it works — 3 steps */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { num: "1", title: "Descrivi il lavoro", desc: "Scrivi in italiano cosa devi fare. Puoi allegare foto di appunti o del cantiere." },
          { num: "2", title: "L'AI genera il preventivo", desc: "In pochi secondi ottieni un computo metrico completo con prezzi di mercato." },
          { num: "3", title: "Modifica e scarica", desc: "Modifica ogni voce, aggiungi capitoli e scarica il PDF professionale." },
        ].map(step => (
          <div key={step.num} className="bg-white/60 rounded-xl border border-gray-100 p-3 text-center">
            <div className="h-7 w-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center mx-auto mb-2">{step.num}</div>
            <div className="text-xs font-semibold text-gray-800 mb-1">{step.title}</div>
            <div className="text-[11px] text-gray-500 leading-relaxed">{step.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
