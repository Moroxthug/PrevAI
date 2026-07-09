import { useEffect, useRef } from "react";
import {
  LayoutDashboard, Briefcase, Users, TrendingUp, AlertCircle, Building2,
  BookOpen, FileText, Receipt, FolderOpen, BarChart3, Calendar, Settings,
  DollarSign, Search, Bell, Plus, ArrowUpRight, ChevronRight, Sparkles,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   PREVAI CRM — Redesign
   Voci, dati e contenuti originali invariati · Palette originale
   ───────────────────────────────────────────────────────────── */

const CSS = `
  .pv-root { font-family: 'Inter', 'Inter Variable', system-ui, sans-serif; }
  @keyframes pvShimmer { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  .prevai-word {
    display: inline-block;
    background: linear-gradient(110deg, #a78bfa 10%, #818cf8 30%, #22d3ee 50%, #818cf8 70%, #a78bfa 90%);
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
  .crm-nav-active {
    background: linear-gradient(135deg, rgba(124,58,237,.25), rgba(6,182,212,.15));
    color: #fff; position: relative;
  }
  .crm-nav-active::before {
    content: ''; position: absolute; left: 0; top: 20%; bottom: 20%; width: 3px;
    border-radius: 3px; background: linear-gradient(180deg, #7C3AED, #06B6D4);
  }
  @keyframes pvBarGrow { from { width: 0; } }
  .bar-grow { animation: pvBarGrow 1.2s cubic-bezier(.22,1,.36,1) both; }
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

/* Voci sidebar originali (due gruppi come nell'app attuale) */
const NAV_OPERATIVO = [
  { id: "dashboard", label: "Dashboard Generale", Icon: LayoutDashboard, active: true },
  { id: "cantieri", label: "Gestione Cantieri", Icon: Briefcase },
  { id: "lavoratori", label: "Gestione Lavoratori", Icon: Users },
  { id: "finanze", label: "Gestione Finanze", Icon: TrendingUp },
  { id: "costi_extra", label: "Costi Extra", Icon: AlertCircle },
  { id: "fornitori", label: "Fornitori", Icon: Building2 },
  { id: "listino", label: "Listino Prezzi", Icon: BookOpen },
];
const NAV_AMMINISTRAZIONE = [
  { id: "sal", label: "Stato Avanzamento (SAL)", Icon: FileText },
  { id: "fatturazione", label: "Fatturazione Elettronica", Icon: Receipt },
  { id: "pratiche", label: "Gestione Pratiche", Icon: FolderOpen },
  { id: "analytics", label: "KPI & Analytics", Icon: BarChart3 },
  { id: "calendario", label: "Calendario Scadenze", Icon: Calendar },
  { id: "impostazioni", label: "Impostazioni API", Icon: Settings },
];

/* Dati originali dal CRM */
const KPI = [
  { label: "Entrate Totali", val: "€68.500", Icon: DollarSign, color: "text-blue-600", accent: "bg-blue-50", trend: "+12%" },
  { label: "Margine Operativo", val: "€23.870", Icon: TrendingUp, color: "text-emerald-600", accent: "bg-emerald-50", trend: "+8%" },
  { label: "Costi Collaboratori", val: "€14.300", Icon: Users, color: "text-amber-600", accent: "bg-amber-50", trend: "+3%" },
  { label: "Spese Impreviste", val: "€2.330", Icon: AlertCircle, color: "text-rose-600", accent: "bg-rose-50", trend: "-5%" },
];

const CANTIERI = [
  { name: "Ristrutturazione Villa Bifamiliare - Cantiere Via Roma", progress: 62, budget: "€38.000", stato: "In Corso", statoCls: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "Rifacimento Tetto e Lattoneria - Condominio Aurora", progress: 12, budget: "€21.500", stato: "In Partenza", statoCls: "bg-amber-50 text-amber-700 border-amber-200" },
  { name: "Isolamento Termico a Cappotto - Residenza Verde", progress: 100, budget: "€9.000", stato: "Completato", statoCls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

const PRATICHE = [
  { title: "CILA - Via Roma 45", status: "Approvata", date: "2026-05-02", prot: "CILA-2026/8892", cls: "bg-green-50 text-green-700 border-green-200" },
  { title: "SCIA - Ristrutturazione Condominio Aurora", status: "In Lavorazione", date: "2026-07-10", prot: "SCIA-2026/1029", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { title: "Fine Lavori & APE - Residenza Verde", status: "Pronta", date: "2026-06-20", prot: "APE-251412", cls: "bg-blue-50 text-blue-700 border-blue-200" },
];

const SCADENZE = [
  { date: "02 Luglio 2026", type: "Pratica", title: "Approvazione CILA - Villa Roma", cls: "bg-violet-100 text-violet-700" },
  { date: "05 Luglio 2026", type: "Cantiere", title: "Posa del massetto autolivellante - Cantiere Via Roma", cls: "bg-blue-100 text-blue-700" },
  { date: "10 Luglio 2026", type: "Fattura", title: "Acconto 30% - Condominio Aurora", cls: "bg-emerald-100 text-emerald-700" },
  { date: "15 Luglio 2026", type: "Tasse", title: "F24 Ritenute d'acconto dipendenti", cls: "bg-rose-100 text-rose-700" },
];

const COLLABORATORI = [
  { name: "Marco Bianchi", role: "Dipendente", category: "Muratore/Capocantiere", rate: "€25/h", hours: 360 },
  { name: "Alessandro Neri", role: "Collaboratore Esterno", category: "Elettricista", rate: "€30/h", hours: 35 },
  { name: "Roberto Verdi", role: "Collaboratore Esterno", category: "Idraulico", rate: "€30/h", hours: 45 },
  { name: "Luca Rossi", role: "Dipendente", category: "Cartongessista/Pintore", rate: "€22/h", hours: 110 },
];

export function Preview() {
  const rootRef = useReveal();
  return (
    <div ref={rootRef} className="pv-root min-h-screen bg-white text-gray-900 antialiased flex">
      <style>{CSS}</style>

      {/* ── Sidebar scura professionale ── */}
      <aside className="hidden lg:flex w-64 flex-col sticky top-0 h-screen text-gray-300" style={{ background: "linear-gradient(180deg, #0B1120 0%, #101830 100%)" }}>
        <div className="h-16 px-5 flex items-center gap-2 border-b border-white/5">
          <span className="prevai-word text-xl">prevai</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded-full">CRM</span>
        </div>
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Operativo</div>
          <div className="space-y-0.5 mb-5">
            {NAV_OPERATIVO.map(({ id, label, Icon, active }) => (
              <a key={id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium cursor-pointer transition-all ${active ? "crm-nav-active" : "hover:bg-white/5 hover:text-white"}`}>
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                <span>{label}</span>
              </a>
            ))}
          </div>
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Amministrazione</div>
          <div className="space-y-0.5">
            {NAV_AMMINISTRAZIONE.map(({ id, label, Icon }) => (
              <a key={id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium cursor-pointer transition-all hover:bg-white/5 hover:text-white">
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                <span>{label}</span>
              </a>
            ))}
          </div>
        </nav>
        <div className="p-3 border-t border-white/5">
          <div className="rounded-xl p-3" style={{ background: "linear-gradient(135deg, rgba(124,58,237,.18), rgba(6,182,212,.12))" }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-1"><Sparkles className="h-3.5 w-3.5 text-violet-300" /> Assistente AI</div>
            <p className="text-[10px] text-gray-400 leading-relaxed">Chiedi qualcosa all'AI sui tuoi cantieri.</p>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40 flex items-center justify-between px-5 gap-4">
          <h2 className="text-sm md:text-base font-bold text-gray-900 uppercase tracking-wider">Dashboard Generale</h2>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-3.5 h-9 w-64">
              <Search className="h-3.5 w-3.5 text-gray-400" />
              <input placeholder="Cerca cantieri, fornitori..." className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400" />
            </div>
            <button className="h-9 w-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-violet-600 transition-colors relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>
            <button className="btn-gradient h-9 px-4 inline-flex items-center gap-1.5 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" /> Nuovo Cantiere
            </button>
          </div>
        </header>

        <main className="p-5 max-w-6xl mx-auto space-y-4">
          {/* ── KPI (voci originali) ── */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {KPI.map(({ label, val, Icon, color, accent, trend }, i) => (
              <div key={label} className={`pv-reveal pv-reveal-d${i + 1} bg-white rounded-2xl border border-gray-100 p-4 card-soft card-lift`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`h-9 w-9 rounded-xl ${accent} flex items-center justify-center`}><Icon className={`h-4 w-4 ${color}`} /></div>
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trend.startsWith("+") ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                    <ArrowUpRight className={`h-2.5 w-2.5 ${trend.startsWith("-") ? "rotate-90" : ""}`} /> {trend}
                  </span>
                </div>
                <div className="text-xl font-extrabold text-gray-900">{val}</div>
                <div className="text-xs font-medium text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* ── Avanzamento Lavori (contenuto originale) ── */}
            <div className="pv-reveal lg:col-span-2 bg-white rounded-2xl border border-gray-100 card-soft overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Avanzamento Lavori</h3>
                <a className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 cursor-pointer">Elenco Cantieri Operativi <ChevronRight className="h-3 w-3" /></a>
              </div>
              <div className="p-5 space-y-5">
                {CANTIERI.map((c, i) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1.5 gap-3">
                      <div className="text-sm font-semibold text-gray-800 truncate">{c.name}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.statoCls}`}>{c.stato}</span>
                        <span className="text-xs font-bold text-gray-700">{c.progress}%</span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="bar-grow h-full rounded-full" style={{ width: `${c.progress}%`, background: "linear-gradient(90deg, #7C3AED, #4F46E5, #06B6D4)", animationDelay: `${i * 0.15}s` }} />
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">Budget: {c.budget}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Pratiche e CILA Attive (contenuto originale) ── */}
            <div className="pv-reveal pv-reveal-d1 bg-white rounded-2xl border border-gray-100 card-soft overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Pratiche e CILA Attive</h3>
              </div>
              <div className="p-4 space-y-3">
                {PRATICHE.map((p) => (
                  <div key={p.prot} className="rounded-xl border border-gray-100 p-3 hover:border-violet-200 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-xs font-semibold text-gray-800 leading-snug">{p.title}</div>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${p.cls}`}>{p.status}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">Prot. {p.prot} · {p.date}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* ── Collaboratori e Ore (contenuto originale) ── */}
            <div className="pv-reveal lg:col-span-2 bg-white rounded-2xl border border-gray-100 card-soft overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Collaboratori e Ore</h3>
                <a className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 cursor-pointer">Gestione Lavoratori <ChevronRight className="h-3 w-3" /></a>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50">
                    <th className="text-left px-5 py-2.5">Nome</th>
                    <th className="text-left px-3 py-2.5">Ruolo</th>
                    <th className="text-left px-3 py-2.5 hidden sm:table-cell">Categoria</th>
                    <th className="text-right px-3 py-2.5">Tariffa</th>
                    <th className="text-right px-5 py-2.5">Ore</th>
                  </tr>
                </thead>
                <tbody>
                  {COLLABORATORI.map((w, i) => (
                    <tr key={w.name} className={`hover:bg-violet-50/40 transition-colors ${i !== COLLABORATORI.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>
                            {w.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <span className="font-semibold text-gray-800 text-xs">{w.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${w.role === "Dipendente" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-cyan-50 text-cyan-700 border-cyan-200"}`}>{w.role}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 hidden sm:table-cell">{w.category}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-gray-700 text-right">{w.rate}</td>
                      <td className="px-5 py-3 text-xs font-bold text-gray-900 text-right">{w.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Scadenze Cronologiche (contenuto originale) ── */}
            <div className="pv-reveal pv-reveal-d1 bg-white rounded-2xl border border-gray-100 card-soft overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Scadenze Cronologiche</h3>
              </div>
              <div className="p-4">
                <div className="relative pl-5">
                  <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gradient-to-b from-violet-300 via-indigo-200 to-cyan-200" />
                  <div className="space-y-4">
                    {SCADENZE.map((s) => (
                      <div key={s.title} className="relative">
                        <div className="absolute -left-5 top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow" style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }} />
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${s.cls}`}>{s.type}</span>
                          <span className="text-[10px] text-gray-400">{s.date}</span>
                        </div>
                        <div className="text-xs font-medium text-gray-700 leading-snug">{s.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Marginalità dei Cantieri (contenuto originale) ── */}
          <div className="pv-reveal bg-white rounded-2xl border border-gray-100 card-soft overflow-hidden mb-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Marginalità dei Cantieri</h3>
              <a className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 cursor-pointer">KPI & Analytics <ChevronRight className="h-3 w-3" /></a>
            </div>
            <div className="p-5 grid sm:grid-cols-3 gap-4">
              {CANTIERI.map((c, i) => {
                const margine = [34, 41, 28][i];
                return (
                  <div key={c.name} className="rounded-xl border border-gray-100 p-4 card-lift card-soft">
                    <div className="text-xs font-semibold text-gray-800 leading-snug mb-3 line-clamp-2 min-h-[2rem]">{c.name}</div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Margine</div>
                        <div className="text-lg font-extrabold text-emerald-600">{margine}%</div>
                      </div>
                      <div className="flex items-end gap-1 h-10">
                        {[40, 65, 50, 80, margine + 30].map((h, j) => (
                          <div key={j} className="w-2 rounded-t bar-grow" style={{ height: `${h}%`, background: j === 4 ? "linear-gradient(180deg, #06B6D4, #4F46E5)" : "#EDE9FE", animationDelay: `${j * 0.08}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Preview;
