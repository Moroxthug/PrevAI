import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useCreateQuote, useGetBusinessProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, Loader2, Building2, User, FileText, Info, ChevronDown, ChevronUp, ImagePlus, X, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_FILES = 3;
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function NewQuote() {
  const [input, setInput] = useState("");
  const [, setLocation] = useLocation();
  const createQuote = useCreateQuote();
  const { data: profile } = useGetBusinessProfile();
  const { toast } = useToast();

  const [clientNome, setClientNome] = useState("");
  const [clientIndirizzo, setClientIndirizzo] = useState("");
  const [clientCodiceFiscale, setClientCodiceFiscale] = useState("");
  const [clientPartitaIva, setClientPartitaIva] = useState("");
  const [clientCitta, setClientCitta] = useState("");
  const [clientCap, setClientCap] = useState("");
  const [clientProvincia, setClientProvincia] = useState("");
  const [showCompanyDetails, setShowCompanyDetails] = useState(false);

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { photoPreviews.forEach(url => URL.revokeObjectURL(url)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        toast({ title: "File troppo grande", description: `${file.name}: massimo ${MAX_SIZE_MB}MB per foto.`, variant: "destructive" });
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

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const handleExampleClick = (example: string) => { setInput(example); };

  const handleSubmit = () => {
    if (!input.trim()) return;

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
          toast({
            title: "Quota mensile raggiunta",
            description: "Hai usato tutti i 20 preventivi del piano Starter questo mese. Passa a Pro per preventivi illimitati.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Errore nella generazione",
            description: "Si è verificato un errore. Riprova tra qualche istante.",
            variant: "destructive",
          });
        }
      },
    });
  };

  const isSubmitting = createQuote.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Nuovo Preventivo</h1>
        <p className="text-muted-foreground mt-1">Compila i dati del committente e descrivi il lavoro: l'AI genererà un preventivo professionale.</p>
      </div>

      {/* Section 1 – Dati Azienda */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">1. Dati Azienda</CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setShowCompanyDetails(!showCompanyDetails)}
            >
              {showCompanyDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showCompanyDetails ? "Nascondi" : "Mostra"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {profile?.companyName ? (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              {profile.logoUrl && (
                <img src={profile.logoUrl} alt="Logo" className="h-10 max-w-[80px] object-contain" />
              )}
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{profile.companyName}</div>
                {profile.vatNumber && <div className="text-xs text-muted-foreground">P.IVA: {profile.vatNumber}</div>}
                {profile.address && <div className="text-xs text-muted-foreground truncate">{profile.address}</div>}
              </div>
              <Badge variant="secondary" className="ml-auto shrink-0 text-xs">Dal profilo</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <Info className="h-4 w-4 shrink-0" />
              <span>
                Nessun profilo aziendale.{" "}
                <Link href="/dashboard/profile" className="underline font-medium">
                  Configura ora
                </Link>{" "}
                per avere logo e dati azienda sui tuoi preventivi.
              </span>
            </div>
          )}
          {showCompanyDetails && profile && (
            <div className="mt-3 text-xs text-muted-foreground space-y-0.5 pl-1">
              {profile.phone && <div>Tel: {profile.phone}</div>}
              {profile.email && <div>Email: {profile.email}</div>}
              <Link href="/dashboard/profile" className="text-primary hover:underline">
                Modifica profilo →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 – Dati Committente */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">2. Dati Committente</CardTitle>
          </div>
          <CardDescription>Compila i dati del cliente: appariranno direttamente sul preventivo e nel documento di accettazione.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="clientNome">
                Nome / Ragione Sociale <span className="text-destructive">*</span>
              </Label>
              <Input
                id="clientNome"
                placeholder="Es. Rossi Mario oppure Condominio Via Roma"
                value={clientNome}
                onChange={e => setClientNome(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="clientIndirizzo">
                Indirizzo (Via / Piazza) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="clientIndirizzo"
                placeholder="Es. Via Garibaldi 10"
                value={clientIndirizzo}
                onChange={e => setClientIndirizzo(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clientCitta">Comune</Label>
              <Input
                id="clientCitta"
                placeholder="Es. Milano"
                value={clientCitta}
                onChange={e => setClientCitta(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="clientCap">CAP</Label>
                <Input
                  id="clientCap"
                  placeholder="20100"
                  value={clientCap}
                  onChange={e => setClientCap(e.target.value)}
                  disabled={isSubmitting}
                  maxLength={5}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientProvincia">Prov.</Label>
                <Input
                  id="clientProvincia"
                  placeholder="MI"
                  value={clientProvincia}
                  onChange={e => setClientProvincia(e.target.value.toUpperCase())}
                  disabled={isSubmitting}
                  maxLength={2}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clientCf">Codice Fiscale</Label>
              <Input
                id="clientCf"
                placeholder="RSSMRA80A01H501Z"
                value={clientCodiceFiscale}
                onChange={e => setClientCodiceFiscale(e.target.value.toUpperCase())}
                disabled={isSubmitting}
                maxLength={16}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clientPiva">Partita IVA</Label>
              <Input
                id="clientPiva"
                placeholder="IT12345678901"
                value={clientPartitaIva}
                onChange={e => setClientPartitaIva(e.target.value)}
                disabled={isSubmitting}
                maxLength={13}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3 – Descrizione Lavori */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">3. Descrizione Lavori</CardTitle>
          </div>
          <CardDescription>Descrivi il lavoro in linguaggio naturale. Puoi anche allegare fino a 3 foto (appunti, listini, cantiere): l'AI le analizzerà per un preventivo ancora più preciso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="es. Devo tinteggiare un appartamento di 80mq con due mani di pittura lavabile bianca. Includere anche la rasatura di una parete rovinata in soggiorno e la pittura di 4 porte in legno smaltate di bianco."
            className="min-h-[180px] resize-none text-base p-4"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSubmitting}
          />

          {/* Photo upload area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <Camera className="h-4 w-4 text-muted-foreground" />
                Foto appunti / cantiere
                <Badge variant="secondary" className="text-xs font-normal">opzionale</Badge>
              </span>
              <span className="text-xs text-muted-foreground">{photos.length}/{MAX_FILES} foto</span>
            </div>

            {/* Thumbnails (shown when at least 1 photo selected) */}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="relative group w-24 h-24 rounded-lg overflow-hidden border-2 border-border bg-muted shrink-0">
                    <img
                      src={src}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      disabled={isSubmitting}
                      className="absolute top-1 right-1 bg-black/70 hover:bg-black rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center py-0.5">
                      {photos[idx] ? `${(photos[idx].size / 1024).toFixed(0)}kb` : ""}
                    </div>
                  </div>
                ))}

                {/* "Add more" slot when < 3 photos */}
                {photos.length < MAX_FILES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary disabled:opacity-50"
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-xs">Aggiungi</span>
                  </button>
                )}
              </div>
            )}

            {/* Drop zone (shown only when no photos yet) */}
            {photos.length === 0 && (
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => !isSubmitting && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/60 hover:bg-muted/50"
                } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <ImagePlus className={`h-8 w-8 mx-auto mb-2 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-sm font-medium text-foreground">
                  {isDragging ? "Rilascia le foto qui" : "Trascina le foto qui o clicca per scegliere"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG, WEBP, HEIC · max {MAX_SIZE_MB}MB per foto · max {MAX_FILES} foto
                </p>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  L'AI analizzerà prezzi scritti a mano, misure, listini e immagini del cantiere
                </p>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Esempi rapidi:</span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExampleClick("Tinteggiatura completa appartamento 100mq, inclusa rasatura soffitti e due mani di pittura traspirante. Aggiungere smaltatura 5 infissi.")}
                disabled={isSubmitting}
              >
                Imbianchino
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExampleClick("Rifacimento completo impianto elettrico appartamento 80mq. 50 punti luce, quadro generale nuovo, certificazione di conformità.")}
                disabled={isSubmitting}
              >
                Elettricista
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExampleClick("Sostituzione caldaia a condensazione 24kW inclusa rimozione vecchia, lavaggio impianto e installazione termostato smart.")}
                disabled={isSubmitting}
              >
                Idraulico
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExampleClick("Ristrutturazione bagno completo 8mq: rimozione rivestimenti, nuova piastrellatura, sostituzione sanitari e rubinetteria, nuovo box doccia.")}
                disabled={isSubmitting}
              >
                Ristrutturazione
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between sm:items-center">
          {!clientNome.trim() ? (
            <p className="text-xs text-amber-600 flex items-center gap-1 font-medium">
              <Info className="h-3 w-3" />
              Il nome del committente è obbligatorio
            </p>
          ) : !clientIndirizzo.trim() ? (
            <p className="text-xs text-amber-600 flex items-center gap-1 font-medium">
              <Info className="h-3 w-3" />
              L'indirizzo del committente è obbligatorio
            </p>
          ) : photos.length > 0 ? (
            <p className="text-xs text-primary flex items-center gap-1 font-medium">
              <Camera className="h-3 w-3" />
              {photos.length} {photos.length === 1 ? "foto allegata" : "foto allegate"} · l'AI utilizzerà la vision
            </p>
          ) : null}
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || !clientNome.trim() || !clientIndirizzo.trim() || isSubmitting}
            className="gap-2 bg-primary text-primary-foreground px-8 sm:ml-auto"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {photos.length > 0 ? "Analisi foto in corso..." : "Generazione in corso..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Genera Preventivo
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
