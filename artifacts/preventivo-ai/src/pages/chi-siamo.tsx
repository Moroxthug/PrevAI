import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Link } from "wouter";
import { ArrowRight, Zap, Target, Heart, Users } from "lucide-react";

export default function ChiSiamoPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "prevai",
      url: "https://www.prevai.it/",
      logo: "https://www.prevai.it/icon-192.png",
      description:
        "prevai è il software di preventivazione AI per artigiani e liberi professionisti italiani. Genera preventivi professionali in 30 secondi descrivendo il lavoro in italiano.",
      foundingDate: "2026",
      foundingLocation: { "@type": "Place", name: "Italia" },
      contactPoint: {
        "@type": "ContactPoint",
        email: "info@prevai.it",
        contactType: "customer service",
        availableLanguage: "it",
      },
    },
  ];

  return (
    <PublicLayout>
      <SeoHead
        title="Chi Siamo | prevai — Software Preventivi AI per Artigiani"
        description="prevai nasce per liberare gli artigiani italiani dalla burocrazia. Scopri la nostra missione: preventivi professionali in 30 secondi grazie all'intelligenza artificiale."
        canonical="https://www.prevai.it/chi-siamo/"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-white pt-24 pb-20">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
            <Heart className="h-3.5 w-3.5 fill-current" />
            Fatto in Italia
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-6">
            Siamo prevai.{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Liberiamo gli artigiani dalla burocrazia.
            </span>
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
            In Italia ci sono oltre 1,2 milioni di artigiani e liberi professionisti. Ognuno di loro
            perde in media 3-4 ore alla settimana a fare preventivi a mano. Noi l'abbiamo costruito per
            restituire quel tempo.
          </p>
        </div>
      </section>

      {/* La storia */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Come è nata l'idea</h2>
          <div className="space-y-5 text-gray-600 leading-relaxed text-lg">
            <p>
              Tutto è cominciato da una frustrazione reale: un imbianchino di Roma che ogni sera, dopo
              ore di lavoro in cantiere, doveva ancora mettersi al computer ad aggiornare i suoi fogli
              Excel per mandare preventivi ai clienti. Spesso ci metteva un'ora e mezza per un
              documento da 200€.
            </p>
            <p>
              Abbiamo pensato: l'intelligenza artificiale sa già come si fa un preventivo professionale.
              Perché non permettere a un professionista di <em>descrivere il lavoro come lo
              racconterebbe a voce</em>, e ricevere in 30 secondi un documento pronto da mandare?
            </p>
            <p>
              Così è nato prevai. Un software costruito specificatamente per il mercato italiano, con
              terminologia di settore italiana, prezzi di mercato italiani, e tutto ciò che serve: logo
              aziendale, partita IVA, IVA al 22%, condizioni personalizzabili, PDF professionale.
            </p>
          </div>
        </div>
      </section>

      {/* I nostri valori */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">I nostri valori</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Ogni decisione che prendiamo parte da tre principi fondamentali.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-2xl p-8 text-center">
              <div className="h-14 w-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-5">
                <Zap className="h-7 w-7 text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Velocità reale</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                30 secondi non è uno slogan. È il tempo che ci vuole per generare un preventivo
                completo e professionale. Il tuo tempo vale.
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-8 text-center">
              <div className="h-14 w-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-5">
                <Target className="h-7 w-7 text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Specificità italiana</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Non un software generico tradotto. Costruito da zero per il mercato italiano: categorie
                di lavoro, prezzi, normativa fiscale, lingua.
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-8 text-center">
              <div className="h-14 w-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-5">
                <Users className="h-7 w-7 text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Semplicità prima di tutto</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Non servono corsi o tutorial. Se sai scrivere un messaggio WhatsApp, sai usare prevai.
                La tecnologia deve sparire, il risultato deve restare.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Chi usiamo */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Per chi è prevai</h2>
          <div className="space-y-4 text-gray-600 leading-relaxed text-lg">
            <p>
              prevai è pensato per <strong>artigiani, imprese edili, tecnici e liberi
              professionisti italiani</strong> che lavorano su commessa e devono presentare preventivi
              ai propri clienti.
            </p>
            <p>
              Imbianchini, elettricisti, idraulici, muratori, falegnami, geometri, architetti,
              piastrellisti, giardinieri, serramentisti, termoidraulici, installatori di condizionatori
              — e molti altri. Se il tuo lavoro richiede di spiegare a un cliente quanto costerà un
              intervento prima di eseguirlo, prevai è per te.
            </p>
            <p>
              Siamo già usati da professionisti in tutta Italia: da Milano a Palermo, da Torino a Bari.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-5">
            Prova prevai gratuitamente
          </h2>
          <p className="text-gray-500 text-lg mb-8">
            Crea il tuo primo preventivo in 30 secondi. Nessuna carta di credito richiesta.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)" }}
            >
              Inizia gratis <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contatti"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-gray-700 border border-gray-200 hover:border-violet-300 hover:text-violet-700 transition-colors"
            >
              Contattaci
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
