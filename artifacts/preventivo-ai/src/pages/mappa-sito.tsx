import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Link } from "wouter";
import { SECTORS, CITIES, CITY_SECTORS } from "@/data/seo-data";
import { BLOG_ARTICLES, BLOG_CATEGORIES } from "@/data/blog-data";
import { MapPin, Globe, BookOpen, Layers } from "lucide-react";

export default function MappaSitoPage() {
  // Group cities by region for structured visual hierarchy
  const citiesByRegion = new Map<string, typeof CITIES>();
  for (const city of CITIES) {
    const list = citiesByRegion.get(city.region) || [];
    list.push(city);
    citiesByRegion.set(city.region, list);
  }

  const sortedRegions = Array.from(citiesByRegion.keys()).sort();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Mappa del Sito | prevai",
      description: "Mappa del sito completa di prevai. Trova tutte le pagine statiche, gli articoli del blog e le guide per professionisti e artigiani nelle città italiane.",
      url: "https://www.prevai.it/mappa-sito/",
    }
  ];

  return (
    <PublicLayout>
      <SeoHead
        title="Mappa del Sito | prevai — Elenco Completo delle Pagine"
        description="Trova tutti i nostri servizi di preventivazione per artigiani e professionisti in Italia, organizzati per professione e città."
        canonical="https://www.prevai.it/mappa-sito/"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-white pt-20 pb-12 border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
            Mappa del Sito
          </h1>
          <p className="text-lg text-gray-600">
            Esplora l'indice completo di prevai.it. Trova strumenti di preventivazione specifici, guide fiscali e tutte le pagine locali per regione.
          </p>
        </div>
      </section>

      {/* Main Directory */}
      <section className="py-16 bg-gray-50/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* Section 1: Main Pages */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-50">
                <Globe className="h-5 w-5 text-violet-600" />
                <h2 className="text-lg font-bold text-gray-900">Pagine Principali</h2>
              </div>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link href="/" className="text-gray-600 hover:text-violet-600 transition-colors">
                    Home Page
                  </Link>
                </li>
                <li>
                  <Link href="/whatsapp" className="text-gray-600 hover:text-violet-600 transition-colors">
                    Preventivi su WhatsApp
                  </Link>
                </li>
                <li>
                  <Link href="/chi-siamo" className="text-gray-600 hover:text-violet-600 transition-colors">
                    Chi Siamo
                  </Link>
                </li>
                <li>
                  <Link href="/contatti" className="text-gray-600 hover:text-violet-600 transition-colors">
                    Contatti e Assistenza
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-gray-600 hover:text-violet-600 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/termini" className="text-gray-600 hover:text-violet-600 transition-colors">
                    Termini di Servizio
                  </Link>
                </li>
              </ul>
            </div>

            {/* Section 2: Blog & Guides */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-50">
                <BookOpen className="h-5 w-5 text-violet-600" />
                <h2 className="text-lg font-bold text-gray-900">Blog e Guide</h2>
              </div>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link href="/blog" className="font-semibold text-gray-800 hover:text-violet-600 transition-colors">
                    Indice Blog
                  </Link>
                </li>
                {BLOG_CATEGORIES.map((cat) => (
                  <li key={cat.slug}>
                    <Link href={`/blog/categoria/${cat.slug}`} className="text-gray-600 hover:text-violet-600 transition-colors pl-2">
                      Categoria: {cat.name}
                    </Link>
                  </li>
                ))}
                <li className="pt-2 font-semibold text-gray-800 border-t border-gray-50 mt-2">Ultimi Articoli:</li>
                {BLOG_ARTICLES.slice(0, 5).map((art) => (
                  <li key={art.slug} className="truncate max-w-full">
                    <Link href={`/blog/${art.slug}`} className="text-gray-500 hover:text-violet-600 text-xs transition-colors pl-2">
                      {art.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 3: Professions Index */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-50">
                <Layers className="h-5 w-5 text-violet-600" />
                <h2 className="text-lg font-bold text-gray-900">Professioni e Servizi</h2>
              </div>
              <ul className="space-y-2.5 text-sm">
                {Object.entries(SECTORS).map(([slug, sector]) => (
                  <li key={slug}>
                    <Link href={`/preventivi/${slug}`} className="text-gray-600 hover:text-violet-600 transition-colors">
                      {sector.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Programmatic Cities Directory */}
          <div className="mt-12 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100">
              <MapPin className="h-6 w-6 text-violet-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Preventivi Locali per Città</h2>
                <p className="text-sm text-gray-500 mt-1">Seleziona un settore e la tua città per accedere ai prezzi e alle informazioni territoriali.</p>
              </div>
            </div>

            <div className="space-y-10">
              {sortedRegions.map((region) => {
                const regionCities = citiesByRegion.get(region) || [];
                return (
                  <div key={region} className="border-b border-gray-50 pb-8 last:border-0 last:pb-0">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-violet-700 mb-4">{region}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-4 gap-x-2 text-xs">
                      {regionCities.map((city) => (
                        <div key={city.slug} className="flex flex-col gap-1">
                          <span className="font-bold text-gray-900 border-b border-gray-50 pb-0.5 mb-1">{city.name}</span>
                          <div className="flex flex-col gap-1.5 pl-1">
                            {CITY_SECTORS.map((sectorSlug) => {
                              const s = SECTORS[sectorSlug];
                              if (!s) return null;
                              return (
                                <Link
                                  key={sectorSlug}
                                  href={`/preventivi/${sectorSlug}/${city.slug}`}
                                  className="text-gray-500 hover:text-violet-600 transition-colors truncate"
                                  title={`Preventivo ${s.label} a ${city.name}`}
                                >
                                  {s.label}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </section>
    </PublicLayout>
  );
}
