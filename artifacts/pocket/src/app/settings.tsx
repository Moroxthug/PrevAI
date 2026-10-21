// Settings.dc.html. The hub: the assistant's voice, language, speaking and asking before sending; the company's pages (details, taxes, invoices, quotes,
// templates, messaging, widget); roles, connected apps, what the assistant can do, customize home; the quote defaults (province, deposit, valid for, materials
// markup, a copy to me); the notifications this person gets; display (light / dark / auto, units, text size); security (sign-in, Face ID, export my data);
// the plan and help. Every switch and stepper saves at once (rolled back, with a toast, when the server says no) and a search narrows the rows.
// Saved but not read yet by the rest of the app: nothing here is read by the quote or invoice makers except the quote defaults (valid for, markup, units,
// the copy, the deposit) which they already used. Face ID needs a module this build doesn't have (the row is there, off, and says so).
import { useMemo, useState, type ReactNode } from "react";
import { Linking, View } from "react-native";
import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetSubscription } from "@workspace/api-client-react";
import { ApiFailure, api } from "@/lib/api";
import { percent, shortDate, type Locale } from "@/lib/format";
import { PROVINCE } from "@/lib/province";
import { defaultsOf, netOf, scheduleOf, depositOf, withDeposit } from "@/lib/profile";
import { messagingApi } from "@/lib/messagingApi";
import { profileApi, type MemberPrefs } from "@/lib/profileApi";
import { screenHref } from "@/lib/nav";
import { fold } from "@/lib/search";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Search } from "@/ui/Search";
import { Hairline } from "@/ui/Card";
import { Screen } from "@/ui/Screen";
import { ChoiceList, SetGroup, SetRow, SetSegment, SetStepper, SetValue, SheetNote, VersionFoot, VoicePicker } from "@/ui/Settings";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Switch } from "@/ui/Switch";
import { useTheme } from "@/ui/theme";

type Row = { id: string; hay: string; node: (first: boolean) => ReactNode };
/** The kinds of push PrevAI sends (lib/config notifiche-push.ts), each with its row. */
const PUSH_ROWS: { kind: string; icon: "eye" | "check" | "funnel" | "chat" | "warn" | "cal"; tone: "indigo" | "sage" | "clay" | "sky" | "amber" | "teal" }[] = [
  { kind: "quote_viewed", icon: "eye", tone: "indigo" }, { kind: "quote_accepted", icon: "check", tone: "sage" }, { kind: "lead_new", icon: "funnel", tone: "clay" },
  { kind: "client_message", icon: "chat", tone: "sky" }, { kind: "field_blocker", icon: "warn", tone: "amber" }, { kind: "scadenza_fiscale", icon: "cal", tone: "teal" },
];
type Group = { key: string; title: string; rows: Row[]; voice?: ReactNode };

