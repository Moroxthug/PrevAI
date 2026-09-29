import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { SettingsGroup, SettingsRow, SettingsSection, ToggleRow, useSettingsDraft } from "./ui";
import { changed, isUrl, orNull, useBusinessProfile, useSaveBusinessProfile } from "./data";

type AutoDraft = {
  notifyOnQuoteAccepted: boolean;
  autoSendInvoices: boolean;
  invoiceAutoSendAfterHours: number;
  invoiceReminders: boolean;
  scheduleReminders: boolean;
  googleReviewUrl: string;
  secondaryReviewUrl: string;
  sendReviewRequests: boolean;
};

const AUTOMATION_KEYS = ["notifyOnQuoteAccepted", "autoSendInvoices", "invoiceAutoSendAfterHours", "invoiceReminders", "scheduleReminders"] as const;

/** Vendere → Automazioni e recensioni: cosa PrevAI fa da solo dopo un sì, una fattura, un lavoro finito. */
export function AutomationsSection() {
  const { t } = useLanguage();
  const { data: profile, isLoading } = useBusinessProfile();
  const saveProfile = useSaveBusinessProfile();
  const source = useMemo<AutoDraft | undefined>(() => profile && {
    notifyOnQuoteAccepted: profile.automationSettings?.notifyOnQuoteAccepted ?? true,
    autoSendInvoices: profile.automationSettings?.autoSendInvoices ?? false,
    invoiceAutoSendAfterHours: profile.automationSettings?.invoiceAutoSendAfterHours ?? 0,
    invoiceReminders: profile.automationSettings?.invoiceReminders ?? true,
    scheduleReminders: (profile.automationSettings as { scheduleReminders?: boolean } | undefined)?.scheduleReminders ?? true,
    googleReviewUrl: profile.googleReviewUrl ?? "",
    secondaryReviewUrl: profile.secondaryReviewUrl ?? "",
    sendReviewRequests: profile.sendReviewRequests ?? true,
  }, [profile]);

  const urlError = (s: string) => (s.trim() && !isUrl(s.trim()) ? "Inserisci un indirizzo completo, che inizi con https://" : null);
  const { draft, set } = useSettingsDraft<AutoDraft>(
    source,
    async (d, s) => {
      const diff = changed(d, s);
      const body: Record<string, unknown> = {};
      const automation: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(diff)) {
        if ((AUTOMATION_KEYS as readonly string[]).includes(k)) automation[k] = v;
        else if (k === "googleReviewUrl" || k === "secondaryReviewUrl") body[k] = orNull(v as string);
        else body[k] = v;
      }
      if (Object.keys(automation).length) body.automationSettings = automation;
      await saveProfile(body);
    },
    (d) => !urlError(d.googleReviewUrl) && !urlError(d.secondaryReviewUrl),
  );

  return (
    <SettingsSection title="Automazioni e recensioni" intro={t("dashboard.settings.business.automationDesc")}>
      {isLoading || !draft ? (
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      ) : (
        <>
          <SettingsGroup title={t("dashboard.settings.business.automationTitle")}>
            <ToggleRow label={t("dashboard.settings.business.notifyAccepted")} help={t("dashboard.settings.business.notifyAcceptedHint")} checked={draft.notifyOnQuoteAccepted} onChange={(v) => set("notifyOnQuoteAccepted", v)} />
            <ToggleRow label={t("dashboard.settings.business.autoSendInvoices")} help={t("dashboard.settings.business.autoSendInvoicesHint")} checked={draft.autoSendInvoices} onChange={(v) => set("autoSendInvoices", v)} />
            {!draft.autoSendInvoices && (
              <SettingsRow label={t("dashboard.settings.business.invoiceReviewWindow")} help={t("dashboard.settings.business.invoiceReviewWindowHint")} htmlFor="s-auto-window">
                <select id="s-auto-window" value={draft.invoiceAutoSendAfterHours} onChange={(e) => set("invoiceAutoSendAfterHours", Number(e.target.value))}>
                  <option value={0}>{t("dashboard.settings.business.reviewNever")}</option>
                  <option value={24}>24 h</option>
                  <option value={48}>48 h</option>
                  <option value={72}>72 h</option>
                </select>
              </SettingsRow>
            )}
            <ToggleRow label={t("dashboard.settings.business.invoiceReminders")} help={t("dashboard.settings.business.invoiceRemindersHint")} checked={draft.invoiceReminders} onChange={(v) => set("invoiceReminders", v)} />
            <ToggleRow label={t("dashboard.settings.business.scheduleReminders")} help={t("dashboard.settings.business.scheduleRemindersHint")} checked={draft.scheduleReminders} onChange={(v) => set("scheduleReminders", v)} />
          </SettingsGroup>
          <SettingsGroup title={t("dashboard.settings.business.reviewsTitle")} desc={t("dashboard.settings.business.reviewsDesc")}>
            <SettingsRow label={t("dashboard.settings.business.googleReviewUrl")} help={t("dashboard.settings.business.googleReviewUrlHint")} htmlFor="s-auto-google" error={urlError(draft.googleReviewUrl)}>
              <input id="s-auto-google" type="url" inputMode="url" value={draft.googleReviewUrl} onChange={(e) => set("googleReviewUrl", e.target.value)} placeholder="https://g.page/r/.../review" aria-invalid={!!urlError(draft.googleReviewUrl)} />
            </SettingsRow>
            <SettingsRow label={t("dashboard.settings.business.secondaryReviewUrl")} help={t("dashboard.settings.business.secondaryReviewUrlHint")} htmlFor="s-auto-second" error={urlError(draft.secondaryReviewUrl)}>
              <input id="s-auto-second" type="url" inputMode="url" value={draft.secondaryReviewUrl} onChange={(e) => set("secondaryReviewUrl", e.target.value)} placeholder="https://..." aria-invalid={!!urlError(draft.secondaryReviewUrl)} />
            </SettingsRow>
            <ToggleRow label={t("dashboard.settings.business.sendReviewRequests")} help={t("dashboard.settings.business.sendReviewRequestsHint")} checked={draft.sendReviewRequests} disabled={!draft.googleReviewUrl.trim()} onChange={(v) => set("sendReviewRequests", v)} />
          </SettingsGroup>
        </>
      )}
    </SettingsSection>
  );
}
