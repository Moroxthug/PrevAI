import { useQuery } from "@tanstack/react-query";
import { formatPrezzoOfferta, lookupKeysAttese, lookupKeysPianiAttese, prerequisitiOfferta } from "@workspace/config";
import { addonsApi } from "@/lib/addons-api";

// A-5: pannello staff del test di prezzo dell'add-on Amministrazione.
// Imprese distinte per variante e per passo dell'imbuto; sotto, cosa manca
// perché l'offerta passi di stato e quali Price vanno creati su Stripe.

const PASSI = [
  { id: "vista", etichetta: "Hanno visto il prezzo" },
  { id: "interesse", etichetta: "Interesse" },
  { id: "checkout", etichetta: "Checkout avviato" },
  { id: "attivato", etichetta: "Attivati" },
  { id: "cessato", etichetta: "Disdetti" },
  { id: "beta", etichetta: "Beta convertiti" },
] as const;

export function AdminTestPrezzo() {
  const q = useQuery({ queryKey: ["admin", "addons", "test-prezzo"], queryFn: addonsApi.testPrezzo });
  const prerequisiti = prerequisitiOfferta({ anno: new Date().getFullYear() });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-800">Add-on PrevAI Fisco — test di prezzo</h2>
        <p className="text-xs text-slate-500">
          Stato richiesto: <strong>{q.data?.stato.richiesto ?? "…"}</strong> · stato effettivo: <strong>{q.data?.stato.effettivo ?? "…"}</strong>. Le varianti si
          assegnano per impresa (hash dell'id) o dal parametro <code>?v=</code> della landing.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm overflow-x-auto" tabIndex={0} role="region" aria-label="Risultati per variante">
        {q.isError && <p className="text-sm text-red-600">{(q.error as Error).message}</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-2 pr-4">Variante</th>
              <th className="py-2 pr-4">Prezzo</th>
              {PASSI.map((p) => (
                <th key={p.id} className="py-2 pr-4">
                  {p.etichetta}
                </th>
              ))}
              <th className="py-2">Conversione</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.righe ?? []).map((r) => (
              <tr key={r.variante} className="border-t border-slate-100">
                <td className="py-2 pr-4 font-bold uppercase">{r.variante}</td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {formatPrezzoOfferta(r.mensileCents)}/mese · {formatPrezzoOfferta(r.annualeCents)}/anno
                </td>
                {PASSI.map((p) => (
                  <td key={p.id} className="py-2 pr-4 tabular-nums">
                    {r.imprese[p.id]}
                  </td>
                ))}
                <td className="py-2 tabular-nums">{r.conversionePercent === null ? "—" : `${r.conversionePercent.toLocaleString("it-IT")} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-2">
          <h3 className="text-sm font-bold text-slate-800">Prerequisiti</h3>
          <ul className="text-sm space-y-1">
            {prerequisiti.map((p) => (
              <li key={p.id}>
                {p.chiuso ? "✅" : "⬜"} <strong>{p.id}</strong> — {p.chiuso ? "chiuso" : p.testo} <span className="text-xs text-slate-400">(blocca: {p.blocca})</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-2">
          <h3 className="text-sm font-bold text-slate-800">Price da creare su Stripe (lookup key)</h3>
          <ul className="text-xs font-mono space-y-1">
            {[...lookupKeysPianiAttese(), ...lookupKeysAttese()].map((k) => (
              <li key={k.chiave}>
                {k.chiave} — {formatPrezzoOfferta(k.importoCents)} / {k.intervallo === "mensile" ? "month" : "year"}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
