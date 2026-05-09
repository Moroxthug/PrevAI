import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import OnboardingPage from "@/pages/onboarding";
import PrivacyPage from "@/pages/privacy";
import TerminiPage from "@/pages/termini";

const DashboardHome = lazy(() => import("@/pages/dashboard/index"));
const NewQuote = lazy(() => import("@/pages/dashboard/new"));
const QuotesList = lazy(() => import("@/pages/dashboard/quotes/index"));
const QuoteDetail = lazy(() => import("@/pages/dashboard/quotes/[id]"));
const ProfileSettings = lazy(() => import("@/pages/dashboard/profile"));
const BillingPage = lazy(() => import("@/pages/dashboard/billing"));
const SettingsPage = lazy(() => import("@/pages/dashboard/settings"));
const CatalogPage = lazy(() => import("@/pages/dashboard/catalog"));
const AnalyticsPage = lazy(() => import("@/pages/dashboard/analytics"));
const AdminPage = lazy(() => import("@/pages/admin"));
const ClientsPage = lazy(() => import("@/pages/dashboard/clients/index"));
const ClientDetailPage = lazy(() => import("@/pages/dashboard/clients/[name]"));
const InvoicesPage = lazy(() => import("@/pages/dashboard/invoices"));
const CrmPage = lazy(() => import("@/pages/dashboard/crm"));

const SeoLanding = lazy(() => import("@/pages/seo/[type]"));
const SeoCityLanding = lazy(() => import("@/pages/seo/city-landing"));
const BlogPage = lazy(() => import("@/pages/blog/index"));
const BlogArticlePage = lazy(() => import("@/pages/blog/[slug]"));
const BlogCategoryPage = lazy(() => import("@/pages/blog/categoria/[slug]"));

import { PublicLayout } from "@/components/layout/public-layout";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetBusinessProfile, getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { isOnboardingSkipped } from "@/lib/onboarding-state";

const queryClient = new QueryClient();

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

function DashSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <PublicLayout><Home /></PublicLayout>} />
      <Route path="/sign-in" component={() => <PublicLayout><SignInPage /></PublicLayout>} />
      <Route path="/sign-in/:rest*" component={() => <PublicLayout><SignInPage /></PublicLayout>} />
      <Route path="/sign-up" component={() => <PublicLayout><SignUpPage /></PublicLayout>} />
      <Route path="/sign-up/:rest*" component={() => <PublicLayout><SignUpPage /></PublicLayout>} />

      <Route path="/onboarding" component={OnboardingPage} />

      <Route path="/dashboard" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><DashboardHome /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/new" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><NewQuote /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/quotes" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><QuotesList /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/quotes/:id" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><QuoteDetail /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/analytics" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><AnalyticsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/settings/account" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><SettingsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/settings" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><SettingsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/profile" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><ProfileSettings /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/billing" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><BillingPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/catalog" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><CatalogPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/clients/:name" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><ClientDetailPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/clients" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><ClientsPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/invoices" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><InvoicesPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/crm" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><CrmPage /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />

      <Route path="/seo/:type/:city" component={() => <PublicLayout><Suspense fallback={null}><SeoCityLanding /></Suspense></PublicLayout>} />
      <Route path="/seo/:type" component={() => <PublicLayout><Suspense fallback={null}><SeoLanding /></Suspense></PublicLayout>} />

      <Route path="/blog/categoria/:slug" component={() => <PublicLayout><Suspense fallback={null}><BlogCategoryPage /></Suspense></PublicLayout>} />
      <Route path="/blog/:slug" component={() => <PublicLayout><Suspense fallback={null}><BlogArticlePage /></Suspense></PublicLayout>} />
      <Route path="/blog" component={() => <PublicLayout><Suspense fallback={null}><BlogPage /></Suspense></PublicLayout>} />

      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/termini" component={TerminiPage} />
      <Route path="/admin" component={() => <DashSuspense><AdminPage /></DashSuspense>} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
