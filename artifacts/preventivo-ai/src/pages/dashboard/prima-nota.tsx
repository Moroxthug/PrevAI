import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, BookOpen, Download, FileCheck2, Landmark, Loader2, PiggyBank, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCents } from "@/lib/jobs-api";
import { localDay } from "@/lib/local-day";
import {
  ErroreApiFiscale,
  MESI_BREVI,
  primaNotaApi,
  type CategoriaMovimento,
  type PrimaNotaDto,
  type TipoMovimento,
  type UtileNettoDto,
  type VocePrimaNotaDto,
} from "@/lib/fiscale-api";

// ── A-4: la prima nota ───────────────────────────────────────────────────────
// Un registro solo di quello che entra ed esce, costruito dai dati che
// PrevAI ha già: incassi delle fatture, costi dei cantieri, versamenti dello
// scadenzario. Qui si aggiunge a mano solo ciò che non ha un altro posto.
//
// Due regole di questa schermata:
//   1. l'utile netto sottrae le tasse **di competenza** dell'anno, non i
//      versamenti di cassa (che coprono spesso l'anno prima): i versamenti si
//      vedono nell'elenco, ma non entrano nel conto dell'utile;
//   2. nel forfettario i costi non abbassano le tasse. La pagina lo mostra coi
//      numeri dell'impresa e non aggiunge consigli: la scelta del regime si fa
//      col commercialista.

const euro = formatCents;

function dataBreve(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), "d MMM", { locale: it });
}

function Stat({ etichetta, valore, nota, tono }: { etichetta: string; valore: string; nota?: string; tono?: "rosso" | "verde" }) {
  return (
    <div className="card stat-card">
      <div className="lbl">{etichetta}</div>
      <div className="val" style={{ color: tono === "rosso" ? "var(--red)" : tono === "verde" ? "var(--green)" : undefined }}>
        {valore}
      </div>
      {nota && <div className="delta flat">{nota}</div>}
    </div>
  );
}

// ── Utile netto ──────────────────────────────────────────────────────────────

