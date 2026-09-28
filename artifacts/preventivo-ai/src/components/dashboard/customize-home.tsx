// APP-7 (docs/PIANO-AZIONE.md riga 31, da QuoteAI Phase 132 §5.4) — "Personalizza la home".
//
// Show/hide and reorder the home's sections, pick the number strip's period
// and the three phone tabs after "Oggi". Only among what the role allows (the
// server sends that list and cuts anything else on save): hiding never
// reveals, and "Serve a te" can be made compact but never removed. Whoever
// manages the team also sets each kind of role's starting home here.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { HOME_KIND_LABEL, HOME_MAX_TABS, HOME_PINNED, type HomeKind, type HomeLayout, type HomePeriod, type HomeSectionId } from "@workspace/config";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { MockupToggle } from "@/components/ui/mockup-toggle";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { HOME_QUERY_KEY, homeApi, type HomeDto } from "@/lib/home-api";
import { useDashboardNav } from "@/lib/dashboard-nav-context";

/** The describe-a-job box always sits on top of the home (it is shown or not, never moved). */
const FIXED_TOP: HomeSectionId = "composer";

/** Pages that make sense as a phone tab (not Oggi itself, not settings). */
const NOT_A_TAB = new Set(["/dashboard", "/dashboard/settings", "/dashboard/amministrazione/attiva"]);

type Target = "me" | HomeKind;

