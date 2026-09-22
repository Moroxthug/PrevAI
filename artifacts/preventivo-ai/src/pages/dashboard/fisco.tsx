import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, CalendarClock, Calculator, Check, HelpCircle, Landmark, Loader2, PiggyBank, Plus, ShieldQuestion, Trash2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCents } from "@/lib/jobs-api";
import {
  ErroreApiFiscale,
  ETICHETTE_GESTIONE,
  ETICHETTE_RIDUZIONE,
  ETICHETTE_VERSAMENTO,
  fiscaleApi,
  toneSoglia,
  type CalcoloDto,
  type GestionePrevidenziale,
  type RiduzioneContributiva,
  type RispostaCalcolo,
  type SimulazioneDto,
  type SpiegazioneDto,
  type TipoVersamento,
} from "@/lib/fiscale-api";

// ── A-2: la pagina Fisco ─────────────────────────────────────────────────────
// Regola di questa schermata: **nessun importo senza il suo perché**. Ogni
// cifra ha accanto "come l'abbiamo calcolata", che apre formula, passaggi e
// norma. È ciò che la tiene uno strumento di calcolo e non una consulenza
// travestita (AMMINISTRAZIONE-PLAN.md §5 e §11).
//
// Seconda regola: finché il motore non è stato revisionato da un
// commercialista, la pagina lo dice in cima e non lo nasconde mai.

const ETICHETTE_PASSO: Record<string, string> = {
  regime: "Regime contabile",
  ateco: "Attività e codice ATECO",
  previdenza: "Cassa previdenziale",
  storico: "Anno di apertura e dati dell'anno scorso",
  avviso: "Presa d'atto",
};

function euro(cents: number): string {
  return formatCents(cents);
}

