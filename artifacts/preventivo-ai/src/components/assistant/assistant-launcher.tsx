import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Maximize2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AssistantChat } from "@/components/assistant/assistant-panel";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * APP-8a (QuoteAI Phase 133) — one assistant, reachable from every dashboard
 * screen: the ✦ in the top bar opens the same conversation as the Assistente
 * page, in a panel docked to the right on a computer and a tall sheet on a
 * phone. It knows the screen behind it (lib/assistant-context.ts), so on a
 * job "com'è messo?" means that job.
 */
export function AssistantLauncher() {
  const { t } = useLanguage();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  // Following a link from a card (or anywhere) closes the panel, like the other sheets.
  useEffect(() => { setOpen(false); }, [location]);
  if (location.startsWith("/dashboard/assistant")) return null;

  return (
    <>
      <button type="button" className="tb-asst" onClick={() => setOpen(true)} aria-label={t("assistant.openPanel")} aria-haspopup="dialog" aria-expanded={open} title={t("assistant.openPanel")}>
        <Sparkles aria-hidden="true" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="asst-panel sheet" tall aria-describedby={undefined}>
          <div className="sheet-grab" aria-hidden="true" />
          <DialogTitle className="sr-only">{t("assistant.title")}</DialogTitle>
          <Link href="/dashboard/assistant" className="ic-btn asst-full" aria-label={t("assistant.openFull")} title={t("assistant.openFull")}>
            <Maximize2 aria-hidden="true" />
          </Link>
          {open && <AssistantChat compact />}
        </DialogContent>
      </Dialog>
    </>
  );
}
