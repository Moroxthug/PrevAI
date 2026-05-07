import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

function safeLocalPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  if (/^\/[^/]/.test(raw) || raw === "/") return raw;
  return fallback;
}

export default function SignInPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const nextPath = safeLocalPath(new URLSearchParams(search).get("next"), "/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: nextPath,
      });
      if (result.error) {
        setError(result.error.message ?? "Credenziali non valide. Riprova.");
      } else {
        navigate(nextPath);
      }
    } catch {
      setError("Errore di connessione. Riprova tra qualche secondo.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: resetEmail.trim(),
        redirectTo: "/reset-password",
      });
      if (result.error) {
        setResetError(result.error.message ?? "Errore nell'invio. Riprova.");
      } else {
        setResetSent(true);
      }
    } catch {
      setResetError("Errore di connessione. Riprova.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden">
          <div className="px-8 pt-8 pb-6">
            <div className="flex justify-center mb-6">
              <Logo />
            </div>

            {!resetMode ? (
              <>
                <h1 className="text-xl font-bold text-gray-900 text-center mb-1">Accedi a Prevai</h1>
                <p className="text-sm text-gray-400 text-center mb-6">Inserisci le tue credenziali</p>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="mario@esempio.it"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setResetMode(true); setResetEmail(email); setError(null); }}
                      className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
                    >
                      Password dimenticata?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-gradient w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isLoading ? "Accesso in corso..." : "Accedi"}
                  </button>
                </form>
              </>
            ) : resetSent ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">📧</div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Email inviata!</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Se l'indirizzo <strong>{resetEmail}</strong> è registrato, riceverai un'email con il link per reimpostare la password.
                </p>
                <button
                  onClick={() => { setResetMode(false); setResetSent(false); }}
                  className="text-sm text-violet-600 hover:underline font-medium"
                >
                  Torna al login
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-gray-900 text-center mb-1">Reimposta password</h1>
                <p className="text-sm text-gray-400 text-center mb-6">Ti invieremo un link via email</p>

                {resetError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="mario@esempio.it"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="btn-gradient w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {resetLoading ? "Invio in corso..." : "Invia link di reset"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetMode(false)}
                    className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Torna al login
                  </button>
                </form>
              </>
            )}
          </div>

          {!resetMode && (
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
              <span className="text-sm text-gray-500">Non hai un account? </span>
              <Link href={nextPath !== "/dashboard" ? `/sign-up?next=${encodeURIComponent(nextPath)}` : "/sign-up"} className="text-sm text-violet-600 font-semibold hover:underline">
                Registrati
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
