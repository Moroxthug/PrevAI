import { useEffect, useMemo, useRef, type ComponentType } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useGetSubscription } from "@workspace/api-client-react";
import { ChevronRight } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { hasFeature } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { SettingsSection, useSinglePane } from "../ui";
import { useBusinessProfile } from "../data";
import { APPS, APP_GROUPS, APPS_HREF, RETURN_PARAMS, appById, appHref, type AppDef, type AppId } from "./catalog";
import { useAppStatuses, type AppStatus } from "./status";
import { BrandLogo, LockNote, StatusPill } from "./ui";
import { ApiPanel, GmailPanel, GoogleCalendarPanel, MetaLeadsPanel, OutlookCalendarPanel, StripePanel } from "./panels";

// ── APP-1b (come QuoteAI Phase 103): App collegate come catalogo ─────────────
// Riquadri con il logo di ciascuna azienda, raggruppati; prima quelle già
// collegate, quelle che il server non può ancora offrire in una riga in fondo.
// Un riquadro apre il dettaglio — un pannello laterale su schermo largo, una
// pagina sua (/dashboard/settings/apps?app=<id>) sul telefono. Ogni piano vede
// tutto il catalogo; quello che il piano non include ha il lucchetto.

const PANELS: Partial<Record<AppId, ComponentType>> = {
  google_calendar: GoogleCalendarPanel,
  outlook_calendar: OutlookCalendarPanel,
  gmail: GmailPanel,
  stripe: StripePanel,
  meta_leads: MetaLeadsPanel,
  api: ApiPanel,
};

const isLive = (s: AppStatus) => s.state === "connected" || s.state === "attention" || s.state === "paused";

/** Chi ha accesso a cosa: le funzioni calcolate dal server sul profilo, WhatsApp dal piano. */
function useUnlocked() {
  const { data: profile } = useBusinessProfile();
  const { data: sub } = useGetSubscription();
  const plan = sub?.isActive ? sub.plan : null;
  return (app: AppDef) => {
    if (app.minPlan) return plan === "monthly_pro" || plan === "monthly_elite";
    if (!app.feature) return true;
    return hasFeature(profile as never, app.feature);
  };
}

function AppTile({ app, status, onOpen }: { app: AppDef; status: AppStatus; onOpen: (app: AppDef) => void }) {
  const account = isLive(status) && status.detail ? status.detail : null;
  const body = (
    <>
      <BrandLogo app={app} />
      <span className="app-tile-name">{app.name}</span>
      {/* Collegata: l'account (una riga — un'email non va spezzata); altrimenti cosa fa. */}
      <span className={cn("app-tile-line", account && "one", status.state === "attention" && "bad")}>{account ?? app.tagline}</span>
      <span className="app-tile-pill"><StatusPill app={app} status={status} /></span>
    </>
  );
  // WhatsApp, fatture elettroniche e widget hanno una sezione propria; se c'è il lucchetto si apre il dettaglio.
  if (app.section && status.state !== "locked") {
    return <Link href={`/dashboard/settings/${app.section}`} className="app-tile" data-app={app.id}>{body}</Link>;
  }
  return <button type="button" className="app-tile" data-app={app.id} onClick={() => onOpen(app)}>{body}</button>;
}

function AppGrid({ title, apps, statuses, onOpen }: { title: string; apps: AppDef[]; statuses: Record<AppId, AppStatus>; onOpen: (app: AppDef) => void }) {
  if (!apps.length) return null;
  return (
    <section className="app-group" aria-label={title}>
      <h3 className="app-group-title">{title}</h3>
      <ul className="app-grid">
        {apps.map((a) => <li key={a.id}><AppTile app={a} status={statuses[a.id]} onOpen={onOpen} /></li>)}
      </ul>
    </section>
  );
}

/** Cosa fa, cosa condivide e con chi, poi le impostazioni dell'app (o il suo lucchetto). */
function AppDetailBody({ app, status }: { app: AppDef; status: AppStatus }) {
  const Panel = PANELS[app.id];
  return (
    <div className="app-detail">
      <div className="app-about">
        <p>{app.about}</p>
        <p className="app-shared"><b>Cosa condivide:</b> {app.shared}</p>
      </div>
      {status.state === "locked" ? (
        <LockNote app={app} />
      ) : status.state === "soon" ? (
        <p className="app-soon-note">In arrivo: il collegamento con {app.name} non è ancora attivo su PrevAI. Comparirà qui da solo quando sarà pronto.</p>
      ) : app.section ? (
        <Link href={`/dashboard/settings/${app.section}`} className="btn btn-sm btn-navy app-self-start">Apri le impostazioni <ChevronRight aria-hidden="true" /></Link>
      ) : Panel ? (
        <Panel />
      ) : null}
    </div>
  );
}

