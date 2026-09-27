import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor";
import type { PaymentSchedule } from "@/lib/payment-schedule";
import { SettingsGroup, SettingsSection, useSettingsDraft } from "./ui";
import { useBusinessProfile, useSaveBusinessProfile } from "./data";

export const DEFAULT_SCHEDULE: PaymentSchedule = {
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

type ScheduleDraft = { schedule: PaymentSchedule };

/** Vendere → Rate di pagamento: lo schema da cui parte ogni nuovo preventivo. */
export function PaymentsSection() {
  const { t } = useLanguage();
  const { data: profile, isLoading } = useBusinessProfile();
  const saveProfile = useSaveBusinessProfile();
  const source = useMemo<ScheduleDraft | undefined>(() => profile && { schedule: profile.defaultPaymentSchedule ?? DEFAULT_SCHEDULE }, [profile]);
  const { draft, set } = useSettingsDraft<ScheduleDraft>(source, async (d) => {
    await saveProfile({ defaultPaymentSchedule: d.schedule });
  });

  return (
    <SettingsSection title="Rate di pagamento" intro={t("dashboard.settings.business.scheduleDesc")}>
      {isLoading || !draft ? (
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      ) : (
        <SettingsGroup title={t("dashboard.settings.business.scheduleTitle")}>
          <div className="sgroup-pad">
            <PaymentScheduleEditor value={draft.schedule} onChange={(s) => set("schedule", s)} total={0} />
          </div>
        </SettingsGroup>
      )}
    </SettingsSection>
  );
}
