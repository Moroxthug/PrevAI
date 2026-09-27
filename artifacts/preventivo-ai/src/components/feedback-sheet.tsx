import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { sendFeedback, FeedbackError } from "@/lib/app-beta";

/**
 * APP-5 — "Segnala un problema". A sheet on the phone (from Altro), a modal on
 * desktop (from the account menu). The text goes to the ops inbox and to the
 * admin's Beta app panel together with the page, the surface and the version.
 */
export function FeedbackSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const send = useMutation({
    mutationFn: () => sendFeedback(message.trim()),
    onSuccess: () => {
      setMessage("");
      onOpenChange(false);
      toast({ title: t("feedback.sent"), description: t("feedback.sentDesc") });
    },
    onError: (e: Error) => toast({ title: t("feedback.error"), description: e instanceof FeedbackError && e.message ? e.message : undefined, variant: "destructive" }),
  });
  const ready = message.trim().length >= 5;

  return (
    <BottomSheet
      open={open}
      onOpenChange={(v) => { if (!send.isPending) onOpenChange(v); }}
      title={t("feedback.title")}
      description={t("feedback.desc")}
      footer={
        <>
          <button type="button" className="btn btn-outline-navy" onClick={() => onOpenChange(false)} disabled={send.isPending}>{t("mobile.cancel")}</button>
          <button type="button" className="btn btn-navy" onClick={() => send.mutate()} disabled={!ready || send.isPending}>
            {send.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("feedback.send")}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="feedback-message">{t("feedback.label")}</label>
        <textarea
          id="feedback-message"
          rows={5}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("feedback.placeholder")}
        />
      </div>
    </BottomSheet>
  );
}
