import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  Users, TrendingUp, FileText, Euro, ToggleLeft, ToggleRight,
  RefreshCw, ArrowLeft, Crown, Zap, Calendar, BarChart3,
  ChevronUp, ChevronDown, Minus, Search, Settings, ShieldAlert,
  Sparkles, CheckCircle2, AlertTriangle, PlayCircle, Activity,
  Globe, Search as SearchIcon, Award, HeartHandshake, Eye,
  MessageSquare, Bot, Send
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
type Tab = "overview" | "users" | "clients" | "stripe" | "gsc" | "seo" | "settings" | "support";

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

  // Support live chat states
  const [adminOnline, setAdminOnline] = useState(false);
  const [supportConvs, setSupportConvs] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [convMessages, setConvMessages] = useState<any[]>([]);
  const [adminReply, setAdminReply] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);

  // Client monitoring / widget control state
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [clientQuotes, setClientQuotes] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);

  async function loadSupportStatus() {
    try {
      const res = await authFetch("/api/support/admin-status");
      setAdminOnline(res.online);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadSupportConvs() {
    try {
      const list = await authFetch("/api/support/conversations");
      setSupportConvs(list);
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleAdminOnline() {
    try {
      const newStatus = !adminOnline;
      await authFetch("/api/support/admin-status", {
        method: "POST",
        body: JSON.stringify({ online: newStatus }),
      });
      setAdminOnline(newStatus);
      toast({ title: "Stato operatore aggiornato", description: `Ora sei ${newStatus ? "online" : "offline"} per il supporto.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Errore", description: "Impossibile aggiornare lo stato." });
    }
  }

  // Poll conversations when tab === "support"
  useEffect(() => {
    if (tab !== "support") return;
    loadSupportStatus();
    loadSupportConvs();

    const interval = setInterval(() => {
      loadSupportConvs();
    }, 4000);

    return () => clearInterval(interval);
  }, [tab]);

  // Poll messages for active conversation
  useEffect(() => {
    if (tab !== "support" || !selectedConvId) return;

    const fetchMsgs = async () => {
      try {
        const msgs = await authFetch(`/api/support/conversations/${selectedConvId}/messages`);
        setConvMessages(msgs);
      } catch (e) {
        console.error(e);
      }
    };

    fetchMsgs();
    const interval = setInterval(fetchMsgs, 3000);
    return () => clearInterval(interval);
  }, [tab, selectedConvId]);

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

  async function loadClientQuotes(targetUserId: string) {
    setLoadingQuotes(true);
    try {
      const data = await authFetch(`/api/admin/users/${targetUserId}/quotes`);
      setClientQuotes(data);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile caricare i preventivi per questo cliente.",
      });
    } finally {
      setLoadingQuotes(false);
    }
  }

  const handleToggleExpandClient = (targetUserId: string) => {
    if (expandedUserId === targetUserId) {
      setExpandedUserId(null);
      setClientQuotes([]);
    } else {
      setExpandedUserId(targetUserId);
      setClientQuotes([]);
      loadClientQuotes(targetUserId);
    }
  };

  async function rotateApiKey(targetUserId: string, customKey?: string) {
    setRotatingKeyId(targetUserId);
    try {
      const res = await authFetch(`/api/admin/users/${targetUserId}/apikey`, {
        method: "POST",
        body: JSON.stringify({ apiKey: customKey }),
      });
      if (res.success) {
        toast({ title: "Chiave API aggiornata", description: "La chiave API per questo client è stata aggiornata con successo." });
        loadUsers();
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile aggiornare la chiave API.",
      });
    } finally {
      setRotatingKeyId(null);
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
    if (tab === "users" || tab === "clients") {
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
              { id: "clients", label: "Clienti & Widget", icon: Zap },
              { id: "stripe", label: "Abbonamenti Stripe", icon: Euro },
              { id: "gsc", label: "Search Console", icon: Globe },
              { id: "seo", label: "SEO Checker", icon: Sparkles },
              { id: "support", label: "Chat Supporto", icon: MessageSquare },
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
                  <p className="text-xs text-slate-400">Visualizza e gestisci le impostazioni degli account, i preventivi generati, i costi API e gli abbonamenti di ciascun utente.</p>
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
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">Preventivi / Costo API</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">Data Iscrizione</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredUsers.map(u => {
                        const isExpanded = expandedUserId === u.userId;
                        return (
                          <optgroup key={u.userId} label={u.firstName || u.email || u.userId} className="contents">
                            <tr className={`hover:bg-slate-50/40 transition-colors ${isExpanded ? "bg-slate-50/20" : ""}`}>
                              <td className="px-5 py-4">
                                <div className="font-semibold text-slate-800">{u.firstName || "Senza Nome"}</div>
                                <div className="text-xs text-slate-400">{u.email || u.userId.slice(0, 16)}</div>
                              </td>
                              <td className="px-5 py-4 text-slate-600 font-medium">{u.companyName || "—"}</td>
                              <td className="px-5 py-4"><PlanBadge plan={u.subscriptionPlan} status={u.subscriptionStatus} /></td>
                              <td className="px-5 py-4">
                                <div className="font-semibold text-slate-700">{(u as any).quoteCount ?? 0} prev.</div>
                                <div className="text-xs text-emerald-600 font-bold">{Number((u as any).totalCost ?? 0).toFixed(4)} €</div>
                              </td>
                              <td className="px-5 py-4 text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}</td>
                              <td className="px-5 py-4 text-right space-x-2">
                                <button
                                  onClick={() => handleToggleExpandClient(u.userId)}
                                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors inline-flex items-center gap-0.5 cursor-pointer mr-2"
                                >
                                  <span>Preventivi</span>
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedUserEmail(u.email);
                                    setTab("stripe");
                                  }}
                                  className="text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
                                >
                                  Gestisci Piano
                                </button>
                                <button
                                  onClick={() => handleSyncStripe(u.email)}
                                  className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                  title="Sincronizza stato da Stripe"
                                >
                                  Sincronizza
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className="bg-slate-50/40 p-6 border-b border-slate-100">
                                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 text-left max-w-5xl mx-auto">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h3 className="text-sm font-bold text-slate-800">
                                          Cronologia Preventivi Generati — {u.companyName || u.firstName || "Cliente"}
                                        </h3>
                                        <p className="text-xs text-slate-400">Elenco completo dei preventivi richiesti via Web, WhatsApp e Widget.</p>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                          Totale Costo API: <span className="text-emerald-600 font-mono">{Number((u as any).totalCost ?? 0).toFixed(4)} €</span>
                                        </span>
                                      </div>
                                    </div>

                                    {loadingQuotes ? (
                                      <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                                        <RefreshCw className="h-6 w-6 animate-spin text-violet-500" />
                                        <span className="text-xs">Caricamento preventivi in corso...</span>
                                      </div>
                                    ) : clientQuotes.length === 0 ? (
                                      <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 border border-dashed border-slate-100 rounded-xl">
                                        Nessun preventivo generato da questo utente.
                                      </div>
                                    ) : (
                                      <div className="overflow-hidden border border-slate-100 rounded-xl">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                              <th className="px-4 py-3 font-bold text-slate-500">Preventivo / Cliente</th>
                                              <th className="px-4 py-3 font-bold text-slate-500">Data Generazione</th>
                                              <th className="px-4 py-3 font-bold text-slate-500">Canale / Origine</th>
                                              <th className="px-4 py-3 font-bold text-slate-500">Modello & Token</th>
                                              <th className="px-4 py-3 font-bold text-slate-500">Importo Totale</th>
                                              <th className="px-4 py-3 font-bold text-slate-500 text-right">Costo API</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-50">
                                            {clientQuotes.map(q => (
                                              <tr key={q.id} className="hover:bg-slate-50/20">
                                                <td className="px-4 py-3">
                                                  <div className="font-semibold text-slate-800" title={q.numeroPreventivoData}>
                                                    {q.numeroPreventivoData || "Preventivo s.n."}
                                                  </div>
                                                  <div className="text-[10px] text-slate-400">
                                                    {q.clientData?.nome || "Lead Anonimo"}
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                  {new Date(q.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </td>
                                                <td className="px-4 py-3">
                                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                    q.source === "widget" ? "bg-cyan-50 text-cyan-700 border-cyan-150" :
                                                    q.source === "whatsapp" ? "bg-emerald-50 text-emerald-700 border-emerald-150" :
                                                    "bg-violet-50 text-violet-700 border-violet-150"
                                                  }`}>
                                                    {q.source === "widget" ? "Widget Funnel" : q.source === "whatsapp" ? "WhatsApp Bot" : "Web App"}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">
                                                  {q.modelUsed ? (
                                                    <div>
                                                      <div className="font-mono text-[10px] text-slate-700 font-medium">{q.modelUsed}</div>
                                                      <div className="text-[9px] text-slate-400">Tokens: {q.promptTokens} in / {q.completionTokens} out</div>
                                                    </div>
                                                  ) : (
                                                    <span className="text-slate-400">—</span>
                                                  )}
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-slate-700">
                                                  {Number(q.totale || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-600">
                                                  {q.apiCost ? `${Number(q.apiCost).toFixed(4)} €` : "0.0000 €"}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </optgroup>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* WIDGET TAB */}
          {tab === "widget" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Integrazione & Gestione Widget</h2>
                  <p className="text-xs text-slate-400">Controlla l'attivazione dei widget di acquisizione lead edili, assegna chiavi API dedicate e preleva i codici embed.</p>
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
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">Cliente</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">Azienda</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">Chiave API Widget</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide">Stato Widget</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide text-right">Integrazione</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredUsers.map(u => {
                        const isExpanded = expandedUserId === u.userId;
                        return (
                          <optgroup key={u.userId} label={u.firstName || u.email || u.userId} className="contents">
                            <tr className={`hover:bg-slate-50/40 transition-colors ${isExpanded ? "bg-slate-50/20" : ""}`}>
                              <td className="px-5 py-4">
                                <div className="font-semibold text-slate-800">{u.firstName || "Senza Nome"}</div>
                                <div className="text-xs text-slate-400">{u.email || u.userId.slice(0, 16)}</div>
                              </td>
                              <td className="px-5 py-4 text-slate-600 font-medium">{u.companyName || "—"}</td>
                              <td className="px-5 py-4">
                                {(u as any).apiKey ? (
                                  <span className="font-mono text-xs bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-slate-600">
                                    {(u as any).apiKey.slice(0, 15)}...
                                  </span>
                                ) : (
                                  <span className="text-red-500 text-xs font-medium bg-red-50 px-2 py-0.5 rounded border border-red-100">Nessuna chiave</span>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                {(u as any).apiKey ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2.5 py-0.5 rounded-full">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Attivo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-150 px-2.5 py-0.5 rounded-full">
                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                                    Disattivato
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <button
                                  onClick={() => handleToggleExpandClient(u.userId)}
                                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  {isExpanded ? "Chiudi" : "Configura"}
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={5} className="bg-slate-50/40 p-6 border-b border-slate-100">
                                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm text-left max-w-4xl mx-auto space-y-5">
                                    <div className="flex items-start gap-4">
                                      <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                                        <Zap className="h-5 w-5" />
                                      </div>
                                      <div>
                                        <h3 className="text-sm font-bold text-slate-800">
                                          Configurazione Funnel Lead — {u.companyName || u.firstName || "Cliente"}
                                        </h3>
                                        <p className="text-xs text-slate-400">Gestisci l'accesso al Widget di acquisizione per questo utente. Puoi impostare chiavi API e prelevare il codice HTML da inserire nel loro sito.</p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                      <div className="md:col-span-1 space-y-4">
                                        <div className="space-y-1.5">
                                          <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">Chiave API Attiva</label>
                                          <input
                                            type="text"
                                            readOnly
                                            value={(u as any).apiKey || "Nessuna chiave configurata"}
                                            className="font-mono text-xs bg-slate-50 text-slate-700 px-3 py-2 border border-slate-100 rounded-xl w-full focus:outline-none text-center"
                                          />
                                        </div>
                                        <button
                                          onClick={() => rotateApiKey(u.userId)}
                                          disabled={rotatingKeyId === u.userId}
                                          className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                          {rotatingKeyId === u.userId ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                          {(u as any).apiKey ? "Rigenera API Key" : "Genera Chiave API"}
                                        </button>
                                      </div>

                                      <div className="md:col-span-2 space-y-2">
                                        <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">Codice Script Embed</label>
                                        {(u as any).apiKey ? (
                                          <div className="relative">
                                            <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto font-mono text-[10px] leading-relaxed max-h-40 whitespace-pre-wrap select-all border border-slate-800">
{`<!-- PrevAI Widget Funnel -->
<div id="prevai-widget"></div>
<script
  src="${typeof window !== "undefined" ? window.location.origin : "https://prevai.vercel.app"}/widget.js"
  data-api-key="${(u as any).apiKey}"
  async
></script>`}
                                            </pre>
                                            <button
                                              onClick={() => {
                                                const code = `<!-- PrevAI Widget Funnel -->\n<div id="prevai-widget"></div>\n<script\n  src="${typeof window !== "undefined" ? window.location.origin : "https://prevai.vercel.app"}/widget.js"\n  data-api-key="${(u as any).apiKey}"\n  async\n></script>`;
                                                navigator.clipboard.writeText(code);
                                                toast({ title: "Codice copiato!", description: "Il codice di embed è stato copiato negli appunti." });
                                              }}
                                              className="absolute right-3 top-3 bg-slate-850 hover:bg-slate-800 text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded-md border border-slate-700 transition-all cursor-pointer shadow-sm"
                                            >
                                              Copia Codice
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-xs text-slate-400">
                                            Genera una chiave API per visualizzare e prelevare il codice di embed.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </optgroup>
                        );
                      })}
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

          {/* SUPPORT TAB */}
          {tab === "support" && (
            <div className="space-y-6">
              {/* Header section with toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl border border-slate-100 p-5 shadow-sm gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-violet-500" /> Supporto Clienti Real-time
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Gestisci le chat di supporto, parla con i visitatori e imposta la tua disponibilità.</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold text-slate-500">Stato Operatore:</span>
                  <button
                    onClick={toggleAdminOnline}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-bold"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${adminOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                    {adminOnline ? "Online (Ricevi chat)" : "Offline (Solo AI)"}
                  </button>
                </div>
              </div>

              {/* Chat Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                {/* Conversation List */}
                <div className="bg-white rounded-2xl border border-slate-100 flex flex-col overflow-hidden shadow-sm lg:col-span-1">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conversazioni</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {supportConvs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        Nessuna conversazione di supporto registrata.
                      </div>
                    ) : (
                      supportConvs.map(c => {
                        const isSelected = selectedConvId === c.id;
                        const hasWaiting = c.status === "human_needed";
                        const isActive = c.status === "human_active";
                        return (
                          <button
                            key={c.id}
                            onClick={() => setSelectedConvId(c.id)}
                            className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex flex-col gap-1.5 ${
                              isSelected ? "bg-violet-50/50 border-l-4 border-violet-600" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800 truncate">{c.title}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                hasWaiting ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                isActive ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                                c.status === "closed" ? "bg-slate-100 text-slate-500 border border-slate-200" :
                                "bg-violet-100 text-violet-700 border border-violet-200"
                              }`}>
                                {hasWaiting ? "Attesa" : isActive ? "Attiva" : c.status === "closed" ? "Chiusa" : "AI"}
                              </span>
                            </div>
                            {c.visitorEmail && (
                              <span className="text-[10px] text-slate-500 truncate">{c.visitorEmail}</span>
                            )}
                            <span className="text-[9px] text-slate-400 self-end">
                              {new Date(c.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Chat Panel */}
                <div className="bg-white rounded-2xl border border-slate-100 flex flex-col overflow-hidden shadow-sm lg:col-span-2">
                  {selectedConvId ? (
                    (() => {
                      const activeConv = supportConvs.find(c => c.id === selectedConvId);
                      return (
                        <>
                          {/* Chat Header */}
                          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                {activeConv?.title}
                                <span className={`h-2 w-2 rounded-full ${
                                  activeConv?.status === "human_needed" ? "bg-amber-500 animate-ping" :
                                  activeConv?.status === "human_active" ? "bg-emerald-500" :
                                  activeConv?.status === "closed" ? "bg-slate-400" : "bg-violet-500"
                                }`} />
                              </div>
                              {activeConv && (activeConv.visitorName || activeConv.visitorEmail || activeConv.visitorPhone) && (
                                <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                                  {activeConv.visitorName && <span>Nome: <strong>{activeConv.visitorName}</strong></span>}
                                  {activeConv.visitorEmail && <span>Email: <strong>{activeConv.visitorEmail}</strong></span>}
                                  {activeConv.visitorPhone && <span>Tel: <strong>{activeConv.visitorPhone}</strong></span>}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {activeConv?.status === "human_needed" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await authFetch(`/api/support/conversations/${selectedConvId}/join`, { method: "POST" });
                                      loadSupportConvs();
                                      toast({ title: "Chat presa in carico", description: "Ora puoi rispondere al visitatore." });
                                    } catch (e) {
                                      toast({ variant: "destructive", title: "Errore", description: "Impossibile prendere in carico." });
                                    }
                                  }}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                                >
                                  Prendi in Carico
                                </button>
                              )}
                              {activeConv?.status !== "closed" && (
                                <button
                                  onClick={async () => {
                                    if (confirm("Sei sicuro di voler chiudere questa conversazione?")) {
                                      try {
                                        await authFetch(`/api/support/conversations/${selectedConvId}/close`, { method: "POST" });
                                        loadSupportConvs();
                                        toast({ title: "Chat chiusa", description: "La conversazione è stata contrassegnata come chiusa." });
                                      } catch (e) {
                                        toast({ variant: "destructive", title: "Errore", description: "Impossibile chiudere la chat." });
                                      }
                                    }
                                  }}
                                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition"
                                >
                                  Chiudi Chat
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Message History */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                            {convMessages.length === 0 ? (
                              <div className="p-8 text-center text-xs text-slate-400">
                                In attesa di messaggi...
                              </div>
                            ) : (
                              convMessages.map((m, idx) => {
                                const isAdminMsg = m.role === "admin";
                                const isAi = m.role === "assistant";
                                return (
                                  <div key={m.id || idx} className={`flex gap-2 ${isAdminMsg ? "justify-end" : ""}`}>
                                    {!isAdminMsg && (
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${isAi ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                                        {isAi ? <Bot className="h-3.5 w-3.5" /> : "U"}
                                      </div>
                                    )}
                                    <div className={`p-3 rounded-2xl text-xs max-w-[70%] shadow-sm ${
                                      isAdminMsg ? "bg-violet-600 text-white rounded-tr-none" :
                                      isAi ? "bg-white border border-slate-100 text-slate-600 rounded-tl-none italic" :
                                      "bg-white border border-slate-100 text-slate-800 rounded-tl-none font-medium"
                                    }`}>
                                      <div className="leading-relaxed whitespace-pre-wrap">{m.content}</div>
                                      <div className={`text-[8px] mt-1 text-right ${isAdminMsg ? "text-violet-200" : "text-slate-400"}`}>
                                        {new Date(m.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                                      </div>
                                    </div>
                                    {isAdminMsg && (
                                      <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                                        OP
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Message input */}
                          {activeConv?.status !== "closed" ? (
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (!adminReply.trim()) return;
                                const content = adminReply;
                                setAdminReply("");
                                try {
                                  await authFetch(`/api/support/conversations/${selectedConvId}/messages`, {
                                    method: "POST",
                                    body: JSON.stringify({ role: "admin", content }),
                                  });
                                  // Refresh messages
                                  const msgs = await authFetch(`/api/support/conversations/${selectedConvId}/messages`);
                                  setConvMessages(msgs);
                                } catch (err) {
                                  toast({ variant: "destructive", title: "Errore", description: "Impossibile inviare il messaggio." });
                                }
                              }}
                              className="p-3 border-t border-slate-100 bg-white flex gap-2"
                            >
                              <input
                                type="text"
                                placeholder="Digita una risposta..."
                                value={adminReply}
                                onChange={e => setAdminReply(e.target.value)}
                                className="flex-1 px-3 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-xs focus:outline-none focus:border-violet-500"
                              />
                              <button
                                type="submit"
                                disabled={!adminReply.trim()}
                                className="p-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all disabled:opacity-50 shrink-0"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            </form>
                          ) : (
                            <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 border-t">
                              Questa chat è chiusa. Non puoi inviare messaggi.
                            </div>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <MessageSquare className="h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold">Nessuna conversazione selezionata</p>
                      <p className="text-[10px] text-slate-400 mt-1">Seleziona una chat dalla lista a sinistra per iniziare.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
