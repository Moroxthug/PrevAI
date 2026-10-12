// Group.dc.html. Companies that belong together: the switcher (all of them, or one), the month's four figures (work between the companies left
// out), invoiced by month, the companies and who is in the group. Non c'è, per ora: una sola fattura per tutte, il listino condiviso e le persone che
// lavorano per due imprese (toccano piani e fatturazione: decisioni del titolare ancora aperte).
// States: default, locked (the plan has no groups), plus what the board leaves to the web: no group yet, an invitation waiting, loading, can't load, offline.
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { ApiFailure } from "@/lib/api";
import { money, monthLong, number, percent, type Locale } from "@/lib/format";
import {
  activeCompanies, leftOut, monthBars, monthFigures, previousMonth, shortNames, shownMonth,
} from "@/lib/group";
import { groupApi } from "@/lib/groupApi";
import { planName } from "@/lib/inventory";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Card, Hairline } from "@/ui/Card";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header, PageTitle } from "@/ui/Header";
import { Icon, type Tone } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { AddRow, BarKey, CompanyRow, FeatureRow, KpiGrid2, LockedHero, ScopeOption, ScopeSwitch, SharedRow, SheetNote, StackRow } from "@/ui/Group";
import { SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Tag } from "@/ui/Status";
import { Text } from "@/ui/Text";
import type { ColorName } from "@/ui/theme";

const TONES: Tone[] = ["violet", "teal", "amber", "sky"];
const BAR_COLORS: ColorName[] = ["inv", "acc", "ok-dot", "warn-dot"];

