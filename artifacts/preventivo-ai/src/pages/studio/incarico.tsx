import { useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, ArrowLeft, BadgeCheck, Download, Eye, Loader2, Send, XCircle } from "lucide-react";
import type { AzionePratica } from "@workspace/config";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useNoIndex } from "@/hooks/use-no-index";
import { useRequireAuth } from "@/hooks/use-auth";
import { formatCents } from "@/lib/jobs-api";
import { ErroreApiFiscale, studioApi, type IncaricoDto, type PraticaDto } from "@/lib/commercialista-api";
import { Avvertenze, Guida, Prospetto, Utile, Versamenti } from "@/components/fisco/pacchetto-view";
import { Chat, Cronologia, DocumentoTesto, Scorrevole } from "@/components/commercialista/parti";
import { StudioShell } from "./shell";

// ── A-6: un incarico visto dal professionista (/studio/incarichi/:id) ────────
// Prima dell'accettazione: la lettera firmata dal cliente e l'adeguata
// verifica. Dopo: il pacchetto dell'anno (aperto su richiesta, perché ogni
// apertura resta scritta per il cliente), la pratica e la chat.

const euro = formatCents;
const data = (iso: string | null) => (iso ? format(new Date(iso), "d MMMM yyyy", { locale: it }) : "—");

function useInvalida(id: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["studio", "incarico", id] });
    queryClient.invalidateQueries({ queryKey: ["studio", "incarichi"] });
  };
}

