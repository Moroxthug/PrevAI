import { AddonPaywall } from "@/components/addon-paywall";
import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, BookOpen, Check, Copy, Download, FileCheck2, Loader2, Lock, RotateCcw, Share2, Unlock } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCents } from "@/lib/jobs-api";
import { ErroreApiFiscale, primaNotaApi, type CondivisioneDto, type RispostaChiusura } from "@/lib/fiscale-api";
import { Avvertenze, Guida, Prospetto, Utile, Versamenti } from "@/components/fisco/pacchetto-view";

// ── A-4: chiusura d'anno e condivisione col commercialista ───────────────────
// Chiudere l'anno è fare una fotografia firmata del pacchetto, non bloccare
// i dati: un errore trovato a luglio si corregge a luglio, e la pagina mostra
// che cosa è cambiato dalla fotografia invece di cambiarla di nascosto.
//
// PrevAI non compila né invia la dichiarazione (AMMINISTRAZIONE-PLAN.md §5):
// prepara il prospetto, spiega come presentarla da sé, e la manda in sola
// lettura al commercialista che l'impresa sceglie.

const euro = formatCents;

// ── Chiusura ─────────────────────────────────────────────────────────────────

function ChiudiDialog({ anno, aperto, onChiudi }: { anno: number; aperto: boolean; onChiudi: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const annoCorrente = new Date().getFullYear();
  const puoRiportare = anno === annoCorrente - 1;
  const [riporta, setRiporta] = useState(puoRiportare);

  const chiudi = useMutation({
    mutationFn: () => primaNotaApi.chiudi(anno, riporta && puoRiportare),
    onSuccess: (r) => {
      toast({ title: `Anno ${anno} chiuso`, description: r.riportato ? `Ricavi e imposta riportati nel profilo fiscale del ${anno + 1}.` : undefined });
      queryClient.invalidateQueries({ queryKey: ["chiusura"] });
      queryClient.invalidateQueries({ queryKey: ["fiscale"] });
      onChiudi();
    },
    onError: (err) => toast({ title: "L'anno non è stato chiuso", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });

  return (
    <Dialog open={aperto} onOpenChange={(v) => !v && onChiudi()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chiudi l'anno {anno}</DialogTitle>
          <DialogDescription>Una fotografia del pacchetto com'è adesso, con un'impronta che prova che non è stata ritoccata.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="text-sm" style={{ paddingLeft: 18, listStyle: "disc" }}>
            <li>Fatture, incassi e costi restano modificabili: se cambia qualcosa, qui vedrai la differenza.</li>
            <li>Puoi riaprire e richiudere: ogni chiusura ha la sua versione.</li>
            <li>La dichiarazione non parte da qui. Il prospetto va ricopiato nel modello, o consegnato al commercialista.</li>
          </ul>
          {puoRiportare && (
            <label className="flex items-start gap-2 text-sm" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={riporta} onChange={(e) => setRiporta(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                Riporta ricavi e imposta del {anno} nel profilo fiscale: servono a calcolare gli acconti del {anno + 1} e a controllare la soglia di
                permanenza nel regime.
              </span>
            </label>
          )}
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={onChiudi}>
            Annulla
          </button>
          <button type="button" className="btn btn-sm btn-navy" disabled={chiudi.isPending} onClick={() => chiudi.mutate()}>
            {chiudi.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Chiudi l'anno
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatoChiusura({ risposta, anno }: { risposta: RispostaChiusura; anno: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chiudi, setChiudi] = useState(false);
  const riapri = useMutation({
    mutationFn: () => primaNotaApi.riapri(anno),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chiusura"] }),
    onError: (err) => toast({ title: "Non è stato riaperto", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });
  const c = risposta.chiusura;
  const chiuso = c?.stato === "chiuso";

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2">
            {chiuso ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
            {chiuso ? `Anno chiuso il ${format(new Date(c!.chiusoAt), "d MMMM yyyy", { locale: it })}` : `Anno ${anno} aperto`}
          </h2>
          <p className="sub">
            {chiuso
              ? `Versione ${c!.versione}${c!.riportatoAt ? ", ricavi e imposta riportati sull'anno dopo" : ""}. ${c!.regoleRevisionate ? "" : "Chiuso con regole non ancora revisionate da un commercialista."}`
              : risposta.chiudibile
                ? "Quando i numeri ti tornano, chiudi l'anno: resta una fotografia firmata di questo pacchetto."
                : "Un anno si chiude quando è finito."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a className="btn btn-sm btn-outline-navy" href={primaNotaApi.urlPacchettoPdf(anno)}>
            <Download className="h-4 w-4" /> PDF
          </a>
          {chiuso ? (
            <>
              <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setChiudi(true)}>
                <RotateCcw className="h-4 w-4" /> Richiudi
              </button>
              <button type="button" className="btn btn-sm btn-outline-navy" disabled={riapri.isPending} onClick={() => riapri.mutate()}>
                <Unlock className="h-4 w-4" /> Riapri
              </button>
            </>
          ) : (
            risposta.chiudibile && (
              <button type="button" className="btn btn-sm btn-navy" onClick={() => setChiudi(true)}>
                <Lock className="h-4 w-4" /> Chiudi l'anno
              </button>
            )
          )}
        </div>
      </div>

      {risposta.differenze.length > 0 && (
        <div className="act-body">
          <div className="notice warn" style={{ alignItems: "flex-start" }}>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div className="grow text-sm">
              Dopo la chiusura sono cambiati dei numeri. Se il pacchetto è già dal commercialista, avvisalo; poi richiudi per fissare la nuova
              versione.
              <table className="text-xs" style={{ marginTop: 8, width: "100%" }}>
                <tbody>
                  {risposta.differenze.map((d) => (
                    <tr key={d.voce}>
                      <td style={{ paddingRight: 12 }}>{d.voce}</td>
                      <td className="font-mono" style={{ textAlign: "right" }}>
                        {euro(d.alloraCents)} → <strong>{euro(d.oggiCents)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {chiuso && (
        <div className="act-body text-xs font-mono" style={{ color: "var(--muted-mk)", paddingTop: 0, wordBreak: "break-all" }}>
          Impronta sha256: {c!.impronta}
        </div>
      )}
      <ChiudiDialog key={String(chiudi)} anno={anno} aperto={chiudi} onChiudi={() => setChiudi(false)} />
    </section>
  );
}

// ── Condivisione ─────────────────────────────────────────────────────────────

function Accessi({ condivisione }: { condivisione: CondivisioneDto }) {
  const accessi = useQuery({ queryKey: ["condivisioni", "accessi", condivisione.id], queryFn: () => primaNotaApi.accessi(condivisione.id) });
  if (accessi.isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  const righe = accessi.data?.accessi ?? [];
  if (righe.length === 0) return <p className="text-xs" style={{ color: "var(--muted-mk)" }}>Nessuno l'ha ancora aperto.</p>;
  return (
    <ul className="text-xs" style={{ color: "var(--muted-mk)" }}>
      {righe.map((a, i) => (
        <li key={i}>
          {format(new Date(a.at), "d MMM yyyy HH:mm", { locale: it })} · {a.risorsa === "pacchetto" ? "ha aperto il pacchetto" : `ha scaricato ${a.risorsa}`}
          {a.ip ? ` · ${a.ip}` : ""}
        </li>
      ))}
    </ul>
  );
}

function Condivisione({ anno }: { anno: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const elenco = useQuery({ queryKey: ["condivisioni"], queryFn: primaNotaApi.condivisioni });
  const [destinatario, setDestinatario] = useState("");
  const [email, setEmail] = useState("");
  const [giorni, setGiorni] = useState(30);
  const [creato, setCreato] = useState<{ url: string; scadeAt: string } | null>(null);
  const [aperti, setAperti] = useState<string | null>(null);

  const crea = useMutation({
    mutationFn: () => primaNotaApi.creaCondivisione({ anno, destinatario: destinatario.trim(), email: email.trim() || undefined, giorni }),
    onSuccess: (r) => {
      setCreato(r);
      setDestinatario("");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["condivisioni"] });
    },
    onError: (err) => toast({ title: "Il link non è stato creato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });
  const revoca = useMutation({
    mutationFn: (id: string) => primaNotaApi.revocaCondivisione(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["condivisioni"] }),
  });

  const copia = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiato" });
    } catch {
      toast({ title: "Copia il link a mano", description: url });
    }
  };

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2">
            <Share2 className="h-5 w-5" /> Condividi col commercialista
          </h2>
          <p className="sub">
            Un link in sola lettura al pacchetto del {anno}: prospetto, prima nota, versamenti, PDF e CSV. Scade da solo, si revoca quando vuoi, e
            vedi ogni volta che viene aperto. Lo mandi tu, a chi scegli tu.
          </p>
        </div>
      </div>
      <div className="act-body">
        <div className="form-grid" style={{ padding: 0 }}>
          <div className="field">
            <label htmlFor="cond-destinatario">A chi lo mandi</label>
            <input id="cond-destinatario" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="Studio Rossi" />
          </div>
          <div className="field">
            <label htmlFor="cond-email">Email (per ricordartelo)</label>
            <input id="cond-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="facoltativa" />
          </div>
          <div className="field">
            <label htmlFor="cond-durata">Valido per</label>
            <select id="cond-durata" value={giorni} onChange={(e) => setGiorni(Number(e.target.value))}>
              {(elenco.data?.durate ?? [7, 30, 90]).map((g) => (
                <option key={g} value={g}>
                  {g} giorni
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn btn-sm btn-navy" style={{ marginTop: 12 }} disabled={crea.isPending || destinatario.trim() === ""} onClick={() => crea.mutate()}>
          {crea.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Crea il link
        </button>

        {creato && (
          <div className="notice info" style={{ alignItems: "flex-start", marginTop: 12 }}>
            <div className="grow text-sm">
              <div>Ecco il link. Lo vedi solo adesso: se lo perdi, revocalo e creane un altro.</div>
              <div className="flex gap-2 items-center flex-wrap" style={{ marginTop: 6 }}>
                <code className="text-xs" style={{ wordBreak: "break-all" }}>
                  {creato.url}
                </code>
                <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => copia(creato.url)}>
                  <Copy className="h-4 w-4" /> Copia
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {(elenco.data?.condivisioni ?? []).length > 0 && (
        <div>
          {elenco.data!.condivisioni.map((c) => (
            <div key={c.id} className="item-row" style={{ display: "block" }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {c.destinatario} · anno {c.anno} {c.attivo ? <span className="chip chip-green">attivo</span> : <span className="chip chip-grey">{c.revocatoAt ? "revocato" : "scaduto"}</span>}
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
                    {c.email && `${c.email} · `}
                    {c.attivo ? `scade il ${format(new Date(c.scadeAt), "d MMM yyyy", { locale: it })}` : ""} · aperto {c.accessi} {c.accessi === 1 ? "volta" : "volte"}
                    {c.ultimoAccessoAt && `, l'ultima il ${format(new Date(c.ultimoAccessoAt), "d MMM HH:mm", { locale: it })}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="text-link text-xs" aria-expanded={aperti === c.id} onClick={() => setAperti(aperti === c.id ? null : c.id)}>
                    Registro accessi
                  </button>
                  {c.attivo && (
                    <button type="button" className="text-link text-xs" disabled={revoca.isPending} onClick={() => revoca.mutate(c.id)}>
                      Revoca
                    </button>
                  )}
                </div>
              </div>
              {aperti === c.id && (
                <div style={{ marginTop: 6 }}>
                  <Accessi condivisione={c} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Pagina ───────────────────────────────────────────────────────────────────

export default function ChiusuraPage() {
  const annoCorrente = new Date().getFullYear();
  const [anno, setAnno] = useState(annoCorrente - 1);
  const risposta = useQuery({ queryKey: ["chiusura", anno], queryFn: () => primaNotaApi.chiusura(anno) });

  if (risposta.error instanceof ErroreApiFiscale && (risposta.error.codice === "FISCAL_MODULE_OFF" || risposta.error.codice === "ADMIN_SUITE_OFF")) {
    return <AddonPaywall motivo={risposta.error.codice === "ADMIN_SUITE_OFF" ? "suite" : "fiscale"} />;
  }
  if (risposta.isLoading || !risposta.data) {
    return (
      <div className="card">
        <div className="act-body flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  const r = risposta.data;
  const p = r.pacchetto;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2">
            <FileCheck2 className="h-7 w-7 text-navy-500" />
            Chiusura d'anno
          </h1>
          <p className="sub">Il pacchetto per la dichiarazione: prospetto dei righi, risultato dell'anno, versamenti, e come presentarla.</p>
        </div>
        <div className="head-actions">
          <select aria-label="Anno d'imposta" value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
            {[annoCorrente - 1, annoCorrente - 2, annoCorrente - 3, annoCorrente].map((a) => (
              <option key={a} value={a}>
                {a}
                {a === annoCorrente ? " (in corso)" : ""}
              </option>
            ))}
          </select>
          <Link href="/dashboard/fisco/prima-nota" className="btn btn-sm btn-outline-navy">
            <BookOpen className="h-4 w-4" /> Prima nota
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Avvertenze pacchetto={p} />
      </div>
      {p.passiMancanti.length > 0 && (
        <div className="notice info" style={{ alignItems: "flex-start", marginTop: 12 }}>
          <div className="grow text-sm">
            Il profilo fiscale non è completo, quindi il prospetto è parziale e l'anno non si può chiudere.{" "}
            <Link href="/dashboard/fisco" className="underline">
              Completalo nella pagina Fisco
            </Link>
            .
          </div>
        </div>
      )}

      <StatoChiusura risposta={r} anno={anno} />

      <div className="stat-grid" style={{ marginTop: 16, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="card stat-card">
          <div className="lbl">Ricavi incassati</div>
          <div className="val">{euro(p.utile.ricaviCents)}</div>
        </div>
        <div className="card stat-card">
          <div className="lbl">{p.prospetto.saldoCents >= 0 ? "Imposta a debito" : "Imposta a credito"}</div>
          <div className="val">{euro(Math.abs(p.prospetto.saldoCents))}</div>
          <div className="delta flat">dopo gli acconti registrati</div>
        </div>
        <div className="card stat-card">
          <div className="lbl">Utile netto</div>
          <div className="val" style={{ color: p.utile.utileNettoCents < 0 ? "var(--red)" : undefined }}>
            {euro(p.utile.utileNettoCents)}
          </div>
        </div>
      </div>

      <Prospetto pacchetto={p} />
      <Utile pacchetto={p} />
      <Versamenti pacchetto={p} />
      <Guida passi={r.guida} />
      <Condivisione anno={anno} />

      <div className="notice info" style={{ alignItems: "flex-start", marginTop: 16 }}>
        <Check className="h-4 w-4 shrink-0" />
        <div className="grow text-sm">{p.avviso.testo}</div>
      </div>
    </div>
  );
}
