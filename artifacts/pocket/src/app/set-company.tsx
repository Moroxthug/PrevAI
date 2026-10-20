// SetCompany.dc.html. The company's details as they print on quotes, invoices and client pages: the logo (Change takes a photo from the library), the
// legal and operating names, the partita IVA, codice fiscale and REA, the address, phone, email and website, and the brand colour with a small quote to show it.
// Typed fields are kept as a draft with "Unsaved changes" (Discard / Save); the swatch is part of the draft. States: default, unsaved, view only (not the owner),
// loading and can't load.
// PrevAI: Italian only, so the board's document language is not here; the rest of the FatturaPA identity (SdI code, CAP, comune) stays on the web. Not true to
// the board: the "Verified" mark (nothing checks a number with the Agenzia delle Entrate: the P. IVA and C.F. fields say only whether the format looks right),
// and the brand colour is saved but the quote and invoice makers don't read it yet.
import { useEffect, useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { board } from "@/theme/board";
import { API_ORIGIN } from "@/lib/session";
import { initialsOf } from "@/lib/invites";
import { choosePhotos } from "@/lib/media";
import { screenHref } from "@/lib/nav";
import { BRAND_KEYS, brandKeyOf, looksLikeCf, looksLikePiva, type BrandKey, type Profile } from "@/lib/profile";
import { profileApi } from "@/lib/profileApi";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { useQueryClient } from "@tanstack/react-query";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Status } from "@/ui/Status";
import { SaveBar, SetField, SetGroup, SetRow } from "@/ui/Settings";
import { BrandHex, LogoCard, QuotePreview, SetTitle, Swatches } from "@/ui/SettingsPages";
import { percent } from "@/lib/format";

type Draft = { legal: string; op: string; gst: string; cf: string; rea: string; addr: string; phone: string; email: string; web: string; brand: BrandKey };

const draftOf = (p: Profile): Draft => ({
  legal: p.legalName ?? "", op: p.companyName ?? "", gst: p.vatNumber ?? "", cf: p.codiceFiscale ?? "", rea: p.reaNumber ?? "", addr: p.address ?? "", phone: p.phone ?? "", email: p.email ?? "", web: p.website ?? "",
  brand: brandKeyOf(p.brandColor, board.brandColours),
});

