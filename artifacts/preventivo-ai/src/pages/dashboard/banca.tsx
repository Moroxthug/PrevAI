import { useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { BookOpen, CalendarClock, Check, Landmark, Link2, Loader2, Trash2, Undo2, Upload, Wand2 } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCents, jobsApi } from "@/lib/jobs-api";
import {
  ErroreApiFiscale,
  ETICHETTE_COSTO,
  primaNotaApi,
  type AzioneBanca,
  type BancaDto,
  type CategoriaCosto,
  type CategoriaMovimento,
  type EsitoImportDto,
  type MovimentoBancaDto,
  type StatoMovimentoBanca,
  type SuggerimentoDto,
} from "@/lib/fiscale-api";

// ── A-4: estratto conto ──────────────────────────────────────────────────────
// Il file della banca non diventa una seconda contabilità: ogni movimento si
// riconduce a qualcosa che PrevAI già sa (un incasso, un costo, un F24), o
// diventa una riga nelle tabelle di sempre, o si ignora. Nessun abbinamento
// parte da solo, tranne "Abbina i sicuri", che collega solo ciò che è già
// registrato con lo stesso importo — e lo dice prima di farlo.

const euro = formatCents;

const ETICHETTE_ABBINAMENTO: Record<string, string> = {
  incasso: "un incasso di fattura",
  costo: "un costo",
  versamento: "un versamento F24",
  movimento: "un movimento di prima nota",
};

const CATEGORIE_USCITA: { id: CategoriaMovimento; etichetta: string }[] = [
  { id: "commissioni_bancarie", etichetta: "Commissioni bancarie" },
  { id: "spese_generali", etichetta: "Spese generali" },
  { id: "affitto_utenze", etichetta: "Affitto e utenze" },
  { id: "veicoli_carburante", etichetta: "Veicoli e carburante" },
  { id: "assicurazioni", etichetta: "Assicurazioni" },
  { id: "altre_imposte", etichetta: "Altre imposte e tasse" },
  { id: "prelievo_titolare", etichetta: "Prelievo del titolare" },
  { id: "giroconto", etichetta: "Giroconto fra conti propri" },
  { id: "altro", etichetta: "Altro" },
];

const CATEGORIE_ENTRATA: { id: CategoriaMovimento; etichetta: string }[] = [
  { id: "altri_ricavi", etichetta: "Altri ricavi" },
  { id: "apporto_titolare", etichetta: "Apporto del titolare" },
  { id: "giroconto", etichetta: "Giroconto fra conti propri" },
  { id: "altro", etichetta: "Altro" },
];

function useAzione(anno: number) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, azione, body }: { id: string; azione: AzioneBanca; body?: unknown }) => primaNotaApi.azione(id, azione, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banca", anno] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
    },
    onError: (err) => toast({ title: "Non è stato fatto", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });
}

// ── Caricamento ──────────────────────────────────────────────────────────────

