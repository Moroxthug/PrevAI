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
                <li>
                  <a
                    href="mailto:supporto@prevai.it"
                    className="hover:text-foreground transition-colors"
                  >
                    Supporto
                  </a>
                </li>
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

      {/* ── WhatsApp live chat ───────────────────────────────── */}
      <a
        href="https://wa.me/393791059492"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chatta con noi su WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full shadow-lg shadow-green-200/60 transition-all duration-200 hover:scale-105 active:scale-95 group"
        style={{ background: "#25D366" }}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#25D366" }}>
          <WhatsAppIcon />
        </span>
        <span className="pr-5 text-white text-sm font-semibold whitespace-nowrap hidden sm:inline-block">
          Hai bisogno di aiuto?
        </span>
      </a>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width="28"
      height="28"
      fill="white"
    >
      <path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.675 4.797 1.849 6.785L2 30l7.438-1.82A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.842-1.6l-.418-.248-4.41 1.08 1.112-4.3-.272-.44A11.46 11.46 0 0 1 4.5 16C4.5 9.649 9.649 4.5 16 4.5S27.5 9.649 27.5 16 22.351 27.5 16 27.5zm6.29-8.61c-.344-.172-2.036-1.004-2.352-1.118-.317-.115-.547-.172-.778.172-.23.344-.893 1.118-1.094 1.348-.2.23-.403.258-.747.086-.344-.172-1.452-.535-2.766-1.707-1.022-.912-1.713-2.038-1.913-2.382-.2-.344-.021-.53.15-.7.155-.155.344-.403.517-.604.172-.2.23-.344.344-.574.115-.23.057-.43-.029-.603-.086-.172-.778-1.876-1.066-2.568-.28-.673-.566-.582-.778-.593l-.663-.011c-.23 0-.603.086-.919.43s-1.207 1.18-1.207 2.876 1.236 3.337 1.408 3.567c.172.23 2.432 3.712 5.892 5.206.824.355 1.467.568 1.969.727.827.263 1.58.226 2.175.137.663-.099 2.036-.832 2.323-1.635.287-.804.287-1.493.2-1.636-.086-.143-.317-.23-.66-.402z" />
    </svg>
  );
}
