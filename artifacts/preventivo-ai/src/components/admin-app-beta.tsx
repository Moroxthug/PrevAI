import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// APP-5: pannello staff della beta con le imprese pilota. Per ogni impresa:
// aperture, preventivi creati e condivisi, dall'app nativa (android / ios)
// e in totale; sotto, le segnalazioni "Segnala un problema".

type Counts = { app_open: number; quote_created: number; quote_shared: number };
type Report = {
  migrated: boolean;
  days: number;
  since: string;
  totals: Record<string, Counts>;
  goal: { nativeQuotes: number; target: number };
  orgs: { userId: string; companyName: string; total: Counts; native: Counts; surfaces: string[]; lastSeen: string }[];
  feedback: {
    id: string;
    createdAt: string;
    companyName: string;
    email: string;
    message: string;
    route: string;
    surface: string;
    viewport: string;
    appVersion: string | null;
    userAgent: string;
    stato: "nuovo" | "visto" | "risolto";
  }[];
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const SURFACES = ["android", "ios", "pwa", "web"] as const;
const SURFACE_LABEL: Record<string, string> = { android: "App Android", ios: "App iOS", pwa: "PWA installata", web: "Sito" };
const STATI = ["nuovo", "visto", "risolto"] as const;
const dt = (s: string) => new Date(s).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AdminAppBeta() {
  const [days, setDays] = useState(14);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "app-beta", days], queryFn: () => json<Report>(`/api/admin/app-beta?days=${days}`) });
  const setStato = useMutation({
    mutationFn: ({ id, stato }: { id: string; stato: string }) => json(`/api/admin/app-beta/feedback/${id}`, { method: "PATCH", body: JSON.stringify({ stato }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "app-beta"] }),
  });
  const r = q.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Beta app — imprese pilota</h2>
          <p className="text-xs text-slate-500">
            Eventi d'uso (app aperta, preventivo creato, preventivo condiviso) per superficie. "Fatto" per APP-5: due settimane senza crash bloccanti su Sentry e
            almeno {r?.goal.target ?? 20} preventivi creati dall'app nativa.
          </p>
        </div>
        <label className="text-xs text-slate-500 flex items-center gap-2">
          Periodo
          <select className="border border-slate-200 rounded-lg px-2 py-1 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 14, 30, 90].map((d) => <option key={d} value={d}>ultimi {d} giorni</option>)}
          </select>
        </label>
      </div>

      {q.isError && <p className="text-sm text-red-600">{(q.error as Error).message}</p>}
      {r && !r.migrated && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          Le tabelle della beta non esistono ancora: va eseguita <code>migrations/v2/0009_app5_beta.sql</code> (RUNBOOKS §5.3). Fino ad allora gli eventi vengono scartati e "Segnala un problema" risponde "non ancora attivo".
        </div>
      )}

      {r?.migrated && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500">Preventivi dall'app</p>
              <p className="text-2xl font-bold text-slate-800 tabular-nums">{r.goal.nativeQuotes} <span className="text-sm text-slate-400">/ {r.goal.target}</span></p>
            </div>
            {SURFACES.map((s) => (
              <div key={s} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <p className="text-xs text-slate-500">{SURFACE_LABEL[s]}</p>
                <p className="text-sm text-slate-700 tabular-nums">
                  <strong>{r.totals[s]?.app_open ?? 0}</strong> aperture · <strong>{r.totals[s]?.quote_created ?? 0}</strong> creati · <strong>{r.totals[s]?.quote_shared ?? 0}</strong> condivisi
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm overflow-x-auto" tabIndex={0} role="region" aria-label="Uso per impresa">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Per impresa</h3>
            {r.orgs.length === 0 ? (
              <p className="text-sm text-slate-500">Nessun evento nel periodo.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2 pr-4">Impresa</th>
                    <th className="py-2 pr-4">Dove</th>
                    <th className="py-2 pr-4">Aperture (app / tot.)</th>
                    <th className="py-2 pr-4">Creati (app / tot.)</th>
                    <th className="py-2 pr-4">Condivisi (app / tot.)</th>
                    <th className="py-2">Ultimo uso</th>
                  </tr>
                </thead>
                <tbody>
                  {r.orgs.map((o) => (
                    <tr key={o.userId} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-semibold">{o.companyName}</td>
                      <td className="py-2 pr-4 text-xs">{o.surfaces.map((s) => SURFACE_LABEL[s] ?? s).join(", ")}</td>
                      <td className="py-2 pr-4 tabular-nums">{o.native.app_open} / {o.total.app_open}</td>
                      <td className="py-2 pr-4 tabular-nums">{o.native.quote_created} / {o.total.quote_created}</td>
                      <td className="py-2 pr-4 tabular-nums">{o.native.quote_shared} / {o.total.quote_shared}</td>
                      <td className="py-2 whitespace-nowrap text-xs">{dt(o.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Segnalazioni ({r.feedback.filter((f) => f.stato === "nuovo").length} nuove)</h3>
            {r.feedback.length === 0 && <p className="text-sm text-slate-500">Nessuna segnalazione.</p>}
            {r.feedback.map((f) => (
              <div key={f.id} className="border border-slate-100 rounded-xl p-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    <strong className="text-slate-700">{f.companyName}</strong> · {f.email} · {dt(f.createdAt)} · {SURFACE_LABEL[f.surface] ?? f.surface} ({f.viewport}) · {f.route || "—"}
                    {f.appVersion ? ` · ${f.appVersion}` : ""}
                  </span>
                  <select
                    aria-label="Stato della segnalazione"
                    className="border border-slate-200 rounded-lg px-2 py-0.5 text-xs"
                    value={f.stato}
                    disabled={setStato.isPending}
                    onChange={(e) => setStato.mutate({ id: f.id, stato: e.target.value })}
                  >
                    {STATI.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{f.message}</p>
                <p className="text-[11px] text-slate-400 truncate" title={f.userAgent}>{f.userAgent}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
