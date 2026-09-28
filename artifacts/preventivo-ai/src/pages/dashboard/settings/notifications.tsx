import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { PUSH_KINDS, PUSH_KIND_DEFS, type PushKind } from "@workspace/config";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePwa } from "@/lib/pwa";
import { currentSubscription, disablePush, enablePush, pushApi, pushSupported } from "@/lib/push-api";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ActionRow, SettingsGroup, SettingsSection, ToggleRow, useSettingsDraft } from "./ui";

// ── APP-2: Tu → Notifiche sul telefono (docs/APP-PLAN.md) ────────────────────
// Two different things, kept apart on purpose:
//   • "Questo dispositivo" — one switch per browser or installed app; it acts
//     at once (the browser asks for permission there and then), with a test.
//   • "Cosa ti arriva" — per person, the same on every device; a normal
//     settings draft saved with the bar. The bell always keeps everything.
// Each state explains itself: iPhone needs the app on the home screen first,
// the server may not have its keys yet, the browser may have been told "no".

const CONFIG_KEY = ["push-config"];

type KindsDraft = Record<PushKind, boolean>;

export function NotificationsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pwa = usePwa();
  const supported = pushSupported() && pwa.supported;
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(typeof Notification === "undefined" ? null : Notification.permission);

  useEffect(() => {
    if (!supported) {
      setEndpoint(null);
      return;
    }
    void currentSubscription().then((s) => setEndpoint(s?.endpoint ?? null));
  }, [supported]);

  const { data: config, isLoading } = useQuery({
    queryKey: [...CONFIG_KEY, endpoint ?? null],
    queryFn: () => pushApi.config(endpoint),
    enabled: endpoint !== undefined,
    staleTime: 60_000,
  });
  const enabled = !!config?.subscribed;
  const canToggle = supported && !!config?.configured && !!config?.ready && permission !== "denied";

  const allowed = useMemo(() => new Set((config?.kinds ?? []).filter((k) => k.allowed).map((k) => k.kind)), [config]);
  const source = useMemo<KindsDraft | undefined>(() => {
    if (!config) return undefined;
    const out = {} as KindsDraft;
    for (const k of PUSH_KINDS) out[k] = !config.muted.includes(k);
    return out;
  }, [config]);
  const { draft, set } = useSettingsDraft<KindsDraft>(source, async (d) => {
    try {
      await pushApi.savePreferences(PUSH_KINDS.filter((k) => !d[k]));
      await queryClient.invalidateQueries({ queryKey: CONFIG_KEY });
      toast({ title: "Modifiche salvate" });
    } catch (e) {
      toast({ title: "Salvataggio non riuscito", description: (e as Error).message, variant: "destructive" });
      throw e;
    }
  });

  const toggle = async () => {
    if (!config?.publicKey) return;
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEndpoint(null);
        toast({ title: "Notifiche spente su questo dispositivo" });
      } else {
        const r = await enablePush(config.publicKey);
        setPermission(typeof Notification === "undefined" ? null : Notification.permission);
        if (r === "enabled") {
          const s = await currentSubscription();
          setEndpoint(s?.endpoint ?? null);
          toast({ title: "Notifiche accese su questo dispositivo" });
        } else if (r === "denied") {
          toast({ title: "Il browser ha bloccato le notifiche", description: "Riattivale dalle impostazioni del browser per prevai.it, poi riprova.", variant: "destructive" });
        } else {
          toast({ title: "Questo browser non può ricevere notifiche", variant: "destructive" });
        }
      }
      await queryClient.invalidateQueries({ queryKey: CONFIG_KEY });
    } catch (e) {
      toast({ title: "Non è andata", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const r = await pushApi.test();
      toast({ title: r.sent > 0 ? "Notifica di prova inviata" : "Nessun dispositivo ha ricevuto la prova", description: r.sent > 0 ? "Dovrebbe arrivare fra qualche secondo." : "Spegni e riaccendi le notifiche qui sopra, poi riprova." });
    } catch (e) {
      toast({ title: "Non è andata", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  let hint: string;
  if (!supported) hint = pwa.ios && !pwa.standalone ? "Su iPhone le notifiche arrivano solo dall'app sulla schermata Home: aggiungila (qui sotto), aprila da lì e torna in questa pagina." : "Questo browser non può ricevere notifiche. Prova con Chrome, Edge o Firefox, oppure con l'app sulla schermata Home.";
  else if (config && !config.ready) hint = "Le notifiche sul telefono si attivano con il prossimo aggiornamento di PrevAI.";
  else if (config && !config.configured) hint = "Le notifiche sul telefono non sono ancora attive su PrevAI.";
  else if (permission === "denied") hint = "Il browser ha bloccato le notifiche per prevai.it: riattivale dalle sue impostazioni, poi torna qui.";
  else hint = enabled ? "Accese: le notifiche scelte qui sotto arrivano su questo dispositivo." : "Spente su questo dispositivo. Le trovi comunque nella campanella.";

  return (
    <SettingsSection title="Notifiche sul telefono" intro="Cosa ti avvisa anche fuori da PrevAI, sul telefono o sul computer. La campanella in alto le tiene sempre tutte.">
      {isLoading || endpoint === undefined ? (
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      ) : (
        <>
          <SettingsGroup title="Questo dispositivo">
            <ToggleRow label="Notifiche su questo dispositivo" help={hint} checked={enabled} disabled={!canToggle || busy} onChange={() => void toggle()} />
            {enabled && canToggle && (
              <ActionRow label="Prova" help="Manda una notifica di prova ai tuoi dispositivi accesi.">
                <button type="button" className="btn btn-sm btn-outline-navy gap-1.5" disabled={busy} onClick={() => void sendTest()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  Invia una prova
                </button>
              </ActionRow>
            )}
          </SettingsGroup>

          <InstallPrompt always className="notif-install" />

          {draft && config?.ready && (
            <SettingsGroup title="Cosa ti arriva" desc="Vale per tutti i tuoi dispositivi accesi.">
              {PUSH_KINDS.map((k) =>
                allowed.has(k) ? (
                  <ToggleRow key={k} label={PUSH_KIND_DEFS[k].label} help={PUSH_KIND_DEFS[k].help} checked={draft[k]} onChange={(v) => set(k, v)} />
                ) : (
                  <ToggleRow key={k} label={PUSH_KIND_DEFS[k].label} help="Non arriva a chi ha il tuo ruolo nell'impresa." checked={false} disabled onChange={() => undefined} />
                ),
              )}
            </SettingsGroup>
          )}
        </>
      )}
    </SettingsSection>
  );
}
