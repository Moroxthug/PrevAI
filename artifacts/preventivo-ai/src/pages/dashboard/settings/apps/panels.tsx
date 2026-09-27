import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetCalendarStatus, getGetCalendarStatusQueryKey, useGetCalendarConnectUrl, getGetCalendarConnectUrlQueryKey, useDisconnectCalendar, useToggleCalendar,
  useGetEmailConnectionsStatus, getGetEmailConnectionsStatusQueryKey, useGetEmailConnectionConnectUrl, getGetEmailConnectionConnectUrlQueryKey,
  useDisconnectEmailConnection, useToggleEmailConnection, type CalendarProvider,
} from "@workspace/api-client-react";
import { Copy, KeyRound, Loader2, Plug, Trash2, Webhook } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { developerApi, metaLeadAdsApi, stripeConnectApi, type AutomationEventName } from "@/lib/invoices-api";
import { ActionRow, SettingsGroup, SettingsRow, ToggleRow } from "../ui";
import { AccountFacts, DisconnectRow, SyncLog, fmtDate, fmtDateTime } from "./ui";
import { STATUS_KEYS } from "./status";

// ── APP-1b: il pannello di ogni app del catalogo ─────────────────────────────
// Stessi endpoint e stesse azioni delle vecchie schede "Integrazioni", in
// righe: chi è collegato e da quando, l'interruttore, il registro, Scollega
// per ultimo (e chiede prima).

const Spinner = () => <Loader2 className="animate-spin" aria-hidden="true" />;
const PanelSkeleton = () => <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

// ── Google Calendar / Outlook: le fasi dei cantieri nel calendario ──────────

