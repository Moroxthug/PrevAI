import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, BellRing, Check, CheckCircle2, Landmark, Loader2 } from "lucide-react";
import { useCreateCustomerPortalSession, useGetBusinessProfile } from "@workspace/api-client-react";
import { formatPrezzoOfferta, type IntervalloAddon } from "@workspace/config";
import { useToast } from "@/hooks/use-toast";
import { hasFeature } from "@/lib/plans";
import { ErroreApiAddon, addonsApi, type RiepilogoAddonDto } from "@/lib/addons-api";
import { FondatoriBox } from "@/components/fondatori-box";

// A-5: la pagina dell'add-on Amministrazione dentro l'app — paywall, test di
// prezzo e checkout.
//
// Cosa mostra dipende dallo stato dell'offerta, che il server calcola dai
// prerequisiti (D5, D6, D8) e non dalla sola configurazione:
//   - bozza: anteprima per lo staff, con l'elenco di ciò che manca al lancio;
//   - interesse: il prezzo della variante e "avvisami", niente pagamento;
//   - vendita: il checkout Stripe.
// Il prezzo è sempre quello della variante assegnata all'impresa: lo stesso
// che vedrà su Stripe, perché il checkout rifiuta un Price diverso.

const STATO_ABBONAMENTO: Record<string, string> = {
  attivo: "Attivo",
  prova: "In prova",
  insoluto: "Pagamento non riuscito — Stripe riproverà",
  beta: "Accesso beta",
  cessato: "Non attivo",
};

function data(iso: string | null): string {
  return iso ? format(new Date(iso), "d MMMM yyyy", { locale: it }) : "";
}

