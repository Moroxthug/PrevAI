import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  Users, TrendingUp, FileText, Euro, ToggleLeft, ToggleRight,
  RefreshCw, ArrowLeft, Crown, Zap, Calendar, BarChart3,
  ChevronUp, ChevronDown, Minus, Search, Settings, ShieldAlert,
  Sparkles, CheckCircle2, AlertTriangle, PlayCircle, Activity,
  Globe, Search as SearchIcon, Award, HeartHandshake, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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
  stripeCustomerId: string | null;
  createdAt: string;
};

type Settings = Record<string, string>;
type Tab = "overview" | "users" | "stripe" | "gsc" | "seo" | "settings";

type GscSummary = {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
};

type GscKeyword = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type GscTrend = {
  day: string;
  clicks: number;
  impressions: number;
};

type SeoPageResult = {
  url: string;
  name: string;
  score: number;
  title: string;
  description: string;
  h1: string;
  issues: string[];
};

type SeoAuditResult = {
  overallScore: number;
  pages: SeoPageResult[];
  lastChecked: string;
};

function Trend({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct > 0) return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600"><ChevronUp className="h-3 w-3" />{pct}% vs mese scorso</span>;
  if (pct < 0) return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500"><ChevronDown className="h-3 w-3" />{Math.abs(pct)}% vs mese scorso</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs text-gray-400"><Minus className="h-3 w-3" />Stabile</span>;
}

