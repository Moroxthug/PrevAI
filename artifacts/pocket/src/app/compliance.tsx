// Compliance.dc.html (QuoteAI 127.4): le scadenze fiscali e i promemoria dell'impresa. Stati: normale (il calendario), contabile (sola lettura: un avviso e
// niente pulsanti che cambiano le cose) e vuoto (non c'è ancora niente in calendario). Legge e scrive /api/fiscale/calendario e lo scadenzario del sito.
// Non c'è: «Carica la quietanza» e «Ricordamelo» (si fanno dal sito) e la scheda del 730/IVA (il forfettario non ha liquidazioni periodiche).
import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure, team } from "@/lib/api";
import {
  buildItems, canEditFiscale, defaultSelection, doneVerb, f24Path, featuredReturn, filterCounts, FILTERS, groups, isEmptyCalendar, isOpen, isoDay, kpis, marks, monthTicks, statusOf,
  type FilterKey, type Item, type PresetDto, type Recurrence, type ReminderKind,
} from "@/lib/compliance";
import { complianceApi } from "@/lib/complianceApi";
import { useComplianceText } from "@/lib/complianceText";
import { downloadPdf } from "@/lib/download";
import { money, splitMoney } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { MiniButton } from "@/ui/Books";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip, ChipWrap } from "@/ui/Chip";
import { DeadlineItem, KpiThree, ReturnCard, SetupRow, Strip, StripSelected } from "@/ui/Compliance";
import { DateSheet } from "@/ui/DateSheet";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { SelectField, TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Glyph, Icon } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { MenuList, MenuRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Text } from "@/ui/Text";

const ACT: Record<string, string> = { markFiled: "acts.markFiled", markPaid: "acts.markPaid", markRenewed: "acts.markRenewed", markDone: "acts.markDone" };
const TOAST: Record<string, string> = { markFiled: "toast.markFiled", markPaid: "toast.markPaid", markRenewed: "toast.markRenewed", markDone: "toast.markDone" };
const KINDS: ReminderKind[] = ["insurance", "licence", "safety", "other"];
const RECURRENCES: Recurrence[] = ["none", "monthly", "quarterly", "annual"];

