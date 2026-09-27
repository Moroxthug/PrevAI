import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, BadgeCheck, Briefcase, FileSignature, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { PROVINCE_ITALIANE, type Documento } from "@workspace/config";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useNoIndex } from "@/hooks/use-no-index";
import { useRequireAuth } from "@/hooks/use-auth";
import { formatCents } from "@/lib/jobs-api";
import { ErroreApiFiscale, studioApi, type CandidaturaInput, type ProfessionistaDto } from "@/lib/commercialista-api";
import { DocumentoTesto, Scorrevole } from "@/components/commercialista/parti";
import { TwoFactorCard } from "@/pages/dashboard/settings-security-tab";
import { StudioShell } from "./shell";

// ── A-6: lo studio del professionista (/studio) ──────────────────────────────
// Chi è iscritto all'Albo si candida qui, aspetta la verifica di PrevAI
// (iscrizione, Entratel, polizza RC), firma la convenzione e poi trova gli
// incarichi che i clienti gli hanno affidato. La verifica in due passaggi è
// obbligatoria prima di tutto: sono i conti di altre persone.

const euro = formatCents;

const STATO: Record<ProfessionistaDto["stato"], string> = {
  candidato: "In attesa di verifica",
  verificato: "Verificato",
  sospeso: "Sospeso",
  cessato: "Cessato",
};

function vuota(): CandidaturaInput {
  return {
    nome: "",
    cognome: "",
    codiceFiscale: "",
    partitaIva: "",
    sezioneAlbo: "A",
    ordine: "",
    numeroAlbo: "",
    pec: "",
    studio: "",
    indirizzoStudio: "",
    provincia: null,
    abilitatoEntratel: false,
    rcCompagnia: "",
    rcNumeroPolizza: "",
    rcMassimaleCents: 0,
    rcScadenza: "",
    altriStrumentiIa: "",
  };
}

function daProfessionista(p: ProfessionistaDto): CandidaturaInput {
  return {
    nome: p.nome,
    cognome: p.cognome,
    codiceFiscale: p.codiceFiscale,
    partitaIva: p.partitaIva,
    sezioneAlbo: p.sezioneAlbo,
    ordine: p.ordine,
    numeroAlbo: p.numeroAlbo,
    pec: p.pec,
    studio: p.studio,
    indirizzoStudio: p.indirizzoStudio,
    provincia: p.provincia,
    abilitatoEntratel: p.abilitatoEntratel,
    rcCompagnia: p.rcCompagnia,
    rcNumeroPolizza: p.rcNumeroPolizza,
    rcMassimaleCents: p.rcMassimaleCents,
    rcScadenza: p.rcScadenza ? p.rcScadenza.slice(0, 10) : "",
    altriStrumentiIa: p.altriStrumentiIa,
  };
}

function Campo(props: { id: string; etichetta: string; valore: string; onChange: (v: string) => void; tipo?: string; aiuto?: string; disabilitato?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.etichetta}</label>
      <input id={props.id} type={props.tipo ?? "text"} value={props.valore} disabled={props.disabilitato} onChange={(e) => props.onChange(e.target.value)} />
      {props.aiuto && (
        <p className="text-xs" style={{ color: "var(--muted-mk)" }}>
          {props.aiuto}
        </p>
      )}
    </div>
  );
}

