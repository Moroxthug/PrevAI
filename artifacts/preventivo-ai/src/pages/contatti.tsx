import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Mail, MessageCircle, FileText, Clock } from "lucide-react";
import { Link } from "wouter";

export default function ContattiPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: "Contatti prevai",
      url: "https://www.prevai.it/contatti/",
      description: "Contatta il team prevai per supporto, domande sul prodotto o informazioni commerciali.",
      mainEntity: {
        "@type": "Organization",
        name: "prevai",
        url: "https://www.prevai.it/",
        email: "info@prevai.it",
        contactPoint: [
          {
            "@type": "ContactPoint",
            email: "info@prevai.it",
            contactType: "customer support",
            availableLanguage: "Italian",
          },
          {
            "@type": "ContactPoint",
            email: "privacy@prevai.it",
            contactType: "privacy inquiries",
            availableLanguage: "Italian",
          },
        ],
      },
    },
  ];

  return (
    <PublicLayout>
      <SeoHead
        title="Contatti | prevai — Assistenza e Supporto"
        description="Hai domande su prevai? Contattaci via email o WhatsApp. Siamo qui per aiutarti a generare preventivi professionali più velocemente."
        canonical="https://www.prevai.it/contatti/"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-white pt-24 pb-16">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl relative z-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">
            Come possiamo{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              aiutarti?
            </span>
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            Il team prevai risponde entro poche ore nei giorni feriali. Scegli il canale che preferisci.
          </p>
        </div>
      </section>

      {/* Canali di contatto */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Email supporto */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-violet-50 flex items-center justify-center mb-5">
                <Mail className="h-6 w-6 text-violet-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Supporto prodotto</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Problemi tecnici, domande sull'utilizzo, richiesta di funzionalità.
              </p>
              <a
                href="mailto:info@prevai.it"
                className="text-violet-600 font-semibold text-sm hover:text-violet-800 transition-colors"
              >
                info@prevai.it →
              </a>
            </div>

            {/* WhatsApp */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center mb-5">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">WhatsApp</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Vuoi provare il servizio via WhatsApp o hai una domanda rapida? Scrivici direttamente.
              </p>
              <Link
                href="/whatsapp"
                className="text-green-600 font-semibold text-sm hover:text-green-800 transition-colors"
              >
                Scopri prevai su WhatsApp →
              </Link>
            </div>

            {/* Privacy / legale */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-5">
                <FileText className="h-6 w-6 text-gray-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Privacy & legale</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Richieste GDPR, esercizio dei diritti, questioni legali o contrattuali.
              </p>
              <a
                href="mailto:privacy@prevai.it"
                className="text-gray-600 font-semibold text-sm hover:text-gray-900 transition-colors"
              >
                privacy@prevai.it →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Tempi di risposta */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="flex items-start gap-4 bg-violet-50 border border-violet-100 rounded-2xl p-6">
            <Clock className="h-6 w-6 text-violet-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Tempi di risposta</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Rispondiamo a tutte le email entro <strong>4-8 ore nei giorni feriali</strong> (lunedì–venerdì,
                9:00–18:00 CET). Per le richieste inviate nel weekend, rispondiamo il lunedì mattina.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ rapide */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Domande frequenti</h2>
          <div className="space-y-5">
            {[
              {
                q: "Posso cancellare l'abbonamento in qualsiasi momento?",
                a: "Sì. Puoi cancellare il tuo abbonamento in qualsiasi momento dalle impostazioni del tuo account, senza penali o costi aggiuntivi. Continuerai ad avere accesso fino alla fine del periodo già pagato.",
              },
              {
                q: "Offrite uno sconto per agenzie o team?",
                a: "Sì. Per utilizzi multi-utente o volumi elevati, contattaci a info@prevai.it e troveremo la soluzione più adatta.",
              },
              {
                q: "I miei dati e i preventivi sono al sicuro?",
                a: "Sì. Tutti i dati sono cifrati in transito (TLS) e a riposo. Non condividiamo i tuoi dati con terze parti. Leggi la nostra Privacy Policy per i dettagli.",
              },
              {
                q: "Posso importare il mio listino prezzi?",
                a: "Sì. Dalla sezione Impostazioni → Listino puoi inserire i tuoi prezzi personalizzati che l'AI userà come riferimento per i tuoi preventivi.",
              },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Non hai ancora un account?</h2>
          <p className="text-gray-500 mb-6">
            Prova prevai gratis — nessuna carta di credito richiesta.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)" }}
          >
            Crea account gratuito
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
