import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  TrendingUp,
  AlertCircle,
  Building2,
  Receipt,
  FolderOpen,
  BarChart3,
  Calendar,
  Settings,
  Plus,
  CheckCircle2,
  DollarSign,
  Clock,
  ArrowUpRight,
  FileText,
  Loader2,
  UserPlus,
  TrendingDown,
  Hammer,
  Search,
  ChevronRight,
  Info,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  Mail,
  Sparkles
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Link } from "wouter";


// Mock Data Types
interface Task {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
}

interface Worker {
  name: string;
  role: string;
  hours: number;
  rate: number;
}

interface Project {
  id: string;
  name: string;
  status: "planning" | "active" | "suspended" | "completed";
  budget: number;
  startDate: string;
  endDate: string;
  tasks: Task[];
  workers: Worker[];
  extraCosts: { desc: string; amount: number; date: string }[];
  invoiceStatus: "not_invoiced" | "draft" | "sent";
  invoiceNum?: string;
  materials?: { desc: string; cost: number; supplier: string; date: string }[];
  documents?: { name: string; type: "computo" | "geometra" | "collaboratore" | "altro"; date: string }[];
}

const INITIAL_PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Ristrutturazione Villa Bifamiliare - Cantiere Via Roma",
    status: "active",
    budget: 85000,
    startDate: "2026-05-10",
    endDate: "2026-08-30",
    tasks: [
      { id: "t1", title: "Approvazione Pratica Edilizia CILA", dueDate: "2026-05-02", completed: true },
      { id: "t2", title: "Posa del massetto autolivellante", dueDate: "2026-07-05", completed: false },
      { id: "t3", title: "Finitura intonaci e tinteggiatura", dueDate: "2026-07-20", completed: false }
    ],
    workers: [
      { name: "Marco Bianchi", role: "Capocantiere", hours: 140, rate: 25 },
      { name: "Alessandro Neri", role: "Elettricista", hours: 35, rate: 30 },
      { name: "Roberto Verdi", role: "Idraulico", hours: 45, rate: 30 },
    ],
    extraCosts: [
      { desc: "Smaltimento macerie imprevisto", amount: 1200, date: "2026-05-15" },
      { desc: "Adeguamento quadro elettrico esterno", amount: 650, date: "2026-06-02" },
    ],
    invoiceStatus: "not_invoiced",
  },
  {
    id: "p2",
    name: "Rifacimento Tetto e Lattoneria - Condominio Aurora",
    status: "planning",
    budget: 42000,
    startDate: "2026-07-15",
    endDate: "2026-09-10",
    tasks: [
      { id: "t4", title: "Firma contratto e versamento acconto", dueDate: "2026-07-10", completed: false },
      { id: "t5", title: "Montaggio ponteggio di sicurezza", dueDate: "2026-07-16", completed: false },
    ],
    workers: [
      { name: "Marco Bianchi", role: "Capocantiere", hours: 0, rate: 25 },
    ],
    extraCosts: [],
    invoiceStatus: "not_invoiced",
  },
  {
    id: "p3",
    name: "Isolamento Termico a Cappotto - Residenza Verde",
    status: "completed",
    budget: 68000,
    startDate: "2026-03-01",
    endDate: "2026-06-15",
    tasks: [
      { id: "t6", title: "Rimozione intonaco esistente", dueDate: "2026-03-10", completed: true },
      { id: "t7", title: "Incollaggio pannelli EPS 12cm", dueDate: "2026-04-15", completed: true },
      { id: "t8", title: "Certificazione energetica APE pre/post", dueDate: "2026-06-20", completed: true },
    ],
    workers: [
      { name: "Marco Bianchi", role: "Capocantiere", hours: 220, rate: 25 },
      { name: "Luca Rossi", role: "Cartongessista", hours: 110, rate: 22 },
    ],
    extraCosts: [
      { desc: "Pannelli extra per spessore pilastri", amount: 480, date: "2026-04-20" },
    ],
    invoiceStatus: "draft",
    invoiceNum: "FAT-2026-104",
  },
];

const INITIAL_COLLABORATORS = [
  { name: "Marco Bianchi", role: "Dipendente", category: "Muratore/Capocantiere", hourlyRate: 25, phone: "+39 333 445566" },
  { name: "Alessandro Neri", role: "Collaboratore Esterno", category: "Elettricista", hourlyRate: 30, phone: "+39 347 112233" },
  { name: "Roberto Verdi", role: "Collaboratore Esterno", category: "Idraulico", hourlyRate: 30, phone: "+39 349 998877" },
  { name: "Luca Rossi", role: "Dipendente", category: "Cartongessista/Pintore", hourlyRate: 22, phone: "+39 328 554433" },
];

const INITIAL_SUPPLIERS = [
  { name: "Edilizia Moderna Spa", category: "Materiali Edili", contactInfo: "Milano - ciao@edilizia.it", phone: "02 887766" },
  { name: "TermoIdraulica Srl", category: "Impiantistica e Tubature", contactInfo: "Torino - info@termo.it", phone: "011 443322" },
  { name: "ElettroForniture Nord", category: "Materiale Elettrico", contactInfo: "Bergamo - sales@elettronord.it", phone: "035 998877" },
];

