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
  Hammer
} from "lucide-react";

// Mock Data iniziali per simulare l'applicazione reale
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
  extraCosts: { desc: string; amount: number }[];
  invoiceStatus: "not_invoiced" | "draft" | "sent";
  invoiceNum?: string;
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
    ],
    workers: [
      { name: "Marco Bianchi", role: "Capocantiere / Muratore", hours: 140, rate: 25 },
      { name: "Alessandro Neri", role: "Elettricista", hours: 35, rate: 30 },
      { name: "Roberto Verdi", role: "Idraulico", hours: 45, rate: 30 },
    ],
    extraCosts: [
      { desc: "Smaltimento macerie imprevisto", amount: 1200 },
      { desc: "Adeguamento quadro elettrico esterno", amount: 650 },
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
      { desc: "Pannelli extra per spessore pilastri", amount: 480 },
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
  { name: "Edilizia Moderna Spa", category: "Materiali Edili", contactInfo: "Milano - ciao@edilizia.it", email: "ordini@edilizia.it" },
  { name: "TermoIdraulica Srl", category: "Impiantistica e Tubature", contactInfo: "Torino - info@termo.it", email: "info@termo.it" },
  { name: "ElettroForniture Nord", category: "Materiale Elettrico", contactInfo: "Bergamo - sales@elettronord.it", email: "sales@elettronord.it" },
];

