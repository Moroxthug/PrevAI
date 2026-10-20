// SetTaxes.dc.html, for Italy ("IVA e regime"). The card says what the company charges: no IVA in the forfettario (art. 1, c. 54–89, L. 190/2014), else the
// ordinary 22 % with the reduced 10 % and 4 % beside it. Then where it works (the province of the seat, the partita IVA, the regime as PrevAI Fisco has it), the
// clients with another IVA (10 % on the upkeep of a home, reverse charge; add or remove one), the "beni significativi" of the 10 %, how IVA shows on documents
// (a separate line or in the prices, on each line, with the number) and the next F24 from the PrevAI Fisco calendar.
// States: default, view only, loading and can't load. The filing group shows only when PrevAI Fisco answers (its add-on is on).
// Where QuoteAI had GST/HST, provinces with their own taxes, the job's province and the GST/HST return, PrevAI has one national IVA and the F24.
// Saved but not read yet by the quote and invoice makers: the clients with another IVA, the beni significativi, how IVA shows and the number on documents.
import { useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { clientsApi } from "@/lib/clientsApi";
import { dayDate, type DeadlineDto } from "@/lib/compliance";
import { complianceApi } from "@/lib/complianceApi";
import { percent, shortDate, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { PROVINCE } from "@/lib/province";
import { fold } from "@/lib/search";
import { pageOf } from "@/lib/profile";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Button } from "@/ui/Button";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { ChoiceList, SetGroup, SetRow, SetSegment, SetValue, SheetNote } from "@/ui/Settings";
import { RowStatus, SetTitle, TaxCard } from "@/ui/SettingsPages";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Switch } from "@/ui/Switch";

type Exempt = { clientId: string; reason: "rebate" | "exempt" };

