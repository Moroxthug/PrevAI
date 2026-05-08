import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetBusinessProfile, useUpdateBusinessProfile, useGetSubscription, useCreateCustomerPortalSession } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Upload, X, ImageIcon, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBusinessProfileQueryKey } from "@workspace/api-client-react";

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

export default function ProfileSettings() {
  const { data: profile, isLoading } = useGetBusinessProfile();
  const updateProfile = useUpdateBusinessProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const createPortal = useCreateCustomerPortalSession();

  const isStarter = subscription?.isActive && subscription?.plan === "monthly_starter";

  const handleUpgrade = () => {
    createPortal.mutate(undefined, {
      onSuccess: (result) => { window.open(result.url, "_blank"); },
      onError: () => toast({ title: "Errore apertura portale", variant: "destructive" }),
    });
  };

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
      onError: () => {
        toast({ title: "Errore durante l'aggiornamento", variant: "destructive" });
      }
    });
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const res = await fetch("/api/business-profile/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Upload fallito");
      }

      const { logoUrl } = await res.json() as { logoUrl: string };
      setLogoPreview(logoUrl);
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: "Logo caricato con successo" });
    } catch (err) {
      toast({
        title: "Errore caricamento logo",
        description: err instanceof Error ? err.message : "Errore sconosciuto",
        variant: "destructive",
      });
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Profilo Aziendale</h1>
        <p className="text-muted-foreground mt-1">Queste informazioni appariranno nell'intestazione dei tuoi preventivi.</p>
      </div>

      {/* Logo Upload Card — hidden for Starter, replaced with upgrade prompt */}
      {isStarter ? (
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-violet-500" />
              <CardTitle>Logo Aziendale — Solo Piano Pro</CardTitle>
            </div>
            <CardDescription>
              Con il piano <strong>Starter</strong> i tuoi preventivi mostrano il logo PrevAI con filigrana.<br/>
              Passa a <strong>Pro</strong> per usare il tuo logo aziendale e ottenere PDF puliti senza filigrana.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                {["PDF senza filigrana", "Tuo logo aziendale", "Preventivi illimitati"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-violet-500 font-bold">✓</span> {f}
                  </div>
                ))}
              </div>
              <Button
                onClick={handleUpgrade}
                disabled={createPortal.isPending}
                className="shrink-0"
              >
                {createPortal.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Crown className="h-4 w-4 mr-2" />
                )}
                Passa a Pro
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Logo Aziendale</CardTitle>
            <CardDescription>Carica il tuo logo (SVG, PNG o JPG, max 2 MB). Apparirà in cima ai PDF dei preventivi.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Logo preview */}
              <div className="w-32 h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
                {currentLogoUrl ? (
                  <img
                    src={currentLogoUrl}
                    alt="Logo aziendale"
                    className="max-h-full max-w-full object-contain p-1"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-xs">Nessun logo</span>
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleLogoFileChange}
                  disabled={isUploadingLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="gap-2"
                >
                  {isUploadingLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isUploadingLogo ? "Caricamento..." : "Carica logo"}
                </Button>
                {currentLogoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                    Rimuovi
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Formati: SVG, PNG, JPG • Max 2 MB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Dati dell'attività</CardTitle>
              <CardDescription>Inserisci i dati della tua azienda o partita IVA.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Azienda / Ragione Sociale *</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Mario Rossi Impianti" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Partita IVA / Codice Fiscale</FormLabel>
                      <FormControl>
                        <Input placeholder="IT12345678901" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefono</FormLabel>
                      <FormControl>
                        <Input placeholder="+39 333 1234567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Aziendale</FormLabel>
                    <FormControl>
                      <Input placeholder="info@azienda.it" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Indirizzo Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Via Roma 1, 20100 Milano (MI)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end border-t p-6">
              <Button type="submit" disabled={updateProfile.isPending} className="min-w-[120px]">
                {updateProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salva Modifiche
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