const INITIAL_PRATICHE = [
  { title: "CILA - Via Roma 45", status: "Approvata", date: "2026-05-02", prot: "CILA-2026/8892" },
  { title: "SCIA - Ristrutturazione Condominio Aurora", status: "In Lavorazione", date: "2026-07-10", prot: "SCIA-2026/1029" },
  { title: "Fine Lavori & APE - Residenza Verde", status: "Pronta", date: "2026-06-20", prot: "APE-251412" },
];

export default function CrmPage() {
  const [activeSection, setActiveSection] = useState<
    | "dashboard"
    | "cantieri"
    | "lavoratori"
    | "finanze"
    | "costi_extra"
    | "fornitori"
    | "fatturazione"
    | "pratiche"
    | "analytics"
    | "calendario"
    | "impostazioni"
  >("dashboard");

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("prevai_crm_projects") : null;
    return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
  });
  const [collaborators, setCollaborators] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("prevai_crm_collaborators") : null;
    return saved ? JSON.parse(saved) : INITIAL_COLLABORATORS;
  });
  const [suppliers, setSuppliers] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("prevai_crm_suppliers") : null;
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });
  const [pratiche, setPratiche] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("prevai_crm_pratiche") : null;
    return saved ? JSON.parse(saved) : INITIAL_PRATICHE;
  });

  React.useEffect(() => {
    localStorage.setItem("prevai_crm_projects", JSON.stringify(projects));
  }, [projects]);

  React.useEffect(() => {
    localStorage.setItem("prevai_crm_collaborators", JSON.stringify(collaborators));
  }, [collaborators]);

  React.useEffect(() => {
    localStorage.setItem("prevai_crm_suppliers", JSON.stringify(suppliers));
  }, [suppliers]);

  React.useEffect(() => {
    localStorage.setItem("prevai_crm_pratiche", JSON.stringify(pratiche));
  }, [pratiche]);

  // States for interactive panels
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // Forms toggles
  const [isAddingProj, setIsAddingProj] = useState(false);
  const [isAddingCollab, setIsAddingCollab] = useState(false);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [isAddingPratica, setIsAddingPratica] = useState(false);

  // New item States
  const [newProjName, setNewProjName] = useState("");
  const [newProjBudget, setNewProjBudget] = useState("");
  const [newCollabName, setNewCollabName] = useState("");
  const [newCollabRate, setNewCollabRate] = useState("");
  const [newCollabPhone, setNewCollabPhone] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCat, setNewSupplierCat] = useState("Materiali Edili");
  const [newPraticaTitle, setNewPraticaTitle] = useState("");
  const [newPraticaProt, setNewPraticaProt] = useState("");

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newExtraCostDesc, setNewExtraCostDesc] = useState("");
  const [newExtraCostAmount, setNewExtraCostAmount] = useState("");
  const [isInvoicing, setIsInvoicing] = useState(false);
  const [newMaterialDesc, setNewMaterialDesc] = useState("");
  const [newMaterialCost, setNewMaterialCost] = useState("");
  const [newMaterialSupplier, setNewMaterialSupplier] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [newDocType, setNewDocType] = useState<"computo" | "geometra" | "collaboratore" | "altro">("computo");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);

  // API Config
  const [apiKey, setApiKey] = useState("fic_live_7c29a8fbc83d91ea82d3");
  const [apiSecret, setApiSecret] = useState("••••••••••••••••••••");

  // Calculations
  const budgetTotale = projects.reduce((acc, p) => acc + p.budget, 0);
  const costiLavoratori = projects.reduce(
    (acc, p) => acc + p.workers.reduce((wAcc, w) => wAcc + w.hours * w.rate, 0),
    0
  );
  const costiExtraTotali = projects.reduce(
    (acc, p) => acc + p.extraCosts.reduce((eAcc, e) => eAcc + e.amount, 0),
    0
  );
  const entrateTotali = projects.filter(p => p.status === "completed" || p.status === "active").reduce((acc, p) => acc + p.budget, 0);
  const margineNetto = entrateTotali - costiLavoratori - costiExtraTotali;

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  // Methods
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    const newProj: Project = {
      id: "p_" + Date.now(),
      name: newProjName,
      status: "planning",
      budget: parseFloat(newProjBudget) || 0,
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      tasks: [],
      workers: [{ name: "Marco Bianchi", role: "Capocantiere", hours: 0, rate: 25 }],
      extraCosts: [],
      invoiceStatus: "not_invoiced",
    };
    setProjects([newProj, ...projects]);
    setNewProjName("");
    setNewProjBudget("");
    setIsAddingProj(false);
  };

  const handleAddTask = (projectId: string) => {
    if (!newTaskTitle.trim()) return;
    setProjects(
      projects.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            tasks: [
              ...p.tasks,
              { id: "t_" + Date.now(), title: newTaskTitle, dueDate: "2026-07-30", completed: false },
            ],
          };
        }
        return p;
      })
    );
    setNewTaskTitle("");
  };

  const handleToggleTask = (projectId: string, taskId: string) => {
    setProjects(
      projects.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)),
          };
        }
        return p;
      })
    );
  };

  const handleAddExtraCost = (projectId: string) => {
    const amt = parseFloat(newExtraCostAmount);
    if (!newExtraCostDesc.trim() || isNaN(amt)) return;
    setProjects(
      projects.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            extraCosts: [
              ...p.extraCosts,
              { desc: newExtraCostDesc, amount: amt, date: new Date().toISOString().split("T")[0] },
            ],
          };
        }
        return p;
      })
    );
    setNewExtraCostDesc("");
    setNewExtraCostAmount("");
  };

  const handleAddMaterial = (projectId: string) => {
    const costNum = parseFloat(newMaterialCost);
    if (!newMaterialDesc.trim() || isNaN(costNum)) return;
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          materials: [
            ...(p.materials || []),
            { desc: newMaterialDesc, cost: costNum, supplier: newMaterialSupplier || "Generico", date: new Date().toISOString().split("T")[0] }
          ]
        };
      }
      return p;
    }));
    setNewMaterialDesc("");
    setNewMaterialCost("");
    setNewMaterialSupplier("");
  };

  const handleAddDocument = (projectId: string) => {
    if (!newDocName.trim()) return;
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          documents: [
            ...(p.documents || []),
            { name: newDocName, type: newDocType, date: new Date().toISOString().split("T")[0] }
          ]
        };
      }
      return p;
    }));
    setNewDocName("");
  };

  const handleAskAi = (projectId: string, type?: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    setIsAiThinking(true);
    setAiResponse("");

    const laborCost = proj.workers.reduce((acc, w) => acc + w.hours * w.rate, 0);
    const extraCost = proj.extraCosts.reduce((acc, c) => acc + c.amount, 0);
    const materialsCost = (proj.materials || []).reduce((acc, m) => acc + m.cost, 0);
    const totalCost = laborCost + extraCost + materialsCost;
    const margin = proj.budget - totalCost;
    const marginPct = Math.max(0, Math.round((margin / Math.max(1, proj.budget)) * 100));

    setTimeout(() => {
      let resp = "";
      const q = type || aiQuery.toLowerCase();

      if (q.includes("margin") || q.includes("margine") || q.includes("analiz")) {
        resp = `L'analisi finanziaria del cantiere "${proj.name}" mostra un budget totale di €${proj.budget.toLocaleString('it-IT')}.\n` +
               `I costi ad oggi sono suddivisi in:\n` +
               `- Manodopera: €${laborCost.toLocaleString('it-IT')}\n` +
               `- Materiali acquistati: €${materialsCost.toLocaleString('it-IT')}\n` +
               `- Spese extra/imprevisti: €${extraCost.toLocaleString('it-IT')}\n` +
               `Il costo totale è di €${totalCost.toLocaleString('it-IT')}, con un margine residuo stimato di €${margin.toLocaleString('it-IT')} (${marginPct}% del budget).\n\n` +
               `Consiglio: il margine è stabile. Cerca di monitorare gli extra costi nelle fasi finali per mantenere l'utile sopra il 30%.`;
      } else if (q.includes("email") || q.includes("sollecito") || q.includes("letter")) {
        resp = `Ecco una bozza di e-mail pronta per essere inviata al committente:\n\n` +
               `--------------------------------------------------\n` +
               `Oggetto: Stato avanzamento lavori e richiesta acconto - ${proj.name}\n\n` +
               `Gentile Cliente,\n` +
               `Le comunichiamo che le lavorazioni per il cantiere in oggetto stanno procedendo regolarmente.\n` +
               `Siamo pronti ad avviare la prossima fase programmata. Come concordato nelle condizioni di pagamento del preventivo, Le chiediamo di disporre il pagamento del prossimo acconto del 30% (pari a €${(proj.budget * 0.3).toLocaleString('it-IT')}).\n\n` +
               `Rimaniamo a disposizione per qualsiasi chiarimento.\n\n` +
               `Cordiali saluti,\n` +
               `PrevAI Team / Direzione Cantieri\n` +
               `--------------------------------------------------`;
      } else if (q.includes("opera") || q.includes("lavorat") || q.includes("ore") || q.includes("stipend")) {
        resp = `Riepilogo ore e costi manodopera per "${proj.name}":\n` +
               `Costo totale accumulato: €${laborCost.toLocaleString('it-IT')}.\n` +
               `Risorse impegnate:\n` +
               proj.workers.map(w => `- ${w.name} (${w.role}): ${w.hours} ore lavorate a €${w.rate}/ora (Totale dovuto: €${w.hours * w.rate})`).join('\n') +
               `\n\nPuoi registrare ulteriori ore direttamente nella sezione "Gestione Lavoratori".`;
      } else {
        resp = `Ciao! Sono il tuo assistente PrevAI CRM. Ho analizzato i dati in tempo reale del cantiere "${proj.name}".\n\n` +
               `Posso aiutarti a:\n` +
               `- Analizzare la redditività e il margine (scrivi 'analizza margine')\n` +
               `- Generare una mail di richiesta acconto (scrivi 'bozza email acconto')\n` +
               `- Riepilogare le ore lavorate (scrivi 'riepilogo ore')\n\n` +
               `Puoi usare anche i pulsanti rapidi qui sotto!`;
      }

      setAiResponse(resp);
      setIsAiThinking(false);
    }, 1200);
  };

  const handleTriggerInvoice = (projectId: string) => {
    setIsInvoicing(true);
    setTimeout(() => {
      setProjects(
        projects.map((p) => {
          if (p.id === projectId) {
            return {
              ...p,
              invoiceStatus: "draft" as const,
              invoiceNum: `FAT-2026-${Math.floor(100 + Math.random() * 900)}`,
            };
          }
          return p;
        })
      );
      setIsInvoicing(false);
    }, 1500);
  };

  const handleAddPratica = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPraticaTitle.trim()) return;
    setPratiche([
      ...pratiche,
      {
        title: newPraticaTitle,
        status: "In Lavorazione",
        date: new Date().toISOString().split("T")[0],
        prot: newPraticaProt || "PROT-N/D",
      },
    ]);
    setNewPraticaTitle("");
    setNewPraticaProt("");
    setIsAddingPratica(false);
  };

  return (
    <div className="min-h-screen flex bg-gray-50/40 font-sans antialiased text-gray-900">
      
      {/* ── LEFT SIDEBAR (MATCHING PREVAI LAYOUT STYLE) ────────────────────── */}
      <aside className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0 shadow-sm">
        {/* Logo Section */}
        <div className="h-14 flex items-center px-6 border-b border-gray-150 justify-between">
          <Link href="/dashboard" className="flex items-center">
            <Logo />
          </Link>
          <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded uppercase tracking-wider">
            CRM
          </span>
        </div>

        {/* Sidebar Navigation Items - Individual, Clean Spacing */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2.5 pb-2">CRM CORE</p>
            {[
              { id: "dashboard", label: "Dashboard Generale", icon: LayoutDashboard },
              { id: "cantieri", label: "Gestione Cantieri", icon: Briefcase },
              { id: "lavoratori", label: "Gestione Lavoratori", icon: Users },
              { id: "finanze", label: "Gestione Finanze", icon: TrendingUp },
              { id: "costi_extra", label: "Costi Extra", icon: AlertCircle },
              { id: "fornitori", label: "Fornitori", icon: Building2 },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id as any); setSelectedProjectId(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    active
                      ? "text-violet-750 bg-violet-50 font-bold"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-violet-600" : "text-gray-400"}`} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-1 pt-4 border-t border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2.5 pb-2">AMMINISTRAZIONE</p>
            {[
              { id: "fatturazione", label: "Fatturazione Elettronica", icon: Receipt },
              { id: "pratiche", label: "Gestione Pratiche", icon: FolderOpen },
              { id: "analytics", label: "KPI & Analytics", icon: BarChart3 },
              { id: "calendario", label: "Calendario Scadenze", icon: Calendar },
              { id: "impostazioni", label: "Impostazioni API", icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id as any); setSelectedProjectId(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    active
                      ? "text-violet-750 bg-violet-50 font-bold"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-violet-600" : "text-gray-400"}`} />
                  {item.label}
                </button>
              );
            })}
          </div>

        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-gray-100 text-[10px] text-gray-450 font-semibold text-center">
          PrevAI CRM Module v1.2
        </div>
      </aside>

      {/* ── MAIN WORKSPACE CONTENT AREA ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider capitalize">
              {activeSection.replace("_", " ")}
            </h2>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
            <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              API Fatture in Cloud Attiva
            </div>
          </div>
        </header>

        {/* Dynamic Section Contents */}
        <main className="p-8 max-w-5xl mx-auto w-full flex-1">

          {/* 1. SECTION: DASHBOARD */}
          {activeSection === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Entrate Totali", val: `€${entrateTotali.toLocaleString("it-IT")}`, icon: DollarSign, color: "text-blue-600 bg-blue-50" },
                  { label: "Margine Operativo", val: `€${margineNetto.toLocaleString("it-IT")}`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
                  { label: "Costi Collaboratori", val: `€${costiLavoratori.toLocaleString("it-IT")}`, icon: Users, color: "text-amber-600 bg-amber-50" },
                  { label: "Spese Impreviste", val: `€${costiExtraTotali.toLocaleString("it-IT")}`, icon: AlertCircle, color: "text-rose-600 bg-rose-50" },
                ].map((stat, idx) => (
                  <Card key={idx} className="border-gray-150 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                        <h4 className="text-xl font-extrabold text-gray-900 mt-1">{stat.val}</h4>
                      </div>
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                        <stat.icon className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Progress and Deadlines Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-gray-150 shadow-xs">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Avanzamento Lavori</h3>
                    <div className="space-y-4">
                      {projects.map((p) => {
                        const total = p.tasks.length;
                        const done = p.tasks.filter(t => t.completed).length;
                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                        return (
                          <div key={p.id} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-gray-700">
                              <span>{p.name}</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                              <div className="h-full bg-violet-600 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-150 shadow-xs">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Pratiche e CILA Attive</h3>
                    <div className="divide-y divide-gray-150">
                      {pratiche.map((pr, idx) => (
                        <div key={idx} className="flex justify-between py-2.5 first:pt-0 last:pb-0 items-center text-xs">
                          <div>
                            <p className="font-bold text-gray-800">{pr.title}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{pr.prot}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            pr.status === "Approvata" ? "bg-green-50 text-green-700 border border-green-200" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {pr.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 2. SECTION: GESTIONE CANTIERI */}
          {activeSection === "cantieri" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-150 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-gray-800">Elenco Cantieri Operativi</h3>
                  <p className="text-xs text-gray-500">Gestisci lavorazioni, budget e assegnazioni workers</p>
                </div>
                <button
                  onClick={() => setIsAddingProj(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 transition"
                >
                  <Plus className="h-4 w-4" /> Nuovo Cantiere
                </button>
              </div>

              {isAddingProj && (
                <Card className="border-violet-100 bg-violet-50/20">
                  <CardContent className="p-4">
                    <form onSubmit={handleCreateProject} className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Nome Progetto</label>
                        <input
                          type="text"
                          placeholder="es. Rifacimento Facciata Condominio"
                          value={newProjName}
                          onChange={(e) => setNewProjName(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="w-48 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Budget Totale (€)</label>
                        <input
                          type="number"
                          placeholder="50000"
                          value={newProjBudget}
                          onChange={(e) => setNewProjBudget(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-750">
                        Aggiungi
                      </button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.map((p) => {
                  const done = p.tasks.filter(t => t.completed).length;
                  const total = p.tasks.length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const isSelected = selectedProjectId === p.id;
                  
                  return (
                    <Card
                      key={p.id}
                      className={`border-gray-150 hover:shadow-sm transition cursor-pointer ${
                        isSelected ? "ring-2 ring-violet-500" : ""
                      }`}
                      onClick={() => setSelectedProjectId(p.id)}
                    >
                      <CardContent className="p-5 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500">Stato: {p.status}</span>
                          <span className="text-sm font-extrabold text-violet-700">€{p.budget.toLocaleString("it-IT")}</span>
                        </div>
                        <h4 className="font-extrabold text-gray-900 text-sm">{p.name}</h4>
                        <div className="space-y-1 pt-2">
                          <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                            <span>Pratiche</span>
                            <span>{done}/{total} Complete</span>
                          </div>
                          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-150">
                            <div className="h-full bg-violet-600" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Detail view overlay/card */}
              {activeProject && (
                <Card className="border-gray-200 shadow-sm bg-white mt-6">
                  <CardContent className="p-6 space-y-6">
                    <div className="border-b border-gray-100 pb-4 flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-gray-900 text-base">{activeProject.name}</h3>
                        <p className="text-xs text-gray-450 mt-1">Budget allocato: €{activeProject.budget.toLocaleString("it-IT")}</p>
                      </div>
                      <button onClick={() => setSelectedProjectId(null)} className="text-xs text-red-500 font-bold hover:underline">
                        Chiudi scheda
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Sub-tasks */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Pratiche Cantiere</h4>
                        <div className="space-y-2">
                          {activeProject.tasks.map(t => (
                            <div
                              key={t.id}
                              onClick={() => handleToggleTask(activeProject.id, t.id)}
                              className="flex items-center gap-2.5 p-2.5 bg-gray-55/40 hover:bg-gray-50 rounded-lg border border-gray-200 cursor-pointer text-xs"
                            >
                              <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center ${
                                t.completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
                              }`}>
                                {t.completed && <Check className="h-3 w-3" />}
                              </div>
                              <span className={t.completed ? "line-through text-gray-400" : "font-semibold text-gray-700"}>{t.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Workers */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Operai Assegnati</h4>
                        <div className="space-y-2.5">
                          {activeProject.workers.map((w, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                              <div>
                                <p className="font-bold text-gray-800">{w.name}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{w.role}</p>
                              </div>
                              <span className="font-mono font-bold text-gray-600">{w.hours} h a €{w.rate}/h</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Materiali & Documenti Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
                      {/* Documenti Tecnici Upload */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Documenti e Computo Metrico</h4>
                        <div className="space-y-2">
                          {(activeProject.documents || []).map((doc, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                              <div>
                                <p className="font-bold text-gray-800">{doc.name}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Tipo: {doc.type} | Data: {doc.date}</p>
                              </div>
                              <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">PDF</span>
                            </div>
                          ))}
                        </div>

                        {/* Upload Doc Form */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Nome doc (es. Computo Metrico)"
                            value={newDocName}
                            onChange={(e) => setNewDocName(e.target.value)}
                            className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <select
                            value={newDocType}
                            onChange={(e) => setNewDocType(e.target.value as any)}
                            className="bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          >
                            <option value="computo">Computo</option>
                            <option value="geometra">Geometra</option>
                            <option value="collaboratore">P. Esterno</option>
                            <option value="altro">Altro</option>
                          </select>
                          <button
                            onClick={() => handleAddDocument(activeProject.id)}
                            className="px-3 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750"
                          >
                            Carica
                          </button>
                        </div>
                      </div>

                      {/* Registro Materiali Comprati */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Materiali Acquistati</h4>
                        <div className="space-y-2">
                          {(activeProject.materials || []).map((mat, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                              <div>
                                <p className="font-bold text-gray-800">{mat.desc}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Fornitore: {mat.supplier} | Data: {mat.date}</p>
                              </div>
                              <span className="font-bold text-rose-600">€{mat.cost.toLocaleString("it-IT")}</span>
                            </div>
                          ))}
                        </div>

                        {/* Add Material Form */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Materiale (es. Cemento, Tubi)"
                            value={newMaterialDesc}
                            onChange={(e) => setNewMaterialDesc(e.target.value)}
                            className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <input
                            type="number"
                            placeholder="Costo €"
                            value={newMaterialCost}
                            onChange={(e) => setNewMaterialCost(e.target.value)}
                            className="w-16 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <input
                            type="text"
                            placeholder="Fornitore"
                            value={newMaterialSupplier}
                            onChange={(e) => setNewMaterialSupplier(e.target.value)}
                            className="w-20 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <button
                            onClick={() => handleAddMaterial(activeProject.id)}
                            className="px-3 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* AI Project Assistant Widget */}
                    <div className="pt-6 border-t border-gray-100 space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="p-1 bg-violet-100 rounded-md">
                          <Sparkles className="h-4 w-4 text-violet-600 animate-pulse" />
                        </span>
                        <h4 className="text-xs font-black text-violet-700 uppercase tracking-widest">
                          Assistente Progetto PrevAI (AI)
                        </h4>
                      </div>

                      <div className="bg-violet-50/30 border border-violet-100 rounded-xl p-4 space-y-3">
                        {aiResponse ? (
                          <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-800 font-medium whitespace-pre-line shadow-xs">
                            {aiResponse}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-505">
                            Chiedimi di analizzare il margine, riepilogare le ore o redigere una mail per questo cantiere.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleAskAi(activeProject.id, "margin")}
                            disabled={isAiThinking}
                            className="px-2.5 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-xs"
                          >
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                            Analizza Margine
                          </button>
                          <button
                            onClick={() => handleAskAi(activeProject.id, "email")}
                            disabled={isAiThinking}
                            className="px-2.5 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-xs"
                          >
                            <Mail className="h-3 w-3 text-blue-500" />
                            Bozza Email Acconto
                          </button>
                          <button
                            onClick={() => handleAskAi(activeProject.id, "opera")}
                            disabled={isAiThinking}
                            className="px-2.5 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-xs"
                          >
                            <Users className="h-3 w-3 text-amber-500" />
                            Riepilogo Ore Lavorate
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Chiedi qualcosa all'AI su questo cantiere..."
                            value={aiQuery}
                            onChange={(e) => setAiQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAskAi(activeProject.id)}
                            className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <button
                            onClick={() => handleAskAi(activeProject.id)}
                            disabled={isAiThinking}
                            className="px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center min-w-[70px]"
                          >
                            {isAiThinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Chiedi"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 3. SECTION: GESTIONE LAVORATORI */}
          {activeSection === "lavoratori" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-150 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-gray-800">Collaboratori e Ore</h3>
                  <p className="text-xs text-slate-500">Gestisci i dipendenti dell'azienda e calcola le paghe mensili</p>
                </div>
                <button
                  onClick={() => setIsAddingCollab(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 transition"
                >
                  <UserPlus className="h-4 w-4" /> Aggiungi Collaboratore
                </button>
              </div>

              {isAddingCollab && (
                <Card className="border-violet-100 bg-violet-50/20">
                  <CardContent className="p-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newCollabName.trim()) return;
                        setCollaborators([
                          ...collaborators,
                          {
                            name: newCollabName,
                            role: "Dipendente",
                            category: "Dipendente",
                            hourlyRate: parseFloat(newCollabRate) || 20,
                            phone: newCollabPhone,
                          }
                        ]);
                        setNewCollabName("");
                        setNewCollabRate("");
                        setNewCollabPhone("");
                        setIsAddingCollab(false);
                      }}
                      className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Nome e Cognome</label>
                        <input
                          type="text"
                          placeholder="Marco Rossi"
                          value={newCollabName}
                          onChange={(e) => setNewCollabName(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Tariffa (€/ora)</label>
                        <input
                          type="number"
                          placeholder="25"
                          value={newCollabRate}
                          onChange={(e) => setNewCollabRate(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Telefono</label>
                        <input
                          type="text"
                          placeholder="+39 333..."
                          value={newCollabPhone}
                          onChange={(e) => setNewCollabPhone(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-750">
                        Salva
                      </button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {collaborators.map((c, idx) => {
                  const hours = projects.reduce((acc, p) => acc + (p.workers.find(w => w.name === c.name)?.hours || 0), 0);
                  return (
                    <Card key={idx} className="border-gray-150 shadow-xs">
                      <CardContent className="p-5 space-y-4">
                        <div>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{c.role}</span>
                          <h4 className="font-extrabold text-gray-900 text-sm mt-1">{c.name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{c.phone}</p>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-xs">
                          <div>
                            <p className="text-gray-400">Tariffa</p>
                            <p className="font-extrabold text-gray-700 mt-0.5">€{c.hourlyRate}/h</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-400">Ore totali</p>
                            <p className="font-extrabold text-violet-700 mt-0.5">{hours} h</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. SECTION: GESTIONE FINANZE */}
          {activeSection === "finanze" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-gray-150 bg-gradient-to-tr from-slate-900 to-slate-800 text-white shadow-sm">
                  <CardContent className="p-5 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entrate Certificate</p>
                    <h3 className="text-2xl font-black">€{entrateTotali.toLocaleString("it-IT")}</h3>
                    <p className="text-[10px] text-slate-450">Commesse sbloccate o in corso</p>
                  </CardContent>
                </Card>

                <Card className="border-gray-150 shadow-xs bg-white">
                  <CardContent className="p-5 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Margine di Cassa</p>
                    <h3 className="text-2xl font-black text-emerald-600">€{margineNetto.toLocaleString("it-IT")}</h3>
                    <p className="text-[10px] text-gray-500">Utile lordo stimato</p>
                  </CardContent>
                </Card>

                <Card className="border-gray-150 shadow-xs bg-white">
                  <CardContent className="p-5 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Totale Costi Commesse</p>
                    <h3 className="text-2xl font-black text-rose-600">€{(costiLavoratori + costiExtraTotali).toLocaleString("it-IT")}</h3>
                    <p className="text-[10px] text-gray-500">Paghe operaie e costi extra</p>
                  </CardContent>
                </Card>
              </div>

              {/* Cashflow bar representation */}
              <Card className="border-gray-150 shadow-xs bg-white">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Flussi Finanziari Commesse</h3>
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-600">Margine Operativo ({Math.round((margineNetto / Math.max(1, entrateTotali)) * 100)}%)</span>
                      <span className="font-bold text-emerald-600">€{margineNetto.toLocaleString("it-IT")}</span>
                    </div>
                    <div className="h-3 w-full bg-rose-100 rounded-full overflow-hidden border border-rose-200 flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, (margineNetto / Math.max(1, entrateTotali)) * 100)}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 5. SECTION: COSTI EXTRA */}
          {activeSection === "costi_extra" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-150 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-gray-800">Storico Costi Extra Cantieri</h3>
                  <p className="text-xs text-gray-500">Visualizza tutte le spese impreviste sostenute al di fuori del preventivo iniziale</p>
                </div>
                <span className="text-xs font-extrabold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
                  Speso Extra: €{costiExtraTotali.toLocaleString("it-IT")}
                </span>
              </div>

              <div className="space-y-3">
                {projects.map(p => 
                  p.extraCosts.map((c, idx) => (
                    <Card key={`${p.id}-${idx}`} className="border-gray-150 shadow-xs">
                      <CardContent className="p-4 flex justify-between items-center text-xs font-semibold">
                        <div>
                          <p className="text-gray-900 font-bold">{c.desc}</p>
                          <p className="text-[10px] text-gray-450 mt-1">Cantiere: {p.name} | Data: {c.date}</p>
                        </div>
                        <span className="font-bold text-rose-600">- €{c.amount.toLocaleString("it-IT")}</span>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 6. SECTION: FORNITORI */}
          {activeSection === "fornitori" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-150 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-gray-800">Rubrica Fornitori Partner</h3>
                  <p className="text-xs text-gray-500">Fornitori di fiducia per materiali edili, noleggio e tecnologia</p>
                </div>
                <button
                  onClick={() => setIsAddingSupplier(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 transition"
                >
                  <Building2 className="h-4 w-4" /> Nuovo Fornitore
                </button>
              </div>

              {isAddingSupplier && (
                <Card className="border-violet-100 bg-violet-50/20">
                  <CardContent className="p-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newSupplierName.trim()) return;
                        setSuppliers([
                          ...suppliers,
                          {
                            name: newSupplierName,
                            category: newSupplierCat,
                            contactInfo: newSupplierContact,
                            phone: "",
                          }
                        ]);
                        setNewSupplierName("");
                        setNewSupplierContact("");
                        setIsAddingSupplier(false);
                      }}
                      className="flex flex-col sm:flex-row gap-4 items-end"
                    >
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Ragione Sociale</label>
                        <input
                          type="text"
                          placeholder="es. Ferramenta Rossi S.a.s."
                          value={newSupplierName}
                          onChange={(e) => setNewSupplierName(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="w-64 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Contatto Info</label>
                        <input
                          type="text"
                          placeholder="E-mail o indirizzo..."
                          value={newSupplierContact}
                          onChange={(e) => setNewSupplierContact(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-750">
                        Aggiungi
                      </button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {suppliers.map((s, idx) => (
                  <Card key={idx} className="border-gray-150 shadow-xs">
                    <CardContent className="p-5 flex gap-3">
                      <div className="h-9 w-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                        <Building2 className="h-4.5 w-4.5 text-gray-500" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-gray-900 text-sm">{s.name}</h4>
                        <span className="inline-block text-[9px] font-bold text-violet-700 bg-violet-55/50 border border-violet-100 px-2 py-0.5 rounded-full mt-1.5 uppercase">
                          {s.category}
                        </span>
                        <p className="text-xs text-gray-500 mt-2">{s.contactInfo}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 7. SECTION: FATTURAZIONE (Fatture in Cloud API Sync) */}
          {activeSection === "fatturazione" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white border border-gray-150 p-6 rounded-xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-gray-800 text-base">Integrazione API Fatture in Cloud</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Le fatture verranno inviate in bozza al tuo portale SDI</p>
                  </div>
                  <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 text-xs font-bold rounded-full">
                    Connesso
                  </span>
                </div>

                {/* API Status panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Chiave API (UID)</label>
                    <input
                      type="text"
                      disabled
                      value={apiKey}
                      className="w-full bg-gray-50 border border-gray-150 rounded-lg p-2 text-xs font-mono text-gray-550"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Secret Token</label>
                    <input
                      type="password"
                      disabled
                      value={apiSecret}
                      className="w-full bg-gray-50 border border-gray-150 rounded-lg p-2 text-xs font-mono text-gray-550"
                    />
                  </div>
                </div>
              </div>

              {/* Invoices created list */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Storico Documenti Emessi</h3>
                {projects.filter(p => p.invoiceStatus !== "not_invoiced").map((p, idx) => (
                  <Card key={idx} className="border-gray-150 shadow-xs">
                    <CardContent className="p-4 flex justify-between items-center text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 text-[9px] font-black rounded uppercase">BOZZA</span>
                          <span className="font-extrabold text-gray-800">{p.invoiceNum}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Cantiere: {p.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">€{p.budget.toLocaleString("it-IT")}</span>
                        <a
                          href="https://mock.fattureincloud.it/documenti/fatture"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 8. SECTION: GESTIONE PRATICHE */}
          {activeSection === "pratiche" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-150 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-gray-800">Pratiche Edilizie (CILA, SCIA, APE)</h3>
                  <p className="text-xs text-gray-500">Archivio e scadenze dei permessi comunali</p>
                </div>
                <button
                  onClick={() => setIsAddingPratica(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750 transition"
                >
                  <Plus className="h-4 w-4" /> Nuova Pratica
                </button>
              </div>

              {isAddingPratica && (
                <Card className="border-violet-100 bg-violet-50/20">
                  <CardContent className="p-4">
                    <form onSubmit={handleAddPratica} className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Titolo Pratica / Immobile</label>
                        <input
                          type="text"
                          placeholder="es. CILA - Via Manzoni 12"
                          value={newPraticaTitle}
                          onChange={(e) => setNewPraticaTitle(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="w-56 space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase">Protocollo Comune</label>
                        <input
                          type="text"
                          placeholder="PROT-2026/..."
                          value={newPraticaProt}
                          onChange={(e) => setNewPraticaProt(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-750">
                        Aggiungi
                      </button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {pratiche.map((p, idx) => (
                  <Card key={idx} className="border-gray-150 shadow-xs">
                    <CardContent className="p-4 flex justify-between items-center text-xs font-semibold">
                      <div>
                        <p className="text-gray-900 font-bold">{p.title}</p>
                        <p className="text-[10px] text-gray-450 mt-1">Prot: {p.prot} | Data: {p.date}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        p.status === "Approvata" ? "bg-green-50 text-green-700 border border-green-200" :
                        "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {p.status}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 9. SECTION: ANALYTICS & KPI */}
          {activeSection === "analytics" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card className="border-gray-150 shadow-xs">
                <CardContent className="p-6 space-y-6">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Marginalità dei Cantieri</h3>
                  
                  <div className="space-y-4">
                    {projects.map(p => {
                      const cost = p.workers.reduce((acc, w) => acc + w.hours * w.rate, 0) + p.extraCosts.reduce((acc, c) => acc + c.amount, 0);
                      const margin = p.budget - cost;
                      const pct = Math.max(0, Math.round((margin / Math.max(1, p.budget)) * 100));
                      
                      return (
                        <div key={p.id} className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-800">{p.name}</span>
                            <span className="font-bold text-emerald-600">{pct}% Margine (Utile: €{margin.toLocaleString("it-IT")})</span>
                          </div>
                          <div className="h-3 w-full bg-gray-100 rounded-full border border-gray-150 overflow-hidden flex">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 10. SECTION: CALENDARIO SCADENZE */}
          {activeSection === "calendario" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card className="border-gray-150 shadow-xs">
                <CardContent className="p-6">
                  <h3 className="text-sm font-bold text-gray-850 uppercase tracking-wider mb-5">Scadenze Cronologiche</h3>
                  <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-6">
                    {[
                      { date: "02 Luglio 2026", type: "Pratica", title: "Approvazione CILA - Villa Roma" },
                      { date: "05 Luglio 2026", type: "Cantiere", title: "Posa del massetto autolivellante - Cantiere Via Roma" },
                      { date: "10 Luglio 2026", type: "Fattura", title: "Acconto 30% - Condominio Aurora" },
                      { date: "15 Luglio 2026", type: "Tasse", title: "F24 Ritenute d'acconto dipendenti" },
                    ].map((item, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[30px] top-1.5 h-3 w-3 rounded-full border-2 border-violet-500 bg-white" />
                        <div className="flex justify-between items-start bg-gray-50/50 p-4 rounded-xl border border-gray-150 hover:border-gray-200 transition">
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 block">{item.date}</span>
                            <h4 className="text-xs font-bold text-gray-800 mt-1">{item.title}</h4>
                          </div>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">{item.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 11. SECTION: IMPOSTAZIONI API */}
          {activeSection === "impostazioni" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card className="border-gray-150 shadow-xs bg-white">
                <CardContent className="p-6 space-y-5">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Chiavi API Fatture in Cloud</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Configura le chiavi di integrazione ufficiale per la trasmissione dei documenti</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-650 uppercase">UID API KEY</label>
                      <input
                        type="text"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-650 uppercase">SECRET TOKEN</label>
                      <input
                        type="text"
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <button className="px-4 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-750 transition shadow-sm">
                      Salva Configurazione
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </main>
      </div>

    </div>
  );
}
