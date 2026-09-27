// APP-5 (docs/APP-PLAN.md §5): the beta's minimal usage events and
// "Segnala un problema". Every event carries the surface it came from, so the
// pilot report can tell the native app apart from the site and the PWA.
// Best-effort by design: nothing here throws, blocks, or shows an error.

export type AppSurface = "web" | "pwa" | "android" | "ios";
export type AppEventKind = "app_open" | "quote_created" | "quote_shared";
export type ShareChannel = "link" | "email" | "share_sheet";

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

/** Native shell (Capacitor, APP-3) → android/ios; installed PWA → pwa; otherwise web. */
export function detectSurface(win: Window | undefined = typeof window === "undefined" ? undefined : window): AppSurface {
  if (!win) return "web";
  try {
    const cap = (win as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const p = cap.getPlatform?.();
      if (p === "android" || p === "ios") return p;
    }
    if (win.matchMedia?.("(display-mode: standalone)").matches) return "pwa";
    if ((win.navigator as Navigator & { standalone?: boolean }).standalone === true) return "pwa";
  } catch {
    // an exotic webview without matchMedia is still "web"
  }
  return "web";
}

/** Same breakpoint as the phone navigation (index.css, ≤ 980 px). */
export function detectViewport(win: Window | undefined = typeof window === "undefined" ? undefined : window): "phone" | "desktop" {
  try {
    return win?.matchMedia?.("(max-width: 980px)").matches ? "phone" : "desktop";
  } catch {
    return "desktop";
  }
}

function context() {
  return {
    surface: detectSurface(),
    viewport: detectViewport(),
    appVersion: (import.meta.env.VITE_RELEASE as string | undefined)?.slice(0, 12) || undefined,
  };
}

/** Records one usage event. Fire and forget. */
export function trackAppEvent(kind: AppEventKind, extra: { entityId?: string; channel?: ShareChannel } = {}): void {
  try {
    void fetch("/api/app/events", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...extra, ...context() }),
    }).catch(() => undefined);
  } catch {
    // never let analytics be the error
  }
}

const OPEN_KEY = "prevai-app-open";

/** "App aperta" at most once per day per device (local day), from the dashboard shell. */
export function trackAppOpenOncePerDay(now = new Date()): void {
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  try {
    if (localStorage.getItem(OPEN_KEY) === day) return;
    localStorage.setItem(OPEN_KEY, day);
  } catch {
    // storage blocked: count it anyway, at most once per page load (caller runs once)
  }
  trackAppEvent("app_open");
}

export class FeedbackError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** "Segnala un problema": sends the text with the page and the surface. */
export async function sendFeedback(message: string): Promise<void> {
  const res = await fetch("/api/app/feedback", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, route: window.location.pathname, ...context() }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new FeedbackError(body?.error ?? "", res.status);
  }
}