function PlanBadge({ plan, status }: { plan: string | null; status: string | null }) {
  if (!plan || status !== "active") return <span className="text-xs text-gray-400 font-medium bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">Nessun piano</span>;
  const isPro = plan === "monthly_pro";
  const isElite = plan === "monthly_elite";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      isElite ? "bg-cyan-50 text-cyan-700 border border-cyan-200" :
      isPro ? "bg-amber-50 text-amber-700 border border-amber-200" :
      "bg-violet-50 text-violet-700 border border-violet-200"
    }`}>
      {isPro || isElite ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
      {isElite ? "Elite" : isPro ? "Pro" : "Starter"}
    </span>
  );
}

export default function AdminPage() {
  const { isLoaded, user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Stripe Management state
  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [freePlanType, setFreePlanType] = useState("monthly_pro");
  const [freeDuration, setFreeDuration] = useState("30");
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [grantingPlan, setGrantingPlan] = useState(false);

  // Search Console state
  const [gscSummary, setGscSummary] = useState<GscSummary | null>(null);
  const [gscKeywords, setGscKeywords] = useState<GscKeyword[]>([]);
  const [gscTrends, setGscTrends] = useState<GscTrend[]>([]);
  const [gscLoading, setGscLoading] = useState(false);

  // SEO Checker state
  const [seoResult, setSeoResult] = useState<SeoAuditResult | null>(null);
  const [seoScanning, setSeoScanning] = useState(false);

  // Users filter state
  const [userSearch, setUserSearch] = useState("");

  async function authFetch(path: string, options?: RequestInit) {
    const r = await fetch(`${BASE}${path}`, {
      ...options,
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      credentials: "include",
    });
    if (r.type === "opaqueredirect" || r.status === 302 || r.status === 403) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || `${r.status}`);
    }
    return r.json() as Promise<any>;
  }

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        authFetch("/api/admin/metrics"),
        authFetch("/api/admin/settings"),
      ]);
      setMetrics(m as Metrics);
      setSettings(s as Settings);
    } catch (e: any) {
      if (e.status === 403) setForbidden(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    loadBaseData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  async function loadUsers() {
    setLoading(true);
    try {
      const u = await authFetch("/api/admin/users");
      setUsers(u as AdminUser[]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Errore", description: "Impossibile caricare gli utenti." });
    } finally {
      setLoading(false);
    }
  }

  async function loadGSC() {
    setGscLoading(true);
    try {
      const res = await authFetch("/api/admin/search-console");
      setGscSummary(res.summary);
      setGscKeywords(res.keywords);
      setGscTrends(res.trends);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Errore", description: "Impossibile caricare i dati di Search Console." });
    } finally {
      setGscLoading(false);
    }
  }

  async function runSeoScan() {
    setSeoScanning(true);
    // Simulate real scanning delay for visual premium feel
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      const res = await authFetch("/api/admin/seo-audit");
      setSeoResult(res);
      toast({ title: "Scansione Completata", description: "SEO Checker ha analizzato tutte le landing page principali." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Errore", description: "Impossibile eseguire il SEO audit." });
    } finally {
      setSeoScanning(false);
    }
  }

  useEffect(() => {
    if (tab === "users") {
      loadUsers();
    } else if (tab === "gsc") {
      loadGSC();
    } else if (tab === "seo" && !seoResult) {
      runSeoScan();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function toggleSetting(key: string, currentValue: string) {
    const newValue = currentValue === "false" ? "true" : "false";
    setSavingKey(key);
    try {
      await authFetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key, value: newValue }),
      });
      setSettings(prev => ({ ...prev, [key]: newValue }));
      toast({ title: "Impostazione salvata", description: `Configurazione ${key} aggiornata.` });
    } catch {
      toast({ variant: "destructive", title: "Errore", description: "Impossibile salvare l'impostazione." });
    } finally {
      setSavingKey(null);
    }
  }

  async function handleGrantPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserEmail) return;
    setGrantingPlan(true);
    try {
      await authFetch("/api/admin/grant-plan", {
        method: "POST",
        body: JSON.stringify({
          email: selectedUserEmail,
          plan: freePlanType,
          days: Number(freeDuration),
        }),
      });
      toast({ title: "Piano Assegnato con Successo", description: `Abbonamento ${freePlanType} concesso per ${freeDuration} giorni a ${selectedUserEmail}.` });
      setSelectedUserEmail("");
      loadUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Errore", description: err.message || "Impossibile assegnare il piano." });
    } finally {
      setGrantingPlan(false);
    }
  }

  async function handleSyncStripe(email: string) {
    try {
      await authFetch("/api/admin/sync-subscription", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast({ title: "Sincronizzazione completata", description: `Abbonamento di ${email} aggiornato da Stripe.` });
      loadUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Errore di sincronizzazione", description: err.message || "Verifica che l'utente esista su Stripe." });
    }
  }

  async function handleLinkCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserEmail || !stripeCustomerId) return;
    try {
      await authFetch("/api/admin/sync-by-customer", {
        method: "POST",
        body: JSON.stringify({
          stripeCustomerId,
          userEmail: selectedUserEmail,
        }),
      });
      toast({ title: "Cliente Stripe Collegato", description: `Stripe Customer ${stripeCustomerId} collegato con successo a ${selectedUserEmail}.` });
      setStripeCustomerId("");
      setSelectedUserEmail("");
      loadUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Errore", description: err.message || "Impossibile collegare l'ID cliente." });
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/40">
        <div className="h-9 w-9 rounded-full border-[3px] border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/40 px-4">
        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-xl max-w-md w-full text-center">
          <div className="h-14 w-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Accesso Riservato</h1>
          <p className="text-slate-500 text-sm mb-6">Solo gli amministratori del sistema possono accedere a questa console di amministrazione.</p>
          <Link href="/" className="btn-gradient inline-flex items-center justify-center h-10 px-6 font-semibold w-full">
            Torna alla Home
          </Link>
        </div>
      </div>
    );
  }

  const registrationOpen = (settings["registration_open"] ?? "true") !== "false";
  const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  // Filter users based on search
  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.firstName || "").toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.companyName || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans">
      {/* Top Glassmorphic Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-100/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-violet-600 animate-pulse" />
              <h1 className="text-base font-bold text-slate-900">Console Admin</h1>
            </div>
            <p className="text-xs text-slate-400">Pannello di controllo globale per {user?.name || user?.email}</p>
          </div>
        </div>

        <button
          onClick={loadBaseData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 bg-white shadow-sm text-xs text-slate-500 hover:text-slate-800 transition-all font-medium"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Aggiorna Dati
        </button>
      </header>

      {/* Main Page Layout */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
        
        {/* Navigation Sidebar/List */}
        <aside className="w-full md:w-60 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-100 p-2 shadow-sm space-y-1">
            {[
              { id: "overview", label: "Panoramica", icon: BarChart3 },
              { id: "users", label: "Utenti Registrati", icon: Users },
              { id: "stripe", label: "Abbonamenti Stripe", icon: Euro },
              { id: "gsc", label: "Search Console", icon: Globe },
              { id: "seo", label: "SEO Checker", icon: Sparkles },
              { id: "settings", label: "Impostazioni", icon: Settings },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as Tab)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === item.id
                    ? "bg-violet-50 text-violet-700 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <item.icon className={`h-4 w-4 ${tab === item.id ? "text-violet-600" : "text-slate-400"}`} />
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Content Container */}
        <main className="flex-1 min-w-0">

          {/* OVERVIEW TAB */}
          {tab === "overview" && metrics && (
            <div className="space-y-6">
              {/* Premium Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Utenti Totali", value: String(metrics.totalUsers), sub: `+${metrics.usersThisMonth} questo mese`, icon: Users, color: "text-violet-500", bg: "bg-violet-50" },
                  { label: "Stima MRR", value: fmt(metrics.mrr), sub: `${metrics.starterCount} Starter · ${metrics.proCount} Pro`, icon: Euro, color: "text-emerald-500", bg: "bg-emerald-50" },
                  { label: "Preventivi Totali", value: String(metrics.totalQuotes), sub: `${metrics.quotesThisMonth} questo mese`, trend: true, icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
                  { label: "Fatturato Generato", value: fmt(metrics.totalQuoteRevenue), sub: "Valore totale preventivi sbloccati", icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-50" },
                ].map(({ label, value, sub, trend, icon: Icon, color, bg }) => (
                  <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                      <div className={`h-7 w-7 rounded-lg ${bg} flex items-center justify-center`}><Icon className={`h-4 w-4 ${color}`} /></div>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{value}</div>
                    <div className="mt-1">
                      {trend ? <Trend current={metrics.quotesThisMonth} prev={metrics.quotesPrevMonth} /> : <span className="text-xs text-slate-400 font-medium">{sub}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Analytics Graph Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Active Subscriptions Details */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-violet-500" /> Stato Abbonamenti
                  </h2>
                  <div className="space-y-3">
                    <div className="p-3 bg-violet-50/50 border border-violet-100/50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-violet-600" />
                        <div>
                          <div className="text-xs font-bold text-violet-800">Piano Starter</div>
                          <div className="text-[10px] text-violet-500">€19/mese</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-violet-900">{metrics.starterCount}</div>
                        <div className="text-[10px] text-violet-500">{fmt(metrics.starterCount * 19)} MRR</div>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50/50 border border-amber-100/50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-600" />
                        <div>
                          <div className="text-xs font-bold text-amber-800">Piano Pro</div>
                          <div className="text-[10px] text-amber-500">€49/mese</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-amber-900">{metrics.proCount}</div>
                        <div className="text-[10px] text-amber-500">{fmt(metrics.proCount * 49)} MRR</div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-500" />
                        <div>
                          <div className="text-xs font-bold text-slate-700">Utenti Freemium</div>
                          <div className="text-[10px] text-slate-400">Piano base gratuito</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-800">{metrics.totalUsers - metrics.activeSubscriptions}</div>
                        <div className="text-[10px] text-slate-400">senza abbonamento attivo</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated Chart representation */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm lg:col-span-2 space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" /> Crescita Preventivi & Utenti
                  </h2>
                  <div className="h-48 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={[
                          { day: "Giu 1", preventivi: 12, utenti: 5 },
                          { day: "Giu 5", preventivi: 18, utenti: 8 },
                          { day: "Giu 10", preventivi: 15, utenti: 11 },
                          { day: "Giu 15", preventivi: 29, utenti: 15 },
                          { day: "Giu 20", preventivi: 38, utenti: 22 },
                          { day: "Giu 25", preventivi: 45, utenti: 30 },
                          { day: "Giu 30", preventivi: metrics.quotesThisMonth || 52, utenti: metrics.totalUsers || 35 },
                        ]}
                      >
                        <defs>
                          <linearGradient id="colorQuotes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="day" stroke="#94A3B8" />
                        <YAxis stroke="#94A3B8" />
                        <ChartTooltip />
                        <Area type="monotone" dataKey="preventivi" stroke="#7C3AED" strokeWidth={2} fillOpacity={1} fill="url(#colorQuotes)" name="Preventivi" />
                        <Area type="monotone" dataKey="utenti" stroke="#0EA5E9" strokeWidth={2} fillOpacity={0} name="Utenti Registrati" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* USERS TAB */}
          {tab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Elenco Utenti Registrati</h2>
                  <p className="text-xs text-slate-400">Visualizza e gestisci le impostazioni degli account e gli abbonamenti di ciascun utente.</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca per email, nome, azienda..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full sm:w-64 pl-9 pr-4 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">Utente</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">Azienda</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">Piano Attuale</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">Data Iscrizione</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredUsers.map(u => (
                        <tr key={u.userId} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-800">{u.firstName || "Senza Nome"}</div>
                            <div className="text-xs text-slate-400">{u.email || u.userId.slice(0, 16)}</div>
                          </td>
                          <td className="px-5 py-4 text-slate-600 font-medium">{u.companyName || "—"}</td>
                          <td className="px-5 py-4"><PlanBadge plan={u.subscriptionPlan} status={u.subscriptionStatus} /></td>
                          <td className="px-5 py-4 text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td className="px-5 py-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedUserEmail(u.email);
                                setTab("stripe");
                              }}
                              className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                            >
                              Gestisci Piano
                            </button>
                            <button
                              onClick={() => handleSyncStripe(u.email)}
                              className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                              title="Sincronizza stato da Stripe"
                            >
                              Sincronizza
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STRIPE MANAGEMENT TAB */}
          {tab === "stripe" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-800">Connessione & Gestione Abbonamenti</h2>
                <p className="text-xs text-slate-400">Assegna giorni gratuiti di piani premium o associa manualmente ID clienti Stripe.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Free plan grantor form */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4 text-pink-500" /> Concedi Periodo Gratuito
                  </h3>
                  <form onSubmit={handleGrantPlan} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Email dell'Utente</label>
                      <input
                        type="email"
                        required
                        placeholder="utente@esempio.com"
                        value={selectedUserEmail}
                        onChange={(e) => setSelectedUserEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Piano da Assegnare</label>
                      <select
                        value={freePlanType}
                        onChange={(e) => setFreePlanType(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
                      >
                        <option value="monthly_starter">Starter (Standard PDF)</option>
                        <option value="monthly_pro">Pro (PDF senza loghi PrevAI, tutti i template)</option>
                        <option value="monthly_elite">Elite (Supporto massimo, 5 foto)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Giorni Gratis</label>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {[
                          { label: "7 giorni", val: "7" },
                          { label: "1 mese", val: "30" },
                          { label: "3 mesi", val: "90" },
                          { label: "1 anno", val: "365" },
                        ].map(opt => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setFreeDuration(opt.val)}
                            className={`py-1.5 border rounded-lg text-xs font-medium transition-all ${
                              freeDuration === opt.val
                                ? "border-violet-500 bg-violet-50 text-violet-700"
                                : "border-slate-100 hover:bg-slate-50 text-slate-500"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        required
                        min="1"
                        max="1000"
                        value={freeDuration}
                        onChange={(e) => setFreeDuration(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={grantingPlan}
                      className="w-full btn-gradient h-10 font-semibold text-sm transition-all"
                    >
                      {grantingPlan ? "Assegnazione in corso..." : "Concedi Piano Gratis"}
                    </button>
                  </form>
                </div>

                {/* Force-link Stripe Customer Form */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Euro className="h-4 w-4 text-emerald-500" /> Collega ID Stripe Customer
                  </h3>
                  <form onSubmit={handleLinkCustomer} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Email dell'Utente PrevAI</label>
                      <input
                        type="email"
                        required
                        placeholder="utente@esempio.com"
                        value={selectedUserEmail}
                        onChange={(e) => setSelectedUserEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Stripe Customer ID (`cus_...`)</label>
                      <input
                        type="text"
                        required
                        placeholder="cus_RzT83..."
                        value={stripeCustomerId}
                        onChange={(e) => setStripeCustomerId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 h-10 font-bold rounded-xl text-sm transition-all"
                    >
                      Associa Cliente Stripe
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* GOOGLE SEARCH CONSOLE TAB */}
          {tab === "gsc" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-800">Connessione Google Search Console</h2>
                <p className="text-xs text-slate-400">Statistiche live sul posizionamento SEO, clic, impressioni e parole chiave di ricerca.</p>
              </div>

              {gscLoading && (
                <div className="h-48 flex items-center justify-center bg-white rounded-2xl border border-slate-100">
                  <div className="h-7 w-7 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                </div>
              )}

              {!gscLoading && gscSummary && (
                <>
                  {/* Summary grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Clic Totali (GSC)", value: gscSummary.totalClicks, icon: Eye, color: "text-violet-500", bg: "bg-violet-50" },
                      { label: "Impressioni Totali", value: gscSummary.totalImpressions, icon: Globe, color: "text-blue-500", bg: "bg-blue-50" },
                      { label: "CTR Medio", value: `${(gscSummary.averageCtr * 100).toFixed(1)}%`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50" },
                      { label: "Posizione Media", value: gscSummary.averagePosition, icon: Award, color: "text-amber-500", bg: "bg-amber-50" },
                    ].map(({ label, value, icon: Icon, color, bg }) => (
                      <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-400">{label}</span>
                          <div className={`h-6 w-6 rounded-md ${bg} flex items-center justify-center`}><Icon className={`h-3.5 w-3.5 ${color}`} /></div>
                        </div>
                        <div className="text-xl font-bold text-slate-800">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Trend chart */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Andamento Clic & Impressioni (Ultimi 30 Giorni)</h3>
                    <div className="h-44 w-full text-xs">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={gscTrends}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="day" stroke="#94A3B8" />
                          <YAxis yAxisId="left" stroke="#7C3AED" />
                          <YAxis yAxisId="right" orientation="right" stroke="#0EA5E9" />
                          <ChartTooltip />
                          <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#7C3AED" strokeWidth={2} name="Clic" dot={false} />
                          <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#0EA5E9" strokeWidth={2} name="Impressioni" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Keywords performance table */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
                    <h3 className="text-sm font-bold text-slate-800">Parole Chiave di Ricerca (Keywords)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="px-4 py-2 font-bold text-slate-400 uppercase">Query di Ricerca</th>
                            <th className="px-4 py-2 font-bold text-slate-400 uppercase text-center">Clic</th>
                            <th className="px-4 py-2 font-bold text-slate-400 uppercase text-center">Impressioni</th>
                            <th className="px-4 py-2 font-bold text-slate-400 uppercase text-center">CTR</th>
                            <th className="px-4 py-2 font-bold text-slate-400 uppercase text-center">Posizione Media</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {gscKeywords.map(k => (
                            <tr key={k.query} className="hover:bg-slate-50/30">
                              <td className="px-4 py-2.5 font-semibold text-slate-700">{k.query}</td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{k.clicks}</td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{k.impressions}</td>
                              <td className="px-4 py-2.5 text-center text-slate-600">{(k.ctr * 100).toFixed(1)}%</td>
                              <td className="px-4 py-2.5 text-center text-slate-700 font-bold">{k.position}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SEO CHECKER TAB */}
          {tab === "seo" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">SEO Audit & Validator</h2>
                  <p className="text-xs text-slate-400">Analisi automatica in tempo reale degli header, meta-tag e delle intestazioni delle pagine del tuo sito.</p>
                </div>
                <button
                  onClick={runSeoScan}
                  disabled={seoScanning}
                  className="btn-gradient inline-flex items-center gap-1.5 h-9 px-4 text-xs font-bold transition-all"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${seoScanning ? "animate-spin" : ""}`} />
                  Esegui Scansione SEO
                </button>
              </div>

              {seoScanning && (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm text-center space-y-4">
                  <div className="h-10 w-10 bg-violet-50 text-violet-500 rounded-full flex items-center justify-center mx-auto border border-violet-100 animate-spin">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Scansione in Corso</h3>
                    <p className="text-xs text-slate-400 mt-1">SEO Checker sta analizzando meta description, H1, H2 e keyword density di tutte le landing page...</p>
                  </div>
                </div>
              )}

              {!seoScanning && seoResult && (
                <div className="space-y-6">
                  {/* Global Score Panel */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-800">Punteggio SEO Globale del Sito</h3>
                      <p className="text-xs text-slate-400">Basato sulla corretta implementazione dei meta tag di base, OpenGraph e intestazioni H1/H2.</p>
                      <div className="text-[10px] text-slate-400">Ultima scansione: {new Date(seoResult.lastChecked).toLocaleTimeString("it-IT")}</div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="relative h-20 w-20 flex items-center justify-center rounded-full border-4 border-emerald-500 bg-emerald-50/50">
                        <div className="text-center">
                          <span className="text-2xl font-bold text-emerald-700">{seoResult.overallScore}</span>
                          <span className="text-[10px] text-emerald-600 block">/100</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scanned Pages breakdown */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Risultati Dettagliati per Pagina</h3>
                    
                    <div className="space-y-3">
                      {seoResult.pages.map(page => (
                        <div key={page.url} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-400">{page.name}</div>
                              <div className="text-sm font-bold text-slate-700">{page.url}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              page.score >= 90 ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                              page.score >= 75 ? "bg-amber-50 text-amber-600 border border-amber-200" :
                              "bg-red-50 text-red-600 border border-red-200"
                            }`}>
                              SEO: {page.score}/100
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-slate-50 rounded-xl text-xs">
                            <div>
                              <span className="block font-bold text-slate-400 mb-0.5">Tag Title</span>
                              <span className="text-slate-700 font-medium">{page.title || "—"}</span>
                            </div>
                            <div>
                              <span className="block font-bold text-slate-400 mb-0.5">Meta Description</span>
                              <span className="text-slate-700 font-medium">{page.description || "—"}</span>
                            </div>
                            <div>
                              <span className="block font-bold text-slate-400 mb-0.5">Intestazione H1</span>
                              <span className="text-slate-700 font-semibold">{page.h1 || "—"}</span>
                            </div>
                          </div>

                          {page.issues.length > 0 ? (
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-slate-500 block">Elementi da sistemare:</span>
                              {page.issues.map((issue, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  {issue}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              Nessun problema SEO riscontrato. Ottimizzazione al 100%!
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PLATFORM CONFIGURATION SETTINGS */}
          {tab === "settings" && (
            <div className="space-y-4 max-w-lg">
              <h2 className="text-base font-bold text-slate-800">Impostazioni Piattaforma</h2>
              <p className="text-xs text-slate-400">Modifica la configurazione globale delle registrazioni e dell'accesso.</p>
              
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Registrazioni Aperte</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Disattivando questa opzione, la pagina di registrazione mostrerà un avviso di beta chiusa.</p>
                  </div>
                  <button
                    onClick={() => toggleSetting("registration_open", settings["registration_open"] ?? "true")}
                    disabled={savingKey === "registration_open"}
                    className="shrink-0 transition-colors disabled:opacity-50"
                  >
                    {registrationOpen ? <ToggleRight className="h-8 w-8 text-emerald-500" /> : <ToggleLeft className="h-8 w-8 text-slate-400" />}
                  </button>
                </div>
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${registrationOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {registrationOpen ? "Aperte — Nuovi utenti possono registrarsi liberamente" : "Chiuse — Sign-up disabilitato"}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700">
                <strong>Nota:</strong> Le registrazioni chiuse impediscono esclusivamente la creazione di nuovi account. Tutti gli utenti registrati esistenti potranno continuare ad accedere regolarmente alla propria dashboard.
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
