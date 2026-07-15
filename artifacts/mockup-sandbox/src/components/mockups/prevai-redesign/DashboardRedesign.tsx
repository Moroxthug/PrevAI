import { useEffect, useRef } from "react";
import {
  FileText, TrendingUp, CalendarDays, Sparkles, Plus, ArrowRight, Crown,
  CheckCircle2, Gift, ImagePlus, Mic, User, ChevronDown, LayoutDashboard,
  Users, BarChart3, BookOpen, Receipt, Briefcase, FolderOpen, Settings,
  Search, Bell, Lock, Clock,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   PREVAI — Redesign Dashboard
   Contenuti e voci originali invariati · Palette originale
   ───────────────────────────────────────────────────────────── */

const CSS = `
  .pv-root { font-family: 'Inter', 'Inter Variable', system-ui, sans-serif; }
  @keyframes pvShimmer { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  .prevai-word {
    display: inline-block;
    background: linear-gradient(110deg, #7C3AED 10%, #4F46E5 30%, #06B6D4 50%, #4F46E5 70%, #7C3AED 90%);
    background-size: 250% auto;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
    animation: pvShimmer 5s ease-in-out infinite;
    font-weight: 800;
  }
  .btn-gradient {
    background: linear-gradient(135deg, #7C3AED, #4F46E5, #06B6D4);
    background-size: 200% auto; color: #fff; border-radius: 9999px; border: none;
    transition: background-position .4s ease, transform .2s ease, box-shadow .2s ease;
    box-shadow: 0 4px 16px rgba(124,58,237,.28);
  }
  .btn-gradient:hover { background-position: right center; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(124,58,237,.4); }
  .card-soft { box-shadow: 0 2px 8px rgba(0,0,0,.04), 0 0 1px rgba(0,0,0,.06); transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
  .card-lift:hover { transform: translateY(-3px); box-shadow: 0 12px 28px -10px rgba(124,58,237,.16); }
  .pv-reveal { opacity: 0; transform: translateY(18px); transition: opacity .6s cubic-bezier(.22,1,.36,1), transform .6s cubic-bezier(.22,1,.36,1); }
  .pv-reveal.pv-in { opacity: 1; transform: translateY(0); }
  .pv-reveal-d1 { transition-delay: .07s; } .pv-reveal-d2 { transition-delay: .14s; }
  .pv-reveal-d3 { transition-delay: .21s; } .pv-reveal-d4 { transition-delay: .28s; }
  @keyframes pvHeroSheen { 0% { transform: translateX(-100%) skewX(-15deg); } 100% { transform: translateX(250%) skewX(-15deg); } }
  .hero-sheen::after {
    content: ''; position: absolute; top: 0; bottom: 0; width: 35%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent);
    animation: pvHeroSheen 5s ease-in-out infinite;
  }
  .nav-active { background: linear-gradient(135deg, rgba(124,58,237,.10), rgba(6,182,212,.08)); color: #6D28D9; }
  @keyframes pvPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,.22);} 50% { box-shadow: 0 0 0 8px rgba(124,58,237,0);} }
  .ai-bar-glow { animation: pvPulse 3s ease-in-out infinite; }
`;

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("pv-in")),
      { threshold: 0.08 }
    );
    el.querySelectorAll(".pv-reveal").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

const NAV = [
  { label: "Dashboard", Icon: LayoutDashboard, active: true },
  { label: "Preventivi", Icon: FileText },
  { label: "Clienti", Icon: Users },
  { label: "Analytics", Icon: BarChart3 },
  { label: "Listino", Icon: BookOpen, pro: true },
  { label: "Fatture", Icon: Receipt, soon: true },
  { label: "CRM", Icon: Briefcase },
  { label: "Archivio", Icon: FolderOpen },
  { label: "Impostazioni", Icon: Settings },
];

const STAT_CARDS = [
  { label: "Questo Mese", value: "14", Icon: CalendarDays, color: "text-violet-500", accent: "bg-violet-50", spark: [4, 7, 5, 9, 8, 12, 14] },
  { label: "Sbloccati", value: "9", Icon: CheckCircle2, color: "text-emerald-500", accent: "bg-emerald-50", spark: [2, 4, 3, 6, 5, 8, 9] },
  { label: "Fatturato Sbloccato", value: "€ 24.350", Icon: TrendingUp, color: "text-blue-500", accent: "bg-blue-50", spark: [6, 9, 7, 12, 11, 15, 18] },
  { label: "Valore Medio", value: "€ 2.706", Icon: Sparkles, color: "text-amber-500", accent: "bg-amber-50", spark: [8, 7, 9, 8, 10, 9, 11] },
];

