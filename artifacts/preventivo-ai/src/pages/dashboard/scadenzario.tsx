import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Download,
  FileText,
  Loader2,
  Paperclip,
  PiggyBank,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCents } from "@/lib/jobs-api";
import { localDay } from "@/lib/local-day";
import {
  ErroreApiFiscale,
  ETICHETTE_CATEGORIA,
  fiscaleApi,
  type ProspettoF24Dto,
  type ScadenzarioDto,
  type VoceScadenzarioDto,
} from "@/lib/fiscale-api";

// ── A-3: lo scadenzario ──────────────────────────────────────────────────────
// Un calendario solo per imposta, contributi, bollo e dichiarazione. Regole di
// questa schermata, le stesse della pagina Fisco (A-2):
//
//   1. **nessun importo senza il suo perché**: ogni scadenza apre le righe del
//      modello F24 con codice tributo o causale, e il prospetto dice da dove
//      viene ogni numero;
//   2. **niente si versa da qui**: il bottone si chiama "Segna come versata",
//      non "Paga". PrevAI prepara la delega, il versamento lo dispone
//      l'impresa dall'home banking (AMMINISTRAZIONE-PLAN.md §5);
//   3. finché le regole non sono state revisionate da un commercialista, la
//      pagina lo dice in cima e non lo nasconde mai (D6).

function euro(cents: number): string {
  return formatCents(cents);
}

function dataLunga(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), "PPP", { locale: it });
}

function meseDi(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), "LLLL yyyy", { locale: it });
}

/** Il semaforo della riga: quanto manca, o quanto è passato. */
function Quando({ voce }: { voce: VoceScadenzarioDto }) {
  if (voce.stato === "versata") {
    return (
      <span className="chip chip-green">
        <Check className="h-3 w-3" style={{ marginRight: 4 }} /> Versata
        {voce.versataAt ? ` il ${format(new Date(voce.versataAt), "d MMM yyyy", { locale: it })}` : ""}
      </span>
    );
  }
  if (voce.stato === "non_dovuta") return <span className="chip chip-grey">Non dovuta</span>;
  const g = voce.giorniAllaScadenza;
  if (g < 0) return <span className="chip chip-red">Scaduta da {Math.abs(g)} {Math.abs(g) === 1 ? "giorno" : "giorni"}</span>;
  if (g === 0) return <span className="chip chip-red">Scade oggi</span>;
  if (g <= 7) return <span className="chip chip-yellow">Fra {g} {g === 1 ? "giorno" : "giorni"}</span>;
  if (g <= 30) return <span className="chip chip-teal">Fra {g} giorni</span>;
  return <span className="chip chip-grey">Fra {g} giorni</span>;
}

