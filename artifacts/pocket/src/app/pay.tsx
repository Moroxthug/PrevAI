// Pay.dc.html (QuoteAI 127.2): ore e costo del lavoro. Tre schede: il periodo (stato, esportazione, cosa va guardato, totali, dipendenti, collaboratori
// esterni), il costo per cantiere e le regole (frequenza, straordinario, codici dipendente). Legge /api/pay/*; non è un motore di paghe.
// Non c'è: festività, ferie, trasferte e diaria (PrevAI non li ha) e i formati dei programmi di paghe (c'è un solo CSV, per il consulente del lavoro).
import { useMemo, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { jobsApi } from "@/lib/jobsApi";
import { dateRange, money, number, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import {
  burdenPercent, burdenShare, canGoNext, dayAt, employeeFlag, firstNames, frequencyOptions, hoursFrom, hourlyRate, jobCards, labourTotal, lineQty, multiplierFrom, periodStatus, premiumPercent,
  totalsOf, warnings, withCodes, withFrequency, withMultiplier, withOvertimeFrom, type PayFrequency, type RawSettings,
} from "@/lib/pay";
import { payApi } from "@/lib/payApi";
import { exportPayPeriod } from "@/lib/payExport";
import { teamApi } from "@/lib/teamApi";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { AffixField, TextField } from "@/ui/Field";
import { Header, PageTitle } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { EmployeeCard, JobCard, KpiPair, NoteRow, PeriodCard, TotalsCard, ValueRow } from "@/ui/Pay";
import { MenuList, MenuRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Tabs } from "@/ui/Tabs";
import { Num, Text } from "@/ui/Text";

const TAB_KEYS = ["period", "jobs", "rules"] as const;
type Edit = "starts" | "premium" | "codes" | null;

export default function Pay() {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`py.${k}`, o) as string;
  const locale: Locale = "it-IT";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";
  const profile = useGetBusinessProfile({ query: { enabled: signedIn, retry: false } } as never);
  const company = (profile.data as { companyName?: string } | undefined)?.companyName ?? "";

  const [tab, setTab] = useState(0);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState<Edit>(null);
  const [draft, setDraft] = useState("");
  const [codes, setCodes] = useState<Record<string, string> | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  const settingsQ = useQuery({ queryKey: ["pay-settings"], queryFn: payApi.settings, enabled: signedIn, retry: 1 });
  const settings = settingsQ.data ?? null;
  const forbidden = settingsQ.error instanceof ApiFailure && settingsQ.error.status === 403;
  const periodQ = useQuery({ queryKey: ["pay-period", date ?? "default"], queryFn: () => payApi.period(date), enabled: signedIn && !!settings, retry: 1 });
  const workersQ = useQuery({ queryKey: ["team-workers"], queryFn: teamApi.workers, enabled: signedIn && !!settings, retry: 1 });
  const entriesQ = useQuery({ queryKey: ["team-entries"], queryFn: () => teamApi.entries("submitted"), enabled: signedIn && !!settings, retry: 1 });
  const jobsQ = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: signedIn && !!settings && tab === 1, retry: 0 });
  const report = periodQ.data;
  const workers = workersQ.data?.items ?? [];

  const refresh = () => { for (const k of ["pay-settings", "pay-period", "team-workers", "team-entries"]) void client.invalidateQueries({ queryKey: [k] }); };
  const back = () => (router.canGoBack() ? router.back() : router.replace("/menu"));
  const toTeam = () => router.push(screenHref("Team", t("menu.rows.crew.label") as string));
  const failed = !forbidden && ((settingsQ.isError && !settingsQ.data) || (periodQ.isError && !periodQ.data && !!settings));
  const loading = !failed && !forbidden && ((settingsQ.isPending && !settingsQ.data) || (!!settings && periodQ.isPending && !periodQ.data));
  const ready = !!settings && !!report && !failed;

  const save = async (body: RawSettings, undo?: RawSettings) => {
    setBusy("save");
    try {
      const r = await payApi.saveSettings(body);
      client.setQueryData(["pay-settings"], r);
      void client.invalidateQueries({ queryKey: ["pay-period"] });
      toast(undo ? { message: m("rules.saved"), action: m("undo"), onAction: () => { void payApi.saveSettings(undo).then((u) => { client.setQueryData(["pay-settings"], u); void client.invalidateQueries({ queryKey: ["pay-period"] }); toast({ message: m("rules.undone") }); }).catch(() => toast({ message: m("rules.failed") })); } } : { message: m("rules.saved") });
      return true;
    } catch { toast({ message: m("rules.failed") }); return false; } finally { setBusy(null); }
  };

  const doExport = async () => {
    if (!report) return;
    setBusy("export");
    try {
      const name = await exportPayPeriod(report.period.start);
      setExported(report.period.start);
      toast({ message: m("export.done", { name }) });
      void client.invalidateQueries({ queryKey: ["pay-period"] });
    } catch { toast({ message: m("export.failed") }); } finally { setBusy(null); }
  };

  const openEdit = (e: Exclude<Edit, null>) => {
    if (!settings) return;
    const eff = settings.effective;
    setInvalid(false);
    if (e === "starts") setDraft(eff.overtimeWeeklyHours != null ? String(eff.overtimeWeeklyHours) : "");
    if (e === "premium") setDraft(String(premiumPercent(eff.overtimeMultiplier)));
    if (e === "codes") setCodes({ ...eff.payrollCodes });
    setEdit(e);
  };
  const saveEdit = async () => {
    if (!settings || !edit) return;
    const raw = settings.settings;
    let next: RawSettings | null = null;
    if (edit === "starts") { const h = draft.trim() === "" ? null : hoursFrom(draft); if (draft.trim() !== "" && h == null) return setInvalid(true); next = withOvertimeFrom(raw, h); }
    if (edit === "premium") { const x = multiplierFrom(draft); if (x == null) return setInvalid(true); next = withMultiplier(raw, x); }
    if (edit === "codes" && codes) next = withCodes(raw, codes);
    if (next && (await save(next, raw))) setEdit(null);
  };

  // ── Il periodo ──
  const status3 = report ? periodStatus(report) : null;
  const totals = report ? totalsOf(report) : null;
  const pendingNames = useMemo(() => {
    if (!report) return [] as string[];
    const rows = (entriesQ.data?.items ?? []).filter((e) => e.date.slice(0, 10) >= report.period.start && e.date.slice(0, 10) <= report.period.end);
    return firstNames(rows.map((e) => e.workerName ?? ""));
  }, [report, entriesQ.data]);
  const list = useMemo(() => (report ? warnings(report, { pendingNames }) : []), [report, pendingNames]);
  const roleOf = (id: string) => workers.find((w) => w.id === id)?.role ?? "";

  const warnRow = (w: ReturnType<typeof warnings>[number]) => {
    const names = firstNames(w.names).join(", ");
    if (w.key === "approve") return <NoteRow key="approve" icon="clock" tone="amber" title={m("warn.approve.title", { count: w.count })} sub={names ? m("warn.approve.sub", { names, hours: number(w.hours ?? 0, locale, 1) }) : m("warn.approve.subNoNames", { hours: number(w.hours ?? 0, locale, 1) })} tag={{ tone: "warn", label: m("warn.approve.tag") }} onPress={toTeam} />;
    if (w.key === "changed") return <NoteRow key="changed" icon="sync" tone="clay" title={m("warn.changed.title", { count: w.count })} sub={m("warn.changed.sub", { names })} tag={{ tone: "warn", label: m("warn.changed.tag") }} />;
    if (w.key === "payroll") return <NoteRow key="payroll" icon="user" tone="rose" title={m("warn.payroll.title", { count: w.count, names })} sub={m("warn.payroll.sub")} tag={{ tone: "bad", label: m("warn.payroll.tag") }} onPress={() => openEdit("codes")} />;
    return <NoteRow key="rate" icon="user" tone="rose" title={m("warn.rate.title", { count: w.count, names })} sub={m("warn.rate.sub")} tag={{ tone: "bad", label: m("warn.rate.tag") }} onPress={toTeam} />;
  };

  const periodTab = () => {
    if (!report || !settings || !status3 || !totals) return null;
    const eff = report.settings;
    const share = burdenShare(totals);
    return (
      <>
        <Section pt={16} px={16} delay={0}>
          <PeriodCard label={dateRange(dayAt(report.period.start), dayAt(report.period.end), locale)} sub={m(`period.freq.${eff.frequency}`)}
            prevLabel={m("period.prev")} nextLabel={m("period.next")} canPrev onPrev={() => setDate(report.previousStart)} canNext={canGoNext(report)} onNext={() => setDate(report.nextStart)}
            status={status3.kind === "exported" ? { tone: "ok", shape: "check", label: m("period.status.exported", { date: shortDate(new Date(status3.at), locale) }) } : status3.kind === "ready" ? { tone: "acc", shape: "q2", label: m("period.status.ready") } : { tone: "mute", shape: "draft", label: m("period.status.progress") }}>
            <Button block label={status3.kind === "exported" ? m("export.again") : m("export.button")} busy={busy === "export" ? m("export.working") : false} disabled={report.employees.length === 0} onPress={() => void doExport()} />
          </PeriodCard>
        </Section>
        {exported === report.period.start ? (
          <Section pt={12} px={16}>
            <Banner tone="ok" icon="check" iconTone="sage" lead={m("export.banner")}>{m("export.bannerBody", { count: totals.employees, amount: money(totals.wages / 100, locale) })}</Banner>
          </Section>
        ) : null}

        <Section delay={60} pt={12} px={16}>
          <Card>
            <RowList>
              {list.length === 0
                ? [<NoteRow key="clear" icon="check" tone="sage" title={m("warn.clear.title")} sub={m("warn.clear.sub")} tag={{ tone: "ok", shape: "check", label: m("warn.clear.tag") }} />]
                : list.map(warnRow)}
            </RowList>
          </Card>
        </Section>

        <Section delay={100} pt={22} px={16}>
          <SectionHeader title={m("totals.title")} link={m("totals.link", { count: totals.employees })} />
          <TotalsCard items={[
            { label: m("totals.wages"), value: money(totals.wages / 100, locale), sub: m("totals.wagesSub") },
            { label: m("totals.hours"), value: number(totals.hours, locale, 1), sub: m("totals.hoursSub", { hours: number(totals.overtime, locale, 1) }) },
            { label: m("totals.burden"), value: money(totals.burden / 100, locale), sub: share != null ? m("totals.burdenSub", { pct: share }) : m("totals.burdenNone") },
            { label: m("totals.cost"), value: money(totals.cost / 100, locale), sub: m("totals.costSub") },
          ]} />
        </Section>

        <Section delay={140} pt={22} px={16}>
          <SectionHeader title={m("employees.title")} link={m("employees.link")} onLink={toTeam} />
          {report.employees.length === 0 ? (
            <Card><Empty icon="users" iconTone="azure" title={m("employees.emptyTitle")} body={m("employees.emptyBody")} /></Card>
          ) : (
            <Stack gap={10}>
              {report.employees.map((e) => {
                const rate = hourlyRate(e);
                const role = roleOf(e.workerId);
                const flag = employeeFlag(e);
                return (
                  <EmployeeCard key={e.workerId} initials={initialsOf(e.name)} tint={tintFor(e.name)} name={e.name}
                    role={rate != null ? (role ? m("employees.role", { role, rate: money(rate / 100, locale) }) : m("employees.rate", { rate: money(rate / 100, locale) })) : role}
                    gross={money(e.grossCents / 100, locale)} hours={`${number(e.hours, locale, 1)} h`} flag={flag ? m(`employees.flag.${flag}`) : undefined}
                    lines={e.lines.map((l, i) => {
                      const q = lineQty(l);
                      const qty = q.kind === "hours" ? m("employees.qty.hours", { hours: number(q.value, locale, 1), rate: money(q.rateCents / 100, locale) }) : "";
                      return { key: `${l.kind}${i}`, label: m(`employees.kind.${l.kind}`), qty, amount: money(l.amountCents / 100, locale) };
                    })} />
                );
              })}
            </Stack>
          )}
        </Section>

        {report.subcontractors.length > 0 ? (
          <Section delay={200} pt={22} px={16}>
            <SectionHeader title={m("subs.title")} link={m("subs.link")} />
            <Card>
              <RowList>
                {report.subcontractors.map((s) => {
                  const role = roleOf(s.workerId);
                  return (
                    <Stack key={s.workerId} row align="center" gap={12} px={16} pt={12} pb={12}>
                      <Icon name="user" tone="amber" size={28} />
                      <Stack grow gap={2}>
                        <Text size={14.5} weight={500}>{s.name}</Text>
                        <Text size={12.5} color="muted">{role ? m("subs.sub", { role, hours: number(s.hours, locale, 1) }) : m("subs.subHours", { hours: number(s.hours, locale, 1) })}</Text>
                      </Stack>
                      <Stack align="flex-end" gap={2}>
                        <Num size={14.5} weight={600}>{money(s.amountCents / 100, locale)}</Num>
                        <Text size={11.5} color="muted">{m("subs.bills")}</Text>
                      </Stack>
                    </Stack>
                  );
                })}
              </RowList>
            </Card>
          </Section>
        ) : null}
      </>
    );
  };

  // ── Costo per cantiere ──
  const jobsTab = () => {
    if (!report) return null;
    const cards = jobCards(report.jobs);
    const clientOf = (projectId: string | null) => jobsQ.data?.items.find((j) => j.id === projectId)?.clientName ?? "";
    const burden = burdenPercent(report.jobs);
    const whole = (c: number) => money(c / 100, locale, { cents: false });
    return (
      <>
        <Section pt={16} px={16}>
          <KpiPair items={[
            { label: m("jobs.labour"), value: whole(labourTotal(report.jobs)), sub: dateRange(dayAt(report.period.start), dayAt(report.period.end), locale) },
            { label: m("jobs.hours"), value: number(report.totals.hours, locale, 1), sub: m("jobs.overtime", { hours: number(report.totals.overtimeHours, locale, 1) }) },
          ]} />
        </Section>
        <Section delay={60} pt={20} px={16}>
          <SectionHeader title={m("jobs.byJob")} link={burden != null ? m("jobs.burden", { pct: burden }) : undefined} />
          {cards.length === 0 ? (
            <Card><Empty icon="house" iconTone="teal" title={m("jobs.emptyTitle")} body={m("jobs.emptyBody")} /></Card>
          ) : (
            <Stack gap={10}>
              {cards.map((j) => (
                <JobCard key={j.key} icon={j.projectId ? "house" : "truck"} tone={j.projectId ? "teal" : "slate"} name={j.name || m("jobs.noJob")} client={j.projectId ? clientOf(j.projectId) : ""}
                  cost={whole(j.totalCents)} share={j.share}
                  cells={[
                    { label: m("jobs.cells.hours"), value: number(j.hours, locale, 1) }, { label: m("jobs.cells.overtime"), value: number(j.overtimeHours, locale, 1) }, { label: m("jobs.cells.straight"), value: whole(j.straightCents) },
                    { label: m("jobs.cells.premium"), value: whole(j.premiumCents) }, { label: m("jobs.cells.burden"), value: whole(j.burdenCents) }, { label: m("jobs.cells.total"), value: whole(j.totalCents) },
                  ]} />
              ))}
            </Stack>
          )}
        </Section>
      </>
    );
  };

  // ── Regole ed esportazione ──
  const rulesTab = () => {
    if (!settings || !report) return null;
    const eff = settings.effective;
    const raw = settings.settings;
    const freqs = frequencyOptions();
    const employees = workers.filter((w) => w.active && w.workerType === "employee");
    const have = employees.filter((w) => eff.payrollCodes[w.id]?.trim()).length;
    const missing = employees.length - have;
    return (
      <>
        <Section pt={16} px={16}>
          <SectionHeader title={m("rules.frequency")} />
          <Card>
            <Stack pt={12} pb={12} px={12} gap={10}>
              <Segmented label={m("rules.frequency")} options={freqs.map((f) => m(`period.freq.${f}`))} value={freqs.indexOf(eff.frequency)}
                onChange={(i) => { const f = freqs[i] as PayFrequency; if (f !== eff.frequency) void save(withFrequency(raw, f), raw); }} />
              <Stack px={4}><Text size={12.5} color="muted">{m(`rules.freqNote.${eff.frequency}`)}</Text></Stack>
            </Stack>
          </Card>
        </Section>

        <Section delay={50} pt={22} px={16}>
          <SectionHeader title={m("rules.overtime")} />
          <Stack pb={10} px={4}><Text size={12.5} color="muted" leading={1.4}>{m("rules.otIntro")}</Text></Stack>
          <Card>
            <RowList>
              <ValueRow icon="clock" tone="amber" title={m("rules.otRows.starts")} sub="" value={eff.overtimeWeeklyHours != null ? m("rules.starts.weekly", { hours: number(eff.overtimeWeeklyHours, locale) }) : m("rules.starts.none")} onPress={() => openEdit("starts")} />
              <ValueRow icon="percent" tone="azure" title={m("rules.otRows.premium")} sub="" value={eff.overtimeWeeklyHours != null ? m("rules.premium.value", { pct: number(premiumPercent(eff.overtimeMultiplier), locale, 1) }) : m("rules.premium.none")} onPress={() => openEdit("premium")} />
            </RowList>
          </Card>
        </Section>

        <Section delay={100} pt={22} px={16}>
          <SectionHeader title={m("rules.exportTitle")} />
          <Card>
            <RowList>
              <ValueRow icon="export" tone="violet" title={m("rules.exportRows.to.label")} sub={m("rules.exportRows.to.sub")} onPress={() => void doExport()} />
              <ValueRow icon="users" tone="indigo" title={m("rules.exportRows.numbers.label")} sub={m("rules.exportRows.numbers.sub", { have, total: employees.length })}
                tag={missing > 0 ? { tone: "warn", label: m("rules.exportRows.numbers.tag", { count: missing }) } : undefined} onPress={() => openEdit("codes")} />
            </RowList>
          </Card>
        </Section>
      </>
    );
  };

  const editTitle = edit ? m(`rules.edit.${edit}.title`) : "";
  const activeEmployees = workers.filter((w) => w.active && w.workerType === "employee");

  return (
    <Screen>
      <Header title="" backLabel={m("back")} onBack={back} moreLabel={m("more")} onMore={ready ? () => setMenu(true) : undefined} />
      <ScrollPage bottom={48} sticky={ready ? [1] : undefined}>
        <Section px={20} gap={6} pb={14}>
          <PageTitle>{m("title")}</PageTitle>
          <Text size={13.5} color="muted">{company ? m("sub", { company }) : m("subNone")}</Text>
        </Section>
        {ready ? <Tabs tabs={TAB_KEYS.map((k) => m(`tabs.${k}`))} active={tab} onChange={setTab} /> : null}
        {forbidden ? (
          <Section pt={26} px={16}><Empty icon="card" iconTone="amber" title={m("locked.title")} body={m("locked.body")} /></Section>
        ) : failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={m("loadFailed.title")} body={m("loadFailed.body")} action={m("retry")} onAction={refresh} /></Section>
        ) : loading || !ready ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={150} radius={22} /><Skeleton height={190} radius={22} /><Skeleton height={140} radius={22} /></Section>
        ) : tab === 0 ? periodTab() : tab === 1 ? jobsTab() : rulesTab()}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={m("more")} closeLabel={m("close")}>
        <MenuList>
          <MenuRow icon={<Icon name="export" tone="violet" size={28} />} title={m("menu.export")} sub={m("menu.exportSub")} chevron={false} onPress={() => { setMenu(false); setTab(0); void doExport(); }} />
          <MenuRow icon={<Icon name="users" tone="sage" size={28} />} title={m("menu.team")} sub={m("menu.teamSub")} onPress={() => { setMenu(false); toTeam(); }} />
        </MenuList>
      </Sheet>

      <Sheet open={edit === "starts" || edit === "premium"} onClose={() => setEdit(null)} label={editTitle} closeLabel={m("close")}>
        <SheetTitle>{editTitle}</SheetTitle>
        {edit === "starts" || edit === "premium" ? (
          <Stack px={16} pb={20} gap={14}>
            <Text size={13.5} color="muted" leading={1.4}>{m(`rules.edit.${edit}.body`)}</Text>
            <AffixField label={m(`rules.edit.${edit}.label`)} value={draft} onChangeText={(v) => { setDraft(v); setInvalid(false); }} keyboardType="decimal-pad" autoFocus error={invalid ? m("rules.edit.invalid") : undefined} suffix={m(`rules.edit.${edit}.suffix`)} />
            <Button size="lg" block label={m("save")} busy={busy === "save" ? m("saving") : false} onPress={() => void saveEdit()} />
          </Stack>
        ) : null}
      </Sheet>

      <Sheet open={edit === "codes"} onClose={() => setEdit(null)} label={m("rules.edit.codes.title")} closeLabel={m("close")}>
        <SheetTitle>{m("rules.edit.codes.title")}</SheetTitle>
        {codes ? (
          <Stack px={16} pb={20} gap={12}>
            <Text size={13.5} color="muted" leading={1.4}>{m("rules.edit.codes.body")}</Text>
            {activeEmployees.map((w) => <TextField key={w.id} label={w.name} value={codes[w.id] ?? ""} onChangeText={(v) => setCodes({ ...codes, [w.id]: v })} autoCapitalize="characters" />)}
            <Button size="lg" block label={m("save")} busy={busy === "save" ? m("saving") : false} onPress={() => void saveEdit()} />
          </Stack>
        ) : null}
      </Sheet>
    </Screen>
  );
}
