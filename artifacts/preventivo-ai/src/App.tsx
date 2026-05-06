import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from "@clerk/react";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import DashboardHome from "@/pages/dashboard/index";
import NewQuote from "@/pages/dashboard/new";
import QuotesList from "@/pages/dashboard/quotes/index";
import QuoteDetail from "@/pages/dashboard/quotes/[id]";
import ProfileSettings from "@/pages/dashboard/profile";
import SeoLanding from "@/pages/seo/[type]";

import { PublicLayout } from "@/components/layout/public-layout";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <PublicLayout><Home /></PublicLayout>} />
      <Route path="/sign-in" component={() => <PublicLayout><SignInPage /></PublicLayout>} />
      <Route path="/sign-in/:rest*" component={() => <PublicLayout><SignInPage /></PublicLayout>} />
      <Route path="/sign-up" component={() => <PublicLayout><SignUpPage /></PublicLayout>} />
      <Route path="/sign-up/:rest*" component={() => <PublicLayout><SignUpPage /></PublicLayout>} />
      
      <Route path="/dashboard" component={() => <DashboardLayout><DashboardHome /></DashboardLayout>} />
      <Route path="/dashboard/new" component={() => <DashboardLayout><NewQuote /></DashboardLayout>} />
      <Route path="/dashboard/quotes" component={() => <DashboardLayout><QuotesList /></DashboardLayout>} />
      <Route path="/dashboard/quotes/:id" component={() => <DashboardLayout><QuoteDetail /></DashboardLayout>} />
      <Route path="/dashboard/profile" component={() => <DashboardLayout><ProfileSettings /></DashboardLayout>} />
      
      <Route path="/seo/:type" component={() => <PublicLayout><SeoLanding /></PublicLayout>} />
      
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
