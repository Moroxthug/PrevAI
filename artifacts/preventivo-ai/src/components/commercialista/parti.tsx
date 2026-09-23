import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Loader2, Send } from "lucide-react";
import type { Documento } from "@workspace/config";
import { useToast } from "@/hooks/use-toast";
import { ErroreApiFiscale, type EventoDto, type MessaggioDto } from "@/lib/commercialista-api";

// ── A-6: pezzi comuni alla pagina dell'impresa e allo studio ─────────────────

/** Un documento da leggere prima di firmarlo: tutto il testo, niente riassunti. */
export function DocumentoTesto({ documento, id }: { documento: Documento; id?: string }) {
  return (
    <article id={id} className="text-sm" style={{ lineHeight: 1.6 }}>
      <h3 className="font-semibold" style={{ color: "var(--navy)", marginBottom: 4 }}>
        {documento.titolo}
      </h3>
      <p className="text-xs" style={{ color: "var(--muted-mk)", marginBottom: 8 }}>
        Versione {documento.versione}
      </p>
      {documento.sezioni.map((s) => (
        <section key={s.titolo} style={{ marginBottom: 10 }}>
          <h4 className="font-semibold" style={{ fontSize: 13 }}>
            {s.titolo}
          </h4>
          <p>{s.testo}</p>
        </section>
      ))}
    </article>
  );
}

/** Una casella che scorre, per i testi lunghi da leggere dentro una card. */
export function Scorrevole({ children, etichetta }: { children: React.ReactNode; etichetta: string }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={etichetta}
      style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--border-mk, #e2e8f0)", borderRadius: 12, padding: 16, background: "var(--bg-soft, #f8fafc)" }}
    >
      {children}
    </div>
  );
}

const ATTORI: Record<EventoDto["attore"], string> = { cliente: "Impresa", professionista: "Professionista", prevai: "PrevAI", sistema: "Automatico" };

/** La storia dell'incarico, accessi del professionista compresi. */
export function Cronologia({ eventi }: { eventi: EventoDto[] }) {
  if (eventi.length === 0) return <p className="text-sm" style={{ color: "var(--muted-mk)" }}>Ancora nessun evento.</p>;
  return (
    <ol className="text-sm space-y-2" style={{ listStyle: "none", padding: 0 }}>
      {eventi.map((e) => (
        <li key={e.id} className="flex items-start gap-3">
          <span className="text-xs tabular-nums" style={{ color: "var(--muted-mk)", minWidth: 120 }}>
            {format(new Date(e.at), "d MMM yyyy, HH:mm", { locale: it })}
          </span>
          <span className="grow">
            {e.etichetta}
            {typeof e.dettagli.risorsa === "string" && <span style={{ color: "var(--muted-mk)" }}> · {String(e.dettagli.risorsa)}</span>}
            {typeof e.dettagli.motivo === "string" && e.dettagli.motivo && <span style={{ color: "var(--muted-mk)" }}> · {String(e.dettagli.motivo)}</span>}
            {typeof e.dettagli.protocollo === "string" && <span style={{ color: "var(--muted-mk)" }}> · protocollo {String(e.dettagli.protocollo)}</span>}
          </span>
          <span className="chip chip-grey">{ATTORI[e.attore]}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * La chat di consulenza. Nessun assistente IA qui dentro, e nessuno di
 * PrevAI: scrivono solo l'impresa e il professionista dell'incarico.
 */
export function Chat(props: {
  chiave: readonly unknown[];
  io: MessaggioDto["autore"];
  nomeAltro: string;
  carica: () => Promise<{ messaggi: MessaggioDto[] }>;
  invia: ((testo: string) => Promise<unknown>) | null;
  nota?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testo, setTesto] = useState("");
  const fine = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: props.chiave, queryFn: props.carica, refetchInterval: 30_000 });
  const invia = useMutation({
    mutationFn: (t: string) => props.invia!(t),
    onSuccess: () => {
      setTesto("");
      queryClient.invalidateQueries({ queryKey: props.chiave });
    },
    onError: (err) => toast({ title: "Messaggio non inviato", description: err instanceof ErroreApiFiscale ? err.message : "Riprova", variant: "destructive" }),
  });
  const messaggi = q.data?.messaggi ?? [];
  useEffect(() => {
    fine.current?.scrollIntoView({ block: "nearest" });
  }, [messaggi.length]);

  return (
    <div>
      <div tabIndex={0} role="log" aria-label="Messaggi" style={{ maxHeight: 360, overflowY: "auto", padding: "4px 0" }}>
        {q.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!q.isLoading && messaggi.length === 0 && <p className="text-sm" style={{ color: "var(--muted-mk)" }}>Nessun messaggio.</p>}
        {messaggi.map((m) => {
          const mio = m.autore === props.io;
          return (
            <div key={m.id} className="flex" style={{ justifyContent: mio ? "flex-end" : "flex-start", marginBottom: 8 }}>
              <div
                style={{
                  maxWidth: "80%",
                  padding: "8px 12px",
                  borderRadius: 12,
                  background: mio ? "var(--navy)" : "var(--bg-soft, #f1f5f9)",
                  color: mio ? "#fff" : "inherit",
                  whiteSpace: "pre-wrap",
                }}
              >
                <div className="text-xs" style={{ opacity: 0.75, marginBottom: 2 }}>
                  {mio ? "Tu" : props.nomeAltro} · {format(new Date(m.createdAt), "d MMM, HH:mm", { locale: it })}
                  {mio && m.lettoAt ? " · letto" : ""}
                </div>
                <div className="text-sm">{m.testo}</div>
              </div>
            </div>
          );
        })}
        <div ref={fine} />
      </div>
      {props.nota && (
        <p className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 8 }}>
          {props.nota}
        </p>
      )}
      {props.invia && (
        <form
          className="flex gap-2 items-end"
          style={{ marginTop: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (testo.trim()) invia.mutate(testo);
          }}
        >
          <div className="field grow" style={{ marginBottom: 0 }}>
            <label htmlFor="chat-testo" className="sr-only">
              Scrivi un messaggio
            </label>
            <textarea id="chat-testo" rows={2} maxLength={4000} value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Scrivi un messaggio" />
          </div>
          <button type="submit" className="btn btn-sm btn-navy" disabled={invia.isPending || !testo.trim()}>
            {invia.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Invia
          </button>
        </form>
      )}
    </div>
  );
}
