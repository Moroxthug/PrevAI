import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Clock, Download, FileCode2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCents } from "@/lib/jobs-api";
import { ErroreApiSdi, sdiApi, toneStatoSdi, type ProblemaDto } from "@/lib/sdi-api";

// A-1: il pannello "Fattura elettronica" sulla scheda di una fattura.
// Tre stati possibili, e si vede subito quale:
//   non ancora trasmessa → controlli + pulsante Invia;
//   in volo o consegnata → stato, ricevute SdI, XML scaricabile;
//   scartata             → errore tradotto e invito a correggere e rinviare.
// L'invio non parte mai da solo: è sempre un clic dell'utente
// (AMMINISTRAZIONE-PLAN.md §7).

const TONI: Record<"ok" | "attesa" | "errore", { colore: string; sfondo: string }> = {
  ok: { colore: "var(--green)", sfondo: "rgba(16,185,129,0.12)" },
  attesa: { colore: "var(--navy)", sfondo: "rgba(30,58,95,0.08)" },
  errore: { colore: "var(--red)", sfondo: "rgba(220,38,38,0.10)" },
};

function Problemi({ titolo, problemi, tono }: { titolo: string; problemi: ProblemaDto[]; tono: "errore" | "avviso" }) {
  if (problemi.length === 0) return null;
  return (
    <div className={`notice ${tono === "errore" ? "warn" : "info"}`} style={{ alignItems: "flex-start" }}>
      <AlertTriangle />
      <div className="grow">
        <strong>{titolo}</strong>
        <ul className="mt-1 space-y-1 text-xs">
          {problemi.map((p, i) => (
            <li key={`${p.campo}-${i}`}>
              {p.messaggio}
              {p.codiceSdi ? <span style={{ color: "var(--muted-mk)" }}> (scarto {p.codiceSdi})</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SdiPanel({ invoiceId, fiscale, inviabile }: { invoiceId: string; fiscale: boolean; inviabile: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [anteprimaAperta, setAnteprimaAperta] = useState(false);

  const stato = useQuery({ queryKey: ["sdi", "fattura", invoiceId], queryFn: () => sdiApi.statoFattura(invoiceId), retry: false });
  const anteprima = useQuery({
    queryKey: ["sdi", "anteprima", invoiceId],
    queryFn: () => sdiApi.anteprima(invoiceId),
    enabled: anteprimaAperta,
    retry: false,
  });

  const aggiorna = () => {
    queryClient.invalidateQueries({ queryKey: ["sdi", "fattura", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  };

  const invia = useMutation({
    mutationFn: () => sdiApi.invia(invoiceId),
    onSuccess: (res) => {
      aggiorna();
      toast({ title: "Fattura trasmessa allo SdI", description: `File ${res.trasmissione.fileName}${res.trasmissione.ambiente === "sandbox" ? " (ambiente di prova: non è una fattura valida)" : ""}` });
    },
    onError: (err: Error) => {
      const dettagli = err instanceof ErroreApiSdi ? err.dettagli : null;
      toast({
        title: "Trasmissione non riuscita",
        description: dettagli?.length ? `${err.message} — ${dettagli[0].messaggio}` : err.message,
        variant: "destructive",
      });
      if (dettagli?.length) setAnteprimaAperta(true);
    },
  });

  const sincronizza = useMutation({
    mutationFn: (id: string) => sdiApi.aggiorna(id),
    onSuccess: () => {
      aggiorna();
      toast({ title: "Stato aggiornato" });
    },
    onError: (err: Error) => toast({ title: "Aggiornamento non riuscito", description: err.message, variant: "destructive" }),
  });

  // Il modulo non è attivo su questo account: niente pannello, niente rumore.
  if (stato.isError && stato.error instanceof ErroreApiSdi && stato.error.codice === "SDI_MODULE_OFF") return null;

  const corrente = stato.data?.corrente ?? null;
  const tono = corrente ? TONI[toneStatoSdi(corrente.stato)] : TONI.attesa;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Fattura elettronica (SdI)</h2>
          <p className="sub">{fiscale ? "Documento fiscale: l'originale è il file XML trasmesso al Sistema di Interscambio." : "Documento pro-forma: attiva il modulo PrevAI Fisco per emettere fatture elettroniche."}</p>
        </div>
        {corrente && (
          <button type="button" className="ic-btn" aria-label="Aggiorna stato" onClick={() => sincronizza.mutate(corrente.id)} disabled={sincronizza.isPending}>
            <RefreshCw className={sincronizza.isPending ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      <div className="act-body space-y-3">
        {corrente ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge" style={{ color: tono.colore, background: tono.sfondo }}>
                {toneStatoSdi(corrente.stato) === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : toneStatoSdi(corrente.stato) === "errore" ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                {corrente.statoLabel}
              </span>
              {corrente.ambiente === "sandbox" && <span className="badge" style={{ color: "var(--muted-mk)" }}>ambiente di prova</span>}
              {corrente.conservazione === "conservata" && (
                <span className="badge" style={{ color: "var(--green)" }}>
                  <ShieldCheck className="h-3.5 w-3.5" /> in conservazione
                </span>
              )}
            </div>

            {corrente.erroreMessaggio && (
              <div className="notice warn" style={{ alignItems: "flex-start" }}>
                <AlertTriangle />
                <span className="grow">
                  {corrente.erroreMessaggio} <strong>Correggi i dati e rinvia entro 5 giorni</strong>: fino ad allora la fattura si considera non emessa.
                </span>
              </div>
            )}

            <dl className="text-xs space-y-1">
              <div className="flex justify-between gap-3">
                <dt style={{ color: "var(--muted-mk)" }}>File</dt>
                <dd className="font-mono">{corrente.fileName}</dd>
              </div>
              {corrente.identificativoSdi && (
                <div className="flex justify-between gap-3">
                  <dt style={{ color: "var(--muted-mk)" }}>Identificativo SdI</dt>
                  <dd className="font-mono">{corrente.identificativoSdi}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt style={{ color: "var(--muted-mk)" }}>Destinatario</dt>
                <dd className="font-mono">{corrente.codiceDestinatario ?? "—"}{corrente.pecDestinatario ? ` · ${corrente.pecDestinatario}` : ""}</dd>
              </div>
              {corrente.bolloVirtuale && (
                <div className="flex justify-between gap-3">
                  <dt style={{ color: "var(--muted-mk)" }}>Imposta di bollo</dt>
                  <dd>{formatCents(corrente.bolloCents)} — assolta virtualmente, da versare col trimestre</dd>
                </div>
              )}
              {corrente.inviataAt && (
                <div className="flex justify-between gap-3">
                  <dt style={{ color: "var(--muted-mk)" }}>Trasmessa</dt>
                  <dd>{format(new Date(corrente.inviataAt), "PPp", { locale: it })}</dd>
                </div>
              )}
            </dl>

            <div className="flex gap-2 flex-wrap">
              <a href={sdiApi.xmlUrl(corrente.id)} className="btn btn-sm btn-outline-navy">
                <Download className="h-4 w-4" /> Scarica XML
              </a>
              {corrente.stato === "scartata" && (
                <button type="button" className="btn btn-sm btn-navy" onClick={() => invia.mutate()} disabled={invia.isPending}>
                  <Send className="h-4 w-4" /> Rinvia allo SdI
                </button>
              )}
            </div>

            {(stato.data?.eventi.length ?? 0) > 0 && (
              <details>
                <summary className="text-link text-xs">Ricevute SdI ({stato.data!.eventi.length})</summary>
                <ul className="mt-2 space-y-1 text-xs">
                  {stato.data!.eventi.map((e) => (
                    <li key={e.id} className="flex justify-between gap-3">
                      <span>
                        <strong className="font-mono">{e.tipo}</strong> {e.messaggio}
                      </span>
                      <span style={{ color: "var(--muted-mk)" }}>{format(new Date(e.ricevutoAt), "P", { locale: it })}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <>
            <p className="text-xs" style={{ color: "var(--muted-mk)" }}>
              Questa fattura non è ancora stata trasmessa. Controlla i dati, poi invia: il file XML parte verso lo SdI tramite il tuo intermediario.
            </p>
            {!anteprimaAperta && (
              <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setAnteprimaAperta(true)}>
                <FileCode2 className="h-4 w-4" /> Controlla prima di inviare
              </button>
            )}
            {anteprimaAperta && anteprima.isLoading && <p className="text-xs">Controllo in corso…</p>}
            {anteprimaAperta && anteprima.isError && <p className="text-xs" style={{ color: "var(--red)" }}>{(anteprima.error as Error).message}</p>}
            {anteprima.data && (
              <div className="space-y-2">
                <Problemi titolo="Da correggere prima di inviare" problemi={anteprima.data.validazione.errori} tono="errore" />
                <Problemi titolo="Da sapere" problemi={anteprima.data.validazione.avvisi} tono="avviso" />
                {anteprima.data.validazione.ok && anteprima.data.validazione.errori.length === 0 && (
                  <div className="notice info">
                    <CheckCircle2 />
                    <span className="grow">
                      Il documento è conforme. Destinatario <strong className="font-mono">{anteprima.data.destinatario.codice}</strong>
                      {anteprima.data.bolloCents > 0 ? ` · bollo ${formatCents(anteprima.data.bolloCents)}` : ""}.
                    </span>
                  </div>
                )}
                <details>
                  <summary className="text-link text-xs">Vedi l'XML che verrà trasmesso</summary>
                  <pre className="mt-2 text-[10px] overflow-x-auto p-2 rounded" style={{ background: "var(--surface-2-mk, #f8fafc)", maxHeight: 260 }}>
                    {anteprima.data.xml}
                  </pre>
                </details>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="btn btn-sm btn-navy" onClick={() => invia.mutate()} disabled={invia.isPending || !inviabile}>
                <Send className="h-4 w-4" /> Invia allo SdI
              </button>
              {!inviabile && <span className="text-xs" style={{ color: "var(--muted-mk)" }}>Invia prima la fattura al cliente.</span>}
            </div>
            {!fiscale && (
              <p className="text-xs" style={{ color: "var(--muted-mk)" }}>
                Il modulo non è ancora configurato: completa i passi in{" "}
                <Link href="/dashboard/settings?tab=sdi" className="text-link">
                  Impostazioni → Fatture elettroniche
                </Link>
                .
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
