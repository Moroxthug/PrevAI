import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi } from "@/lib/jobs-api";

/**
 * APP-1e (QuoteAI Phase 106): the two things you do standing on site, docked
 * at the bottom of the job page on a phone (StickyActionBar) and next to ⋯ on
 * wider screens. QuoteAI docks Photo + Dictate; PrevAI has no dictation on a
 * job yet (row 30, APP-4a), so the primary is the receipt: a photo of it goes
 * to the AI reader already tied to this job, then the Costs tab opens with it
 * waiting for review. Both render as direct children of the bar.
 */
export function JobDockActions({ jobId, onReceipt, onPhoto }: { jobId: string; onReceipt: () => void; onPhoto: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);

  const photo = useMutation({
    mutationFn: (file: File) => jobsApi.uploadPhoto(jobId, file),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] }); toast({ title: t("jobs.m.photoSaved") }); onPhoto(); },
    onError: (e: Error) => toast({ title: t("jobs.photos.uploadError"), description: e.message, variant: "destructive" }),
  });
  const receipt = useMutation({
    mutationFn: (file: File) => jobsApi.scanReceipt(file, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["costs-review"] });
      toast({ title: t("mobile.new.receiptSaved") });
      onReceipt();
    },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <button type="button" className="btn btn-outline-navy secondary" disabled={photo.isPending} onClick={() => photoRef.current?.click()}>
        {photo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {t("jobs.m.photo")}
      </button>
      <button type="button" className="btn btn-navy" disabled={receipt.isPending} onClick={() => receiptRef.current?.click()} data-primary-action>
        {receipt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} {receipt.isPending ? t("jobs.costs.scanning") : t("jobs.m.receipt")}
      </button>
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) photo.mutate(f); e.target.value = ""; }} />
      <input ref={receiptRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) receipt.mutate(f); e.target.value = ""; }} />
    </>
  );
}
