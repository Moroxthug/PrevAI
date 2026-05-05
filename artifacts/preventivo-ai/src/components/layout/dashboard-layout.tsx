import { Link, useLocation } from "wouter";
import { UserButton, useAuth, RedirectToSignIn } from "@clerk/react";
import { LayoutDashboard, FileText, Plus, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!isLoaded) {
    return <div className="min-h-[100dvh] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  }

  if (!userId) {
    return <RedirectToSignIn />;
  }

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/quotes", label: "Preventivi", icon: FileText },
    { href: "/dashboard/profile", label: "Profilo Aziendale", icon: User },
  ];

  return (
    <div className="min-h-[100dvh] flex bg-muted/20">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="h-16 flex items-center px-6 border-b">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl text-primary tracking-tight">
            <div className="bg-primary text-primary-foreground p-1 rounded-md">
              <FileText className="h-4 w-4" />
            </div>
            PreventivoAI
          </Link>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-6">
          <div className="px-2">
            <Button asChild className="w-full justify-start gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90" size="lg">
              <Link href="/dashboard/new">
                <Plus className="h-4 w-4" />
                Nuovo Preventivo
              </Link>
            </Button>
          </div>

          <nav className="flex flex-col gap-1 px-2">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t flex items-center justify-between">
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          <span className="text-sm font-medium text-muted-foreground">Account</span>
        </div>
      </aside>

      {/* Mobile Layout */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-16 flex items-center justify-between px-4 border-b bg-card">
          <div className="flex items-center gap-2">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">Menu di navigazione</SheetTitle>
                <div className="h-16 flex items-center px-6 border-b">
                  <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl text-primary tracking-tight" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="bg-primary text-primary-foreground p-1 rounded-md">
                      <FileText className="h-4 w-4" />
                    </div>
                    PreventivoAI
                  </Link>
                </div>
                <div className="p-4 flex flex-col gap-6">
                  <Button asChild className="w-full justify-start gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90" size="lg" onClick={() => setIsMobileMenuOpen(false)}>
                    <Link href="/dashboard/new">
                      <Plus className="h-4 w-4" />
                      Nuovo Preventivo
                    </Link>
                  </Button>
                  <nav className="flex flex-col gap-1">
                    {navItems.map((item) => {
                      const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="font-bold text-lg text-primary tracking-tight">
              PreventivoAI
            </Link>
          </div>
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
