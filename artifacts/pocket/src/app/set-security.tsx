// SetSecurity.dc.html. Sign-in and security: the password (a link by email), Face ID, the second step, where this person is signed in (the others can be signed out,
// one by one or all), what they did lately, "Export my data" (PrevAI asks for the password first, in a sheet) and "Delete account" (the password and the word ELIMINA;
// the account closes in 30 days, and while it waits "Cancel deletion" is on the banner, as PrevAI's DELETE /api/account/deletion allows).
// States: default, two-step off, view only, loading and can't load.
// Not true to the board: "Last changed" for the password (the server doesn't keep it), "Send codes by Text / Authenticator" (the server's second step is the authenticator app
// only), Face ID (not in this build), the city and phone name of a device (the server keeps the browser and system only), and a code with the deletion (PrevAI's
// deletion asks for the password and the word only).
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiFailure } from "@/lib/api";
import { auth } from "@/lib/auth";
import { dateWithYear, number as num, shortDate, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { activityOf, agentParts, deleteReady, othersFirst, type Device } from "@/lib/security";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { SetButton, SetField, SetGroup, SetRow, SetValue, SheetNote } from "@/ui/Settings";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { InlineBanner, RowStatus, SetTitle } from "@/ui/SettingsPages";
import { DeleteForm, DeleteIntro } from "@/ui/Security";
import { Switch } from "@/ui/Switch";

/** GET /api/account/deletion: this person's own request and the owner's, when they work in someone else's company. */
type Deletion = { available: boolean; graceDays: number; ownsOrg: boolean; own: { scheduledFor: string } | null; org: { scheduledFor: string } | null };
/** GET /api/account/export: the owner's exports (`stato`: in_preparazione, pronta, scaduta, fallita). */
type Exports = { available: boolean; canExport: boolean; nextAllowedAt: string | null; exports: { id: string; stato: string; totalBytes: number | null; expiresAt: string | null; parts: { n: number }[] }[] };
type AuditEvent = { id: string; action: string; actorId: string | null; userAgent: string | null; createdAt: string };

export default function SetSecurity() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sy.${k}`, o) as string;
  const locale: Locale = "it-IT";
  const { status, user, signOut } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const { isOwner, role } = useRole();
  const devicesQ = useQuery({ queryKey: ["auth-devices"], queryFn: async () => { const r = await auth.devices(); if (!r.ok) throw new Error(r.problem); return r.data; }, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const deletionQ = useQuery({ queryKey: ["account-deletion"], queryFn: () => api<Deletion>("/api/account/deletion"), enabled: signedIn, retry: 1, staleTime: 30_000 });
  const exportsQ = useQuery({ queryKey: ["account-export"], queryFn: () => api<Exports>("/api/account/export"), enabled: signedIn, retry: 1, staleTime: 30_000 });
  const profileQ = useProfile();
  const auditQ = useQuery({ queryKey: ["audit-mine"], queryFn: () => api<{ events: AuditEvent[] }>("/api/security/audit-log"), enabled: signedIn, retry: 0, staleTime: 60_000 });
  const [lastOut, setLastOut] = useState("");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState("");

  if (status === "out") return <Redirect href="/" />;

  const dev = devicesQ.data;
  const del = deletionQ.data;
  const exp = exportsQ.data;
  const twoStep = !!dev?.twoStep;
  const loading = devicesQ.isPending && !dev;
  const failed = devicesQ.isError && !dev;
  const canEdit = isOwner || role === "admin";
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const word = t("del.word");
  const days = del?.graceDays ?? 30;

  const nameOf = (d: Device) => {
    const p = agentParts(d.agent);
    if (!p) return t("devices.unknown");
    return p.browser && p.system ? t("devices.on", { browser: p.browser, system: p.system }) : p.browser || p.system;
  };
  const agoOf = (iso: string) => {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "";
    const mins = Math.max(0, Math.round((Date.now() - at.getTime()) / 60_000));
    if (mins < 1) return t("devices.when.now");
    if (mins < 60) return t("devices.when.min", { count: mins });
    if (mins < 24 * 60) return t("devices.when.hour", { count: Math.round(mins / 60) });
    return dateWithYear(at, new Date(), locale);
  };

  const signOutOne = async (d: Device) => {
    const r = await auth.revokeDevice(d.token);
    if (!r.ok) { toast({ message: r.problem === "offline" ? t("toast.offline") : t("toast.failed") }); return; }
    setLastOut(nameOf(d));
    void client.invalidateQueries({ queryKey: ["auth-devices"] });
  };
  const signOutAll = async () => {
    const r = await auth.revokeOthers();
    if (!r.ok) { toast({ message: r.problem === "offline" ? t("toast.offline") : t("toast.failed") }); return; }
    setLastOut(t("devices.everyone"));
    void client.invalidateQueries({ queryKey: ["auth-devices"] });
  };

  const latest = exp?.exports[0];
  const ready = latest?.stato === "pronta" && (latest.parts.length ?? 0) > 0;
  const onExport = async () => {
    if (!exportPassword) return;
    setExporting(true);
    try {
      await api("/api/account/export", { method: "POST", body: { password: exportPassword } });
      setExportOpen(false); setExportPassword("");
      toast({ message: t("toast.exportSent") });
      await client.invalidateQueries({ queryKey: ["account-export"] });
    } catch (e) {
      const bad = e instanceof ApiFailure ? e : null;
      toast({ message: bad?.code === "wrong_password" ? t("data.badPassword") : bad?.status === 429 ? t("data.limited") : bad?.code === "owner_only" ? t("data.ownerOnly") : bad?.status === 503 ? t("data.unavailable") : bad?.status === 0 ? t("toast.offline") : t("toast.failed") });
    }
    setExporting(false);
  };
  /** The first part of a ready export: the server answers with a short-lived link. */
  const download = async () => {
    if (!latest) return;
    try { const r = await api<{ url: string }>(`/api/account/export/${encodeURIComponent(latest.id)}/parts/1`); void Linking.openURL(r.url); }
    catch (e) { toast({ message: e instanceof ApiFailure && e.status === 0 ? t("toast.offline") : t("toast.failed") }); }
  };

  const onDelete = async () => {
    if (!deleteReady(typed, password, false, "", word)) return;
    setBusy(true);
    try {
      const r = await api<{ own: { scheduledFor: string } }>("/api/account/deletion", { method: "POST", body: { password, confirm: "ELIMINA" } });
      toast({ message: t("del.scheduled", { date: shortDate(new Date(r.own.scheduledFor), locale) }) });
      setOpen(false); setTyped(""); setPassword("");
      await client.invalidateQueries({ queryKey: ["account-deletion"] });
    } catch (e) {
      const bad = e instanceof ApiFailure ? e : null;
      toast({ message: bad?.code === "wrong_password" ? t("del.badPassword") : bad?.code === "blocked" ? `${t("del.blocked")} ${bad.message}` : bad?.status === 503 ? t("del.unavailable") : bad?.status === 0 ? t("toast.offline") : t("toast.failed") });
    }
    setBusy(false);
  };
  const cancelDeletion = async () => {
    try { await api("/api/account/deletion", { method: "DELETE" }); toast({ message: t("closing.cancelled") }); await client.invalidateQueries({ queryKey: ["account-deletion"] }); }
    catch (e) { toast({ message: e instanceof ApiFailure && e.status === 0 ? t("toast.offline") : t("toast.failed") }); }
  };

  const activity = user ? activityOf(auditQ.data?.events ?? [], user.id) : [];
  const others = dev ? othersFirst(dev.items) : [];
  const here = dev?.items.find((d) => d.here);
  const pending = del?.own ?? del?.org ?? null;
  const closesOn = pending ? shortDate(new Date(pending.scheduledFor), locale) : "";
  const exportSize = latest?.totalBytes ? `${num(Math.max(1, Math.round(latest.totalBytes / 1_048_576)), locale)} MB` : "";

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={t("lede", { name: user?.name ?? "", email: user?.email ?? "" })} />
        {!canEdit && !loading ? <InlineBanner><Banner tone="info" icon="lock" iconTone="slate" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></InlineBanner> : null}
        {closesOn ? <InlineBanner><Banner tone="bad" icon="warn" iconTone="rose" lead={t("closing.lead", { date: closesOn })} link={del?.own ? t("closing.cancel") : undefined} onLink={() => void cancelDeletion()}>{t("closing.body")}</Banner></InlineBanner> : null}
        {dev && !twoStep ? <InlineBanner><Banner tone="warn" icon="shield" iconTone="amber" lead={t("twoOff.lead")} link={t("twoOff.link")} onLink={() => router.push(screenHref("SetTwoStep", t("sign.setup.label")))}>{t("twoOff.body")}</Banner></InlineBanner> : null}

        {loading ? (
          <Section pt={16} px={16} gap={14}><Skeleton height={200} radius={22} /><Skeleton height={160} radius={22} /></Section>
        ) : failed ? (
          <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void devicesQ.refetch()} />
        ) : (
          <>
            <Section delay={60}>
              <SetGroup title={t("sign.title")}>
                <SetRow first icon="key" tone="violet" label={t("sign.password.label")} sub={t("sign.password.sub")} control={<SetValue value={t("sign.password.value")} chevron />} onPress={() => router.push({ pathname: "/forgot-password", params: { email: user?.email ?? "" } })} />
                <SetRow icon="face" tone="slate" label={t("sign.face.label")} sub={t("sign.face.sub")} control={<Switch value={false} onChange={() => toast({ message: t("sign.face.soon") })} label={t("sign.face.label")} />} />
                <SetRow icon="shield" tone="indigo" label={t("sign.two.label")} sub={twoStep ? t("sign.two.on") : t("sign.two.off")} control={<RowStatus tone={twoStep ? "ok" : "warn"} shape={twoStep ? "check" : "alert"}>{twoStep ? t("sign.two.onWord") : t("sign.two.offWord")}</RowStatus>} />
                {twoStep
                  ? <SetRow icon="list" tone="stone" label={t("sign.backup.label")} sub={t("sign.backup.sub")} control={<SetValue value="" chevron />} onPress={() => router.push(screenHref("SetTwoStep", t("sign.backup.label")))} />
                  : <SetRow icon="shield" tone="amber" label={t("sign.setup.label")} sub={t("sign.setup.sub")} control={<SetValue value="" chevron />} onPress={() => router.push(screenHref("SetTwoStep", t("sign.setup.label")))} />}
              </SetGroup>
            </Section>

            <Section delay={120}>
              <SetGroup title={t("devices.title")} foot={lastOut ? t("devices.footOut", { what: lastOut }) : t("devices.foot")}>
                <SetRow first icon="phone" tone="violet" label={t("devices.here")} sub={here && agentParts(here.agent) ? nameOf(here) : t("devices.hereSub")} control={<RowStatus tone="ok" shape="live">{t("devices.active")}</RowStatus>} />
                {others.map((d) => <SetRow key={d.token} icon="globe" tone="azure" label={nameOf(d)} sub={agoOf(d.at)} control={<SetButton label={t("devices.signOut")} onPress={() => void signOutOne(d)} />} />)}
              </SetGroup>
              <Stack px={16} pt={10}><Button kind="secondary" size="md" block disabled={others.length === 0} label={others.length === 0 ? t("devices.only") : t("devices.all")} onPress={() => void signOutAll()} /></Stack>
            </Section>

            {activity.length ? (
              <Section delay={180}>
                <SetGroup title={t("activity.title")}>
                  {activity.map((a, i) => {
                    const p = agentParts(a.agent);
                    return <SetRow key={a.id} first={i === 0} icon={a.kind === "login" ? "globe" : a.kind === "twoOn" || a.kind === "twoOff" ? "shield" : "key"} tone={a.kind === "login" ? "azure" : "indigo"} label={t(`activity.${a.kind}`)} sub={p ? [p.browser, p.system].filter(Boolean).join(" · ") : t("activity.here")} control={<SetValue value={shortDate(new Date(a.at), locale)} mono />} />;
                  })}
                </SetGroup>
              </Section>
            ) : null}

            <Section delay={240}>
              <SetGroup title={t("data.title")} foot={t("data.foot")}>
                {ready && latest
                  ? <SetRow first icon="export" tone="sage" label={t("data.ready")} sub={t("data.readySub", { size: exportSize, date: latest.expiresAt ? shortDate(new Date(latest.expiresAt), locale) : "" })} control={<SetButton kind="primary" label={t("data.download")} onPress={() => void download()} />} />
                  : exporting || latest?.stato === "in_preparazione"
                    ? <SetRow first icon="export" tone="stone" label={t("data.label")} sub={t("data.prep")} control={<RowStatus tone="info" shape="q1">{t("data.prepWord")}</RowStatus>} />
                    : <SetRow first icon="export" tone="stone" label={t("data.label")} sub={latest?.stato === "fallita" ? t("data.failed") : exp && !exp.available ? t("data.unavailable") : !exp?.canExport ? t("data.ownerOnly") : t("data.sub")} control={<SetButton label={t("data.button")} onPress={() => setExportOpen(true)} disabled={!exp?.canExport} />} />}
              </SetGroup>
            </Section>

            {isOwner ? (
              <Section delay={300}>
                <SetGroup title={t("del.title")}>
                  <DeleteIntro body={t("del.body", { company: profileQ.profile?.companyName ?? "" })} steps={tr("sy.del.grace", { returnObjects: true, days, date: closesOn || shortDate(new Date(Date.now() + days * 86_400_000), locale) }) as unknown as { t: string; s: string }[]}
                    openLabel={open ? undefined : t("del.open")} onOpen={() => setOpen(true)} />
                  {open ? (
                    <DeleteForm keep={t("del.keep")} go={t("del.go", { days })} canGo={deleteReady(typed, password, false, "", word) && !busy && del?.available !== false}
                      onKeep={() => { setOpen(false); setTyped(""); setPassword(""); }} onGo={() => void onDelete()}>
                      <SetField first icon="key" tone="violet" label={t("del.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" />
                      <SetField icon="warn" tone="clay" label={t("del.type", { word })} value={typed} onChangeText={setTyped} placeholder={word} autoCapitalize="characters" autoCorrect={false} mono />
                    </DeleteForm>
                  ) : null}
                </SetGroup>
              </Section>
            ) : null}
          </>
        )}
      </ScrollPage>

      <Sheet open={exportOpen} onClose={() => { setExportOpen(false); setExportPassword(""); }} label={t("data.label")} closeLabel={t("data.cancel")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t("data.label")}</SheetTitle>
          <SheetNote>{t("data.passwordSub")}</SheetNote>
          <SetGroup first>
            <SetField first icon="key" tone="violet" label={t("data.password")} value={exportPassword} onChangeText={setExportPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" />
          </SetGroup>
          <Button size="lg" block label={t("data.go")} disabled={!exportPassword || exporting} busy={exporting ? t("data.prepWord") : false} onPress={() => void onExport()} />
        </Stack>
      </Sheet>
    </Screen>
  );
}
