import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetSubscription, useCreateCustomerPortalSession, useUpdateBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { Crown, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { SettingsGroup, SettingsRow, SettingsSection, useSettingsDraft } from "./ui";
import { EMAIL_RE, changed, useBusinessProfile, useSaveBusinessProfile } from "./data";

const ALLOWED_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"];
const MAX_SIZE_MB = 2;

type CompanyDraft = { companyName: string; vatNumber: string; phone: string; email: string; address: string };

/** Impresa → Dati dell'impresa: nome, P. IVA, contatti e logo che ogni preventivo e fattura riporta. */
export function CompanySection() {
  const { t } = useLanguage();
  const { data: profile, isLoading } = useBusinessProfile();
  const saveProfile = useSaveBusinessProfile();
  const source = useMemo<CompanyDraft | undefined>(() => profile && {
    companyName: profile.companyName ?? "",
    vatNumber: profile.vatNumber ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    address: profile.address ?? "",
  }, [profile]);

  const nameError = (d: CompanyDraft) => (d.companyName.trim().length < 2 ? t("dashboard.profile.errors.companyNameMin") : null);
  const emailError = (d: CompanyDraft) => (d.email.trim() && !EMAIL_RE.test(d.email.trim()) ? t("dashboard.profile.errors.invalidEmail") : null);
  const { draft, set } = useSettingsDraft<CompanyDraft>(
    source,
    async (d, s) => {
      const diff = changed(d, s);
      const body: Record<string, unknown> = {};
      // L'endpoint vuole stringhe per questi campi (companyName obbligatorio): "" per svuotare.
      for (const [k, v] of Object.entries(diff)) body[k] = (v as string).trim();
      await saveProfile(body);
    },
    (d) => !nameError(d) && !emailError(d),
  );

  return (
    <SettingsSection title="Dati dell'impresa" intro="Il nome, la partita IVA, i contatti e il logo che compaiono su ogni preventivo, contratto e fattura.">
      {isLoading || !draft ? (
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      ) : (
        <>
          <LogoGroup logoUrl={profile?.logoUrl ?? null} />
          <SettingsGroup title="Identità">
            <SettingsRow label={t("dashboard.profile.businessData.companyNameLabel")} htmlFor="s-company-name" error={nameError(draft)}>
              <input id="s-company-name" value={draft.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder={t("dashboard.profile.businessData.companyNamePlaceholder")} autoComplete="organization" aria-invalid={!!nameError(draft)} />
            </SettingsRow>
            <SettingsRow label={t("dashboard.profile.businessData.vatNumberLabel")} help="Compare nell'intestazione di preventivi e fatture." htmlFor="s-company-vat">
              <input id="s-company-vat" value={draft.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} placeholder={t("dashboard.profile.businessData.vatNumberPlaceholder")} />
            </SettingsRow>
          </SettingsGroup>
          <SettingsGroup title="Contatti" desc="Dove i clienti ti trovano: vanno in fondo a ogni documento.">
            <SettingsRow label={t("dashboard.profile.businessData.phoneLabel")} htmlFor="s-company-phone">
              <input id="s-company-phone" type="tel" inputMode="tel" autoComplete="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} placeholder={t("dashboard.profile.businessData.phonePlaceholder")} />
            </SettingsRow>
            <SettingsRow label={t("dashboard.profile.businessData.emailLabel")} htmlFor="s-company-email" error={emailError(draft)}>
              <input id="s-company-email" type="email" inputMode="email" autoComplete="email" value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder={t("dashboard.profile.businessData.emailPlaceholder")} aria-invalid={!!emailError(draft)} />
            </SettingsRow>
            <SettingsRow label={t("dashboard.profile.businessData.addressLabel")} htmlFor="s-company-address">
              <input id="s-company-address" autoComplete="street-address" value={draft.address} onChange={(e) => set("address", e.target.value)} placeholder={t("dashboard.profile.businessData.addressPlaceholder")} />
            </SettingsRow>
          </SettingsGroup>
        </>
      )}
    </SettingsSection>
  );
}

/** Il logo si carica e si toglie da solo (è un file, non un campo), quindi non passa dalla barra Salva. */
function LogoGroup({ logoUrl }: { logoUrl: string | null }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateBusinessProfile();
  const { data: subscription } = useGetSubscription();
  const createPortal = useCreateCustomerPortalSession();
  const isStarter = subscription?.isActive && subscription?.plan === "monthly_starter";
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const current = preview ?? logoUrl;

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: t("dashboard.profile.errors.unsupportedFormat"), description: t("dashboard.profile.errors.useFormats"), variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: t("dashboard.profile.errors.fileTooLarge"), description: t("dashboard.profile.errors.maxSize").replace("{max}", String(MAX_SIZE_MB)), variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/business-profile/logo", { method: "POST", body: formData });
      if (!res.ok) throw new Error(t("dashboard.profile.errors.uploadFailed"));
      const { logoUrl: url } = (await res.json()) as { logoUrl: string };
      setPreview(url);
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: t("dashboard.profile.toast.logoUploaded") });
    } catch (err) {
      toast({ title: t("dashboard.profile.toast.errorLogoUpload"), description: err instanceof Error ? err.message : t("dashboard.profile.toast.unknownError"), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const remove = async () => {
    try {
      await updateProfile.mutateAsync({ data: { logoUrl: "" } });
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      setPreview(null);
      toast({ title: t("dashboard.profile.toast.logoRemoved") });
    } catch {
      toast({ title: t("dashboard.profile.toast.errorLogoRemove"), variant: "destructive" });
    }
  };

  if (isStarter) {
    return (
      <SettingsGroup>
        <div className="srow srow-action">
          <div className="srow-txt">
            <span className="srow-label">{t("dashboard.profile.logoProOnly.title")}</span>
            <p>{t("dashboard.settings.account.logoStarterDesc1")} {t("dashboard.settings.account.logoStarterDesc2")}</p>
          </div>
          <div className="srow-act">
            <button type="button" onClick={() => createPortal.mutate(undefined, { onSuccess: (r) => { window.open(r.url, "_blank"); } })} disabled={createPortal.isPending} className="btn btn-outline-navy btn-sm gap-2">
              {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {t("dashboard.profile.logoProOnly.upgradeButton")}
            </button>
          </div>
        </div>
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup>
      <div className="srow">
        <div className="srow-txt">
          <span className="srow-label">{t("dashboard.profile.logo.title")}</span>
          <p>{t("dashboard.settings.account.logoDesc")}</p>
        </div>
        <div className="srow-field slogo">
          <div className="slogo-box">
            {current ? (
              <img src={current} alt={t("dashboard.profile.logo.altText")} />
            ) : (
              <span className="slogo-none"><ImageIcon className="h-5 w-5" aria-hidden="true" />{t("dashboard.profile.logo.none")}</span>
            )}
          </div>
          <div className="slogo-actions">
            <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg" className="hidden" onChange={upload} disabled={uploading} aria-label={t("dashboard.profile.logo.uploadButton")} tabIndex={-1} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn btn-outline-navy btn-sm gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? t("dashboard.profile.logo.uploading") : t("dashboard.profile.logo.uploadButton")}
            </button>
            {current && (
              <button type="button" onClick={remove} className="btn btn-outline-navy btn-sm gap-2">
                <X className="h-4 w-4" />{t("dashboard.profile.logo.remove")}
              </button>
            )}
          </div>
        </div>
      </div>
    </SettingsGroup>
  );
}
