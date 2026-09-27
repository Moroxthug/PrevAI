import { Link } from "wouter";
import { Logo } from "@/components/logo";

/**
 * A-6: la cornice dello studio. Il professionista non è un'impresa cliente:
 * niente menu di preventivi e cantieri, niente onboarding aziendale.
 */
export function StudioShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="doc-shell" style={{ padding: "24px 16px", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 16 }}>
          <Link href="/studio" aria-label="Studio — PrevAI">
            <Logo />
          </Link>
          <span className="chip chip-grey">Studio del professionista</span>
        </div>
        <main>{children}</main>
        <p className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 24, textAlign: "center" }}>
          PrevAI fornisce lo strumento; la prestazione professionale, la responsabilità e la polizza sono del professionista.
        </p>
      </div>
    </div>
  );
}
