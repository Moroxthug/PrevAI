import { Sparkles } from "lucide-react";
import { OFFERTA_AMMINISTRAZIONE, formatPrezzo, type StatoOfferta } from "@workspace/config";
import type { StatoFondatoriDto } from "@/lib/addons-api";

// A-5: il prezzo fondatori di PrevAI Fisco. Condizioni da @workspace/config,
// posti rimasti dal server (conteggio vero degli abbonamenti a quel prezzo).
//
// Il contatore compare solo quando si può comprare: mostrarlo in fase di
// "interesse", quando nessuno può ancora prendere un posto, sarebbe urgenza
// senza motivo. Esauriti i posti o passata la data, il riquadro sparisce.

const F = OFFERTA_AMMINISTRAZIONE.fondatori;

function dataFine(): string {
  return new Date(F.finoAl).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

export function FondatoriBox({ stato, fondatori, compatto = false }: { stato: StatoOfferta; fondatori?: StatoFondatoriDto | null; compatto?: boolean }) {
  if (stato === "bozza") return null;
  if (stato === "vendita" && fondatori && !fondatori.aperti) return null;
  const prezzi = `${formatPrezzo(F.mensileCents)} al mese o ${formatPrezzo(F.annualeCents)} all'anno, IVA inclusa`;
  return (
    <div
      role="note"
      className="card"
      style={{ padding: compatto ? 14 : 18, borderColor: "var(--yellow-dark, #b45309)", display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left" }}
    >
      <Sparkles className="h-5 w-5 shrink-0" style={{ color: "var(--yellow-dark, #b45309)", marginTop: 2 }} aria-hidden="true" />
      <div style={{ fontSize: 14 }}>
        <p style={{ fontWeight: 700, color: "var(--navy)" }}>{stato === "vendita" ? "Prezzo fondatori" : "Al lancio: prezzo fondatori"}</p>
        <p style={{ marginTop: 4 }}>
          {prezzi}, bloccato finché resti abbonato. Per le prime {F.posti} imprese che si abbonano entro il {dataFine()}.
        </p>
        {stato === "vendita" && fondatori && (
          <p style={{ marginTop: 4, fontWeight: 700 }} aria-live="polite">
            Restano {fondatori.rimasti} posti su {fondatori.posti}.
          </p>
        )}
      </div>
    </div>
  );
}
