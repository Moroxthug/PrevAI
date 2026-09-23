import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarClock, Check, FileCheck2, Landmark, PiggyBank, Receipt } from "lucide-react";
import {
  OFFERTA_AMMINISTRAZIONE,
  VOCI_OFFERTA,
  etichettaIva,
  formatPrezzoOfferta,
  statoOfferta,
  varianteDaId,
  variantePredefinita,
  type IntervalloAddon,
  type VariantePrezzo,
} from "@workspace/config";
import { SeoHead } from "@/components/seo-head";
import { useAuth } from "@/hooks/use-auth";
import { useNoIndex } from "@/hooks/use-no-index";
import { addonsApi, ricordaCampagna, type StatoFondatoriDto } from "@/lib/addons-api";
import { FondatoriBox } from "@/components/fondatori-box";
import { FAQ_LANDING_AMMINISTRAZIONE, LANDING_AMMINISTRAZIONE_PATH, LANDING_AMMINISTRAZIONE_SEO, landingAmministrazioneIndicizzabile } from "@/data/amministrazione-landing";

// A-5: landing pubblica dell'add-on Amministrazione, resa al build
// (entry-server.tsx) e idratata. Il prezzo mostrato è quello della variante
// predefinita; con `?v=b` (campagne del test di prezzo) il browser passa alla
// variante indicata dopo l'idratazione e la ricorda per il paywall in app,
// così chi ha visto un prezzo nell'annuncio ritrova lo stesso prezzo dentro.

const PROBLEMI = [
  { icon: PiggyBank, titolo: "Il saldo di giugno arriva come una sorpresa", testo: "Saldo dell'anno prima e primo acconto nello stesso F24: se non hai messo da parte mese per mese, a giugno mancano i soldi." },
  { icon: CalendarClock, titolo: "La soglia la vedi quando è tardi", testo: "Oltre gli 85.000 € di ricavi si esce dal regime. Un cantiere accettato a settembre può bastare, e te ne accorgi a gennaio." },
  { icon: Receipt, titolo: "Fatture, bollo, scadenze: tre strumenti diversi", testo: "Preventivi in un programma, fatture elettroniche in un altro, scadenze su un foglio. Nessuno sa cosa fa l'altro." },
];