export default function Settings() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`st.${k}`, o) as string;
  const locale: Locale = "it-IT";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  // Weather data is shown on Home; where its source asks for a credit (Apple WeatherKit: the mark and the legal page), the same line is here (WEATHER.md).
  const wxAttribution = (client.getQueryData(["weather-today"]) as { data?: { attribution?: { legalUrl: string } | null } } | undefined)?.data?.attribution ?? null;
  const { profile, q, save, signedIn } = useProfile();
  const { isOwner } = useRole();
  const prefsQ = useQuery({ queryKey: ["member-prefs"], queryFn: profileApi.prefs, enabled: signedIn, retry: 1, staleTime: 60_000 });
  const pushQ = useQuery({ queryKey: ["push-preferences"], queryFn: profileApi.push, enabled: signedIn, retry: 1, staleTime: 60_000 });
  const fiscalQ = useQuery({ queryKey: ["fiscal-profile"], queryFn: profileApi.fiscal, enabled: signedIn, retry: 0, staleTime: 5 * 60_000 });
  const waQ = useQuery({ queryKey: ["wa-status"], queryFn: messagingApi.wa, enabled: signedIn, retry: 0, staleTime: 30_000 });
  const sub = useGetSubscription({ query: { enabled: signedIn, retry: false } } as never);
  const { appearance, setAppearance, textSize, setTextSize } = useTheme();
  const [term, setTerm] = useState("");
  const [provinceOpen, setProvinceOpen] = useState(false);

  const prefs: MemberPrefs = prefsQ.data?.preferences ?? {};
  const muted = new Set(pushQ.data?.muted ?? []);
  const canEdit = isOwner;

  const savePrefs = async (p: MemberPrefs) => {
    const before = client.getQueryData<{ preferences: MemberPrefs }>(["member-prefs"]);
    client.setQueryData(["member-prefs"], { preferences: { ...(before?.preferences ?? {}), ...p } });
    try { client.setQueryData(["member-prefs"], await profileApi.savePrefs(p)); }
    catch (e) { if (before) client.setQueryData(["member-prefs"], before); toast({ message: e instanceof ApiFailure && e.offline ? t("toast.offline") : t("toast.failed") }); }
  };
  const flipPush = async (category: string, on: boolean) => {
    const next = on ? [...muted].filter((c) => c !== category) : [...muted, category];
    const before = client.getQueryData(["push-preferences"]);
    client.setQueryData(["push-preferences"], { categories: pushQ.data?.categories ?? [], muted: next });
    try { client.setQueryData(["push-preferences"], await profileApi.savePush(next)); }
    catch (e) { client.setQueryData(["push-preferences"], before); toast({ message: e instanceof ApiFailure && e.offline ? t("toast.offline") : t("toast.failed") }); }
  };
  const saveProfile = async (patch: Parameters<typeof save>[0]) => {
    const r = await save(patch);
    if (!r.ok) toast({ message: r.status === 403 ? t("toast.noAccess") : r.status === 0 ? t("toast.offline") : t("toast.failed") });
    return r.ok;
  };

  if (status === "out") return <Redirect href="/" />;

  const loading = q.isPending && !profile;
  const failed = q.isError && !profile;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", t("back"))));
  const go = (name: string, label: string) => () => router.push(screenHref(name, label));
  const code = profile?.province ?? null;
  const provName = PROVINCE.find((x) => x.sigla === code)?.nome ?? "";
  // The forfettario charges no IVA; everyone else starts quotes at the ordinary 22 %.
  const regime = fiscalQ.data?.profilo.regime;
  const taxValue = regime === "forfettario" ? tr("stx.card.forfettario") : regime ? `IVA ${percent(0.22, locale)}` : "";
  const defaults = defaultsOf(profile);
  const saveDefaults = (patch: Record<string, unknown>) => void saveProfile({ pocketSettings: { defaults: patch } });
  const schedule = scheduleOf(profile);
  const deposit = depositOf(schedule);
  const dep = (v: number) => {
    const s = withDeposit(schedule, v, t("deposit.term"));
    if (!s) { toast({ message: t("deposit.tooBig") }); return; }
    void saveProfile({ defaultPaymentSchedule: s });
  };
  const net = netOf(schedule);
  const netWord = t(`invoices.net.${net}`);
  const subscription = sub.data as { plan?: string | null; periodEnd?: string | null } | undefined;
  // PrevAI's plan ids (monthly_starter, monthly_pro, monthly_elite) by the name the site uses; with no renewal date, the name alone.
  const planName = subscription?.plan ? ({ monthly_starter: "Starter", monthly_pro: "Pro", monthly_elite: "Elite" } as Record<string, string>)[subscription.plan] ?? subscription.plan : null;
  const planSub = planName
    ? subscription?.periodEnd ? t("plan.sub", { plan: planName, date: shortDate(new Date(subscription.periodEnd), locale) }) : planName
    : t("plan.subNone");

  const sw = (id: string, icon: Parameters<typeof SetRow>[0]["icon"], tone: Parameters<typeof SetRow>[0]["tone"], label: string, sub: string, on: boolean, onChange: (v: boolean) => void, disabled?: boolean): Row => ({
    id, hay: `${label} ${sub}`, node: (first) => <SetRow first={first} icon={icon} tone={tone} label={label} sub={sub} control={<Switch value={on} onChange={onChange} label={label} disabled={disabled} />} />,
  });
  const link = (id: string, icon: Parameters<typeof SetRow>[0]["icon"], tone: Parameters<typeof SetRow>[0]["tone"], label: string, sub: string, value: string, onPress: () => void, mono?: boolean): Row => ({
    id, hay: `${label} ${sub} ${value}`, node: (first) => <SetRow first={first} icon={icon} tone={tone} label={label} sub={sub} onPress={onPress} control={<SetValue value={value} mono={mono} chevron />} />,
  });
  const stepper = (id: string, icon: Parameters<typeof SetRow>[0]["icon"], tone: Parameters<typeof SetRow>[0]["tone"], label: string, sub: string, value: string, dec: () => void, inc: () => void, decLabel: string, incLabel: string, canDec: boolean, canInc: boolean): Row => ({
    id, hay: `${label} ${sub}`, node: (first) => <SetRow first={first} icon={icon} tone={tone} label={label} sub={sub} control={<SetStepper value={value} onDec={dec} onInc={inc} decLabel={decLabel} incLabel={incLabel} canDec={canDec} canInc={canInc} disabled={!canEdit} />} />,
  });
  const seg = (id: string, icon: Parameters<typeof SetRow>[0]["icon"], tone: Parameters<typeof SetRow>[0]["tone"], label: string, sub: string, options: string[], value: number, onChange: (i: number) => void, disabled?: boolean, labels?: string[]): Row => ({
    id, hay: `${label} ${sub}`, node: (first) => <SetRow first={first} icon={icon} tone={tone} label={label} sub={sub} below={<SetSegment options={options} value={value} onChange={onChange} label={label} labels={labels} disabled={disabled} />} />,
  });

  const groups: Group[] = [
    {
      key: "assistant", title: t("g.assistant"), voice: (
        <VoicePicker icon="wave" tone="violet" label={t("voice.label")} sub={t(`voice.${prefs.voice ?? "ember"}`)} group={t("voice.group")} voices={(["ember", "tide", "stone"] as const).map((id) => ({ id, name: t(`voice.${id}`) }))}
          value={prefs.voice ?? "ember"} onChange={(v) => void savePrefs({ voice: v })} />
      ),
      rows: [
        sw("speak", "speaker", "lilac", t("speak.label"), t("speak.sub"), prefs.speak ?? true, (v) => void savePrefs({ speak: v })),
        sw("confirm", "shield", "indigo", t("confirm.label"), t("confirm.sub"), prefs.confirmSend ?? true, (v) => void savePrefs({ confirmSend: v })),
      ],
    },
    {
      key: "company", title: t("g.company"), rows: [
        link("company", "building", "violet", t("company.label"), t("company.sub"), "", go("SetCompany", t("company.label"))),
        link("taxes", "percent", "azure", t("taxes.label"), "", taxValue, go("SetTaxes", t("taxes.label"))),
        link("invoices", "receipt", "amber", t("invoices.label"), t("invoices.sub"), String(netWord), go("SetInvoices", t("invoices.label"))),
        link("quotes", "doc", "indigo", t("quotes.label"), t("quotes.sub"), "", go("SetQuotes", t("quotes.label"))),
        link("templates", "chat", "sky", t("templates.label"), t("templates.sub"), "", go("MessageTemplates", t("templates.label"))),
        link("messaging", "mail", "teal", t("messaging.label"), "", t(waQ.data?.connected ? "messaging.on" : "messaging.off"), go("SetMessaging", t("messaging.label"))),
        link("widget", "code", "clay", t("widget.label"), t("widget.sub"), "", go("SetWidget", t("widget.label"))),
      ],
    },
    {
      key: "team", title: t("g.team"), rows: [
        link("roles", "users", "sage", t("roles.label"), t("roles.sub"), "", go("SetRoles", t("roles.label"))),
        link("apps", "sync", "clay", t("apps.label"), t("apps.sub"), "", go("Integrations", t("apps.label"))),
        link("assistantRow", "orb", "violet", t("assistantRow.label"), t("assistantRow.sub"), "", go("AssistantPermissions", t("assistantRow.label"))),
        link("home", "tier3", "indigo", t("home.label"), t("home.sub"), "", go("CustomizeHome", t("home.label"))),
      ],
    },
    {
      key: "quote", title: t("g.quote"), rows: [
        link("province", "pin", "clay", t("province.label"), t("province.sub"), provName, () => canEdit && setProvinceOpen(true)),
        stepper("dep", "percent", "amber", t("deposit.label"), t("deposit.sub"), percent(deposit / 100, locale), () => dep(Math.max(0, deposit - 5)), () => dep(Math.min(50, deposit + 5)), t("deposit.dec"), t("deposit.inc"), deposit > 0, deposit < 50),
        stepper("valid", "clock", "teal", t("valid.label"), t("valid.sub"), t("valid.unit", { count: defaults.validDays }), () => saveDefaults({ validDays: Math.max(5, defaults.validDays - 5) }), () => saveDefaults({ validDays: Math.min(90, defaults.validDays + 5) }), t("valid.dec"), t("valid.inc"), defaults.validDays > 5, defaults.validDays < 90),
        stepper("markup", "tag", "lilac", t("markup.label"), t("markup.sub"), percent(defaults.markup / 100, locale), () => saveDefaults({ markup: Math.max(0, defaults.markup - 1) }), () => saveDefaults({ markup: Math.min(40, defaults.markup + 1) }), t("markup.dec"), t("markup.inc"), defaults.markup > 0, defaults.markup < 40),
        sw("copy", "mail", "sky", t("copy.label"), t("copy.sub"), defaults.copyToMe, (v) => saveDefaults({ copyToMe: v }), !canEdit),
      ],
    },
    {
      key: "notifications", title: t("g.notifications"), rows: [
        ...PUSH_ROWS.filter((r) => pushQ.data?.categories.includes(r.kind) ?? true).map((r) => sw(r.kind, r.icon, r.tone, t(`n.${r.kind}.label`), t(`n.${r.kind}.sub`), !muted.has(r.kind), (v) => void flipPush(r.kind, v))),
      ],
    },
    {
      key: "display", title: t("g.display"), rows: [
        seg("appearance", "moon", "slate", t("display.appearance.label"), t("display.appearance.sub"), [t("display.appearance.light"), t("display.appearance.dark"), t("display.appearance.auto")], appearance === "light" ? 0 : appearance === "dark" ? 1 : 2, (i) => setAppearance(i === 0 ? "light" : i === 1 ? "dark" : "auto")),
        seg("size", "text", "azure", t("display.size.label"), t("display.size.sub"), ["A", "A", "A"], textSize, (i) => setTextSize(i as 0 | 1 | 2), false, [t("display.size.small"), t("display.size.normal"), t("display.size.large")]),
      ],
    },
    {
      key: "security", title: t("g.security"), rows: [
        link("security", "lock", "slate", t("security.label"), t("security.sub"), "", go("SetSecurity", t("security.label"))),
        sw("faceid", "face", "slate", t("faceId.label"), t("faceId.sub"), false, () => toast({ message: t("faceId.soon") })),
        {
          id: "export", hay: `${t("export.label")} ${t("export.sub")}`,
          // PrevAI asks for the password before an export: Sign-in and security has the sheet for it.
          node: (first) => <SetRow first={first} icon="export" tone="stone" label={t("export.label")} sub={t("export.sub")} control={<SetValue value="" chevron />} onPress={go("SetSecurity", t("security.label"))} />,
        },
      ],
    },
    {
      key: "account", title: t("g.account"), rows: [
        link("plan", "tier3", "violet", t("plan.label"), planSub, "", go("SetPlan", t("plan.label"))),
        link("help", "help", "stone", t("help.label"), t("help.sub"), "", go("HelpCentre", t("help.label"))),
      ],
    },
  ];

  const shown = useMemo(() => {
    const w = term.trim();
    if (!w) return groups.map((g) => ({ ...g, voiceShown: !!g.voice }));
    return groups
      .map((g) => ({ ...g, rows: g.rows.filter((r) => fold(`${g.title} ${r.hay}`).includes(fold(w))), voiceShown: !!g.voice && fold(`${g.title} ${t("voice.label")} ${t("voice.group")}`).includes(fold(w)) }))
      .filter((g) => g.rows.length > 0 || g.voiceShown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, groups.length, profile, prefs.voice, prefs.speak, prefs.confirmSend, pushQ.data, appearance, textSize, planSub, taxValue, waQ.data?.connected]);

  const version = Constants.expoConfig?.version ?? "1.0";
  const build = String(Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber ?? "1");

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={40}>
        <Section px={20} pt={2}><PageTitle>{t("title")}</PageTitle></Section>
        <Section delay={40} px={16} pt={14}><Search label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={term} onChangeText={setTerm} autoCorrect={false} autoCapitalize="none" /></Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={26} px={16} gap={14}><Skeleton height={260} radius={22} /><Skeleton height={300} radius={22} /></Section>
        ) : (
          <>
            {!canEdit ? <Section pt={14} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("viewOnly.lead")}>{t("viewOnly.body")}</Banner></Section> : null}
            {shown.map((g, gi) => (
              <Section key={g.key} delay={80 + gi * 60}>
                <SetGroup title={g.title}>
                  {g.voiceShown ? g.voice : null}
                  {g.voiceShown && g.rows.length ? <Hairline inset={58} /> : null}
                  {g.rows.map((r, i) => <View key={r.id}>{r.node(i === 0)}</View>)}
                </SetGroup>
              </Section>
            ))}
            {shown.length === 0 ? <Section pt={40} px={20}><Empty icon="search" iconTone="slate" title={t("noMatch", { q: term.trim() })} body="" /></Section> : null}
            <Section delay={420} pt={44} px={16}>
              <VersionFoot version={t("version", { version, build })} links={[
                { label: t("terms"), onPress: () => void Linking.openURL("https://prevai.it/termini") },
                { label: t("privacy"), onPress: () => void Linking.openURL("https://prevai.it/privacy") },
                { label: t("licences"), onPress: go("Licences", t("licences")) },
                ...(wxAttribution ? [{ label: tr("wx.attribution.legal") as string, onPress: () => void Linking.openURL(wxAttribution.legalUrl) }] : []),
              ]} />
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={provinceOpen} onClose={() => setProvinceOpen(false)} label={t("province.sheet")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={4}>
          <SheetTitle>{t("province.sheet")}</SheetTitle>
          <SheetNote>{t("province.sheetSub")}</SheetNote>
          <ChoiceList chosen={code} items={PROVINCE.map((c) => ({ id: c.sigla, name: c.nome, sub: `${c.sigla} · ${c.regione}` }))} onPick={(c) => { setProvinceOpen(false); void saveProfile({ province: c }); }} />
        </Stack>
      </Sheet>
    </Screen>
  );
}
