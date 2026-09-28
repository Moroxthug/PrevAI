import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// APP-8h: pannello staff — quanto costa l'assistente a ogni impresa nel mese
// (token dei turni + voce del fornitore, in euro al cambio approssimato, per
// posto). Sopra la soglia la riga è segnata e il cron del giorno ha già mandato
// l'avviso (RUNBOOKS §24). Le prove automatiche del modello sono `pnpm eval:assistant`.

type Row = {
  userId: string;
  companyName: string | null;
  plan: string | null;
  turns: number;
  tokens: number;
  voiceMinutes: number;
  seats: number;
  costEurCents: number;
  perSeatEurCents: number;
  perTurnEurCents: number;
  overAlert: boolean;
};
type Report = { from: string; rows: Row[]; alertPerSeatEurCents: number };

const eur = (cents: number, digits = 2) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });

function months(): string[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
}

export function AdminAssistantCosts() {
  const [month, setMonth] = useState(months()[0]!);
  const q = useQuery({
    queryKey: ["admin", "assistant-costs", month],
    queryFn: async () => {
      const res = await fetch(`/api/admin/assistant-costs?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Report;
    },
  });
  const r = q.data;
  const total = r?.rows.reduce((s, x) => s + x.costEurCents, 0) ?? 0;
  const turns = r?.rows.reduce((s, x) => s + x.turns, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Assistente — costi per impresa</h2>
          <p className="text-xs text-slate-500">
            Token delle risposte e voce del fornitore, in euro al cambio approssimato. Avviso allo staff quando un'impresa supera {r ? eur(r.alertPerSeatEurCents, 0) : "la soglia"} al mese per posto.
          </p>
        </div>
        <label className="text-xs text-slate-500 flex items-center gap-2">
          Mese
          <select className="border border-slate-200 rounded-lg px-2 py-1 text-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months().map((m) => <option key={m} value={m}>{new Date(`${m}-15T12:00:00Z`).toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</option>)}
          </select>
        </label>
      </div>

      {q.isError && <p className="text-sm text-red-600">{(q.error as Error).message}</p>}

      {r && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500">Costo del mese</p>
              <p className="text-2xl font-bold text-slate-800 tabular-nums">{eur(total, 3)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500">Domande</p>
              <p className="text-2xl font-bold text-slate-800 tabular-nums">{turns.toLocaleString("it-IT")}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500">Costo medio per domanda</p>
              <p className="text-2xl font-bold text-slate-800 tabular-nums">{turns ? eur(total / turns, 4) : "—"}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500">Oltre la soglia</p>
              <p className="text-2xl font-bold text-slate-800 tabular-nums">{r.rows.filter((x) => x.overAlert).length}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm overflow-x-auto" tabIndex={0} role="region" aria-label="Costi dell'assistente per impresa">
            {r.rows.length === 0 ? (
              <p className="text-sm text-slate-500">Nessun uso dell'assistente nel mese.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2 pr-4">Impresa</th>
                    <th className="py-2 pr-4">Piano</th>
                    <th className="py-2 pr-4">Domande</th>
                    <th className="py-2 pr-4">Token</th>
                    <th className="py-2 pr-4">Minuti di voce</th>
                    <th className="py-2 pr-4">Posti</th>
                    <th className="py-2 pr-4">Costo</th>
                    <th className="py-2">Per posto</th>
                  </tr>
                </thead>
                <tbody>
                  {r.rows.map((x) => (
                    <tr key={x.userId} className={`border-t border-slate-100 ${x.overAlert ? "bg-amber-50" : ""}`}>
                      <td className="py-2 pr-4 font-semibold">{x.companyName || x.userId}</td>
                      <td className="py-2 pr-4 text-xs">{x.plan ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums">{x.turns.toLocaleString("it-IT")}</td>
                      <td className="py-2 pr-4 tabular-nums">{x.tokens.toLocaleString("it-IT")}</td>
                      <td className="py-2 pr-4 tabular-nums">{x.voiceMinutes.toLocaleString("it-IT")}</td>
                      <td className="py-2 pr-4 tabular-nums">{x.seats}</td>
                      <td className="py-2 pr-4 tabular-nums">{eur(x.costEurCents, 3)}</td>
                      <td className="py-2 tabular-nums font-semibold">{eur(x.perSeatEurCents, 3)}{x.overAlert ? " ⚠" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
