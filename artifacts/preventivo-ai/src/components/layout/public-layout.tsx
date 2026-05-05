import { Link } from "wouter";
import { UserButton, useAuth } from "@clerk/react";
import { FileText } from "lucide-react";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary tracking-tight">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
              <FileText className="h-5 w-5" />
            </div>
            PreventivoAI
          </Link>
          <nav className="flex items-center gap-4">
            {!isSignedIn ? (
              <>
                <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">
                  Accedi
                </Link>
                <Link href="/sign-up" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  Registrati
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                  Dashboard
                </Link>
                <UserButton />
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="border-t py-12 md:py-16 bg-muted/40">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight mb-4">
                <FileText className="h-5 w-5" />
                PreventivoAI
              </Link>
              <p className="text-sm text-muted-foreground max-w-xs">
                Il software di preventivazione con AI per artigiani e PMI italiane.
                Veloce, professionale, pronto in 30 secondi.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Professioni</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/seo/imbianchino" className="hover:text-primary transition-colors">Imbianchino</Link></li>
                <li><Link href="/seo/elettricista" className="hover:text-primary transition-colors">Elettricista</Link></li>
                <li><Link href="/seo/idraulico" className="hover:text-primary transition-colors">Idraulico</Link></li>
                <li><Link href="/seo/edilizia" className="hover:text-primary transition-colors">Edilizia</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Azienda</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/chi-siamo" className="hover:text-primary transition-colors">Chi Siamo</Link></li>
                <li><Link href="/contatti" className="hover:text-primary transition-colors">Contatti</Link></li>
                <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link href="/termini" className="hover:text-primary transition-colors">Termini di Servizio</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} PreventivoAI. Tutti i diritti riservati.
          </div>
        </div>
      </footer>
    </div>
  );
}