function AppDetailHead({ app, status }: { app: AppDef; status: AppStatus }) {
  return (
    <header className="app-detail-head">
      <BrandLogo app={app} size="lg" />
      <div className="app-detail-txt">
        <h1 id="settings-section-title">{app.name}</h1>
        <p>{app.tagline}</p>
        <div className="app-detail-pill"><StatusPill app={app} status={status} /></div>
      </div>
    </header>
  );
}

export function AppsSection() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const search = useSearch();
  const single = useSinglePane();
  const isUnlocked = useUnlocked();
  const statuses = useAppStatuses((id) => { const a = appById(id); return !!a && isUnlocked(a); });
  const panelRef = useRef<HTMLDivElement>(null);

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const open = appById(params.get("app"));

  // Di ritorno da una schermata OAuth (…?cal=connected): dire com'è andata e aprire quell'app.
  useEffect(() => {
    for (const r of RETURN_PARAMS) {
      const result = params.get(r.param);
      if (!result) continue;
      const id = r.app(params);
      const name = appById(id)?.name ?? "";
      if (result === "connected") toast({ title: `${name} collegato` });
      else toast({ title: `Non è stato possibile collegare ${name}`, description: "Riprova; se succede ancora scrivi a supporto@prevai.it.", variant: "destructive" });
      navigate(appHref(id), { replace: true });
      return;
    }
  }, [params, navigate, toast]);

  const openApp = (app: AppDef) => navigate(appHref(app.id));
  const close = () => navigate(APPS_HREF, { replace: true });

  const loading = APPS.some((a) => statuses[a.id].state === "loading");
  const soon = APPS.filter((a) => statuses[a.id].state === "soon");
  const live = APPS
    .filter((a) => isLive(statuses[a.id]))
    .sort((a, b) => Number(statuses[b.id].state === "attention") - Number(statuses[a.id].state === "attention"));
  const rest = APPS.filter((a) => !isLive(statuses[a.id]) && statuses[a.id].state !== "soon");
  const owners = [...new Set(APPS.map((a) => a.owner).filter(Boolean))];

  // Sul telefono il dettaglio è una pagina sua (la barra in alto dice quale, con ‹ per tornare al catalogo).
  if (open && single) {
    return (
      <section className="sset app-page" aria-labelledby="settings-section-title">
        <AppDetailHead app={open} status={statuses[open.id]} />
        <AppDetailBody app={open} status={statuses[open.id]} />
      </section>
    );
  }

  return (
    <SettingsSection title="App collegate" intro="Gli strumenti che PrevAI usa per te: calendario, email, pagamenti, contatti. Tocca un'app per vedere cosa fa e cosa condivide.">
      {loading ? (
        <ul className="app-grid" aria-busy="true" aria-label="Caricamento delle app">
          {APPS.slice(0, 6).map((a) => <li key={a.id}><Skeleton className="app-tile-skel" /></li>)}
        </ul>
      ) : (
        <>
          <AppGrid title="Collegate" apps={live} statuses={statuses} onOpen={openApp} />
          {APP_GROUPS.map((g) => (
            <AppGrid key={g.id} title={g.label} apps={rest.filter((a) => a.group === g.id)} statuses={statuses} onOpen={openApp} />
          ))}
        </>
      )}
      {!loading && soon.length > 0 && (
        <section className="app-soon" aria-label="In arrivo">
          <h3 className="app-group-title">In arrivo</h3>
          <ul>
            {soon.map((a) => (
              <li key={a.id}><BrandLogo app={a} /><span>{a.name}</span></li>
            ))}
          </ul>
        </section>
      )}
      <p className="app-tm">
        {owners.join(", ")} sono titolari dei rispettivi marchi. I loghi servono solo a indicare con quale prodotto PrevAI si collega e non indicano alcuna sponsorizzazione.
      </p>

      {open && !single && (
        <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
          {/* Il fuoco va sul pannello, non sul suo primo interruttore (un bordo di fuoco su una riga che nessuno ha scelto). */}
          <DialogContent ref={panelRef} className="side" size="lg" tabIndex={-1} onOpenAutoFocus={(e) => { e.preventDefault(); panelRef.current?.focus(); }}>
            <div className="modal-head app-detail-head">
              <BrandLogo app={open} size="lg" />
              <div className="txt">
                <DialogTitle>{open.name}</DialogTitle>
                <DialogDescription>{open.tagline}</DialogDescription>
                <div className="app-detail-pill"><StatusPill app={open} status={statuses[open.id]} /></div>
              </div>
            </div>
            <DialogBody>
              <AppDetailBody app={open} status={statuses[open.id]} />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </SettingsSection>
  );
}