function CalendarPanel({ provider }: { provider: CalendarProvider }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const name = provider === "google" ? "Google Calendar" : "Outlook";
  const { data: status, isLoading } = useGetCalendarStatus();
  const conn = status?.connections.find((c) => c.provider === provider);
  const getConnectUrl = useGetCalendarConnectUrl(provider, { query: { queryKey: getGetCalendarConnectUrlQueryKey(provider), enabled: false } });
  const disconnect = useDisconnectCalendar();
  const toggle = useToggleCalendar();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetCalendarStatusQueryKey() });
  const onError = () => toast({ title: t("dashboard.settings.calendar.error"), variant: "destructive" });
  const connect = async () => {
    const r = await getConnectUrl.refetch();
    if (r.data?.url) window.location.href = r.data.url;
    else onError();
  };
  if (isLoading) return <PanelSkeleton />;

  if (!conn) {
    return (
      <SettingsGroup>
        <ActionRow label={`Collega ${name}`} help={t("dashboard.settings.calendar.desc")}>
          <button type="button" onClick={() => void connect()} disabled={getConnectUrl.isFetching} className="btn btn-sm btn-navy" data-primary-action>
            {getConnectUrl.isFetching ? <Spinner /> : <Plug aria-hidden="true" />}
            {t("dashboard.settings.calendar.connectCta")}
          </button>
        </ActionRow>
      </SettingsGroup>
    );
  }

  return (
    <>
      <SettingsGroup title="Account collegato">
        <AccountFacts facts={[
          ["Account", conn.accountEmail ?? "—"],
          ["Ultima sincronizzazione", fmtDateTime(conn.lastSyncedAt) ?? "Mai"],
        ]} />
        <ToggleRow label="Porta le fasi nel calendario" help="Spento, PrevAI smette di aggiornare il calendario ma resta collegato." checked={conn.isEnabled ?? true} disabled={toggle.isPending}
          onChange={(v) => toggle.mutate({ provider, data: { isEnabled: v } }, { onSuccess: invalidate, onError })} />
      </SettingsGroup>
      <DisconnectRow name={name} pending={disconnect.isPending}
        onConfirm={() => disconnect.mutate({ provider }, { onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.calendar.disconnected") }); }, onError })} />
    </>
  );
}

export const GoogleCalendarPanel = () => <CalendarPanel provider="google" />;
export const OutlookCalendarPanel = () => <CalendarPanel provider="outlook" />;

// ── Gmail: preventivi e fatture dal proprio indirizzo ───────────────────────

export function GmailPanel() {
  const provider = "google" as const;
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetEmailConnectionsStatus();
  const getConnectUrl = useGetEmailConnectionConnectUrl(provider, { query: { queryKey: getGetEmailConnectionConnectUrlQueryKey(provider), enabled: false } });
  const disconnect = useDisconnectEmailConnection();
  const toggle = useToggleEmailConnection();
  const conn = status?.connections.find((c) => c.provider === provider);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetEmailConnectionsStatusQueryKey() });
  const onError = () => toast({ title: t("dashboard.settings.emailSend.error"), variant: "destructive" });
  const connect = async () => {
    const r = await getConnectUrl.refetch();
    if (r.data?.url) window.location.href = r.data.url;
    else onError();
  };
  if (isLoading) return <PanelSkeleton />;

  if (!conn) {
    return (
      <SettingsGroup>
        <ActionRow label="Collega Gmail" help={t("dashboard.settings.emailSend.desc")}>
          <button type="button" onClick={() => void connect()} disabled={getConnectUrl.isFetching} className="btn btn-sm btn-navy" data-primary-action>
            {getConnectUrl.isFetching ? <Spinner /> : <Plug aria-hidden="true" />}
            {t("dashboard.settings.emailSend.connectCta")}
          </button>
        </ActionRow>
      </SettingsGroup>
    );
  }

  return (
    <>
      <SettingsGroup title="Account collegato">
        <AccountFacts facts={[
          ["Invia da", conn.accountEmail ?? "—"],
          ["Ultimo invio", conn.lastSendError ? t("dashboard.settings.emailSend.lastSendFailed") : fmtDateTime(conn.lastSendAt) ?? "Mai"],
        ]} />
        <ToggleRow label="Invia dalla mia Gmail" help="Spento, le email tornano a partire da no-reply@prevai.it." checked={conn.isEnabled ?? true} disabled={toggle.isPending}
          onChange={(v) => toggle.mutate({ provider, data: { isEnabled: v } }, { onSuccess: invalidate, onError })} />
      </SettingsGroup>
      <DisconnectRow name="Gmail" help="Le email torneranno a partire da no-reply@prevai.it." pending={disconnect.isPending}
        onConfirm={() => disconnect.mutate({ provider }, { onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.emailSend.disconnected") }); }, onError })} />
    </>
  );
}

// ── Stripe: incassi con carta sul conto Connect dell'impresa ────────────────

export function StripePanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: status, isLoading } = useQuery({ queryKey: STATUS_KEYS.stripe, queryFn: stripeConnectApi.status, retry: false });
  const onboard = useMutation({
    mutationFn: stripeConnectApi.onboard,
    onSuccess: (r) => { window.location.href = r.url; },
    onError: () => toast({ title: t("dashboard.settings.stripeConnect.error"), variant: "destructive" }),
  });
  if (isLoading) return <PanelSkeleton />;

  const connected = status?.connected ?? false;
  const charges = status?.chargesEnabled ?? false;
  const cta = connected ? (charges ? t("dashboard.settings.stripeConnect.manage") : t("dashboard.settings.stripeConnect.finishOnboarding")) : t("dashboard.settings.stripeConnect.connectCta");

  return (
    <SettingsGroup title={connected ? "Account collegato" : undefined}>
      {connected && (
        <AccountFacts facts={[
          ["Stato", charges ? t("dashboard.settings.stripeConnect.active") : t("dashboard.settings.stripeConnect.onboardingIncomplete")],
          ["Bonifici sul tuo conto", status?.payoutsEnabled ? "Attivi" : "Non ancora"],
          ["Collegato dal", fmtDate(status?.connectedAt) ?? "—"],
        ]} />
      )}
      <ActionRow
        label={connected ? (charges ? "Gestisci l'account Stripe" : "Completa la configurazione su Stripe") : "Collega il tuo account Stripe"}
        help={t("dashboard.settings.stripeConnect.desc")}
      >
        <button type="button" onClick={() => onboard.mutate()} disabled={onboard.isPending} className={connected && charges ? "btn btn-sm btn-outline-navy" : "btn btn-sm btn-navy"} data-primary-action>
          {onboard.isPending ? <Spinner /> : <Plug aria-hidden="true" />}
          {cta}
        </button>
      </ActionRow>
    </SettingsGroup>
  );
}

// ── Lead Ads di Facebook e Instagram ─────────────────────────────────────────

export function MetaLeadsPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: STATUS_KEYS.meta, queryFn: metaLeadAdsApi.status, retry: false });
  const { data: log } = useQuery({ queryKey: ["meta-lead-ads-import-log"], queryFn: metaLeadAdsApi.importLog, enabled: !!status?.connected });
  const connectUrl = useQuery({ queryKey: ["meta-lead-ads-connect-url"], queryFn: metaLeadAdsApi.connectUrl, enabled: false });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: STATUS_KEYS.meta });
  const onError = () => toast({ title: t("dashboard.settings.metaLeadAds.error"), variant: "destructive" });
  const toggle = useMutation({ mutationFn: (v: boolean) => metaLeadAdsApi.toggle(v), onSuccess: invalidate, onError });
  const disconnect = useMutation({
    mutationFn: metaLeadAdsApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.metaLeadAds.disconnected") }); },
    onError,
  });
  const connect = async () => {
    const r = await connectUrl.refetch();
    if (r.data?.url) window.location.href = r.data.url;
    else onError();
  };
  if (isLoading) return <PanelSkeleton />;

  if (!status?.connected) {
    return (
      <SettingsGroup>
        <ActionRow label="Collega la pagina Facebook" help={t("dashboard.settings.metaLeadAds.connectHelp")}>
          <button type="button" onClick={() => void connect()} disabled={connectUrl.isFetching} className="btn btn-sm btn-navy" data-primary-action>
            {connectUrl.isFetching ? <Spinner /> : <Plug aria-hidden="true" />}
            {t("dashboard.settings.metaLeadAds.connectCta")}
          </button>
        </ActionRow>
      </SettingsGroup>
    );
  }

  return (
    <>
      <SettingsGroup title="Pagina collegata">
        <AccountFacts facts={[
          ["Pagina", status.pageName ?? "—"],
          ["Collegata dal", fmtDate(status.connectedAt) ?? "—"],
          ["Ultimo lead", fmtDateTime(status.lastLeadAt) ?? "Nessuno ancora"],
        ]} />
        <ToggleRow label="Importa i nuovi lead" help="Spento, i moduli compilati restano su Meta e non entrano in PrevAI." checked={status.isEnabled ?? true} disabled={toggle.isPending} onChange={(v) => toggle.mutate(v)} />
      </SettingsGroup>
      <SyncLog
        title={t("dashboard.settings.metaLeadAds.importLogTitle")}
        rows={(log?.entries ?? []).map((e) => ({ id: e.id, ok: e.status !== "failed", label: fmtDateTime(e.createdAt) ?? "", error: e.error }))}
        empty="Nessun lead importato finora."
      />
      <DisconnectRow name="la pagina Facebook" pending={disconnect.isPending} onConfirm={() => disconnect.mutate()} />
    </>
  );
}

