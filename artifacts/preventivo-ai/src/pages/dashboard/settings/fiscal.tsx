import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { PROVINCE_SELECT } from "@/lib/payment-schedule";
import { SettingsGroup, SettingsRow, SettingsSection, useSettingsDraft } from "./ui";
import { changed, orNull, useBusinessProfile, useSaveBusinessProfile } from "./data";

type FiscalDraft = { province: string; codiceFiscale: string; codiceSdi: string; reaNumber: string; iban: string };

/** Impresa → Dati fiscali e bancari: provincia, codice fiscale, SDI, REA e l'IBAN su cui ti pagano. */
export function FiscalSection() {
  const { t } = useLanguage();
  const { data: profile, isLoading } = useBusinessProfile();
  const saveProfile = useSaveBusinessProfile();
  const source = useMemo<FiscalDraft | undefined>(() => profile && {
    province: profile.province ?? "",
    codiceFiscale: profile.codiceFiscale ?? "",
    codiceSdi: profile.codiceSdi ?? "",
    reaNumber: profile.reaNumber ?? "",
    iban: profile.iban ?? "",
  }, [profile]);

  const { draft, set } = useSettingsDraft<FiscalDraft>(source, async (d, s) => {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(changed(d, s))) body[k] = orNull(v as string);
    await saveProfile(body);
  });

  return (
    <SettingsSection title="Dati fiscali e bancari" intro={t("dashboard.settings.business.identityDesc")}>
      {isLoading || !draft ? (
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      ) : (
        <>
          <SettingsGroup title={t("dashboard.settings.business.identityTitle")}>
            <SettingsRow label={t("dashboard.settings.business.province")} htmlFor="s-fisc-province">
              <select id="s-fisc-province" value={draft.province} onChange={(e) => set("province", e.target.value)}>
                <option value="">{t("dashboard.settings.business.provinceSelect")}</option>
                {PROVINCE_SELECT.map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </SettingsRow>
            <SettingsRow label={t("dashboard.settings.business.codiceFiscale")} htmlFor="s-fisc-cf">
              <input id="s-fisc-cf" value={draft.codiceFiscale} onChange={(e) => set("codiceFiscale", e.target.value)} placeholder="RSSMRA80A01F205X" maxLength={16} autoCapitalize="characters" />
            </SettingsRow>
            <SettingsRow label={t("dashboard.settings.business.codiceSdi")} htmlFor="s-fisc-sdi">
              <input id="s-fisc-sdi" value={draft.codiceSdi} onChange={(e) => set("codiceSdi", e.target.value)} placeholder="ABCDEFG oppure PEC" />
            </SettingsRow>
            <SettingsRow label={t("dashboard.settings.business.rea")} help={t("dashboard.settings.business.reaHint")} htmlFor="s-fisc-rea">
              <input id="s-fisc-rea" value={draft.reaNumber} onChange={(e) => set("reaNumber", e.target.value)} placeholder={t("dashboard.settings.business.reaPlaceholder")} />
            </SettingsRow>
          </SettingsGroup>
          <SettingsGroup title={t("dashboard.settings.business.paymentsTitle")} desc={t("dashboard.settings.business.paymentsDesc")}>
            <SettingsRow label={t("dashboard.settings.business.iban")} help={t("dashboard.settings.business.ibanHint")} htmlFor="s-fisc-iban">
              <input id="s-fisc-iban" value={draft.iban} onChange={(e) => set("iban", e.target.value)} placeholder="IT60X0542811101000000123456" maxLength={34} autoCapitalize="characters" autoComplete="off" />
            </SettingsRow>
          </SettingsGroup>
        </>
      )}
    </SettingsSection>
  );
}