export default function Group() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`gp.${k}`, o) as string;
  const locale: Locale = "it-IT";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const profile = useGetBusinessProfile({ query: { enabled: signedIn, retry: false } } as never);
  const g = useQuery({ queryKey: ["group"], queryFn: groupApi.get, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const inGroup = !!g.data?.group && g.data.group.self.status === "active";
  const ov = useQuery({ queryKey: ["group-overview"], queryFn: groupApi.overview, enabled: inGroup, retry: false, staleTime: 15_000 });

  const [scope, setScope] = useState<string>("all");
  const [switchOpen, setSwitchOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "out") return <Redirect href="/" />;

  const m0 = (cents: number) => money(cents / 100, locale, { cents: false });
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", tr("menu.back"))));
  const toPlans = () => router.push(screenHref("SetPlan", t("locked.soon")));
  const loading = g.isPending && !g.data;
  const failed = g.isError && !g.data;
  const data = g.data;
  const group = data?.group ?? null;
  const locked = !!data && !data.available;
  const fail = (e: unknown) => toast({ message: e instanceof ApiFailure && e.status === 403 ? t("noAccess") : t("failed") });
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ["group"] }), client.invalidateQueries({ queryKey: ["group-overview"] })]); };
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try { await fn(); await refresh(); if (done) toast({ message: done }); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const head = <Header title="" backLabel={t("back")} onBack={back} moreLabel={t("more")} />;
  const title = <Section px={20} pt={4}><PageTitle>{t("title")}</PageTitle></Section>;

  // ── Locked: the plan has no groups ────────────────────────────────────────
  if (locked) {
    const plan = planName(data.requiredPlan || "monthly_elite");
    const company = (profile.data as { companyName?: string; province?: string } | undefined) ?? {};
    return (
      <Screen>{head}
        <ScrollPage bottom={50}>
          {title}
          <Section delay={40} pt={18} px={16}>
            <Card>
              <Stack px={20} pt={26} pb={20} align="center">
                <LockedHero title={t("locked.title")} body={t("locked.body")} tag={<Tag accent>{t("locked.tag", { plan })}</Tag>} />
                <Stack mt={18} gap={0} align="stretch"><Hairline inset={0} />
                  <FeatureRow icon="bars" tone="violet" label={t("locked.feats.money")} />
                  <FeatureRow icon="users" tone="teal" label={t("locked.feats.between")} />
                </Stack>
              </Stack>
            </Card>
          </Section>
          <Section delay={80} pt={12} px={16}>
            <Card accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: 0.4 }}>
              <Stack row align="center" gap={12} px={16} pt={14} pb={14}>
                <Icon name="building" tone="violet" size={26} />
                <Stack grow gap={2}>
                  <Text size={14.5} weight={500} numberOfLines={1}>{company.companyName || ""}</Text>
                  <Text size={12.5} color="muted">{t("locked.thisCompany", { province: company.province ?? "" })}</Text>
                </Stack>
                <Skeleton width={64} height={14} />
              </Stack>
              <Stack row align="center" gap={12} px={16} pt={14} pb={14}>
                <Icon name="building" tone="slate" size={26} />
                <Stack grow gap={2}>
                  <Text size={14.5} weight={500}>{t("locked.second")}</Text>
                  <Text size={12.5} color="muted">{t("locked.secondSub", { plan })}</Text>
                </Stack>
                <Skeleton width={64} height={14} />
              </Stack>
            </Card>
          </Section>
          <Section delay={120} pt={16} px={16} gap={10}>
            <Banner tone="info" icon="help" iconTone="sky" lead={t("locked.bannerLead")}>{t("locked.bannerBody")}</Banner>
            <Button label={t("locked.plans")} onPress={toPlans} block />
          </Section>
        </ScrollPage>
      </Screen>
    );
  }

  // ── Loading, can't load ───────────────────────────────────────────────────
  if (failed || loading) {
    return (
      <Screen>{head}
        <ScrollPage bottom={50}>
          {title}
          {failed ? (
            <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void g.refetch()} /></Section>
          ) : (
            <Section pt={16} px={16} gap={14}><Skeleton height={70} radius={22} /><Skeleton height={170} radius={22} /><Skeleton height={150} radius={22} /><Skeleton height={190} radius={22} /></Section>
          )}
        </ScrollPage>
      </Screen>
    );
  }

  // ── Not in a group yet, or invited to one ─────────────────────────────────
  if (!group || group.self.status === "pending") {
    const inviter = group ? group.companies.find((c) => c.isManager)?.companyName ?? "" : "";
    return (
      <Screen>{head}
        <ScrollPage bottom={50}>
          {title}
          {group ? (
            <Section delay={40} pt={18} px={16} gap={12}>
              <Banner tone="info" icon="users" iconTone="indigo" lead={t("invite.lead", { name: inviter, group: group.name })} />
              <Stack row gap={8}>
                <Stack grow><Button label={t("invite.join")} busy={busy ? t("invite.join") : false} block onPress={() => void run(groupApi.accept, t("invite.joined"))} /></Stack>
                <Stack grow><Button kind="secondary" label={t("invite.decline")} block onPress={() => void run(groupApi.decline, t("invite.declined"))} /></Stack>
              </Stack>
            </Section>
          ) : (
            <Section delay={40} pt={18} px={16}>
              <Card><Empty icon="tier4" title={t("start.title")} body={t("start.body")} action={data?.canDecide ? t("start.action") : undefined} onAction={() => setStarting(true)} /></Card>
            </Section>
          )}
        </ScrollPage>
        <Sheet open={starting} onClose={() => setStarting(false)} label={t("start.title")} closeLabel={t("close")}>
          <Stack px={16} pb={30} gap={12}>
            <SheetTitle>{t("start.title")}</SheetTitle>
            <TextField label={t("start.name")} value={groupName} onChangeText={setGroupName} autoCapitalize="words" />
            <Button label={t("start.save")} disabled={!groupName.trim()} busy={busy ? t("start.save") : false} block onPress={() => void run(async () => { await groupApi.start(groupName.trim()); setStarting(false); })} />
          </Stack>
        </Sheet>
      </Screen>
    );
  }

  // ── In a group ────────────────────────────────────────────────────────────
  const o = ov.data;
  const month = o ? shownMonth(o) : null;
  const companies = group.companies;
  const names = shortNames(companies.map((c) => c.companyName));
  const short = new Map(companies.map((c, i) => [c.orgId, names[i]!]));
  const index = new Map(companies.map((c, i) => [c.orgId, i]));
  const active = activeCompanies(group);
  const scopeCo = scope === "all" ? null : companies.find((c) => c.orgId === scope) ?? null;
  const scopeName = scopeCo ? scopeCo.companyName : t("scope.all");
  const mDate = month ? new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1) : new Date();
  const prevName = month ? new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(Number(previousMonth(month).slice(0, 4)), Number(previousMonth(month).slice(5)) - 1, 1)) : "";
  const fig = o && month ? monthFigures(o, scope, month) : null;
  const out = o && month && scope === "all" ? leftOut(o, month) : null;
  const bars = o ? monthBars(o, scope, 3) : null;
  const monthShort = (m: string) => new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1));
  const keyItems = (scope === "all" ? active : active.filter((c) => c.orgId === scope)).map((c) => ({ name: short.get(c.orgId)!, color: BAR_COLORS[(index.get(c.orgId) ?? 0) % BAR_COLORS.length]! }));

  const me = companies.find((c) => c.isCurrent);
  const candidates = data?.candidates ?? [];
  const canChange = data?.canDecide ?? false;

  const addCompany = () => {
    if (!canChange) { toast({ message: t("noAccess") }); return; }
    if (candidates.length === 0) { toast({ message: t("companies.addNone") }); return; }
    setAdding(true);
  };
  const invite = async (orgId: string, name: string) => { setAdding(false); await run(() => groupApi.invite(orgId), t("companies.invitedToast", { name })); };
  const leave = async () => {
    if (!me) return;
    setLeaving(false);
    await run(async () => { await groupApi.leave(me.orgId); setScope("all"); }, t("leave.left"));
  };

  return (
    <Screen>{head}
      <ScrollPage bottom={50}>
        {title}
        {g.isError || ov.isError ? (
          <Section pt={12} px={16}>
            {ov.error instanceof ApiFailure && ov.error.status === 403 ? <Banner tone="info" icon="eye" iconTone="sky" lead={t("denied")} /> : <Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body")}</Banner>}
          </Section>
        ) : null}

        <Section delay={40} pt={16} px={16}>
          <ScopeSwitch icon={scope === "all" ? "grid" : "building"} tone={scope === "all" ? "violet" : TONES[(index.get(scope) ?? 0) % TONES.length]!} label={t("scope.showing")} name={scopeName} open={switchOpen} onToggle={() => setSwitchOpen(!switchOpen)}>
            <ScopeOption icon="grid" tone="violet" name={t("scope.all")} sub={t("scope.allSub", { count: active.length })} on={scope === "all"} onPress={() => { setScope("all"); setSwitchOpen(false); }} />
            {active.map((c) => (
              <ScopeOption key={c.orgId} icon="building" tone={TONES[(index.get(c.orgId) ?? 0) % TONES.length]!} name={c.companyName} sub={c.province ?? ""} on={scope === c.orgId} onPress={() => { setScope(c.orgId); setSwitchOpen(false); }} />
            ))}
          </ScopeSwitch>
        </Section>

        {ov.isPending && inGroup ? (
          <Section pt={20} px={16} gap={14}><Skeleton height={150} radius={22} /><Skeleton height={130} radius={22} /></Section>
        ) : fig && o ? (
          <>
            <Section delay={70} pt={20} px={16}>
              <SectionHeader title={monthLong(mDate, locale)} link={out != null ? t("month.left", { amount: m0(out) }) : scope === "all" ? undefined : t("month.only")} />
              <KpiGrid2 items={[
                { label: t("kpi.invoiced"), value: m0(fig.invoicedCents), sub: fig.change == null ? "" : Math.abs(fig.change) < 0.5 ? t("kpi.same", { month: prevName }) : t(fig.change > 0 ? "kpi.up" : "kpi.down", { pct: percent(Math.abs(fig.change) / 100, locale), month: prevName }), subTone: fig.change == null ? "muted" : fig.change > 0.5 ? "ok" : fig.change < -0.5 ? "bad" : "muted" },
                { label: t("kpi.costs"), value: m0(fig.costCents), sub: t("kpi.costsSub") },
                { label: t("kpi.margin"), value: fig.marginPercent == null ? "–" : percent(fig.marginPercent / 100, locale, 1), sub: fig.profitCents >= 0 ? t("kpi.profit", { amount: m0(fig.profitCents) }) : t("kpi.loss", { amount: m0(-fig.profitCents) }), subTone: fig.profitCents >= 0 ? "ok" : "bad" },
                { label: t("kpi.owed"), value: m0(fig.outstandingCents), sub: fig.overdueCents > 0 ? t("kpi.overdue", { amount: m0(fig.overdueCents) }) : t("kpi.none"), subTone: fig.overdueCents > 0 ? "bad" : "muted" },
              ]} />
            </Section>

            {bars && bars.bars.length ? (
              <Section delay={90} pt={20} px={16}>
                <SectionHeader title={t("bars.title")} />
                <Stack row justify="flex-end" pb={8}><BarKey items={keyItems} /></Stack>
                <Card padded>
                  <Stack gap={12}>
                    {bars.bars.map((b) => (
                      <StackRow key={b.month} month={monthShort(b.month)} total={m0(b.totalCents)} label={`${monthShort(b.month)}, ${m0(b.totalCents)}`}
                        parts={b.parts.map((p) => ({ width: (p.cents / bars.max) * 100, color: BAR_COLORS[(index.get(p.orgId) ?? 0) % BAR_COLORS.length]! }))} />
                    ))}
                  </Stack>
                </Card>
              </Section>
            ) : null}
          </>
        ) : null}

        <Section delay={110} pt={22} px={16}>
          <SectionHeader title={t("companies.title")} link={t("companies.count", { count: companies.length })} />
          <Card>
            {companies.map((c, i) => {
              const hidden = o?.excluded.some((x) => x.orgId === c.orgId);
              const oc = o?.companies.find((x) => x.orgId === c.orgId);
              const f = o && month && oc ? monthFigures(o, c.orgId, month) : null;
              const tone = TONES[i % TONES.length]!;
              if (c.status === "pending") return <CompanyRow key={c.orgId} first={i === 0} icon="building" tone={tone} name={c.companyName} sub={t("companies.invited")} />;
              if (hidden || !oc) return <CompanyRow key={c.orgId} first={i === 0} icon="building" tone={tone} name={c.companyName} sub={hidden ? t("companies.hiddenSub") : c.province ?? ""} note={hidden ? t("companies.hidden") : undefined} />;
              return (
                <CompanyRow key={c.orgId} first={i === 0} icon="building" tone={tone} name={c.companyName} sub={t("companies.sub", { province: c.province ?? "", jobs: t("companies.jobs", { count: oc.activeJobs }) })}
                  figure={f ? m0(f.invoicedCents) : undefined} note={f?.marginPercent != null ? t("companies.margin", { pct: percent(f.marginPercent / 100, locale, 1) }) : undefined}
                  onPress={() => setScope(c.orgId)} />
              );
            })}
            {data?.canManage ? <AddRow label={t("companies.add")} sub={t("companies.addSub")} onPress={addCompany} /> : null}
          </Card>
        </Section>

        <Section delay={130} pt={22} px={16}>
          <SectionHeader title={t("shared.title")} />
          <Card>
            <SharedRow first icon="users" tone="indigo" title={t("shared.members")} sub={t("shared.membersSub")}
              onPress={() => router.push(screenHref("Team", t("shared.members")))} />
          </Card>
        </Section>

        {canChange && me ? (
          <Section delay={170} pt={22} px={16}><Button kind="secondary" label={t("leave.button")} block onPress={() => setLeaving(true)} /></Section>
        ) : null}
      </ScrollPage>

      <Sheet open={adding} onClose={() => setAdding(false)} label={t("companies.pickTitle")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t("companies.pickTitle")}</SheetTitle>
          <SheetNote>{t("companies.pickSub")}</SheetNote>
          <Card>
            {candidates.map((c) => <ScopeOption key={c.orgId} icon="building" tone="slate" name={c.companyName} sub="" on={false} onPress={() => void invite(c.orgId, c.companyName)} />)}
          </Card>
        </Stack>
      </Sheet>
      <Sheet open={leaving} onClose={() => setLeaving(false)} label={t("leave.title")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t("leave.title")}</SheetTitle>
          <SheetNote>{t("leave.body", { name: me?.companyName ?? "" })}</SheetNote>
          <Button kind="destructive" label={t("leave.confirm")} block onPress={() => void leave()} />
          <Button kind="secondary" label={t("cancel")} block onPress={() => setLeaving(false)} />
        </Stack>
      </Sheet>
    </Screen>
  );
}
