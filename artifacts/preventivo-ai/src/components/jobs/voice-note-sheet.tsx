import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square } from "lucide-react";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { useToast } from "@/hooks/use-toast";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi } from "@/lib/jobs-api";
import { cn } from "@/lib/utils";
import { jobNotesKey } from "./notes-card";

/**
 * APP-4a (row 30) — "Nota vocale" from the phone's +: the job is already
 * picked, the recording starts as the sheet opens, you tap stop, read the
 * text (and fix it if you like), save. The note lands in the job's Notes
 * card. Only the text is kept; the audio goes to the same transcription
 * service as the quote composer and is not stored.
 */
export function VoiceNoteSheet({ job, onClose, onSaved }: { job: { id: string; name: string } | null; onClose: () => void; onSaved: (jobId: string) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const started = useRef(false);

  const jobId = job?.id ?? "";
  const { data, isLoading } = useQuery({ queryKey: jobNotesKey(jobId), queryFn: () => jobsApi.listNotes(jobId), enabled: !!job });
  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceInput({
    onTranscribed: (said) => setText((prev) => (prev.trim() ? `${prev.trim()} ${said}` : said)),
    onError: (message) => setMicError(message),
  });

  // Start listening as soon as we know notes can be saved (one tap from the + to talking).
  useEffect(() => {
    if (!job) { started.current = false; setText(""); setMicError(null); return; }
    if (data?.available && !started.current) { started.current = true; void startRecording(); }
  }, [job, data?.available, startRecording]);

  const save = useMutation({
    mutationFn: () => jobsApi.addNote(jobId, { body: text.trim(), source: "voice" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobNotesKey(jobId) });
      toast({ title: t("mobile.new.noteSaved") });
      onSaved(jobId);
    },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  const close = () => { if (isRecording) stopRecording(); onClose(); };
  const busy = isTranscribing || save.isPending;

  return (
    <BottomSheet
      open={!!job}
      onOpenChange={(v) => { if (!v && !save.isPending) close(); }}
      title={t("mobile.new.voiceNote")}
      description={job?.name}
      noAutoFocus
      footer={data?.available ? (
        <>
          <button type="button" className="btn btn-outline-navy" onClick={close} disabled={save.isPending}>{t("mobile.cancel")}</button>
          <button type="button" className="btn btn-navy" onClick={() => save.mutate()} disabled={!text.trim() || isRecording || busy} data-primary-action>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.notes.add")}
          </button>
        </>
      ) : undefined}
    >
      {isLoading ? (
        <p className="more-empty"><Loader2 className="h-4 w-4 animate-spin" /></p>
      ) : !data?.available ? (
        <p className="more-empty">{t("jobs.notes.unavailable")}</p>
      ) : (
        <div className="vnote">
          <button
            type="button"
            className={cn("vnote-mic", isRecording && "rec")}
            onClick={() => { setMicError(null); if (isRecording) stopRecording(); else void startRecording(); }}
            disabled={busy}
            aria-label={isRecording ? t("mic.stop") : t("jobs.notes.dictate")}
          >
            {isTranscribing ? <Loader2 className="animate-spin" /> : isRecording ? <Square className="fill-current" /> : <Mic />}
          </button>
          <p className="vnote-state" aria-live="polite">
            {isTranscribing ? t("mobile.new.transcribing") : isRecording ? t("mobile.new.listening") : text ? t("mobile.new.checkText") : t("mobile.new.tapToTalk")}
          </p>
          {micError && <p className="vnote-err" role="alert">{micError}</p>}
          <div className="field">
            <label htmlFor="vnote-text" className="sr-only">{t("jobs.notes.placeholder")}</label>
            <textarea id="vnote-text" rows={4} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder={t("jobs.notes.placeholder")} disabled={busy} />
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
