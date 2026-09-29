import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { clientPortalApi, type PortalMessageDto } from "@/lib/portal-api";

const when = (s: string) => new Date(s).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });

/**
 * CLI-1: lo scambio di messaggi impresa ↔ cliente (QuoteAI Phase 76). Uno per
 * cliente; dalla scheda di un cantiere ogni messaggio nuovo porta quel
 * cantiere, e l'elenco dice a quale cantiere si riferivano i vecchi. Aprirlo
 * segna lette le risposte del cliente (lo fa il server, sulla GET).
 */
export function ClientThreadCard({ clientId, jobId, jobName }: { clientId: string; jobId?: string; jobName?: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["client-thread", clientId], queryFn: () => clientPortalApi.thread(clientId), retry: false });
  const send = useMutation({
    mutationFn: () => clientPortalApi.send(clientId, { body: body.trim(), jobId: jobId ?? null }),
    onSuccess: (r) => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["client-thread", clientId] });
      void queryClient.invalidateQueries({ queryKey: ["client-portal", clientId] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: r.emailed ? t("thread.sentEmailed") : t("thread.sentNotEmailed") });
    },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const messages = data?.messages ?? [];
  const notReady = (error as (Error & { code?: string }) | null)?.code === "PORTAL_NOT_READY";

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {t("thread.title")}</h2>
          <p className="sub">{data?.client ? t("thread.sub").replace("{name}", data.client.name).replace("{email}", data.client.email ?? "—") : ""}</p>
        </div>
      </div>
      <div className="act-body space-y-4">
        {error ? (
          <p className="foot-note m-0">{notReady ? t("portalCard.notReady") : t("jobs.error")}</p>
        ) : isLoading ? (
          <div className="space-y-3 skel-wait" aria-busy="true">
            <Skeleton className="h-14 w-3/4 rounded-[14px]" aria-hidden="true" />
            <Skeleton className="h-14 w-2/3 rounded-[14px] ml-auto" aria-hidden="true" />
          </div>
        ) : messages.length === 0 ? (
          <p className="foot-note m-0">{t("thread.empty")}</p>
        ) : (
          <ol className="space-y-3 m-0 p-0 list-none max-h-[420px] overflow-y-auto pr-1">
            {messages.map((m: PortalMessageDto) => (
              <li key={m.id} className={cn("flex", m.sender === "contractor" ? "justify-end" : "justify-start")}>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm" style={m.sender === "contractor" ? { background: "var(--navy)", color: "#fff" } : { background: "var(--soft)", color: "var(--ink)" }}>
                  <div className="text-[11px] font-semibold mb-1 opacity-80">
                    {m.sender === "contractor" ? (m.senderName || t("thread.you")) : m.senderName}{m.jobName && m.jobId !== jobId ? ` · ${m.jobName}` : ""} · {when(m.createdAt)}
                  </div>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
        {!error && (
          <div className="space-y-2">
            <div className="field">
              <label htmlFor={`thread-body-${clientId}`}>{jobName ? t("thread.composeAbout").replace("{job}", jobName) : t("thread.compose")}</label>
              <textarea id={`thread-body-${clientId}`} rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder={t("thread.placeholder")} />
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="foot-note">{data?.client?.email ? t("thread.emailHint") : t("thread.noEmailHint")}</span>
              <button type="button" className="btn btn-sm btn-navy" onClick={() => send.mutate()} disabled={!body.trim() || send.isPending}>
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("thread.send")}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
