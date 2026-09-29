// SEO-1 (riga 47): arrivo del link "Password dimenticata?". better-auth
// verifica il token su /api/auth/reset-password/:token e rimanda qui con
// ?token=… (valido) oppure ?error=INVALID_TOKEN (scaduto o già usato).
// Prima questa pagina non esisteva: il link dell'email finiva su "Pagina non
// trovata" e la password non si poteva reimpostare.
import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  useDocumentTitle(`${t("resetPassword.title")} · PrevAI`);
  const params = new URLSearchParams(useSearch());
  const token = params.get("token");
  const linkInvalid = !token || params.get("error") !== null;

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("signUp.errorPasswordLength"));
      return;
    }
    setIsLoading(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        if (result.error.code === "INVALID_TOKEN") setExpired(true);
        else setError(result.error.message ?? t("resetPassword.errorGeneric"));
      } else {
        setDone(true);
      }
    } catch {
      setError(t("signIn.errorConnectionRetry"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card-body">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>

          {done ? (
            <div className="auth-center">
              <div className="flex justify-center mb-3"><CheckCircle2 className="h-9 w-9" style={{ color: "var(--navy)" }} /></div>
              <h1 className="auth-title" style={{ marginBottom: 8 }}>{t("resetPassword.doneTitle")}</h1>
              <p className="auth-sub" style={{ marginBottom: 24 }}>{t("resetPassword.doneBody")}</p>
              <Link href="/sign-in" className="btn btn-navy w-full">{t("signIn.signIn")}</Link>
            </div>
          ) : linkInvalid || expired ? (
            <div className="auth-center">
              <div className="flex justify-center mb-3"><AlertCircle className="h-9 w-9" style={{ color: "var(--navy)" }} /></div>
              <h1 className="auth-title" style={{ marginBottom: 8 }}>{t("resetPassword.invalidTitle")}</h1>
              <p className="auth-sub" style={{ marginBottom: 24 }}>{t("resetPassword.invalidBody")}</p>
              <Link href="/sign-in" className="btn btn-navy w-full">{t("signIn.backToLogin")}</Link>
            </div>
          ) : (
            <>
              <h1 className="auth-title">{t("resetPassword.title")}</h1>
              <p className="auth-sub">{t("resetPassword.subtitle")}</p>

              {error && (
                <div className="auth-error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="auth-field">
                  <label htmlFor="newPassword">{t("resetPassword.newPassword")}</label>
                  <div className="input-wrap">
                    <input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      autoComplete="new-password"
                      enterKeyHint="done"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={t("signUp.passwordPlaceholder")}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="auth-pw-toggle" aria-label={showPassword ? t("a11y.hidePassword") : t("a11y.showPassword")} aria-pressed={showPassword}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="btn btn-navy w-full gap-2" style={{ marginBottom: 14 }}>
                  {isLoading ? <span className="auth-spin" /> : null}
                  {isLoading ? t("resetPassword.saving") : t("resetPassword.save")}
                </button>
                <Link href="/sign-in" className="auth-link-muted w-full text-center block">
                  {t("signIn.backToLogin")}
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
