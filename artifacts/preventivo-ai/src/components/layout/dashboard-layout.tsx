import { Link, useLocation } from "wouter";
import { UserButton, useAuth, RedirectToSignIn } from "@clerk/react";
import { LayoutDashboard, FileText, Plus, User, Menu, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-[3px] border-violet-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!userId) {
    return <RedirectToSignIn />;
  }

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/quotes", label: "Preventivi", icon: FileText },
    { href: "/dashboard/profile", label: "Profilo Aziendale", icon: User },
    { href: "/dashboard/billing", label: "Piano & Fatturazione", icon: CreditCard },
  ];

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/dashboard" && location.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "text-violet-700 bg-violet-50 font-semibold"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className={cn("h-4 w-4", isActive ? "text-violet-600" : "text-gray-400")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] flex bg-gray-50/40">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-gray-100 bg-white shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center">
            <Logo />
          </Link>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-6">
          <div className="px-1">
            <Link
              href="/dashboard/new"
              className="btn-gradient inline-flex w-full h-10 items-center justify-center gap-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Nuovo Preventivo
            </Link>
          </div>

          <div className="px-1">
            <NavLinks />
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center gap-3">
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          <span className="text-sm font-medium text-gray-400">Account</span>
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
                  <Link
                    href="/dashboard"
                    className="flex items-center"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Logo />
                  </Link>
                </div>
                <div className="p-4 flex flex-col gap-6">
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