function Voci({ riepilogo }: { riepilogo: RiepilogoAddonDto }) {
  // Il badge "Gratis" compare solo quando il livello gratuito esiste davvero
  // (offerta pubblica e regole revisionate): prima, tutto è parte dell'add-on.
  const gratis = riepilogo.offerta.gratuitoAttivo;
  return (
    <ul className="act-body" style={{ display: "grid", gap: 12 }} aria-label="Cosa comprende l'add-on">
      {riepilogo.offerta.voci.map((v) => (
        <li key={v.titolo} className="flex gap-2" style={{ alignItems: "flex-start" }}>
          <Check className="h-4 w-4 shrink-0" style={{ color: "var(--green)", marginTop: 3 }} aria-hidden="true" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="flex gap-2 flex-wrap" style={{ fontWeight: 600, alignItems: "center" }}>
              {v.titolo}
              {gratis && v.gratuita && (
                <span className="text-xs" style={{ fontWeight: 700, color: "var(--green)" }}>
                  Gratis in ogni piano
                </span>
              )}
            </div>
            <div className="text-xs" style={{ color: "var(--muted-mk)" }}>
              {v.dettaglio}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Prezzo({ riepilogo, intervallo, onIntervallo }: { riepilogo: RiepilogoAddonDto; intervallo: IntervalloAddon; onIntervallo: (i: IntervalloAddon) => void }) {
  const p = riepilogo.prezzo;
  const mensile = p.mensileEffettivoCents;
  const listino = intervallo === "mensile" ? mensile : p.annualeCents;
  // In vendita, con posti fondatori liberi, si paga il prezzo fondatori se è più
  // basso (il server fa la stessa scelta al checkout): il listino resta barrato.
  const f = riepilogo.fondatori;
  const fondatoriCents = intervallo === "mensile" ? f.mensileCents : f.annualeCents;
  const daFondatore = riepilogo.offerta.stato === "vendita" && f.aperti && fondatoriCents < listino;
  const importo = daFondatore ? fondatoriCents : listino;
  const risparmio = p.mensileCents * 12 - p.annualeCents;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div role="radiogroup" aria-label="Periodicità" className="flex gap-2">
        {(["mensile", "annuale"] as const).map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={intervallo === i}
            className={`btn btn-sm ${intervallo === i ? "btn-navy" : "btn-outline-navy"}`}
            onClick={() => onIntervallo(i)}
          >
            {i === "mensile" ? "Mensile" : "Annuale"}
          </button>
        ))}
      </div>
      <div>
        {daFondatore && (
          <span className="text-sm" style={{ textDecoration: "line-through", marginRight: 8, color: "var(--muted-mk)" }}>
            {formatPrezzoOfferta(listino)}
          </span>
        )}
        <span style={{ fontSize: 34, fontWeight: 800, color: "var(--navy)" }}>{formatPrezzoOfferta(importo)}</span>{" "}
        <span className="text-sm">
          {intervallo === "mensile" ? "al mese" : "all'anno"} {riepilogo.offerta.etichettaIva}
        </span>
      </div>
      {intervallo === "mensile" && p.conElite && (
        <p className="text-sm">Prezzo riservato a chi ha il piano Elite (invece di {formatPrezzoOfferta(p.mensileCents)}).</p>
      )}
      {intervallo === "annuale" && risparmio > 0 && !daFondatore && <p className="text-sm">Due mesi gratis rispetto al mensile: risparmi {formatPrezzoOfferta(risparmio)}.</p>}
      <FondatoriBox stato={riepilogo.offerta.stato} fondatori={f} compatto />
    </div>
  );
}

export default function AmministrazioneAttivaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [intervallo, setIntervallo] = useState<IntervalloAddon>("annuale");
  const riepilogo = useQuery({ queryKey: ["addons", "amministrazione"], queryFn: addonsApi.riepilogo });
  const { data: profile } = useGetBusinessProfile();
  const portal = useCreateCustomerPortalSession();
  const esito = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("esito") : null;

  // Una vista per caricamento di pagina, e solo quando l'offerta è pubblica
  // (il server lo ricontrolla e deduplica per giorno).
  const vistaInviata = useRef(false);
  const stato = riepilogo.data?.offerta.stato;
  useEffect(() => {
    if (!stato || stato === "bozza" || vistaInviata.current) return;
    vistaInviata.current = true;
    addonsApi
      .evento("vista")
      .then(() => queryClient.invalidateQueries({ queryKey: ["addons", "amministrazione"] }))
      .catch(() => undefined);
  }, [stato, queryClient]);

  // Al ritorno da Stripe il webhook può arrivare qualche secondo dopo il
  // redirect: si riprova per mezzo minuto finché l'abbonamento risulta attivo.
  const attivo = riepilogo.data?.abbonamento.attivo ?? false;
  useEffect(() => {
    if (esito !== "ok" || attivo) return;
    const timer = window.setInterval(() => queryClient.invalidateQueries({ queryKey: ["addons", "amministrazione"] }), 3000);
    const stop = window.setTimeout(() => window.clearInterval(timer), 30_000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [esito, attivo, queryClient]);

  const interesse = useMutation({
    mutationFn: () => addonsApi.evento("interesse"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addons", "amministrazione"] }),
    onError: (err: Error) => toast({ title: "Non è stato possibile registrarti", description: err.message, variant: "destructive" }),
  });

  const checkout = useMutation({
    mutationFn: () => addonsApi.checkout(intervallo),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err: Error) => {
      const codice = err instanceof ErroreApiAddon ? err.codice : "";
      toast({
        title: codice === "two_factor_not_enabled" ? "Serve la verifica in due passaggi" : "Pagamento non avviato",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (riepilogo.isLoading || !riepilogo.data) {
    return (
      <div className="card">
        <div className="act-body flex justify-center">{riepilogo.isError ? (riepilogo.error as Error).message : <Loader2 className="h-5 w-5 animate-spin" />}</div>
      </div>
    );
  }

  const r = riepilogo.data;
  const abb = r.abbonamento;
  const senzaFatture = profile ? !hasFeature(profile as never, "invoicing") : false;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="page-head">
        <div>
          <h1 className="flex items-center gap-2">
            <Landmark className="h-7 w-7 text-navy-500" />
            {r.offerta.nome}
          </h1>
          <p className="sub">Fatture elettroniche, tasse del forfettario, scadenze e chiusura d'anno, dentro lo stesso strumento dei tuoi preventivi.</p>
        </div>
      </div>

      {r.offerta.stato === "bozza" && (
        <section className="card" style={{ marginTop: 16, borderColor: "var(--yellow-dark)" }} role="status">
          <div className="act-body text-sm" style={{ display: "grid", gap: 6 }}>
            <strong className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Anteprima interna: l'offerta non è pubblica
            </strong>
            <span>Gli utenti non vedono questa pagina, il menu non la mostra e il pagamento è disattivato. Per pubblicarla manca:</span>
            <ul style={{ paddingLeft: 18, listStyle: "disc" }}>
              {r.offerta.mancanti.map((m) => (
                <li key={m}>{m}</li>
              ))}
              <li>Portare lo stato richiesto oltre "bozza" in lib/config/src/offerta.ts.</li>
            </ul>
          </div>
        </section>
      )}

      {esito === "ok" && !abb.attivo && (
        <section className="card" style={{ marginTop: 16 }} role="status">
          <div className="act-body text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Pagamento ricevuto: stiamo attivando l'add-on, di solito serve qualche secondo.
          </div>
        </section>
      )}

      {abb.attivo ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="act-body" style={{ display: "grid", gap: 8 }}>
            <h2 className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 800, color: "var(--navy)" }}>
              <CheckCircle2 className="h-5 w-5" style={{ color: "var(--green)" }} aria-hidden="true" /> {STATO_ABBONAMENTO[abb.stato ?? "attivo"]}
            </h2>
            {abb.stato === "beta" && abb.betaFino && <p className="text-sm">Accesso gratuito fino al {data(abb.betaFino)}. Dopo, potrai attivare l'abbonamento da qui.</p>}
            {abb.intervallo && abb.finePeriodo && (
              <p className="text-sm">
                Abbonamento {abb.intervallo}. {abb.disdettaAFinePeriodo ? "Disdetto: resta attivo fino al" : "Prossimo rinnovo:"} {data(abb.finePeriodo)}.
              </p>
            )}
            <div className="flex gap-2 flex-wrap">
              <Link href="/dashboard/fisco" className="btn btn-sm btn-navy">
                Vai al Fisco
              </Link>
              <Link href="/dashboard/amministrazione" className="btn btn-sm btn-outline-navy">
                Fatture elettroniche
              </Link>
              {abb.stato !== "beta" && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-navy"
                  disabled={portal.isPending}
                  onClick={() =>
                    portal.mutate(undefined, {
                      onSuccess: (res) => window.open(res.url, "_blank"),
                      onError: () => toast({ title: "Portale di Stripe non disponibile", variant: "destructive" }),
                    })
                  }
                >
                  Gestisci l'abbonamento
                </button>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4" style={{ marginTop: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))" }}>
        <section className="card">
          <div className="card-head">
            <h2>Cosa comprende</h2>
          </div>
          <Voci riepilogo={r} />
        </section>

        {(!abb.attivo || abb.stato === "beta") && (
          <section className="card">
            <div className="card-head">
              <h2>Prezzo</h2>
            </div>
            <div className="act-body" style={{ display: "grid", gap: 14 }}>
              <Prezzo riepilogo={r} intervallo={intervallo} onIntervallo={setIntervallo} />
              {r.offerta.stato === "vendita" ? (
                <button type="button" className="btn btn-navy" disabled={checkout.isPending} onClick={() => checkout.mutate()}>
                  {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Attiva con Stripe
                </button>
              ) : r.interesseRegistrato ? (
                <p className="text-sm flex items-center gap-2" role="status">
                  <CheckCircle2 className="h-4 w-4" style={{ color: "var(--green)" }} aria-hidden="true" /> Interesse registrato. Quando l'add-on sarà disponibile lo troverai qui.
                </p>
              ) : (
                <button type="button" className="btn btn-navy" disabled={r.offerta.stato === "bozza" || interesse.isPending} onClick={() => interesse.mutate()}>
                  <BellRing className="h-4 w-4" aria-hidden="true" /> Mi interessa, avvisami
                </button>
              )}
              <p className="text-xs" style={{ color: "var(--muted-mk)" }}>
                Disdici quando vuoi dal portale di Stripe. Con l'add-on attivo la verifica in due passaggi diventa obbligatoria per tutta l'impresa: la tua posizione fiscale è un dato da proteggere.
              </p>
            </div>
          </section>
        )}
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="act-body text-sm" style={{ display: "grid", gap: 6 }}>
          <strong>Cosa non fa</strong>
          <span>
            PrevAI è uno strumento: calcola, prepara e ti ricorda, ma i versamenti li disponi tu e la dichiarazione dei redditi la invii tu o il tuo commercialista. Non dà
            consulenza fiscale personalizzata e non sostituisce un professionista iscritto all'Albo.
          </span>
          {senzaFatture && <span>Le fatture elettroniche partono dalle fatture di PrevAI, che sono incluse dal piano Pro.</span>}
        </div>
      </section>
    </div>
  );
}
