import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, Mail, UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { clientPortalApi } from "@/lib/portal-api";

const when = (s: string | null) => (s ? new Date(s).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }) : null);

/**
 * CLI-1: il link al portale del cliente — copialo, manda l'invito per email,
 * guarda quando l'ha aperto. Nella scheda Messaggi del cantiere e del cliente.
 */
export function ClientPortalCard({ clientId }: { clientId: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["client-portal", clientId], queryFn: () => clientPortalApi.status(clientId), retry: false });
  const invite = useMutation({
    mutationFn: () => clientPortalApi.invite(clientId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["client-portal", clientId] }); toast({ title: t("portalCard.invited") }); },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "NO_EMAIL" ? t("portalCard.noEmail") : e.code === "EMAIL_NOT_CONFIGURED" ? t("portalCard.emailNotConfigured") : t("jobs.error"), variant: "destructive" }),
  });
  const notReady = (error as (Error & { code?: string }) | null)?.code === "PORTAL_NOT_READY";

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" /> {t("portalCard.title")}</h2>
          <p className="sub">{t("portalCard.sub")}</p>
        </div>
      </div>
      <div className="act-body space-y-3">
        {error ? (
          <p className="foot-note m-0">{notReady ? t("portalCard.notReady") : t("jobs.error")}</p>
        ) : !data ? (
          <div className="space-y-2 skel-wait" aria-busy="true">
            <Skeleton className="skel-line skel-sub" style={{ width: "70%" }} aria-hidden="true" />
            <Skeleton className="h-10 w-40 rounded-[10px]" aria-hidden="true" />
          </div>
        ) : !data.hasEmail || !data.url ? (
          <p className="foot-note m-0">{t("portalCard.noEmail")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs rounded px-2 py-1 truncate max-w-full" style={{ background: "var(--soft)", color: "var(--navy)" }}>{data.url}</code>
              <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => { void navigator.clipboard.writeText(data.url!); toast({ title: t("invoices.copied") }); }}><Copy className="h-4 w-4" /> {t("portalCard.copy")}</button>
              <a href={data.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-navy" aria-label={t("portalCard.open")}><ExternalLink className="h-4 w-4" /></a>
              <button type="button" className="btn btn-sm btn-navy" onClick={() => invite.mutate()} disabled={invite.isPending}>
                {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} {data.invitedAt ? t("portalCard.resend") : t("portalCard.send")}
              </button>
            </div>
            <p className="foot-note m-0">
              {data.invitedAt ? `${t("portalCard.invitedAt")} ${when(data.invitedAt)}` : t("portalCard.notInvited")}
              {" · "}
              {data.lastSeenAt ? `${t("portalCard.lastSeen")} ${when(data.lastSeenAt)}` : t("portalCard.neverOpened")}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
