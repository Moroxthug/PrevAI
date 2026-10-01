import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { setOutboxQueryClient, startOutbox } from "@/lib/offline/outbox";
import { installSyncFetch } from "@/lib/sync/install";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Every public page is lazy (Phase 68): auth, onboarding, legal, contact,
// WhatsApp, sitemap were ~55 kB of the bundle the homepage had to load first.
// PERF-1: the homepage too — inside the App chunk it cost every dashboard,
// link and auth screen ~20 kB gzip (home.tsx + the blog index). "/" is
// server-rendered and hydrated, so the HTML stays on screen until the chunk
// arrives (it loads after the page's load event, see main.tsx).
const Home = lazy(() => import("@/pages/home"));
const WhatsappPage = lazy(() => import("@/pages/whatsapp"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const SignUpPage = lazy(() => import("@/pages/sign-up"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const PrivacyPage = lazy(() => import("@/pages/privacy-policy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const ChiSiamoPage = lazy(() => import("@/pages/chi-siamo"));
const ContattiPage = lazy(() => import("@/pages/contatti"));
const MappaSitoPage = lazy(() => import("@/pages/mappa-sito"));
const HelpIndexPage = lazy(() => import("@/pages/help/index"));
const HelpArticlePage = lazy(() => import("@/pages/help/[slug]"));
const AmministrazioneLandingPage = lazy(() => import("@/pages/amministrazione"));

import { PATHS } from "@/data/sitemap-routes";

const DashboardHome = lazy(() => import("@/pages/dashboard/index"));
const NewQuote = lazy(() => import("@/pages/dashboard/new"));
const QuotesList = lazy(() => import("@/pages/dashboard/quotes/index"));
const QuoteDetail = lazy(() => import("@/pages/dashboard/quotes/[id]"));
const BillingPage = lazy(() => import("@/pages/dashboard/billing"));
const SettingsPage = lazy(() => import("@/pages/dashboard/settings"));
const CatalogPage = lazy(() => import("@/pages/dashboard/catalog"));
const AnalyticsPage = lazy(() => import("@/pages/dashboard/analytics"));
const AdminPage = lazy(() => import("@/pages/admin"));
const ClientsPage = lazy(() => import("@/pages/dashboard/clients/index"));
const LeadsListPage = lazy(() => import("@/pages/dashboard/leads/index"));
const ImportsPage = lazy(() => import("@/pages/dashboard/imports/index"));
const ClientDetailPage = lazy(() => import("@/pages/dashboard/clients/[name]"));
const InvoicesPage = lazy(() => import("@/pages/dashboard/invoices"));
const AmministrazionePage = lazy(() => import("@/pages/dashboard/amministrazione"));
const AmministrazioneAttivaPage = lazy(() => import("@/pages/dashboard/amministrazione-attiva"));
const FiscoPage = lazy(() => import("@/pages/dashboard/fisco"));
const CommercialistaClientePage = lazy(() => import("@/pages/dashboard/commercialista"));
const StudioPage = lazy(() => import("@/pages/studio/index"));
const StudioIncaricoPage = lazy(() => import("@/pages/studio/incarico"));
const ScadenzarioPage = lazy(() => import("@/pages/dashboard/scadenzario"));
const PrimaNotaPage = lazy(() => import("@/pages/dashboard/prima-nota"));
const BancaPage = lazy(() => import("@/pages/dashboard/banca"));
const ChiusuraPage = lazy(() => import("@/pages/dashboard/chiusura"));
const CommercialistaPage = lazy(() => import("@/pages/commercialista/[token]"));
const InvoiceDetailPage = lazy(() => import("@/pages/dashboard/invoices/[id]"));
const PublicInvoicePage = lazy(() => import("@/pages/i/[token]"));
const PortalPage = lazy(() => import("@/pages/portal/[token]"));
const JobsListPage = lazy(() => import("@/pages/dashboard/jobs/index"));
const JobDetailPage = lazy(() => import("@/pages/dashboard/jobs/[id]"));
const JobSetupPage = lazy(() => import("@/pages/dashboard/jobs/setup"));
const TeamPage = lazy(() => import("@/pages/dashboard/team"));
const SchedulePage = lazy(() => import("@/pages/dashboard/schedule"));
const AssistantPage = lazy(() => import("@/pages/dashboard/assistant"));
const WorkerTimePage = lazy(() => import("@/pages/t/[token]"));
const TeamInvitePage = lazy(() => import("@/pages/team-invite/[token]"));
const JoinCodePage = lazy(() => import("@/pages/entra"));
const DocumentsPage = lazy(() => import("@/pages/dashboard/documents"));
const ArchivePage = lazy(() => import("@/pages/dashboard/archive"));
const NotificationsPage = lazy(() => import("@/pages/dashboard/notifications"));
const PublicQuotePage = lazy(() => import("@/pages/p/[id]"));

const SeoLanding = lazy(() => import("@/pages/seo/[type]"));
const SeoCityLanding = lazy(() => import("@/pages/seo/city-landing"));
const BlogPage = lazy(() => import("@/pages/blog/index"));
const ContractsListPage = lazy(() => import("@/pages/dashboard/contracts/index"));
const ContractDetailPage = lazy(() => import("@/pages/dashboard/contracts/[id]"));
const SignPage = lazy(() => import("@/pages/sign/[token]"));
const BlogArticlePage = lazy(() => import("@/pages/blog/[slug]"));
const BlogCategoryPage = lazy(() => import("@/pages/blog/categoria/[slug]"));

import { PublicLayout } from "@/components/layout/public-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { LanguageProvider } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { isOnboardingSkipped } from "@/lib/onboarding-state";
import { RouteEffects, SkipLink } from "@/components/route-effects";

// SYNC-1: il QueryClient (regole di freschezza) sta in lib/query-client.ts, così main.tsx lo riempie dal dispositivo prima del primo render.
// La coda di invio aggiorna le schermate dopo un invio; ogni scrittura passa dal livello di sync (chiavi di idempotenza, versioni, coda, fusione).
setOutboxQueryClient(queryClient);
startOutbox();
installSyncFetch();

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetBusinessProfile({
    query: { queryKey: getGetBusinessProfileQueryKey(), enabled: isLoaded && !!userId, retry: false }
  });

  const skipped = isLoaded && !!userId && isOnboardingSkipped(userId);

  const shouldRedirect =
    isLoaded &&
    !isLoading &&
    !!userId &&
    !skipped &&
    location !== "/onboarding" &&
    profile !== undefined &&
    profile.companyName === "";

  useEffect(() => {
    if (shouldRedirect) {
      setLocation("/onboarding");
    }
  }, [shouldRedirect, setLocation]);

  if (shouldRedirect) return null;
  return <>{children}</>;
}

// PERF-1: while a public page chunk loads, hold the viewport so the footer
// does not paint under the header and then jump down (CLS 0.62 on /sign-in
// with the empty app shell). Hydrated pages keep their server HTML instead.
function PageFallback() {
  return <div className="min-h-screen" aria-hidden="true" />;
}

function DashSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

// Lazy so the dashboard chunk is not a static dependency of the public entry:
// a static import here would make Vite modulepreload the whole dashboard
// bundle on the marketing homepage (Phase 61 finding).
const DashboardLayoutLazy = lazy(() =>
  import("@/components/layout/dashboard-layout").then((m) => ({ default: m.DashboardLayout })),
);
function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardLayoutLazy>{children}</DashboardLayoutLazy>
    </Suspense>
  );
}

// UX-1: while a screen's chunk or first data loads, a thin bar and a ghost of the page appear after a short grace period (a screen that is
// already in cache must never flash them), instead of an empty content area.
function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-label="Caricamento">
      <div className="route-progress" aria-hidden="true" />
      <div className="page-ghost" aria-hidden="true">
        <span className="ghost-line ghost-title" />
        <span className="ghost-line" />
        <span className="ghost-card" />
        <span className="ghost-card" />
      </div>
    </div>
  );
}

// UX-1: tutte le pagine della dashboard vivono dentro lo stesso guscio. Prima ogni pagina aveva il proprio <DashboardLayout>, e a ogni cambio
// pagina barra laterale, intestazione e schede venivano smontate e rimontate (lampeggio, perdita di fuoco e di stato). Ora cambia solo il
// contenuto, che entra con una dissolvenza breve (spenta con «riduci movimento»).
function DashboardShell() {
  const [location] = useLocation();
  // Le sezioni delle impostazioni sono la stessa pagina: non devono rimontarsi (né perdere le modifiche in corso) passando da una all'altra.
  const pageKey = location.replace(/^(\/dashboard\/settings)\/.*/, "$1");
  return (
    <OnboardingGuard>
      <DashboardLayout>
        <Suspense fallback={<PageLoading />}>
          <div key={pageKey} className="page-enter">
            <Switch>
              <Route path="/dashboard" component={DashboardHome} />
              <Route path="/dashboard/new" component={NewQuote} />
              <Route path="/dashboard/quotes" component={QuotesList} />
              <Route path="/dashboard/quotes/:id" component={QuoteDetail} />
              <Route path="/dashboard/analytics" component={AnalyticsPage} />
              <Route path="/dashboard/settings/:section" component={SettingsPage} />
              <Route path="/dashboard/settings" component={SettingsPage} />
              <Route path="/dashboard/billing" component={BillingPage} />
              <Route path="/dashboard/catalog" component={CatalogPage} />
              <Route path="/dashboard/clients/:id" component={ClientDetailPage} />
              <Route path="/dashboard/clients" component={ClientsPage} />
              <Route path="/dashboard/leads" component={LeadsListPage} />
              <Route path="/dashboard/imports" component={ImportsPage} />
              <Route path="/dashboard/contracts/:id" component={ContractDetailPage} />
              <Route path="/dashboard/contracts" component={ContractsListPage} />
              <Route path="/dashboard/invoices/:id" component={InvoiceDetailPage} />
              <Route path="/dashboard/invoices" component={InvoicesPage} />
              <Route path="/dashboard/amministrazione/attiva" component={AmministrazioneAttivaPage} />
              <Route path="/dashboard/amministrazione" component={AmministrazionePage} />
              <Route path="/dashboard/fisco/prima-nota" component={PrimaNotaPage} />
              <Route path="/dashboard/fisco/banca" component={BancaPage} />
              <Route path="/dashboard/fisco/chiusura" component={ChiusuraPage} />
              <Route path="/dashboard/fisco/commercialista" component={CommercialistaClientePage} />
              <Route path="/dashboard/fisco/scadenzario" component={ScadenzarioPage} />
              <Route path="/dashboard/fisco" component={FiscoPage} />
              <Route path="/dashboard/jobs/:id/setup" component={JobSetupPage} />
              <Route path="/dashboard/jobs/:id" component={JobDetailPage} />
              <Route path="/dashboard/jobs" component={JobsListPage} />
              <Route path="/dashboard/assistant" component={AssistantPage} />
              <Route path="/dashboard/team" component={TeamPage} />
              <Route path="/dashboard/schedule" component={SchedulePage} />
              <Route path="/dashboard/documents" component={DocumentsPage} />
              <Route path="/dashboard/archive" component={ArchivePage} />
              <Route path="/dashboard/notifications" component={NotificationsPage} />
              <Route component={NotFound} />
            </Switch>
          </div>
        </Suspense>
      </DashboardLayout>
    </OnboardingGuard>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public pages — paths from sitemap-routes.ts (shared with generate-sitemap.ts) */}
      <Route path={PATHS.HOME} component={() => <PublicLayout><Suspense fallback={<PageFallback />}><Home /></Suspense></PublicLayout>} />
      <Route path={PATHS.WHATSAPP} component={() => <PublicLayout><Suspense fallback={<PageFallback />}><WhatsappPage /></Suspense></PublicLayout>} />
      <Route path={PATHS.FISCO} component={() => <PublicLayout><Suspense fallback={<PageFallback />}><AmministrazioneLandingPage /></Suspense></PublicLayout>} />
      <Route path={PATHS.CHI_SIAMO} component={() => <Suspense fallback={null}><ChiSiamoPage /></Suspense>} />
      <Route path={PATHS.CONTATTI} component={() => <Suspense fallback={null}><ContattiPage /></Suspense>} />
      <Route path={PATHS.PRIVACY} component={() => <Suspense fallback={null}><PrivacyPage /></Suspense>} />
      <Route path={PATHS.TERMINI} component={() => <Suspense fallback={null}><TermsPage /></Suspense>} />
      {/* Percorsi PrevAI mantenuti come redirect verso gli URL v1 indicizzati */}
      <Route path="/privacy-policy" component={() => <Redirect to={PATHS.PRIVACY} />} />
      <Route path="/terms" component={() => <Redirect to={PATHS.TERMINI} />} />
      <Route path={PATHS.MAPPA_SITO} component={() => <Suspense fallback={null}><MappaSitoPage /></Suspense>} />
      {/* Help centre — Phase 70; articles from HELP_ARTICLES */}
      <Route path="/help/:slug" component={() => <PublicLayout><Suspense fallback={<PageFallback />}><HelpArticlePage /></Suspense></PublicLayout>} />
      <Route path={PATHS.HELP} component={() => <PublicLayout><Suspense fallback={<PageFallback />}><HelpIndexPage /></Suspense></PublicLayout>} />

      {/* Auth routes (not indexed) */}
      <Route path="/sign-in" component={() => <PublicLayout><Suspense fallback={<PageFallback />}><SignInPage /></Suspense></PublicLayout>} />
      <Route path="/sign-in/:rest*" component={() => <PublicLayout><Suspense fallback={<PageFallback />}><SignInPage /></Suspense></PublicLayout>} />
      <Route path="/reset-password" component={() => <PublicLayout><Suspense fallback={<PageFallback />}><ResetPasswordPage /></Suspense></PublicLayout>} />
      <Route path="/sign-up" component={() => <PublicLayout><Suspense fallback={<PageFallback />}><SignUpPage /></Suspense></PublicLayout>} />
      <Route path="/sign-up/:rest*" component={() => <PublicLayout><Suspense fallback={<PageFallback />}><SignUpPage /></Suspense></PublicLayout>} />

      <Route path="/onboarding" component={() => <Suspense fallback={null}><OnboardingPage /></Suspense>} />

      {/* Dashboard (private, not indexed): UX-1 — il guscio (barra laterale, intestazione, schede) è uno solo e resta montato tra una pagina e l'altra */}
      <Route path="/dashboard/admin" component={() => <DashSuspense><AdminPage /></DashSuspense>} />
      {/* APP-1b: il vecchio profilo aziendale è la sezione Dati dell'impresa. */}
      <Route path="/dashboard/profile" component={() => <Redirect to="/dashboard/settings/company" />} />
      <Route path={/^\/dashboard(?:\/.*)?$/} component={DashboardShell} />
      {/* The old CRM is retired (Phase 2): its working parts live in Jobs */}
      <Route path="/crm" component={() => <Redirect to="/dashboard/jobs" />} />
      <Route path="/crm/:rest*" component={() => <Redirect to="/dashboard/jobs" />} />

      {/* Public e-signature page: the customer signs the contract from the emailed link */}
      <Route path="/sign/:token" component={() => <Suspense fallback={null}><SignPage /></Suspense>} />
      {/* Public invoice page: the customer sees the balance + payment instructions from the emailed link */}
      <Route path="/i/:token" component={() => <Suspense fallback={null}><PublicInvoicePage /></Suspense>} />
      {/* CLI-1: area clienti — tutto quello che l'impresa ha mandato a questo cliente, dietro un codice via email */}
      <Route path="/portal/:token" component={() => <Suspense fallback={null}><PortalPage /></Suspense>} />
      {/* A-6: lo studio del professionista — utente autenticato ma non un'impresa: niente onboarding, niente menu del cantiere */}
      <Route path="/studio/incarichi/:id" component={() => <Suspense fallback={null}><StudioIncaricoPage /></Suspense>} />
      <Route path="/studio" component={() => <Suspense fallback={null}><StudioPage /></Suspense>} />
      {/* A-4: pacchetto dell'anno in sola lettura per il commercialista (link con scadenza, revocabile) */}
      <Route path="/commercialista/:token" component={() => <Suspense fallback={null}><CommercialistaPage /></Suspense>} />
      {/* Public worker time-entry page (magic link from the Team page) */}
      <Route path="/t/:token" component={() => <Suspense fallback={null}><WorkerTimePage /></Suspense>} />
      {/* Team member invite accept page (emailed link, Phase 7) */}
      <Route path="/team-invite/:token" component={() => <Suspense fallback={null}><TeamInvitePage /></Suspense>} />
      {/* TEAM-1: entrare nella squadra con un codice d'accesso (l'accesso personale lo crea la persona) */}
      <Route path="/entra" component={() => <Suspense fallback={null}><JoinCodePage /></Suspense>} />

      {/* Pagina pubblica: il cliente finale visualizza e accetta il preventivo (link condiviso via WhatsApp/email) */}
      <Route path="/p/:id" component={() => <Suspense fallback={null}><PublicQuotePage /></Suspense>} />

      {/* SEO landing pages — dynamic, driven by SECTORS / CITIES data */}
      <Route path="/preventivi/:type/:city" component={() => <PublicLayout><Suspense fallback={<PageFallback />}><SeoCityLanding /></Suspense></PublicLayout>} />
      <Route path="/preventivi/:type" component={() => <PublicLayout><Suspense fallback={<PageFallback />}><SeoLanding /></Suspense></PublicLayout>} />

      {/* Blog — dynamic, driven by BLOG_ARTICLES / BLOG_CATEGORIES data */}
      <Route path="/blog/categoria/:slug" component={() => <PublicLayout><Suspense fallback={<PageFallback />}><BlogCategoryPage /></Suspense></PublicLayout>} />
      <Route path="/blog/:slug" component={() => <PublicLayout><Suspense fallback={<PageFallback />}><BlogArticlePage /></Suspense></PublicLayout>} />
      <Route path={PATHS.BLOG} component={() => <PublicLayout><Suspense fallback={<PageFallback />}><BlogPage /></Suspense></PublicLayout>} />

      <Route component={NotFound} />
    </Switch>
  );
}

import { identifyUser, resetUser } from "@/lib/analytics";

function PostHogIdentify() {
  const { user, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded || !import.meta.env.VITE_POSTHOG_KEY) return;
    if (user) {
      identifyUser(user.id, { email: user.email, name: user.name });
    } else {
      resetUser();
    }
  }, [user, isLoaded]);

  return null;
}

/**
 * `ssr` is only passed by scripts/prerender-seo.ts (via entry-server.tsx) to
 * render the homepage to static HTML at build time; the browser bundle never
 * sets it, and main.tsx hydrates that markup.
 */
function App({ ssr }: { ssr?: { path: string; lang: Lang } } = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* The wouter Router sits above LanguageProvider because the provider
          (V2-2: monolingua) resta sotto il router per il render SSR; under the
          build-time render (ssrPath) that must be the same router. */}
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")} ssrPath={ssr?.path}>
        <LanguageProvider initialLang={ssr?.lang}>
          <TooltipProvider>
            <PostHogIdentify />
            <SkipLink />
            <RouteEffects />
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
            <Toaster />
          </TooltipProvider>
        </LanguageProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
