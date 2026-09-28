import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { canShareFiles, shareFile } from "@/lib/share-file";

/**
 * APP-4a (row 30) — "Condividi PDF" for a quote or an invoice: builds the
 * file, hands it to the phone's share sheet (WhatsApp, Mail, Drive…). When
 * building took longer than the browser lets a share wait after the tap, a
 * small sheet asks for one more tap. `canShare` is false on browsers that
 * can't share files (most desktops): callers hide the action there.
 *
 *   const pdf = usePdfShare({ onShared: () => track(…) });
 *   pdf.canShare && { label: "Condividi PDF", onSelect: () => pdf.share(buildFile) }
 *   …{pdf.sheet}
 */
export function usePdfShare({ onShared }: { onShared?: () => void } = {}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const canShare = useMemo(() => canShareFiles(), []);
  const [ready, setReady] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const hand = async (file: File) => {
    const result = await shareFile(file, { title: file.name.replace(/\.pdf$/i, "") });
    if (result === "needs-tap") { setReady(file); return; }
    setReady(null);
    if (result === "shared") onShared?.();
    if (result === "failed") toast({ title: t("share.failedTitle"), description: t("share.failed"), variant: "destructive" });
  };

  /** `build` fetches the PDF; it shows its own error and returns null when it can't. */
  const share = async (build: () => Promise<File | null>) => {
    if (busy) return;
    setBusy(true);
    try {
      const file = await build();
      if (file) await hand(file);
    } finally {
      setBusy(false);
    }
  };

  const sheet = (
    <BottomSheet
      open={!!ready}
      onOpenChange={(v) => { if (!v) setReady(null); }}
      title={t("share.ready")}
      description={ready?.name}
      footer={
        <>
          <button type="button" className="btn btn-outline-navy" onClick={() => setReady(null)}>{t("mobile.cancel")}</button>
          <button type="button" className="btn btn-navy" onClick={() => ready && void hand(ready)} data-primary-action><Share2 className="h-4 w-4" /> {t("share.go")}</button>
        </>
      }
    >
      <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("share.readyDesc")}</p>
    </BottomSheet>
  );

  return { canShare, busy, share, sheet };
}

/** Fetch a PDF the signed-in user can read and wrap it as a File for sharing. */
export async function fetchPdfFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`PDF ${res.status}`);
  return new File([await res.blob()], filename, { type: "application/pdf" });
}
