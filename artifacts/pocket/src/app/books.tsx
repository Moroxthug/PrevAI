// Books.dc.html (QuoteAI 127.1): la prima nota a fine mese. Le schede dei mesi, la scheda del mese (voci aperte e a posto, i segni, Chiudi), la lista
// di controllo (ogni voce apre dove si sistema, o si segna «Non serve» per il mese) e i movimenti dell'estratto conto da abbinare, registrare come
// costo o ignorare. Legge /api/fiscale/libri e /api/fiscale/banca.
// Non c'è: il «non serve» vive su questo telefono (il server non lo conosce); l'estratto conto si importa dal sito (non c'è un flusso bancario da sincronizzare).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, type LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { BANK_FILTERS, checklist, closeState, dayDate, defaultMonth, filterCounts, lineOf, linesFor, matches, monthChips, monthDate, monthLines, naKey, needsPicker, openCount, otherActions, parseNa, serializeNa, signOf, suggestion, type BankFilter, type BankLine as Line, type CheckKey, type MatchSuggestion, type Suggerimento } from "@/lib/books";
import { booksApi } from "@/lib/booksApi";
import { money, shortDate, type Locale } from "@/lib/format";
import { kvGet, kvSet } from "@/lib/kv";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Empty, Skeleton, Banner, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { BankLine, ChecklistRow, ClosedButton, CloseButton, LineActions, MiniButton, MonthCard } from "@/ui/Books";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { ListRow, MenuList, MenuRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Icon } from "@/ui/Icon";
import { Status } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";

const CAP = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** Dove si sistema una voce. `bank` resta sulla pagina; le altre aprono la loro schermata. */
const ITEM_TARGET: Record<CheckKey, { screen: string; menuKey: string } | "bank"> = {
  bank_unmatched: "bank",
  payments_unbanked: { screen: "Invoices", menuKey: "invoices" },
  costs_pending: { screen: "Documents", menuKey: "documents" },
  sdi_open: { screen: "Invoices", menuKey: "invoices" },
  invoices_draft: { screen: "Invoices", menuKey: "invoices" },
  time_unapproved: { screen: "Team", menuKey: "crew" },
};

