import { useParams, Link } from "wouter";
import { ArrowRight, CheckCircle2, Clock, FileText, Shield, TrendingUp, Star, Building2 } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { SECTORS, DEFAULT_SECTOR } from "@/data/seo-data";

const RELATED_SECTORS: Record<string, { slug: string; label: string }[]> = {
  imbianchino: [
    { slug: "pittore", label: "Pittori Edili" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "muratore", label: "Muratori" },
    { slug: "pavimentista", label: "Pavimentisti" },
    { slug: "modello-excel", label: "Alternativa Excel" },
  ],
  pittore: [
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "muratore", label: "Muratori" },
    { slug: "serramentista", label: "Serramentisti" },
    { slug: "modello-word", label: "Alternativa Word" },
  ],
  elettricista: [
    { slug: "idraulico", label: "Idraulici" },
    { slug: "termoidraulico", label: "Termoidraulici" },
    { slug: "condizionatori", label: "Climatizzatori" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
  ],
  idraulico: [
    { slug: "termoidraulico", label: "Termoidraulici" },
    { slug: "elettricista", label: "Elettricisti" },
    { slug: "condizionatori", label: "Climatizzatori" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "muratore", label: "Muratori" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
  ],
  edilizia: [
    { slug: "muratore", label: "Muratori" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "tetto", label: "Coperture e Tetti" },
    { slug: "geometra", label: "Geometri" },
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "modello-excel", label: "Alternativa Excel" },
  ],
  ristrutturazione: [
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "muratore", label: "Muratori" },
    { slug: "idraulico", label: "Idraulici" },
    { slug: "elettricista", label: "Elettricisti" },
    { slug: "serramentista", label: "Serramentisti" },
    { slug: "piastrellista", label: "Piastrellisti" },
  ],
  carpentiere: [
    { slug: "falegname", label: "Falegnami" },
    { slug: "muratore", label: "Muratori" },
    { slug: "serramentista", label: "Serramentisti" },
    { slug: "tetto", label: "Coperture e Tetti" },
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
  ],
  falegname: [
    { slug: "carpentiere", label: "Carpentieri" },
    { slug: "serramentista", label: "Serramentisti" },
    { slug: "pavimentista", label: "Pavimentisti" },
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "modello-word", label: "Alternativa Word" },
  ],
  termoidraulico: [
    { slug: "idraulico", label: "Idraulici" },
    { slug: "elettricista", label: "Elettricisti" },
    { slug: "condizionatori", label: "Climatizzatori" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
  ],
  freelance: [
    { slug: "geometra", label: "Geometri" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "modello-word", label: "Alternativa Word" },
    { slug: "modello-excel", label: "Alternativa Excel" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "pittore", label: "Pittori Edili" },
  ],
  geometra: [
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "freelance", label: "Freelance" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "muratore", label: "Muratori" },
    { slug: "tetto", label: "Coperture e Tetti" },
  ],
  muratore: [
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "tetto", label: "Coperture e Tetti" },
    { slug: "geometra", label: "Geometri" },
  ],
  giardiniere: [
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "modello-excel", label: "Alternativa Excel" },
    { slug: "freelance", label: "Freelance" },
    { slug: "pavimentista", label: "Pavimentisti" },
    { slug: "pittore", label: "Pittori Edili" },
  ],
  piastrellista: [
    { slug: "pavimentista", label: "Pavimentisti" },
    { slug: "muratore", label: "Muratori" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "falegname", label: "Falegnami" },
    { slug: "modello-excel", label: "Alternativa Excel" },
  ],
  serramentista: [
    { slug: "falegname", label: "Falegnami" },
    { slug: "carpentiere", label: "Carpentieri" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "tetto", label: "Coperture e Tetti" },
    { slug: "muratore", label: "Muratori" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
  ],
  tetto: [
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "muratore", label: "Muratori" },
    { slug: "serramentista", label: "Serramentisti" },
    { slug: "carpentiere", label: "Carpentieri" },
    { slug: "geometra", label: "Geometri" },
    { slug: "modello-excel", label: "Alternativa Excel" },
  ],
  condizionatori: [
    { slug: "termoidraulico", label: "Termoidraulici" },
    { slug: "idraulico", label: "Idraulici" },
    { slug: "elettricista", label: "Elettricisti" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
  ],
  pavimentista: [
    { slug: "piastrellista", label: "Piastrellisti" },
    { slug: "falegname", label: "Falegnami" },
    { slug: "ristrutturazione", label: "Ristrutturazioni" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "muratore", label: "Muratori" },
    { slug: "modello-word", label: "Alternativa Word" },
  ],
  "modello-excel": [
    { slug: "modello-word", label: "Alternativa Word" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "idraulico", label: "Idraulici" },
  ],
  "modello-word": [
    { slug: "modello-excel", label: "Alternativa Excel" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "elettricista", label: "Elettricisti" },
    { slug: "carpentiere", label: "Carpentieri" },
    { slug: "freelance", label: "Freelance" },
  ],
  "come-fare-preventivo": [
    { slug: "modello-excel", label: "Alternativa Excel" },
    { slug: "modello-word", label: "Alternativa Word" },
    { slug: "preventivi-gratis", label: "Preventivi gratuiti" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "edilizia", label: "Imprese Edili" },
    { slug: "freelance", label: "Freelance" },
  ],
  "preventivi-gratis": [
    { slug: "modello-excel", label: "Alternativa Excel" },
    { slug: "modello-word", label: "Alternativa Word" },
    { slug: "come-fare-preventivo", label: "Come fare un preventivo" },
    { slug: "imbianchino", label: "Imbianchini" },
    { slug: "idraulico", label: "Idraulici" },
    { slug: "elettricista", label: "Elettricisti" },
  ],
};

