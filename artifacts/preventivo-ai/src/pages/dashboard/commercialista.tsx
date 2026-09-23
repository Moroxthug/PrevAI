import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, BadgeCheck, Check, Download, FileSignature, Loader2, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatCents } from "@/lib/jobs-api";
import { ErroreApiFiscale, clienteApi, type IncaricoDto, type PraticaDto, type SchedaProfessionistaDto } from "@/lib/commercialista-api";
import { Chat, Cronologia, DocumentoTesto, Scorrevole } from "@/components/commercialista/parti";

// ── A-6: il commercialista, lato impresa ─────────────────────────────────────
// Qui l'impresa chiede un commercialista per la dichiarazione, firma la lettera
// d'incarico con le due informative, consegna la chiusura d'anno, conferma la
// bozza, scrive in chat e vede ogni volta che il professionista ha aperto i
// suoi dati. La dichiarazione la trasmette il professionista, mai PrevAI, e
// mai prima della conferma (AMMINISTRAZIONE-PLAN.md §5).

const euro = formatCents;
const data = (iso: string | null) => (iso ? format(new Date(iso), "d MMMM yyyy", { locale: it }) : "—");

function useInvalida() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["commercialista"] });
}

function erroreToast(toast: ReturnType<typeof useToast>["toast"], titolo: string) {
  return (err: unknown) => toast({ title: titolo, description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" });
}

function SchedaProfessionista({ p }: { p: SchedaProfessionistaDto }) {
  return (
    <div className="flex items-start gap-3">
      <UserRound className="h-8 w-8 shrink-0" style={{ color: "var(--navy)" }} />
      <div className="text-sm">
        <div className="font-semibold" style={{ color: "var(--navy)" }}>
          {p.nome}
        </div>
        <div>{p.qualifica}</div>
        {p.studio && <div style={{ color: "var(--muted-mk)" }}>{p.studio}</div>}
        <div style={{ color: "var(--muted-mk)" }}>
          PEC {p.pec} · polizza RC {p.polizza.compagnia} n. {p.polizza.numero}, massimale {euro(p.polizza.massimaleCents)}, valida fino al {data(p.polizza.scadenza)}
        </div>
      </div>
    </div>
  );
}

function Firma({ incarico, dueFattori }: { incarico: IncaricoDto; dueFattori: boolean }) {
  const { toast } = useToast();
  const invalida = useInvalida();
  const [ia, setIa] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [letta, setLetta] = useState(false);
  const firma = useMutation({
    mutationFn: () => clienteApi.firma(incarico.id, incarico.impronta!, ia, privacy),
    onSuccess: () => {
      toast({ title: "Lettera d'incarico firmata", description: "Ora il professionista deve accettare l'incarico." });
      invalida();
    },
    onError: erroreToast(toast, "La lettera non è stata firmata"),
  });
  const d = incarico.documenti!;
  return (
    <div className="space-y-3">
      <Scorrevole etichetta="Lettera d'incarico">
        <DocumentoTesto documento={d.lettera} />
      </Scorrevole>
      <Scorrevole etichetta="Informativa sull'uso dell'intelligenza artificiale">
        <DocumentoTesto documento={d.informativaIa} />
      </Scorrevole>
      <Scorrevole etichetta="Informativa sul trattamento dei dati">
        <DocumentoTesto documento={d.informativaPrivacy} />
      </Scorrevole>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={letta} onChange={(e) => setLetta(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Ho letto la lettera d'incarico e conferisco l'incarico al professionista indicato.</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={ia} onChange={(e) => setIa(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Ho preso visione dell'informativa sull'uso dell'intelligenza artificiale (art. 13 L. 132/2025).</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Ho preso visione dell'informativa sul trattamento dei dati da parte del professionista.</span>
      </label>
      {!dueFattori && (
        <div className="notice warn text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>
            Per firmare serve la verifica in due passaggi sul tuo account.{" "}
            <Link href="/dashboard/settings?tab=security" className="underline">
              Attivala in Impostazioni → Sicurezza
            </Link>
            .
          </span>
        </div>
      )}
      <button type="button" className="btn btn-sm btn-navy" disabled={!letta || !ia || !privacy || !dueFattori || firma.isPending} onClick={() => firma.mutate()}>
        {firma.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Firma la lettera d'incarico
      </button>
      <p className="text-xs" style={{ color: "var(--muted-mk)" }}>
        Firmando registriamo data, ora, indirizzo IP e l'impronta del testo esatto che hai letto. Puoi revocare l'incarico in qualsiasi momento.
      </p>
    </div>
  );
}

function Pratica({ incarico, pratica, dueFattori }: { incarico: IncaricoDto; pratica: PraticaDto | null; dueFattori: boolean }) {
  const { toast } = useToast();
  const invalida = useInvalida();
  const [confermo, setConfermo] = useState(false);
  const consegna = useMutation({
    mutationFn: () => clienteApi.consegna(incarico.id),
    onSuccess: () => {
      toast({ title: "Pratica consegnata", description: "Il professionista riceve la chiusura d'anno da rivedere." });
      invalida();
    },
    onError: erroreToast(toast, "La pratica non è stata consegnata"),
  });
  const conferma = useMutation({
    mutationFn: () => clienteApi.conferma(incarico.id, pratica!.bozza!.impronta!),
    onSuccess: () => {
      toast({ title: "Bozza confermata", description: "Il professionista può trasmettere la dichiarazione." });
      invalida();
    },
    onError: erroreToast(toast, "La conferma non è andata a buon fine"),
  });

  const bottoneConsegna = (etichetta: string) => (
    <button type="button" className="btn btn-sm btn-navy" disabled={consegna.isPending} onClick={() => consegna.mutate()}>
      {consegna.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {etichetta}
    </button>
  );

  if (!pratica) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          Quando hai chiuso l'anno {incarico.anno} nella pagina{" "}
          <Link href="/dashboard/fisco/chiusura" className="underline">
            Chiusura d'anno
          </Link>
          , consegna la pratica: il professionista rivede quella fotografia dei numeri, non quelli che cambiano ogni giorno.
        </p>
        {bottoneConsegna("Consegna la chiusura d'anno")}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip chip-grey">{pratica.etichetta}</span>
        <span style={{ color: "var(--muted-mk)" }}>chiusura versione {pratica.chiusuraVersione}</span>
      </div>

      {pratica.differenza && (
        <div className="notice warn">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {pratica.differenza} Il professionista ha rivisto numeri che non ci sono più: riconsegna la pratica.
          </span>
        </div>
      )}

      {pratica.osservazioni && (
        <div className="notice info" style={{ alignItems: "flex-start" }}>
          <div className="grow">
            <strong>Osservazioni del professionista</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{pratica.osservazioni}</p>
          </div>
        </div>
      )}

      {pratica.azioni.includes("consegna") && (pratica.stato === "modifiche_richieste" || pratica.differenza) && (
        <div className="space-y-2">
          <p>
            Correggi i dati, richiudi l'anno in{" "}
            <Link href="/dashboard/fisco/chiusura" className="underline">
              Chiusura d'anno
            </Link>{" "}
            e poi riconsegna.
          </p>
          {bottoneConsegna("Riconsegna la pratica")}
        </div>
      )}

      {pratica.stato === "approvata" && pratica.bozza && !pratica.differenza && (
        <div className="space-y-2">
          <p>
            La bozza della dichiarazione è pronta. Leggila tutta: il professionista la trasmette solo dopo la tua conferma, e la tua conferma vale per questa
            bozza e per questi numeri.
          </p>
          <a className="btn btn-sm btn-outline-navy" href={clienteApi.urlFile(incarico.id, "bozza")} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4" /> {pratica.bozza.nome ?? "Bozza"}
          </a>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={confermo} onChange={(e) => setConfermo(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Ho letto la bozza, i dati sono corretti e autorizzo il professionista a trasmettere la dichiarazione.</span>
          </label>
          {!dueFattori && <p className="text-xs">Per confermare serve la verifica in due passaggi sul tuo account.</p>}
          <button type="button" className="btn btn-sm btn-navy" disabled={!confermo || !dueFattori || conferma.isPending} onClick={() => conferma.mutate()}>
            {conferma.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Confermo la bozza
          </button>
        </div>
      )}

      {pratica.stato === "confermata" && <p>Hai confermato il {data(pratica.confermataAt)}. Il professionista trasmetterà la dichiarazione e registrerà qui il protocollo.</p>}
      {(pratica.stato === "inviata" || pratica.stato === "conclusa") && (
        <p>
          Trasmessa il {data(pratica.inviataAt)} con protocollo <strong>{pratica.protocollo}</strong>.
        </p>
      )}
      {pratica.ricevuta && (
        <a className="btn btn-sm btn-outline-navy" href={clienteApi.urlFile(incarico.id, "ricevuta")} target="_blank" rel="noreferrer">
          <Download className="h-4 w-4" /> Ricevuta dell'Agenzia delle Entrate {pratica.esito === "scartata" ? "(scarto)" : ""}
        </a>
      )}
    </div>
  );
}

export default function CommercialistaClientePage() {
  useDocumentTitle("Commercialista — PrevAI");
  const { toast } = useToast();
  const invalida = useInvalida();
  const annoCorrente = new Date().getFullYear();
  const [anno, setAnno] = useState(annoCorrente - 1);
  const q = useQuery({ queryKey: ["commercialista", anno], queryFn: () => clienteApi.stato(anno), retry: false });
  const richiedi = useMutation({
    mutationFn: () => clienteApi.richiedi(anno),
    onSuccess: () => {
      toast({ title: "Richiesta inviata" });
      invalida();
    },
    onError: erroreToast(toast, "La richiesta non è partita"),
  });
  const revoca = useMutation({
    mutationFn: (id: string) => clienteApi.revoca(id, "Revocato dall'impresa"),
    onSuccess: () => {
      toast({ title: "Incarico revocato", description: "Il professionista non vede più i tuoi dati." });
      invalida();
    },
    onError: erroreToast(toast, "La revoca non è andata a buon fine"),
  });

  if (q.error instanceof ErroreApiFiscale && q.error.codice === "ACCOUNTANT_SERVICE_OFF") {
    return (
      <div className="card">
        <div className="act-body text-sm">
          <h1 className="text-lg font-semibold" style={{ color: "var(--navy)" }}>
            Commercialista
          </h1>
          <p style={{ marginTop: 8 }}>
            Il servizio con un commercialista iscritto all'Albo non è ancora disponibile. Nel frattempo puoi condividere la chiusura d'anno con il tuo
            commercialista dalla pagina{" "}
            <Link href="/dashboard/fisco/chiusura" className="underline">
              Chiusura d'anno
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }
  if (q.isLoading || !q.data) {
    return (
      <div className="card">
        <div className="act-body flex justify-center">{q.error ? <p className="text-sm">{(q.error as Error).message}</p> : <Loader2 className="h-5 w-5 animate-spin" />}</div>
      </div>
    );
  }

  const r = q.data;
  const i = r.incarico;
  const chiuso = i && ["rifiutato", "revocato", "rinunciato"].includes(i.stato);
  const puoRichiedere = !i || chiuso;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2">
            <UserRound className="h-7 w-7 text-navy-500" />
            Commercialista
          </h1>
          <p className="sub">
            La dichiarazione dei redditi {anno + 1} (anno d'imposta {anno}) preparata con PrevAI, rivista e trasmessa da un commercialista iscritto all'Albo.
          </p>
        </div>
        <div className="head-actions">
          <label htmlFor="comm-anno" className="sr-only">
            Anno d'imposta
          </label>
          <select id="comm-anno" value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
            {[annoCorrente - 1, annoCorrente - 2, annoCorrente - 3].map((a) => (
              <option key={a} value={a}>
                Anno d'imposta {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {r.servizio.stato === "bozza" && (
        <div className="notice info text-sm" style={{ marginBottom: 12 }}>
          <span>
            Servizio in prova: la tua impresa è fra le prime ad usarlo. Il professionista ti viene assegnato da PrevAI; il rapporto professionale, la
            responsabilità e la polizza sono suoi.
          </span>
        </div>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <h2>Incarico</h2>
            <p className="sub">{i ? i.etichetta : "Nessun incarico per questo anno."}</p>
          </div>
        </div>
        <div className="act-body space-y-4">
          {chiuso && i?.motivoChiusura && (
            <p className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4" /> {i.motivoChiusura}
            </p>
          )}
          {puoRichiedere && (
            <div className="space-y-2 text-sm">
              <p>
                Un commercialista iscritto all'Albo rivede i numeri della tua chiusura d'anno, prepara la dichiarazione, te la fa confermare e la trasmette
                all'Agenzia delle Entrate. Risponde anche alle tue domande in chat.
              </p>
              <button type="button" className="btn btn-sm btn-navy" disabled={richiedi.isPending} onClick={() => richiedi.mutate()}>
                {richiedi.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />} Chiedi un commercialista per il {anno}
              </button>
            </div>
          )}
          {i?.stato === "da_assegnare" && <p className="text-sm">Abbiamo ricevuto la richiesta il {data(i.richiestoAt)}. Ti scriviamo appena un professionista è assegnato.</p>}
          {r.professionista && i && !chiuso && <SchedaProfessionista p={r.professionista} />}
          {i?.stato === "proposto" && i.documenti && <Firma incarico={i} dueFattori={r.twoFactorEnabled} />}
          {i?.stato === "firmato_cliente" && <p className="text-sm">Hai firmato il {data(i.firmatoAt)}. Il professionista deve svolgere l'adeguata verifica e accettare l'incarico.</p>}
          {i && ["proposto", "firmato_cliente", "attivo", "da_assegnare"].includes(i.stato) && (
            <button
              type="button"
              className="btn btn-sm btn-outline-navy"
              disabled={revoca.isPending}
              onClick={() => {
                if (window.confirm("Revocare l'incarico? Il professionista non vedrà più i tuoi dati.")) revoca.mutate(i.id);
              }}
            >
              <XCircle className="h-4 w-4" /> {i.stato === "da_assegnare" ? "Annulla la richiesta" : "Revoca l'incarico"}
            </button>
          )}
        </div>
      </section>

      {i && (i.stato === "attivo" || i.stato === "concluso") && (
        <>
          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <h2>Dichiarazione</h2>
                <p className="sub">Consegna → revisione → bozza → tua conferma → trasmissione → ricevuta.</p>
              </div>
            </div>
            <div className="act-body">
              <Pratica incarico={i} pratica={r.pratica} dueFattori={r.twoFactorEnabled} />
            </div>
          </section>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <h2>Consulenza</h2>
                <p className="sub">Ti risponde il professionista, non un assistente automatico.</p>
              </div>
            </div>
            <div className="act-body">
              <Chat
                chiave={["commercialista", "messaggi", i.id]}
                io="cliente"
                nomeAltro={r.professionista?.nome ?? "Professionista"}
                carica={() => clienteApi.messaggi(i.id)}
                invia={i.stato === "attivo" ? (t) => clienteApi.scrivi(i.id, t) : null}
                nota={i.stato === "attivo" ? "Il professionista risponde di solito entro due giorni lavorativi." : "L'incarico è concluso: la chat resta in sola lettura."}
              />
            </div>
          </section>
        </>
      )}

      {r.eventi.length > 0 && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Cronologia e accessi</h2>
              <p className="sub">Ogni passo dell'incarico e ogni volta che il professionista ha aperto i tuoi dati.</p>
            </div>
          </div>
          <div className="act-body">
            <Cronologia eventi={r.eventi} />
          </div>
        </section>
      )}
    </div>
  );
}
