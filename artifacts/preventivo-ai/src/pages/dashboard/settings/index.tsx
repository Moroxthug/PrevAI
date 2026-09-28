import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import { useGetSubscription, useGetWhatsappStatus, getGetWhatsappStatusQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import {
  BellRing, Building2, CalendarClock, ChevronLeft, ChevronRight, CreditCard, FileCheck2, Globe, Landmark, MessageCircle, Plug, ShieldCheck, Sparkles, UserRound, Zap,
  type LucideIcon,
} from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useMobileHeader } from "@/components/mobile/mobile-page-header";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { authClient } from "@/lib/auth-client";
import { hasFeature } from "@/lib/plans";
import { sdiApi } from "@/lib/sdi-api";
import { cn } from "@/lib/utils";
import { SaveBar, useDraftHost, useSinglePane } from "./ui";
import { useBusinessProfile } from "./data";
import { AccountSection, SdiSection, SecuritySection } from "./account";
import { CompanySection } from "./company";
import { FiscalSection } from "./fiscal";
import { PaymentsSection } from "./payments";
import { AutomationsSection } from "./automations";
import { WidgetSection } from "./widget";
import { WhatsappSection } from "./whatsapp";
import { AppsSection } from "./apps";
import { AssistantSection } from "./assistant";
import { NotificationsSection } from "./notifications";
import { APPS_HREF, appById } from "./apps/catalog";
import { PlanSection, planLabelOf } from "./plan";

// ── APP-1b (come QuoteAI Phase 102): le Impostazioni come elenco ─────────────
// /dashboard/settings/<sezione>. Su schermo largo: l'elenco raggruppato a
// sinistra, la sezione aperta a destra. Sotto 860 px: l'elenco è la prima
// schermata (/dashboard/settings) e una sezione si apre come pagina sua con
// la freccia indietro. I vecchi link ?tab= (email, ritorni OAuth, segnalibri,
// messaggi del bot WhatsApp) rimandano alla sezione giusta.

type SectionId = "access" | "security" | "notifications" | "company" | "fiscal" | "sdi" | "payments" | "automations" | "widget" | "whatsapp" | "assistant" | "apps" | "plan";
type GroupId = "you" | "business" | "selling" | "messaging" | "more";

type SectionDef = { id: SectionId; group: GroupId; label: string; icon: LucideIcon; Component: ComponentType };

const SECTIONS: SectionDef[] = [
  { id: "access", group: "you", label: "Il tuo accesso", icon: UserRound, Component: AccountSection },
  { id: "security", group: "you", label: "Sicurezza", icon: ShieldCheck, Component: SecuritySection },
  // APP-2: notifiche push sul telefono (per dispositivo e per persona).
  { id: "notifications", group: "you", label: "Notifiche sul telefono", icon: BellRing, Component: NotificationsSection },
  { id: "company", group: "business", label: "Dati dell'impresa", icon: Building2, Component: CompanySection },
  { id: "fiscal", group: "business", label: "Dati fiscali e bancari", icon: Landmark, Component: FiscalSection },
  { id: "sdi", group: "business", label: "Fatture elettroniche", icon: FileCheck2, Component: SdiSection },
  { id: "payments", group: "selling", label: "Rate di pagamento", icon: CalendarClock, Component: PaymentsSection },
  { id: "automations", group: "selling", label: "Automazioni e recensioni", icon: Zap, Component: AutomationsSection },
  { id: "widget", group: "selling", label: "Widget per il sito", icon: Globe, Component: WidgetSection },
  { id: "whatsapp", group: "messaging", label: "WhatsApp", icon: MessageCircle, Component: WhatsappSection },
  // APP-8b: cosa l'assistente fa da solo, chiede prima o non fa mai.
  { id: "assistant", group: "more", label: "Assistente", icon: Sparkles, Component: AssistantSection },
  { id: "apps", group: "more", label: "App collegate", icon: Plug, Component: AppsSection },
  { id: "plan", group: "more", label: "Piano e fatturazione", icon: CreditCard, Component: PlanSection },
];
const GROUPS: Array<{ id: GroupId; label: string }> = [
  { id: "you", label: "Tu" },
  { id: "business", label: "Impresa" },
  { id: "selling", label: "Vendere" },
  { id: "messaging", label: "Messaggi" },
  { id: "more", label: "App e piano" },
];

/** Le vecchie schede (e il percorso /dashboard/settings/account della Phase 55) → la loro sezione adesso. */
const LEGACY: Record<string, SectionId> = {
  account: "company", business: "fiscal", billing: "plan", usage: "plan", whatsapp: "whatsapp",
  widget: "widget", integrations: "apps", security: "security", sdi: "sdi",
};

