import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Briefcase,
  Calendar,
  Users,
  TrendingUp,
  Plus,
  CheckCircle2,
  DollarSign,
  Clock,
  ArrowUpRight,
  Building2,
  ExternalLink,
  FileText,
  AlertCircle,
  Trash2,
  Loader2,
  UserPlus,
  TrendingDown,
  Hammer,
  ChevronRight,
  Layers,
  FileCheck,
  Check,
  Settings,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Info
} from "lucide-react";

// Types
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
  invoiceUrl?: string;
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
      { id: "t3", title: "Finitura intonaci e tinteggiatura", dueDate: "2026-07-20", completed: false },
      { id: "t3b", title: "Collaudo impianti tecnologici", dueDate: "2026-08-10", completed: false }
    ],
    workers: [
      { name: "Marco Bianchi", role: "Capocantiere / Muratore", hours: 140, rate: 25 },
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
    invoiceUrl: "https://mock.fattureincloud.it/documenti/fatture/104"
  },
];

const INITIAL_COLLABORATORS = [
  { name: "Marco Bianchi", role: "Dipendente", category: "Muratore/Capocantiere", hourlyRate: 25, phone: "+39 333 445566", email: "m.bianchi@prevai.it" },
  { name: "Alessandro Neri", role: "Collaboratore Esterno", category: "Elettricista", hourlyRate: 30, phone: "+39 347 112233", email: "a.neri@gmail.com" },
  { name: "Roberto Verdi", role: "Collaboratore Esterno", category: "Idraulico", hourlyRate: 30, phone: "+39 349 998877", email: "r.verdi@idro.it" },
  { name: "Luca Rossi", role: "Dipendente", category: "Cartongessista/Pintore", hourlyRate: 22, phone: "+39 328 554433", email: "l.rossi@prevai.it" },
];

const INITIAL_SUPPLIERS = [
  { name: "Edilizia Moderna Spa", category: "Materiali Edili", contactInfo: "Milano - Via Dante 25", email: "ordini@edilizia.it", phone: "02 88776655" },
  { name: "TermoIdraulica Srl", category: "Impiantistica e Tubature", contactInfo: "Torino - Corso Francia 104", email: "info@termo.it", phone: "011 4433221" },
  { name: "ElettroForniture Nord", category: "Materiale Elettrico", contactInfo: "Bergamo - Via Roma 2", email: "sales@elettronord.it", phone: "035 998877" },
];

