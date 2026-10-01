import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/hooks/use-auth";
import { teamInviteApi } from "@/lib/team-members-api";
import { Logo } from "@/components/logo";

/**
 * TEAM-1 — /entra: chi ha ricevuto un codice d'accesso dal titolare lo scrive
 * qui. Deve avere già un accesso suo (creato da sé, con la propria email):
 * il codice dà il posto nell'impresa, non crea la persona.
 */

const fmt = (s: string, vars: Record<string, string | undefined>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

export default function JoinCodePage() {
  const { t } = useLanguage();
  useDocumentTitle(t("join.title"));
  const { isLoaded, isSignedIn } = useAuth();
  // Pagina privata di servizio: fuori dall'indice (robots.txt la vieta già; questo copre chi arriva da un link).
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  const [code, setCode] = useState("");
  const redeem = useMutation({ mutationFn: () => teamInviteApi.redeemCode(code.trim()) });
  const returnTo = encodeURIComponent("/entra");

  return (
    <div className="doc-shell flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 sm:p-8 text-center space-y-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <Logo style={{ height: 28, margin: "0 auto" }} />

        {redeem.isSuccess ? (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: "var(--green-dark)" }} />
            <p className="font-medium" style={{ color: "var(--ink)" }}>{fmt(t("join.done"), { company: redeem.data.companyName || t("invite.yourTeam") })}</p>
            <Link href="/dashboard" className="btn btn-navy">{t("invite.goToDashboard")}</Link>
          </div>
        ) : (
          <div className="space-y-4">
            <h1 className="text-xl font-bold" style={{ color: "var(--navy)" }}>{t("join.title")}</h1>
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("join.intro")}</p>

            {!isLoaded ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: "var(--navy)" }} />
            ) : !isSignedIn ? (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--faint)" }}>{t("join.signInHint")}</p>
                <div className="flex gap-2 justify-center">
                  <Link href={`/sign-in?next=${returnTo}`} className="btn btn-outline-navy btn-sm">{t("invite.signIn")}</Link>
                  <Link href={`/sign-up?next=${returnTo}`} className="btn btn-navy btn-sm">{t("invite.createAccount")}</Link>
                </div>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (code.trim()) redeem.mutate(); }}>
                <div className="field text-left">
                  <label htmlFor="access-code">{t("join.codeLabel")}</label>
                  <input id="access-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={12} inputMode="text" placeholder="K7QM-4XNP" style={{ letterSpacing: "0.12em", fontVariantNumeric: "tabular-nums" }} />
                </div>
                <button type="submit" className="btn btn-navy" disabled={!code.trim() || redeem.isPending}>
                  {redeem.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("join.submit")}
                </button>
                {redeem.isError && <p className="text-sm" role="alert" style={{ color: "var(--red)" }}>{(redeem.error as Error).message}</p>}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
