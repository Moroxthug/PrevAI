import { useState, useCallback } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Loader2,
  GripVertical, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCreateManualQuote, useSuggestItemDescription } from "@workspace/api-client-react";
import type { CreateManualQuoteBody } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const UM_OPTIONS = ["mq", "ml", "mc", "kg", "t", "ore", "g", "a.c.", "pz", "cad.", "kW", "lt"];

const TEMPLATES = [
  { id: "standard", label: "Standard", desc: "Layout classico professionale" },
  { id: "arosio", label: "Arosio", desc: "Intestazione aziendale elegante" },
  { id: "mariagrazia", label: "Mariagrazia", desc: "Stile moderno e pulito" },
] as const;

const DEFAULT_CONDIZIONI = [
  "30% acconto alla firma",
  "30% a SAL intermedio",
  "30% a SAL finale",
  "10% saldo fine lavori",
];

const IVA_OPTIONS = [0, 4, 5, 10, 22];

interface VoceState {
  id: string;
  descrizione: string;
  um: string;
  quantita: string;
  prezzoUnitario: string;
}

interface ChapterState {
  id: string;
  titolo: string;
  osservazione: string;
  voci: VoceState[];
  collapsed: boolean;
}

interface ClientData {
  nome: string;
  indirizzo?: string;
  citta?: string;
  cap?: string;
  provincia?: string;
  codiceFiscale?: string;
  partitaIva?: string;
}