export default function SetTaxes() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`stx.${k}`, o) as string;
  const locale: Locale = "it-IT";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const { profile, q, save } = useProfile();
  const { isOwner } = useRole();
  const clientsQ = useQuery({ queryKey: ["clients-overview"], queryFn: clientsApi.overview, enabled: signedIn, retry: 1, staleTime: 30_000 });
  const compQ = useQuery({ queryKey: ["compliance"], queryFn: complianceApi.overview, enabled: signedIn, retry: 0, staleTime: 60_000 });
  const comp = compQ.data && compQ.data.enabled ? compQ.data : null;
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const page = pageOf(profile, "tax");
  const exempt: Exempt[] = page.exempt ?? [];
  const clients = clientsQ.data?.items ?? [];

  const savePage = async (patch: Record<string, unknown>) => {
    const r = await save({ pocketSettings: { tax: patch } });
    if (!r.ok) toast({ message: r.status === 403 ? t("noAccess") : r.status === 0 ? t("offline") : t("failed") });
  };
  const saveProvince = async (code: string) => {
    setProvinceOpen(false);
    const r = await save({ province: code });
    if (!r.ok) toast({ message: r.status === 403 ? t("noAccess") : r.status === 0 ? t("offline") : t("failed") });
  };

  const exName = (id: string) => clients.find((c) => c.id === id)?.name ?? "";
  const setExempt = async (clientId: string, reason: Exempt["reason"] | null) => {
    const rest = exempt.filter((e) => e.clientId !== clientId);
    await savePage({ exempt: reason ? [...rest, { clientId, reason }] : rest });
    setPicked(null); setExOpen(false); setTerm("");
  };
  const listed = useMemo(() => clients.filter((c) => !term.trim() || fold(`${c.name} ${c.city ?? ""}`).includes(fold(term))), [clients, term]);

  if (status === "out") return <Redirect href="/" />;

  const loading = q.isPending && !profile;
  const failed = q.isError && !profile;
  const canEdit = isOwner;
  const code = profile?.province ?? null;
  const provName = PROVINCE.find((x) => x.sigla === code)?.nome ?? "";
  const regime = comp?.profile.regime;
  const forfettario = regime === "forfettario";
  const pct = (n: number) => percent(n / 100, locale);
  const parts = forfettario ? [] : [{ label: t("parts.reduced10"), value: pct(10) }, { label: t("parts.reduced4"), value: pct(4) }];
  const company = profile?.companyName ?? "";
  const piva = profile?.vatNumber ?? "";
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  // The next F24 to pay: a tax or contribution deadline not yet marked paid, the soonest first.
  const next: DeadlineDto | undefined = comp?.deadlines.filter((d) => !d.filedAt && d.hasF24).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const pickedClient = clients.find((c) => c.id === picked);
  const pickedState = exempt.find((e) => e.clientId === picked);

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={regime ? t("lede", { company, regime: t(`regime.${regime}`) }) : t("ledeNone", { company })} />
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={150} radius={22} /><Skeleton height={190} radius={22} /><Skeleton height={190} radius={22} /></Section>
        ) : (
          <>
            {!canEdit ? <Section pt={16} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("viewOnly.lead")}>{t("viewOnly.body")}</Banner></Section> : null}
            <Section delay={40} pt={18} px={16}><TaxCard province={provName} rate={forfettario ? t("card.forfettarioRate") : pct(22)} tag={forfettario ? t("card.forfettario") : t("card.ordinario")} parts={parts} /></Section>
            {forfettario ? <Section pt={10} px={16}><Banner tone="info" icon="percent" iconTone="azure" lead={t("card.forfettarioNote")} /></Section> : null}

            <Section delay={80}>
              <SetGroup title={t("g.prov")}>
                <SetRow first icon="pin" tone="clay" label={t("province.label")} sub={t("province.sub")} control={<SetValue value={provName} chevron />} onPress={canEdit ? () => setProvinceOpen(true) : undefined} />
                <SetRow icon="receipt" tone="violet" label={t("gst.label")} sub={t("gst.sub")} control={<SetValue value={piva || t("gst.none")} mono />} />
                {regime ? <SetRow icon="bank" tone="sage" label={t("regimeRow.label")} sub={t("regimeRow.sub")} control={<SetValue value={t(`regime.${regime}`)} />} /> : null}
              </SetGroup>
            </Section>

            {!forfettario ? (
              <Section delay={130}>
                <SetGroup title={t("g.ex")} foot={t("ex.foot")}>
                  {exempt.map((e, i) => (
                    <SetRow key={e.clientId} first={i === 0} icon="user" tone={e.reason === "rebate" ? "teal" : "sky"} label={exName(e.clientId) || "…"} sub={t(`ex.${e.reason}`)} control={<SetValue value={t(`ex.${e.reason}Tag`)} chevron />}
                      onPress={() => router.push(screenHref("Client", exName(e.clientId), { id: e.clientId }))} />
                  ))}
                  {canEdit ? <SetRow first={exempt.length === 0} icon="plus" tone="slate" label={t("ex.add")} sub={t("ex.addSub")} onPress={() => { setPicked(null); setTerm(""); setExOpen(true); }} /> : null}
                </SetGroup>
              </Section>
            ) : null}

            {!forfettario ? (
              <Section delay={180}>
                <SetGroup title={t("g.split")} foot={t("split.foot")}>
                  <SetRow first icon="bricks" tone="stone" label={t("split.label")} sub={t(page.split ? "split.on" : "split.off")} control={<Switch value={page.split ?? false} onChange={(v) => void savePage({ split: v })} label={t("split.label")} disabled={!canEdit} />} />
                </SetGroup>
              </Section>
            ) : null}

            <Section delay={230}>
              <SetGroup title={t("g.docs")}>
                {!forfettario ? <SetRow first icon="doc" tone="azure" label={t("show.label")} below={<SetSegment options={[t("show.line"), t("show.included")]} value={page.showAs === "included" ? 1 : 0} onChange={(i) => void savePage({ showAs: i === 1 ? "included" : "line" })} label={t("show.label")} disabled={!canEdit} />} /> : null}
                {!forfettario ? <SetRow icon="list" tone="lilac" label={t("perLine.label")} sub={t("perLine.sub")} control={<Switch value={page.perLine ?? false} onChange={(v) => void savePage({ perLine: v })} label={t("perLine.label")} disabled={!canEdit} />} /> : null}
                <SetRow first={forfettario} icon="receipt" tone="violet" label={t("showNum.label")} sub={t("showNum.sub")} control={<Switch value={page.showNumber ?? true} onChange={(v) => void savePage({ showNumber: v })} label={t("showNum.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>

            {comp ? (
              <Section delay={280}>
                <SetGroup title={t("g.file")} foot={t("fileFoot")}>
                  <SetRow first icon="clock" tone="amber" label={t("next.label")} sub={next ? next.label : t("next.none")}
                    control={next ? <RowStatus tone={next.daysLeft < 0 ? "bad" : "warn"} shape={next.daysLeft < 0 ? "alert" : "clock"}>{t("next.due", { date: shortDate(dayDate(next.dueDate), locale) })}</RowStatus> : undefined} />
                  <SetRow icon="cal" tone="sage" label={t("collected.label")} sub={t("collected.sub")} control={<SetValue value="" chevron />} onPress={() => router.push(screenHref("Compliance", t("collected.label")))} />
                </SetGroup>
              </Section>
            ) : null}
          </>
        )}
      </ScrollPage>

      <Sheet open={provinceOpen} onClose={() => setProvinceOpen(false)} label={t("province.sheet")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={4}>
          <SheetTitle>{t("province.sheet")}</SheetTitle>
          <ChoiceList chosen={code} items={PROVINCE.map((c) => ({ id: c.sigla, name: c.nome, sub: `${c.sigla} · ${c.regione}` }))} onPick={(c) => void saveProvince(c)} />
        </Stack>
      </Sheet>

      <Sheet open={exOpen} onClose={() => { setExOpen(false); setPicked(null); }} label={t("ex.sheet")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={4}>
          <SheetTitle>{pickedClient ? pickedClient.name : t("ex.sheet")}</SheetTitle>
          {pickedClient ? (
            <>
              <SheetNote>{t("ex.reason")}</SheetNote>
              <ChoiceList chosen={pickedState?.reason ?? null} items={[{ id: "rebate", name: t("ex.rebateTag"), sub: t("ex.rebate") }, { id: "exempt", name: t("ex.exemptTag"), sub: t("ex.exempt") }]} onPick={(r) => void setExempt(pickedClient.id, r as Exempt["reason"])} />
              {pickedState ? <Stack pt={14}><Button kind="destructive" size="md" label={t("ex.remove")} block onPress={() => void setExempt(pickedClient.id, null)} /></Stack> : null}
            </>
          ) : (
            <>
              <SheetNote>{t("ex.sheetSub")}</SheetNote>
              <Search label={t("ex.search")} placeholder={t("ex.search")} value={term} onChangeText={setTerm} autoCorrect={false} autoCapitalize="none" />
              <Stack pt={8}>
                {clients.length === 0 ? <Empty icon="user" iconTone="slate" title={t("ex.noClients")} body="" /> : (
                  <ChoiceList chosen={null} items={listed.slice(0, 40).map((c) => ({ id: c.id, name: c.name, sub: exempt.find((e) => e.clientId === c.id) ? t(`ex.${exempt.find((e) => e.clientId === c.id)!.reason}Tag`) : [c.address, c.city].filter(Boolean).join(", ") }))} onPick={(id) => setPicked(id)} />
                )}
              </Stack>
            </>
          )}
        </Stack>
      </Sheet>
    </Screen>
  );
}
