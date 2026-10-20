// SetMessaging.dc.html. Messages to clients, leads and crew: the number card with the month's WhatsApp quotes, the texts, WhatsApp (connect with a code, disconnect)
// and quiet hours. States: default, WhatsApp not connected, view only, loading and can't load.
// PrevAI has no texts (SMS): quotes, reminders and follow-ups go out by email, so the number reads "Not active" and the text group is one row that says so; the board's
// test text, opt-outs (STOP) and message log are about texts and are not on this screen. WhatsApp is the contractor's own line to PrevAI (a voice note or a message
// comes back as a quote), not a channel to clients, so "Use it when clients prefer it" and the WhatsApp templates are not here either. The quiet hours are saved on
// the profile but no sender reads them yet (the times are the board's 9 pm to 8 am).
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { number as num, shortDate, time, type Locale } from "@/lib/format";
import { waNumber } from "@/lib/messaging";
import { messagingApi } from "@/lib/messagingApi";
import { meterOf } from "@/lib/plan";
import { extraPage } from "@/lib/profile";
import { screenHref } from "@/lib/nav";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { NumberCard } from "@/ui/Messaging";
import { PlanMeter } from "@/ui/Plan";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { SetButton, SetField, SetGroup, SetRow, SetValue, SheetNote } from "@/ui/Settings";
import { InlineBanner, RowStatus, SetTitle } from "@/ui/SettingsPages";
import { Switch } from "@/ui/Switch";

type Step = "closed" | "number" | "code";