function UtileCard({ utile }: { utile: UtileNettoDto }) {
  const [perche, setPerche] = useState(false);
  const righe: [string, number, boolean?][] = [
    ["Ricavi incassati", utile.ricaviCents],
    ["Costi pagati", -utile.costiCents],
    ["Margine prima delle tasse", utile.margineCents, true],
    ["Imposta sostitutiva dell'anno", -utile.impostaCents],
    ["Contributi previdenziali dell'anno", -utile.contributiCents],
    ...(utile.bolloCents > 0 ? ([["Imposta di bollo", -utile.bolloCents]] as [string, number][]) : []),
    ["Utile netto dopo le tasse", utile.utileNettoCents, true],
  ];
  const spiegazione = utile.spiegazioni.find((s) => s.id === "utile_netto");

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2>Utile netto dopo le tasse</h2>
          <p className="sub">Quanto ti resta davvero: incassi meno costi meno imposta e contributi di competenza dell'anno.</p>
        </div>
        <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setPerche((v) => !v)} aria-expanded={perche}>
          {perche ? "Nascondi il calcolo" : "Perché questo importo"}
        </button>
      </div>
      <div className="act-body">
        <table className="text-sm" style={{ width: "100%" }}>
          <tbody>
            {righe.map(([etichetta, cents, forte]) => (
              <tr key={etichetta} style={forte ? { borderTop: "1px solid var(--line)" } : undefined}>
                <td style={{ padding: "4px 0", fontWeight: forte ? 600 : undefined }}>{etichetta}</td>
                <td className="font-mono" style={{ textAlign: "right", fontWeight: forte ? 600 : undefined, color: forte && cents < 0 ? "var(--red)" : undefined }}>
                  {cents < 0 && !forte ? "− " + euro(-cents) : euro(cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {perche && spiegazione && (
          <div className="text-xs" style={{ marginTop: 10, color: "var(--muted-mk)" }}>
            <div style={{ marginBottom: 4 }}>{spiegazione.formula}</div>
            {spiegazione.passaggi.map((p) => (
              <div key={p.etichetta} className="flex justify-between gap-3">
                <span>{p.etichetta}</span>
                <span className="font-mono">{p.valore}</span>
              </div>
            ))}
            <div style={{ marginTop: 4 }}>Fonte: {spiegazione.fonte}</div>
          </div>
        )}

        <div className="notice info" style={{ alignItems: "flex-start", marginTop: 12 }}>
          <div className="grow text-sm">
            Nel regime forfettario i costi non abbassano l'imposta: il coefficiente di redditività dà per scontati costi pari a{" "}
            <strong>{euro(utile.costiPresuntiCents)}</strong> su questi incassi. Quelli che hai registrato sono <strong>{euro(utile.costiCents)}</strong>.
            {utile.scartoCostiCents > 0 && " Se la differenza resta così nel tempo, è un tema da portare al tuo commercialista."}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Mese per mese ────────────────────────────────────────────────────────────

function MesiCard({ nota }: { nota: PrimaNotaDto }) {
  const massimo = Math.max(1, ...nota.totali.mesi.map((m) => Math.max(m.entrateCents, m.usciteCents)));
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2>Mese per mese</h2>
          <p className="sub">Entrate e uscite di cassa. Il saldo è quello della prima nota, non il saldo del conto.</p>
        </div>
      </div>
      <div className="act-body" style={{ overflowX: "auto" }}>
        <table className="text-xs" style={{ width: "100%", minWidth: 420 }}>
          <thead>
            <tr style={{ color: "var(--muted-mk)" }}>
              <th style={{ textAlign: "left" }}>Mese</th>
              <th style={{ textAlign: "left", width: "40%" }} aria-hidden="true" />
              <th style={{ textAlign: "right" }}>Entrate</th>
              <th style={{ textAlign: "right" }}>Uscite</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {nota.totali.mesi.map((m) => (
              <tr key={m.mese}>
                <td style={{ textTransform: "capitalize", padding: "3px 0" }}>{MESI_BREVI[m.mese - 1]}</td>
                <td aria-hidden="true">
                  <div style={{ height: 5, width: `${(m.entrateCents / massimo) * 100}%`, background: "var(--teal)", borderRadius: 2 }} />
                  <div style={{ height: 5, marginTop: 2, width: `${(m.usciteCents / massimo) * 100}%`, background: "var(--muted-mk)", borderRadius: 2, opacity: 0.6 }} />
                </td>
                <td className="font-mono" style={{ textAlign: "right" }}>{euro(m.entrateCents)}</td>
                <td className="font-mono" style={{ textAlign: "right" }}>{euro(m.usciteCents)}</td>
                <td className="font-mono" style={{ textAlign: "right", color: m.entrateCents - m.usciteCents < 0 ? "var(--red)" : undefined }}>
                  {euro(m.entrateCents - m.usciteCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Nuovo movimento ──────────────────────────────────────────────────────────

function NuovoMovimento({ nota, anno, aperto, onChiudi }: { nota: PrimaNotaDto; anno: number; aperto: boolean; onChiudi: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const oggi = localDay();
  const [data, setData] = useState(oggi.startsWith(String(anno)) ? oggi : `${anno}-12-31`);
  const [tipo, setTipo] = useState<TipoMovimento>("uscita");
  const [categoria, setCategoria] = useState<CategoriaMovimento>("spese_generali");
  const [importo, setImporto] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [controparte, setControparte] = useState("");

  const categorie = nota.categorie.filter((c) =>
    tipo === "entrata" ? ["altri_ricavi", "apporto_titolare", "giroconto", "altro"].includes(c.id) : !["altri_ricavi", "apporto_titolare"].includes(c.id),
  );
  const neutra = nota.categorie.find((c) => c.id === categoria)?.neutra;

  const salva = useMutation({
    mutationFn: () =>
      primaNotaApi.creaMovimento({
        data,
        tipo,
        categoria,
        importoCents: Math.round((Number(importo.replace(/\./g, "").replace(",", ".")) || 0) * 100),
        descrizione: descrizione.trim() || undefined,
        controparte: controparte.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Movimento registrato" });
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      onChiudi();
    },
    onError: (err) => toast({ title: "Non è stato registrato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });

  return (
    <Dialog open={aperto} onOpenChange={(v) => !v && onChiudi()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo movimento</DialogTitle>
          <DialogDescription>
            Solo per ciò che non ha già un posto: gli incassi delle fatture e le spese dei cantieri entrano in prima nota da soli.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="pills" role="radiogroup" aria-label="Verso" style={{ marginBottom: 12 }}>
            {(["uscita", "entrata"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tipo === t}
                className={`pill${tipo === t ? " on" : ""}`}
                onClick={() => {
                  setTipo(t);
                  setCategoria(t === "entrata" ? "altri_ricavi" : "spese_generali");
                }}
              >
                {t === "uscita" ? "Uscita" : "Entrata"}
              </button>
            ))}
          </div>
          <div className="form-grid" style={{ padding: 0 }}>
            <div className="field">
              <label htmlFor="mov-data">Data</label>
              <input id="mov-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="mov-importo">Importo</label>
              <input id="mov-importo" inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="0,00" />
            </div>
            <div className="field full">
              <label htmlFor="mov-categoria">Categoria</label>
              <select id="mov-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaMovimento)}>
                {categorie.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.etichetta}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="mov-descrizione">Descrizione</label>
              <input id="mov-descrizione" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="facoltativa" />
            </div>
            <div className="field full">
              <label htmlFor="mov-controparte">Controparte</label>
              <input id="mov-controparte" value={controparte} onChange={(e) => setControparte(e.target.value)} placeholder="facoltativa" />
            </div>
          </div>
          {neutra && (
            <p className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 10 }}>
              Questa categoria sposta denaro ma non è né un ricavo né un costo: si vede in prima nota e non cambia l'utile.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn btn-sm btn-navy" disabled={salva.isPending || !importo} onClick={() => salva.mutate()}>
            {salva.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Registra
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Elenco ───────────────────────────────────────────────────────────────────

type Filtro = "tutti" | "entrata" | "uscita" | "manuali";

function Riga({ voce }: { voce: VocePrimaNotaDto }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const elimina = useMutation({
    mutationFn: () => primaNotaApi.eliminaMovimento(voce.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prima-nota"] }),
    onError: (err) => toast({ title: "Non è stato eliminato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });
  const link =
    voce.collegamento?.tipo === "fattura" ? `/dashboard/invoices/${voce.collegamento.id}` : voce.collegamento?.tipo === "cantiere" ? `/dashboard/jobs/${voce.collegamento.id}` : null;

  return (
    <tr>
      <td className="text-xs" style={{ whiteSpace: "nowrap", color: "var(--muted-mk)", padding: "8px 8px 8px 0", verticalAlign: "top" }}>
        {dataBreve(voce.data)}
      </td>
      <td style={{ padding: "8px 8px 8px 0" }}>
        <div className="text-sm">{voce.descrizione}</div>
        <div className="text-xs flex flex-wrap items-center gap-2" style={{ color: "var(--muted-mk)", marginTop: 2 }}>
          <span>{voce.categoria}</span>
          {voce.controparte && <span>· {voce.controparte}</span>}
          {link && voce.collegamento && (
            <Link href={link} className="underline">
              {voce.collegamento.tipo === "fattura" ? "fattura" : "cantiere"} {voce.collegamento.etichetta}
            </Link>
          )}
          {voce.inBanca && <span className="chip chip-teal">in banca</span>}
          {!voce.incideSulUtile && <span className="chip chip-grey">non conta nell'utile</span>}
        </div>
      </td>
      <td className="font-mono text-sm" style={{ textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top", padding: "8px 0" }}>
        {voce.tipo === "entrata" ? euro(voce.importoCents) : ""}
      </td>
      <td className="font-mono text-sm" style={{ textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top", padding: "8px 0 8px 12px" }}>
        {voce.tipo === "uscita" ? euro(voce.importoCents) : ""}
      </td>
      <td style={{ width: 32, verticalAlign: "top", padding: "6px 0 0 8px" }}>
        {voce.fonte === "movimento" && (
          <button type="button" className="ic-btn" aria-label="Elimina il movimento" disabled={elimina.isPending} onClick={() => elimina.mutate()}>
            <Trash2 />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Pagina ───────────────────────────────────────────────────────────────────

export default function PrimaNotaPage() {
  const annoCorrente = new Date().getFullYear();
  const [anno, setAnno] = useState(annoCorrente);
  const [filtro, setFiltro] = useState<Filtro>("tutti");
  const [nuovo, setNuovo] = useState(false);
  const nota = useQuery({ queryKey: ["prima-nota", "voci", anno], queryFn: () => primaNotaApi.primaNota(anno) });
  const utile = useQuery({ queryKey: ["prima-nota", "utile", anno], queryFn: () => primaNotaApi.utile(anno) });

  const voci = useMemo(() => {
    const tutte = nota.data?.voci ?? [];
    if (filtro === "manuali") return tutte.filter((v) => v.fonte === "movimento");
    if (filtro === "tutti") return tutte;
    return tutte.filter((v) => v.tipo === filtro);
  }, [nota.data, filtro]);

  if (nota.error instanceof ErroreApiFiscale && nota.error.codice === "FISCAL_MODULE_OFF") {
    return (
      <div className="card">
        <div className="act-body text-sm">Il modulo Amministrazione non è attivo su questo account.</div>
      </div>
    );
  }
  if (nota.isLoading || !nota.data) {
    return (
      <div className="card">
        <div className="act-body flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  const n = nota.data;
  const u = utile.data?.utile;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-navy-500" />
            Prima nota
          </h1>
          <p className="sub">Tutto quello che entra ed esce, in un registro solo, con l'utile che ti resta dopo le tasse.</p>
        </div>
        <div className="head-actions">
          <select aria-label="Anno" value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
            {[annoCorrente, annoCorrente - 1, annoCorrente - 2].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <Link href="/dashboard/fisco/banca" className="btn btn-sm btn-outline-navy">
            <Landmark className="h-4 w-4" /> Estratto conto
          </Link>
          <Link href="/dashboard/fisco/chiusura" className="btn btn-sm btn-outline-navy">
            <FileCheck2 className="h-4 w-4" /> Chiusura d'anno
          </Link>
          <Link href="/dashboard/fisco" className="btn btn-sm btn-outline-navy">
            <PiggyBank className="h-4 w-4" /> Fisco
          </Link>
        </div>
      </div>

      {u && !u.revisionato && (
        <div className="notice warn" style={{ alignItems: "flex-start", marginTop: 16 }}>
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="grow text-sm">
            L'utile netto sottrae imposta e contributi calcolati con regole non ancora verificate da un commercialista. Gli incassi e i costi sono i
            tuoi numeri; la parte fiscale è una stima.
          </div>
        </div>
      )}
      {u && u.passiMancanti.length > 0 && (
        <div className="notice info" style={{ alignItems: "flex-start", marginTop: 12 }}>
          <div className="grow text-sm">
            Il profilo fiscale non è completo: finché mancano regime, ATECO e cassa previdenziale, imposta e contributi valgono zero e l'utile netto
            è sovrastimato. <Link href="/dashboard/fisco" className="underline">Completalo nella pagina Fisco</Link>.
          </div>
        </div>
      )}

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <Stat etichetta={`Entrate ${anno}`} valore={euro(n.totali.entrateCents)} nota={`di cui incassi di fatture ${euro(n.totali.incassiCents)}`} />
        <Stat etichetta="Uscite" valore={euro(n.totali.usciteCents)} nota={`di cui costi ${euro(n.totali.costiCents)}`} />
        <Stat
          etichetta="Utile netto dopo le tasse"
          valore={u ? euro(u.utileNettoCents) : "…"}
          nota={u && u.ricaviCents > 0 ? `${u.utileSuRicaviPercent.toLocaleString("it-IT")} % dei ricavi` : undefined}
          tono={u && u.utileNettoCents < 0 ? "rosso" : undefined}
        />
        <Stat etichetta="Saldo di cassa" valore={euro(n.totali.saldoCents)} nota="entrate meno uscite dell'anno" tono={n.totali.saldoCents < 0 ? "rosso" : undefined} />
      </div>

      {n.avvisi.map((a) => (
        <div key={a.id} className="notice warn" style={{ alignItems: "flex-start", marginTop: 12 }}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div className="grow text-sm">
            {a.testo}
            {a.importoCents ? ` (${euro(a.importoCents)})` : ""}{" "}
            {a.id === "banca_da_abbinare" ? (
              <Link href="/dashboard/fisco/banca" className="underline">
                Abbinali
              </Link>
            ) : a.link ? (
              <Link href={a.link} className="underline">
                Vai
              </Link>
            ) : null}
          </div>
        </div>
      ))}

      {u && <UtileCard utile={u} />}
      <MesiCard nota={n} />

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h2>Movimenti</h2>
            <p className="sub">{n.voci.length} movimenti nel {anno}, per data di cassa.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a className="btn btn-sm btn-outline-navy" href={primaNotaApi.urlCsv(anno)}>
              <Download className="h-4 w-4" /> CSV
            </a>
            <button type="button" className="btn btn-sm btn-navy" onClick={() => setNuovo(true)}>
              <Plus className="h-4 w-4" /> Nuovo movimento
            </button>
          </div>
        </div>
        <div className="act-body">
          <div className="pills" style={{ marginBottom: 12 }}>
            {(
              [
                ["tutti", "Tutti"],
                ["entrata", "Entrate"],
                ["uscita", "Uscite"],
                ["manuali", "Registrati a mano"],
              ] as const
            ).map(([id, etichetta]) => (
              <button key={id} type="button" className={`pill${filtro === id ? " on" : ""}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
                {etichetta}
              </button>
            ))}
          </div>
          {voci.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>
              Nessun movimento. Gli incassi arrivano registrando i pagamenti sulle fatture, i costi dai cantieri e dagli scontrini, i versamenti
              dallo scadenzario.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="Movimenti della prima nota">
              <table style={{ width: "100%", minWidth: 520 }}>
                <thead>
                  <tr className="text-xs" style={{ color: "var(--muted-mk)" }}>
                    <th style={{ textAlign: "left" }}>Data</th>
                    <th style={{ textAlign: "left" }}>Descrizione</th>
                    <th style={{ textAlign: "right" }}>Entrata</th>
                    <th style={{ textAlign: "right" }}>Uscita</th>
                    <th aria-label="Azioni" />
                  </tr>
                </thead>
                <tbody>
                  {voci.map((v) => (
                    <Riga key={v.chiave} voce={v} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <NuovoMovimento key={String(nuovo)} nota={n} anno={anno} aperto={nuovo} onChiudi={() => setNuovo(false)} />
    </div>
  );
}
