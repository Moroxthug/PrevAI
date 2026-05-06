import { Link } from "wouter";
import { UserButton, useAuth } from "@clerk/react";
import { Logo } from "@/components/logo";
import { useScrolled } from "@/hooks/use-scrolled";
import { cn } from "@/lib/utils";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const scrolled = useScrolled(20);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300",
          scrolled
            ? "navbar-glass"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>
          <nav className="flex items-center gap-3">
            {!isSignedIn ? (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full"
                >
                  Accedi
                </Link>
                <Link
                  href="/sign-up"
                  className="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold"
                >
                  Registrati
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full"
                >
                  Dashboard
                </Link>
                <UserButton />
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="border-t py-12 md:py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center mb-4">
                <Logo />
              </Link>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Il software di preventivazione con AI per artigiani e PMI italiane.
                Veloce, professionale, pronto in 30 secondi.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Professioni</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/seo/imbianchino" className="hover:text-foreground transition-colors">Imbianchino</Link></li>
                <li><Link href="/seo/elettricista" className="hover:text-foreground transition-colors">Elettricista</Link></li>
                <li><Link href="/seo/idraulico" className="hover:text-foreground transition-colors">Idraulico</Link></li>
                <li><Link href="/seo/edilizia" className="hover:text-foreground transition-colors">Edilizia</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Azienda</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/chi-siamo" className="hover:text-foreground transition-colors">Chi Siamo</Link></li>
                <li><Link href="/contatti" className="hover:text-foreground transition-colors">Contatti</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link href="/termini" className="hover:text-foreground transition-colors">Termini di Servizio</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} prevai. Tutti i diritti riservati.
          </div>
        </div>
      </footer>
    </div>
  );
}