export default function AmministrazioneLandingPage() {
  const { isSignedIn } = useAuth();
  const stato = statoOfferta({ anno: new Date().getFullYear() });
  const [variante, setVariante] = useState<VariantePrezzo>(variantePredefinita());
  const [intervallo, setIntervallo] = useState<IntervalloAddon>("annuale");
  const [fondatori, setFondatori] = useState<StatoFondatoriDto | null>(null);

  // Posti fondatori rimasti: solo quando si può comprare, dal conteggio vero.
  useEffect(() => {
    if (stato.effettivo !== "vendita") return;
    addonsApi.offertaPubblica().then((r) => setFondatori(r.fondatori)).catch(() => undefined);
  }, [stato.effettivo]);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("v");
    const scelta = varianteDaId(v);
    if (scelta) {
      setVariante(scelta);
      ricordaCampagna(scelta.id);
    }
  }, []);

  // In bozza la pagina esiste ma non si indicizza (il prerender fa lo stesso sulla pagina statica).
  useNoIndex(!landingAmministrazioneIndicizzabile());

  const importo = intervallo === "mensile" ? variante.mensileCents : variante.annualeCents;
  const cta = isSignedIn ? "/dashboard/amministrazione/attiva" : "/sign-up";
  const ctaTesto = isSignedIn ? "Vai all'add-on" : "Crea l'account gratis";

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={LANDING_AMMINISTRAZIONE_SEO.title}
        description={LANDING_AMMINISTRAZIONE_SEO.description}
        canonical={`https://prevai.it${LANDING_AMMINISTRAZIONE_PATH}`}
      />

      {stato.effettivo === "bozza" && (
        <div role="status" style={{ background: "var(--yellow-soft, #fff7e0)", color: "var(--navy)", textAlign: "center", padding: "8px 16px", fontSize: 13 }}>
          Anteprima: questa offerta non è ancora disponibile e i prezzi possono cambiare.
        </div>
      )}

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ textAlign: "center", maxWidth: 780, margin: "0 auto", padding: "clamp(64px, 8vw, 110px) 16px" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 22, justifyContent: "center", display: "flex" }}>
            {OFFERTA_AMMINISTRAZIONE.nome}
          </p>
          <h1>Sai quanto pagherai di tasse sul lavoro che stai preventivando</h1>
          <p className="lead" style={{ margin: "0 auto" }}>
            Per artigiani in regime forfettario: imposta e contributi calcolati sugli incassi veri, quanto mettere via ogni mese, fatture elettroniche e F24 pronti. Dentro lo
            stesso strumento dei tuoi preventivi e dei tuoi cantieri.
          </p>
          <div className="hero-cta" style={{ justifyContent: "center" }}>
            <Link href={cta} className="btn btn-white">
              {ctaTesto}
            </Link>
            <a href="#cosa" className="btn btn-outline-light">
              Cosa comprende
            </a>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">Il problema</span>
              <h2 className="h2">Nel forfettario il calcolo è semplice. È la disciplina che manca.</h2>
            </div>
          </div>
          <div className="tiles">
            {PROBLEMI.map((p) => (
              <div key={p.titolo} className="tile t-teal">
                <p.icon className="h-6 w-6" aria-hidden="true" />
                <h3>{p.titolo}</h3>
                <p>{p.testo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec soft" id="cosa">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">Cosa comprende</span>
              <h2 className="h2">Dal preventivo accettato alla chiusura dell'anno</h2>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {VOCI_OFFERTA.map((v) => (
              <div key={v.titolo} className="card" style={{ padding: 20 }}>
                <p style={{ fontWeight: 700, color: "var(--navy)", display: "flex", gap: 8, alignItems: "center" }}>
                  <Check className="h-4 w-4 shrink-0" style={{ color: "var(--green)" }} aria-hidden="true" /> {v.titolo}
                  {v.gratuita && stato.gratuitoAttivo && (
                    <span className="text-xs" style={{ marginLeft: "auto", fontWeight: 700, color: "var(--green)" }}>
                      Gratis
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", marginTop: 6 }}>{v.dettaglio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" id="prezzo">
        <div className="wrap" style={{ maxWidth: 560, margin: "0 auto" }}>
          <div className="card" style={{ padding: 28, textAlign: "center" }}>
            <Landmark className="h-7 w-7" style={{ color: "var(--navy)", margin: "0 auto" }} aria-hidden="true" />
            <h2 className="h2" style={{ marginTop: 10 }}>
              Un add-on, qualunque piano tu abbia
            </h2>
            <div role="radiogroup" aria-label="Periodicità" className="flex gap-2" style={{ justifyContent: "center", marginTop: 16 }}>
              {(["mensile", "annuale"] as const).map((i) => (
                <button key={i} type="button" role="radio" aria-checked={intervallo === i} className={`btn btn-sm ${intervallo === i ? "btn-navy" : "btn-outline-navy"}`} onClick={() => setIntervallo(i)}>
                  {i === "mensile" ? "Mensile" : "Annuale"}
                </button>
              ))}
            </div>
            <p style={{ marginTop: 16 }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: "var(--navy)" }}>{formatPrezzoOfferta(importo)}</span>{" "}
              <span>
                {intervallo === "mensile" ? "al mese" : "all'anno"} {etichettaIva()}
              </span>
            </p>
            {intervallo === "annuale" && <p style={{ fontSize: 14, color: "var(--muted-mk)" }}>Due mesi gratis rispetto al mensile.</p>}
            <p style={{ fontSize: 14, color: "var(--muted-mk)", marginTop: 6 }}>
              Con il piano Elite: {formatPrezzoOfferta(OFFERTA_AMMINISTRAZIONE.bundleEliteMensileCents)} al mese.
            </p>
            <div style={{ marginTop: 16 }}>
              <FondatoriBox stato={stato.effettivo} fondatori={fondatori} compatto />
            </div>
            <div style={{ marginTop: 18 }}>
              <Link href={cta} className="btn btn-navy">
                {ctaTesto}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec soft">
        <div className="wrap" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="card" style={{ padding: 22, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <FileCheck2 className="h-5 w-5 shrink-0" style={{ color: "var(--navy)", marginTop: 2 }} aria-hidden="true" />
            <div>
              <p style={{ fontWeight: 700, color: "var(--navy)" }}>Cosa non fa</p>
              <p style={{ fontSize: 14, color: "var(--muted-mk)", marginTop: 4 }}>
                PrevAI è uno strumento, non uno studio professionale: non invia la dichiarazione dei redditi per tuo conto, non dispone versamenti e non dà consulenza
                fiscale personalizzata. Ogni numero ha la sua formula, così tu o il tuo commercialista potete verificarlo.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="domande">
        <div className="wrap" style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 className="h2">Domande frequenti</h2>
          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            {FAQ_LANDING_AMMINISTRAZIONE.map((f) => (
              <details key={f.domanda} className="card" style={{ padding: "14px 18px" }}>
                <summary style={{ fontWeight: 700, color: "var(--navy)", cursor: "pointer" }}>{f.domanda}</summary>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", marginTop: 8 }}>{f.risposta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
