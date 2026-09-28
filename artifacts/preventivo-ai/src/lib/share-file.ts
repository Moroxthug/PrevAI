/**
 * APP-4a (row 30) — hand a file to the phone's own share sheet (WhatsApp,
 * Mail, Drive…) with the Web Share API. Android Chrome and iPhone Safari
 * support sharing files; most desktop browsers don't, so callers show the
 * action only when `canShareFiles()` says yes.
 *
 * The browser only allows share() shortly after a tap. Building the PDF can
 * take longer than that, so a "needs-tap" result means: the file is ready,
 * ask for one more tap and call `shareFile` again from that tap.
 */
export type ShareResult = "shared" | "cancelled" | "needs-tap" | "failed";

export function canShareFiles(): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.canShare !== "function" || typeof navigator.share !== "function") return false;
    return navigator.canShare({ files: [new File(["%PDF"], "prova.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

export async function shareFile(file: File, opts: { title?: string; text?: string } = {}): Promise<ShareResult> {
  try {
    await navigator.share({ files: [file], ...(opts.title ? { title: opts.title } : {}), ...(opts.text ? { text: opts.text } : {}) });
    return "shared";
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "AbortError") return "cancelled";
    if (name === "NotAllowedError") return "needs-tap";
    return "failed";
  }
}
