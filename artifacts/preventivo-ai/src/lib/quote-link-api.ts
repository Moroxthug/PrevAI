// SEC-4: the customer's link to a quote (/p/…) — revocable, with an expiry.
// Hand-written like usage-api.ts (not in the orval client).

export type QuoteLinkDto = {
  /** Null when the link was revoked (sharing again makes a new one). */
  url: string | null;
  expiresAt: string | null;
  revoked: boolean;
  /** False until the server's migration 0016 has run: no expiry, no revocation yet. */
  managed: boolean;
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new Error(body.message || body.error || `Request failed (${res.status})`);
  return body;
}

export const quoteLinkApi = {
  get: (quoteId: string) => req<QuoteLinkDto>(`/api/quotes/${quoteId}/public-link`),
  /** Makes the link (a new one after a revocation) and moves its expiry forward. */
  share: (quoteId: string) => req<QuoteLinkDto>(`/api/quotes/${quoteId}/public-link`, { method: "POST", body: "{}" }),
  revoke: (quoteId: string) => req<QuoteLinkDto>(`/api/quotes/${quoteId}/public-link`, { method: "DELETE" }),
};

/**
 * Copies a URL that is still being fetched. Safari only lets the clipboard be
 * written inside the click, so the pending value goes in as a ClipboardItem
 * promise; elsewhere (or on older browsers) wait for it and write the text.
 */
export async function copyPendingText(pending: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": pending.then((t) => new Blob([t], { type: "text/plain" })) })]);
      return;
    } catch (err) {
      // A failed fetch must surface as that failure, not as a clipboard one.
      await pending;
      if (!(err instanceof DOMException)) throw err;
    }
  }
  await navigator.clipboard.writeText(await pending);
}