export default function CrmPage() {
  const [activeTab, setActiveTab] = useState<"cantieri" | "collaboratori" | "finanze" | "fornitori">("cantieri");
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [collaborators, setCollaborators] = useState(INITIAL_COLLABORATORS);
  const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS);
  
  // Modals / Panels
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Form States
  const [newProjName, setNewProjName] = useState("");
  const [newProjBudget, setNewProjBudget] = useState("");
  const [isAddingProj, setIsAddingProj] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  
  const [newExtraCostDesc, setNewExtraCostDesc] = useState("");
  const [newExtraCostAmount, setNewExtraCostAmount] = useState("");
  
  const [newCollabName, setNewCollabName] = useState("");
  const [newCollabRole, setNewCollabRole] = useState("Dipendente");
  const [newCollabRate, setNewCollabRate] = useState("");
  const [isAddingCollab, setIsAddingCollab] = useState(false);

  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCat, setNewSupplierCat] = useState("Materiali Edili");
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);

  const [isInvoicing, setIsInvoicing] = useState(false);

  // Calcoli finanziari rapidi
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
  const margineTotale = entrateTotali - costiLavoratori - costiExtraTotali;

  // Gestione Cantieri
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

  // Gestione Task in Project Hub
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
    // update current selected project view
    const match = updated.find(p => p.id === projectId);
    if (match) setSelectedProject(match);
    setNewTaskTitle("");
    setNewTaskDueDate("");
  };

  const handleToggleTask = (projectId: string, taskId: string) => {
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          tasks: p.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
        };
      }
      return p;
    });
    setProjects(updated);
    const match = updated.find(p => p.id === projectId);
    if (match) setSelectedProject(match);
  };

  // Gestione Costi Extra in Project Hub
  const handleAddExtraCost = (projectId: string) => {
    const amountNum = parseFloat(newExtraCostAmount);
    if (!newExtraCostDesc.trim() || isNaN(amountNum)) return;
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          extraCosts: [
            ...p.extraCosts,
            { desc: newExtraCostDesc, amount: amountNum }
          ]
        };
      }
      return p;
    });
    setProjects(updated);
    const match = updated.find(p => p.id === projectId);
    if (match) setSelectedProject(match);
    setNewExtraCostDesc("");
    setNewExtraCostAmount("");
  };

  // Integrazione Fatture in Cloud (Simulazione con loader)
  const handleTriggerInvoice = (projectId: string) => {
    setIsInvoicing(true);
    setTimeout(() => {
      const updated = projects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            invoiceStatus: "draft" as const,
            invoiceNum: `FAT-2026-${Math.floor(100 + Math.random() * 900)}`
          };
        }
        return p;
      });
      setProjects(updated);
      const match = updated.find(p => p.id === projectId);
      if (match) setSelectedProject(match);
      setIsInvoicing(false);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Hammer className="h-8 w-8 text-blue-600" />
            CRM & Gestione Cantieri
          </h1>
          <p className="text-slate-500 mt-1">
            Gestisci in modo chiaro commesse, lavoratori, spese e fatturazione per la tua impresa.
          </p>
        </div>

        {/* Tab navigation pill */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
          {[
            { id: "cantieri", label: "Cantieri" },
            { id: "collaboratori", label: "Collaboratori" },
            { id: "finanze", label: "Finanze & Scadenze" },
            { id: "fornitori", label: "Fornitori" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === tab.id
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: CANTIERI E PRATICHE ──────────────────────────────────────── */}
      {activeTab === "cantieri" && (
        <div className="space-y-6">
          {/* Statistiche rapide cantieri */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50/50">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase">Cantieri Attivi</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">
                    {projects.filter(p => p.status === "active").length}
                  </h3>
                </div>
                <div className="h-10 w-10 bg-blue-600/10 flex items-center justify-center rounded-xl">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50/50">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase">Valore Commesse</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">
                    €{budgetTotale.toLocaleString("it-IT")}
                  </h3>
                </div>
                <div className="h-10 w-10 bg-emerald-600/10 flex items-center justify-center rounded-xl">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50 to-orange-50/50">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase">Ore Lavorate Totali</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">
                    {projects.reduce((acc, p) => acc + p.workers.reduce((wAcc, w) => wAcc + w.hours, 0), 0)} ore
                  </h3>
                </div>
                <div className="h-10 w-10 bg-amber-600/10 flex items-center justify-center rounded-xl">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-gradient-to-br from-purple-50 to-fuchsia-50/50">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-purple-600 uppercase">Costi Extra Imprevisti</p>
                  <h3 className="text-2xl font-bold mt-1 text-slate-800">
                    €{costiExtraTotali.toLocaleString("it-IT")}
                  </h3>
                </div>
                <div className="h-10 w-10 bg-purple-600/10 flex items-center justify-center rounded-xl">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Kanban / Lista */}
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-800">Organizzazione Progetti</h3>
            <button
              onClick={() => setIsAddingProj(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nuovo Cantiere
            </button>
          </div>

          {/* Form Aggiunta Cantiere */}
          {isAddingProj && (
            <Card className="border-blue-100 bg-blue-50/20">
              <CardContent className="p-4">
                <form onSubmit={handleCreateProject} className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Nome Cantiere / Progetto</label>
                    <input
                      type="text"
                      placeholder="es. Ristrutturazione Bagno - Cliente Bianchi"
                      value={newProjName}
                      onChange={(e) => setNewProjName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-full sm:w-48 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Budget Totale (€)</label>
                    <input
                      type="number"
                      placeholder="es. 15000"
                      value={newProjBudget}
                      onChange={(e) => setNewProjBudget(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition"
                    >
                      Aggiungi
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingProj(false)}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition"
                    >
                      Annulla
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Colonne Kanban */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {(["planning", "active", "suspended", "completed"] as const).map((status) => {
              const matching = projects.filter(p => p.status === status);
              const statusLabels = {
                planning: { label: "Pianificazione", color: "bg-slate-100 text-slate-800 border-slate-200" },
                active: { label: "In Corso", color: "bg-blue-50 text-blue-700 border-blue-100" },
                suspended: { label: "Sospeso", color: "bg-amber-50 text-amber-700 border-amber-100" },
                completed: { label: "Completato", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
              };
              const style = statusLabels[status];

              return (
                <div key={status} className="bg-slate-50/60 p-4 rounded-xl border border-slate-200/60 flex flex-col min-h-[300px]">
                  <div className="flex justify-between items-center mb-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${style.color}`}>
                      {style.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">{matching.length}</span>
                  </div>
                  
                  <div className="space-y-3 flex-1">
                    {matching.map((p) => {
                      const completedTasks = p.tasks.filter(t => t.completed).length;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProject(p)}
                          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition duration-200 cursor-pointer group"
                        >
                          <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition line-clamp-2">
                            {p.name}
                          </h4>
                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 text-xs">
                            <span className="font-semibold text-slate-700">€{p.budget.toLocaleString("it-IT")}</span>
                            <span className="text-slate-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-slate-300" />
                              {completedTasks}/{p.tasks.length}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PROJECT HUB DETTAGLIO MODALE ────────────────────────────────────── */}
      {selectedProject && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Header Modale */}
            <div className="flex justify-between items-start pb-5 border-b border-slate-200">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Hub Cantiere</span>
                <h2 className="text-xl font-bold text-slate-900">{selectedProject.name}</h2>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Inizio: {selectedProject.startDate}
                  </span>
                  <span>|</span>
                  <span className="font-bold text-slate-800">
                    Budget: €{selectedProject.budget.toLocaleString("it-IT")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                ✕ Close
              </button>
            </div>

            {/* Contenuto Hub */}
            <div className="py-6 space-y-6 flex-1">
              {/* Sezione Pratiche & Scadenze */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                    Pratiche e Scadenze
                  </h3>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                    {selectedProject.tasks.filter(t => t.completed).length}/{selectedProject.tasks.length} Completate
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  {selectedProject.tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggleTask(selectedProject.id, task.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className={`text-sm ${task.completed ? "line-through text-slate-400" : "text-slate-700 font-medium"}`}>
                          {task.title}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{task.dueDate}</span>
                    </div>
                  ))}

                  {/* Add Task Form */}
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="Nuova scadenza o pratica..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleAddTask(selectedProject.id)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                    >
                      Aggiungi
                    </button>
                  </div>
                </div>
              </div>

              {/* Sezione Lavoratori Assegnati */}
              <div className="space-y-3">
                <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                  Lavoratori e Ore
                </h3>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="divide-y divide-slate-100">
                    {selectedProject.workers.map((w, idx) => (
                      <div key={idx} className="flex justify-between py-2 first:pt-0 last:pb-0 items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{w.name}</p>
                          <p className="text-slate-400">{w.role}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-700">{w.hours} ore</p>
                          <p className="text-slate-400">Tariffa: €{w.rate}/h</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sezione Spese Extra */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                    Spese e Costi Extra
                  </h3>
                  <span className="font-bold text-xs text-red-600">
                    Totale: €{selectedProject.extraCosts.reduce((acc, c) => acc + c.amount, 0).toLocaleString("it-IT")}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  {selectedProject.extraCosts.map((cost, idx) => (
                    <div key={idx} className="flex justify-between bg-white p-3 rounded-lg border border-slate-200 text-xs">
                      <span className="font-medium text-slate-700">{cost.desc}</span>
                      <span className="font-bold text-red-600">€{cost.amount.toLocaleString("it-IT")}</span>
                    </div>
                  ))}

                  {/* Add Cost Form */}
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="Descrizione spesa imprevista..."
                      value={newExtraCostDesc}
                      onChange={(e) => setNewExtraCostDesc(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Importo €"
                      value={newExtraCostAmount}
                      onChange={(e) => setNewExtraCostAmount(e.target.value)}
                      className="w-28 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleAddExtraCost(selectedProject.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                    >
                      Aggiungi
                    </button>
                  </div>
                </div>
              </div>

              {/* Sezione Fatture & Integrazione Fatture in Cloud */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                  Fatturazione Elettronica (Fatture in Cloud)
                </h3>
                
                <div className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
                  <div>
                    {selectedProject.invoiceStatus === "not_invoiced" ? (
                      <>
                        <h4 className="text-sm font-bold text-slate-800">Nessuna fattura emessa</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Il cantiere non è ancora stato fatturato su Fatture in Cloud.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">BOZZA</span>
                          <h4 className="text-sm font-bold text-slate-800">{selectedProject.invoiceNum}</h4>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Fattura elettronica creata in bozza. Pronta per la validazione SDI.
                        </p>
                      </>
                    )}
                  </div>

                  {selectedProject.invoiceStatus === "not_invoiced" ? (
                    <button
                      onClick={() => handleTriggerInvoice(selectedProject.id)}
                      disabled={isInvoicing}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition disabled:opacity-50"
                    >
                      {isInvoicing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Generazione in corso...
                        </>
                      ) : (
                        <>
                          <FileText className="h-3.5 w-3.5" />
                          Crea Fattura in Cloud
                        </>
                      )}
                    </button>
                  ) : (
                    <a
                      href="https://mock.fattureincloud.it/documenti/fatture"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition"
                    >
                      Apri su Fatture in Cloud
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: COLLABORATORI E STIPENDI ──────────────────────────────────── */}
      {activeTab === "collaboratori" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-800">Organico e Dipendenti</h3>
            <button
              onClick={() => setIsAddingCollab(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <UserPlus className="h-4 w-4" />
              Nuovo Lavoratore
            </button>
          </div>

          {/* Form Add Collaborator */}
          {isAddingCollab && (
            <Card className="border-blue-100 bg-blue-50/20 animate-in slide-in-from-top duration-200">
              <CardContent className="p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newCollabName.trim()) return;
                    setCollaborators([
                      ...collaborators,
                      {
                        name: newCollabName,
                        role: newCollabRole,
                        category: "Generico",
                        hourlyRate: parseFloat(newCollabRate) || 20,
                        phone: "",
                      }
                    ]);
                    setNewCollabName("");
                    setNewCollabRate("");
                    setIsAddingCollab(false);
                  }}
                  className="flex flex-col sm:flex-row gap-4 items-end"
                >
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Nome e Cognome</label>
                    <input
                      type="text"
                      placeholder="es. Giovanni Russo"
                      value={newCollabName}
                      onChange={(e) => setNewCollabName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-full sm:w-48 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Tipologia</label>
                    <select
                      value={newCollabRole}
                      onChange={(e) => setNewCollabRole(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option>Dipendente</option>
                      <option>Collaboratore Esterno</option>
                    </select>
                  </div>
                  <div className="w-full sm:w-36 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Tariffa Oraria (€/h)</label>
                    <input
                      type="number"
                      placeholder="es. 22"
                      value={newCollabRate}
                      onChange={(e) => setNewCollabRate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition"
                    >
                      Salva
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingCollab(false)}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition"
                    >
                      Annulla
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Griglia Collaboratori */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {collaborators.map((c) => {
              // Somma ore registrate su tutti i cantieri per questo collaboratore
              const totalHours = projects.reduce(
                (acc, p) => acc + (p.workers.find(w => w.name === c.name)?.hours || 0),
                0
              );
              const payout = totalHours * c.hourlyRate;

              return (
                <Card key={c.name} className="border-slate-200 shadow-xs hover:shadow-sm transition">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-slate-800">{c.name}</h4>
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {c.role}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-semibold text-[10px] rounded-lg">
                        €{c.hourlyRate}/h
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center text-xs">
                      <div>
                        <p className="text-slate-400">Ore accumulate</p>
                        <p className="font-bold text-slate-700 mt-0.5">{totalHours} ore</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400">Compenso stimato</p>
                        <p className="font-extrabold text-blue-600 mt-0.5">€{payout.toLocaleString("it-IT")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: FINANZE E SCADENZE ───────────────────────────────────────── */}
      {activeTab === "finanze" && (
        <div className="space-y-6">
          {/* KPI Finanziari */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none bg-gradient-to-tr from-slate-900 to-slate-800 text-white shadow-md">
              <CardContent className="p-6 space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Fatturato Attivo</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-extrabold">€{entrateTotali.toLocaleString("it-IT")}</h3>
                  <span className="text-emerald-400 text-xs font-bold flex items-center gap-0.5">
                    <TrendingUp className="h-3.5 w-3.5" /> +100%
                  </span>
                </div>
                <p className="text-xs text-slate-400">Basato su preventivi approvati e cantieri conclusi.</p>
              </CardContent>
            </Card>

            <Card className="border-none bg-white border border-slate-200 shadow-sm">
              <CardContent className="p-6 space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Uscite Commesse & Manodopera</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-extrabold text-slate-800">
                    €{(costiLavoratori + costiExtraTotali).toLocaleString("it-IT")}
                  </h3>
                  <span className="text-red-500 text-xs font-bold flex items-center gap-0.5">
                    <TrendingDown className="h-3.5 w-3.5" />
                    Extra: €{costiExtraTotali}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Stipendi collaboratori e costi materiali imprevisti.</p>
              </CardContent>
            </Card>

            <Card className="border-none bg-blue-50/50 border border-blue-100 shadow-sm">
              <CardContent className="p-6 space-y-2">
                <p className="text-xs uppercase tracking-wider text-blue-600 font-bold">Margine Operativo</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-extrabold text-blue-800">€{margineTotale.toLocaleString("it-IT")}</h3>
                </div>
                <p className="text-xs text-slate-500">Margine di profitto calcolato sui cantieri attivi.</p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline delle scadenze */}
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <h3 className="text-base font-extrabold text-slate-800 mb-5 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Scadenziario Cronologico Finanziario
              </h3>

              <div className="relative border-l-2 border-slate-100 pl-6 ml-3 space-y-8">
                {[
                  { date: "02 Luglio 2026", type: "Pratica", title: "Approvazione CILA - Via Roma", status: "completed" },
                  { date: "05 Luglio 2026", type: "Cantiere", title: "Posa del massetto - Cantiere Via Roma", status: "pending" },
                  { date: "10 Luglio 2026", type: "Fattura / Entrata", title: "Acconto 30% - Condominio Aurora (€12.600)", status: "pending" },
                  { date: "15 Luglio 2026", type: "Tasse / F24", title: "Versamento Ritenute d'acconto collaboratori", status: "pending" },
                  { date: "20 Luglio 2026", type: "Fornitore / Uscita", title: "Saldo materiali Edilizia Moderna Spa (€4.200)", status: "pending" },
                ].map((item, idx) => (
                  <div key={idx} className="relative">
                    {/* Circle icon on line */}
                    <div className={`absolute -left-[31px] top-0.5 h-4.5 w-4.5 rounded-full border-2 bg-white flex items-center justify-center ${
                      item.status === "completed" ? "border-emerald-500" : "border-blue-500"
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        item.status === "completed" ? "bg-emerald-500" : "bg-blue-500"
                      }`} />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-6">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider block">
                          {item.date}
                        </span>
                        <h4 className="text-sm font-bold text-slate-800 mt-0.5">{item.title}</h4>
                      </div>
                      <span className={`self-start px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.type.includes("Entrata") ? "bg-emerald-50 text-emerald-700" :
                        item.type.includes("Uscita") ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
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
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-800">Rubrica Fornitori & Partner</h3>
            <button
              onClick={() => setIsAddingSupplier(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <Building2 className="h-4 w-4" />
              Nuovo Fornitore
            </button>
          </div>

          {/* Form Add Supplier */}
          {isAddingSupplier && (
            <Card className="border-blue-100 bg-blue-50/20 animate-in slide-in-from-top duration-200">
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
                        contactInfo: "Contatto registrato",
                        email: "",
                      }
                    ]);
                    setNewSupplierName("");
                    setIsAddingSupplier(false);
                  }}
                  className="flex flex-col sm:flex-row gap-4 items-end"
                >
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Ragione Sociale</label>
                    <input
                      type="text"
                      placeholder="es. Ferramenta Rossi S.a.s."
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-full sm:w-64 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Categoria</label>
                    <input
                      type="text"
                      placeholder="es. Materiali Edili, Noleggio ponteggi..."
                      value={newSupplierCat}
                      onChange={(e) => setNewSupplierCat(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition"
                    >
                      Aggiungi
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingSupplier(false)}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition"
                    >
                      Annulla
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Lista Fornitori */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {suppliers.map((s, idx) => (
              <Card key={idx} className="border-slate-200 shadow-xs">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="h-10 w-10 bg-slate-100 flex items-center justify-center rounded-xl shrink-0">
                    <Building2 className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-800">{s.name}</h4>
                    <span className="inline-block text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase">
                      {s.category}
                    </span>
                    <p className="text-xs text-slate-400 pt-2">{s.contactInfo}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