export const settingsHref = (id: SectionId) => `/dashboard/settings/${id}`;

/** Quali sezioni vede questa persona: gli stessi vincoli di piano e modulo delle vecchie schede. */
function useVisibleSections() {
  const { data: sub, isFetched: subLoaded } = useGetSubscription();
  const { data: profile, isFetched: profileLoaded } = useBusinessProfile();
  const plan = sub?.isActive ? sub.plan : null;
  const proUp = plan === "monthly_pro" || plan === "monthly_elite";
  const hasSdi = profile ? hasFeature(profile as never, "sdi_invoicing") : false;
  const hasAssistant = profile ? hasFeature(profile as never, "assistant") : false;
  const visible = useMemo(() => {
    const hidden: Partial<Record<SectionId, boolean>> = {
      // A-1: la sezione compare solo a chi ha il modulo PrevAI Fisco.
      sdi: !hasSdi,
      whatsapp: !proUp,
      assistant: !hasAssistant,
    };
    return SECTIONS.filter((s) => !hidden[s.id]);
  }, [hasSdi, proUp, hasAssistant]);
  return { visible, ready: subLoaded && profileLoaded, plan };
}

type Status = { text: string | null; attention?: boolean };

/** La riga di stato sotto ogni nome, e un pallino dove c'è qualcosa da fare. Legge solo query già in cache o leggere. */
function useStatuses(plan: string | null | undefined, visible: SectionDef[]): Partial<Record<SectionId, Status>> {
  const { data: profile } = useBusinessProfile();
  const { data: session } = authClient.useSession();
  const shows = (id: SectionId) => visible.some((s) => s.id === id);
  const wa = useGetWhatsappStatus({ query: { queryKey: getGetWhatsappStatusQueryKey(), enabled: shows("whatsapp") } });
  const sdi = useQuery({ queryKey: ["sdi", "settings"], queryFn: () => sdiApi.settings(), enabled: shows("sdi"), retry: false });
  const user = session?.user as { email?: string | null; twoFactorEnabled?: boolean } | undefined;
  const twoFactor = Boolean(user?.twoFactorEnabled);
  const out: Partial<Record<SectionId, Status>> = {
    access: { text: user?.email ?? null },
    security: session ? { text: twoFactor ? "Verifica in due passaggi attiva" : "Verifica in due passaggi spenta", attention: !twoFactor } : { text: null },
    plan: { text: planLabelOf(plan) ? `Piano ${planLabelOf(plan)}` : "Nessun piano attivo" },
    apps: { text: "Calendario, Gmail, Stripe e altre" },
    assistant: { text: "Cosa fa da solo e cosa chiede" },
    notifications: { text: "Preventivi aperti e accettati, richieste, scadenze" },
  };
  if (profile) {
    const missingContact = !profile.phone || !profile.address;
    out.company = profile.companyName?.trim()
      ? { text: missingContact ? "Mancano telefono o indirizzo" : profile.companyName, attention: missingContact }
      : { text: "Da completare", attention: true };
    out.fiscal = !profile.codiceFiscale && !profile.vatNumber
      ? { text: "Manca il codice fiscale", attention: true }
      : { text: profile.iban ? "IBAN inserito" : "Manca l'IBAN per i bonifici", attention: !profile.iban };
    const rate = profile.defaultPaymentSchedule?.terms.length;
    out.payments = { text: rate ? `${rate} ${rate === 1 ? "rata" : "rate"} di partenza` : "Schema predefinito PrevAI" };
    out.automations = { text: profile.automationSettings?.invoiceReminders === false ? "Promemoria fatture spenti" : "Promemoria fatture attivi" };
    out.widget = { text: profile.apiKey ? "Attivo" : "Non configurato" };
  }
  if (wa.data) out.whatsapp = { text: wa.data.connected ? (wa.data.isEnabled === false ? "In pausa" : `Collegato · +${wa.data.phoneNumber}`) : "Non collegato" };
  if (sdi.data) {
    const stato = sdi.data.settings.stato;
    out.sdi = stato === "attivo" ? { text: "Attivo" } : stato === "sospeso" ? { text: "Sospeso", attention: true } : { text: "Configurazione da completare", attention: true };
  }
  return out;
}

