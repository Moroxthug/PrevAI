// APP-2 (from QuoteAI Phase 77) — Web Push: the browser subscribes with the
// server's VAPID key and hands the subscription to the API
// (api-server/src/routes/push.ts). Preferences are per person.
import type { PushKind } from "@workspace/config";
import { apiRequest as req } from "@/lib/jobs-api";
import { clearOfflineCaches, getServiceWorkerRegistration } from "@/lib/pwa";

export type PushConfigDto = {
  /** VAPID keys are set on the server. */
  configured: boolean;
  /** Migration 0014 has run. */
  ready: boolean;
  publicKey: string | null;
  /** This browser is subscribed for this person and company. */
  subscribed: boolean;
  /** Every kind, and whether this person's role may receive it. */
  kinds: Array<{ kind: PushKind; allowed: boolean }>;
  muted: PushKind[];
};

const json = (body: unknown) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const pushApi = {
  config: (endpoint?: string | null) => req<PushConfigDto>(`/api/push/config${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`),
  subscribe: (sub: PushSubscriptionJSON) => req<{ id: string }>("/api/push/subscriptions", { method: "POST", ...json({ endpoint: sub.endpoint, keys: sub.keys }) }),
  unsubscribe: (endpoint: string) => req<{ success: true; removed: boolean }>("/api/push/subscriptions", { method: "DELETE", ...json({ endpoint }) }),
  test: () => req<{ sent: number; failed: number; removed: number; skipped: string | null }>("/api/push/test", { method: "POST" }),
  savePreferences: (muted: PushKind[]) => req<{ muted: PushKind[] }>("/api/push/preferences", { method: "PUT", ...json({ muted }) }),
};

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
}

/** The browser's current subscription for this origin, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await getServiceWorkerRegistration();
  if (!reg) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

function keyBytes(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type EnableResult = "enabled" | "denied" | "unsupported" | "no_worker";

/** Asks for permission, subscribes with the server's key, registers the subscription. */
export async function enablePush(publicKey: string): Promise<EnableResult> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await getServiceWorkerRegistration();
  if (!reg) return "no_worker";
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource }));
  await pushApi.subscribe(sub.toJSON());
  return "enabled";
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await pushApi.unsubscribe(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/**
 * Before signing out: this browser stops receiving this person's
 * notifications and forgets the dashboard data kept for offline use, so the
 * next person on it sees neither. Never throws, never waits long.
 */
export async function leaveThisDevice(): Promise<void> {
  await Promise.race([
    // SYNC-1: né i dati salvati sul dispositivo né ciò che era in coda restano per la persona dopo.
    Promise.allSettled([disablePush(), clearOfflineCaches(), import("./offline/query-cache").then((m) => m.wipeQueryCache()), import("./offline/outbox").then((m) => m.clearOutbox())]),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}
