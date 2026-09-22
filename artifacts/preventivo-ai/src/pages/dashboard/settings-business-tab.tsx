import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MockupToggle } from "@/components/ui/mockup-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Loader2, Save, MapPin, Landmark, Zap, CalendarClock, Star } from "lucide-react";
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor";
import { CANADIAN_PROVINCES, type PaymentSchedule } from "@/lib/payment-schedule";

type TaxProfile = { province: string; components: { code: string; label: string; rate: number }[]; totalRate: number };

type ProfileExtras = {
  province: string | null;
  taxProfile: TaxProfile | null;
  codiceFiscale: string | null;
  codiceSdi: string | null;
  reaNumber: string | null;
  iban: string | null;
  googleReviewUrl: string | null;
  secondaryReviewUrl: string | null;
  sendReviewRequests: boolean;
  defaultPaymentSchedule: PaymentSchedule | null;
  automationSettings: { notifyOnQuoteAccepted: boolean; autoDraftContract: boolean; autoSendInvoices: boolean; invoiceAutoSendAfterHours: number; invoiceReminders: boolean };
};

const DEFAULT_SCHEDULE: PaymentSchedule = {
  currency: "EUR",
  derived: false,
  holdback: { enabled: false, percent: 10 },
  terms: [
    { id: "t1", type: "deposit", label: "Acconto alla firma del contratto", trigger: "on_signing", amountType: "percent", value: 30, dueDays: 0 },
    { id: "t2", type: "milestone", label: "A completamento prima fase lavori", trigger: "milestone", amountType: "percent", value: 30, dueDays: 15 },
    { id: "t3", type: "milestone", label: "A completamento seconda fase lavori", trigger: "milestone", amountType: "percent", value: 30, dueDays: 15 },
    { id: "t4", type: "completion", label: "Saldo a fine lavori", trigger: "on_completion", amountType: "percent", value: 10, dueDays: 15 },
  ],
};

/**
 * "Business" settings tab: identità fiscale italiana (provincia, P.IVA/CF,
 * licence, e-transfer email), automation preferences and the default
 * payment schedule new quotes start from.
 */
