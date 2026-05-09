import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetBusinessProfile, useUpdateBusinessProfile, useGetSubscription,
  useCreateCustomerPortalSession, getGetBusinessProfileQueryKey,
  useGetWhatsappStatus, useConnectWhatsapp, useVerifyWhatsapp, useDisconnectWhatsapp,
  useToggleWhatsapp, getGetWhatsappStatusQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Upload, X, ImageIcon, Crown, Zap, CheckCircle2, XCircle, CalendarDays, BarChart3, AlertCircle, RefreshCw, ArrowUpRight, MessageCircle, Phone, Link2Off } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSearch } from "wouter";

const profileSchema = z.object({
  companyName: z.string().min(2, "Il nome azienda deve avere almeno 2 caratteri"),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const ALLOWED_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"];
const MAX_SIZE_MB = 2;

function AccountTab() {
  const { data: profile, isLoading } = useGetBusinessProfile();
  const updateProfile = useUpdateBusinessProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const createPortal = useCreateCustomerPortalSession();
  const isStarter = subscription?.isActive && subscription?.plan === "monthly_starter";
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentLogoUrl = logoPreview ?? profile?.logoUrl ?? null;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      companyName: profile?.companyName || "",
      vatNumber: profile?.vatNumber || "",
      address: profile?.address || "",
      phone: profile?.phone || "",
      email: profile?.email || "",
    }
  });

  const onSubmit = (data: ProfileFormValues) => {
    updateProfile.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Profilo aggiornato con successo" });
        queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      },
      onError: () => toast({ title: "Errore durante l'aggiornamento", variant: "destructive" })
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: "Formato non supportato", description: "Usa SVG, PNG o JPG", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: "File troppo grande", description: `Massimo ${MAX_SIZE_MB} MB`, variant: "destructive" });
      return;
    }
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/business-profile/logo", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload fallito");
      const { logoUrl } = await res.json() as { logoUrl: string };
      setLogoPreview(logoUrl);
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: "Logo caricato con successo" });
    } catch (err) {
      toast({ title: "Errore caricamento logo", description: err instanceof Error ? err.message : "Errore sconosciuto", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateProfile.mutateAsync({ data: { logoUrl: "" } });
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      setLogoPreview(null);
      toast({ title: "Logo rimosso" });
    } catch {
      toast({ title: "Errore rimozione logo", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      {isStarter ? (
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-violet-500" />
              <CardTitle>Logo Aziendale — Solo Piano Pro</CardTitle>
            </div>
            <CardDescription>
              Con il piano <strong>Starter</strong> i tuoi preventivi mostrano il logo PrevAI.<br/>
              Passa a <strong>Pro</strong> per usare il tuo logo e ottenere PDF puliti senza filigrana.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                {["PDF senza filigrana", "Tuo logo aziendale", "Preventivi illimitati"].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm"><span className="text-violet-500 font-bold">✓</span> {f}</div>
                ))}
              </div>
              <Button onClick={() => createPortal.mutate(undefined, { onSuccess: (r) => { window.open(r.url, "_blank"); } })} disabled={createPortal.isPending}>
                {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                Passa a Pro
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Logo Aziendale</CardTitle>
            <CardDescription>Carica il tuo logo (SVG, PNG o JPG, max 2 MB). Apparirà in cima ai PDF.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-32 h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
                {currentLogoUrl ? (
                  <img src={currentLogoUrl} alt="Logo aziendale" className="max-h-full max-w-full object-contain p-1" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-6 w-6" /><span className="text-xs">Nessun logo</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg" className="hidden" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingLogo} className="gap-2">
                  {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isUploadingLogo ? "Caricamento..." : "Carica logo"}
                </Button>
                {currentLogoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveLogo} className="gap-2 text-destructive hover:text-destructive block">
                    <X className="h-4 w-4" />Rimuovi
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">SVG, PNG, JPG • Max 2 MB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Dati dell'attività</CardTitle>
              <CardDescription>Inserisci i dati della tua azienda o partita IVA.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Azienda / Ragione Sociale *</FormLabel>
                  <FormControl><Input placeholder="Es. Mario Rossi Impianti" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="vatNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partita IVA / Codice Fiscale</FormLabel>
                    <FormControl><Input placeholder="IT12345678901" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono</FormLabel>
                    <FormControl><Input placeholder="+39 333 1234567" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Aziendale</FormLabel>
                  <FormControl><Input placeholder="info@azienda.it" type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Indirizzo Completo</FormLabel>
                  <FormControl><Input placeholder="Via Roma 1, 20100 Milano (MI)" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
            <CardFooter className="flex justify-end border-t p-6">
              <Button type="submit" disabled={updateProfile.isPending} className="min-w-[120px]">
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salva Modifiche
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-violet-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Preventivi usati</span><span className="font-semibold">{used} / {limit}</span></div>
      <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{limit - used} rimanenti</span><span>{pct}% usato</span></div>
    </div>
  );
}

function PlanFeature({ text, ok }: { text: string; ok: boolean }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-foreground" : "text-muted-foreground line-through opacity-50"}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
      {text}
    </li>
  );
}

function BillingTab() {
  const { data: sub, isLoading } = useGetSubscription();
  const createPortal = useCreateCustomerPortalSession();
  const { toast } = useToast();
  const handleManage = () => {
    createPortal.mutate(undefined, {
      onSuccess: (r) => { window.open(r.url, "_blank"); },
      onError: () => toast({ title: "Errore apertura portale", variant: "destructive" }),
    });
  };
  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  const isStarter = sub?.plan === "monthly_starter";
  const isPro = sub?.plan === "monthly_pro";
  const isElite = sub?.plan === "monthly_elite";
  const isActive = sub?.isActive ?? false;
  const planLabel = isElite ? "Elite" : isPro ? "Pro" : isStarter ? "Starter" : null;
  const planPrice = isElite ? "€59/mese" : isPro ? "€49/mese" : isStarter ? "€19/mese" : null;
  const renewalDate = sub?.periodEnd ? new Date(sub.periodEnd).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) : null;
  const resetDate = sub?.quotaResetDate ? new Date(sub.quotaResetDate).toLocaleDateString("it-IT", { day: "2-digit", month: "long" }) : null;

  return (
    <div className="space-y-6">
      {isActive ? (
        <Card className={`border-2 ${isElite ? "border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50" : isPro ? "border-amber-300 bg-gradient-to-br from-amber-50 to-violet-50" : "border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${isElite ? "bg-amber-200" : isPro ? "bg-amber-100" : "bg-violet-100"}`}>
                  {isElite ? <Crown className="h-6 w-6 text-amber-700" /> : isPro ? <Crown className="h-6 w-6 text-amber-600" /> : <Zap className="h-6 w-6 text-violet-500" />}
                </div>
                <div>
                  <CardTitle className="text-xl">PrevAI {planLabel}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{planPrice}</p>
                </div>
              </div>
              <Badge className={`text-xs ${isElite ? "bg-amber-100 text-amber-800 border-amber-300" : isPro ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-violet-100 text-violet-700 border-violet-200"}`} variant="outline">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Attivo
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {isStarter && sub.quotaUsed != null && sub.quotaLimit != null && (
              <div className="bg-white/70 rounded-xl p-4 border border-violet-100">
                <div className="flex items-center gap-2 mb-3"><BarChart3 className="h-4 w-4 text-violet-500" /><span className="text-sm font-semibold">Utilizzo Mensile</span></div>
                <QuotaBar used={sub.quotaUsed} limit={sub.quotaLimit} />
                {resetDate && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><RefreshCw className="h-3 w-3" />Quota si azzera il {resetDate}</p>}
                {(sub.quotaRemaining ?? 0) <= 3 && (sub.quotaRemaining ?? 0) > 0 && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />Stai per esaurire i preventivi del mese.
                  </div>
                )}
              </div>
            )}
            <div className="bg-white/70 rounded-xl p-4 border border-violet-100">
              <div className="text-sm font-semibold mb-3">Incluso nel tuo piano</div>
              <ul className="space-y-2">
                {isElite ? (
                  <><PlanFeature text="Preventivi illimitati" ok /><PlanFeature text="PDF senza filigrana" ok /><PlanFeature text="Tuo logo aziendale sui PDF" ok /><PlanFeature text="Tutti i template PDF" ok /><PlanFeature text="Upload appunti illimitato" ok /><PlanFeature text="Voce illimitata" ok /></>
                ) : isPro ? (
                  <><PlanFeature text="60 preventivi al mese" ok /><PlanFeature text="PDF senza filigrana" ok /><PlanFeature text="Tuo logo aziendale sui PDF" ok /><PlanFeature text="Tutti i template PDF" ok /><PlanFeature text="Upload appunti (30/mese)" ok /><PlanFeature text="Registrazione vocale (30/mese)" ok /></>
                ) : (
                  <><PlanFeature text={`${sub?.quotaLimit ?? 10} preventivi al mese`} ok /><PlanFeature text="PDF con logo aziendale" ok /><PlanFeature text="Template Standard" ok /><PlanFeature text="PDF senza watermark" ok={false} /><PlanFeature text="Template Pro e Premium" ok={false} /></>
                )}
              </ul>
            </div>
            {renewalDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />Prossimo rinnovo: <span className="font-medium text-foreground">{renewalDate}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              {(isStarter || isPro) && (
                <Button onClick={handleManage} disabled={createPortal.isPending} className="gap-2">
                  {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}{isStarter ? "Passa a Pro" : "Passa a Elite"}
                </Button>
              )}
              <Button variant="outline" onClick={handleManage} disabled={createPortal.isPending} className="gap-2">
                <ArrowUpRight className="h-4 w-4" />Gestisci abbonamento
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Gestito tramite Stripe — annulla in qualsiasi momento.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center"><XCircle className="h-5 w-5 text-muted-foreground" /></div>
              <div><CardTitle>Nessun abbonamento attivo</CardTitle><CardDescription className="mt-0.5">Scegli un piano per sbloccare i preventivi.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <button onClick={handleManage} disabled={createPortal.isPending} className="btn-gradient inline-flex h-10 items-center justify-center px-5 text-sm font-semibold gap-2">
              <Crown className="h-4 w-4" />Scegli un piano
            </button>
          </CardContent>
        </Card>
      )}
      {!isPro && (
        <Card>
          <CardHeader><CardTitle className="text-base">Confronto Piani</CardTitle><CardDescription>Cosa ottieni passando a Pro.</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm"><Zap className="h-4 w-4 text-violet-500" />Starter — €29/mese</div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0" />20 preventivi/mese</li>
                  <li className="flex items-center gap-2 text-muted-foreground line-through opacity-50"><XCircle className="h-3.5 w-3.5 shrink-0" />Logo personalizzato</li>
                  <li className="flex items-center gap-2 text-muted-foreground line-through opacity-50"><XCircle className="h-3.5 w-3.5 shrink-0" />PDF senza filigrana</li>
                </ul>
              </div>
              <div className="space-y-2 border-l pl-4">
                <div className="flex items-center gap-2 font-semibold text-sm"><Crown className="h-4 w-4 text-amber-500" />Pro — €79/mese</div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2 text-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />Preventivi illimitati</li>
                  <li className="flex items-center gap-2 text-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />Tuo logo aziendale</li>
                  <li className="flex items-center gap-2 text-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />Nessuna filigrana</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WhatsappTab() {
  const { data: status, isLoading } = useGetWhatsappStatus();
  const connectWa = useConnectWhatsapp();
  const verifyWa = useVerifyWhatsapp();
  const disconnectWa = useDisconnectWhatsapp();
  const toggleWa = useToggleWhatsapp();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [phoneInput, setPhoneInput] = useState("");
  const [otpState, setOtpState] = useState<{ phoneNumber: string } | null>(null);
  const [otpInput, setOtpInput] = useState("");

  const isConnected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  const handleConnect = () => {
    if (!phoneInput.trim()) return;
    connectWa.mutate(
      { data: { phoneNumber: phoneInput.trim() } },
      {
        onSuccess: (result) => {
          setOtpState({ phoneNumber: result.phoneNumber });
          setOtpInput("");
        },
        onError: (err) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Errore durante la connessione";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleVerify = () => {
    if (!otpState || !otpInput.trim()) return;
    verifyWa.mutate(
      { data: { phoneNumber: otpState.phoneNumber, otp: otpInput.trim() } },
      {
        onSuccess: () => {
          setOtpState(null);
          setOtpInput("");
          queryClient.invalidateQueries({ queryKey: getGetWhatsappStatusQueryKey() });
          toast({ title: "WhatsApp collegato con successo! 🎉" });
        },
        onError: (err) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Codice errato o scaduto";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleDisconnect = () => {
    disconnectWa.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWhatsappStatusQueryKey() });
        toast({ title: "WhatsApp scollegato" });
      },
      onError: () => toast({ title: "Errore durante la disconnessione", variant: "destructive" }),
    });
  };

  const handleToggle = () => {
    toggleWa.mutate(
      { data: { isEnabled: !isEnabled } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWhatsappStatusQueryKey() });
          toast({ title: isEnabled ? "Integrazione disabilitata" : "Integrazione abilitata" });
        },
        onError: () => toast({ title: "Errore", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;

  if (isConnected) {
    return (
      <div className="space-y-4">
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">WhatsApp Collegato</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    +{status?.phoneNumber}
                  </p>
                </div>
              </div>
              <Badge
                className={cn(
                  "text-xs",
                  isEnabled
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-gray-100 text-gray-500 border-gray-200"
                )}
                variant="outline"
              >
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Attivo</> : <><XCircle className="h-3 w-3 mr-1" /> Disabilitato</>}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/70 rounded-xl p-4 border border-emerald-100 text-sm text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground mb-2">Come usare l'integrazione:</p>
              <p>📝 Invia una <strong>descrizione del lavoro</strong> in testo al numero prevai</p>
              <p>🎙️ Invia un <strong>messaggio vocale</strong> — viene trascritto automaticamente</p>
              <p>📷 Invia una <strong>foto degli appunti</strong> — prevai la legge e genera il preventivo</p>
              <p>🔗 Ricevi il link diretto al preventivo su prevai.it</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                variant={isEnabled ? "outline" : "default"}
                size="sm"
                onClick={handleToggle}
                disabled={toggleWa.isPending}
                className="gap-2"
              >
                {toggleWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? "Disabilita" : "Abilita"} integrazione
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnectWa.isPending}
                className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
              >
                {disconnectWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                Scollega WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (otpState) {
    return (
      <Card className="border-violet-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <CardTitle>Inserisci il codice ricevuto</CardTitle>
              <CardDescription className="mt-0.5">
                Abbiamo inviato un codice al numero <strong>+{otpState.phoneNumber}</strong> su WhatsApp
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-violet-700 space-y-1">
            <p className="font-semibold">Controlla WhatsApp sul tuo telefono.</p>
            <p className="text-violet-500">Hai ricevuto un messaggio da prevai con un codice a 6 cifre. Inseriscilo qui sotto.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Codice di verifica</label>
            <div className="flex gap-2">
              <Input
                placeholder="123456"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter" && otpInput.length === 6) handleVerify(); }}
                className="flex-1 text-center text-xl tracking-widest font-mono"
                maxLength={6}
                inputMode="numeric"
              />
              <Button
                onClick={handleVerify}
                disabled={otpInput.length !== 6 || verifyWa.isPending}
                className="gap-2 btn-gradient"
              >
                {verifyWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Verifica
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Il codice è valido per 15 minuti</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { connectWa.mutate({ data: { phoneNumber: otpState.phoneNumber } }); }}
              disabled={connectWa.isPending}
              className="text-muted-foreground gap-2"
            >
              {connectWa.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Reinvia il codice
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setOtpState(null); setOtpInput(""); }} className="text-muted-foreground">
              Annulla
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-100 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <CardTitle>Collega WhatsApp</CardTitle>
              <CardDescription className="mt-0.5">Genera preventivi direttamente da WhatsApp — testo, vocale o foto</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "📝", label: "Testo", desc: "Scrivi la descrizione del lavoro" },
              { icon: "🎙️", label: "Vocale", desc: "Registra un messaggio vocale" },
              { icon: "📷", label: "Foto", desc: "Fotografa i tuoi appunti" },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Il tuo numero WhatsApp</label>
            <div className="flex gap-2">
              <Input
                placeholder="+39 333 1234567"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && phoneInput.trim()) handleConnect(); }}
                className="flex-1"
              />
              <Button
                onClick={handleConnect}
                disabled={!phoneInput.trim() || connectWa.isPending}
                className="gap-2 btn-gradient"
              >
                {connectWa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Collega
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Usa il formato internazionale, es: +39 333 1234567</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const isAccountPath = typeof window !== "undefined" && window.location.pathname.includes("/account");
  const tabFromParam = params.get("tab");
  const defaultTab = (isAccountPath || tabFromParam === "account") ? "account" : tabFromParam === "whatsapp" ? "whatsapp" : "billing";
  const [activeTab, setActiveTab] = useState<"account" | "billing" | "whatsapp">(defaultTab as "account" | "billing" | "whatsapp");

  const TABS = [
    { id: "account" as const, label: "Account Aziendale" },
    { id: "billing" as const, label: "Piano & Fatturazione" },
    { id: "whatsapp" as const, label: "WhatsApp" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Impostazioni</h1>
        <p className="text-muted-foreground mt-1">Gestisci i dati aziendali e il tuo abbonamento.</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "account" ? <AccountTab /> : activeTab === "whatsapp" ? <WhatsappTab /> : <BillingTab />}
    </div>
  );
}
