import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Maximize2, Mic, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AssistantChat } from "@/components/assistant/assistant-panel";
import { useLanguage } from "@/i18n/LanguageContext";
import { onOpenAssistant, openAssistant } from "@/lib/assistant-open";

/**
 * APP-8a (QuoteAI Phase 133) — one assistant, reachable from every dashboard
 * screen: the ✦ in the top bar opens the same conversation as the Assistente
 * page, in a panel docked to the right on a computer and a tall sheet on a
 * phone. It knows the screen behind it (lib/assistant-context.ts), so on a
 * job "com'è messo?" means that job. APP-8d: the "Chiedi o detta…" row on
 * Oggi opens it too (lib/assistant-open.ts).
 */
export function AssistantLauncher() {
  const { t } = useLanguage();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [dictate, setDictate] = useState(false);
  // Following a link from a card (or anywhere) closes the panel, like the other sheets.
  useEffect(() => { setOpen(false); }, [location]);
  useEffect(() => onOpenAssistant((r) => { setDictate(r.dictate); setOpen(true); }), []);
  if (location.startsWith("/dashboard/assistant")) return null;

  return (
    <>
      <button type="button" className="tb-asst" onClick={() => { setDictate(false); setOpen(true); }} aria-label={t("assistant.openPanel")} aria-haspopup="dialog" aria-expanded={open} title={t("assistant.openPanel")}>
        <Sparkles aria-hidden="true" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="asst-panel sheet" tall aria-describedby={undefined}>
          <div className="sheet-grab" aria-hidden="true" />
          <DialogTitle className="sr-only">{t("assistant.title")}</DialogTitle>
          <Link href="/dashboard/assistant" className="ic-btn asst-full" aria-label={t("assistant.openFull")} title={t("assistant.openFull")}>
            <Maximize2 aria-hidden="true" />
          </Link>
          {open && <AssistantChat compact startDictation={dictate} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * APP-8d — the one line on Oggi: "Chiedi o detta…". Tapping it opens the
 * assistant ready to type; the microphone opens it already listening.
 */
export function AssistantAskRow() {
  const { t } = useLanguage();
  return (
    <div className="asst-ask" data-testid="assistant-ask-row">
      <button type="button" className="asst-ask-main" onClick={() => openAssistant({ dictate: false })} aria-haspopup="dialog">
        <Sparkles aria-hidden="true" />
        <span>{t("assistant.askRow")}</span>
      </button>
      <button type="button" className="asst-ask-mic" onClick={() => openAssistant({ dictate: true })} aria-label={t("assistant.askRowDictate")} title={t("assistant.askRowDictate")} aria-haspopup="dialog">
        <Mic aria-hidden="true" />
      </button>
    </div>
  );
}
