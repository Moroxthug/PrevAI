import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import DashboardHome from "@/pages/dashboard/index";
import NewQuote from "@/pages/dashboard/new";
import QuotesList from "@/pages/dashboard/quotes/index";
import QuoteDetail from "@/pages/dashboard/quotes/[id]";
import ProfileSettings from "@/pages/dashboard/profile";
import BillingPage from "@/pages/dashboard/billing";
import SettingsPage from "@/pages/dashboard/settings";
import AnalyticsPage from "@/pages/dashboard/analytics";
import OnboardingPage from "@/pages/onboarding";
import SeoLanding from "@/pages/seo/[type]";
import SeoCityLanding from "@/pages/seo/city-landing";
import PrivacyPage from "@/pages/privacy";
import TerminiPage from "@/pages/termini";
import AdminPage from "@/pages/admin";
import CatalogPage from "@/pages/dashboard/catalog";

import { PublicLayout } from "@/components/layout/public-layout";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

const queryClient = new QueryClient();

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetBusinessProfile({
    query: { queryKey: ["getBusinessProfile"], enabled: isLoaded && !!userId, retry: false }
  });

  const shouldRedirect =
    isLoaded &&
    !isLoading &&
    !!userId &&
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
        <OnboardingGuard><DashboardLayout><DashboardHome /></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/new" component={() => (
        <OnboardingGuard><DashboardLayout><NewQuote /></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/quotes" component={() => (
        <OnboardingGuard><DashboardLayout><QuotesList /></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/quotes/:id" component={() => (
        <OnboardingGuard><DashboardLayout><QuoteDetail /></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/analytics" component={() => (
        <OnboardingGuard><DashboardLayout><AnalyticsPage /></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/settings/account" component={() => (
        <OnboardingGuard><DashboardLayout><SettingsPage /></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/settings" component={() => (
        <OnboardingGuard><DashboardLayout><SettingsPage /></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/profile" component={() => (
        <OnboardingGuard><DashboardLayout><ProfileSettings /></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/billing" component={() => (
        <OnboardingGuard><DashboardLayout><BillingPage /></DashboardLayout></OnboardingGuard>
      )} />
      <Route path="/dashboard/catalog" component={() => (
        <OnboardingGuard><DashboardLayout><CatalogPage /></DashboardLayout></OnboardingGuard>
      )} />

      <Route path="/seo/:type/:city" component={() => <PublicLayout><SeoCityLanding /></PublicLayout>} />
      <Route path="/seo/:type" component={() => <PublicLayout><SeoLanding /></PublicLayout>} />

      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/termini" component={TerminiPage} />
      <Route path="/admin" component={AdminPage} />

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