function Caricamento({ anno }: { anno: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [conto, setConto] = useState("");
  const [esito, setEsito] = useState<EsitoImportDto | null>(null);

  const carica = useMutation({
    mutationFn: (file: File) => primaNotaApi.importa(file, conto),
    onSuccess: (r) => {
      setEsito(r);
      queryClient.invalidateQueries({ queryKey: ["banca", anno] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      if (input.current) input.current.value = "";
    },
    onError: (err) => toast({ title: "Il file non è stato letto", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2>Carica l'estratto conto</h2>
          <p className="sub">
            Il CSV o l'OFX che scarichi dall'home banking. Ricaricare lo stesso periodo non raddoppia nulla: i movimenti già visti si riconoscono.
          </p>
        </div>
      </div>
      <div className="act-body">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="estratto-conto">Conto (facoltativo)</label>
            <input id="estratto-conto" value={conto} onChange={(e) => setConto(e.target.value)} placeholder="es. Conto aziendale" />
          </div>
          <input
            ref={input}
            type="file"
            accept=".csv,.txt,.ofx,.qfx,text/csv"
            aria-label="File dell'estratto conto"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) carica.mutate(f);
            }}
          />
          <button type="button" className="btn btn-sm btn-navy" disabled={carica.isPending} onClick={() => input.current?.click()}>
            {carica.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Scegli il file
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 8 }}>
          Se la banca ti dà solo Excel, aprilo e salvalo come CSV. Servono almeno una colonna con la data e una con l'importo (o Dare e Avere).
        </p>

        {esito && (
          <div className="notice info" style={{ alignItems: "flex-start", marginTop: 12 }}>
            <div className="grow text-sm">
              <strong>{esito.nuove}</strong> movimenti nuovi
              {esito.duplicate > 0 && `, ${esito.duplicate} già presenti e saltati`}
              {esito.periodo && ` — dal ${format(new Date(`${esito.periodo.da}T12:00:00`), "d MMM yyyy", { locale: it })} al ${format(new Date(`${esito.periodo.a}T12:00:00`), "d MMM yyyy", { locale: it })}`}.
              {esito.giaCaricato && " Questo file era già stato caricato."}
              <div className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 4 }}>
                Letto come {esito.formato.toUpperCase()}: {Object.entries(esito.colonne).map(([col, campo]) => `«${col}» → ${campo}`).join(", ")}
              </div>
              {esito.scartate.length > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary className="text-xs">{esito.scartate.length} righe non lette, e perché</summary>
                  <ul className="text-xs" style={{ marginTop: 4 }}>
                    {esito.scartate.slice(0, 20).map((s) => (
                      <li key={s.riga}>
                        Riga {s.riga}: {s.motivo} <span style={{ color: "var(--muted-mk)" }}>{s.testo}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Registra (costo o movimento) ─────────────────────────────────────────────

function RegistraDialog({
  movimento,
  anno,
  iniziale,
  aperto,
  onChiudi,
}: {
  movimento: MovimentoBancaDto;
  anno: number;
  iniziale: { tipo: "costo"; categoria: CategoriaCosto } | { tipo: "movimento"; categoria: CategoriaMovimento };
  aperto: boolean;
  onChiudi: () => void;
}) {
  const uscita = movimento.importoCents < 0;
  const [tipo, setTipo] = useState<"costo" | "movimento">(uscita ? iniziale.tipo : "movimento");
  const [categoriaCosto, setCategoriaCosto] = useState<CategoriaCosto>(iniziale.tipo === "costo" ? iniziale.categoria : "materials");
  const [categoriaMov, setCategoriaMov] = useState<CategoriaMovimento>(iniziale.tipo === "movimento" ? iniziale.categoria : uscita ? "spese_generali" : "altri_ricavi");
  const [cantiere, setCantiere] = useState("");
  const [descrizione, setDescrizione] = useState(movimento.descrizione);
  const cantieri = useQuery({ queryKey: ["jobs", "list"], queryFn: jobsApi.list, enabled: aperto && tipo === "costo" });
  const azione = useAzione(anno);

  const conferma = () =>
    azione.mutate(
      tipo === "costo"
        ? { id: movimento.id, azione: "costo", body: { categoria: categoriaCosto, projectId: cantiere || null, descrizione } }
        : { id: movimento.id, azione: "movimento", body: { categoria: categoriaMov, descrizione } },
      { onSuccess: onChiudi },
    );

  return (
    <Dialog open={aperto} onOpenChange={(v) => !v && onChiudi()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registra in prima nota</DialogTitle>
          <DialogDescription>
            {euro(Math.abs(movimento.importoCents))} del {format(new Date(`${movimento.data}T12:00:00`), "d MMM yyyy", { locale: it })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {uscita && (
            <div className="pills" role="radiogroup" aria-label="Che cos'è" style={{ marginBottom: 12 }}>
              {(
                [
                  ["costo", "Un costo dell'attività"],
                  ["movimento", "Un altro movimento"],
                ] as const
              ).map(([id, etichetta]) => (
                <button key={id} type="button" role="radio" aria-checked={tipo === id} className={`pill${tipo === id ? " on" : ""}`} onClick={() => setTipo(id)}>
                  {etichetta}
                </button>
              ))}
            </div>
          )}
          <div className="form-grid" style={{ padding: 0 }}>
            {tipo === "costo" ? (
              <>
                <div className="field">
                  <label htmlFor="reg-cat-costo">Categoria</label>
                  <select id="reg-cat-costo" value={categoriaCosto} onChange={(e) => setCategoriaCosto(e.target.value as CategoriaCosto)}>
                    {(Object.keys(ETICHETTE_COSTO) as CategoriaCosto[]).map((c) => (
                      <option key={c} value={c}>
                        {ETICHETTE_COSTO[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="reg-cantiere">Cantiere</label>
                  <select id="reg-cantiere" value={cantiere} onChange={(e) => setCantiere(e.target.value)}>
                    <option value="">Nessuno (spesa generale)</option>
                    {(cantieri.data?.items ?? []).map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="field full">
                <label htmlFor="reg-cat-mov">Categoria</label>
                <select id="reg-cat-mov" value={categoriaMov} onChange={(e) => setCategoriaMov(e.target.value as CategoriaMovimento)}>
                  {(uscita ? CATEGORIE_USCITA : CATEGORIE_ENTRATA).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.etichetta}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field full">
              <label htmlFor="reg-descrizione">Descrizione</label>
              <input id="reg-descrizione" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn btn-sm btn-navy" disabled={azione.isPending} onClick={conferma}>
            {azione.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Registra
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Una riga ─────────────────────────────────────────────────────────────────

function Suggerimento({ s, movimento, anno, onRegistra }: { s: SuggerimentoDto; movimento: MovimentoBancaDto; anno: number; onRegistra: (i: Parameters<typeof RegistraDialog>[0]["iniziale"]) => void }) {
  const azione = useAzione(anno);
  const alta = "certezza" in s && s.certezza === "alta";
  const classe = `btn btn-sm ${alta ? "btn-navy" : "btn-outline-navy"}`;
  switch (s.azione) {
    case "abbina":
      return (
        <button type="button" className={classe} disabled={azione.isPending} onClick={() => azione.mutate({ id: movimento.id, azione: "abbina", body: { tipo: s.tipo, id: s.id } })}>
          <Link2 className="h-4 w-4" /> {s.etichetta}
        </button>
      );
    case "registra_incasso":
      return (
        <button type="button" className={classe} disabled={azione.isPending} onClick={() => azione.mutate({ id: movimento.id, azione: "incasso", body: { invoiceId: s.invoiceId } })}>
          <Check className="h-4 w-4" /> {s.etichetta}
        </button>
      );
    case "registra_costo":
      return (
        <button type="button" className={classe} onClick={() => onRegistra({ tipo: "costo", categoria: s.categoria })}>
          {s.etichetta}…
        </button>
      );
    case "registra_movimento":
      return (
        <button type="button" className={classe} onClick={() => onRegistra({ tipo: "movimento", categoria: s.categoria })}>
          {s.etichetta}…
        </button>
      );
    case "scadenzario":
      return (
        <Link href="/dashboard/fisco/scadenzario" className="btn btn-sm btn-outline-navy">
          <CalendarClock className="h-4 w-4" /> {s.etichetta}
        </Link>
      );
  }
}

function Riga({ movimento, anno }: { movimento: MovimentoBancaDto; anno: number }) {
  const azione = useAzione(anno);
  const [registra, setRegistra] = useState<Parameters<typeof RegistraDialog>[0]["iniziale"] | null>(null);
  const entrata = movimento.importoCents > 0;

  return (
    <div className="item-row" style={{ display: "block" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0" style={{ flex: "1 1 280px" }}>
          <div className="text-sm font-medium" style={{ wordBreak: "break-word" }}>
            {movimento.descrizione || "Movimento senza descrizione"}
          </div>
          <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
            {format(new Date(`${movimento.data}T12:00:00`), "d MMM yyyy", { locale: it })}
            {movimento.controparte && ` · ${movimento.controparte}`}
            {movimento.riferimento && ` · rif. ${movimento.riferimento}`}
          </div>
        </div>
        <div className="font-mono text-sm" style={{ whiteSpace: "nowrap", color: entrata ? "var(--green)" : undefined, fontWeight: 600 }}>
          {entrata ? "+" : "−"} {euro(Math.abs(movimento.importoCents))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center" style={{ marginTop: 8 }}>
        {movimento.stato === "da_abbinare" && (
          <>
            {movimento.suggerimenti.map((s, i) => (
              <Suggerimento key={i} s={s} movimento={movimento} anno={anno} onRegistra={setRegistra} />
            ))}
            {!movimento.suggerimenti.some((s) => s.azione === "registra_costo" || s.azione === "registra_movimento") && (
              <button
                type="button"
                className="btn btn-sm btn-outline-navy"
                onClick={() => setRegistra(entrata ? { tipo: "movimento", categoria: "altri_ricavi" } : { tipo: "costo", categoria: "materials" })}
              >
                Registra…
              </button>
            )}
            <button type="button" className="text-link text-xs" disabled={azione.isPending} onClick={() => azione.mutate({ id: movimento.id, azione: "ignora" })}>
              Ignora
            </button>
          </>
        )}
        {movimento.stato === "abbinato" && (
          <>
            <span className="chip chip-green">
              <Check className="h-3 w-3" style={{ marginRight: 4 }} /> Abbinato a {ETICHETTE_ABBINAMENTO[movimento.abbinamento?.tipo ?? ""] ?? "una riga"}
            </span>
            <button type="button" className="text-link text-xs" disabled={azione.isPending} onClick={() => azione.mutate({ id: movimento.id, azione: "scollega" })}>
              <Undo2 className="h-3.5 w-3.5" /> Scollega
            </button>
          </>
        )}
        {movimento.stato === "ignorato" && (
          <>
            <span className="chip chip-grey">Ignorato</span>
            <button type="button" className="text-link text-xs" disabled={azione.isPending} onClick={() => azione.mutate({ id: movimento.id, azione: "scollega" })}>
              <Undo2 className="h-3.5 w-3.5" /> Ripristina
            </button>
          </>
        )}
      </div>

      {registra && <RegistraDialog movimento={movimento} anno={anno} iniziale={registra} aperto onChiudi={() => setRegistra(null)} />}
    </div>
  );
}

// ── Pagina ───────────────────────────────────────────────────────────────────

export default function BancaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const annoCorrente = new Date().getFullYear();
  const [anno, setAnno] = useState(annoCorrente);
  const [stato, setStato] = useState<StatoMovimentoBanca | "tutti">("da_abbinare");
  const banca = useQuery({ queryKey: ["banca", anno, stato], queryFn: () => primaNotaApi.banca(anno, stato === "tutti" ? undefined : stato) });

  const sicuri = useMutation({
    mutationFn: () => primaNotaApi.abbinaSicuri(anno),
    onSuccess: (r) => {
      toast({ title: r.abbinati === 0 ? "Nessun abbinamento sicuro" : `${r.abbinati} movimenti abbinati`, description: "Solo a righe già registrate con lo stesso importo e una data vicina." });
      queryClient.invalidateQueries({ queryKey: ["banca", anno] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
    },
  });
  const togli = useMutation({
    mutationFn: (id: string) => primaNotaApi.eliminaImport(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["banca", anno] }),
    onError: (err) => toast({ title: "Non è stato tolto", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });

  if (banca.error instanceof ErroreApiFiscale && banca.error.codice === "FISCAL_MODULE_OFF") {
    return (
      <div className="card">
        <div className="act-body text-sm">Il modulo Amministrazione non è attivo su questo account.</div>
      </div>
    );
  }

  const b: BancaDto | undefined = banca.data;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2">
            <Landmark className="h-7 w-7 text-navy-500" />
            Estratto conto
          </h1>
          <p className="sub">Controlla che ogni movimento del conto sia in prima nota: un incasso, un costo, un F24, o qualcosa da ignorare.</p>
        </div>
        <div className="head-actions">
          <select aria-label="Anno" value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
            {[annoCorrente, annoCorrente - 1, annoCorrente - 2].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <Link href="/dashboard/fisco/prima-nota" className="btn btn-sm btn-outline-navy">
            <BookOpen className="h-4 w-4" /> Prima nota
          </Link>
        </div>
      </div>

      <Caricamento anno={anno} />

      {b && (
        <>
          <div className="stat-grid" style={{ marginTop: 16, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div className="card stat-card">
              <div className="lbl">Da abbinare</div>
              <div className="val" style={{ color: b.riepilogo.daAbbinare.n > 0 ? "var(--red)" : undefined }}>
                {b.riepilogo.daAbbinare.n}
              </div>
              <div className="delta flat">
                entrate {euro(b.riepilogo.daAbbinare.entrate)} · uscite {euro(b.riepilogo.daAbbinare.uscite)}
              </div>
            </div>
            <div className="card stat-card">
              <div className="lbl">Abbinati</div>
              <div className="val">{b.riepilogo.abbinati.n}</div>
            </div>
            <div className="card stat-card">
              <div className="lbl">Ignorati</div>
              <div className="val">{b.riepilogo.ignorati.n}</div>
            </div>
          </div>

          <section className="card" style={{ marginTop: 16 }}>
            <div className="card-head">
              <div>
                <h2>Movimenti del {anno}</h2>
                <p className="sub">I bottoni pieni sono gli abbinamenti più probabili. Niente parte finché non clicchi.</p>
              </div>
              <button type="button" className="btn btn-sm btn-outline-navy" disabled={sicuri.isPending || b.riepilogo.daAbbinare.n === 0} onClick={() => sicuri.mutate()}>
                {sicuri.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Abbina i sicuri
              </button>
            </div>
            <div className="act-body" style={{ paddingBottom: 0 }}>
              <div className="pills">
                {(
                  [
                    ["da_abbinare", "Da abbinare"],
                    ["abbinato", "Abbinati"],
                    ["ignorato", "Ignorati"],
                    ["tutti", "Tutti"],
                  ] as const
                ).map(([id, etichetta]) => (
                  <button key={id} type="button" className={`pill${stato === id ? " on" : ""}`} aria-pressed={stato === id} onClick={() => setStato(id)}>
                    {etichetta}
                  </button>
                ))}
              </div>
            </div>
            <div>
              {banca.isFetching && b.movimenti.length === 0 ? (
                <div className="act-body flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : b.movimenti.length === 0 ? (
                <div className="act-body text-sm" style={{ color: "var(--muted-mk)" }}>
                  {stato === "da_abbinare" ? "Nessun movimento da abbinare." : "Nessun movimento."}
                </div>
              ) : (
                b.movimenti.map((m) => <Riga key={m.id} movimento={m} anno={anno} />)
              )}
            </div>
          </section>

          {b.estratti.length > 0 && (
            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-head">
                <div>
                  <h2>File caricati</h2>
                  <p className="sub">Un file caricato per sbaglio si toglie, ma solo se nessuno dei suoi movimenti è già abbinato.</p>
                </div>
              </div>
              <div>
                {b.estratti.map((e) => (
                  <div key={e.id} className="item-row flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{e.nomeFile}</div>
                      <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
                        {format(new Date(e.createdAt), "d MMM yyyy HH:mm", { locale: it })}
                        {e.conto && ` · ${e.conto}`} · {e.righeNuove} nuovi, {e.righeDuplicate} già presenti, {e.righeScartate} non letti
                      </div>
                    </div>
                    <button type="button" className="ic-btn" aria-label={`Togli ${e.nomeFile}`} disabled={togli.isPending} onClick={() => togli.mutate(e.id)}>
                      <Trash2 />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