export function CustomizeHomeSheet({ open, onOpenChange, home }: { open: boolean; onOpenChange: (open: boolean) => void; home: HomeDto }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const nav = useDashboardNav();
  const [target, setTarget] = useState<Target>("me");

  const source = target === "me" ? { allowed: home.allowed, layout: home.layout, custom: home.source === "user" } : (home.roles?.find((r) => r.kind === target) ?? { allowed: home.allowed, layout: home.layout, custom: false });
  const [draft, setDraft] = useState<HomeLayout>(source.layout);

  // A fresh copy each time the sheet opens or the target changes.
  useEffect(() => {
    if (open) setDraft(source.layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target, home]);
  useEffect(() => {
    if (!open) setTarget("me");
  }, [open]);

  const hidden = source.allowed.filter((id) => !draft.order.includes(id));
  const tabChoices = useMemo(() => nav.filter((n) => !NOT_A_TAB.has(n.href)), [nav]);
  const tabs = draft.tabs.filter((h) => tabChoices.some((c) => c.href === h));

  const refresh = () => queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEY });
  const fail = (e: Error) => toast({ title: t("home.customize.failed"), description: e.message, variant: "destructive" });

  const save = useMutation({
    mutationFn: () => (target === "me" ? homeApi.save(draft) : homeApi.saveRole(target, draft)),
    onSuccess: async () => {
      await refresh();
      toast({ title: target === "me" ? t("home.customize.saved") : t("home.customize.savedRole").replace("{role}", HOME_KIND_LABEL[target]) });
      if (target === "me") onOpenChange(false);
    },
    onError: fail,
  });
  const reset = useMutation({
    mutationFn: () => (target === "me" ? homeApi.reset() : homeApi.resetRole(target)),
    onSuccess: async () => {
      await refresh();
      toast({ title: t("home.customize.resetDone") });
      if (target === "me") onOpenChange(false);
    },
    onError: fail,
  });
  const busy = save.isPending || reset.isPending;

  const move = (id: HomeSectionId, by: -1 | 1) =>
    setDraft((d) => {
      const order = [...d.order];
      const i = order.indexOf(id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= order.length) return d;
      [order[i], order[j]] = [order[j]!, order[i]!];
      return { ...d, order };
    });
  const setShown = (id: HomeSectionId, shown: boolean) =>
    setDraft((d) => ({ ...d, order: shown ? [...d.order, id] : d.order.filter((x) => x !== id) }));
  const toggleTab = (href: string) =>
    setDraft((d) => {
      const current = d.tabs.filter((h) => tabChoices.some((c) => c.href === h));
      if (current.includes(href)) return { ...d, tabs: current.filter((h) => h !== href) };
      if (current.length >= HOME_MAX_TABS) return d;
      return { ...d, tabs: [...current, href] };
    });

  const label = (id: HomeSectionId) => t(`home.section.${id}`);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("home.customize.title")}
      description={target === "me" ? t("home.customize.desc") : t("home.customize.descRole").replace("{role}", HOME_KIND_LABEL[target])}
      footer={
        <>
          <button type="button" className="btn btn-outline-navy" disabled={busy || !home.available || (!source.custom && target !== "me")} onClick={() => reset.mutate()}>
            {reset.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("home.customize.reset")}
          </button>
          <button type="button" className="btn btn-navy" disabled={busy || !home.available} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {target === "me" ? t("home.customize.save") : t("home.customize.saveRole")}
          </button>
        </>
      }
    >
      <div className="home-cz" data-testid="customize-home">
        {!home.available && <p className="home-cz-note">{t("home.customize.notAvailable")}</p>}

        {home.roles && (
          <label className="home-cz-target">
            <span>{t("home.customize.editing")}</span>
            <select value={target} onChange={(e) => setTarget(e.target.value as Target)} disabled={busy}>
              <option value="me">{t("home.customize.mine")}</option>
              {home.roles.map((r) => (
                <option key={r.kind} value={r.kind}>
                  {t("home.customize.roleOption").replace("{role}", HOME_KIND_LABEL[r.kind])}{r.custom ? " ✓" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <h3 className="home-cz-h">{t("home.customize.sections")}</h3>
        <ul className="home-cz-list">
          {draft.order.map((id, i) => (
            <li key={id} className="home-cz-row">
              <span className="home-cz-name">
                {label(id)}
                {id === HOME_PINNED && <span className="home-cz-hint">{t("home.customize.pinned")}</span>}
                {id === FIXED_TOP && <span className="home-cz-hint">{t("home.customize.onTop")}</span>}
              </span>
              {id === HOME_PINNED ? (
                <span className="home-cz-compact">
                  <span>{t("home.customize.compact")}</span>
                  <MockupToggle checked={draft.needsYouCollapsed} onCheckedChange={(v) => setDraft((d) => ({ ...d, needsYouCollapsed: v }))} label={t("home.customize.compact")} />
                </span>
              ) : (
                <MockupToggle checked onCheckedChange={() => setShown(id, false)} label={t("home.customize.hideX").replace("{x}", label(id))} />
              )}
              {id === FIXED_TOP ? <span className="home-cz-move" aria-hidden="true" /> : (
              <span className="home-cz-move">
                <button type="button" className="more-btn plain" onClick={() => move(id, -1)} disabled={i === 0} aria-label={t("home.customize.up").replace("{x}", label(id))}><ArrowUp /></button>
                <button type="button" className="more-btn plain" onClick={() => move(id, 1)} disabled={i === draft.order.length - 1} aria-label={t("home.customize.down").replace("{x}", label(id))}><ArrowDown /></button>
              </span>
              )}
            </li>
          ))}
          {hidden.map((id) => (
            <li key={id} className="home-cz-row off">
              <span className="home-cz-name">{label(id)}</span>
              <MockupToggle checked={false} onCheckedChange={() => setShown(id, true)} label={t("home.customize.showX").replace("{x}", label(id))} />
              <span className="home-cz-move" aria-hidden="true" />
            </li>
          ))}
        </ul>

        {source.allowed.includes("stats") && (
          <>
            <h3 className="home-cz-h">{t("home.customize.period")}</h3>
            <div className="seg" data-period={draft.period} role="radiogroup" aria-label={t("home.customize.period")}>
              {(["m", "q", "y"] as HomePeriod[]).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={draft.period === p} className="seg-b" onClick={() => setDraft((d) => ({ ...d, period: p }))}>
                  {t(`home.customize.period.${p}`)}
                </button>
              ))}
              <span className="seg-thumb" aria-hidden="true" />
            </div>
          </>
        )}

        {tabChoices.length > 0 && (
          <>
            <h3 className="home-cz-h">
              {t("home.customize.tabs")} <span className="home-cz-hint">{tabs.length}/{HOME_MAX_TABS}</span>
            </h3>
            <p className="home-cz-sub">{t("home.customize.tabsHint")}</p>
            <div className="home-cz-tabs">
              {tabChoices.map((c) => {
                const on = tabs.includes(c.href);
                return (
                  <button key={c.href} type="button" className={cn("chip", on ? "chip-navy-soft on" : "chip-grey")} aria-pressed={on} disabled={!on && tabs.length >= HOME_MAX_TABS} onClick={() => toggleTab(c.href)}>
                    {on && <span aria-hidden="true">{tabs.indexOf(c.href) + 1} · </span>}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