export function BusinessTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profileRaw, isLoading } = useGetBusinessProfile();
  const profile = profileRaw as unknown as (typeof profileRaw & ProfileExtras) | undefined;

  const [province, setProvince] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [codiceSdi, setCodiceSdi] = useState("");
  const [reaNumber, setReaNumber] = useState("");
  const [iban, setIban] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [secondaryReviewUrl, setSecondaryReviewUrl] = useState("");
  const [sendReviewRequests, setSendReviewRequests] = useState(true);
  const [notifyOnQuoteAccepted, setNotifyOnQuoteAccepted] = useState(true);
  const [autoSendInvoices, setAutoSendInvoices] = useState(false);
  const [invoiceAutoSendAfterHours, setInvoiceAutoSendAfterHours] = useState(0);
  const [invoiceReminders, setInvoiceReminders] = useState(true);
  const [schedule, setSchedule] = useState<PaymentSchedule>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setProvince(profile.province ?? "");
    setCodiceFiscale(profile.codiceFiscale ?? "");
    setCodiceSdi(profile.codiceSdi ?? "");
    setReaNumber(profile.reaNumber ?? "");
    setIban(profile.iban ?? "");
    setGoogleReviewUrl(profile.googleReviewUrl ?? "");
    setSecondaryReviewUrl(profile.secondaryReviewUrl ?? "");
    setSendReviewRequests(profile.sendReviewRequests ?? true);
    setNotifyOnQuoteAccepted(profile.automationSettings?.notifyOnQuoteAccepted ?? true);
    setAutoSendInvoices(profile.automationSettings?.autoSendInvoices ?? false);
    setInvoiceAutoSendAfterHours(profile.automationSettings?.invoiceAutoSendAfterHours ?? 0);
    setInvoiceReminders(profile.automationSettings?.invoiceReminders ?? true);
    setSchedule(profile.defaultPaymentSchedule ?? DEFAULT_SCHEDULE);
  }, [profile]);

  const taxHint = (() => {
    const p = CANADIAN_PROVINCES.find((x) => x.code === province);
    if (!p) return null;
    const rates: Record<string, string> = {
      AB: "GST 5%", BC: "GST 5% + PST 7%", MB: "GST 5% + RST 7%", NB: "HST 15%", NL: "HST 15%", NS: "HST 14%",
      NT: "GST 5%", NU: "GST 5%", ON: "HST 13%", PE: "HST 15%", QC: "GST 5% + QST 9.975%", SK: "GST 5% + PST 6%", YT: "GST 5%",
    };
    return rates[province] ?? null;
  })();

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/business-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          province: province || null,
          codiceFiscale: codiceFiscale || null,
          codiceSdi: codiceSdi || null,
          reaNumber: reaNumber || null,
          iban: iban || null,
          googleReviewUrl: googleReviewUrl || null,
          secondaryReviewUrl: secondaryReviewUrl || null,
          sendReviewRequests,
          automationSettings: { notifyOnQuoteAccepted, autoSendInvoices, invoiceAutoSendAfterHours, invoiceReminders },
          defaultPaymentSchedule: schedule,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Save failed");
      }
      await queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: t("dashboard.settings.business.saved") });
    } catch (err) {
      toast({ title: t("dashboard.settings.business.saveError"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-navy-600" />
              {t("dashboard.settings.business.identityTitle")}
            </h2>
            <p className="sub">{t("dashboard.settings.business.identityDesc")}</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <Label htmlFor="province">{t("dashboard.settings.business.province")}</Label>
            <select
              id="province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">{t("dashboard.settings.business.provinceSelect")}</option>
              {CANADIAN_PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
            {taxHint && (
              <span className="text-xs text-muted-foreground mt-1 block">{t("dashboard.settings.business.taxApplied")}: <strong>{taxHint}</strong></span>
            )}
          </div>
          <div className="field">
            <Label htmlFor="codiceFiscale">{t("dashboard.settings.business.codiceFiscale")}</Label>
            <Input id="codiceFiscale" value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value)} placeholder="RSSMRA80A01F205X" maxLength={16} />
          </div>
          <div className="field">
            <Label htmlFor="codiceSdi">{t("dashboard.settings.business.codiceSdi")}</Label>
            <Input id="codiceSdi" value={codiceSdi} onChange={(e) => setCodiceSdi(e.target.value)} placeholder="ABCDEFG oppure PEC" />
          </div>
          <div className="field">
            <Label htmlFor="rea">{t("dashboard.settings.business.rea")}</Label>
            <Input id="rea" value={reaNumber} onChange={(e) => setReaNumber(e.target.value)} placeholder={t("dashboard.settings.business.reaPlaceholder")} />
            <span className="text-xs text-muted-foreground mt-1 block">{t("dashboard.settings.business.reaHint")}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-navy-600" />
              {t("dashboard.settings.business.paymentsTitle")}
            </h2>
            <p className="sub">{t("dashboard.settings.business.paymentsDesc")}</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field full">
            <Label htmlFor="iban">{t("dashboard.settings.business.iban")}</Label>
            <Input id="iban" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IT60X0542811101000000123456" maxLength={34} />
            <span className="text-xs text-muted-foreground mt-1 block">{t("dashboard.settings.business.ibanHint")}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <Star className="h-5 w-5 text-navy-600" />
              {t("dashboard.settings.business.reviewsTitle")}
            </h2>
            <p className="sub">{t("dashboard.settings.business.reviewsDesc")}</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field full">
            <Label htmlFor="googleReviewUrl">{t("dashboard.settings.business.googleReviewUrl")}</Label>
            <Input id="googleReviewUrl" type="url" value={googleReviewUrl} onChange={(e) => setGoogleReviewUrl(e.target.value)} placeholder="https://g.page/r/.../review" />
            <span className="text-xs text-muted-foreground mt-1 block">{t("dashboard.settings.business.googleReviewUrlHint")}</span>
          </div>
          <div className="field full">
            <Label htmlFor="secondaryReviewUrl">{t("dashboard.settings.business.secondaryReviewUrl")}</Label>
            <Input id="secondaryReviewUrl" type="url" value={secondaryReviewUrl} onChange={(e) => setSecondaryReviewUrl(e.target.value)} placeholder="https://..." />
            <span className="text-xs text-muted-foreground mt-1 block">{t("dashboard.settings.business.secondaryReviewUrlHint")}</span>
          </div>
        </div>
        <div className="set-row">
          <div className="txt">
            <b>{t("dashboard.settings.business.sendReviewRequests")}</b>
            <span>{t("dashboard.settings.business.sendReviewRequestsHint")}</span>
          </div>
          <MockupToggle
            checked={sendReviewRequests}
            onCheckedChange={setSendReviewRequests}
            disabled={!googleReviewUrl}
            label={t("dashboard.settings.business.sendReviewRequests")}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-navy-600" />
              {t("dashboard.settings.business.scheduleTitle")}
            </h2>
            <p className="sub">{t("dashboard.settings.business.scheduleDesc")}</p>
          </div>
        </div>
        <div className="p-5">
          <PaymentScheduleEditor value={schedule} onChange={setSchedule} total={0} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-navy-600" />
              {t("dashboard.settings.business.automationTitle")}
            </h2>
            <p className="sub">{t("dashboard.settings.business.automationDesc")}</p>
          </div>
        </div>
        <div className="set-row">
          <div className="txt">
            <b>{t("dashboard.settings.business.notifyAccepted")}</b>
            <span>{t("dashboard.settings.business.notifyAcceptedHint")}</span>
          </div>
          <MockupToggle checked={notifyOnQuoteAccepted} onCheckedChange={setNotifyOnQuoteAccepted} label={t("dashboard.settings.business.notifyAccepted")} />
        </div>

        {/* Phase 4: invoice automation */}
        <div className="set-row">
          <div className="txt">
            <b>{t("dashboard.settings.business.autoSendInvoices")}</b>
            <span>{t("dashboard.settings.business.autoSendInvoicesHint")}</span>
          </div>
          <MockupToggle checked={autoSendInvoices} onCheckedChange={setAutoSendInvoices} label={t("dashboard.settings.business.autoSendInvoices")} />
        </div>
        {!autoSendInvoices && (
          <div className="set-row">
            <div className="txt">
              <b>{t("dashboard.settings.business.invoiceReviewWindow")}</b>
              <span>{t("dashboard.settings.business.invoiceReviewWindowHint")}</span>
            </div>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={invoiceAutoSendAfterHours}
              onChange={(e) => setInvoiceAutoSendAfterHours(Number(e.target.value))}
            >
              <option value={0}>{t("dashboard.settings.business.reviewNever")}</option>
              <option value={24}>24 h</option>
              <option value={48}>48 h</option>
              <option value={72}>72 h</option>
            </select>
          </div>
        )}
        <div className="set-row">
          <div className="txt">
            <b>{t("dashboard.settings.business.invoiceReminders")}</b>
            <span>{t("dashboard.settings.business.invoiceRemindersHint")}</span>
          </div>
          <MockupToggle checked={invoiceReminders} onCheckedChange={setInvoiceReminders} label={t("dashboard.settings.business.invoiceReminders")} />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn btn-navy gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("dashboard.settings.business.save")}
        </button>
      </div>
    </div>
  );
}