interface ManualQuoteBuilderProps {
  clientData?: ClientData;
  profileData?: {
    companyName?: string;
    vatNumber?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logoUrl?: string | null;
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function mkVoce(): VoceState {
  return { id: uid(), descrizione: "", um: "mq", quantita: "1", prezzoUnitario: "" };
}

function mkChapter(index: number): ChapterState {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return {
    id: uid(),
    titolo: `Capitolo ${letters[index] ?? index + 1}`,
    osservazione: "",
    voci: [mkVoce()],
    collapsed: false,
  };
}

function parseNum(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function fmt(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeVoceTotale(v: VoceState): number {
  return Math.round(parseNum(v.quantita) * parseNum(v.prezzoUnitario) * 100) / 100;
}

function computeCapSubtotale(ch: ChapterState): number {
  return Math.round(ch.voci.reduce((s, v) => s + computeVoceTotale(v), 0) * 100) / 100;
}

function computeTotals(chapters: ChapterState[], iva: number) {
  const subtotale = Math.round(chapters.reduce((s, c) => s + computeCapSubtotale(c), 0) * 100) / 100;
  const ivaValore = Math.round(subtotale * (iva / 100) * 100) / 100;
  const totale = Math.round((subtotale + ivaValore) * 100) / 100;
  return { subtotale, ivaValore, totale };
}

function AISuggestButton({
  voce,
  chapterTitle,
  projectTitle,
  onSuggest,
}: {
  voce: VoceState;
  chapterTitle: string;
  projectTitle: string;
  onSuggest: (desc: string) => void;
}) {
  const suggest = useSuggestItemDescription();
  const { toast } = useToast();

  const handleClick = () => {
    const brief = voce.descrizione.trim() || chapterTitle;
    if (!brief) {
      toast({ title: "Descrivi prima la voce", description: "Scrivi qualcosa nella descrizione per ottenere un suggerimento AI.", variant: "destructive" });
      return;
    }
    suggest.mutate(
      { data: { brief, context: projectTitle || chapterTitle } },
      {
        onSuccess: (r) => onSuggest(r.description),
        onError: () => toast({ title: "Errore AI", description: "Impossibile generare la descrizione al momento.", variant: "destructive" }),
      }
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={suggest.isPending}
      title="Migliora con AI"
      className={cn(
        "shrink-0 h-7 w-7 flex items-center justify-center rounded-lg transition-colors",
        suggest.isPending
          ? "bg-violet-100 text-violet-400 cursor-wait"
          : "text-gray-300 hover:text-violet-500 hover:bg-violet-50"
      )}
    >
      {suggest.isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Sparkles className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function ManualQuoteBuilder({ clientData, profileData }: ManualQuoteBuilderProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createManualQuote = useCreateManualQuote();

  const [templateId, setTemplateId] = useState<"standard" | "arosio" | "mariagrazia">("standard");
  const [titoloRiga1, setTitoloRiga1] = useState("Analisi Economica e Computo Metrico Prezzato");
  const [titoloRiga2, setTitoloRiga2] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [ivaPercentuale, setIvaPercentuale] = useState(22);
  const [condizioni, setCondizioni] = useState<string[]>(DEFAULT_CONDIZIONI);
  const [newCondizione, setNewCondizione] = useState("");
  const [note, setNote] = useState("Preventivo valido 30 giorni");

  const [chapters, setChapters] = useState<ChapterState[]>([mkChapter(0)]);

  const { subtotale, ivaValore, totale } = computeTotals(chapters, ivaPercentuale);

  const updateChapter = useCallback((chId: string, patch: Partial<ChapterState>) => {
    setChapters(prev => prev.map(c => c.id === chId ? { ...c, ...patch } : c));
  }, []);

  const updateVoce = useCallback((chId: string, vId: string, patch: Partial<VoceState>) => {
    setChapters(prev => prev.map(c =>
      c.id === chId
        ? { ...c, voci: c.voci.map(v => v.id === vId ? { ...v, ...patch } : v) }
        : c
    ));
  }, []);

  const addChapter = () => {
    setChapters(prev => [...prev, mkChapter(prev.length)]);
  };

  const removeChapter = (chId: string) => {
    setChapters(prev => prev.filter(c => c.id !== chId));
  };

  const addVoce = (chId: string) => {
    setChapters(prev => prev.map(c =>
      c.id === chId ? { ...c, voci: [...c.voci, mkVoce()] } : c
    ));
  };

  const removeVoce = (chId: string, vId: string) => {
    setChapters(prev => prev.map(c =>
      c.id === chId ? { ...c, voci: c.voci.filter(v => v.id !== vId) } : c
    ));
  };

  const removeCondizione = (idx: number) => {
    setCondizioni(prev => prev.filter((_, i) => i !== idx));
  };

  const addCondizione = () => {
    const t = newCondizione.trim();
    if (!t) return;
    setCondizioni(prev => [...prev, t]);
    setNewCondizione("");
  };

  const handleSubmit = () => {
    if (createManualQuote.isPending) return;

    const hasContent = chapters.some(c => c.voci.some(v => v.descrizione.trim() && parseNum(v.prezzoUnitario) > 0));
    if (!hasContent) {
      toast({
        title: "Aggiungi almeno una voce",
        description: "Compila descrizione e prezzo unitario di almeno una voce per procedere.",
        variant: "destructive",
      });
      return;
    }

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const capitoli = chapters.map((ch, idx) => ({
      lettera: letters[idx] ?? String(idx + 1),
      titolo: ch.titolo || `Capitolo ${letters[idx] ?? idx + 1}`,
      osservazione: ch.osservazione || undefined,
      voci: ch.voci.map(v => ({
        descrizione: v.descrizione,
        um: v.um,
        quantita: parseNum(v.quantita),
        prezzoUnitario: parseNum(v.prezzoUnitario),
        totale: computeVoceTotale(v),
      })),
      subtotale: computeCapSubtotale(ch),
    }));

    const companySnapshot = profileData
      ? {
          companyName: profileData.companyName || "",
          ...(profileData.vatNumber && { vatNumber: profileData.vatNumber }),
          ...(profileData.address && { address: profileData.address }),
          ...(profileData.phone && { phone: profileData.phone }),
          ...(profileData.email && { email: profileData.email }),
          ...(profileData.logoUrl && { logoUrl: profileData.logoUrl }),
        }
      : undefined;

    const body: CreateManualQuoteBody = {
      templateId,
      capitoli,
      clientData: clientData?.nome
        ? { ...clientData, indirizzo: clientData.indirizzo ?? "" }
        : undefined,
      companySnapshot,
      titoloPreventivoRiga1: titoloRiga1 || undefined,
      titoloPreventivoRiga2: titoloRiga2 || undefined,
      descrizioneGenerale: descrizione || undefined,
      ivaPercentuale,
      condizioniPagamento: condizioni,
      note: note || undefined,
    };

    createManualQuote.mutate(
      { data: body },
      {
        onSuccess: (quote) => setLocation(`/dashboard/quotes/${quote.id}`),
        onError: (err: unknown) => {
          const status = (err as { status?: number })?.status;
          if (status === 429) {
            toast({ title: "Quota mensile raggiunta", description: "Hai raggiunto il limite del tuo piano. Passa a Pro per preventivi illimitati.", variant: "destructive" });
          } else {
            toast({ title: "Errore nella creazione", description: "Si è verificato un errore. Riprova tra qualche istante.", variant: "destructive" });
          }
        },
      }
    );
  };

  const isSubmitting = createManualQuote.isPending;

  return (
    <div className="space-y-4">

      {/* ── Template ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Modello PDF</p>
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={cn(
                "text-left p-3 rounded-xl border-2 transition-all",
                templateId === t.id
                  ? "border-violet-400 bg-violet-50"
                  : "border-gray-200 hover:border-violet-200"
              )}
            >
              <p className={cn("text-xs font-semibold", templateId === t.id ? "text-violet-700" : "text-gray-700")}>{t.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Titolo & Descrizione ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Intestazione preventivo</p>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-600">Oggetto lavori</Label>
          <Input
            placeholder="Es. Ristrutturazione bagno Via Garibaldi 10"
            value={titoloRiga2}
            onChange={e => setTitoloRiga2(e.target.value)}
            className="h-9 text-sm"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-600">Titolo documento</Label>
          <Input
            value={titoloRiga1}
            onChange={e => setTitoloRiga1(e.target.value)}
            className="h-9 text-sm text-gray-600"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-600">Descrizione generale (opzionale)</Label>
          <textarea
            value={descrizione}
            onChange={e => setDescrizione(e.target.value)}
            placeholder="Breve descrizione del progetto..."
            rows={2}
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition-shadow"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* ── Capitoli ── */}
      <div className="space-y-3">
        {chapters.map((ch, chIdx) => {
          const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          const lettera = letters[chIdx] ?? String(chIdx + 1);
          const capSubtotale = computeCapSubtotale(ch);

          return (
            <div key={ch.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Chapter header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                <span className="font-bold text-sm text-violet-600 shrink-0 w-5">{lettera}</span>
                <input
                  value={ch.titolo}
                  onChange={e => updateChapter(ch.id, { titolo: e.target.value })}
                  placeholder={`Capitolo ${lettera}`}
                  className="flex-1 text-sm font-semibold text-gray-800 bg-transparent outline-none placeholder:text-gray-400 min-w-0"
                  disabled={isSubmitting}
                />
                <span className="text-xs text-gray-500 font-mono shrink-0">€ {fmt(capSubtotale)}</span>
                <button
                  type="button"
                  onClick={() => updateChapter(ch.id, { collapsed: !ch.collapsed })}
                  className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                >
                  {ch.collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </button>
                {chapters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChapter(ch.id)}
                    className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {!ch.collapsed && (
                <div className="p-4 space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_64px_80px_88px_72px_28px] gap-2 px-1">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Descrizione</p>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">U.M.</p>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Qtà</p>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">P.U. €</p>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide text-right">Totale</p>
                    <span />
                  </div>

                  {/* Voci */}
                  {ch.voci.map(v => {
                    const voceTot = computeVoceTotale(v);
                    return (
                      <div key={v.id} className="grid grid-cols-[1fr_64px_80px_88px_72px_28px] gap-2 items-center">
                        {/* Descrizione + AI */}
                        <div className="flex items-center gap-1 min-w-0">
                          <input
                            value={v.descrizione}
                            onChange={e => updateVoce(ch.id, v.id, { descrizione: e.target.value })}
                            placeholder="Descrizione lavoro..."
                            className="flex-1 h-8 px-2.5 rounded-lg border border-gray-200 text-xs text-gray-800 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition min-w-0"
                            disabled={isSubmitting}
                          />
                          <AISuggestButton
                            voce={v}
                            chapterTitle={ch.titolo}
                            projectTitle={titoloRiga2}
                            onSuggest={desc => updateVoce(ch.id, v.id, { descrizione: desc })}
                          />
                        </div>

                        {/* U.M. */}
                        <select
                          value={v.um}
                          onChange={e => updateVoce(ch.id, v.id, { um: e.target.value })}
                          className="h-8 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent px-1.5 transition w-full"
                          disabled={isSubmitting}
                        >
                          {UM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>

                        {/* Quantità */}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={v.quantita}
                          onChange={e => updateVoce(ch.id, v.id, { quantita: e.target.value })}
                          className="h-8 px-2 rounded-lg border border-gray-200 text-xs text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition text-right w-full"
                          disabled={isSubmitting}
                        />

                        {/* Prezzo Unitario */}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={v.prezzoUnitario}
                          onChange={e => updateVoce(ch.id, v.id, { prezzoUnitario: e.target.value })}
                          placeholder="0,00"
                          className="h-8 px-2 rounded-lg border border-gray-200 text-xs text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition text-right w-full"
                          disabled={isSubmitting}
                        />

                        {/* Totale voce */}
                        <p className={cn("text-xs text-right font-mono shrink-0", voceTot > 0 ? "text-gray-700" : "text-gray-300")}>
                          {voceTot > 0 ? `€ ${fmt(voceTot)}` : "—"}
                        </p>

                        {/* Remove voce */}
                        {ch.voci.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeVoce(ch.id, v.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-200 hover:text-red-400 hover:bg-red-50 transition-colors"
                            disabled={isSubmitting}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : <span />}
                      </div>
                    );
                  })}

                  {/* Add voce */}
                  <button
                    type="button"
                    onClick={() => addVoce(ch.id)}
                    className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-600 hover:bg-violet-50 px-2.5 py-1.5 rounded-lg transition-colors"
                    disabled={isSubmitting}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Aggiungi voce
                  </button>

                  {/* Osservazione */}
                  <div className="pt-1 border-t border-gray-50">
                    <input
                      value={ch.osservazione}
                      onChange={e => updateChapter(ch.id, { osservazione: e.target.value })}
                      placeholder="Osservazione capitolo (opzionale)"
                      className="w-full h-7 px-2.5 rounded-lg border border-dashed border-gray-200 text-xs text-gray-600 placeholder:text-gray-300 bg-transparent focus:outline-none focus:border-violet-300 transition"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Chapter subtotal */}
                  <div className="flex justify-end pt-1">
                    <span className="text-xs text-gray-500 font-medium">
                      Subtotale {lettera}: <span className="font-mono font-semibold text-gray-800">€ {fmt(capSubtotale)}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add chapter */}
        <button
          type="button"
          onClick={addChapter}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/30 transition-all flex items-center justify-center gap-2"
          disabled={isSubmitting || chapters.length >= 26}
        >
          <Plus className="h-4 w-4" />
          Aggiungi capitolo
        </button>
      </div>

      {/* ── Totali & IVA ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Riepilogo economico</p>

        {/* IVA selector */}
        <div className="flex items-center gap-3">
          <Label className="text-xs font-medium text-gray-600 shrink-0">Aliquota IVA</Label>
          <div className="flex gap-2 flex-wrap">
            {IVA_OPTIONS.map(iva => (
              <button
                key={iva}
                type="button"
                onClick={() => setIvaPercentuale(iva)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  ivaPercentuale === iva
                    ? "border-violet-400 bg-violet-50 text-violet-700"
                    : "border-gray-200 text-gray-600 hover:border-violet-200"
                )}
                disabled={isSubmitting}
              >
                {iva === 0 ? "Esente" : `${iva}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Totals breakdown */}
        <div className="space-y-1 pt-1 border-t border-gray-100">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Imponibile</span>
            <span className="font-mono">€ {fmt(subtotale)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>IVA {ivaPercentuale === 0 ? "esente" : `${ivaPercentuale}%`}</span>
            <span className="font-mono">€ {fmt(ivaValore)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
            <span>Totale</span>
            <span className="font-mono text-violet-700">€ {fmt(totale)}</span>
          </div>
        </div>
      </div>

      {/* ── Condizioni pagamento ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Condizioni di pagamento</p>
        <div className="space-y-1.5">
          {condizioni.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 shrink-0 w-4">{idx + 1}.</span>
              <span className="flex-1 text-sm text-gray-700">{c}</span>
              <button
                type="button"
                onClick={() => removeCondizione(idx)}
                className="h-6 w-6 flex items-center justify-center rounded-lg text-gray-200 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                disabled={isSubmitting}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Input
            value={newCondizione}
            onChange={e => setNewCondizione(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCondizione(); } }}
            placeholder="Aggiungi condizione..."
            className="h-8 text-sm flex-1"
            disabled={isSubmitting}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCondizione}
            disabled={!newCondizione.trim() || isSubmitting}
            className="h-8 px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Note ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2">
        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Note finali</Label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition-shadow"
          disabled={isSubmitting}
        />
      </div>

      {/* ── Submit ── */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className={cn(
          "w-full h-12 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
          isSubmitting
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "btn-gradient text-white shadow-sm hover:shadow-md"
        )}
      >
        {isSubmitting
          ? <><Loader2 className="h-4 w-4 animate-spin" />Creazione in corso...</>
          : <>Crea Preventivo &rarr;</>}
      </button>
    </div>
  );
}
