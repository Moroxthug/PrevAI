import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * CLI-1: "Vedi tutto" — sotto un preventivo, un contratto o una fattura, il
 * link all'area clienti dove ci sono anche tutti gli altri documenti.
 */
export function PortalLinkCard({ url, companyName, className }: { url: string; companyName: string; className?: string }) {
  const { t } = useLanguage();
  return (
    <a href={url} className={cn("card p-4 flex items-center gap-3 text-sm no-underline", className)} style={{ boxShadow: "var(--shadow-card)" }}>
      <LayoutDashboard className="h-5 w-5 shrink-0" style={{ color: "var(--navy)" }} aria-hidden="true" />
      <span className="grow" style={{ color: "var(--ink)" }}>
        <b style={{ color: "var(--navy)" }}>{t("portalLink.title").replace("{company}", companyName)}</b>
        <span className="block text-xs" style={{ color: "var(--muted-mk)" }}>{t("portalLink.desc")}</span>
      </span>
      <span className="btn btn-sm btn-outline-navy shrink-0 whitespace-nowrap">{t("portalLink.open")}</span>
    </a>
  );
}
