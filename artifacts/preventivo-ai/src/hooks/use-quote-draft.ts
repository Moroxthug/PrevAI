import { useCallback, useEffect, useRef, useState } from "react";

/**
 * APP-4a (row 30) — the new-quote description, client and options kept on
 * this device while you type, so a dropped connection on site (or a closed
 * tab) doesn't lose them. Local to the browser and to the signed-in person
 * (the key carries the user id); cleared when the quote is written or when
 * you tap "Cancella". Photos and documents are not kept (files can't be
 * stored this way): the banner says so.
 *
 * This is the only copy of data the app keeps on the phone (APP-PLAN §6,
 * rule 4). Drafts older than 14 days are dropped.
 */
export type QuoteDraft<T> = { savedAt: number; data: T };

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const keyFor = (userId: string) => `prevai:new-quote-draft:${userId}`;

function read<T>(userId: string): QuoteDraft<T> | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as QuoteDraft<T>;
    if (!draft || typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(keyFor(userId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function useQuoteDraft<T>({ userId, value, isEmpty, onRestore, skipRestore }: {
  userId: string | null;
  value: T;
  /** Nothing worth keeping (an empty form never overwrites a saved draft before it is restored). */
  isEmpty: (v: T) => boolean;
  onRestore: (v: T) => void;
  /** The page was opened with its own content (the home composer, a client page): start from that, and let it replace the draft. */
  skipRestore?: boolean;
}) {
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const ready = useRef(false);
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;

  // Restore once, as soon as we know who is signed in.
  useEffect(() => {
    if (!userId || ready.current) return;
    ready.current = true;
    if (skipRestore) return;
    const draft = read<T>(userId);
    if (draft && !isEmpty(draft.data)) {
      restoreRef.current(draft.data);
      setRestoredAt(draft.savedAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Save while typing (debounced); an emptied form removes the draft.
  useEffect(() => {
    if (!userId || !ready.current) return;
    const timer = window.setTimeout(() => {
      try {
        if (isEmpty(value)) localStorage.removeItem(keyFor(userId));
        else localStorage.setItem(keyFor(userId), JSON.stringify({ savedAt: Date.now(), data: value } satisfies QuoteDraft<T>));
      } catch {
        // storage full or blocked (private mode): the form still works, it just isn't kept
      }
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, JSON.stringify(value)]);

  const clear = useCallback(() => {
    setRestoredAt(null);
    if (!userId) return;
    try { localStorage.removeItem(keyFor(userId)); } catch { /* nothing to clear */ }
  }, [userId]);

  return { restoredAt, clear, dismiss: () => setRestoredAt(null) };
}

/** true while the browser says it has a network (updates on the online/offline events). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}