export default function SetMessaging() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sm.${k}`, o) as string;
  const locale: Locale = "it-IT";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const { isOwner, role } = useRole();
  const canEdit = isOwner || role === "admin";
  const { profile, save } = useProfile();
  const waQ = useQuery({ queryKey: ["wa-status"], queryFn: messagingApi.wa, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const usageQ = useQuery({ queryKey: ["wa-usage"], queryFn: messagingApi.waUsage, enabled: signedIn, retry: 0, staleTime: 30_000 });
  const [step, setStep] = useState<Step>("closed");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "out") return <Redirect href="/" />;

  const wa = waQ.data;
  const page = extraPage(profile, "messaging");
  const flag = (k: string, d: boolean) => (typeof page[k] === "boolean" ? (page[k] as boolean) : d);
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const resets = shortDate(nextMonth, locale);
  const n = (v: number) => num(v, locale);

  const fail = (e: unknown, fallback = "toast.failed") => toast({ message: e instanceof ApiFailure ? (e.status === 0 ? t("toast.offline") : e.status === 403 ? t("toast.noAccess") : t(fallback)) : t(fallback) });
  const savePage = async (p: Record<string, unknown>) => {
    const r = await save({ pocketSettings: { messaging: p } });
    if (!r.ok) toast({ message: r.status === 403 ? t("toast.noAccess") : r.status === 0 ? t("toast.offline") : t("toast.failed") });
  };

  const sendCode = async () => {
    const number = waNumber(phone);
    if (!number) { toast({ message: t("wa.badNumber") }); return; }
    setBusy(true);
    try { await messagingApi.waConnect(number); setPhone(number); setCode(""); setStep("code"); }
    catch (e) {
      const bad = e instanceof ApiFailure ? e : null;
      toast({ message: bad?.status === 503 ? t("wa.unavailable") : bad?.status === 409 ? t("wa.taken") : bad?.status === 403 ? t("wa.planOnly") : bad?.status === 400 ? t("wa.badNumber") : bad?.status === 0 ? t("toast.offline") : t("toast.failed") });
    }
    setBusy(false);
  };
  const verify = async () => {
    setBusy(true);
    try { await messagingApi.waVerify(phone, code.trim()); setStep("closed"); toast({ message: t("wa.connected") }); await client.invalidateQueries({ queryKey: ["wa-status"] }); }
    catch (e) {
      const bad = e instanceof ApiFailure ? e : null;
      toast({ message: bad?.status === 0 ? t("toast.offline") : /scadut|expired/i.test(bad?.message ?? "") ? t("wa.expired") : bad?.status === 400 ? t("wa.badCode") : t("toast.failed") });
    }
    setBusy(false);
  };
  const disconnect = async () => {
    try { await messagingApi.waDisconnect(); toast({ message: t("wa.disconnected") }); await client.invalidateQueries({ queryKey: ["wa-status"] }); } catch (e) { fail(e); }
  };

  const loading = waQ.isPending && !wa;
  const failed = waQ.isError && !wa;
  const waOn = !!wa?.connected;
  const use = usageQ.data;
  const waMeter = waOn && use && use.limit ? { ...meterOf({ used: use.used, limit: use.limit }), used: use.used, limit: use.limit } : null;
  const meters = waMeter ? [<PlanMeter key="w" label={t("meters.wa")} used={n(waMeter.used)} total={n(waMeter.limit)} of={t("of")} value={waMeter.value} level={waMeter.level} sub={waMeter.level === "full" ? t("meters.usedUp", { date: resets }) : t("meters.resets", { date: resets })} />] : [];
  const day = (h: number) => time(new Date(2026, 0, 1, h, 0), locale);

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={t("lede")} />
        {!canEdit && wa ? <InlineBanner><Banner tone="info" icon="lock" iconTone="slate" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></InlineBanner> : null}
        {wa ? <InlineBanner><Banner tone="info" icon="chat" iconTone="sky" lead={t("unavailable.lead")}>{t("unavailable.body")}</Banner></InlineBanner> : null}

        {loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={190} radius={22} /><Skeleton height={200} radius={22} /></Section>
        ) : failed || !wa ? (
          <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void waQ.refetch()} />
        ) : (
          <>
            <Section delay={40} pt={18} px={16}>
              <NumberCard label={t("number.label")} number={t("number.none")} sub={profile?.companyName ?? ""} state={<RowStatus tone="mute" shape="off">{t("number.off")}</RowStatus>}>{meters}</NumberCard>
            </Section>

            <Section delay={80}>
              <SetGroup title={t("texts.title")}>
                <SetRow first icon="chat" tone="sky" label={t("texts.sms.label")} sub={t("texts.sms.sub")} control={<RowStatus tone="mute" shape="off">{t("number.none")}</RowStatus>} />
              </SetGroup>
            </Section>

            <Section delay={130}>
              <SetGroup title={t("wa.title")} foot={waOn ? undefined : t("wa.foot")}>
                {waOn ? (
                  <>
                    <SetRow first icon="chat" tone="sage" label={t("wa.label")} sub={t("wa.subOn", { phone: wa.phoneNumber ?? "" })} control={<RowStatus tone="ok" shape="check">{t("wa.on")}</RowStatus>} />
                    <SetRow icon="link" tone="slate" label={t("wa.disconnect.label")} sub={t("wa.disconnect.sub")} control={<SetButton label={t("wa.disconnect.button")} onPress={() => void disconnect()} disabled={!canEdit} />} />
                  </>
                ) : (
                  <>
                    <SetRow first icon="chat" tone="sage" label={t("wa.label")} sub={wa.available ? t("wa.subOff") : t("wa.unavailable")} control={<RowStatus tone="mute" shape="off">{t("wa.off")}</RowStatus>} />
                    {wa.available ? <SetRow icon="phone" tone="violet" label={t("wa.connect.label")} sub={t("wa.connect.sub")} control={<SetButton kind="primary" label={t("wa.connect.button")} onPress={() => { setStep("number"); setPhone(""); setCode(""); }} disabled={!canEdit} />} /> : null}
                  </>
                )}
              </SetGroup>
            </Section>

            <Section delay={210}>
              <SetGroup title={t("quiet.title")}>
                <SetRow first icon="moon" tone="indigo" label={t("quiet.label")} sub={t("quiet.sub")} control={<Switch value={flag("quiet", true)} onChange={(v) => void savePage({ quiet: v })} label={t("quiet.label")} disabled={!canEdit} />} />
                <SetRow icon="clock" tone="slate" label={t("quiet.from")} sub={t("quiet.fromSub")} control={<SetValue value={day(21)} mono />} />
                <SetRow icon="sun" tone="amber" label={t("quiet.until")} sub={t("quiet.untilSub")} control={<SetValue value={day(8)} mono />} />
              </SetGroup>
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={step !== "closed"} onClose={() => setStep("closed")} label={t("wa.sheet.title")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t("wa.sheet.title")}</SheetTitle>
          {step === "number" ? (
            <>
              <SheetNote>{t("wa.sheet.numberSub")}</SheetNote>
              <SetField first icon="phone" tone="violet" label={t("wa.sheet.number")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" mono />
              <Button size="lg" block label={t("wa.sheet.send")} disabled={busy || !waNumber(phone)} onPress={() => void sendCode()} />
            </>
          ) : (
            <>
              <SheetNote>{t("wa.sheet.codeSub", { phone })}</SheetNote>
              <SetField first icon="shield" tone="indigo" label={t("wa.sheet.code")} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" mono />
              <Button size="lg" block label={t("wa.sheet.verify")} disabled={busy || code.trim().length < 6} onPress={() => void verify()} />
              <Button kind="secondary" size="md" block label={t("wa.sheet.back")} onPress={() => setStep("number")} />
            </>
          )}
        </Stack>
      </Sheet>
    </Screen>
  );
}