export default function CrmPage() {
  const [activeTab, setActiveTab] = useState<"panoramica" | "cantieri" | "collaboratori" | "finanze" | "fornitori">("panoramica");
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [collaborators, setCollaborators] = useState(INITIAL_COLLABORATORS);
  const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS);
  
  // Selected item detail panels
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // Modal / Add Form toggles
  const [isAddingProj, setIsAddingProj] = useState(false);
  const [isAddingCollab, setIsAddingCollab] = useState(false);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);

  // Form states
  const [newProjName, setNewProjName] = useState("");
  const [newProjBudget, setNewProjBudget] = useState("");
  
  const [newCollabName, setNewCollabName] = useState("");
  const [newCollabRole, setNewCollabRole] = useState("Dipendente");
  const [newCollabRate, setNewCollabRate] = useState("");
  const [newCollabPhone, setNewCollabPhone] = useState("");

  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCat, setNewSupplierCat] = useState("Materiali Edili");
  const [newSupplierContact, setNewSupplierContact] = useState("");

  // Sub-forms inside project hub
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newExtraCostDesc, setNewExtraCostDesc] = useState("");
  const [newExtraCostAmount, setNewExtraCostAmount] = useState("");
  const [isInvoicing, setIsInvoicing] = useState(false);

  // Financial aggregates
  const budgetTotale = projects.reduce((acc, p) => acc + p.budget, 0);
  const costiLavoratori = projects.reduce(
    (acc, p) => acc + p.workers.reduce((wAcc, w) => wAcc + w.hours * w.rate, 0),
    0
  );
  const costiExtraTotali = projects.reduce(
    (acc, p) => acc + p.extraCosts.reduce((eAcc, e) => eAcc + e.amount, 0),
    0
  );
  const entrateCommesse = projects.filter(p => p.status === "completed" || p.status === "active").reduce((acc, p) => acc + p.budget, 0);
  const margineNetto = entrateCommesse - costiLavoratori - costiExtraTotali;

  // Selected project resolver
  const activeProject = projects.find(p => p.id === selectedProjectId);

  // Add project handler
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
      workers: [
        { name: "Marco Bianchi", role: "Capocantiere", hours: 0, rate: 25 },
      ],
      extraCosts: [],
      invoiceStatus: "not_invoiced",
    };
    setProjects([newProj, ...projects]);
    setNewProjName("");
    setNewProjBudget("");
    setIsAddingProj(false);
  };

  // Add Task handler
  const handleAddTask = (projectId: string) => {
    if (!newTaskTitle.trim()) return;
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          tasks: [
            ...p.tasks,
            {
              id: "t_" + Date.now(),
              title: newTaskTitle,
              dueDate: newTaskDueDate || new Date().toISOString().split("T")[0],
              completed: false,
            }
          ]
        };
      }
      return p;
    });
    setProjects(updated);
    setNewTaskTitle("");
    setNewTaskDueDate("");
  };

  // Toggle Task handler
  const handleToggleTask = (projectId: string, taskId: string) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          tasks: p.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
        };
      }
      return p;
    }));
  };

  // Add Extra Cost handler
  const handleAddExtraCost = (projectId: string) => {
    const amountNum = parseFloat(newExtraCostAmount);
    if (!newExtraCostDesc.trim() || isNaN(amountNum)) return;
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          extraCosts: [
            ...p.extraCosts,
            { desc: newExtraCostDesc, amount: amountNum, date: new Date().toISOString().split("T")[0] }
          ]
        };
      }
      return p;
    }));
    setNewExtraCostDesc("");
    setNewExtraCostAmount("");
  };

  // Fatture in Cloud API Mock triggers
  const handleTriggerInvoice = (projectId: string) => {
    setIsInvoicing(true);
    setTimeout(() => {
      setProjects(projects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            invoiceStatus: "draft" as const,
            invoiceNum: `FAT-2026-${Math.floor(100 + Math.random() * 900)}`,
            invoiceUrl: `https://mock.fattureincloud.it/documenti/fatture`
          };
        }
        return p;
      }));
      setIsInvoicing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 animate-in fade-in duration-500">
      
      {/* ── IMMERSIVE WORKSPACE CONTROL TOP HEADER ──────────────────────────── */}
      <div className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Hammer className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-violet-400 uppercase bg-violet-950/50 px-2 py-0.5 rounded border border-violet-800/40">
                PRO MODULE
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-400 font-medium">Sincronizzato</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mt-0.5">Control Panel CRM</h1>
          </div>
        </div>

        {/* Integration Hub Widget */}
        <div className="hidden lg:flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-slate-400 font-semibold">Fatture in Cloud:</span>
            <span className="text-slate-200">API Connessa</span>
          </div>
          <button className="text-violet-400 hover:text-white transition flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin-hover" />
            Sincronizza
          </button>
        </div>
      </div>

      {/* ── CRM DOCK NAVIGATION BAR ────────────────────────────────────────── */}
      <div className="bg-slate-950/40 px-8 py-3.5 border-b border-slate-800/60 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          {[
            { id: "panoramica", label: "Dashboard", icon: Layers },
            { id: "cantieri", label: "Gestione Cantieri", icon: Briefcase },
            { id: "collaboratori", label: "Collaboratori & Ore", icon: Users },
            { id: "finanze", label: "Finanze & Scadenze", icon: TrendingUp },
            { id: "fornitori", label: "Rubrica Fornitori", icon: Building2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSelectedProjectId(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  active
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/10"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Global CRM Quick Stats */}
        <div className="flex gap-4 text-xs">
          <div className="text-slate-400">
            Margine Medio: <span className="font-bold text-emerald-400">€{(margineNetto / Math.max(1, projects.length)).toLocaleString("it-IT", { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {/* ── IMMERSIVE GRID LAYOUT ───────────────────────────────────────────── */}
      <div className="p-8">
        
        {/* ── TAB 0: DASHBOARD PANORAMICA GENERALE ───────────────────────────── */}
        {activeTab === "panoramica" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Stat Cards - Immersive Glassmorphism */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: "Entrate Commesse", val: `€${entrateCommesse.toLocaleString("it-IT")}`, desc: "Cantieri in corso e conclusi", color: "from-blue-600 to-cyan-500", glow: "shadow-cyan-500/10" },
                { title: "Margine Netto Stimato", val: `€${margineNetto.toLocaleString("it-IT")}`, desc: "Calcolato al netto dei costi", color: "from-emerald-600 to-teal-500", glow: "shadow-emerald-500/10" },
                { title: "Costi Manodopera", val: `€${costiLavoratori.toLocaleString("it-IT")}`, desc: "Ore accumulate dipendenti", color: "from-amber-600 to-orange-500", glow: "shadow-amber-500/10" },
                { title: "Imprevisti & Extra", val: `€${costiExtraTotali.toLocaleString("it-IT")}`, desc: "Costi fuori preventivo", color: "from-rose-600 to-red-500", glow: "shadow-rose-500/10" },
              ].map((card, idx) => (
                <div key={idx} className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 p-6 shadow-xl ${card.glow} hover:border-slate-700 transition duration-300`}>
                  <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-violet-600 to-cyan-500" />
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">{card.title}</p>
                  <h3 className="text-3xl font-black text-white mt-2 tracking-tight">{card.val}</h3>
                  <p className="text-xs text-slate-400 mt-2">{card.desc}</p>
                </div>
              ))}
            </div>

            {/* Main Interactive Workspace Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Box 1: Cantieri in Corso (Progress Ring / Bars) */}
              <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">Avanzamento Progetti</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Stato di completamento delle lavorazioni interne</p>
                  </div>
                  <Briefcase className="h-5 w-5 text-slate-500" />
                </div>

                <div className="space-y-6">
                  {projects.map((p) => {
                    const totalTasks = p.tasks.length;
                    const doneTasks = p.tasks.filter(t => t.completed).length;
                    const percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                    
                    return (
                      <div key={p.id} className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-200">{p.name}</span>
                          <span className="font-mono text-slate-400 font-bold">{percent}% ({doneTasks}/{totalTasks})</span>
                        </div>
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-violet-600 to-cyan-500 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Box 2: Scadenze critiche e Pratiche */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-wider">Pratiche urgenti</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Scadenze amministrative e fiscali</p>
                    </div>
                    <Calendar className="h-5 w-5 text-violet-500" />
                  </div>

                  <div className="space-y-3">
                    {[
                      { title: "Approvazione Pratica CILA", date: "02 Lug", urgent: false },
                      { title: "Acconto 30% - Condominio Aurora", date: "10 Lug", urgent: true },
                      { title: "F24 Ritenute d'acconto", date: "15 Lug", urgent: true },
                      { title: "Saldo materiali Edilizia Moderna", date: "20 Lug", urgent: false }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-850">
                        <div className="flex items-center gap-2.5">
                          <span className={`h-2 w-2 rounded-full ${item.urgent ? "bg-rose-500 animate-ping" : "bg-blue-500"}`} />
                          <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {item.date}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab("finanze")}
                  className="w-full mt-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-slate-800"
                >
                  Vedi Scadenziario Completo
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ── TAB 1: CANTIERI (CON BANNELLI DI DETTAGLIO) ─────────────────────── */}
        {activeTab === "cantieri" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in duration-300">
            
            {/* Colonna di sinistra: Lista dei Cantieri e Schede */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <h3 className="font-extrabold text-white">Commesse e Cantieri</h3>
                  <p className="text-xs text-slate-500">Seleziona un cantiere per accedere al pannello operativo</p>
                </div>
                <button
                  onClick={() => setIsAddingProj(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold transition shadow-lg hover:shadow-violet-600/10"
                >
                  <Plus className="h-4 w-4" />
                  Nuovo Progetto
                </button>
              </div>

              {/* Add form */}
              {isAddingProj && (
                <Card className="bg-slate-950 border-slate-800 text-slate-100">
                  <CardContent className="p-5">
                    <form onSubmit={handleCreateProject} className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome Cantiere / Progetto</label>
                        <input
                          type="text"
                          placeholder="es. Ristrutturazione Villa Bifamiliare - Cantiere Via Roma"
                          value={newProjName}
                          onChange={(e) => setNewProjName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="w-full sm:w-48 space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Budget Totale (€)</label>
                        <input
                          type="number"
                          placeholder="es. 85000"
                          value={newProjBudget}
                          onChange={(e) => setNewProjBudget(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-750 transition"
                        >
                          Salva
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingProj(false)}
                          className="px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl text-sm font-bold hover:bg-slate-800 transition"
                        >
                          Annulla
                        </button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Grid Cantieri */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.map((p) => {
                  const doneTasks = p.tasks.filter(t => t.completed).length;
                  const totalTasks = p.tasks.length;
                  const percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                  const isSelected = selectedProjectId === p.id;
                  
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProjectId(p.id)}
                      className={`group relative overflow-hidden bg-slate-950 rounded-2xl p-5 border cursor-pointer transition duration-300 ${
                        isSelected
                          ? "border-violet-500 shadow-xl shadow-violet-500/5 bg-slate-950"
                          : "border-slate-800 hover:border-slate-700 bg-slate-950/60"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          p.status === "active" ? "bg-blue-950/40 text-blue-400 border-blue-900/60" :
                          p.status === "completed" ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60" :
                          p.status === "suspended" ? "bg-rose-950/40 text-rose-400 border-rose-900/60" :
                          "bg-slate-900 text-slate-400 border-slate-800"
                        }`}>
                          {p.status === "active" ? "In Corso" : p.status === "completed" ? "Finito" : p.status === "suspended" ? "Sospeso" : "In Attesa"}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-200">€{p.budget.toLocaleString("it-IT")}</span>
                      </div>

                      <h4 className="text-sm font-black text-white mt-4 group-hover:text-violet-400 transition">
                        {p.name}
                      </h4>
                      
                      <div className="mt-6 space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                          <span>Avanzamento</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                          <div
                            className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Colonna di destra: Hub del Progetto (Selezionato) */}
            <div className="lg:col-span-1">
              {activeProject ? (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="border-b border-slate-800 pb-4">
                    <span className="text-[10px] font-extrabold uppercase text-violet-400 tracking-wider">Pannello Operativo</span>
                    <h3 className="text-base font-black text-white mt-1 leading-snug">{activeProject.name}</h3>
                    <p className="text-xs text-slate-500 mt-2">Avviato: {activeProject.startDate}</p>
                  </div>

                  {/* Tasks inside hub */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center justify-between">
                      <span>Pratiche e Scadenze</span>
                      <span className="font-mono text-[10px]">{activeProject.tasks.filter(t => t.completed).length}/{activeProject.tasks.length}</span>
                    </h4>
                    
                    <div className="space-y-2">
                      {activeProject.tasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => handleToggleTask(activeProject.id, t.id)}
                          className="flex items-center justify-between bg-slate-900/60 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 p-3 rounded-xl cursor-pointer transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                              t.completed ? "bg-violet-600 border-violet-500 text-white" : "border-slate-700 bg-slate-950"
                            }`}>
                              {t.completed && <Check className="h-3 w-3" />}
                            </div>
                            <span className={`text-xs font-semibold ${t.completed ? "line-through text-slate-500" : "text-slate-200"}`}>
                              {t.title}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Quick Add Task */}
                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          placeholder="Nuova pratica o lavoro..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        <button
                          onClick={() => handleAddTask(activeProject.id)}
                          className="px-3 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-750"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Extra Costs inside hub */}
                  <div className="space-y-3 pt-4 border-t border-slate-900">
                    <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex justify-between">
                      <span>Imprevisti & Costi Extra</span>
                      <span className="text-rose-400 font-bold">€{activeProject.extraCosts.reduce((acc, c) => acc + c.amount, 0).toLocaleString("it-IT")}</span>
                    </h4>

                    <div className="space-y-2">
                      {activeProject.extraCosts.map((c, idx) => (
                        <div key={idx} className="flex justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-850 text-xs">
                          <span className="font-semibold text-slate-350">{c.desc}</span>
                          <span className="font-bold text-rose-400">- €{c.amount.toLocaleString("it-IT")}</span>
                        </div>
                      ))}

                      {/* Quick Add Extra Cost */}
                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          placeholder="es. Ritiro macerie..."
                          value={newExtraCostDesc}
                          onChange={(e) => setNewExtraCostDesc(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        <input
                          type="number"
                          placeholder="Importo €"
                          value={newExtraCostAmount}
                          onChange={(e) => setNewExtraCostAmount(e.target.value)}
                          className="w-20 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        <button
                          onClick={() => handleAddExtraCost(activeProject.id)}
                          className="px-3 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-750"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Invoicing Integration section inside hub */}
                  <div className="pt-4 border-t border-slate-900 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                      Fatturazione Elettronica
                    </h4>
                    
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850 flex items-center justify-between gap-4">
                      <div>
                        {activeProject.invoiceStatus === "not_invoiced" ? (
                          <>
                            <h5 className="text-xs font-bold text-slate-200">Non Fatturato</h5>
                            <p className="text-[10px] text-slate-500 mt-0.5">Bozza non registrata in contabilità.</p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 bg-blue-950/80 text-blue-400 border border-blue-900/50 text-[8px] font-black rounded uppercase">BOZZA SDI</span>
                              <h5 className="text-xs font-bold text-white">{activeProject.invoiceNum}</h5>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">Pronta per invio SDI.</p>
                          </>
                        )}
                      </div>

                      {activeProject.invoiceStatus === "not_invoiced" ? (
                        <button
                          onClick={() => handleTriggerInvoice(activeProject.id)}
                          disabled={isInvoicing}
                          className="px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold rounded-lg hover:shadow-violet-600/10 transition disabled:opacity-50 flex items-center gap-1"
                        >
                          {isInvoicing ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              ...
                            </>
                          ) : (
                            <>
                              <FileText className="h-3 w-3" />
                              Crea
                            </>
                          )}
                        </button>
                      ) : (
                        <a
                          href={activeProject.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-slate-800 flex items-center gap-1"
                        >
                          Fattura
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-slate-950/40 border-2 border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-500">
                  <Info className="h-7 w-7 text-slate-600 mx-auto mb-3" />
                  <p className="text-xs font-medium">Seleziona un cantiere per accedere al pannello delle lavorazioni.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── TAB 2: COLLABORATORI E STIPENDI ──────────────────────────────────── */}
        {activeTab === "collaboratori" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="font-extrabold text-white">Dipendenti e Artigiani</h3>
                <p className="text-xs text-slate-500">Monitora i compensi in base alle ore cumulate</p>
              </div>
              <button
                onClick={() => setIsAddingCollab(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold transition shadow-lg"
              >
                <UserPlus className="h-4 w-4" />
                Aggiungi Collaboratore
              </button>
            </div>

            {/* Add Collaborator Form */}
            {isAddingCollab && (
              <Card className="bg-slate-950 border-slate-800 text-slate-100">
                <CardContent className="p-5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newCollabName.trim()) return;
                      setCollaborators([
                        ...collaborators,
                        {
                          name: newCollabName,
                          role: newCollabRole,
                          category: "Specializzato",
                          hourlyRate: parseFloat(newCollabRate) || 20,
                          phone: newCollabPhone,
                          email: "",
                        }
                      ]);
                      setNewCollabName("");
                      setNewCollabRate("");
                      setNewCollabPhone("");
                      setIsAddingCollab(false);
                    }}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome e Cognome</label>
                      <input
                        type="text"
                        placeholder="Giovanni Rossi"
                        value={newCollabName}
                        onChange={(e) => setNewCollabName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ruolo</label>
                      <select
                        value={newCollabRole}
                        onChange={(e) => setNewCollabRole(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                      >
                        <option>Dipendente</option>
                        <option>Collaboratore Esterno</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tariffa (€/ora)</label>
                      <input
                        type="number"
                        placeholder="25"
                        value={newCollabRate}
                        onChange={(e) => setNewCollabRate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="w-full px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-750 transition"
                      >
                        Aggiungi
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingCollab(false)}
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl text-sm font-bold hover:bg-slate-800 transition"
                      >
                        Esci
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* List of collaborators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {collaborators.map((c) => {
                const totalHours = projects.reduce(
                  (acc, p) => acc + (p.workers.find(w => w.name === c.name)?.hours || 0),
                  0
                );
                const totalPayout = totalHours * c.hourlyRate;
                
                return (
                  <div key={c.name} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">{c.role}</span>
                        <span className="font-mono text-xs font-bold text-slate-350">€{c.hourlyRate}/h</span>
                      </div>
                      <h4 className="text-sm font-black text-white mt-4">{c.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">{c.phone}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-900 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] uppercase text-slate-550 font-bold">Ore cumulate</p>
                        <p className="text-sm font-bold text-white mt-0.5">{totalHours} h</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-slate-550 font-bold">Costo azienda</p>
                        <p className="text-sm font-black text-violet-400 mt-0.5">€{totalPayout.toLocaleString("it-IT")}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 3: FINANZE E TIMELINE DELLE SCADENZE ─────────────────────────── */}
        {activeTab === "finanze" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-950 border-slate-800 text-slate-100">
              <CardContent className="p-6">
                <h3 className="text-base font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-violet-500" />
                  Timeline Scadenziario Fiscale & Commesse
                </h3>

                <div className="relative border-l border-slate-800 pl-6 ml-3 space-y-6">
                  {[
                    { date: "02 Luglio 2026", type: "Pratica", title: "Approvazione CILA - Villa Roma", completed: true },
                    { date: "05 Luglio 2026", type: "Cantiere", title: "Posa del massetto autolivellante - Cantiere Via Roma", completed: false },
                    { date: "10 Luglio 2026", type: "Entrata", title: "Acconto 30% - Condominio Aurora (€12.600)", completed: false },
                    { date: "15 Luglio 2026", type: "Fiscale", title: "Versamento Ritenute d'acconto dipendenti", completed: false },
                    { date: "20 Luglio 2026", type: "Fornitore", title: "Saldo materiali Edilizia Moderna Spa (€4.200)", completed: false },
                  ].map((item, idx) => (
                    <div key={idx} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[30px] top-1.5 h-3 w-3 rounded-full border-2 bg-slate-950 flex items-center justify-center ${
                        item.completed ? "border-emerald-500" : "border-violet-500"
                      }`} />

                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-6 bg-slate-900/40 p-4 rounded-xl border border-slate-850 hover:border-slate-800 transition">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider block">
                            {item.date}
                          </span>
                          <h4 className="text-xs font-bold text-white mt-1">{item.title}</h4>
                        </div>
                        <span className={`self-start px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                          item.type === "Entrata" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40" :
                          item.type === "Fiscale" ? "bg-rose-950/40 text-rose-400 border border-rose-900/40" :
                          "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}>
                          {item.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 4: FORNITORI ────────────────────────────────────────────────── */}
        {activeTab === "fornitori" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="font-extrabold text-white">Anagrafica Fornitori</h3>
                <p className="text-xs text-slate-500">Gestisci i contatti e i partner per gli acquisti di materiali</p>
              </div>
              <button
                onClick={() => setIsAddingSupplier(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold transition shadow-lg"
              >
                <Building2 className="h-4 w-4" />
                Nuovo Fornitore
              </button>
            </div>

            {/* Add Supplier Form */}
            {isAddingSupplier && (
              <Card className="bg-slate-950 border-slate-800 text-slate-100">
                <CardContent className="p-5">
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
                          email: "",
                          phone: "",
                        }
                      ]);
                      setNewSupplierName("");
                      setNewSupplierContact("");
                      setIsAddingSupplier(false);
                    }}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ragione Sociale</label>
                      <input
                        type="text"
                        placeholder="Edilizia Moderna S.r.l."
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Categoria</label>
                      <input
                        type="text"
                        placeholder="Materiali Edili"
                        value={newSupplierCat}
                        onChange={(e) => setNewSupplierCat(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="w-full px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-750 transition"
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingSupplier(false)}
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl text-sm font-bold hover:bg-slate-800 transition"
                      >
                        Esci
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* List of suppliers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {suppliers.map((s, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-start gap-4 hover:border-slate-700 transition">
                  <div className="h-10 w-10 bg-slate-900 border border-slate-800 flex items-center justify-center rounded-xl shrink-0">
                    <Building2 className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-white text-sm">{s.name}</h4>
                    <span className="inline-block text-[9px] font-black tracking-widest text-violet-400 bg-violet-950/40 border border-violet-900/40 px-2.5 py-0.5 rounded-full uppercase">
                      {s.category}
                    </span>
                    <p className="text-xs text-slate-400 pt-3">{s.contactInfo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
