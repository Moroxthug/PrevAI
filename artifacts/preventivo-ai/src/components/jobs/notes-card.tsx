import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Loader2, Mic, StickyNote, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MicButton } from "@/components/mic-button";
import { RowMore } from "@/components/mobile/row-more";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, type JobNoteDto } from "@/lib/jobs-api";

export const jobNotesKey = (jobId: string) => ["job-notes", jobId] as const;

/**
 * APP-4a (row 30, after QuoteAI Phase 78) — short notes on a job, on the
 * Overview tab: typed here or dictated (the mic turns speech into text in the
 * box, you read it and save). The phone's + → "Nota vocale" saves into the
 * same list. Renders nothing until migration 0011 runs (`available: false`).
 */
export function NotesCard({ jobId }: { jobId: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [dictated, setDictated] = useState(false);

  const key = jobNotesKey(jobId);
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => jobsApi.listNotes(jobId) });
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const add = useMutation({
    mutationFn: (body: string) => jobsApi.addNote(jobId, { body, source: dictated ? "voice" : "typed" }),
    onSuccess: ({ note }) => {
      setDraft("");
      setDictated(false);
      queryClient.setQueryData(key, (prev: typeof data) => (prev ? { ...prev, notes: [note, ...prev.notes] } : prev));
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (noteId: string) => jobsApi.deleteNote(jobId, noteId),
    onSuccess: (_r, noteId) => queryClient.setQueryData(key, (prev: typeof data) => (prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : prev)),
    onError,
  });

  if (!isLoading && !data?.available) return null;
  const notes: JobNoteDto[] = data?.notes ?? [];
  const submit = () => { const b = draft.trim(); if (b && !add.isPending) add.mutate(b); };

  return (
    <section className="card" data-testid="job-notes">
      <div className="card-head">
        <div><h2><StickyNote className="inline h-4 w-4 mr-1 -mt-0.5" />{t("jobs.notes.title")}</h2></div>
        {notes.length > 0 && <span className="foot-note">{notes.length}</span>}
      </div>
      <div className="act-body note-compose">
        <div className="card composer comp-box">
          <label htmlFor={`note-${jobId}`} className="sr-only">{t("jobs.notes.placeholder")}</label>
          <textarea
            id={`note-${jobId}`}
            rows={2}
            value={draft}
            maxLength={4000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
            placeholder={t("jobs.notes.placeholder")}
            disabled={add.isPending}
          />
          <div className="comp-tools">
            <MicButton
              disabled={add.isPending}
              label={t("jobs.notes.dictate")}
              onTranscribed={(text) => { setDictated(true); setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text)); }}
            />
            <button type="button" className="btn btn-sm btn-navy ml-auto" onClick={submit} disabled={!draft.trim() || add.isPending}>
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.notes.add")}
            </button>
          </div>
        </div>
      </div>
      {isLoading ? (
        <div className="act-body"><Skeleton className="h-12 w-full" /></div>
      ) : notes.length === 0 ? (
        <div className="card-empty">{t("jobs.notes.empty")}</div>
      ) : (
        <div>
          {notes.map((n) => (
            <div key={n.id} className="item-row note-row">
              <div className="grow">
                <p className="note-body">{n.body}</p>
                <span className="sub">
                  {n.source === "voice" && <><Mic className="inline h-3 w-3 -mt-0.5" aria-hidden="true" /> {t("jobs.notes.voice")} · </>}
                  {[n.authorName, formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: it })].filter(Boolean).join(" · ")}
                </span>
              </div>
              <span className="hover-act hide-phone">
                <button type="button" className="ic-btn danger" aria-label={t("jobs.notes.delete")} disabled={remove.isPending} onClick={() => remove.mutate(n.id)}><Trash2 /></button>
              </span>
              <RowMore label={t("jobs.notes.actions")} actions={[{ label: t("jobs.notes.delete"), icon: Trash2, danger: true, onSelect: () => remove.mutate(n.id) }]} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