function Accettazione({ incarico }: { incarico: IncaricoDto }) {
  const { toast } = useToast();
  const invalida = useInvalida(incarico.id);
  const [verifica, setVerifica] = useState(false);
  const [motivo, setMotivo] = useState("");
  const accetta = useMutation({
    mutationFn: () => studioApi.accetta(incarico.id),
    onSuccess: () => {
      toast({ title: "Incarico accettato" });
      invalida();
    },
    onError: (err) => toast({ title: "Non accettato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });
  const rifiuta = useMutation({
    mutationFn: () => studioApi.chiudi(incarico.id, "rifiuta", motivo),
    onSuccess: () => {
      toast({ title: "Incarico rifiutato" });
      invalida();
    },
    onError: (err) => toast({ title: "Non rifiutato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });
  return (
    <div className="space-y-3 text-sm">
      {incarico.documenti && (
        <Scorrevole etichetta="Lettera d'incarico">
          <DocumentoTesto documento={incarico.documenti.lettera} />
        </Scorrevole>
      )}
      {incarico.stato === "proposto" && <p>Il cliente non ha ancora firmato.</p>}
      {incarico.stato === "firmato_cliente" && (
        <>
          <p>Il cliente ha firmato il {data(incarico.firmatoAt)} e ha preso visione delle informative.</p>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={verifica} onChange={(e) => setVerifica(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Ho svolto l'adeguata verifica della clientela (D.Lgs. 231/2007) con i miei strumenti.</span>
          </label>
          <button type="button" className="btn btn-sm btn-navy" disabled={!verifica || accetta.isPending} onClick={() => accetta.mutate()}>
            {accetta.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Accetta l'incarico
          </button>
        </>
      )}
      <div className="field">
        <label htmlFor="st-motivo">Se non puoi accettare, spiega perché (il cliente lo legge)</label>
        <input id="st-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <button type="button" className="btn btn-sm btn-outline-navy" disabled={!motivo.trim() || rifiuta.isPending} onClick={() => rifiuta.mutate()}>
        <XCircle className="h-4 w-4" /> Rifiuta l'incarico
      </button>
    </div>
  );
}

function Pacchetto({ id }: { id: string }) {
  const [aperto, setAperto] = useState(false);
  const q = useQuery({ queryKey: ["studio", "pacchetto", id], queryFn: () => studioApi.pacchetto(id), enabled: aperto, staleTime: 5 * 60_000 });
  if (!aperto) {
    return (
      <div className="space-y-2 text-sm">
        <p>Ogni apertura dei dati del cliente è registrata e visibile al cliente.</p>
        <button type="button" className="btn btn-sm btn-navy" onClick={() => setAperto(true)}>
          <Eye className="h-4 w-4" /> Apri il pacchetto dell'anno
        </button>
      </div>
    );
  }
  if (!q.data) return q.error ? <p className="text-sm">{(q.error as Error).message}</p> : <Loader2 className="h-5 w-5 animate-spin" />;
  const p = q.data.pacchetto;
  const c = q.data.chiusura;
  return (
    <div>
      <div className="flex gap-2 flex-wrap" style={{ marginBottom: 12 }}>
        <a className="btn btn-sm btn-outline-navy" href={studioApi.urlCsv(id)}>
          <Download className="h-4 w-4" /> Prima nota CSV
        </a>
        <a className="btn btn-sm btn-outline-navy" href={studioApi.urlPdf(id)}>
          <Download className="h-4 w-4" /> Pacchetto PDF
        </a>
      </div>
      <p className="text-sm" style={{ marginBottom: 8 }}>
        {p.impresa.denominazione}
        {p.impresa.partitaIva ? ` · P. IVA ${p.impresa.partitaIva}` : ""}
        {p.impresa.codiceFiscale ? ` · C.F. ${p.impresa.codiceFiscale}` : ""} · ATECO {p.profilo.codiceAteco} · coefficiente {p.profilo.coefficientePercent} %
      </p>
      {c.differenze.length > 0 && (
        <div className="notice warn text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Dopo la chiusura sono cambiati: {c.differenze.map((d) => `${d.voce} (${euro(d.alloraCents)} → ${euro(d.oggiCents)})`).join(", ")}.
          </span>
        </div>
      )}
      <Avvertenze pacchetto={p} />
      <Prospetto pacchetto={p} />
      <Utile pacchetto={p} />
      <Versamenti pacchetto={p} />
      <Guida passi={q.data.guida} />
    </div>
  );
}

function AzioniPratica({ id, pratica }: { id: string; pratica: PraticaDto }) {
  const { toast } = useToast();
  const invalida = useInvalida(id);
  const [osservazioni, setOsservazioni] = useState("");
  const [protocollo, setProtocollo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const esegui = useMutation({
    mutationFn: (azione: AzionePratica) => studioApi.azione(id, azione, { osservazioni: osservazioni || undefined, protocollo: protocollo || undefined, file: file ?? undefined }),
    onSuccess: (r) => {
      toast({ title: r.pratica.etichetta });
      setOsservazioni("");
      setFile(null);
      invalida();
    },
    onError: (err) => toast({ title: "Operazione non riuscita", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });
  const puo = (a: AzionePratica) => pratica.azioni.includes(a);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip chip-grey">{pratica.etichetta}</span>
        <span style={{ color: "var(--muted-mk)" }}>chiusura versione {pratica.chiusuraVersione}</span>
      </div>
      {pratica.differenza && (
        <div className="notice warn">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{pratica.differenza} Non approvare e non trasmettere: chiedi al cliente di riconsegnare.</span>
        </div>
      )}
      {pratica.bozza && (
        <a className="btn btn-sm btn-outline-navy" href={studioApi.urlFile(id, "bozza")} target="_blank" rel="noreferrer">
          <Download className="h-4 w-4" /> Bozza caricata: {pratica.bozza.nome}
        </a>
      )}
      {pratica.confermataAt && <p>Il cliente ha confermato la bozza il {data(pratica.confermataAt)}.</p>}
      {pratica.protocollo && (
        <p>
          Trasmessa il {data(pratica.inviataAt)}, protocollo <strong>{pratica.protocollo}</strong>.
        </p>
      )}

      {puo("prendi_in_carico") && (
        <button type="button" className="btn btn-sm btn-outline-navy" disabled={esegui.isPending} onClick={() => esegui.mutate("prendi_in_carico")}>
          Inizia la revisione
        </button>
      )}

      {(puo("richiedi_modifiche") || puo("approva")) && (
        <div className="field">
          <label htmlFor="st-osservazioni">Osservazioni per il cliente</label>
          <textarea id="st-osservazioni" rows={3} value={osservazioni} onChange={(e) => setOsservazioni(e.target.value)} />
        </div>
      )}
      {puo("richiedi_modifiche") && (
        <button type="button" className="btn btn-sm btn-outline-navy" disabled={esegui.isPending || osservazioni.trim().length < 5} onClick={() => esegui.mutate("richiedi_modifiche")}>
          Chiedi correzioni
        </button>
      )}

      {(puo("approva") || puo("esito_accolta")) && (
        <div className="field">
          <label htmlFor="st-file">{puo("approva") ? "Bozza della dichiarazione (PDF)" : "Ricevuta dell'Agenzia delle Entrate"}</label>
          <input id="st-file" type="file" accept="application/pdf,image/*,.xml,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      )}
      {puo("approva") && !pratica.differenza && (
        <button type="button" className="btn btn-sm btn-navy" disabled={esegui.isPending || !file} onClick={() => esegui.mutate("approva")}>
          <BadgeCheck className="h-4 w-4" /> Approva e manda la bozza al cliente
        </button>
      )}

      {puo("segna_inviata") && !pratica.differenza && (
        <div className="space-y-2">
          <div className="field">
            <label htmlFor="st-protocollo">Protocollo telematico (dalla ricevuta di Entratel)</label>
            <input id="st-protocollo" value={protocollo} onChange={(e) => setProtocollo(e.target.value)} />
          </div>
          <button type="button" className="btn btn-sm btn-navy" disabled={esegui.isPending || !protocollo.trim()} onClick={() => esegui.mutate("segna_inviata")}>
            <Send className="h-4 w-4" /> Registra la trasmissione
          </button>
        </div>
      )}

      {puo("esito_accolta") && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn btn-sm btn-navy" disabled={esegui.isPending || !file} onClick={() => esegui.mutate("esito_accolta")}>
            Ricevuta di accoglimento
          </button>
          <button type="button" className="btn btn-sm btn-outline-navy" disabled={esegui.isPending || !file} onClick={() => esegui.mutate("esito_scartata")}>
            Ricevuta di scarto
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudioIncaricoPage() {
  useNoIndex();
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn } = useRequireAuth();
  const q = useQuery({ queryKey: ["studio", "incarico", id], queryFn: () => studioApi.incarico(id), enabled: isLoaded && isSignedIn, retry: false });
  useDocumentTitle("Incarico — Studio PrevAI");

  if (!q.data) {
    return (
      <StudioShell>
        <div className="flex justify-center p-8">{q.error ? <p className="text-sm">{(q.error as Error).message}</p> : <Loader2 className="h-6 w-6 animate-spin" />}</div>
      </StudioShell>
    );
  }
  const { incarico, pratica, eventi } = q.data;
  const attivo = incarico.stato === "attivo";

  return (
    <StudioShell>
      <Link href="/studio" className="text-sm underline flex items-center gap-1" style={{ marginBottom: 8 }}>
        <ArrowLeft className="h-4 w-4" /> Tutti gli incarichi
      </Link>
      <div className="page-head">
        <div>
          <h1>Dichiarazione {incarico.anno + 1} — anno d'imposta {incarico.anno}</h1>
          <p className="sub">{incarico.etichetta}</p>
        </div>
      </div>

      {(incarico.stato === "proposto" || incarico.stato === "firmato_cliente") && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h2>Lettera d'incarico</h2>
            </div>
          </div>
          <div className="act-body">
            <Accettazione incarico={incarico} />
          </div>
        </section>
      )}

      {attivo && (
        <>
          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <h2>Pratica</h2>
                <p className="sub">Si trasmette solo ciò che il cliente ha confermato, e solo se i numeri non sono cambiati.</p>
              </div>
            </div>
            <div className="act-body">{pratica ? <AzioniPratica id={incarico.id} pratica={pratica} /> : <p className="text-sm">Il cliente non ha ancora consegnato la chiusura d'anno.</p>}</div>
          </section>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <h2>Pacchetto dell'anno</h2>
              </div>
            </div>
            <div className="act-body">
              <Pacchetto id={incarico.id} />
            </div>
          </section>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <h2>Consulenza</h2>
                <p className="sub">La risposta è una tua prestazione professionale: rispondi di persona.</p>
              </div>
            </div>
            <div className="act-body">
              <Chat chiave={["studio", "messaggi", incarico.id]} io="professionista" nomeAltro="Cliente" carica={() => studioApi.messaggi(incarico.id)} invia={(t) => studioApi.scrivi(incarico.id, t)} />
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Cronologia</h2>
              </div>
            </div>
            <div className="act-body">
              <Cronologia eventi={eventi} />
            </div>
          </section>
        </>
      )}

      {!attivo && incarico.motivoChiusura && <p className="text-sm">{incarico.motivoChiusura}</p>}
    </StudioShell>
  );
}
