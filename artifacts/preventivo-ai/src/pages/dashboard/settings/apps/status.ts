import { useQuery } from "@tanstack/react-query";
import {
  useGetCalendarStatus, getGetCalendarStatusQueryKey,
  useGetEmailConnectionsStatus, getGetEmailConnectionsStatusQueryKey,
  useGetWhatsappStatus, getGetWhatsappStatusQueryKey,
} from "@workspace/api-client-react";
import { developerApi, metaLeadAdsApi, stripeConnectApi } from "@/lib/invoices-api";
import { sdiApi } from "@/lib/sdi-api";
import { useBusinessProfile } from "../data";
import { APPS, type AppId } from "./catalog";
import { calendarApi } from "@/lib/calendar-api";

/**
 * - `connected`: funziona (o è acceso).
 * - `attention`: collegata ma serve qualcosa dal titolare — un invio fallito, una configurazione a metà.
 * - `paused`: collegata e spenta apposta.
 * - `off`: disponibile, non collegata — il riquadro dice Collega.
 * - `soon`: il server non ha ancora la registrazione dell'app (Phase 65, `available: false`).
 * - `locked`: il piano (o il modulo) non la include.
 */
type AppState = "loading" | "locked" | "soon" | "off" | "connected" | "attention" | "paused";
export type AppStatus = { state: AppState; detail?: string | null };

/** Chiavi di query condivise per i client scritti a mano (i pannelli le invalidano). */
export const STATUS_KEYS = {
  stripe: ["stripe-connect-status"],
  meta: ["meta-lead-ads-status"],
  apiKeys: ["developer-api-keys"],
  webhooks: ["developer-webhooks"],
  sdi: ["sdi", "settings"],
  calendarFeeds: ["calendar-feeds"],
  calendarPublish: ["calendar-publish"],
} as const;

/**
 * Lo stato di ogni app, per i riquadri. Un endpoint di stato si chiama solo
 * per un'app che il piano include (le altre rispondono 403 e restano col lucchetto).
 */