export default function Books() {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`bk.${k}`, o) as string;
  const locale: Locale = "it-IT";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";
  const scroll = useRef<ScrollView>(null);
  const bankY = useRef(0);

  const [picked, setPicked] = useState<string | null>(null);
  const overviewQ = useQuery({ queryKey: ["books-overview", picked], queryFn: () => booksApi.overview(picked ?? undefined), enabled: signedIn, retry: 1, placeholderData: (prev) => prev });
  const check = overviewQ.data;
  const today = check?.today ?? null;
  const month = picked ?? check?.month ?? (today ? defaultMonth(today) : null);
  const lockedErr = overviewQ.error instanceof ApiFailure && (overviewQ.error.code === "ADMIN_SUITE_OFF" || overviewQ.error.code === "FISCAL_MODULE_OFF");
  const bankOn = !!check && check.bank.connected;
  const year = month ? Number(month.slice(0, 4)) : new Date().getFullYear();
  const bankQ = useQuery({ queryKey: ["books-bank", year], queryFn: () => booksApi.bank(year), enabled: signedIn && bankOn, retry: 1 });

  const [na, setNa] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!month) return;
    let live = true;
    void kvGet(naKey(month)).then((raw) => { if (live) setNa(parseNa(raw)); });
    return () => { live = false; };
  }, [month]);
  const markNa = (key: string, on: boolean) => {
    if (!month) return;
    const next = new Set(na);
    if (on) next.add(key); else next.delete(key);
    setNa(next);
    void kvSet(naKey(month), serializeNa(next));
  };

  const [bf, setBf] = useState<BankFilter>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [pick, setPick] = useState<Line | null>(null);

  const allLines = useMemo(() => (bankQ.data?.movimenti ?? []).map(lineOf), [bankQ.data]);
  const lines = useMemo(() => (month ? monthLines(allLines, month) : []), [allLines, month]);
  const counts = useMemo(() => filterCounts(lines), [lines]);
  const shown = useMemo(() => linesFor(lines, bf), [lines, bf]);

  const list = useMemo(() => (check ? checklist(check.items, na) : []), [check, na]);
  const open = openCount(list);
  const done = list.length - open;
  const closed = !!check?.closed;
  const state = month && today && check ? closeState(month, today, list, closed) : "openItems";

  const refresh = useCallback(() => {
    for (const k of ["books-overview", "books-bank"]) void client.invalidateQueries({ queryKey: [k] });
  }, [client]);

  const monthName = month ? new Intl.DateTimeFormat(locale, { month: "long" }).format(monthDate(month)) : "";
  const err = (e: unknown) => toast({ message: e instanceof ApiFailure && e.code === "GIA_ABBINATO" ? m("toast.taken") : e instanceof ApiFailure && e.code === "IMPORTO_DIVERSO" ? m("toast.over") : m("toast.failed") });
  const run = async (key: string, fn: () => Promise<unknown>, doneText: string) => {
    setBusy(key);
    try { await fn(); toast({ message: doneText }); refresh(); } catch (e) { err(e); } finally { setBusy(null); }
  };

  const applyMatch = (l: Line, s: MatchSuggestion) => {
    if (s.azione === "abbina") void run(l.id, () => booksApi.matchExisting(l.id, s.tipo, s.id), m("toast.matched"));
    else void run(l.id, () => booksApi.recordPayment(l.id, s.invoiceId), m("toast.paid"));
  };
  const applyOther = (l: Line, s: Suggerimento) => {
    if (s.azione === "registra_costo") void run(l.id, () => booksApi.recordCost(l.id, s.categoria), m("toast.cost"));
    else if (s.azione === "registra_movimento") void run(l.id, () => booksApi.recordMovement(l.id, s.categoria), m("toast.movement"));
    else if (s.azione === "scadenzario") router.push(screenHref("Compliance", t("menu.rows.fisco.label") as string));
  };

  const closeMonth = async () => {
    if (!month) return;
    setBusy("close");
    try { await booksApi.doClose(month); toast({ message: m("closeDone", { month: monthName }) }); refresh(); } catch { toast({ message: m("closeFailed") }); } finally { setBusy(null); }
  };
  const reopen = async () => {
    if (!month) return;
    setMenu(false); setBusy("close");
    try { await booksApi.reopen(month); toast({ message: m("reopenDone", { month: monthName }) }); refresh(); } catch { toast({ message: m("toast.failed") }); } finally { setBusy(null); }
  };

  const openItem = (key: CheckKey) => {
    const target = ITEM_TARGET[key];
    if (target === "bank") { setBf("open"); scroll.current?.scrollTo({ y: Math.max(0, bankY.current - 12), animated: true }); return; }
    router.push(screenHref(target.screen, t(`menu.rows.${target.menuKey}.label`) as string));
  };

  const itemSub = (key: CheckKey, count: number, rows: { label: string }[]): string => {
    if (key === "invoices_draft" && count > 0) {
      const names = rows.slice(0, 2).map((r) => r.label);
      const text = count === 2 && names.length === 2 ? m("items.and", { a: names[0], b: names[1] }) : names.join(", ") + (count > names.length ? ` +${count - names.length}` : "");
      return m("items.invoices_draft.sub", { numbers: text });
    }
    if (count === 0 && (key === "costs_pending" || key === "sdi_open" || key === "invoices_draft" || key === "time_unapproved")) return m(`items.${key}.subDone`);
    if (key === "time_unapproved") return m("items.time_unapproved.sub", { count });
    return m(`items.${key}.sub`);
  };

  const failed = overviewQ.isError && !overviewQ.data && !lockedErr;
  const loading = !failed && !lockedErr && overviewQ.isPending && !overviewQ.data;
  const chips = today ? monthChips(today, check?.closedMonths ?? []) : [];
  const back = () => (router.canGoBack() ? router.back() : router.replace("/menu"));

  const lineLook = (l: Line): { icon: "receipt" | "photo" | "search" | "bank"; tone: "violet" | "amber" | "slate" | "sage"; hint: string; muted: boolean; stTone?: "ok" | "info" | "mute"; stShape?: "check" | "dot" | "off"; stWord?: string } => {
    if (l.status === "ignored") return { icon: "bank", tone: "slate", hint: m("bank.hint.ignored"), muted: true, stTone: "mute", stShape: "off", stWord: m("bank.status.ignored") };
    if (l.status === "matched" && l.match) {
      const kind = m(`bank.hint.kind.${l.match}`);
      if (l.match === "incasso") return { icon: "receipt", tone: "sage", hint: kind, muted: true, stTone: "ok", stShape: "check", stWord: m("bank.status.matched") };
      if (l.match === "costo") return { icon: "photo", tone: "amber", hint: kind, muted: true, stTone: "ok", stShape: "check", stWord: m("bank.status.matched") };
      return { icon: "bank", tone: "sage", hint: kind, muted: true, stTone: "ok", stShape: "check", stWord: m("bank.status.matched") };
    }
    const s = suggestion(l);
    if (s) return { icon: s.azione === "registra_incasso" || (s.azione === "abbina" && s.tipo === "incasso") ? "receipt" : "photo", tone: s.certezza === "alta" ? "violet" : "slate", hint: s.certezza === "alta" ? s.etichetta : m("bank.hint.couldBe", { label: s.etichetta }), muted: false };
    const o = otherActions(l)[0];
    if (o) return { icon: "search", tone: "slate", hint: o.etichetta, muted: false };
    return { icon: "search", tone: "slate", hint: m("bank.hint.none"), muted: false };
  };

  const bankSection = () => {
    if (!check) return null;
    if (!check.bank.connected) return <Card><Empty icon="bank" iconTone="sage" title={m("bank.notConnected.title")} body={m("bank.notConnected.body")} /></Card>;
    return (
      <>
        <Stack pb={10}>
          <ChipStrip label={m("bank.filter")}>
            {BANK_FILTERS.map((f) => <Chip key={f} label={m(`bank.${f}`)} count={counts[f]} selected={bf === f} onPress={() => setBf(f)} />)}
          </ChipStrip>
        </Stack>
        <Card>
          {bankQ.isPending && !bankQ.data ? (
            <Stack gap={12} px={16} pt={16} pb={16}><Skeleton height={44} radius={12} /><Skeleton height={44} radius={12} /></Stack>
          ) : bankQ.isError && !bankQ.data ? (
            <Empty icon="warn" iconTone="clay" title={m("loadFailed.title")} body={m("loadFailed.body")} action={m("retry")} onAction={refresh} />
          ) : shown.length === 0 ? (
            lines.length === 0
              ? <Empty icon="bank" iconTone="sage" title={m("bank.noneTitle")} body={m("bank.noneBody", { month: monthName })} />
              : <Empty icon="bank" iconTone="sage" title={m("bank.emptyTitle")} body={m("bank.emptyBody")} />
          ) : (
            <RowList>
              {shown.map((l) => {
                const look = lineLook(l);
                const out = l.amountCents < 0;
                const amount = `${signOf(l.amountCents)}${money(Math.abs(l.amountCents) / 100, locale)}`;
                const date = shortDate(dayDate(l.date), locale);
                const one = suggestion(l);
                return (
                  <BankLine key={l.id} date={date} desc={l.description} amount={amount} positive={!out} icon={look.icon} tone={look.tone} hint={look.hint} hintMuted={look.muted}>
                    {l.status === "unmatched" ? (
                      <LineActions>
                        <MiniButton variant="accent" label={needsPicker(l) ? m("bank.matchMore") : m("bank.match")} disabled={busy === l.id}
                          onPress={() => (needsPicker(l) || !one ? setPick(l) : applyMatch(l, one))} />
                        {out ? <MiniButton label={m("bank.cost")} disabled={busy === l.id} onPress={() => void run(l.id, () => booksApi.recordCost(l.id), m("toast.cost"))} /> : null}
                        <MiniButton variant="ghost" label={m("bank.ignore")} disabled={busy === l.id} onPress={() => void run(l.id, () => booksApi.ignore(l.id), m("toast.ignored"))} />
                      </LineActions>
                    ) : (
                      <Stack row align="center" gap={8}>
                        <Status tone={look.stTone ?? "mute"} shape={look.stShape}>{look.stWord ?? ""}</Status>
                        <MiniButton variant="ghost" label={m("bank.undo")} disabled={busy === l.id} onPress={() => void run(l.id, () => booksApi.unmatch(l.id), m("toast.undone"))} />
                      </Stack>
                    )}
                  </BankLine>
                );
              })}
            </RowList>
          )}
        </Card>
        <Stack pt={10} px={4}>
          <Text size={12.5} color="faint">{check.bank.lastImportAt ? m("bank.feed", { time: shortDate(new Date(check.bank.lastImportAt), locale) }) : m("bank.feedNever")}</Text>
        </Stack>
      </>
    );
  };

  const choose = (fn: () => Promise<unknown>, doneText: string) => { const l = pick; setPick(null); if (l) void run(l.id, fn, doneText); };
  const pickMatches = pick ? matches(pick) : [];
  const pickOthers = pick ? otherActions(pick) : [];

  return (
    <Screen>
      <Header title="" backLabel={m("back")} onBack={back} moreLabel={closed ? m("more") : undefined} onMore={closed ? () => setMenu(true) : undefined} />
      <ScrollPage bottom={48} scrollRef={scroll}>
        <Section px={20} gap={6}>
          <PageTitle>{m("title")}</PageTitle>
          <Text size={13.5} color="muted">{check?.bank.account ? m("sub.bank", { account: check.bank.account }) : m("sub.none")}</Text>
        </Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={m("loadFailed.title")} body={m("loadFailed.body")} action={m("retry")} onAction={refresh} /></Section>
        ) : lockedErr ? (
          <Section pt={26} px={16}><Empty icon="bank" iconTone="sage" title={m("locked.title")} body={m("locked.body")} /></Section>
        ) : loading || !month || !check ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={34} radius={17} /><Skeleton height={190} radius={22} /><Skeleton height={300} radius={22} /></Section>
        ) : (
          <>
            <Section delay={30} pt={16}>
              <ChipStrip label={m("monthLabel")}>
                {chips.map((c) => (
                  <Chip key={c.month} selected={c.month === month} onPress={() => { setPicked(c.month); setBf("open"); }}
                    label={new Intl.DateTimeFormat(locale, { month: "short" }).format(monthDate(c.month)).replace(/^./, (x) => x.toUpperCase())}
                    count={c.closed ? m("tagClosed") : m("tagOpen")} />
                ))}
              </ChipStrip>
            </Section>

            <Section delay={60} pt={14} px={16} gap={12}>
              <MonthCard
                title={CAP(monthName)}
                line={<Text size={13.5} color="muted"><Text size={13.5} weight={600} color="ink">{String(open)}</Text>{` ${m("openWord", { count: open })} · `}<Text size={13.5} color="muted">{String(done)}</Text>{` ${m("done", { count: done })}`}</Text>}
                status={closed ? { tone: "ok", shape: "check", label: m("tagClosed") } : { tone: "warn", shape: "clock", label: m("tagOpen") }}
                ticks={list.map((i) => !i.open)}
                button={closed
                  ? <ClosedButton label={m("closeBtn.closed", { month: monthName })} />
                  : <CloseButton label={m("closeBtn.ready", { month: monthName })} disabled={state !== "ready"} busy={busy === "close" ? m("closeBtn.working") : false} onPress={() => void closeMonth()} />}
                note={closed ? m("note.closed", { date: shortDate(new Date(check.closed!.closedAt), locale) }) : state === "notOver" ? m("note.notOver", { month: monthName }) : state === "openItems" ? m("note.openItems") : m("note.ready", { month: monthName })}
              />
              {closed && check.changedSinceClose.length > 0 ? (
                <Banner tone="warn" icon="warn" iconTone="amber" lead={m("changed.lead", { month: monthName })}>
                  {m("changed.body", { items: check.changedSinceClose.map((k) => m(`items.${k}.title`)).join(", ") })}
                </Banner>
              ) : null}
            </Section>

            <Section delay={100} pt={22} px={16}>
              <SectionHeader title={m("checklist.title")} link={list.length ? m("checklist.count", { done, total: list.length }) : undefined} />
              <Card>
                {list.length === 0 ? <Empty icon="check" iconTone="sage" title={m("checklist.empty")} body="" /> : (
                  <RowList>
                    {list.map((i) => {
                      const title = m(`items.${i.key}.title`);
                      return (
                        <ChecklistRow key={i.key} look={i.open ? "open" : i.na ? "na" : "done"} count={i.count} title={title}
                          sub={i.na ? m("checklist.naSub") : itemSub(i.key, i.count, i.rows)}
                          naText={m("checklist.na")} undoText={m("checklist.undo")} naLabel={m("checklist.naLabel", { item: title })} openLabel={m("checklist.openLabel", { item: title })}
                          onNa={() => markNa(i.key, true)} onUndo={() => markNa(i.key, false)} onOpen={() => openItem(i.key)} />
                      );
                    })}
                  </RowList>
                )}
              </Card>
            </Section>

            <Section delay={140} pt={22} px={16}>
              <View onLayout={(e: LayoutChangeEvent) => { bankY.current = e.nativeEvent.layout.y + 0; }}>
                <SectionHeader title={m("bank.title")} link={check.bank.account ? m("bank.account", { name: check.bank.account }) : undefined} />
                {bankSection()}
              </View>
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={m("more")} closeLabel={m("close")}>
        <MenuList>
          {closed && month ? <MenuRow icon={<Icon name="lock" tone="slate" size={28} />} title={m("menu.reopen", { month: monthName })} sub={m("menu.reopenSub")} chevron={false} onPress={() => void reopen()} /> : null}
        </MenuList>
      </Sheet>

      <Sheet open={!!pick} onClose={() => setPick(null)} label={m("picker.title")} closeLabel={m("close")}>
        <SheetTitle>{m("picker.title")}</SheetTitle>
        {pick ? (
          <Stack px={16} pb={20} gap={12}>
            <Stack row align="center" justify="space-between" gap={12}>
              <Text size={14.5} weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>{pick.description}</Text>
              <Num size={14.5} weight={600}>{`${signOf(pick.amountCents)}${money(Math.abs(pick.amountCents) / 100, locale)}`}</Num>
            </Stack>
            {pickMatches.length + pickOthers.length === 0 ? (
              <Empty icon="search" iconTone="slate" title={m("picker.emptyTitle")} body={pick.amountCents < 0 ? m("picker.emptyOut") : m("picker.emptyIn")} />
            ) : (
              <Card>
                <RowList>
                  {pickMatches.map((s, i) => (
                    <ListRow key={`m${i}`} title={s.etichetta} meta={s.certezza === "alta" ? undefined : m("bank.hint.couldBe", { label: "" }).replace(/:\s*$/, "")}
                      onPress={() => choose(() => (s.azione === "abbina" ? booksApi.matchExisting(pick.id, s.tipo, s.id) : booksApi.recordPayment(pick.id, s.invoiceId)), s.azione === "abbina" ? m("toast.matched") : m("toast.paid"))} />
                  ))}
                  {pickOthers.map((s, i) => (
                    <ListRow key={`o${i}`} title={s.etichetta} meta={m("picker.other")} onPress={() => { const l = pick; setPick(null); applyOther(l, s); }} />
                  ))}
                </RowList>
              </Card>
            )}
          </Stack>
        ) : null}
      </Sheet>
    </Screen>
  );
}
