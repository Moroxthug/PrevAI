import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { formatCents } from "@/lib/jobs-api";
import { ETICHETTE_VERSAMENTO, type PacchettoDto, type PassoGuidaDto } from "@/lib/fiscale-api";

// ── A-4: il pacchetto dell'anno ──────────────────────────────────────────────
// Lo stesso oggetto lo vedono il titolare (Chiusura d'anno), il commercialista
// (link in sola lettura) e il PDF: queste sezioni sono condivise apposta, così
// le due pagine non possono raccontare numeri diversi.

const euro = formatCents;

export function Avvertenze({ pacchetto }: { pacchetto: PacchettoDto }) {
  return (
    <div className="notice warn" style={{ alignItems: "flex-start" }}>
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <div className="grow text-sm">
        {pacchetto.prospetto.avvertenze.map((a) => (
          <p key={a} style={{ margin: "2px 0" }}>
            {a}
          </p>
        ))}
      </div>
    </div>
  );
}

export function Prospetto({ pacchetto }: { pacchetto: PacchettoDto }) {
  const p = pacchetto.prospetto;
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2>Prospetto per la dichiarazione</h2>
          <p className="sub">
            Modello Redditi PF {p.annoPresentazione}, quadri LM (forfettari) e RR (contributi). Invio entro il{" "}
            {format(new Date(`${p.termineInvio}T12:00:00`), "d MMMM yyyy", { locale: it })}.
          </p>
        </div>
      </div>
      <div className="act-body" style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="Righi della dichiarazione">
        <table style={{ width: "100%", minWidth: 480 }}>
          <thead>
            <tr className="text-xs" style={{ color: "var(--muted-mk)" }}>
              <th style={{ textAlign: "left", paddingRight: 12 }}>Rigo</th>
              <th style={{ textAlign: "left" }}>Voce</th>
              <th style={{ textAlign: "right" }}>Valore</th>
            </tr>
          </thead>
          <tbody>
            {p.righi.map((r, i) => (
              <tr key={`${r.rigo}-${i}`} style={{ borderTop: "1px solid var(--line)" }}>
                <td className="font-mono text-xs" style={{ padding: "8px 12px 8px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>
                  {r.rigo}
                </td>
                <td style={{ padding: "8px 8px 8px 0" }}>
                  <div className="text-sm">{r.descrizione}</div>
                  {r.nota && (
                    <div className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 2 }}>
                      {r.nota}
                    </div>
                  )}
                </td>
                <td className="font-mono text-sm" style={{ textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top", padding: "8px 0", fontWeight: r.importoCents !== undefined ? 600 : undefined }}>
                  {r.valore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Utile({ pacchetto }: { pacchetto: PacchettoDto }) {
  const u = pacchetto.utile;
  const t = pacchetto.primaNota.totali;
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2>Risultato dell'anno</h2>
          <p className="sub">Per cassa: incassi e pagamenti dell'anno, meno imposta e contributi di competenza.</p>
        </div>
      </div>
      <div className="act-body">
        <table className="text-sm" style={{ width: "100%" }}>
          <tbody>
            {(
              [
                ["Ricavi incassati", u.ricaviCents],
                ["Costi pagati", -u.costiCents],
                ["Imposta sostitutiva", -u.impostaCents],
                ["Contributi previdenziali", -u.contributiCents],
                ...(u.bolloCents > 0 ? [["Imposta di bollo", -u.bolloCents] as [string, number]] : []),
              ] as [string, number][]
            ).map(([e, c]) => (
              <tr key={e}>
                <td style={{ padding: "3px 0" }}>{e}</td>
                <td className="font-mono" style={{ textAlign: "right" }}>
                  {c < 0 ? "− " + euro(-c) : euro(c)}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "6px 0", fontWeight: 600 }}>Utile netto</td>
              <td className="font-mono" style={{ textAlign: "right", fontWeight: 600, color: u.utileNettoCents < 0 ? "var(--red)" : undefined }}>
                {euro(u.utileNettoCents)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs" style={{ color: "var(--muted-mk)", marginTop: 8 }}>
          Prima nota: {pacchetto.primaNota.voci} movimenti, entrate {euro(t.entrateCents)}, uscite {euro(t.usciteCents)} (di cui tasse e contributi versati{" "}
          {euro(t.versamentiCents)}, prelievi e giroconti {euro(t.movimentiNeutriCents)}). Estratto conto: {pacchetto.banca.daAbbinare.n} movimenti da abbinare.
        </p>
        {pacchetto.primaNota.avvisi.map((a) => (
          <p key={a.id} className="text-xs" style={{ color: "var(--yellow-dark)", marginTop: 4 }}>
            • {a.testo}
          </p>
        ))}
      </div>
    </section>
  );
}

export function Versamenti({ pacchetto }: { pacchetto: PacchettoDto }) {
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2>Versamenti registrati per il {pacchetto.anno}</h2>
          <p className="sub">Quelli segnati nello scadenzario o registrati a mano. Gli F24 fatti fuori da PrevAI qui non ci sono.</p>
        </div>
      </div>
      <div>
        {pacchetto.versamenti.length === 0 ? (
          <div className="act-body text-sm" style={{ color: "var(--muted-mk)" }}>
            Nessun versamento registrato.
          </div>
        ) : (
          pacchetto.versamenti.map((v, i) => (
            <div key={i} className="item-row flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm">{ETICHETTE_VERSAMENTO[v.tipo] ?? v.tipo}</div>
                <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
                  {format(new Date(`${v.data}T12:00:00`), "d MMM yyyy", { locale: it })}
                  {v.codiceTributo && ` · codice ${v.codiceTributo}`}
                  {v.riferimento && ` · ${v.riferimento}`}
                </div>
              </div>
              <strong className="font-mono text-sm">{euro(v.importoCents)}</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function Guida({ passi }: { passi: PassoGuidaDto[] }) {
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <h2>Se la presenti da solo</h2>
          <p className="sub">La dichiarazione si può presentare da sé, con SPID o CIE, senza intermediari. Ecco dove guardare.</p>
        </div>
      </div>
      <ol className="act-body text-sm" style={{ paddingLeft: 38, listStyle: "decimal" }}>
        {passi.map((p) => (
          <li key={p.titolo} style={{ marginBottom: 8 }}>
            <strong>{p.titolo}.</strong> {p.testo}
          </li>
        ))}
      </ol>
    </section>
  );
}