export function useAppStatuses(unlocked: (id: AppId) => boolean): Record<AppId, AppStatus> {
  const on = unlocked;

  const cal = useGetCalendarStatus({ query: { queryKey: getGetCalendarStatusQueryKey(), enabled: on("google_calendar") } });
  const email = useGetEmailConnectionsStatus({ query: { queryKey: getGetEmailConnectionsStatusQueryKey(), enabled: on("gmail") } });
  const wa = useGetWhatsappStatus({ query: { queryKey: getGetWhatsappStatusQueryKey(), enabled: on("whatsapp") } });
  const stripe = useQuery({ queryKey: STATUS_KEYS.stripe, queryFn: stripeConnectApi.status, enabled: on("stripe"), retry: false });
  const meta = useQuery({ queryKey: STATUS_KEYS.meta, queryFn: metaLeadAdsApi.status, enabled: on("meta_leads"), retry: false });
  const keys = useQuery({ queryKey: STATUS_KEYS.apiKeys, queryFn: developerApi.listKeys, enabled: on("api"), retry: false });
  const hooks = useQuery({ queryKey: STATUS_KEYS.webhooks, queryFn: developerApi.listWebhooks, enabled: on("api"), retry: false });
  const icsFeeds = useQuery({ queryKey: STATUS_KEYS.calendarFeeds, queryFn: () => calendarApi.feeds(), enabled: on("ics_calendar"), retry: false });
  const icsPublish = useQuery({ queryKey: STATUS_KEYS.calendarPublish, queryFn: () => calendarApi.publishState(), enabled: on("ics_calendar"), retry: false });
  const sdi = useQuery({ queryKey: STATUS_KEYS.sdi, queryFn: () => sdiApi.settings(), enabled: on("sdi"), retry: false });
  const profile = useBusinessProfile();

  /** La forma comune: non configurata sul server → presto; collegata e accesa/spenta; altrimenti Collega. */
  const basic = (
    q: { isLoading: boolean; data?: { connected: boolean; available?: boolean; isEnabled?: boolean | null } | undefined },
    detail?: string | null,
  ): AppStatus => {
    if (q.isLoading) return { state: "loading" };
    const d = q.data;
    if (!d) return { state: "off" };
    if (!d.connected) return { state: d.available === false ? "soon" : "off" };
    if (d.isEnabled === false) return { state: "paused", detail };
    return { state: "connected", detail };
  };

  const calendarOf = (provider: "google" | "outlook"): AppStatus => {
    if (cal.isLoading) return { state: "loading" };
    const conn = cal.data?.connections.find((c) => c.provider === provider);
    if (!conn) return { state: cal.data?.available?.[provider] === false ? "soon" : "off" };
    return { state: conn.isEnabled === false ? "paused" : "connected", detail: conn.accountEmail ?? null };
  };

  /** AGENDA-1: collegata se c'è almeno un calendario in abbonamento o il link pubblicato; da guardare se un abbonamento non si legge. */
  const icsStatus = (): AppStatus => {
    if (icsFeeds.isLoading || icsPublish.isLoading) return { state: "loading" };
    const list = icsFeeds.data?.feeds ?? [];
    if (list.some((f) => f.isEnabled && f.lastStatus === "failed")) return { state: "attention", detail: "Un calendario non si legge" };
    const parts = [list.length ? `${list.length} ${list.length === 1 ? "calendario" : "calendari"}` : null, icsPublish.data?.enabled ? "agenda pubblicata" : null].filter(Boolean);
    return parts.length ? { state: "connected", detail: parts.join(" · ") } : { state: "off" };
  };

  const gmail = email.data?.connections.find((c) => c.provider === "google");
  const activeKeys = (keys.data?.items ?? []).filter((k) => !k.revokedAt).length;
  const webhookCount = hooks.data?.items.length ?? 0;
  const sdiState = sdi.data?.settings.stato;

  const raw: Record<AppId, AppStatus> = {
    google_calendar: calendarOf("google"),
    outlook_calendar: calendarOf("outlook"),
    ics_calendar: icsStatus(),
    gmail: email.isLoading
      ? { state: "loading" }
      : !gmail
        ? { state: email.data?.available?.google === false ? "soon" : "off" }
        : gmail.lastSendError
          ? { state: "attention", detail: "L'ultimo invio non è riuscito" }
          : { state: gmail.isEnabled === false ? "paused" : "connected", detail: gmail.accountEmail ?? null },
    whatsapp: basic(wa, wa.data?.phoneNumber ? `+${wa.data.phoneNumber}` : null),
    stripe: stripe.data?.connected && !stripe.data.chargesEnabled
      ? { state: "attention", detail: "Configurazione da completare" }
      : basic(stripe),
    sdi: sdi.isLoading
      ? { state: "loading" }
      : sdiState === "attivo"
        ? { state: "connected", detail: "Attivo" }
        : sdiState === "sospeso"
          ? { state: "paused", detail: "Sospeso" }
          : sdiState === "in_configurazione"
            ? { state: "attention", detail: "Configurazione da completare" }
            : { state: "off" },
    meta_leads: basic(meta, meta.data?.pageName ?? null),
    widget: profile.isLoading ? { state: "loading" } : profile.data?.apiKey ? { state: "connected", detail: "Chiave attiva" } : { state: "off" },
    api: keys.isLoading || hooks.isLoading
      ? { state: "loading" }
      : activeKeys || webhookCount
        ? { state: "connected", detail: `${activeKeys} ${activeKeys === 1 ? "chiave" : "chiavi"} · ${webhookCount} webhook` }
        : { state: "off" },
  };

  const out = {} as Record<AppId, AppStatus>;
  for (const app of APPS) out[app.id] = unlocked(app.id) ? raw[app.id] : { state: "locked" };
  return out;
}