/** Le righe del modello, aperte sotto la scadenza: è il "perché" di questa pagina. */
function RigheF24({ voce }: { voce: VoceScadenzarioDto }) {
  if (voce.scadenza.righe.length === 0) return null;
  return (
    <table className="text-xs" style={{ marginTop: 8, width: "100%" }}>
      <tbody>
        {voce.scadenza.righe.map((r, i) => (
          <tr key={`${r.sezione}-${r.codiceTributo ?? r.causale ?? i}`}>
            <td style={{ paddingRight: 12, color: "var(--muted-mk)" }}>
              {r.descrizione}
              <br />
              <span className="font-mono">
                {r.sezione === "erario" ? `Erario · codice tributo ${r.codiceTributo}` : `INPS · causale ${r.causale}`}
                {r.periodoDa ? ` · ${r.periodoDa}–${r.periodoA}` : ""}
              </span>
            </td>
            <td className="font-mono" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              {euro(r.importoCents)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Prospetto F24 ────────────────────────────────────────────────────────────

function ProspettoDialog({ chiave, anno, aperto, onChiudi }: { chiave: string; anno: number; aperto: boolean; onChiudi: () => void }) {
  const query = useQuery({
    queryKey: ["fiscale", "f24", anno, chiave],
    queryFn: () => fiscaleApi.f24(chiave, anno),
    enabled: aperto,
  });
  const prospetto: ProspettoF24Dto | undefined = query.data?.prospetto;

  return (
    <Dialog open={aperto} onOpenChange={(v) => !v && onChiudi()}>
      <DialogContent className="xl">
        <DialogHeader>
          <DialogTitle>Prospetto per il modello F24</DialogTitle>
          <DialogDescription>{prospetto?.titolo ?? "…"}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {query.isLoading && (
            <div className="flex justify-center" style={{ padding: 24 }}>
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {prospetto && (
            <>
              {prospetto.avvertenze.map((a) => (
                <div key={a} className="notice warn" style={{ alignItems: "flex-start", marginBottom: 12 }}>
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <div className="grow text-sm">{a}</div>
                </div>
              ))}

              <h3 className="text-xs" style={{ color: "var(--muted-mk)", marginBottom: 6 }}>
                CONTRIBUENTE
              </h3>
              <table className="text-sm" style={{ width: "100%", marginBottom: 16 }}>
                <tbody>
                  {prospetto.contribuente.map((c) => (
                    <tr key={c.etichetta}>
                      <td style={{ color: "var(--muted-mk)", paddingRight: 12 }}>{c.etichetta}</td>
                      <td className="font-mono" style={{ color: c.mancante ? "var(--red)" : undefined }}>
                        {c.mancante ? "— da completare —" : c.valore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {prospetto.sezioni.map((s) => (
                <div key={s.sezione} style={{ marginBottom: 16 }}>
                  <h3 className="text-xs" style={{ color: "var(--muted-mk)", marginBottom: 6 }}>
                    {s.titolo.toUpperCase()}
                  </h3>
                  <div style={{ overflowX: "auto" }}>
                    <table className="text-xs" style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          {s.colonne.map((c) => (
                            <th key={c} style={{ textAlign: "left", color: "var(--muted-mk)", paddingRight: 10, whiteSpace: "nowrap" }}>
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.righe.map((riga, i) => (
                          <tr key={i}>
                            {riga.map((valore, j) => (
                              <td key={j} className={j === riga.length - 2 ? "font-mono" : ""} style={{ paddingRight: 10, paddingTop: 4 }}>
                                {valore || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div className="notice info" style={{ alignItems: "center" }}>
                <div className="grow">Saldo finale</div>
                <strong style={{ fontSize: "1.2rem" }}>{euro(prospetto.totaleCents)}</strong>
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {prospetto && (
            <a className="btn btn-sm btn-navy" href={fiscaleApi.urlF24Pdf(chiave, anno)} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" /> Scarica il prospetto
            </a>
          )}
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={onChiudi}>
            Chiudi
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Segna come versata ───────────────────────────────────────────────────────

function VersataDialog({ voce, anno, aperto, onChiudi }: { voce: VoceScadenzarioDto; anno: number; aperto: boolean; onChiudi: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [data, setData] = useState(localDay());
  const [importo, setImporto] = useState((voce.scadenza.importoCents / 100).toFixed(2));
  const [riferimento, setRiferimento] = useState("");

  const salva = useMutation({
    mutationFn: () =>
      fiscaleApi.segnaVersata(voce.scadenza.id, {
        anno,
        data,
        importoCents: Math.round((Number(importo.replace(",", ".")) || 0) * 100),
        riferimento: riferimento.trim() || undefined,
      }),
    onSuccess: (esito) => {
      toast({
        title: "Versamento registrato",
        description:
          esito.versamenti > 1
            ? `${esito.versamenti} righe registrate: questo F24 contiene più tributi, e il calcolo li conta separatamente.`
            : "La scadenza è chiusa. Puoi allegare la quietanza quando ce l'hai.",
      });
      queryClient.invalidateQueries({ queryKey: ["fiscale"] });
      onChiudi();
    },
    onError: (err) => toast({ title: "Non è stato registrato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });

  const diverso = Math.abs(Math.round((Number(importo.replace(",", ".")) || 0) * 100) - voce.scadenza.importoCents) > 0;

  return (
    <Dialog open={aperto} onOpenChange={(v) => !v && onChiudi()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Segna come versata</DialogTitle>
          <DialogDescription>{voce.scadenza.etichetta}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="form-grid" style={{ padding: 0 }}>
            <div className="field">
              <label htmlFor="versata-data">Data del versamento</label>
              <input id="versata-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="versata-importo">Importo versato</label>
              <input id="versata-importo" inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="versata-rif">Riferimento (CRO, protocollo telematico)</label>
              <input id="versata-rif" value={riferimento} onChange={(e) => setRiferimento(e.target.value)} placeholder="facoltativo" />
            </div>
          </div>
          {diverso && (
            <div className="notice info" style={{ alignItems: "flex-start", marginTop: 12 }}>
              <div className="grow text-sm">
                Stai registrando un importo diverso da quello calcolato ({euro(voce.scadenza.importoCents)}). Va benissimo: si registra
                quello che hai versato davvero, e la differenza resta visibile qui.
              </div>
            </div>
          )}
          <p className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 12 }}>
            Registrare non significa pagare: PrevAI non dispone versamenti. Questo serve a chiudere la scadenza e a far entrare i
            contributi versati nel calcolo dell'imposta, dove sono deducibili per cassa.
          </p>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn btn-sm btn-navy" onClick={() => salva.mutate()} disabled={salva.isPending}>
            {salva.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Registra
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Quietanza ────────────────────────────────────────────────────────────────

function Quietanza({ voce, anno }: { voce: VoceScadenzarioDto; anno: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);

  const carica = useMutation({
    mutationFn: (file: File) => fiscaleApi.caricaQuietanza(voce.scadenza.id, anno, file),
    onSuccess: () => {
      toast({ title: "Quietanza allegata" });
      queryClient.invalidateQueries({ queryKey: ["fiscale"] });
    },
    onError: (err) => toast({ title: "Non è stata allegata", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });

  const rimuovi = useMutation({
    mutationFn: () => fiscaleApi.rimuoviQuietanza(voce.scadenza.id, anno),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fiscale"] }),
  });

  if (voce.quietanza) {
    return (
      <span className="flex items-center gap-2">
        <a className="text-link text-xs" href={fiscaleApi.urlQuietanza(voce.scadenza.id, anno)} target="_blank" rel="noreferrer">
          <Paperclip className="h-3.5 w-3.5 inline" /> {voce.quietanza.nome || "Quietanza"}
        </a>
        <button type="button" className="text-link text-xs" onClick={() => rimuovi.mutate()} aria-label="Rimuovi la quietanza">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) carica.mutate(file);
          e.target.value = "";
        }}
      />
      <button type="button" className="text-link text-xs" onClick={() => input.current?.click()} disabled={carica.isPending}>
        {carica.isPending ? <Loader2 className="h-3.5 w-3.5 inline animate-spin" /> : <Upload className="h-3.5 w-3.5 inline" />} Allega la quietanza
      </button>
    </>
  );
}

// ── Riga dello scadenzario ───────────────────────────────────────────────────

function Riga({ voce, anno }: { voce: VoceScadenzarioDto; anno: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dettagli, setDettagli] = useState(false);
  const [f24Aperto, setF24Aperto] = useState(false);
  const [versataAperta, setVersataAperta] = useState(false);

  const riapri = useMutation({
    mutationFn: () => fiscaleApi.riapriScadenza(voce.scadenza.id, anno),
    onSuccess: () => {
      toast({ title: "Scadenza riaperta", description: "I versamenti che erano nati da questa scadenza sono stati tolti dal calcolo." });
      queryClient.invalidateQueries({ queryKey: ["fiscale"] });
    },
  });

  const versabile = voce.scadenza.righe.length > 0;
  const differenza = voce.stato === "versata" && voce.versatoCents > 0 && voce.versatoCents !== voce.scadenza.importoCents;

  return (
    <div className="item-row">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0" style={{ flex: "1 1 280px" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{voce.scadenza.etichetta}</span>
            <Quando voce={voce} />
          </div>
          <div className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 2 }}>
            {dataLunga(voce.scadenza.data)} · {ETICHETTE_CATEGORIA[voce.scadenza.categoria]}
          </div>
          {dettagli && (
            <>
              <p className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 6 }}>
                {voce.scadenza.descrizione}
              </p>
              <RigheF24 voce={voce} />
              {voce.regoleNonRevisionate.length > 0 && (
                <p className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 6 }}>
                  Regole non ancora confermate da un commercialista: {voce.regoleNonRevisionate.join(", ")}.
                </p>
              )}
            </>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          {voce.scadenza.importoCents > 0 && <strong>{euro(voce.scadenza.importoCents)}</strong>}
          {differenza && (
            <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
              versati {euro(voce.versatoCents)}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 8 }}>
        <button type="button" className="text-link text-xs" onClick={() => setDettagli(!dettagli)} aria-expanded={dettagli}>
          {dettagli ? "Nascondi il dettaglio" : "Che cos'è e come si compila"}
        </button>
        {versabile && (
          <button type="button" className="text-link text-xs" onClick={() => setF24Aperto(true)}>
            <FileText className="h-3.5 w-3.5 inline" /> Prospetto F24
          </button>
        )}
        {versabile && voce.stato !== "versata" && (
          <button type="button" className="text-link text-xs" onClick={() => setVersataAperta(true)}>
            <Check className="h-3.5 w-3.5 inline" /> Segna come versata
          </button>
        )}
        {voce.stato === "versata" && (
          <>
            <Quietanza voce={voce} anno={anno} />
            <button type="button" className="text-link text-xs" onClick={() => riapri.mutate()} disabled={riapri.isPending}>
              <RotateCcw className="h-3.5 w-3.5 inline" /> Riapri
            </button>
          </>
        )}
      </div>

      {f24Aperto && <ProspettoDialog chiave={voce.scadenza.id} anno={anno} aperto={f24Aperto} onChiudi={() => setF24Aperto(false)} />}
      {versataAperta && <VersataDialog voce={voce} anno={anno} aperto={versataAperta} onChiudi={() => setVersataAperta(false)} />}
    </div>
  );
}

// ── Dati INPS e promemoria ───────────────────────────────────────────────────

const GIORNI_SCELTA = [30, 15, 7, 3, 1];

function Impostazioni({ scadenzario }: { scadenzario: ScadenzarioDto }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profilo = useQuery({ queryKey: ["fiscale", "profilo"], queryFn: fiscaleApi.profilo });
  const [matricola, setMatricola] = useState<string | null>(null);
  const [sede, setSede] = useState<string | null>(null);
  const [telefono, setTelefono] = useState<string | null>(null);

  const p = profilo.data?.profilo;
  const serveInps = scadenzario.voci.some((v) => v.scadenza.righe.some((r) => r.sezione === "inps"));
  const mancaInps = serveInps && (!p?.matricolaInps || !p?.sedeInps);

  const salva = useMutation({
    mutationFn: (patch: Parameters<typeof fiscaleApi.aggiornaProfilo>[0]) => fiscaleApi.aggiornaProfilo(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscale"] });
      setMatricola(null);
      setSede(null);
      setTelefono(null);
    },
    onError: (err) => toast({ title: "Non è stato salvato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });

  if (!p) return null;
  const giorni = scadenzario.promemoria.giorni;

  return (
    <>
      {serveInps && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <div>
              <h2>Dati INPS per il modello F24</h2>
              <p className="sub">
                La sezione INPS del modello vuole il codice della sede e la matricola d'azienda. Sono sul tuo estratto conto
                contributivo: PrevAI non può dedurli da nient'altro, e senza di essi il prospetto resta con due caselle vuote.
              </p>
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="sede-inps">Codice sede INPS</label>
              <input
                id="sede-inps"
                value={sede ?? p.sedeInps}
                onChange={(e) => setSede(e.target.value)}
                onBlur={() => sede !== null && sede !== p.sedeInps && salva.mutate({ sedeInps: sede })}
                placeholder="quattro cifre"
                inputMode="numeric"
              />
            </div>
            <div className="field">
              <label htmlFor="matricola-inps">Matricola INPS</label>
              <input
                id="matricola-inps"
                value={matricola ?? p.matricolaInps}
                onChange={(e) => setMatricola(e.target.value)}
                onBlur={() => matricola !== null && matricola !== p.matricolaInps && salva.mutate({ matricolaInps: matricola })}
              />
            </div>
          </div>
          {mancaInps && (
            <div className="notice warn" style={{ alignItems: "flex-start", margin: "0 22px 16px" }}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div className="grow text-sm">
                Finché mancano, il prospetto F24 dei contributi esce incompleto: le caselle vuote sono segnate, ma la delega non è
                compilabile così com'è.
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h2>Promemoria</h2>
            <p className="sub">La notifica in PrevAI arriva sempre. Email e WhatsApp sono in più, e si spengono da qui.</p>
          </div>
        </div>
        <div className="act-body">
          <div className="text-sm" style={{ marginBottom: 10 }}>Quanti giorni prima avvisarti</div>
          <div className="pills" style={{ marginBottom: 16 }}>
            {GIORNI_SCELTA.map((g) => {
              const attivo = giorni.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  className={`pill${attivo ? " on" : ""}`}
                  aria-pressed={attivo}
                  onClick={() => {
                    const nuovi = attivo ? giorni.filter((x) => x !== g) : [...giorni, g];
                    salva.mutate({ promemoriaGiorni: nuovi.length > 0 ? nuovi : [15, 3] });
                  }}
                >
                  {g} {g === 1 ? "giorno" : "giorni"}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-sm" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={p.promemoriaEmail} onChange={(e) => salva.mutate({ promemoriaEmail: e.target.checked })} />
            Mandami un'email per ogni scadenza
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.promemoriaWhatsapp}
              disabled={!scadenzario.promemoria.whatsappDisponibile}
              onChange={(e) => salva.mutate({ promemoriaWhatsapp: e.target.checked })}
            />
            Mandami un messaggio WhatsApp
          </label>
          {!scadenzario.promemoria.whatsappDisponibile ? (
            <p className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 6 }}>
              Il canale WhatsApp è pronto ma non ancora attivo: per i messaggi che partono da noi Meta accetta solo modelli
              approvati, e il modello per le scadenze fiscali deve ancora essere approvato. Appena lo è, questa casella si
              accende senza altre modifiche.
            </p>
          ) : (
            <div className="field" style={{ maxWidth: 320, marginTop: 10 }}>
              <label htmlFor="promemoria-telefono">Numero WhatsApp</label>
              <input
                id="promemoria-telefono"
                value={telefono ?? p.promemoriaTelefono}
                onChange={(e) => setTelefono(e.target.value)}
                onBlur={() => telefono !== null && telefono !== p.promemoriaTelefono && salva.mutate({ promemoriaTelefono: telefono })}
                placeholder="+39…"
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// ── Pagina ───────────────────────────────────────────────────────────────────

export default function ScadenzarioPage() {
  const annoCorrente = new Date().getFullYear();
  const [anno, setAnno] = useState(annoCorrente);
  const scadenzario = useQuery({ queryKey: ["fiscale", "scadenzario", anno], queryFn: () => fiscaleApi.scadenzario(anno) });

  const perMese = useMemo(() => {
    const gruppi = new Map<string, VoceScadenzarioDto[]>();
    for (const voce of scadenzario.data?.voci ?? []) {
      const chiave = voce.scadenza.data.slice(0, 7);
      if (!gruppi.has(chiave)) gruppi.set(chiave, []);
      gruppi.get(chiave)!.push(voce);
    }
    return [...gruppi.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [scadenzario.data]);

  if (scadenzario.error instanceof ErroreApiFiscale && scadenzario.error.codice === "FISCAL_MODULE_OFF") {
    return (
      <div className="card">
        <div className="act-body text-sm">Il calcolo fiscale non è attivo su questo account.</div>
      </div>
    );
  }

  if (scadenzario.isLoading || !scadenzario.data) {
    return (
      <div className="card">
        <div className="act-body flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  const s = scadenzario.data;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2">
            <CalendarClock className="h-7 w-7 text-navy-500" />
            Scadenzario
          </h1>
          <p className="sub">Imposta, contributi, bollo e dichiarazione in un calendario solo, con l'F24 già compilato da ricopiare.</p>
        </div>
        <div className="head-actions">
          <select aria-label="Anno d'imposta" value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
            {[annoCorrente, annoCorrente - 1, annoCorrente - 2].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <Link href="/dashboard/fisco" className="btn btn-sm btn-outline-navy">
            <PiggyBank className="h-4 w-4" /> Fisco
          </Link>
        </div>
      </div>

      {!s.revisionato && (
        <div className="notice warn" style={{ alignItems: "flex-start", marginTop: 16 }}>
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="grow text-sm">
            Gli importi e i codici tributo di questa pagina non sono ancora stati verificati da un commercialista. Usali come
            promemoria e come traccia per compilare l'F24, non come conferma di quanto devi versare.
          </div>
        </div>
      )}

      <div className="stat-grid" style={{ marginTop: 16, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="card stat-card">
          <div className="lbl">Ancora da versare nell'anno {anno}</div>
          <div className="val">{euro(s.totaleApertoCents)}</div>
        </div>
        <div className="card stat-card">
          <div className="lbl">Prossima scadenza</div>
          <div className="val" style={{ fontSize: "1.2rem" }}>
            {s.prossima ? dataLunga(s.prossima.scadenza.data) : "Nessuna"}
          </div>
          {s.prossima && <div className="delta flat">{s.prossima.scadenza.etichetta}</div>}
        </div>
        <div className="card stat-card">
          <div className="lbl">Scaduto e non registrato</div>
          <div className="val" style={{ color: s.scaduteCents > 0 ? "var(--red)" : undefined }}>
            {euro(s.scaduteCents)}
          </div>
        </div>
      </div>

      {perMese.length === 0 ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="act-body text-sm">
            Nessuna scadenza per il {anno}. Se hai appena acceso il modulo, completa prima l'onboarding fiscale nella pagina Fisco:
            senza regime, ATECO e cassa previdenziale non si sa che cosa scade e quando.
          </div>
        </section>
      ) : (
        perMese.map(([mese, voci]) => (
          <section key={mese} className="card" style={{ marginTop: 16 }}>
            <div className="card-head">
              <div>
                <h2 style={{ textTransform: "capitalize" }}>{meseDi(`${mese}-01`)}</h2>
              </div>
            </div>
            <div>
              {voci.map((voce) => (
                <Riga key={voce.scadenza.id} voce={voce} anno={anno} />
              ))}
            </div>
          </section>
        ))
      )}

      <Impostazioni scadenzario={s} />

      <div className="notice info" style={{ alignItems: "flex-start", marginTop: 16 }}>
        <div className="grow text-sm">{s.avviso.testo}</div>
      </div>
    </div>
  );
}