export default function SettingsPage() {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const [, params] = useRoute<{ section: string }>("/dashboard/settings/:section");
  const single = useSinglePane();
  const { visible, ready, plan } = useVisibleSections();
  const statuses = useStatuses(plan, visible);
  const { reg, DraftProvider, ctx } = useDraftHost();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const raw = params?.section ?? null;
  const active = visible.find((s) => s.id === raw) ?? null;
  useDocumentTitle(active ? `${active.label} · Impostazioni` : "Impostazioni");

  // Vecchi link, sezioni sconosciute e (su schermo largo) la radice nuda finiscono tutti in un posto vero.
  useEffect(() => {
    const q = new URLSearchParams(search);
    const tab = q.get("tab");
    if (tab || (raw && LEGACY[raw] && !SECTIONS.some((s) => s.id === raw))) {
      q.delete("tab");
      const target = (tab && LEGACY[tab]) || (raw && LEGACY[raw]) || null;
      // I vecchi ritorni OAuth (?tab=integrations&cal=connected) portano i loro parametri nel catalogo.
      const rest = q.toString();
      navigate(`${target ? settingsHref(target) : "/dashboard/settings"}${rest ? `?${rest}` : ""}`, { replace: true });
      return;
    }
    if (!ready) return;
    if (raw && !active) { navigate("/dashboard/settings", { replace: true }); return; }
    if (!raw && !single && visible[0]) navigate(settingsHref("company"), { replace: true });
  }, [search, raw, active, ready, single, visible, navigate]);

  // Modifiche non salvate: chiudere la scheda fa la domanda del browser; seguire un link dentro l'app fa la nostra.
  const dirty = !!reg?.dirty;
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const href = url.pathname + url.search;
      if (href === location) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, location]);

  const leave = useCallback(async (mode: "discard" | "save") => {
    const href = pendingHref;
    if (!href) return;
    if (mode === "save") {
      const ok = await reg?.save();
      if (!ok) { setPendingHref(null); return; }
    } else {
      reg?.discard();
    }
    setPendingHref(null);
    navigate(href);
  }, [pendingHref, reg, navigate]);

  // Un'app aperta dal catalogo è una pagina sua sul telefono: il suo nome, ‹ per tornare al catalogo.
  const openApp = active?.id === "apps" ? appById(new URLSearchParams(search).get("app")) : undefined;
  const header = useMemo(
    () => (!single ? null : openApp ? { title: openApp.name, backHref: APPS_HREF } : active ? { title: active.label, backHref: "/dashboard/settings" } : null),
    [single, active, openApp],
  );
  useMobileHeader(header);

  const showList = !single || !raw;
  const showPane = !!active && (!single || !!raw);

  return (
    <div className={cn("settings animate-in fade-in duration-500", single && raw && "settings-single-section")}>
      {showList && (
        <div className="page-head">
          <div>
            <h1>Impostazioni</h1>
            <p className="sub">La tua impresa, come vendi, i messaggi, le app collegate e il piano.</p>
          </div>
        </div>
      )}
      {/* 641-859 px: una sezione è una pagina sua ma la barra del telefono (e la sua ‹) non c'è — quindi l'indietro sta qui. */}
      {single && raw && (
        <Link href={openApp ? APPS_HREF : "/dashboard/settings"} className="settings-back">
          <ChevronLeft aria-hidden="true" />
          {openApp ? "App collegate" : "Impostazioni"}
        </Link>
      )}
      <div className="settings-grid">
        {showList && (
          <nav className="snav" aria-label="Impostazioni">
            {GROUPS.map((g) => {
              const items = visible.filter((s) => s.group === g.id);
              if (!items.length) return null;
              return (
                <div key={g.id} className="snav-group">
                  <h2 className="snav-group-title">{g.label}</h2>
                  <ul>
                    {items.map((s) => {
                      const Icon = s.icon;
                      const st = statuses[s.id];
                      const current = active?.id === s.id && !single;
                      return (
                        <li key={s.id}>
                          <Link href={settingsHref(s.id)} className={cn("snav-item", current && "on")} aria-current={current ? "page" : undefined}>
                            <span className="snav-ic"><Icon aria-hidden="true" /></span>
                            <span className="snav-txt">
                              <span className="snav-name">{s.label}</span>
                              {st?.text && <span className="snav-status">{st.text}</span>}
                            </span>
                            {st?.attention && <span className="snav-dot" role="img" aria-label="Da sistemare" />}
                            {single && <ChevronRight className="snav-chev" aria-hidden="true" />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        )}
        {showPane && active && (
          <div className="settings-pane">
            <DraftProvider value={ctx}>
              <active.Component key={active.id} />
            </DraftProvider>
            <SaveBar reg={reg} />
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingHref} onOpenChange={(o) => { if (!o) setPendingHref(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uscire senza salvare?</AlertDialogTitle>
            <AlertDialogDescription>Hai modifiche non salvate in questa sezione.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Resta qui</AlertDialogCancel>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => void leave("discard")}>Esci senza salvare</button>
            <button type="button" className="btn btn-sm btn-navy" onClick={() => void leave("save")} disabled={!reg?.valid || reg?.saving}>Salva ed esci</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