export default function SetCompany() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sc.${k}`, o) as string;
  const locale = "it-IT";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const { profile, q, save } = useProfile();
  const { isOwner } = useRole();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // The draft starts from the profile and follows it until the person types.
  useEffect(() => { if (profile && !draft) setDraft(draftOf(profile)); }, [profile, draft]);
  const saved = useMemo(() => (profile ? draftOf(profile) : null), [profile]);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);

  if (status === "out") return <Redirect href="/" />;

  const loading = q.isPending && !profile;
  const failed = q.isError && !profile;
  const canEdit = isOwner;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const set = (k: keyof Draft, v: string | number) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const emailBad = !!draft && draft.email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(draft.email.trim());
  const gstBad = !!draft && draft.gst.trim() !== "" && !looksLikePiva(draft.gst);
  const cfBad = !!draft && draft.cf.trim() !== "" && !looksLikeCf(draft.cf);

  const onSave = async () => {
    if (!draft) return;
    if (emailBad) { setShowErrors(true); return; }
    setBusy(true);
    const r = await save({
      // PrevAI's update body takes "" (not null) to clear the original four fields (vatNumber, address, phone, email).
      companyName: draft.op.trim(), legalName: draft.legal.trim() || null, vatNumber: draft.gst.replace(/\s+/g, ""), codiceFiscale: draft.cf.replace(/\s+/g, "").toUpperCase() || null, reaNumber: draft.rea.trim() || null,
      address: draft.addr.trim(), phone: draft.phone.trim(), email: draft.email.trim(), website: draft.web.trim() || null, brandColor: board.brandColours[draft.brand],
    });
    setBusy(false);
    if (r.ok) { setDraft(null); setShowErrors(false); toast({ message: t("saved") }); }
    else toast({ message: r.status === 403 ? t("noAccess") : r.status === 0 ? t("offline") : t("failed") });
  };

  const changeLogo = async () => {
    const r = await choosePhotos(1, "logo");
    if (!r.ok) { toast({ message: t(r.problem === "denied" ? "logo.denied" : "logo.unavailable") }); return; }
    const file = r.files[0];
    if (!file) return;
    const up = await profileApi.logo(file);
    if (up.ok) { void client.invalidateQueries({ queryKey: ["profile"] }); toast({ message: t("logo.uploaded") }); }
    else toast({ message: up.status === 403 ? t("noAccess") : t("logo.failed") });
  };

  const op = draft?.op || profile?.companyName || "";
  const colour = draft ? board.brandColours[draft.brand] : board.brandColours.violet;
  const logoUri = profile?.logoUrl ? (profile.logoUrl.startsWith("http") ? profile.logoUrl : `${API_ORIGIN}${profile.logoUrl}`) : undefined;

  return (
    <Screen floating={dirty && canEdit ? <SaveBar message={t("unsaved")} discard={t("discard")} save={t("save")} onDiscard={() => { setDraft(null); setShowErrors(false); }} onSave={() => void onSave()} busy={busy} /> : undefined}>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={dirty ? 120 : 56}>
        <SetTitle title={t("title")} lede={t("lede")} />
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading || !draft ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={96} radius={22} /><Skeleton height={260} radius={22} /><Skeleton height={260} radius={22} /></Section>
        ) : (
          <>
            {!canEdit ? <Section pt={16} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("viewOnly.lead")}>{t("viewOnly.body")}</Banner></Section> : null}
            <Section delay={40} pt={18} px={16}>
              <LogoCard initials={initialsOf(op)} colour={colour} name={op} hint={t("logo.hint")} change={t("logo.change")} onChange={() => void changeLogo()} disabled={!canEdit} logoUri={logoUri} />
            </Section>
            <Section delay={80}>
              <SetGroup title={t("g.business")} foot={t("footBusiness")}>
                <SetField first icon="building" tone="slate" label={t("f.legal")} value={draft.legal} onChangeText={(v) => set("legal", v)} disabled={!canEdit} autoCapitalize="words" />
                <SetField icon="star" tone="amber" label={t("f.op")} value={draft.op} onChangeText={(v) => set("op", v)} disabled={!canEdit} autoCapitalize="words" />
                <SetField icon="receipt" tone="violet" label={t("f.gst")} value={draft.gst} onChangeText={(v) => set("gst", v)} disabled={!canEdit} mono autoCapitalize="characters" autoCorrect={false}
                  status={draft.gst.trim() ? <Status tone={gstBad ? "warn" : "ok"} shape={gstBad ? "alert" : "check"}>{t(gstBad ? "gstCheck" : "gstOk")}</Status> : undefined} />
                <SetField icon="user" tone="indigo" label={t("f.cf")} value={draft.cf} onChangeText={(v) => set("cf", v)} disabled={!canEdit} mono autoCapitalize="characters" autoCorrect={false}
                  status={draft.cf.trim() ? <Status tone={cfBad ? "warn" : "ok"} shape={cfBad ? "alert" : "check"}>{t(cfBad ? "gstCheck" : "gstOk")}</Status> : undefined} />
                <SetField icon="shield" tone="teal" label={t("f.wsib")} value={draft.rea} onChangeText={(v) => set("rea", v)} disabled={!canEdit} mono autoCapitalize="characters" />
              </SetGroup>
            </Section>
            <Section delay={140}>
              <SetGroup title={t("g.contact")}>
                <SetField first icon="pin" tone="clay" label={t("f.addr")} value={draft.addr} onChangeText={(v) => set("addr", v)} disabled={!canEdit} autoComplete="street-address" />
                <SetField icon="phone" tone="sage" label={t("f.phone")} value={draft.phone} onChangeText={(v) => set("phone", v)} disabled={!canEdit} mono keyboardType="phone-pad" />
                <SetField icon="mail" tone="sky" label={t("f.email")} value={draft.email} onChangeText={(v) => set("email", v)} disabled={!canEdit} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  status={showErrors && emailBad ? <Status tone="bad" shape="alert">{t("bad.email")}</Status> : undefined} />
                <SetField icon="globe" tone="azure" label={t("f.web")} value={draft.web} onChangeText={(v) => set("web", v)} disabled={!canEdit} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
              </SetGroup>
            </Section>
            <Section delay={200}>
              <SetGroup title={t("g.documents")}>
                <SetRow first icon="brush" tone="lilac" label={t("brand.label")} sub={t("brand.sub")}
                  control={<BrandHex colour={colour} />}
                  below={(
                    <>
                      <Swatches colours={BRAND_KEYS.map((k) => ({ key: k, hex: board.brandColours[k] }))} value={draft.brand} onChange={(k) => set("brand", k)} label={t("brand.group")} names={Object.fromEntries(BRAND_KEYS.map((k) => [k, t(`brand.${k}`)]))} disabled={!canEdit} />
                      <QuotePreview colour={colour} initials={initialsOf(op)} name={op} site={draft.web} word={t("preview.quote")} number="N° 108.2026"
                        taxLine={t("preview.taxIncluded", { rate: percent(0.22, locale) })} accept={t("preview.accept")} />
                    </>
                  )} />
              </SetGroup>
            </Section>
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}
