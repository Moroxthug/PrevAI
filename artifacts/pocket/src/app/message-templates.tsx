// MessageTemplates.dc.html. What clients get from the company: eight templates (follow-ups, reminders, the review request, "on my way"), with their {slots} as chips,
// a preview with a sample client and "Send automatically". States: default, offline, view only, locked (editing is included in Elite), loading and can't load.
// PrevAI: Italian only and by email only (no SMS, and WhatsApp is the contractor's own line to PrevAI), so the language and channel switches and "Send me a test" (a text)
// are not on this screen. Saved on the company's profile (a page of its own); the quote follow-ups read f1–f3, the rest still go out in the standard wording.
// Not built: "Duplicate" (the server has no custom templates).
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ApiFailure, api } from "@/lib/api";
import { screenHref } from "@/lib/nav";
import { extraPage } from "@/lib/profile";
import { CATEGORIES, SAMPLES, TEMPLATES, VAR_LABELS, addSlot, autoKey, fill, inCategory, isEdited, parts, removeSlot, segmentsOf, textKey, wordCount, type Category, type Lang } from "@/lib/templates";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { ACTION_BAR_SPACE, ActionBar } from "@/ui/ActionBar";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { SectionHeader } from "@/ui/Row";
import { Sheet } from "@/ui/Sheet";
import { SetGroup, SetRow, SetButton } from "@/ui/Settings";
import { InlineBanner, SetTitle } from "@/ui/SettingsPages";
import { Switch } from "@/ui/Switch";
import { Composer, MessagePreview, TemplateList, type Piece } from "@/ui/Templates";

