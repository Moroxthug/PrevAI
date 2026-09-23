import { AddonPaywall } from "@/components/addon-paywall";
import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Building2, CheckCircle2, Copy, Download, Inbox, Landmark, Loader2, RefreshCw, Stamp, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCents } from "@/lib/jobs-api";
import { jobsApi } from "@/lib/jobs-api";
import { ErroreApiSdi, sdiApi, type PassivaDto } from "@/lib/sdi-api";

// A-1: la casa del modulo Amministrazione.
// Due cose che l'artigiano deve vedere senza cercarle: le fatture dei
// fornitori appena arrivate (sono costi di cantiere che si stanno perdendo)
// e il bollo virtuale da versare a trimestre con F24.

const STATO_BOLLO: Record<string, { testo: string; colore: string }> = {
  aperto: { testo: "Da versare", colore: "var(--yellow-dark)" },
  da_versare: { testo: "Da versare", colore: "var(--yellow-dark)" },
  versato: { testo: "Versato", colore: "var(--green)" },
  non_dovuto: { testo: "Niente da versare", colore: "var(--muted-mk)" },
};

function CollegaDialog({ passiva, onClose }: { passiva: PassivaDto; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("materials");
  const cantieri = useQuery({ queryKey: ["jobs"], queryFn: () => jobsApi.list() });

  const collega = useMutation({
    mutationFn: () => sdiApi.collegaPassiva(passiva.id, { projectId, category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sdi", "passive"] });
      toast({ title: "Fattura collegata", description: "È entrata nei costi del cantiere." });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Collegamento non riuscito", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="act-body space-y-2">
        <div className="field">
          <label htmlFor="passiva-cantiere">Cantiere</label>
          <select id="passiva-cantiere" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Scegli il cantiere…</option>
            {(cantieri.data?.items ?? []).map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="passiva-categoria">Categoria di costo</label>
          <select id="passiva-categoria" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="materials">Materiali</option>
            <option value="subcontractor">Subappalto</option>
            <option value="equipment">Noleggi e attrezzature</option>
            <option value="permits_fees">Pratiche e oneri</option>
            <option value="labour">Manodopera</option>
            <option value="misc">Varie</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm btn-navy" disabled={!projectId || collega.isPending} onClick={() => collega.mutate()}>
            Collega al cantiere
          </button>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={onClose}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AmministrazionePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const anno = new Date().getFullYear();
  const [apertaId, setApertaId] = useState<string | null>(null);
  const [f24Trimestre, setF24Trimestre] = useState<number | null>(null);

  const passive = useQuery({ queryKey: ["sdi", "passive"], queryFn: () => sdiApi.passive(), retry: false });
  const bollo = useQuery({ queryKey: ["sdi", "bollo", anno], queryFn: () => sdiApi.bollo(anno), retry: false });
  const f24 = useQuery({ queryKey: ["sdi", "f24", anno, f24Trimestre], queryFn: () => sdiApi.f24(anno, f24Trimestre!), enabled: f24Trimestre !== null });

  const sincronizza = useMutation({
    mutationFn: () => sdiApi.sincronizzaPassive(),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["sdi", "passive"] });
      toast({ title: r.nuove > 0 ? `${r.nuove} nuove fatture di acquisto` : "Nessuna fattura nuova" });
    },
    onError: (err: Error) => toast({ title: "Sincronizzazione non riuscita", description: err.message, variant: "destructive" }),
  });
  const ignora = useMutation({
    mutationFn: (id: string) => sdiApi.ignoraPassiva(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sdi", "passive"] }),
  });
  const versato = useMutation({
    mutationFn: (trimestre: number) => sdiApi.segnaVersato(anno, trimestre, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sdi", "bollo"] });
      toast({ title: "Trimestre segnato come versato" });
    },
  });

  if (passive.isError && passive.error instanceof ErroreApiSdi && passive.error.codice === "SDI_MODULE_OFF") {
    return <AddonPaywall motivo="sdi" />;
  }

  const nuove = (passive.data?.fatture ?? []).filter((f) => f.stato === "nuova");
  const altre = (passive.data?.fatture ?? []).filter((f) => f.stato !== "nuova");

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2">
            <Building2 className="h-7 w-7 text-navy-500" />
            Amministrazione
          </h1>
          <p className="sub">Fatture dei fornitori e imposta di bollo. Le fatture che emetti tu stanno in Fatture.</p>
        </div>
        <div className="head-actions">
          <Link href="/dashboard/settings?tab=sdi" className="btn btn-sm btn-outline-navy">
            Impostazioni SdI
          </Link>
        </div>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <Inbox className="h-5 w-5" /> Fatture dei fornitori
            </h2>
            <p className="sub">Arrivano dallo SdI. Collegale a un cantiere e diventano costi.</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => sincronizza.mutate()} disabled={sincronizza.isPending}>
            <RefreshCw className={`h-4 w-4 ${sincronizza.isPending ? "animate-spin" : ""}`} /> Controlla ora
          </button>
        </div>
        {passive.isLoading ? (
          <div className="act-body flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : nuove.length === 0 && altre.length === 0 ? (
          <div className="card-empty">Nessuna fattura di acquisto. Se i tuoi fornitori fatturano elettronicamente, attiva la ricezione nelle impostazioni.</div>
        ) : (
          <div>
            {[...nuove, ...altre].map((f) => (
              <div key={f.id} className="item-row" style={{ display: "block" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {f.fornitoreNome || "Fornitore sconosciuto"} · {f.numero}
                    </div>
                    <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
                      {f.data ? format(new Date(f.data), "PP", { locale: it }) : "senza data"} · imponibile {formatCents(f.imponibileCents)}
                      {f.ivaCents ? ` · IVA ${formatCents(f.ivaCents)}` : ""} · totale <strong>{formatCents(f.totaleCents)}</strong>
                      {f.stato === "collegata" ? " · collegata a un cantiere" : f.stato === "ignorata" ? " · ignorata" : ""}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {f.xmlDisponibile && (
                      <a href={sdiApi.xmlPassivaUrl(f.id)} className="ic-btn" aria-label="Scarica XML">
                        <Download />
                      </a>
                    )}
                    {f.stato === "nuova" && (
                      <>
                        <button type="button" className="btn btn-sm btn-navy" onClick={() => setApertaId(apertaId === f.id ? null : f.id)}>
                          Collega a un cantiere
                        </button>
                        <button type="button" className="ic-btn" aria-label="Ignora" onClick={() => ignora.mutate(f.id)}>
                          <X />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {apertaId === f.id && <CollegaDialog passiva={f} onClose={() => setApertaId(null)} />}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h2 className="flex items-center gap-2">
              <Stamp className="h-5 w-5" /> Imposta di bollo {anno}
            </h2>
            <p className="sub">2 € su ogni fattura senza IVA sopra 77,47 €. Si versa a trimestre con F24: il modello te lo prepariamo noi, il versamento lo fai tu.</p>
          </div>
        </div>
        <div className="act-body">
          {bollo.isLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {(bollo.data?.periodi ?? []).map((p) => {
                const s = STATO_BOLLO[p.stato] ?? STATO_BOLLO.non_dovuto;
                return (
                  <div key={p.trimestre} className="flex items-center justify-between gap-3 flex-wrap text-sm">
                    <div>
                      <strong>{p.trimestre}° trimestre</strong>
                      <span style={{ color: "var(--muted-mk)" }}>
                        {" "}
                        · {p.documenti} document{p.documenti === 1 ? "o" : "i"} · codice tributo {p.codiceTributo}
                        {p.scadenza ? ` · entro il ${format(new Date(p.scadenza), "PP", { locale: it })}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge" style={{ color: s.colore }}>{s.testo}</span>
                      <strong>{formatCents(p.importoCents)}</strong>
                      {p.importoCents > 0 && (
                        <>
                          <button type="button" className="text-link text-xs" onClick={() => setF24Trimestre(f24Trimestre === p.trimestre ? null : p.trimestre)}>
                            <Landmark className="h-3.5 w-3.5 inline" /> F24
                          </button>
                          {p.stato !== "versato" && (
                            <button type="button" className="text-link text-xs" onClick={() => versato.mutate(p.trimestre)}>
                              <CheckCircle2 className="h-3.5 w-3.5 inline" /> Segna versato
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {f24.data && (
                <div className="notice info" style={{ alignItems: "flex-start", marginTop: 8 }}>
                  <div className="grow">
                    <strong>F24 — {f24.data.trimestre}° trimestre {f24.data.anno}</strong>
                    <table className="mt-2 text-xs">
                      <tbody>
                        {f24.data.righe.map((r) => (
                          <tr key={r.etichetta}>
                            <td style={{ color: "var(--muted-mk)", paddingRight: 12 }}>{r.etichetta}</td>
                            <td className="font-mono">{r.valore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs mt-2">{f24.data.avviso}</p>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-navy mt-2"
                      onClick={() => {
                        navigator.clipboard.writeText(f24.data!.righe.map((r) => `${r.etichetta}: ${r.valore}`).join("\n"));
                        toast({ title: "Dati F24 copiati" });
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copia i dati
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
