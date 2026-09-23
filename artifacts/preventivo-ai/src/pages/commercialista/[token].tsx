import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, Download, Loader2, Lock } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useNoIndex } from "@/hooks/use-no-index";
import { Logo } from "@/components/logo";
import { formatCents } from "@/lib/jobs-api";
import { primaNotaApi, type VocePrimaNotaDto } from "@/lib/fiscale-api";
import { Avvertenze, Guida, Prospetto, Utile, Versamenti } from "@/components/fisco/pacchetto-view";

// ── A-4: il pacchetto aperto dal commercialista (/commercialista/:token) ─────
// Sola lettura, senza account. Il titolare vede ogni apertura nel registro
// degli accessi. La pagina non ha link verso il resto del prodotto e non
// finisce nei motori di ricerca (robots.txt, X-Robots-Tag, meta robots).

const euro = formatCents;

function Movimenti({ voci }: { voci: VocePrimaNotaDto[] }) {
  const [tutte, setTutte] = useState(false);
  const mostrate = useMemo(() => (tutte ? voci : voci.slice(0, 50)), [voci, tutte]);
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2>Prima nota</h2>
          <p className="sub">{voci.length} movimenti per data di cassa. Il CSV completo si scarica in alto.</p>
        </div>
      </div>
      <div className="act-body" style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="Movimenti della prima nota">
        <table style={{ width: "100%", minWidth: 520 }}>
          <thead>
            <tr className="text-xs" style={{ color: "var(--muted-mk)" }}>
              <th style={{ textAlign: "left" }}>Data</th>
              <th style={{ textAlign: "left" }}>Descrizione</th>
              <th style={{ textAlign: "right" }}>Entrata</th>
              <th style={{ textAlign: "right" }}>Uscita</th>
            </tr>
          </thead>
          <tbody>
            {mostrate.map((v) => (
              <tr key={v.chiave} style={{ borderTop: "1px solid var(--line)" }}>
                <td className="text-xs" style={{ whiteSpace: "nowrap", padding: "6px 8px 6px 0", color: "var(--muted-mk)" }}>
                  {format(new Date(`${v.data}T12:00:00`), "d MMM", { locale: it })}
                </td>
                <td className="text-sm" style={{ padding: "6px 8px 6px 0" }}>
                  {v.descrizione}
                  <span className="text-xs" style={{ color: "var(--muted-mk)" }}>
                    {" "}
                    · {v.categoria}
                    {v.controparte ? ` · ${v.controparte}` : ""}
                    {!v.incideSulUtile ? " · non conta nell'utile" : ""}
                  </span>
                </td>
                <td className="font-mono text-sm" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {v.tipo === "entrata" ? euro(v.importoCents) : ""}
                </td>
                <td className="font-mono text-sm" style={{ textAlign: "right", whiteSpace: "nowrap", paddingLeft: 12 }}>
                  {v.tipo === "uscita" ? euro(v.importoCents) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tutte && voci.length > 50 && (
          <button type="button" className="btn btn-sm btn-outline-navy" style={{ marginTop: 12 }} onClick={() => setTutte(true)}>
            Mostra tutti i {voci.length} movimenti
          </button>
        )}
      </div>
    </section>
  );
}

export default function CommercialistaPage() {
  const { token } = useParams<{ token: string }>();
  useNoIndex();
  const q = useQuery({ queryKey: ["commercialista", token], queryFn: () => primaNotaApi.pubblico(token), retry: false });
  useDocumentTitle(q.data ? `Pacchetto ${q.data.pacchetto.anno} — ${q.data.pacchetto.impresa.denominazione}` : "PrevAI");

  if (q.isLoading) {
    return (
      <div className="doc-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--navy)" }} />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="doc-shell flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <AlertTriangle className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--yellow-dark)" }} />
          <h1 className="text-lg font-semibold" style={{ color: "var(--navy)" }}>
            Link non disponibile
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--muted-mk)" }}>
            Il link è scaduto, è stato revocato o non è corretto. Chiedi all'impresa di mandartene uno nuovo.
          </p>
        </div>
      </div>
    );
  }

  const d = q.data;
  const p = d.pacchetto;

  return (
    <div className="doc-shell" style={{ padding: "24px 16px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 16 }}>
          <Logo />
          <span className="chip chip-grey">
            <Lock className="h-3 w-3" style={{ marginRight: 4 }} /> Sola lettura · scade il {format(new Date(d.scadeAt), "d MMM yyyy", { locale: it })}
          </span>
        </div>

        <div className="page-head">
          <div>
            <h1>
              {p.impresa.denominazione || "Impresa"} — anno {p.anno}
            </h1>
            <p className="sub">
              {[p.impresa.partitaIva && `P. IVA ${p.impresa.partitaIva}`, p.impresa.codiceFiscale && `C.F. ${p.impresa.codiceFiscale}`, p.profilo.codiceAteco && `ATECO ${p.profilo.codiceAteco}`, `coefficiente ${p.profilo.coefficientePercent} %`]
                .filter(Boolean)
                .join(" · ")}
              . Condiviso con {d.destinatario}.
            </p>
          </div>
          <div className="head-actions">
            <a className="btn btn-sm btn-outline-navy" href={primaNotaApi.urlPubblicoCsv(token)}>
              <Download className="h-4 w-4" /> Prima nota CSV
            </a>
            <a className="btn btn-sm btn-navy" href={primaNotaApi.urlPubblicoPdf(token)}>
              <Download className="h-4 w-4" /> Pacchetto PDF
            </a>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <Avvertenze pacchetto={p} />
        </div>
        <div className="notice info" style={{ alignItems: "flex-start", marginTop: 12 }}>
          <div className="grow text-sm">
            {d.chiusura?.stato === "chiuso"
              ? `L'impresa ha chiuso l'anno il ${format(new Date(d.chiusura.chiusoAt), "d MMMM yyyy", { locale: it })} (versione ${d.chiusura.versione}). I numeri qui sotto sono quelli di oggi.`
              : "L'impresa non ha ancora chiuso l'anno: i numeri possono cambiare."}{" "}
            {p.revisione.revisionato
              ? "Le regole di calcolo usate da PrevAI per quest'anno sono state revisionate da un commercialista."
              : `Le regole di calcolo usate da PrevAI non sono ancora state revisionate da un commercialista (${p.prospetto.regoleNonRevisionate.join(", ")} fra quelle di questo prospetto): vanno controllate.`}
          </div>
        </div>

        <Prospetto pacchetto={p} />
        <Utile pacchetto={p} />
        <Versamenti pacchetto={p} />
        <Movimenti voci={d.voci} />
        <Guida passi={d.guida} />

        <p className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 24, textAlign: "center" }}>
          Pacchetto preparato con PrevAI. Non è la dichiarazione dei redditi e non è consulenza: è il prospetto dei numeri dell'impresa.
        </p>
      </div>
    </div>
  );
}