// ── API e webhook (Zapier, Make, strumenti propri) ───────────────────────────

/** Un segreto mostrato una volta sola, con Copia e "L'ho salvato". */
function Revealed({ value, warning, onDismiss }: { value: string; warning: string; onDismiss: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  return (
    <div className="app-secret" role="status">
      <p>{warning}</p>
      <div className="app-secret-row">
        <code>{value}</code>
        <button type="button" className="btn btn-sm btn-outline-navy" aria-label="Copia"
          onClick={() => { void navigator.clipboard.writeText(value); toast({ title: t("dashboard.settings.developerApi.copied") }); }}>
          <Copy aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="btn btn-sm btn-outline-navy app-self-start" onClick={onDismiss}>{t("dashboard.settings.developerApi.dismiss")}</button>
    </div>
  );
}

export function ApiPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const keys = useQuery({ queryKey: STATUS_KEYS.apiKeys, queryFn: developerApi.listKeys });
  const hooks = useQuery({ queryKey: STATUS_KEYS.webhooks, queryFn: developerApi.listWebhooks });
  const [keyName, setKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<AutomationEventName[]>([]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const onError = () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" });
  const refreshKeys = () => queryClient.invalidateQueries({ queryKey: STATUS_KEYS.apiKeys });
  const refreshHooks = () => queryClient.invalidateQueries({ queryKey: STATUS_KEYS.webhooks });

  const createKey = useMutation({
    mutationFn: () => developerApi.createKey(keyName.trim()),
    onSuccess: (r) => { refreshKeys(); setKeyName(""); setRevealedKey(r.rawKey); },
    onError,
  });
  const revokeKey = useMutation({ mutationFn: (id: string) => developerApi.revokeKey(id), onSuccess: refreshKeys, onError });
  const createHook = useMutation({
    mutationFn: () => developerApi.createWebhook(url.trim(), events),
    onSuccess: (r) => { refreshHooks(); setUrl(""); setEvents([]); setRevealedSecret(r.secret); },
    onError,
  });
  const toggleHook = useMutation({ mutationFn: ({ id, on }: { id: string; on: boolean }) => developerApi.toggleWebhook(id, on), onSuccess: refreshHooks, onError });
  const deleteHook = useMutation({ mutationFn: (id: string) => developerApi.deleteWebhook(id), onSuccess: refreshHooks, onError });

  const activeKeys = (keys.data?.items ?? []).filter((k) => !k.revokedAt);
  const allEvents = keys.data?.events ?? hooks.data?.events ?? [];
  const webhooks = hooks.data?.items ?? [];

  return (
    <>
      <SettingsGroup title={t("dashboard.settings.developerApi.apiKeys")} desc="Ogni chiave apre l'API a uno strumento. Revocala e quello strumento smette subito di funzionare.">
        {revealedKey && <div className="sgroup-pad"><Revealed value={revealedKey} warning={t("dashboard.settings.developerApi.keyRevealWarning")} onDismiss={() => setRevealedKey(null)} /></div>}
        {keys.isLoading ? <div className="sgroup-pad"><Skeleton className="h-12 w-full" /></div> : activeKeys.length > 0 && (
          <ul className="app-log">
            {activeKeys.map((k) => (
              <li key={k.id}>
                <KeyRound className="muted" aria-hidden="true" />
                <span className="app-log-txt">
                  <span className="app-log-label">{k.name}</span>
                  <span className="app-log-when">{k.keyPrefix}••••••••• · {k.role}</span>
                </span>
                <button type="button" className="btn btn-sm btn-outline-navy app-danger" aria-label={`Revoca la chiave ${k.name}`} onClick={() => revokeKey.mutate(k.id)} disabled={revokeKey.isPending}>
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <SettingsRow label="Nuova chiave" htmlFor="api-key-name">
          <div className="app-inline">
            <input id="api-key-name" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder={t("dashboard.settings.developerApi.keyNamePlaceholder")} autoComplete="off" />
            <button type="button" onClick={() => createKey.mutate()} disabled={!keyName.trim() || createKey.isPending} className="btn btn-sm btn-navy">
              {createKey.isPending && <Spinner />}
              {t("dashboard.settings.developerApi.createKey")}
            </button>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("dashboard.settings.developerApi.webhooks")} desc="PrevAI chiama il tuo indirizzo quando succede uno degli eventi scelti.">
        {revealedSecret && <div className="sgroup-pad"><Revealed value={revealedSecret} warning={t("dashboard.settings.developerApi.secretRevealWarning")} onDismiss={() => setRevealedSecret(null)} /></div>}
        {hooks.isLoading ? <div className="sgroup-pad"><Skeleton className="h-12 w-full" /></div> : webhooks.map((w) => (
          <div key={w.id} className="app-hook">
            <ToggleRow label={w.url} help={w.events.join(", ")} checked={w.isEnabled} disabled={toggleHook.isPending} onChange={(on) => toggleHook.mutate({ id: w.id, on })} />
            <button type="button" className="btn btn-sm btn-outline-navy app-danger" aria-label="Elimina il webhook" onClick={() => deleteHook.mutate(w.id)} disabled={deleteHook.isPending}>
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        ))}
        <SettingsRow label="Nuovo webhook" help="L'indirizzo che riceve la chiamata e gli eventi che la fanno partire." htmlFor="webhook-url">
          <div className="app-stack">
            <input id="webhook-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("dashboard.settings.developerApi.webhookUrlPlaceholder")} autoComplete="off" />
            <div className="app-events" role="group" aria-label="Eventi">
              {allEvents.map((ev) => (
                <button key={ev} type="button" aria-pressed={events.includes(ev)}
                  onClick={() => setEvents((p) => (p.includes(ev) ? p.filter((e) => e !== ev) : [...p, ev]))}
                  className={cn("app-event", events.includes(ev) && "on")}>
                  {ev}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => createHook.mutate()} disabled={!url.trim() || events.length === 0 || createHook.isPending} className="btn btn-sm btn-navy app-self-start">
              {createHook.isPending ? <Spinner /> : <Webhook aria-hidden="true" />}
              {t("dashboard.settings.developerApi.addWebhook")}
            </button>
          </div>
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