export default function MessageTemplates() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`mt.${k}`, o) as string;
  const { status, user } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const { isOwner, role } = useRole();
  const { profile, q, save } = useProfile();
  const planQ = useQuery({ queryKey: ["plan-overview"], queryFn: () => api<{ plan: string }>("/api/plan/overview"), enabled: signedIn, retry: 0, staleTime: 60_000 });
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [sel, setSel] = useState("f1");
  // PrevAI: one language, and these messages reach clients by email only.
  const lang: Lang = "it";
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState(false);

  if (status === "out") return <Redirect href="/" />;

  const saved = extraPage(profile, "templates");
  const cur = TEMPLATES.find((x) => x.id === sel) ?? TEMPLATES[0]!;
  const key = textKey(cur.id, lang);
  const standard = cur[lang];
  const stored = typeof saved[key] === "string" ? (saved[key] as string) : standard;
  const text = edits[key] ?? stored;
  const dirty = edits[key] !== undefined && edits[key] !== stored;
  const locked = !!planQ.data && planQ.data.plan !== "monthly_elite";
  const readOnly = !(isOwner || role === "admin");
  const canEdit = !locked && !readOnly;
  const offline = status === "offline";
  const company = profile?.companyName ?? "";
  const first = (user?.name ?? "").split(" ")[0] ?? "";
  const sample = { ...SAMPLES[cur.who][lang], me: first, co: company };
  const label = (slot: string) => (VAR_LABELS[slot as keyof typeof VAR_LABELS]?.[lang] ?? slot);
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SetMessaging", t("title"))));
  const ui = tr(`mt.ui.${lang}`, { returnObjects: true }) as unknown as { subject: string; message: string; insert: string; preview: string };
  const autoOn = typeof saved[autoKey(cur.id)] === "boolean" ? (saved[autoKey(cur.id)] as boolean) : true;

  const savePage = async (p: Record<string, unknown>) => {
    const r = await save({ pocketSettings: { templates: p } });
    if (!r.ok) toast({ message: r.status === 403 ? t("toast.noAccess") : r.status === 0 ? t("toast.offline") : t("toast.failed") });
    return r.ok;
  };
  const setText = (v: string) => setEdits((e) => ({ ...e, [key]: v }));
  const pick = (id: string) => setSel(id);
  const onSave = async () => {
    if (!dirty) return;
    if (await savePage({ [key]: text })) { setEdits((e) => { const n = { ...e }; delete n[key]; return n; }); toast({ message: t("toast.saved") }); }
  };
  const onReset = async () => {
    setMenu(false);
    setEdits((e) => { const n = { ...e }; delete n[key]; return n; });
    if (await savePage({ [key]: standard })) toast({ message: t("toast.reset") });
  };
  const onWhere = () => {
    setMenu(false);
    const to = cur.cat === "follow" ? "SetQuotes" : cur.cat === "remind" ? "SetInvoices" : cur.cat === "review" ? "SetCompany" : "SetMessaging";
    router.push(screenHref(to, t("title")));
  };
  const bodyPieces: Piece[] = parts(text).map((p, i) => ("slot" in p
    ? { key: `b${i}`, slot: label(p.slot), onRemove: canEdit ? () => setText(removeSlot(text, p.n)) : undefined, removeLabel: t("remove", { label: label(p.slot) }) }
    : { key: `b${i}`, text: p.text }));
  const subjPieces: Piece[] = parts(cur.subj[lang]).map((p, i) => ("slot" in p ? { key: `s${i}`, slot: label(p.slot) } : { key: `s${i}`, text: p.text }));
  const pv = fill(text, sample);
  const channels = t("channels", { returnObjects: true }) as unknown as string[];
  const loading = q.isPending && !profile;
  const items = TEMPLATES.filter((x) => inCategory(x, filter)).map((x) => ({ id: x.id, name: t(`t.${x.id}.name`), sub: `${t(`t.${x.id}.when`)} · ${channels[x.defCh]}`, tag: isEdited(x, saved) ? t("tag.edited") : t("tag.default"), edited: isEdited(x, saved) }));
  const channelNames = t("channelNames", { returnObjects: true }) as unknown as string[];

  return (
    <Screen floating={canEdit && !loading ? <ActionBar label={dirty ? t("save") : t("saved")} quiet={!dirty} disabled={!dirty} onPress={() => void onSave()} moreLabel={t("more")} onMore={() => setMenu(true)} /> : undefined}>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={ACTION_BAR_SPACE}>
        <SetTitle title={t("title")} lede={t("lede", { company })} />
        {offline ? <InlineBanner><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body")}</Banner></InlineBanner> : null}
        {readOnly && !loading ? <InlineBanner><Banner tone="info" icon="eye" iconTone="sky" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></InlineBanner> : locked ? <InlineBanner><Banner tone="acc" icon="lock" iconTone="violet" lead={t("locked.lead")}>{t("locked.body")}</Banner></InlineBanner> : null}

        {loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={300} radius={22} /><Skeleton height={260} radius={22} /></Section>
        ) : q.isError && !profile ? (
          <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void q.refetch()} />
        ) : (
          <>
            <Section delay={40} pt={16}>
              <ChipStrip label={t("filter")}>
                {CATEGORIES.map((c) => <Chip key={c} label={t(`filters.${c}`)} count={TEMPLATES.filter((x) => inCategory(x, c)).length} selected={filter === c} onPress={() => setFilter(c)} />)}
              </ChipStrip>
            </Section>
            <Section delay={70} pt={14} px={16}><TemplateList items={items} selected={cur.id} onPick={pick} label={t("list")} /></Section>

            <Section delay={100} pt={24} px={16}>
              <SectionHeader title={t(`t.${cur.id}.name`)} link={channelNames[0]} />
              <Stack pt={10}>
                <Composer subjectLabel={ui.subject} subject={subjPieces} messageLabel={ui.message} body={bodyPieces} insertLabel={ui.insert}
                  adds={canEdit ? cur.vars.map((v) => ({ key: v, label: label(v) })) : undefined} onAdd={canEdit ? (k) => setText(addSlot(text, k)) : undefined}
                  count={t("words", { count: wordCount(pv) })}
                  countSub={t("count.mail")} />
              </Stack>
            </Section>

            <Section delay={130} pt={24} px={16}>
              <SectionHeader title={ui.preview} link={t("previewFor", { name: SAMPLES[cur.who].name })} />
              <MessagePreview
                email={{ from: `${company} <${profile?.email ?? ""}>`, subject: fill(cur.subj[lang], sample), text: pv }}
                bubble={undefined} />
            </Section>

            <Section delay={160} pt={24}>
              <SetGroup>
                <SetRow first icon="clock" tone="teal" label={t("auto.label")} sub={t(`t.${cur.id}.auto`)} control={<Switch value={autoOn} onChange={(v) => void savePage({ [autoKey(cur.id)]: v })} label={t("auto.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={t("menu.title")} closeLabel={t("close")}>
        <Stack px={16} pb={24}>
          <SetGroup first>
            <SetRow first icon="sync" tone="indigo" label={t("menu.reset.label")} sub={t("menu.reset.sub", { lang: t("menu.english") })} onPress={() => void onReset()} />
            <SetRow icon="doc" tone="slate" label={t("menu.duplicate.label")} sub={t("menu.duplicate.sub")} onPress={() => { setMenu(false); toast({ message: t("toast.soon") }); }} />
            <SetRow icon="link" tone="teal" label={t("menu.where.label")} sub={t("menu.where.sub")} onPress={onWhere} />
          </SetGroup>
          <Stack pt={8}><Button kind="secondary" size="lg" block label={t("menu.cancel")} onPress={() => setMenu(false)} /></Stack>
        </Stack>
      </Sheet>
    </Screen>
  );
}
