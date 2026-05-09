import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, Menu, BarChart3, Settings, ChevronLeft, ChevronRight, Plus, LogOut, User, CreditCard, Building2, ChevronDown, BookOpen, Users, Receipt, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGetSubscription } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";

const BASE_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true, proOnly: false, comingSoon: false },
  { href: "/dashboard/quotes", label: "Preventivi", icon: FileText, exact: false, proOnly: false, comingSoon: false },
  { href: "/dashboard/clients", label: "Clienti", icon: Users, exact: false, proOnly: false, comingSoon: false },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, exact: false, proOnly: false, comingSoon: false },
  { href: "/dashboard/catalog", label: "Listino", icon: BookOpen, exact: false, proOnly: true, comingSoon: false },
  { href: "/dashboard/invoices", label: "Fatture", icon: Receipt, exact: false, proOnly: false, comingSoon: true },
  { href: "/dashboard/crm", label: "CRM", icon: Briefcase, exact: false, proOnly: false, comingSoon: true },
  { href: "/dashboard/settings", label: "Impostazioni", icon: Settings, exact: false, proOnly: false, comingSoon: false },
];

function isActive(navHref: string, location: string, exact: boolean) {
  if (exact) return location === navHref;
  return location === navHref || location.startsWith(navHref + "/") || location.startsWith(navHref + "?");
}

function AccountMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useAuth();
  const name = user?.name || user?.email?.split("@")[0] || "Account";
  const email = user?.email ?? "";
  const initials = name.slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button className="h-9 w-9 mx-auto flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                <div className="h-7 w-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center uppercase">
                  {initials || <User className="h-3.5 w-3.5" />}
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{name}</TooltipContent>
          </Tooltip>
        ) : (
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group text-left">
            <div className="h-7 w-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center uppercase shrink-0">
              {initials || <User className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-700 truncate leading-tight">{name}</div>
              {email && <div className="text-[10px] text-gray-400 truncate leading-tight">{email}</div>}
            </div>
            <ChevronDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600 shrink-0" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-48 mb-1">
        <div className="px-2 py-1">
          <div className="text-xs font-semibold text-gray-800 truncate">{name}</div>
          {email && <div className="text-[10px] text-gray-400 truncate">{email}</div>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=account" className="cursor-pointer flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-gray-400" /> Profilo Aziendale
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=billing" className="cursor-pointer flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5 text-gray-400" /> Piano & Fatturazione
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="cursor-pointer flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-gray-400" /> Impostazioni
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600 gap-2"
        >
          <LogOut className="h-3.5 w-3.5" /> Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  const { data: subscription } = useGetSubscription();
  const isPro = subscription?.isActive && subscription?.plan === "monthly_pro";

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(isCollapsed)); } catch {}
  }, [isCollapsed]);

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="w-7 h-7 rounded-full border-[3px] border-violet-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    window.location.href = "/sign-in";
    return null;
  }

  const NAV_ITEMS = BASE_NAV_ITEMS.filter(item => !item.proOnly || isPro);

  const NavLinks = ({ collapsed = false, onClick }: { collapsed?: boolean; onClick?: () => void }) => (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, location, item.exact);
        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={cn(
              "flex items-center rounded-lg transition-all",
              collapsed ? "justify-center h-9 w-9 mx-auto" : "gap-2.5 px-2.5 py-2",
              "text-sm font-medium",
              active
                ? "text-violet-700 bg-violet-50 font-semibold"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-violet-600" : "text-gray-400")} />
            {!collapsed && (
              <span className="flex-1 text-sm">{item.label}</span>
            )}
            {!collapsed && item.proOnly && (
              <Badge className="text-[10px] px-1 py-0 h-4 bg-violet-100 text-violet-700 border-0 font-semibold">Pro</Badge>
            )}
            {!collapsed && item.comingSoon && (
              <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-100 text-amber-600 border-0 font-semibold">Presto</Badge>
            )}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
            </Tooltip>
          );
        }
        return link;
      })}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] flex bg-gray-50/40">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-gray-100 bg-white shadow-sm transition-all duration-200 shrink-0",
          isCollapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo + toggle */}
        <div className={cn("h-14 flex items-center border-b border-gray-100", isCollapsed ? "justify-center px-2" : "px-4 justify-between")}>
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center">
              <Logo />
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(v => !v)}
            className="h-6 w-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            title={isCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className={cn("flex-1 flex flex-col gap-3 py-3", isCollapsed ? "px-2" : "px-3")}>
          {/* New quote button */}
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/new"
                  className="btn-gradient h-9 w-9 mx-auto flex items-center justify-center rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Nuovo Preventivo</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard/new"
              className="btn-gradient inline-flex w-full h-9 items-center justify-center gap-2 text-sm font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuovo Preventivo
            </Link>
          )}

          <NavLinks collapsed={isCollapsed} />
        </div>

        {/* Account section */}
        <div className={cn("border-t border-gray-100 py-2", isCollapsed ? "px-2" : "px-2")}>
          <AccountMenu collapsed={isCollapsed} />
        </div>
      </aside>

      {/* Mobile Layout */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 h-8 w-8">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-white flex flex-col">
                <SheetTitle className="sr-only">Menu di navigazione</SheetTitle>
                <div className="h-14 flex items-center px-5 border-b border-gray-100">
                  <Link href="/dashboard" className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
                    <Logo />
                  </Link>
                </div>
                <div className="flex-1 p-3 flex flex-col gap-3">
                  <Link
                    href="/dashboard/new"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="btn-gradient inline-flex w-full h-9 items-center justify-center gap-2 text-sm font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nuovo Preventivo
                  </Link>
                  <NavLinks onClick={() => setIsMobileMenuOpen(false)} />
                </div>
                <div className="border-t border-gray-100 p-2">
                  <AccountMenu />
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex items-center">
              <Logo style={{ height: 26 }} />
            </Link>
          </div>
          <AccountMenu />
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
