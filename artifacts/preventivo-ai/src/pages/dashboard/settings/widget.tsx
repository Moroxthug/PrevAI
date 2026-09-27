import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { Loader2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { ActionRow, SettingsGroup, SettingsSection } from "./ui";
import { useBusinessProfile } from "./data";

/**
 * Vendere → Widget per il sito: l'unico posto del widget (prima compariva sia
 * qui sia in "Profilo aziendale"). La chiave e il codice sono azioni, non
 * campi, quindi niente passa dalla barra Salva.
 */
export function WidgetSection() {
  const { t } = useLanguage();
  const { data: profile, isLoading } = useBusinessProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<"key" | "code" | null>(null);
  const apiKey = profile?.apiKey || "";

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/business-profile/apikey", { method: "POST" });
      if (!res.ok) throw new Error(t("dashboard.settings.widget.errorGenerating"));
      await queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: t("dashboard.settings.widget.apiKeyGenerated") });
    } catch (err) {
      toast({ title: t("dashboard.settings.widget.errorGenerating"), description: err instanceof Error ? err.message : t("dashboard.settings.widget.tryAgainLater"), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copy = (text: string, what: "key" | "code") => {
    void navigator.clipboard.writeText(text);
    setCopied(what);
    toast({ title: t("dashboard.settings.widget.copiedToClipboard") });
    setTimeout(() => setCopied(null), 2000);
  };

  const widgetUrl = typeof window !== "undefined" ? `${window.location.origin}/widget.js` : "https://prevai.it/widget.js";
  const embedCode = `<!-- PrevAI Widget Funnel -->
<div id="prevai-widget">
  <a href="https://prevai.it" rel="noopener">${t("dashboard.settings.widget.embedAnchorText")}</a>
</div>
<script
  src="${widgetUrl}"
  data-api-key="${apiKey}"
  async
></script>`;

  return (
    <SettingsSection title="Widget per il sito" intro={t("dashboard.settings.widget.desc")}>
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
      ) : !apiKey ? (
        <SettingsGroup>
          <ActionRow label={t("dashboard.settings.widget.step1Title")} help={t("dashboard.settings.widget.noKeyDesc")}>
            <button type="button" onClick={generate} disabled={generating} className="btn btn-navy btn-sm gap-2">
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("dashboard.settings.widget.generateKeyButton")}
            </button>
          </ActionRow>
        </SettingsGroup>
      ) : (
        <>
          <SettingsGroup title={t("dashboard.settings.widget.step1Title")} desc={t("dashboard.settings.widget.step1Desc")}>
            <div className="sgroup-pad swidget-key">
              <input readOnly aria-label={t("dashboard.settings.widget.step1Title")} value={apiKey} className="swidget-mono" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={() => copy(apiKey, "key")} className="btn btn-outline-navy btn-sm">
                {copied === "key" ? t("dashboard.settings.widget.copied") : t("dashboard.settings.widget.copy")}
              </button>
              <button type="button" onClick={generate} disabled={generating} className="btn btn-outline-navy btn-sm gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t("dashboard.settings.account.widgetCard.regenerate")}
              </button>
            </div>
          </SettingsGroup>

          <SettingsGroup
            title={t("dashboard.settings.widget.step2Title")}
            desc={t("dashboard.settings.widget.step2Desc")}
            action={
              <button type="button" onClick={() => copy(embedCode, "code")} className="btn btn-navy btn-sm">
                {copied === "code" ? t("dashboard.settings.widget.copied") : t("dashboard.settings.widget.copyCode")}
              </button>
            }
          >
            <div className="sgroup-pad">
              <pre tabIndex={0} aria-label={t("dashboard.settings.widget.step2Title")} className="swidget-code">{embedCode}</pre>
            </div>
          </SettingsGroup>
        </>
      )}
    </SettingsSection>
  );
}
