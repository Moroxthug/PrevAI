import { Link, useLocation } from "wouter";
import { UserButton, useAuth, RedirectToSignIn } from "@clerk/react";
import { LayoutDashboard, FileText, User, Menu, CreditCard, BarChart3, Settings, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/quotes", label: "Preventivi", icon: FileText, exact: false },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, exact: false },
  { href: "/dashboard/settings", label: "Impostazioni", icon: Settings, exact: false },
  { href: "/dashboard/settings/account", label: "Account Aziendale", icon: User, exact: false },
];

function isActive(navHref: string, location: string, exact: boolean) {
  if (exact) return location === navHref;
  if (navHref === "/dashboard/settings" && location === "/dashboard/settings/account") return false;
  return location === navHref || location.startsWith(navHref + "/") || location.startsWith(navHref + "?");
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(isCollapsed)); } catch {}
  }, [isCollapsed]);

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-[3px] border-violet-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!userId) return <RedirectToSignIn />;

  const NavLinks = ({ collapsed = false, onClick }: { collapsed?: boolean; onClick?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, location, item.exact);
        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={cn(
              "flex items-center rounded-xl transition-all",
              collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5",
              "text-sm font-medium",
              active
                ? "text-violet-700 bg-violet-50 font-semibold"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-violet-600" : "text-gray-400")} />
            {!collapsed && <span>{item.label}</span>}
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
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo + toggle */}
        <div className={cn("h-16 flex items-center border-b border-gray-100", isCollapsed ? "justify-center px-2" : "px-5 justify-between")}>
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center">
              <Logo />
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(v => !v)}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            title={isCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className={cn("flex-1 flex flex-col gap-4 py-4", isCollapsed ? "px-2" : "px-4")}>
          {/* New quote button */}
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/new"
                  className="btn-gradient h-10 w-10 mx-auto flex items-center justify-center rounded-xl"
                >
                  <Plus className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Nuovo Preventivo</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard/new"
              className="btn-gradient inline-flex w-full h-10 items-center justify-center gap-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Nuovo Preventivo
            </Link>
          )}

          <NavLinks collapsed={isCollapsed} />
        </div>

        <div className={cn("border-t border-gray-100 py-3 flex items-center", isCollapsed ? "justify-center px-2" : "gap-3 px-4")}>
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          {!isCollapsed && <span className="text-sm font-medium text-gray-400">Account</span>}
        </div>
      </aside>

      {/* Mobile Layout */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-16 flex items-center justify-between px-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-white">
                <SheetTitle className="sr-only">Menu di navigazione</SheetTitle>
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                  <Link href="/dashboard" className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
                    <Logo />
                  </Link>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <Link
                    href="/dashboard/new"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="btn-gradient inline-flex w-full h-10 items-center justify-center gap-2 text-sm font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                    Nuovo Preventivo
                  </Link>
                  <NavLinks onClick={() => setIsMobileMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex items-center">
              <Logo style={{ height: 28 }} />
            </Link>
          </div>
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
