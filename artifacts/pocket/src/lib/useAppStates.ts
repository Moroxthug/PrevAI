// Each app's state and its one line, from what the server says about it (a status call for each app the plan includes; the others are locked without asking).
// PrevAI's own calls: SdI settings and the accountant's links (PrevAI Fisco), Stripe Connect, the calendars, Gmail, WhatsApp and Meta Lead Ads.
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { APPS, stateOf, unlocked, unresolvedFailures, type AppId, type State } from "./integrations";
import { useProfile } from "./useProfile";
import { useSession } from "./useSession";

type Conn = { connected?: boolean; available?: boolean; isEnabled?: boolean | null; phoneNumber?: string | null; pageName?: string | null; chargesEnabled?: boolean };
type Log = { entries: { status: string; entityType?: string; entityId?: string; milestoneId?: string; provider?: string }[] };
type Calendar = { available?: Record<string, boolean>; connections: { provider: string; isEnabled?: boolean | null; accountEmail?: string | null }[] };
type Mail = { available?: Record<string, boolean>; connections: { provider: string; isEnabled?: boolean | null; accountEmail?: string | null; lastSendError?: string | null }[] };
type Sdi = { settings: { stato: "non_configurato" | "in_configurazione" | "attivo" | "sospeso"; ultimoErrore?: string | null } };
type Shares = { condivisioni: { attivo: boolean; destinatario: string }[] };
type Plan = { plan: string; features: string[] };

export type AppLine = { state: State; /** What to say under the name when it is on: a company, an address or "N didn't sync". */ detail?: string; failures?: number };

export function useAppStates(): { apps: Record<AppId, AppLine>; plan: Plan | undefined; loading: boolean; refresh: () => void } {
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const { profile } = useProfile();
  const planQ = useQuery({ queryKey: ["plan-overview"], queryFn: () => api<Plan>("/api/plan/overview"), enabled: signedIn, retry: 0, staleTime: 60_000 });
  const plan = planQ.data;
  const on = (id: AppId) => !!plan && unlocked(APPS.find((a) => a.id === id)!, plan.plan, plan.features);
  const get = <T,>(key: string, path: string, id: AppId, extra = true) => useQuery({ queryKey: [key], queryFn: () => api<T>(path), enabled: signedIn && on(id) && extra, retry: 0, staleTime: 30_000 });
  const sdi = get<Sdi>("sdi-settings", "/api/sdi/settings", "sdi");
  const shares = get<Shares>("accountant-shares", "/api/fiscale/condivisioni", "comm");
  const stripe = get<Conn>("stripe-connect", "/api/invoice-payments/connect/status", "stripe");
  const cal = get<Calendar>("calendar-status", "/api/calendar/status", "gcal");
  const calLog = get<Log>("calendar-log", "/api/calendar/sync-log", "gcal", (cal.data?.connections.length ?? 0) > 0);
  const mail = get<Mail>("email-connections", "/api/email-connections/status", "gmail");
  const wa = get<Conn>("wa-status", "/api/whatsapp/status", "wa");
  const meta = get<Conn>("meta-status", "/api/meta-lead-ads/status", "meta");

  const calendarOf = (provider: "google" | "outlook"): AppLine => {
    const conn = cal.data?.connections.find((c) => c.provider === provider);
    if (!conn) return { state: cal.data?.available?.[provider] === false ? "soon" : "none" };
    const failing = unresolvedFailures(calLog.data?.entries).filter((e) => e.provider === provider).length;
    if (failing) return { state: "attention", failures: failing };
    return { state: conn.isEnabled === false ? "paused" : "connected", detail: conn.accountEmail ?? undefined };
  };
  const gmail = mail.data?.connections.find((c) => c.provider === "google");
  const sdiState = sdi.data?.settings.stato;
  const share = shares.data?.condivisioni.find((c) => c.attivo);

  const raw: Record<AppId, AppLine> = {
    sdi: { state: sdiState === "attivo" ? (sdi.data?.settings.ultimoErrore ? "attention" : "connected") : sdiState === "sospeso" ? "paused" : "none" },
    comm: { state: share ? "connected" : "none", detail: share?.destinatario },
    stripe: stripe.data?.connected && !stripe.data.chargesEnabled ? { state: "attention" } : { state: stateOf(stripe.data) },
    gcal: calendarOf("google"),
    outlook: calendarOf("outlook"),
    gmail: gmail ? { state: gmail.lastSendError ? "attention" : gmail.isEnabled === false ? "paused" : "connected", detail: gmail.accountEmail ?? undefined } : { state: mail.data?.available?.google === false ? "soon" : "none" },
    wa: { state: stateOf(wa.data), detail: wa.data?.phoneNumber ?? undefined },
    meta: { state: stateOf(meta.data), detail: meta.data?.pageName ?? undefined },
    gbp: { state: profile?.googleReviewUrl ? "connected" : "none" },
    drive: { state: "soon" },
    imp: { state: "none" },
  };
  const apps = {} as Record<AppId, AppLine>;
  for (const a of APPS) apps[a.id] = !plan || on(a.id) ? raw[a.id] : { state: "locked" };
  const loading = planQ.isPending && !plan;
  return { apps, plan, loading, refresh: () => { void planQ.refetch(); void sdi.refetch(); void shares.refetch(); void stripe.refetch(); void cal.refetch(); void mail.refetch(); void wa.refetch(); void meta.refetch(); } };
}