export default function SeoLanding() {
  const params = useParams();
  const slug = (params as { type?: string }).type ?? "professionista";
  const s = SECTORS[slug] ?? DEFAULT_SECTOR;

  const canonical = `https://www.prevai.it/seo/${s.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication" as const,
      name: "prevai",
      description: s.jsonLdDescription,
      url: canonical,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "it",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList" as const,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.prevai.it" },
        { "@type": "ListItem", position: 2, name: s.h1Highlight, item: canonical },
      ],
    },
    ...(s.faq.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage" as const,
            mainEntity: s.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={s.titleTag}
        description={s.metaDescription}
        canonical={canonical}
        jsonLd={jsonLd}
      />
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-24 pb-20">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
            <Star className="h-3.5 w-3.5 fill-current" />
            Pensato per il mercato italiano
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
            {s.h1}{" "}
            <span className="gradient-text">{s.h1Highlight}</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            {s.intro}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Crea il tuo preventivo in 60 secondi
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="#come-funziona"
              className="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Come funziona
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-5">Nessuna carta di credito richiesta · Preventivo pronto in 30 secondi</p>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">{s.h2Benefits}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {s.benefits.map((b) => (
              <div key={b.title} className="card-soft bg-white p-7 rounded-2xl flex flex-col">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center mb-5 text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                >
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{b.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="come-funziona" className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">{s.h2HowItWorks}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {s.howItWorks.map((step, i) => (
              <div key={i} className="relative">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                >
                  {i + 1}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{step.step}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use cases ────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{s.h2UseCases}</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {s.useCases.map((uc) => (
              <div key={uc} className="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 card-soft">
                <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-sm text-gray-700">{uc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── "Pensato per il mercato italiano" ────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="rounded-2xl p-10 md:p-14 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(6,182,212,0.06))" }}>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>
                  <Building2 className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Pensato per il mercato italiano</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600 leading-relaxed">
                <div>
                  <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-violet-500" /> IVA italiana integrata
                  </div>
                  <p>Il calcolo dell'IVA al 4%, 10% o 22% è automatico. prevai conosce le aliquote per ogni categoria di lavoro nel contesto normativo italiano.</p>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-500" /> Dati aziendali italiani
                  </div>
                  <p>Partita IVA, Codice Fiscale, REA: tutti i campi dell'intestazione rispettano il formato dei documenti commerciali italiani.</p>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-500" /> Lessico tecnico in italiano
                  </div>
                  <p>L'AI è addestrata sul lessico tecnico delle PMI italiane. Capisce il dialetto del tuo mestiere, non devi usare un linguaggio formale.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{s.h2Faq}</h2>
          </div>
          <div className="space-y-4">
            {s.faq.map((f) => (
              <div key={f.q} className="bg-white rounded-2xl p-6 card-soft">
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vedi anche ───────────────────────────────────── */}
      {RELATED_SECTORS[slug] && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900">Vedi anche</h2>
              <p className="text-sm text-gray-500 mt-2">Altre categorie di preventivi che potrebbero interessarti</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {RELATED_SECTORS[slug].map((r) => (
                <Link
                  key={r.slug}
                  href={`/seo/${r.slug}`}
                  className="flex items-center gap-3 bg-gray-50 hover:bg-violet-50 border border-gray-100 hover:border-violet-200 rounded-xl px-5 py-3.5 transition-colors group"
                >
                  <ArrowRight className="h-4 w-4 text-violet-400 group-hover:text-violet-600 shrink-0" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-violet-700">Preventivi per {r.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA finale ───────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-violet-500" />
            <span className="text-sm font-semibold text-violet-600">Risparmia ore ogni settimana</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Pronto a creare il tuo primo preventivo{" "}
            <span className="gradient-text">in 30 secondi</span>?
          </h2>
          <p className="text-lg text-gray-500 mb-10">
            Unisciti a centinaia di {s.h1Highlight.toLowerCase()} italiani che usano prevai ogni giorno.
            Nessuna carta di credito. Nessun impegno.
          </p>
          <Link
            href="/sign-up"
            className="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold"
          >
            Inizia Gratuitamente
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