function Candidatura({ professionista, sezioni }: { professionista: ProfessionistaDto | null; sezioni: Record<"A" | "B", string> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [d, setD] = useState<CandidaturaInput>(professionista ? daProfessionista(professionista) : vuota());
  const bloccata = Boolean(professionista && professionista.stato !== "candidato");
  const set = <K extends keyof CandidaturaInput>(k: K) => (v: CandidaturaInput[K]) => setD((x) => ({ ...x, [k]: v }));
  const salva = useMutation({
    mutationFn: () => studioApi.candidatura(d),
    onSuccess: () => {
      toast({ title: professionista ? "Profilo aggiornato" : "Candidatura inviata", description: professionista ? undefined : "PrevAI verificherà iscrizione, Entratel e polizza." });
      queryClient.invalidateQueries({ queryKey: ["studio"] });
    },
    onError: (err) => toast({ title: "Non salvato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });

  return (
    <form
      className="act-body space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        salva.mutate();
      }}
    >
      {bloccata && (
        <p className="text-xs" style={{ color: "var(--muted-mk)" }}>
          Identità e iscrizione sono già verificate: per cambiarle scrivi al supporto. Polizza, studio e strumenti si aggiornano da qui — una polizza
          nuova va rivista da PrevAI prima di tornare operativo.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Campo id="st-nome" etichetta="Nome" valore={d.nome} onChange={set("nome")} disabilitato={bloccata} />
        <Campo id="st-cognome" etichetta="Cognome" valore={d.cognome} onChange={set("cognome")} disabilitato={bloccata} />
        <Campo id="st-cf" etichetta="Codice fiscale" valore={d.codiceFiscale} onChange={set("codiceFiscale")} disabilitato={bloccata} />
        <Campo id="st-piva" etichetta="Partita IVA" valore={d.partitaIva} onChange={set("partitaIva")} disabilitato={bloccata} />
        <div className="field">
          <label htmlFor="st-sezione">Sezione dell'Albo</label>
          <select id="st-sezione" value={d.sezioneAlbo} disabled={bloccata} onChange={(e) => set("sezioneAlbo")(e.target.value as "A" | "B")}>
            {(Object.keys(sezioni) as ("A" | "B")[]).map((k) => (
              <option key={k} value={k}>
                {sezioni[k]}
              </option>
            ))}
          </select>
        </div>
        <Campo id="st-ordine" etichetta="Ordine territoriale" valore={d.ordine} onChange={set("ordine")} aiuto="Per esempio: Milano" disabilitato={bloccata} />
        <Campo id="st-numero" etichetta="Numero di iscrizione" valore={d.numeroAlbo} onChange={set("numeroAlbo")} disabilitato={bloccata} />
        <Campo id="st-pec" etichetta="PEC" tipo="email" valore={d.pec} onChange={set("pec")} disabilitato={bloccata} />
        <Campo id="st-studio" etichetta="Studio (facoltativo)" valore={d.studio} onChange={set("studio")} />
        <Campo id="st-indirizzo" etichetta="Indirizzo dello studio" valore={d.indirizzoStudio} onChange={set("indirizzoStudio")} />
        <div className="field">
          <label htmlFor="st-provincia">Provincia dello studio</label>
          <select id="st-provincia" value={d.provincia ?? ""} onChange={(e) => set("provincia")(e.target.value || null)}>
            <option value="">—</option>
            {PROVINCE_ITALIANE.map((p) => (
              <option key={p.sigla} value={p.sigla}>
                {p.nome} ({p.sigla})
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={d.abilitatoEntratel} onChange={(e) => set("abilitatoEntratel")(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Sono abilitato a Entratel come intermediario (art. 3, comma 3, DPR 322/1998).</span>
      </label>
      <h3 className="font-semibold text-sm" style={{ color: "var(--navy)" }}>
        Polizza di responsabilità civile professionale
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo id="st-rc-compagnia" etichetta="Compagnia" valore={d.rcCompagnia} onChange={set("rcCompagnia")} />
        <Campo id="st-rc-numero" etichetta="Numero di polizza" valore={d.rcNumeroPolizza} onChange={set("rcNumeroPolizza")} />
        <Campo
          id="st-rc-massimale"
          etichetta="Massimale (€)"
          tipo="number"
          valore={d.rcMassimaleCents ? String(d.rcMassimaleCents / 100) : ""}
          onChange={(v) => set("rcMassimaleCents")(Math.round(Number(v || 0) * 100))}
        />
        <Campo id="st-rc-scadenza" etichetta="Scadenza" tipo="date" valore={d.rcScadenza} onChange={set("rcScadenza")} />
      </div>
      <div className="field">
        <label htmlFor="st-ia">Altri strumenti di intelligenza artificiale che usi per il lavoro (facoltativo)</label>
        <textarea id="st-ia" rows={2} value={d.altriStrumentiIa} onChange={(e) => set("altriStrumentiIa")(e.target.value)} />
        <p className="text-xs" style={{ color: "var(--muted-mk)" }}>
          Finiscono nell'informativa che il cliente accetta con la lettera d'incarico (art. 13 L. 132/2025). Se non ne usi, lascia vuoto.
        </p>
      </div>
      <button type="submit" className="btn btn-sm btn-navy" disabled={salva.isPending}>
        {salva.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} {professionista ? "Salva" : "Invia la candidatura"}
      </button>
    </form>
  );
}

function Convenzione({ documento, impronta }: { documento: Documento; impronta: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [letta, setLetta] = useState(false);
  const firma = useMutation({
    mutationFn: () => studioApi.firmaConvenzione(impronta),
    onSuccess: () => {
      toast({ title: "Convenzione firmata" });
      queryClient.invalidateQueries({ queryKey: ["studio"] });
    },
    onError: (err) => toast({ title: "Non firmata", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });
  return (
    <div className="act-body space-y-3">
      <Scorrevole etichetta="Convenzione">
        <DocumentoTesto documento={documento} />
      </Scorrevole>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={letta} onChange={(e) => setLetta(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Ho letto la convenzione e la accetto.</span>
      </label>
      <button type="button" className="btn btn-sm btn-navy" disabled={!letta || firma.isPending} onClick={() => firma.mutate()}>
        {firma.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Firma la convenzione
      </button>
    </div>
  );
}

function Incarichi() {
  const q = useQuery({ queryKey: ["studio", "incarichi"], queryFn: studioApi.incarichi });
  const righe = q.data?.incarichi ?? [];
  if (q.isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (righe.length === 0) return <p className="text-sm" style={{ color: "var(--muted-mk)" }}>Nessun incarico per ora.</p>;
  return (
    <div style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="Incarichi">
      <table style={{ width: "100%", minWidth: 560 }} className="text-sm">
        <thead>
          <tr className="text-xs" style={{ color: "var(--muted-mk)", textAlign: "left" }}>
            <th>Impresa</th>
            <th>Anno</th>
            <th>Incarico</th>
            <th>Pratica</th>
            <th>Aggiornato</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid var(--border-mk, #e2e8f0)" }}>
              <td className="py-2">
                <Link href={`/studio/incarichi/${r.id}`} className="underline font-medium">
                  {r.azienda || "Impresa"}
                </Link>
                {r.messaggiNonLetti > 0 && (
                  <span className="chip chip-grey" style={{ marginLeft: 6 }}>
                    <MessageSquare className="h-3 w-3" style={{ marginRight: 3 }} /> {r.messaggiNonLetti}
                  </span>
                )}
              </td>
              <td>{r.anno}</td>
              <td>{r.etichetta}</td>
              <td>{r.pratica?.etichetta ?? "—"}</td>
              <td>{format(new Date(r.aggiornatoAt), "d MMM yyyy", { locale: it })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Compensi() {
  const q = useQuery({ queryKey: ["studio", "compensi"], queryFn: studioApi.compensi });
  const righe = q.data?.compensi ?? [];
  if (righe.length === 0) return <p className="text-sm" style={{ color: "var(--muted-mk)" }}>Nessun compenso maturato.</p>;
  return (
    <ul className="text-sm space-y-1">
      {righe.map((c) => (
        <li key={c.id}>
          Anno {c.anno}: {euro(c.importoCents)} — {c.stato}
          {c.fatturaNumero ? ` (fattura ${c.fatturaNumero})` : ""}
        </li>
      ))}
    </ul>
  );
}

export default function StudioPage() {
  useNoIndex();
  useDocumentTitle("Studio del professionista — PrevAI");
  const { isLoaded, isSignedIn } = useRequireAuth();
  const q = useQuery({ queryKey: ["studio", "profilo"], queryFn: studioApi.profilo, enabled: isLoaded && isSignedIn });

  if (!q.data) {
    return (
      <StudioShell>
        <div className="flex justify-center p-8">{q.error ? <p className="text-sm">{(q.error as Error).message}</p> : <Loader2 className="h-6 w-6 animate-spin" />}</div>
      </StudioShell>
    );
  }
  const r = q.data;
  const p = r.professionista;

  return (
    <StudioShell>
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-navy-500" />
            Studio
          </h1>
          <p className="sub">Per i commercialisti iscritti all'Albo che seguono imprese clienti di PrevAI.</p>
        </div>
        {p && <span className="chip chip-grey">{STATO[p.stato]}</span>}
      </div>

      {!r.twoFactorEnabled && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h2 className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Prima di tutto: verifica in due passaggi
              </h2>
              <p className="sub">Lo studio dà accesso ai conti dei clienti: senza la verifica in due passaggi sul tuo account non si apre.</p>
            </div>
          </div>
          <div className="act-body">
            <TwoFactorCard />
          </div>
        </section>
      )}

      {r.twoFactorEnabled && p && !p.operativo && p.stato !== "candidato" && (
        <div className="notice warn text-sm" style={{ marginBottom: 12 }}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Non puoi lavorare sugli incarichi finché: {p.motivi.join(" ")}</span>
        </div>
      )}
      {p?.rcGiorniAllaScadenza !== null && p?.rcGiorniAllaScadenza !== undefined && p.rcGiorniAllaScadenza >= 0 && p.rcGiorniAllaScadenza <= 30 && (
        <div className="notice warn text-sm" style={{ marginBottom: 12 }}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>La polizza RC scade fra {p.rcGiorniAllaScadenza} giorni: carica qui sotto quella rinnovata, o gli incarichi si fermano alla scadenza.</span>
        </div>
      )}

      {r.twoFactorEnabled && p?.stato === "verificato" && !p.convenzione.firmataAt && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h2>Convenzione con PrevAI</h2>
              <p className="sub">{r.convenzione ? `Compenso per pratica: ${euro(p.compensoPraticaCents ?? 0)}.` : "PrevAI deve ancora fissare il compenso per pratica: la convenzione si firma dopo."}</p>
            </div>
          </div>
          {r.convenzione && <Convenzione documento={r.convenzione.documento} impronta={r.convenzione.impronta} />}
        </section>
      )}

      {r.twoFactorEnabled && p && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h2>Incarichi</h2>
              <p className="sub">I dati di un cliente si aprono solo con l'incarico attivo, e ogni apertura è visibile al cliente.</p>
            </div>
          </div>
          <div className="act-body">
            <Incarichi />
          </div>
        </section>
      )}

      {r.twoFactorEnabled && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h2>{p ? "Profilo professionale" : "Candidati"}</h2>
              <p className="sub">
                {p ? `Verificato il ${p.verificatoAt ? format(new Date(p.verificatoAt), "d MMMM yyyy", { locale: it }) : "—"}.` : "PrevAI verifica iscrizione all'Albo, abilitazione Entratel e polizza prima di assegnarti un cliente."}
              </p>
            </div>
          </div>
          <Candidatura key={p?.id ?? "nuovo"} professionista={p} sezioni={r.sezioniAlbo} />
        </section>
      )}

      {r.twoFactorEnabled && p?.convenzione.firmataAt && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Compensi</h2>
              <p className="sub">Maturano con la ricevuta di accoglimento; li paga PrevAI su tua fattura, come da convenzione.</p>
            </div>
          </div>
          <div className="act-body">
            <Compensi />
          </div>
        </section>
      )}
    </StudioShell>
  );
}