const RECENT_QUOTES = [
  { client: "Mario Rossi", status: "unlocked", date: "04/07/2026", total: "€ 1.769", incentivi: "Ecobonus 65% + Bando Milano" },
  { client: "Condominio Aurora", status: "pending_payment", date: "03/07/2026", total: "€ 12.400", incentivi: "Bonus Casa 50% + Sconto IVA 10%" },
  { client: "Giulia Bianchi", status: "unlocked", date: "01/07/2026", total: "€ 3.150", incentivi: "Bando Efficienza Lombardia" },
  { client: "Cliente non specificato", status: "draft", date: "28/06/2026", total: "€ 890", incentivi: "Verifica non richiesta" },
  { client: "Impresa Verdi srl", status: "unlocked", date: "26/06/2026", total: "€ 6.140", incentivi: "Conto Termico GSE 65%" },
];

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${34 - (v / max) * 30}`).join(" ");
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className={className}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "unlocked")
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full"><CheckCircle2 className="h-2.5 w-2.5" /> Sbloccato</span>;
  if (status === "pending_payment")
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">In attesa</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full"><Lock className="h-2.5 w-2.5" /> Bozza</span>;
}

export function Preview() {
  const rootRef = useReveal();
  return (
    <div ref={rootRef} className="pv-root min-h-screen bg-white text-gray-900 antialiased flex">
      <style>{CSS}</style>

      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex w-60 flex-col bg-white border-r border-gray-100 sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center border-b border-gray-50">
          <span className="prevai-word text-xl">prevai</span>
        </div>
        <div className="px-3 pt-4">
          <button className="btn-gradient w-full h-9 inline-flex items-center justify-center gap-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> Nuovo preventivo
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ label, Icon, active, pro, soon }) => (
            <a key={label} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all ${active ? "nav-active font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {pro && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 rounded-full">PRO</span>}
              {soon && <span className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-1.5 rounded-full">Presto</span>}
            </a>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-50">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="h-8 w-8 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>M</div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gray-800 truncate">Marco</div>
              <div className="text-[10px] text-gray-400 truncate">Piano Pro</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40 flex items-center justify-between px-5 gap-4">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-3.5 h-9 w-full max-w-sm">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <input placeholder="Cerca preventivi, clienti..." className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400" />
          </div>
          <div className="flex items-center gap-2">
            <button className="h-9 w-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-violet-600 transition-colors relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-violet-500" />
            </button>
            <div className="h-9 w-9 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>M</div>
          </div>
        </header>

        <main className="p-5 max-w-5xl mx-auto space-y-4">
          {/* ── Hero greeting (contenuto originale) ── */}
          <div className="pv-reveal hero-sheen relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-500 to-cyan-500 px-6 py-5 text-white shadow-lg shadow-violet-300/40">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 60%)" }} />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold tracking-tight">Ciao, Marco!</h1>
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    <Crown className="h-2.5 w-2.5" /> Pro
                  </span>
                </div>
                <p className="text-white/75 text-xs">Piano Pro attivo — preventivi illimitati</p>
              </div>
              <button className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors backdrop-blur-sm border border-white/20">
                <Plus className="h-3.5 w-3.5" /> Nuovo
              </button>
            </div>
          </div>

          {/* ── AI bar (contenuto originale) ── */}
          <div className="pv-reveal pv-reveal-d1 ai-bar-glow bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5">
              <button className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"><ImagePlus className="h-4 w-4" /></button>
              <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
              <input placeholder="Descrivi il lavoro e ottieni un preventivo in 30 secondi..." className="flex-1 text-sm outline-none placeholder:text-gray-400 text-gray-800 bg-transparent min-w-0" />
              <button className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"><Mic className="h-4 w-4" /></button>
              <button className="h-9 w-9 rounded-full btn-gradient flex items-center justify-center shrink-0"><ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>

          {/* ── Committente (contenuto originale) ── */}
          <div className="pv-reveal pv-reveal-d1 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-600">Committente</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400">opzionale</span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </div>
            </div>
            <div className="px-4 pb-2.5 flex flex-wrap gap-1.5 border-t border-gray-50 pt-2">
              {["Mario Rossi", "Condominio Aurora", "Giulia Bianchi"].map((c, i) => (
                <button key={c} className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all ${i === 0 ? "border-violet-300 bg-violet-50 text-violet-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-violet-200 hover:bg-violet-50/50"}`}>
                  <User className="h-2.5 w-2.5" /> {c}
                </button>
              ))}
              <button className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-all">+ Nuovo</button>
            </div>
          </div>

          {/* ── Trial banner (contenuto originale) ── */}
          <div className="pv-reveal pv-reveal-d2 bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0"><Gift className="h-4 w-4 text-violet-600" /></div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 text-sm">
                  Prova gratuita attiva
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full"><Clock className="h-2.5 w-2.5" /> 4 giorni rimangono</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Hai ancora 1 download gratuito su 1 — PDF senza costi!</div>
              </div>
            </div>
            <button className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3.5 text-xs font-semibold gap-1"><Sparkles className="h-3 w-3" /> Crea ora</button>
          </div>

          {/* ── Stat cards (voci originali) ── */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {STAT_CARDS.map(({ label, value, Icon, color, accent, spark }, i) => (
              <div key={label} className={`pv-reveal pv-reveal-d${i + 1} bg-white rounded-2xl border border-gray-100 p-4 card-soft card-lift relative overflow-hidden`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">{label}</span>
                  <div className={`h-7 w-7 rounded-lg ${accent} flex items-center justify-center`}><Icon className={`h-3.5 w-3.5 ${color}`} /></div>
                </div>
                <div className="text-xl font-extrabold text-gray-900 truncate mb-1">{value}</div>
                <Sparkline data={spark} className={`w-full h-6 ${color}`} />
              </div>
            ))}
          </div>

          {/* ── Upsell (contenuto originale) ── */}
          <div className="pv-reveal bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-100 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0"><Crown className="h-4 w-4 text-violet-500" /></div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Sblocca tutti i preventivi</div>
                <div className="text-xs text-gray-500 mt-0.5">Con il piano Pro tutti i preventivi vengono sbloccati automaticamente.</div>
              </div>
            </div>
            <button className="shrink-0 btn-gradient inline-flex h-8 items-center justify-center px-3.5 text-xs font-semibold">Passa a Pro</button>
          </div>

          {/* ── Preventivi Recenti (contenuto originale) ── */}
          <div className="pv-reveal bg-white rounded-2xl border border-gray-100 card-soft overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Preventivi Recenti</h2>
                <p className="text-xs text-gray-400 mt-0.5">Ultimi 5 generati</p>
              </div>
              <a className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors cursor-pointer">Vedi tutti <ArrowRight className="h-3 w-3" /></a>
            </div>
            <div>
              {RECENT_QUOTES.map((q, idx) => (
                <a key={idx} className={`flex items-center justify-between px-5 py-3 hover:bg-violet-50/40 transition-colors cursor-pointer ${idx !== RECENT_QUOTES.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgba(124,58,237,.10), rgba(6,182,212,.10))" }}>
                      <FileText className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{q.client}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <StatusBadge status={q.status} />
                        <span className="text-[10px] text-gray-400">{q.date}</span>
                        {q.incentivi && q.incentivi !== "Verifica non richiesta" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                            🎁 {q.incentivi}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="font-bold text-sm text-gray-900">{q.total}</span>
                    <ArrowRight className="h-3 w-3 text-gray-300" />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* ── Azioni rapide (contenuto originale) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-8">
            {[
              { label: "Nuovo preventivo", Icon: Plus, accent: "bg-violet-100", color: "text-violet-500", hover: "hover:border-violet-200" },
              { label: "Tutti i preventivi", Icon: FileText, accent: "bg-blue-100", color: "text-blue-500", hover: "hover:border-blue-200" },
              { label: "Profilo azienda", Icon: Sparkles, accent: "bg-emerald-100", color: "text-emerald-500", hover: "hover:border-emerald-200" },
            ].map(({ label, Icon, accent, color, hover }, i) => (
              <a key={label} className={`pv-reveal pv-reveal-d${i + 1} bg-white border border-gray-100 rounded-2xl p-3.5 flex items-center gap-3 ${hover} transition-all group card-soft card-lift cursor-pointer`}>
                <div className={`h-8 w-8 rounded-xl ${accent} flex items-center justify-center`}><Icon className={`h-4 w-4 ${color}`} /></div>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </a>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Preview;
