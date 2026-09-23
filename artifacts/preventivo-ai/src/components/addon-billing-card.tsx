import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { formatPrezzoOfferta } from "@workspace/config";
import { addonsApi } from "@/lib/addons-api";

// A-5: l'add-on Amministrazione nella scheda Fatturazione, accanto al piano.
// In bozza compare solo a chi lo ha già (beta o abbonamento): per gli altri
// l'offerta non esiste ancora.

export function AddonBillingCard() {
  const riepilogo = useQuery({ queryKey: ["addons", "amministrazione"], queryFn: addonsApi.riepilogo, staleTime: 60_000 });
  const r = riepilogo.data;
  if (!r) return null;
  const abb = r.abbonamento;
  if (r.offerta.stato === "bozza" && !abb.attivo) return null;

  const stato = abb.attivo
    ? abb.stato === "beta"
      ? `Accesso beta${abb.betaFino ? ` fino al ${new Date(abb.betaFino).toLocaleDateString("it-IT")}` : ""}`
      : abb.stato === "insoluto"
        ? "Pagamento non riuscito: Stripe riproverà"
        : `Attivo${abb.intervallo ? `, ${abb.intervallo}` : ""}`
    : `Da ${formatPrezzoOfferta(r.prezzo.mensileEffettivoCents)} al mese ${r.offerta.etichettaIva}`;

  return (
    <div className="card">
      <div className="p-5 pt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-muted flex items-center justify-center">
              <Landmark className="h-5 w-5 text-navy-500" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">Add-on: {r.offerta.nome}</p>
              <p className="text-xs text-muted-foreground">{stato}</p>
            </div>
          </div>
          <Link href="/dashboard/amministrazione/attiva" className="btn btn-outline-navy btn-sm shrink-0">
            {abb.attivo ? "Dettagli" : "Scopri"}
          </Link>
        </div>
      </div>
    </div>
  );
}
