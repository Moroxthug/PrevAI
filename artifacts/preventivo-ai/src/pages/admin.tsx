import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/react";
import { Link } from "wouter";
import {
  Users, TrendingUp, FileText, Euro, ToggleLeft, ToggleRight,
  RefreshCw, ArrowLeft, Crown, Zap, Calendar, BarChart3,
  ChevronUp, ChevronDown, Minus,
} from "lucide-react";

type Metrics = {
  totalUsers: number;
  usersThisMonth: number;
  activeSubscriptions: number;
  starterCount: number;
  proCount: number;
  mrr: number;
  totalQuotes: number;
  quotesThisMonth: number;
  quotesPrevMonth: number;
  totalQuoteRevenue: number;
};

type AdminUser = {
  userId: string;
  email: string;
  firstName: string;
  companyName: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  createdAt: string;
};

type Settings = Record<string, string>;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

type Tab = "overview" | "users" | "settings";

function Trend({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct > 0)
    return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600"><ChevronUp className="h-3 w-3" />{pct}% vs mese scorso</span>;
  if (pct < 0)
    return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500"><ChevronDown className="h-3 w-3" />{Math.abs(pct)}% vs mese scorso</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs text-gray-400"><Minus className="h-3 w-3" />Stabile</span>;
}

function PlanBadge({ plan, status }: { plan: string | null; status: string | null }) {
  if (!plan || status !== "active")
    return <span className="text-xs text-gray-400">Nessun piano</span>;
  const isPro = plan === "monthly_pro";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isPro ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
      {isPro ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
      {isPro ? "Pro" : "Starter"}
    </span>
  );
}

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const [tab, setTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const m = await apiFetch("/api/admin/metrics");
      setMetrics(m);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "403") setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const u = await apiFetch("/api/admin/users");
      setUsers(u);
    } catch {
      // ignored
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const s = await apiFetch("/api/admin/settings");
      setSettings(s);
    } catch {
      // ignored
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    loadMetrics();
    loadSettings();
  }, [isLoaded, loadMetrics, loadSettings]);

  useEffect(() => {
    if (tab === "users" && users.length === 0) loadUsers();
  }, [tab, users.length, loadUsers]);

  async function toggleSetting(key: string, currentValue: string) {
    const newValue = currentValue === "false" ? "true" : "false";
    setSavingKey(key);
    try {
      await apiFetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key, value: newValue }),
      });
      setSettings(prev => ({ ...prev, [key]: newValue }));
    } catch {
      // ignored
    } finally {
      setSavingKey(null);
    }
  }

  if (!isLoaded) return null;

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Accesso negato</h1>
          <p className="text-gray-500 text-sm mb-6">Solo gli amministratori possono accedere a questa pagina.</p>
          <Link href="/" className="text-violet-600 hover:underline text-sm">Torna alla home</Link>
        </div>
      </div>
    );
  }

  const registrationOpen = (settings["registration_open"] ?? "true") !== "false";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-xs text-gray-400">Ciao, {user?.firstName ?? user?.emailAddresses[0]?.emailAddress}</p>
          </div>
        </div>
        <button
          onClick={() => { loadMetrics(); loadSettings(); if (tab === "users") loadUsers(); }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Aggiorna
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {(["overview", "users", "settings"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-violet-600 text-violet-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "overview" ? "Panoramica" : t === "users" ? "Utenti" : "Impostazioni"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="space-y-6">
            {loading && !metrics ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="bg-white rounded-2xl border p-5 animate-pulse">
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
                    <div className="h-7 bg-gray-200 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : metrics ? (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-500">Utenti totali</span>
                      <div className="h-7 w-7 rounded-lg bg-violet-50 flex items-center justify-center">
                        <Users className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{metrics.totalUsers}</div>
                    <div className="mt-1 text-xs text-gray-400">+{metrics.usersThisMonth} questo mese</div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-500">MRR</span>
                      <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Euro className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(metrics.mrr)}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {metrics.starterCount} Starter · {metrics.proCount} Pro
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-500">Preventivi questo mese</span>
                      <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{metrics.quotesThisMonth}</div>
                    <div className="mt-1">
                      <Trend current={metrics.quotesThisMonth} prev={metrics.quotesPrevMonth} />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-500">Valore preventivi totale</span>
                      <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
                        <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(metrics.totalQuoteRevenue)}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">{metrics.totalQuotes} preventivi totali</div>
                  </div>
                </div>

                {/* Subscription breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-violet-500" />
                    Abbonamenti attivi
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-violet-500" />
                        <span className="text-sm font-semibold text-violet-700">Starter</span>
                      </div>
                      <div className="text-3xl font-bold text-violet-900">{metrics.starterCount}</div>
                      <div className="text-xs text-violet-600 mt-1">
                        {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(metrics.starterCount * 29)}/mese
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-semibold text-amber-700">Pro</span>
                      </div>
                      <div className="text-3xl font-bold text-amber-900">{metrics.proCount}</div>
                      <div className="text-xs text-amber-600 mt-1">
                        {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(metrics.proCount * 79)}/mese
                      </div>
                    </div>
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-600">Senza piano</span>
                      </div>
                      <div className="text-3xl font-bold text-gray-700">{metrics.totalUsers - metrics.activeSubscriptions}</div>
                      <div className="text-xs text-gray-400 mt-1">utenti freemium</div>
                    </div>
                  </div>
                </div>

                {/* Registration status banner */}
                <div className={`rounded-2xl border p-4 flex items-center justify-between ${registrationOpen ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <div>
                    <p className={`text-sm font-semibold ${registrationOpen ? "text-emerald-700" : "text-red-700"}`}>
                      Registrazioni: {registrationOpen ? "APERTE" : "CHIUSE"}
                    </p>
                    <p className={`text-xs mt-0.5 ${registrationOpen ? "text-emerald-600" : "text-red-600"}`}>
                      {registrationOpen ? "Nuovi utenti possono registrarsi." : "Il sign-up è disabilitato."}
                    </p>
                  </div>
                  <button
                    onClick={() => setTab("settings")}
                    className="text-xs font-semibold underline underline-offset-2 text-gray-600 hover:text-gray-900"
                  >
                    Cambia →
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{users.length} utenti registrati</h2>
              <button onClick={loadUsers} className="text-xs text-violet-600 hover:underline">Aggiorna</button>
            </div>

            {loading && users.length === 0 ? (
              <div className="bg-white rounded-2xl border p-8 text-center">
                <div className="text-gray-400 text-sm">Caricamento…</div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Utente</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Azienda</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Piano</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Iscritto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {users.map(u => (
                        <tr key={u.userId} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 text-sm">{u.firstName || "—"}</div>
                            <div className="text-xs text-gray-400">{u.email || u.userId.slice(0, 16)}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{u.companyName || "—"}</td>
                          <td className="px-4 py-3">
                            <PlanBadge plan={u.subscriptionPlan} status={u.subscriptionStatus} />
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {new Date(u.createdAt).toLocaleDateString("it-IT")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <div className="space-y-4 max-w-lg">
            <h2 className="text-sm font-semibold text-gray-900">Impostazioni piattaforma</h2>

            {/* Registration toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Registrazioni aperte</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Se disattivato, la pagina di sign-up mostra un messaggio "beta chiusa" e blocca la registrazione.
                  </p>
                </div>
                <button
                  onClick={() => toggleSetting("registration_open", settings["registration_open"] ?? "true")}
                  disabled={savingKey === "registration_open"}
                  className="shrink-0 transition-colors disabled:opacity-50"
                >
                  {registrationOpen ? (
                    <ToggleRight className="h-8 w-8 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-gray-400" />
                  )}
                </button>
              </div>
              <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${registrationOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {registrationOpen ? "✓ Aperte — nuovi utenti possono iscriversi" : "✗ Chiuse — sign-up bloccato"}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700">
              <strong>Nota:</strong> le registrazioni chiuse bloccano solo nuovi sign-up. Gli utenti esistenti continuano ad accedere normalmente.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
