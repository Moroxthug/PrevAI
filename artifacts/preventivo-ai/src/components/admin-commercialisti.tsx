import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ETICHETTE_MODELLO } from "@workspace/config";
import { useToast } from "@/hooks/use-toast";
import { formatCents } from "@/lib/jobs-api";
import { ErroreApiFiscale, adminCommercialistiApi, type AdminCommercialistiDto } from "@/lib/commercialista-api";

// A-6: pannello staff dei commercialisti. Verifica (iscrizione sull'albo
// online dell'Ordine, abilitazione Entratel, polizza RC), compenso per pratica
// (D11), assegnazione a mano delle richieste finché D9 è aperta, registro dei
// compensi. Lo staff non vede mai i conti dei clienti: solo impresa e anno.

const euro = formatCents;

type Professionista = AdminCommercialistiDto["professionisti"][number];

function Verifica({ p, onFatto }: { p: Professionista; onFatto: () => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState(p.noteVerifica);
  const [rc, setRc] = useState(false);
  const [entratel, setEntratel] = useState(false);
  const [compenso, setCompenso] = useState(p.compensoPraticaCents === null ? "" : String(p.compensoPraticaCents / 100));
  const [capienza, setCapienza] = useState(String(p.capienza));
  const [motivo, setMotivo] = useState("");
  const errore = (titolo: string) => (err: unknown) => toast({ title: titolo, description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" });
  const verifica = useMutation({
    mutationFn: () =>
      adminCommercialistiApi.verifica(p.id, {
        note,
        rcVerificata: rc,
        entratelVerificato: entratel,
        capienza: Number(capienza) || undefined,
        compensoPraticaCents: compenso.trim() === "" ? null : Math.round(Number(compenso) * 100),
      }),
    onSuccess: () => {
      toast({ title: "Salvato" });
      onFatto();
    },
    onError: errore("Non salvato"),
  });
  const sospendi = useMutation({
    mutationFn: (cessa: boolean) => adminCommercialistiApi.sospendi(p.id, motivo, cessa),
    onSuccess: () => {
      toast({ title: "Fatto" });
      onFatto();
    },
    onError: errore("Non riuscito"),
  });

  return (
    <div className="space-y-2 text-sm" style={{ paddingTop: 8 }}>
      <p className="text-xs text-slate-500">
        C.F. {p.codiceFiscale} · P. IVA {p.partitaIva} · Albo {p.ordine} sez. {p.sezioneAlbo} n. {p.numeroAlbo} · PEC {p.pec} · Entratel dichiarato: {p.abilitatoEntratel ? "sì" : "no"} ·
        RC {p.rcCompagnia} n. {p.rcNumeroPolizza}, {euro(p.rcMassimaleCents)}, scade {p.rcScadenza ? format(new Date(p.rcScadenza), "d MMM yyyy", { locale: it }) : "—"}
        {p.rcVerificataAt ? " (vista)" : " (da vedere)"}
      </p>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={rc} onChange={(e) => setRc(e.target.checked)} /> Ho visto la polizza RC in corso di validità
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={entratel} onChange={(e) => setEntratel(e.target.checked)} /> Ho verificato l'abilitazione Entratel
      </label>
      <div className="flex gap-2 flex-wrap">
        <input className="border rounded px-2 py-1" aria-label="Note di verifica" placeholder="Note (es. albo controllato il …)" value={note} onChange={(e) => setNote(e.target.value)} />
        <input className="border rounded px-2 py-1 w-36" aria-label="Compenso per pratica in euro" placeholder="Compenso € (D11)" value={compenso} onChange={(e) => setCompenso(e.target.value)} />
        <input className="border rounded px-2 py-1 w-24" aria-label="Capienza" value={capienza} onChange={(e) => setCapienza(e.target.value)} />
        <button type="button" className="px-3 py-1 rounded bg-slate-800 text-white text-xs" disabled={verifica.isPending} onClick={() => verifica.mutate()}>
          {p.stato === "candidato" ? "Verifica" : "Aggiorna"}
        </button>
      </div>
      {p.stato !== "cessato" && (
        <div className="flex gap-2 flex-wrap">
          <input className="border rounded px-2 py-1" aria-label="Motivo della sospensione" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button type="button" className="px-3 py-1 rounded border text-xs" disabled={motivo.trim().length < 3} onClick={() => sospendi.mutate(false)}>
            Sospendi
          </button>
          <button type="button" className="px-3 py-1 rounded border text-xs text-red-700" disabled={motivo.trim().length < 3} onClick={() => sospendi.mutate(true)}>
            Cessa il rapporto
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminCommercialisti() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "commercialisti"], queryFn: adminCommercialistiApi.elenco });
  const aggiorna = () => queryClient.invalidateQueries({ queryKey: ["admin", "commercialisti"] });
  const [aperto, setAperto] = useState<string | null>(null);
  const [scelta, setScelta] = useState<Record<string, string>>({});
  const assegna = useMutation({
    mutationFn: ({ incarico, professionista }: { incarico: string; professionista: string }) => adminCommercialistiApi.assegna(incarico, professionista),
    onSuccess: () => {
      toast({ title: "Assegnato", description: "Il cliente riceve la lettera d'incarico da firmare." });
      aggiorna();
    },
    onError: (err) => toast({ title: "Non assegnato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });
  const compenso = useMutation({
    mutationFn: ({ id, azione, numero }: { id: string; azione: "fatturato" | "pagato"; numero?: string }) => adminCommercialistiApi.compenso(id, azione, numero),
    onSuccess: aggiorna,
    onError: (err) => toast({ title: "Non aggiornato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });

  if (!q.data) return q.error ? <p className="text-sm text-red-600">{(q.error as Error).message}</p> : <p className="text-sm">Caricamento…</p>;
  const d = q.data;
  const operativi = d.professionisti.filter((p) => p.operativo);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-800">Commercialisti convenzionati (fase 2)</h2>
        <p className="text-xs text-slate-500">
          Stato del servizio: <strong>{d.servizio.stato}</strong> · modello: <strong>{d.servizio.modello ? ETICHETTE_MODELLO[d.servizio.modello] : "non deciso (D9)"}</strong> ·
          assegnazione {d.servizio.assegnazioneAutomatica ? "automatica" : "a mano"}.
        </p>
        {d.servizio.mancanti.length > 0 && (
          <ul className="text-xs text-slate-500" style={{ listStyle: "disc", paddingLeft: 18, marginTop: 4 }}>
            {d.servizio.mancanti.map((m) => (
              <li key={m.id}>{m.testo}</li>
            ))}
          </ul>
        )}
      </div>

      <section className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800" style={{ marginBottom: 8 }}>
          Richieste da assegnare ({d.richieste.length})
        </h3>
        {d.richieste.length === 0 && <p className="text-sm text-slate-500">Nessuna.</p>}
        {d.richieste.map((r) => (
          <div key={r.id} className="flex items-center gap-2 flex-wrap text-sm border-t border-slate-100 py-2">
            <span className="grow">
              {r.azienda || "Impresa"} {r.provincia ? `(${r.provincia})` : ""} · anno {r.anno} · dal {format(new Date(r.richiestoAt), "d MMM yyyy", { locale: it })}
            </span>
            <select aria-label="Professionista" className="border rounded px-2 py-1" value={scelta[r.id] ?? ""} onChange={(e) => setScelta((s) => ({ ...s, [r.id]: e.target.value }))}>
              <option value="">Scegli…</option>
              {operativi.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} {p.cognome} ({p.provincia ?? "—"}, {p.carico}/{p.capienza})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="px-3 py-1 rounded bg-slate-800 text-white text-xs"
              disabled={!scelta[r.id] || assegna.isPending}
              onClick={() => assegna.mutate({ incarico: r.id, professionista: scelta[r.id]! })}
            >
              Assegna
            </button>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800" style={{ marginBottom: 8 }}>
          Professionisti ({d.professionisti.length})
        </h3>
        {d.professionisti.map((p) => (
          <div key={p.id} className="border-t border-slate-100 py-2">
            <button type="button" className="w-full text-left text-sm flex items-center gap-2 flex-wrap" onClick={() => setAperto(aperto === p.id ? null : p.id)} aria-expanded={aperto === p.id}>
              <strong>
                {p.nome} {p.cognome}
              </strong>
              <span className="text-slate-500">
                {p.studio || "—"} · {p.stato} · {p.operativo ? "operativo" : "non operativo"} · {p.carico}/{p.capienza} incarichi
                {p.compensoPraticaCents !== null ? ` · ${euro(p.compensoPraticaCents)}/pratica` : ""}
              </span>
            </button>
            {!p.operativo && <p className="text-xs text-amber-700">{p.motivi.join(" ")}</p>}
            {aperto === p.id && <Verifica p={p} onFatto={aggiorna} />}
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800" style={{ marginBottom: 8 }}>
          Compensi
        </h3>
        {d.compensi.length === 0 && <p className="text-sm text-slate-500">Nessun compenso maturato.</p>}
        {d.compensi.map((c) => (
          <div key={c.id} className="flex items-center gap-2 flex-wrap text-sm border-t border-slate-100 py-2">
            <span className="grow">
              {c.professionista} · anno {c.anno} · {euro(c.importoCents)} · {c.stato}
              {c.fatturaNumero ? ` · fattura ${c.fatturaNumero}` : ""}
            </span>
            {c.stato === "maturato" && (
              <button
                type="button"
                className="px-3 py-1 rounded border text-xs"
                onClick={() => {
                  const numero = window.prompt("Numero della fattura del professionista");
                  if (numero) compenso.mutate({ id: c.id, azione: "fatturato", numero });
                }}
              >
                Fattura ricevuta
              </button>
            )}
            {c.stato === "fatturato" && (
              <button type="button" className="px-3 py-1 rounded border text-xs" onClick={() => compenso.mutate({ id: c.id, azione: "pagato" })}>
                Pagato
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