/** "37,8 %" — virgola decimale e spazio prima del simbolo, come si scrive in italiano. */
function percento(valore: number): string {
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(valore)} %`;
}

/** "Come l'abbiamo calcolato": la formula, i passaggi, la norma. */
function Perche({ spiegazione }: { spiegazione: SpiegazioneDto }) {
  const [aperto, setAperto] = useState(false);
  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" className="text-link text-xs" onClick={() => setAperto(!aperto)} aria-expanded={aperto}>
        <HelpCircle className="h-3.5 w-3.5 inline" /> Come l'abbiamo calcolato
      </button>
      {aperto && (
        <div className="notice info" style={{ alignItems: "flex-start", marginTop: 6 }}>
          <div className="grow">
            <p className="text-xs" style={{ margin: 0 }}>
              <strong>{spiegazione.formula}</strong>
            </p>
            <table className="mt-2 text-xs">
              <tbody>
                {spiegazione.passaggi.map((p) => (
                  <tr key={p.etichetta}>
                    <td style={{ color: "var(--muted-mk)", paddingRight: 12 }}>{p.etichetta}</td>
                    <td className="font-mono">{p.valore}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ paddingRight: 12 }}>
                    <strong>Risultato</strong>
                  </td>
                  <td className="font-mono">
                    <strong>{euro(spiegazione.risultatoCents)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs mt-2" style={{ color: "var(--muted-mk)" }}>
              Fonte: {spiegazione.fonte} · regole {spiegazione.regole.join(", ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CifraGrande({ etichetta, valore, nota, spiegazione }: { etichetta: string; valore: string; nota?: string; spiegazione?: SpiegazioneDto }) {
  return (
    <div className="card" style={{ flex: "1 1 220px", minWidth: 220 }}>
      <div className="act-body">
        <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
          {etichetta}
        </div>
        <div style={{ fontSize: "1.6rem", fontWeight: 600, lineHeight: 1.2 }}>{valore}</div>
        {nota && (
          <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
            {nota}
          </div>
        )}
        {spiegazione && <Perche spiegazione={spiegazione} />}
      </div>
    </div>
  );
}

/** Avviso fisso in cima: stato della revisione professionale del motore. */
function BannerRevisione({ risposta }: { risposta: RispostaCalcolo }) {
  const { revisione, calcolo } = risposta;
  if (revisione.revisionato) {
    return (
      <div className="notice ok" style={{ alignItems: "flex-start" }}>
        <div className="grow text-sm">
          Le regole {calcolo.annoRegole} usate in questa pagina sono state revisionate da un commercialista.
        </div>
      </div>
    );
  }
  const mancanti = revisione.regole.filter((r) => r.stato === "non_revisionata").length;
  return (
    <div className="notice warn" style={{ alignItems: "flex-start" }}>
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <div className="grow text-sm">
        <strong>Numeri non ancora verificati da un commercialista.</strong> Il motore applica le regole {calcolo.annoRegole} raccolte dalle fonti ufficiali,
        ma {mancanti} regole su {revisione.regole.length} non sono ancora state confermate da un professionista. Usali per farti un'idea e per
        accantonare, non per versare un importo esatto.
      </div>
    </div>
  );
}

function Onboarding({ risposta, onFatto }: { risposta: RispostaCalcolo; onFatto: () => void }) {
  const { toast } = useToast();
  const profilo = useQuery({ queryKey: ["fiscale", "profilo"], queryFn: () => fiscaleApi.profilo() });
  const [ateco, setAteco] = useState("");
  const [gestione, setGestione] = useState<GestionePrevidenziale>("artigiani");
  const [riduzione, setRiduzione] = useState<RiduzioneContributiva>("nessuna");
  const [annoInizio, setAnnoInizio] = useState("");
  const [startup, setStartup] = useState(false);

  const salva = useMutation({
    mutationFn: () =>
      fiscaleApi.aggiornaProfilo({
        codiceAteco: ateco,
        gestione,
        riduzione,
        annoInizioAttivita: annoInizio ? Number(annoInizio) : null,
        requisitiStartup: startup,
        accettaAvviso: true,
      }),
    onSuccess: () => {
      toast({ title: "Profilo fiscale salvato" });
      onFatto();
    },
    onError: (err: Error) => toast({ title: "Non salvato", description: err.message, variant: "destructive" }),
  });

  const opzioni = profilo.data?.opzioni;
  const avviso = risposta.avviso.testo;

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2>Prima di calcolare, due dati su di te</h2>
          <p className="sub">
            Mancano: {risposta.passiMancanti.map((p) => ETICHETTE_PASSO[p] ?? p).join(" · ")}. Sono le cose che decidono il calcolo e che nessun
            preventivo ci può dire.
          </p>
        </div>
      </div>
      <div className="act-body space-y-3">
        <div className="field">
          <label htmlFor="fisco-ateco">Codice ATECO della tua attività</label>
          <input id="fisco-ateco" value={ateco} onChange={(e) => setAteco(e.target.value)} placeholder="43.22.01" list="fisco-mestieri" />
          <datalist id="fisco-mestieri">
            {(opzioni?.mestieri ?? []).map((m) => (
              <option key={m.codice} value={m.codice}>
                {m.mestiere}
              </option>
            ))}
          </datalist>
          <p className="text-xs" style={{ color: "var(--muted-mk)" }}>
            Lo trovi sulla visura camerale. Decide il coefficiente di redditività: per edilizia e impianti è l'86 %.
          </p>
        </div>

        <div className="field">
          <label htmlFor="fisco-gestione">Dove versi i contributi</label>
          <select id="fisco-gestione" value={gestione} onChange={(e) => setGestione(e.target.value as GestionePrevidenziale)}>
            {(opzioni?.gestioni ?? []).map((g) => (
              <option key={g} value={g}>
                {ETICHETTE_GESTIONE[g]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="fisco-riduzione">Hai chiesto una riduzione contributiva?</label>
          <select id="fisco-riduzione" value={riduzione} onChange={(e) => setRiduzione(e.target.value as RiduzioneContributiva)}>
            {(opzioni?.riduzioni ?? []).map((r) => (
              <option key={r} value={r}>
                {ETICHETTE_RIDUZIONE[r]}
              </option>
            ))}
          </select>
          <p className="text-xs" style={{ color: "var(--muted-mk)" }}>
            Le due riduzioni sono alternative e incidono sulla pensione futura: quale convenga è una domanda da fare a un commercialista, non a noi.
          </p>
        </div>

        <div className="field">
          <label htmlFor="fisco-anno">Anno di apertura della partita IVA</label>
          <input id="fisco-anno" type="number" value={annoInizio} onChange={(e) => setAnnoInizio(e.target.value)} placeholder="2024" />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={startup} onChange={(e) => setStartup(e.target.checked)} />
          <span>
            Ho i requisiti per l'aliquota ridotta al 5 %: non ho esercitato attività nei tre anni precedenti, non è la prosecuzione di un lavoro
            dipendente e non supero i limiti di ricavi del titolare precedente.
          </span>
        </label>

        <div className="notice info" style={{ alignItems: "flex-start" }}>
          <ShieldQuestion className="h-5 w-5 shrink-0" />
          <div className="grow text-sm">{avviso}</div>
        </div>

        <button type="button" className="btn btn-navy" disabled={!ateco || salva.isPending} onClick={() => salva.mutate()}>
          {salva.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salva e calcola
        </button>
      </div>
    </section>
  );
}

function Soglia({ calcolo }: { calcolo: CalcoloDto }) {
  const s = calcolo.soglia;
  const tono = toneSoglia(s.livello);
  const colore = tono === "errore" ? "var(--red)" : tono === "attesa" ? "var(--yellow-dark)" : "var(--green)";
  const larghezzaMaturato = Math.min(100, (s.maturatoCents / s.sogliaCents) * 100);
  const larghezzaProiezione = Math.min(100, (s.proiezioneCents / s.sogliaCents) * 100);

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Soglia degli 85.000 €
          </h2>
          <p className="sub">Incassato più emesso: è quello che conta oggi. La pipeline è il lavoro accettato e non ancora fatturato.</p>
        </div>
      </div>
      <div className="act-body space-y-2">
        <div
          aria-hidden="true"
          style={{ position: "relative", height: 12, borderRadius: 6, background: "var(--border-mk, #e5e7eb)", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", inset: 0, width: `${larghezzaProiezione}%`, background: colore, opacity: 0.3 }} />
          <div style={{ position: "absolute", inset: 0, width: `${larghezzaMaturato}%`, background: colore }} />
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
          <span>
            <strong>{euro(s.maturatoCents)}</strong> su {euro(s.sogliaCents)} · {percento(s.percentuale)}
          </span>
          <span style={{ color: "var(--muted-mk)" }}>
            Con la pipeline arriveresti a <strong>{euro(s.proiezioneCents)}</strong>
          </span>
        </div>
        <div className="notice" style={{ alignItems: "flex-start", borderLeft: `3px solid ${colore}` }}>
          <div className="grow text-sm">{s.conseguenza}</div>
        </div>
        {s.livello !== "superata" && s.livello !== "fuori_regime" && (
          <p className="text-xs" style={{ color: "var(--muted-mk)" }}>
            Puoi ancora fatturare <strong>{euro(s.margineCents)}</strong> restando sotto la soglia. Oltre i {euro(s.sogliaUscitaImmediataCents)}{" "}
            l'uscita dal regime è immediata.
          </p>
        )}
      </div>
    </section>
  );
}

function Simulatore({ anno }: { anno: number }) {
  const [importo, setImporto] = useState("");
  const [esito, setEsito] = useState<SimulazioneDto | null>(null);
  const { toast } = useToast();

  const simula = useMutation({
    mutationFn: () => fiscaleApi.simula(Math.round(Number(importo.replace(",", ".")) * 100), anno),
    onSuccess: (r) => setEsito(r),
    onError: (err: Error) => toast({ title: "Simulazione non riuscita", description: err.message, variant: "destructive" }),
  });

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Se accetto questo lavoro, cosa mi resta?
          </h2>
          <p className="sub">Metti l'importo che incasseresti quest'anno. Non salva niente: è solo un conto.</p>
        </div>
      </div>
      <div className="act-body space-y-2">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="fisco-simula">Importo incassato (€)</label>
            <input id="fisco-simula" inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="12000" />
          </div>
          <button type="button" className="btn btn-navy" disabled={!importo || simula.isPending} onClick={() => simula.mutate()}>
            {simula.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Calcola
          </button>
        </div>

        {esito && (
          <div className="space-y-2">
            <table className="text-sm">
              <tbody>
                <tr>
                  <td style={{ color: "var(--muted-mk)", paddingRight: 16 }}>Incasso</td>
                  <td className="font-mono">{euro(esito.importoCents)}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--muted-mk)", paddingRight: 16 }}>Imposta sostitutiva in più</td>
                  <td className="font-mono">− {euro(esito.deltaImpostaCents)}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--muted-mk)", paddingRight: 16 }}>Contributi in più</td>
                  <td className="font-mono">− {euro(esito.deltaContributiCents)}</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: 16 }}>
                    <strong>Ti resta</strong>
                  </td>
                  <td className="font-mono">
                    <strong>
                      {euro(esito.nettoCents)} ({percento(esito.nettoPercent)})
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
            {esito.avviso && (
              <div className="notice warn" style={{ alignItems: "flex-start" }}>
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div className="grow text-sm">{esito.avviso}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Versamenti({ anno }: { anno: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [apri, setApri] = useState(false);
  const [tipo, setTipo] = useState<TipoVersamento>("contributi_inps");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [importo, setImporto] = useState("");
  const [riferimento, setRiferimento] = useState("");

  const lista = useQuery({ queryKey: ["fiscale", "versamenti", anno], queryFn: () => fiscaleApi.versamenti(anno) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["fiscale", "versamenti", anno] });
    queryClient.invalidateQueries({ queryKey: ["fiscale", "calcolo", anno] });
  };

  const registra = useMutation({
    mutationFn: () =>
      fiscaleApi.registraVersamento({
        anno,
        tipo,
        data,
        importoCents: Math.round(Number(importo.replace(",", ".")) * 100),
        riferimento,
      }),
    onSuccess: () => {
      invalidate();
      setApri(false);
      setImporto("");
      setRiferimento("");
      toast({ title: "Versamento registrato" });
    },
    onError: (err: Error) => toast({ title: "Non registrato", description: err.message, variant: "destructive" }),
  });

  const elimina = useMutation({
    mutationFn: (id: string) => fiscaleApi.eliminaVersamento(id),
    onSuccess: invalidate,
  });

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2">
            <Landmark className="h-5 w-5" /> Versamenti {anno}
          </h2>
          <p className="sub">I contributi versati si deducono dall'imponibile: registrarli qui abbassa l'imposta calcolata.</p>
        </div>
        <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setApri(!apri)}>
          <Plus className="h-4 w-4" /> Registra
        </button>
      </div>

      {apri && (
        <div className="act-body space-y-2">
          <div className="field">
            <label htmlFor="vers-tipo">Tipo</label>
            <select id="vers-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoVersamento)}>
              {(lista.data?.tipi ?? []).map((t) => (
                <option key={t} value={t}>
                  {ETICHETTE_VERSAMENTO[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="vers-data">Data del versamento</label>
            <input id="vers-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="vers-importo">Importo (€)</label>
            <input id="vers-importo" inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="1130,34" />
          </div>
          <div className="field">
            <label htmlFor="vers-rif">Riferimento (facoltativo)</label>
            <input id="vers-rif" value={riferimento} onChange={(e) => setRiferimento(e.target.value)} placeholder="F24 del 16/05" />
          </div>
          <button type="button" className="btn btn-sm btn-navy" disabled={!importo || registra.isPending} onClick={() => registra.mutate()}>
            Salva il versamento
          </button>
        </div>
      )}

      {lista.isLoading ? (
        <div className="act-body flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (lista.data?.versamenti ?? []).length === 0 ? (
        <div className="card-empty">Nessun versamento registrato per il {anno}.</div>
      ) : (
        <div>
          {(lista.data?.versamenti ?? []).map((v) => (
            <div key={v.id} className="item-row flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium">{ETICHETTE_VERSAMENTO[v.tipo]}</div>
                <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
                  {format(new Date(v.data), "PP", { locale: it })}
                  {v.riferimento ? ` · ${v.riferimento}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <strong>{euro(v.importoCents)}</strong>
                <button type="button" className="ic-btn" aria-label="Elimina il versamento" onClick={() => elimina.mutate(v.id)}>
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function FiscoPage() {
  const annoCorrente = new Date().getFullYear();
  const [anno, setAnno] = useState(annoCorrente);
  const queryClient = useQueryClient();

  const calcolo = useQuery({ queryKey: ["fiscale", "calcolo", anno], queryFn: () => fiscaleApi.calcolo(anno), retry: false });

  const spiegazioni = useMemo(() => {
    const mappa = new Map<string, SpiegazioneDto>();
    for (const s of calcolo.data?.calcolo.spiegazioni ?? []) mappa.set(s.id, s);
    return mappa;
  }, [calcolo.data]);

  if (calcolo.isError && calcolo.error instanceof ErroreApiFiscale && calcolo.error.codice === "FISCAL_MODULE_OFF") {
    return (
      <div className="card card-empty">
        Il calcolo fiscale non è attivo su questo account.
        <br />
        <Link href="/dashboard/settings?tab=billing" className="text-link">
          Vedi i piani
        </Link>
      </div>
    );
  }

  if (calcolo.isLoading || !calcolo.data) {
    return (
      <div className="card">
        <div className="act-body flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  const risposta = calcolo.data;
  const c = risposta.calcolo;
  const daFare = risposta.passiMancanti.length > 0;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2">
            <PiggyBank className="h-7 w-7 text-navy-500" />
            Fisco
          </h1>
          <p className="sub">Quanto stai maturando di imposte e contributi, quanto mettere via, e quanto manca alla soglia.</p>
        </div>
        <div className="head-actions">
          <select aria-label="Anno d'imposta" value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
            {[annoCorrente, annoCorrente - 1, annoCorrente - 2].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <Link href="/dashboard/amministrazione" className="btn btn-sm btn-outline-navy">
            Amministrazione
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <BannerRevisione risposta={risposta} />
      </div>

      {daFare ? (
        <Onboarding risposta={risposta} onFatto={() => queryClient.invalidateQueries({ queryKey: ["fiscale"] })} />
      ) : (
        <>
          <div className="flex gap-3 flex-wrap" style={{ marginTop: 16 }}>
            <CifraGrande
              etichetta="Da mettere via"
              valore={euro(c.daMettereViaCents)}
              nota={`${euro(c.daMettereViaMensileCents)} al mese per i mesi che restano, margine di sicurezza incluso`}
              spiegazione={spiegazioni.get("da_mettere_via")}
            />
            <CifraGrande
              etichetta={`Imposta sostitutiva ${percento(c.aliquotaPercent)}`}
              valore={euro(c.impostaCents)}
              nota={c.startupAttiva ? "Aliquota start-up dei primi cinque anni" : undefined}
              spiegazione={spiegazioni.get("imposta")}
            />
            <CifraGrande etichetta="Contributi dell'anno" valore={euro(c.contributi.totaleCents)} nota={`Già versati: ${euro(c.contributi.versatiCents)}`} spiegazione={spiegazioni.get("contributi")} />
            <CifraGrande etichetta="Imponibile" valore={euro(c.imponibileCents)} nota={`Coefficiente ${percento(c.coefficientePercent)}`} spiegazione={spiegazioni.get("imponibile")} />
          </div>

          <section className="card" style={{ marginTop: 16 }}>
            <div className="act-body text-sm">
              Su ogni euro che incassi da qui in avanti, metti da parte circa <strong>{percento(c.percentualeSuIncassi)}</strong>. Nell'anno hai incassato{" "}
              <strong>{euro(risposta.dati.incassatiCents)}</strong> su {risposta.dati.incassiConteggio} pagamenti registrati; conta la data
              dell'incasso, non quella della fattura.
            </div>
          </section>

          <Soglia calcolo={c} />

          {/* A-3: il calendario completo (col bollo trimestrale, l'F24 precompilato
              e i promemoria) sta nello scadenzario. Qui restano le prime tre, per
              non far uscire da questa pagina chi voleva solo un'occhiata. */}
          <section className="card" style={{ marginTop: 16 }}>
            <div className="card-head">
              <div>
                <h2 className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5" /> Prossime scadenze
                </h2>
                <p className="sub">Gli importi li disponi tu: PrevAI non versa e non invia nulla per tuo conto.</p>
              </div>
              <Link href="/dashboard/fisco/scadenzario" className="btn btn-sm btn-outline-navy">
                Scadenzario completo
              </Link>
            </div>
            <div>
              {c.scadenze.slice(0, 3).map((s) => {
                const erario = s.righe.filter((r) => r.sezione === "erario").map((r) => r.codiceTributo);
                return (
                  <div key={s.id} className="item-row flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{s.etichetta}</div>
                      <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
                        {format(new Date(`${s.data}T12:00:00`), "PP", { locale: it })}
                        {erario.length > 0 ? ` · codice tributo ${erario.join(", ")}` : ""}
                      </div>
                    </div>
                    {s.importoCents > 0 && <strong>{euro(s.importoCents)}</strong>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <div className="card-head">
              <div>
                <h2>Requisiti per restare nel forfettario</h2>
                <p className="sub">Si guardano sull'anno precedente. I valori sono quelli che hai dichiarato nel profilo fiscale.</p>
              </div>
            </div>
            <div>
              {risposta.requisiti.map((r) => (
                <div key={r.id} className="item-row flex items-start gap-2">
                  {r.rispettato ? (
                    <Check className="h-4 w-4 shrink-0" style={{ color: "var(--green)" }} />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--red)" }} />
                  )}
                  <div className="text-sm">
                    <div>{r.etichetta}</div>
                    <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
                      {r.dettaglio}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Simulatore anno={anno} />
          <Versamenti anno={anno} />

          <div className="notice info" style={{ alignItems: "flex-start", marginTop: 16 }}>
            <ShieldQuestion className="h-5 w-5 shrink-0" />
            <div className="grow text-sm">{risposta.avviso.testo}</div>
          </div>
        </>
      )}
    </div>
  );
}
