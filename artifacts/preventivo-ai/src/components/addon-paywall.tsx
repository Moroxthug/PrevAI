import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { formatPrezzoOfferta } from "@workspace/config";
import { addonsApi, statoOffertaLocale } from "@/lib/addons-api";

// A-5: cosa vede chi apre una pagina del modulo Amministrazione senza averlo.
//
// Finché l'offerta è in bozza il messaggio resta quello di sempre (il modulo
// non esiste per gli utenti, e un paywall con un prezzo non deciso sarebbe
// una promessa). Dopo, la pagina spiega cosa si sblocca e porta alla pagina
// di attivazione, dove sta il prezzo della variante dell'impresa.

export type MotivoPaywall = "fiscale" | "suite" | "sdi";

const TESTI: Record<MotivoPaywall, { titolo: string; corpo: string; spento: string }> = {
  fiscale: {
    titolo: "Il calcolo fiscale fa parte del modulo PrevAI Fisco",
    corpo: "Quanto pagherai di imposta e contributi sul lavoro incassato, quanto mettere via ogni mese, quanto manca alla soglia degli 85.000 € e lo scadenzario completo.",
    spento: "Il calcolo fiscale non è attivo su questo account.",
  },
  suite: {
    titolo: "Questa parte è inclusa nell'add-on PrevAI Fisco",
    corpo: "F24 precompilati, prima nota con l'estratto conto della banca, chiusura d'anno col prospetto per la dichiarazione e il link in sola lettura per il commercialista.",
    spento: "Il modulo PrevAI Fisco non è attivo su questo account.",
  },
  sdi: {
    titolo: "Le fatture elettroniche fanno parte dell'add-on PrevAI Fisco",
    corpo: "Dalla fattura di PrevAI allo SdI in un passaggio, con ricevute, conservazione a norma, bollo virtuale e le fatture dei fornitori che entrano nei costi di cantiere.",
    spento: "Il modulo PrevAI Fisco non è attivo su questo account.",
  },
};

export function AddonPaywall({ motivo }: { motivo: MotivoPaywall }) {
  const stato = statoOffertaLocale();
  const testi = TESTI[motivo];
  const riepilogo = useQuery({ queryKey: ["addons", "amministrazione"], queryFn: addonsApi.riepilogo, enabled: stato !== "bozza", staleTime: 60_000 });

  if (stato === "bozza") {
    return (
      <div className="card">
        <div className="act-body text-sm">{testi.spento}</div>
      </div>
    );
  }

  const prezzo = riepilogo.data?.prezzo;
  return (
    <section className="card" aria-labelledby="paywall-titolo">
      <div className="act-body" style={{ display: "grid", gap: 10 }}>
        <h2 id="paywall-titolo" className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 800, color: "var(--navy)" }}>
          <Lock className="h-5 w-5" aria-hidden="true" /> {testi.titolo}
        </h2>
        <p className="text-sm">{testi.corpo}</p>
        {prezzo && (
          <p className="text-sm">
            Da <strong>{formatPrezzoOfferta(prezzo.mensileEffettivoCents)}</strong> al mese {riepilogo.data?.offerta.etichettaIva}.
          </p>
        )}
        <div>
          <Link href="/dashboard/amministrazione/attiva" className="btn btn-navy btn-sm">
            {stato === "vendita" ? "Scopri e attiva" : "Scopri l'add-on"}
          </Link>
        </div>
      </div>
    </section>
  );
}