export default function Compliance() {
  const x = useComplianceText();
  const { c, locale } = x;
  const { status, user } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";

  const orgsQ = useQuery({ queryKey: ["team-orgs"], queryFn: team.orgs, enabled: signedIn, retry: false });
  const role = orgsQ.data?.items.find((o) => o.orgId === orgsQ.data.activeOrgId)?.role ?? null;
  const acct = role === "bookkeeper";
  const canEdit = canEditFiscale(role);
  const you = user?.name ?? "";

  const overviewQ = useQuery({ queryKey: ["cp-overview"], queryFn: complianceApi.overview, enabled: signedIn, retry: 1 });
  const ov = overviewQ.data ?? null;
  const locked = overviewQ.error instanceof ApiFailure && (overviewQ.error.code === "ADMIN_SUITE_OFF" || overviewQ.error.code === "FISCAL_MODULE_OFF" || overviewQ.error.status === 403);
  const items = useMemo(() => (ov ? buildItems(ov) : []), [ov]);
  const featured = useMemo(() => featuredReturn(items), [items]);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => { if (ov && sel === null) setSel(defaultSelection(items)); }, [ov, items, sel]);

  const refresh = () => { void client.invalidateQueries({ queryKey: ["cp-overview"] }); };
  const fmt = (cents: number): string => money(cents / 100, locale);

  const markDone = async (i: Item) => {
    setBusy(i.id);
    const verb = doneVerb(i);
    try {
      if (i.source === "deadline" && i.anno && i.chiave) {
        await complianceApi.markPaid(i.anno, i.chiave, ov!.today);
        toast({ message: c(TOAST[verb]!) });
      } else {
        const r = await complianceApi.reminderDone(i.id.replace(/^reminder:/, ""));
        toast({ message: r.reminder ? c("toast.renewedNext", { date: x.d(r.reminder.dueDate) }) : c(TOAST[verb]!) });
      }
      refresh();
    } catch { toast({ message: c("toast.failed") }); } finally { setBusy(null); }
  };
  const undo = async (i: Item) => {
    if (!i.anno || !i.chiave) return;
    setBusy(i.id);
    try { await complianceApi.undoPaid(i.anno, i.chiave); toast({ message: c("toast.undone") }); refresh(); } catch { toast({ message: c("toast.failed") }); } finally { setBusy(null); }
  };
  const download = async (i: Item) => {
    const path = f24Path(i);
    if (!path) return;
    setBusy(`file:${i.id}`);
    try { await downloadPdf(path, `F24-${i.chiave}-${i.anno}.pdf`); } catch (e) { toast({ message: e instanceof ApiFailure && e.offline ? c("loadFailed.body") : c("toast.downloadFailed") }); } finally { setBusy(null); }
  };

  // ── Aggiungere un promemoria ──
  const [rTitle, setRTitle] = useState("");
  const [rKind, setRKind] = useState<ReminderKind>("insurance");
  const [rRec, setRRec] = useState<Recurrence>("annual");
  const [rPreset, setRPreset] = useState<PresetDto | null>(null);
  const [rDue, setRDue] = useState<Date | null>(null);
  const [pickDate, setPickDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const openAdd = () => {
    setMenu(false);
    setRTitle(""); setRKind("insurance"); setRRec("annual"); setRPreset(null);
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 30);
    setRDue(d); setAdding(true);
  };
  const choosePreset = (p: PresetDto) => { setRPreset(p); setRTitle(p.title); setRKind(p.kind); setRRec(p.recurrence); };
  const saveReminder = async () => {
    if (!rTitle.trim() || !rDue) return;
    setSaving(true);
    try {
      await complianceApi.addReminder({ kind: rKind, preset: rPreset?.id ?? null, title: rTitle.trim(), authority: rPreset?.authority ?? "", dueDate: isoDay(rDue), recurrence: rRec });
      toast({ message: c("toast.reminder") });
      setAdding(false); refresh();
    } catch { toast({ message: c("toast.failed") }); } finally { setSaving(false); }
  };

  const company = orgsQ.data?.items.find((o) => o.orgId === orgsQ.data.activeOrgId)?.companyName ?? "";
  const sub = ov ? (ov.profile.regime === "forfettario" ? c("sub", { company }) : c("subPlain", { company })) : "";
  const failed = overviewQ.isError && !overviewQ.data && !locked;
  const loading = !failed && !locked && !ov;
  const empty = ov ? isEmptyCalendar(ov) : false;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/menu"));
  const toWeb = () => router.push(screenHref("SetTaxes", c("setup.link")));

  const k = ov ? kpis(items, ov.filedThisYear) : null;
  const gs = groups(items, filter);
  const counts = filterCounts(items);
  const selected = items.find((i) => i.id === sel) ?? null;
  const word = (i: Item) => ({ ...statusOf(i.look), label: x.word(i) });
  const split = featured ? splitMoney(featured.amountCents / 100, locale) : null;
  const fileBtn = (i: Item) => (f24Path(i) ? <MiniButton key="file" label={c("acts.f24")} disabled={busy === `file:${i.id}`} onPress={() => void download(i)} /> : null);
  const shortName = (i: Item): string => (i.source === "deadline" ? c(`short.${i.kind}`) : i.authority || i.title.split(/\s+/)[0] || i.title);

  return (
    <Screen>
      <Header title={c("title")} backLabel={c("back")} onBack={back} moreLabel={c("more")} onMore={() => setMenu(true)} />
      <ScrollPage bottom={48}>
        <Section pt={8} px={20} gap={4}>
          <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header">{c("h1")}</Text>
          {sub ? <Text size={13.5} color="muted">{sub}</Text> : null}
        </Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={c("loadFailed.title")} body={c("loadFailed.body")} action={c("retry")} onAction={refresh} /></Section>
        ) : locked ? (
          <Section pt={26} px={16}><Empty icon="shield" iconTone="sage" title={c("locked.title")} body={c("locked.body")} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={86} radius={22} /><Skeleton height={230} radius={22} /><Skeleton height={190} radius={22} /></Section>
        ) : ov && empty ? (
          <>
            {acct ? <Section delay={30} pt={14} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={c("banner.lead")}>{c("banner.body", { name: you })}</Banner></Section> : null}
            <Section pt={40}><Empty icon="cal" iconTone="sky" title={c("empty.title")} body={c("empty.body")} /></Section>
            {canEdit ? (
              <Section delay={60} pt={4} px={16}>
                <Button block size="lg" label={c("empty.settings")} onPress={toWeb} />
                <Stack pt={6}><Button block kind="link" size="md" label={c("addReminder")} onPress={openAdd} /></Stack>
              </Section>
            ) : null}
          </>
        ) : ov && k ? (
          <>
            {acct ? <Section delay={30} pt={14} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={c("banner.lead")}>{c("banner.body", { name: you })}</Banner></Section> : null}

            <Section delay={50} pt={16} px={16}>
              <KpiThree items={[
                { label: c("kpi.late"), value: String(k.late), sub: k.lateFirst ? x.title(k.lateFirst) : c("kpi.lateNone"), tone: k.late ? "bad" : undefined },
                { label: c("kpi.next"), value: String(k.next30), sub: k.nextTwo.length ? k.nextTwo.map(shortName).join(", ") : c("kpi.nextNone") },
                { label: c("kpi.filed", { year: ov.today.slice(0, 4) }), value: String(k.filedYear), sub: k.filedYear > 0 && k.onTimeYear < k.filedYear ? c("kpi.someOnTime", { count: k.onTimeYear }) : c("kpi.onTime") },
              ]} />
            </Section>

            {featured && split ? (
              <Section delay={80} pt={12} px={16}>
                <ReturnCard icon={featured.icon.icon} tone={featured.icon.tone} title={x.title(featured)}
                  sub={featured.look === "filed" ? c("hst.subFiled", { who: featured.authority, date: featured.filedOn ? x.d(featured.filedOn) : "" }) : c("hst.sub", { who: featured.authority, date: x.d(featured.due) })}
                  status={word(featured)} caption={featured.look === "filed" ? c("hst.paid") : c("hst.net")} whole={split.whole} cents={split.cents}
                  three={[
                    { label: c("hst.lines"), value: String(featured.lines.length) },
                    { label: c("hst.paidSoFar"), value: fmt(featured.versatoCents) },
                    { label: c("hst.days"), value: featured.look === "filed" ? "–" : String(Math.max(0, featured.daysLeft)) },
                  ]}>
                  {f24Path(featured) ? <Button block kind="secondary" size="md" label={c("hst.worksheet")} busy={busy === `file:${featured.id}` ? c("hst.loading") : false} onPress={() => void download(featured)} /> : null}
                  {canEdit ? (
                    <Button block size="md" label={featured.look === "filed" ? c("hst.undoFiled") : c("hst.markFiled")} busy={busy === featured.id ? c("empty.building") : false}
                      onPress={() => void (featured.look === "filed" ? undo(featured) : markDone(featured))} />
                  ) : null}
                </ReturnCard>
              </Section>
            ) : null}

            <Section delay={110} pt={22} px={16}>
              <SectionHeader title={c("calendar.title")} link={c("calendar.link")} />
              <Card padded>
                <Strip label={c("calendar.aria")} selected={sel}
                  ticks={monthTicks(ov.today).map((m) => ({ key: m.month, pct: m.pct, label: new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(Number(m.month.slice(0, 4)), Number(m.month.slice(5)) - 1, 1, 12)).replace(/^./, (s) => s.toUpperCase()) }))}
                  marks={marks(items).map((m) => { const it = items.find((i) => i.id === m.id)!; return { ...m, date: x.d(m.due), aria: c("calendar.mark", { title: x.title(it), date: x.d(m.due) }) }; })}
                  onPick={setSel} />
                {selected ? <Stack pt={0}><StripSelected title={x.title(selected)} when={x.when(selected)} status={word(selected)} /></Stack> : null}
              </Card>
            </Section>

            <Section delay={130} pt={16}>
              <ChipStrip label={c("filter")}>
                {FILTERS.map((f) => <Chip key={f} label={c(`filters.${f}`)} count={counts[f]} selected={filter === f} onPress={() => setFilter(f)} />)}
              </ChipStrip>
            </Section>

            {gs.map((g) => (
              <Section key={g.key} delay={150} pt={18} px={16}>
                <SectionHeader title={c(`groups.${g.key}`)} link={g.key === "filed" ? c("groupSub.filed") : g.key === "later" ? undefined : c(`groupSub.${g.key}`, { count: g.items.length })} />
                <Card>
                  {g.items.map((i, n) => {
                    const open = sel === i.id;
                    return (
                      <DeadlineItem key={i.id} first={n === 0} icon={i.icon.icon} tone={i.icon.tone} title={x.title(i)} sub={x.sub(i)} status={word(i)} amount={i.amountCents > 0 ? fmt(i.amountCents) : undefined} selected={open} expanded={open}
                        onPress={() => setSel(i.id)}>
                        {canEdit && isOpen(i) ? <MiniButton label={c(ACT[doneVerb(i)]!)} disabled={busy === i.id} onPress={() => void markDone(i)} /> : null}
                        {canEdit && i.look === "filed" && i.filedToday && i.source === "deadline" ? <MiniButton label={c("acts.undo")} disabled={busy === i.id} onPress={() => void undo(i)} /> : null}
                        {fileBtn(i)}
                      </DeadlineItem>
                    );
                  })}
                </Card>
              </Section>
            ))}
            {gs.length === 0 ? (
              <Section pt={20}><Empty icon="check" iconTone="sage" title={c("noMatch.title")} body={c("noMatch.body")} /></Section>
            ) : null}

            <Section delay={190} pt={22} px={16}>
              <SectionHeader title={c("setup.title")} link={c("setup.link")} onLink={toWeb} />
              <Card>
                <RowList>
                  <SetupRow icon="percent" tone="violet" label={c("setup.regime")} value={ov.profile.regime === "forfettario" ? c("setup.forfettario") : c("setup.other")} onPress={toWeb} />
                  <SetupRow icon="users" tone="indigo" label={c("setup.inps")} value={c(`setup.gestione.${ov.profile.gestione}`)} onPress={toWeb} />
                  <SetupRow icon="receipt" tone="amber" label={c("setup.bollo")} value={c("setup.bolloValue")} onPress={toWeb} />
                </RowList>
              </Card>
              {canEdit ? (
                <Stack pt={12}><Button block kind="secondary" label={c("addReminder")} icon={<Glyph name="plus" size={14} weight={2.4} />} onPress={openAdd} /></Stack>
              ) : null}
            </Section>
          </>
        ) : null}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={c("more")} closeLabel={c("close")}>
        <MenuList>
          {canEdit ? <MenuRow icon={<Icon name="plus" tone="violet" size={28} />} title={c("menu.add")} sub={c("menu.addSub")} chevron={false} onPress={openAdd} /> : null}
          <MenuRow icon={<Icon name="percent" tone="azure" size={28} />} title={c("menu.settings")} sub={c("menu.settingsSub")} onPress={() => { setMenu(false); toWeb(); }} />
        </MenuList>
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} label={c("sheet.title")} closeLabel={c("close")}>
        <SheetTitle>{c("sheet.title")}</SheetTitle>
        <Stack pb={20} gap={14}>
          {ov && ov.presets.length > 0 ? (
            <Stack gap={8}>
              <Stack px={20}><Text size={12.5} color="muted">{c("sheet.from")}</Text></Stack>
              <ChipWrap>{ov.presets.map((p) => <Chip key={p.id} label={p.title} selected={rPreset?.id === p.id} onPress={() => choosePreset(p)} />)}</ChipWrap>
            </Stack>
          ) : null}
          <Stack px={16}><TextField label={c("sheet.name")} value={rTitle} onChangeText={setRTitle} placeholder={c("sheet.namePh")} /></Stack>
          <Stack gap={8}>
            <ChipWrap>{KINDS.map((kd) => <Chip key={kd} label={c(`sheet.kind.${kd}`)} selected={rKind === kd} onPress={() => setRKind(kd)} />)}</ChipWrap>
          </Stack>
          <Stack px={16}><SelectField label={c("sheet.due")} value={rDue ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(rDue) : ""} mono onPress={() => setPickDate(true)} /></Stack>
          <Stack gap={8}>
            <Stack px={20}><Text size={12.5} color="muted">{c("sheet.repeat")}</Text></Stack>
            <ChipWrap>{RECURRENCES.map((r) => <Chip key={r} label={c(`sheet.rec.${r}`)} selected={rRec === r} onPress={() => setRRec(r)} />)}</ChipWrap>
          </Stack>
          <Stack px={16}><Button block label={c("sheet.save")} disabled={!rTitle.trim() || !rDue} busy={saving ? c("sheet.saving") : false} onPress={() => void saveReminder()} /></Stack>
        </Stack>
      </Sheet>
      <DateSheet open={pickDate} onClose={() => setPickDate(false)} title={c("sheet.due")} closeLabel={c("close")} prevLabel={c("sheet.prev")} nextLabel={c("sheet.next")} locale={locale} value={rDue} onPick={(d) => { setRDue(d); setPickDate(false); }} />
    </Screen>
  );
}
