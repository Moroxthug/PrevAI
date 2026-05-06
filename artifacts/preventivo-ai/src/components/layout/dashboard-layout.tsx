import { Link, useLocation } from "wouter";
import { useAuth, useUser, useClerk, RedirectToSignIn } from "@clerk/react";
import { LayoutDashboard, FileText, Menu, BarChart3, Settings, ChevronLeft, ChevronRight, Plus, LogOut, User, CreditCard, Building2, ChevronDown, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGetSubscription } from "@workspace/api-client-react";

const BASE_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true, proOnly: false },
  { href: "/dashboard/quotes", label: "Preventivi", icon: FileText, exact: false, proOnly: false },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, exact: false, proOnly: false },
  { href: "/dashboard/catalog", label: "Listino", icon: BookOpen, exact: false, proOnly: true },
  { href: "/dashboard/settings", label: "Impostazioni", icon: Settings, exact: false, proOnly: false },
];

function isActive(navHref: string, location: string, exact: boolean) {
  if (exact) return location === navHref;
  return location === navHref || location.startsWith(navHref + "/") || location.startsWith(navHref + "?");
}

function AccountMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const name = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Account";
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? user?.firstName?.[1] ?? "");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button className="h-10 w-10 mx-auto flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors shrink-0">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center uppercase">
                    {initials || <User className="h-4 w-4" />}
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{name}</TooltipContent>
          </Tooltip>
        ) : (
          <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors group text-left">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt={name} className="h-8 w-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center uppercase shrink-0">
                {initials || <User className="h-4 w-4" />}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-700 truncate leading-tight">{name}</div>
              {email && <div className="text-xs text-gray-400 truncate leading-tight">{email}</div>}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 shrink-0" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-52 mb-1">
        <div className="px-2 py-1.5">
          <div className="text-sm font-semibold text-gray-800 truncate">{name}</div>
          {email && <div className="text-xs text-gray-400 truncate">{email}</div>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=account" className="cursor-pointer flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" /> Profilo Aziendale
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=billing" className="cursor-pointer flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gray-400" /> Piano & Fatturazione
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="cursor-pointer flex items-center gap-2">
            <Settings className="h-4 w-4 text-gray-400" /> Impostazioni
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: "/" })}
          className="cursor-pointer text-red-600 focus:text-red-600 gap-2"
        >
          <LogOut className="h-4 w-4" /> Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth();
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
        <div className="w-8 h-8 rounded-full border-[3px] border-violet-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!userId) return <RedirectToSignIn />;

  const NAV_ITEMS = BASE_NAV_ITEMS.filter(item => !item.proOnly || isPro);

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
            {!collapsed && (
              <span className="flex-1">{item.label}</span>
            )}
            {!collapsed && item.proOnly && (
              <Badge className="text-[10px] px-1 py-0 h-4 bg-violet-100 text-violet-700 border-0 font-semibold">Pro</Badge>
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

        {/* Account section */}
        <div className={cn("border-t border-gray-100 py-3", isCollapsed ? "px-2" : "px-3")}>
          <AccountMenu collapsed={isCollapsed} />
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
              <SheetContent side="left" className="w-72 p-0 bg-white flex flex-col">
                <SheetTitle className="sr-only">Menu di navigazione</SheetTitle>
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                  <Link href="/dashboard" className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
                    <Logo />
                  </Link>
                </div>
                <div className="flex-1 p-4 flex flex-col gap-4">
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
                <div className="border-t border-gray-100 p-3">
                  <AccountMenu />
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex items-center">
              <Logo style={{ height: 28 }} />
            </Link>
          </div>
          <AccountMenu />
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
