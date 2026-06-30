import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { ArrowRight, CheckCircle2, MapPin, BarChart2, BookOpen } from "lucide-react";
import { SECTORS, DEFAULT_SECTOR, CITIES_BY_SLUG, getCityTitle, getCityDesc } from "@/data/seo-data";
import { BLOG_ARTICLES, SECTOR_ARTICLES } from "@/data/blog-data";
import {
  getCityIntro,
  getCityFaqItems,
  getCityHowItWorksSteps,
  getCityLayout,
  getCityCtaVariant,
  getCityCtaTexts,
  getNearbyAnchors,
  getOsservatorioData,
  getCityContextText,
  getCityRelatedSectors,
  buildCityJsonLd,
  verifyCityContentInDev,
} from "@/data/seo-render-engine";
import { SeoHead } from "@/components/seo-head";

export default function SeoCityLanding() {
  const params = useParams() as { type?: string; city?: string };
  const sectorSlug = params.type ?? "";
  const citySlug = params.city ?? "";

  const s = SECTORS[sectorSlug] ?? DEFAULT_SECTOR;
  const city = CITIES_BY_SLUG[citySlug];
  const cityName = city?.name ?? citySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const regionName = city?.region ?? "Italia";

  const titleTag = getCityTitle(s, cityName, citySlug);
  const metaDesc = getCityDesc(s, cityName, citySlug, regionName);
  const canonical = `https://www.prevai.it/preventivi/${s.slug}/${citySlug}/`;

  const intro = city ? getCityIntro(s, city) : "";
  const faqItems = city ? getCityFaqItems(s, city) : [];
  const howItWorksSteps = getCityHowItWorksSteps(cityName);
  const layout = city ? getCityLayout(s, city) : 0;
  const ctaVariant = city ? getCityCtaVariant(s, city) : 0;
  const cta = getCityCtaTexts(ctaVariant, cityName);
  const nearbyAnchors = city ? getNearbyAnchors(s, city) : [];
  const osservatorio = city ? getOsservatorioData(city.slug) : null;
  const contextText = city ? getCityContextText(city.slug) : null;
  const relatedSectors = getCityRelatedSectors(s.slug);
  const jsonLd = city ? buildCityJsonLd(s, city) : [];

  useEffect(() => {
    if (city) {
      verifyCityContentInDev(s, city, {
        intro,
        faqAnswers: faqItems.map((f) => f.a),
        ctaButton: cta.button,
      });
    }
  }, [s, city, intro, faqItems, cta.button]);

  const sBenefits = (
    <section className="py-20 bg-gray-50" key="benefits">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900">
            Perché i {s.labelPlural} di {cityName} scelgono prevai
          </h2>
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
  );

  const sHowItWorks = (
    <section className="py-20 bg-white" key="howitworks">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900">
            Preventivo professionale a {cityName} in 3 passi
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {howItWorksSteps.map((item) => (
            <div key={item.n}>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5"
                style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
              >
                {item.n}
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const sUseCases = (
    <section className={`py-20 ${layout === 2 ? "bg-white" : "bg-gray-50"}`} key="usecases">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">
            Preventivi per questi lavori a {cityName}
          </h2>
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
  );

  const sFaq = (
    <section className="py-20 bg-gray-50" key="faq">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Domande frequenti</h2>
        </div>
        <div className="space-y-4">
          {faqItems.map((f) => (
            <div key={f.q} className="bg-white rounded-2xl p-6 card-soft">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{f.q}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const mainSections =
    layout === 0
      ? [sBenefits, sHowItWorks, sUseCases, sFaq]
      : layout === 1
        ? [sHowItWorks, sUseCases, sBenefits, sFaq]
        : [sUseCases, sBenefits, sHowItWorks, sFaq];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead title={titleTag} description={metaDesc} canonical={canonical} jsonLd={jsonLd} />

      {/* ── Breadcrumb ───────────────────────────────────────── */}
      <nav aria-label="Percorso di navigazione" className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex items-center text-sm text-gray-500 flex-wrap">
            <li><Link href="/" className="hover:text-violet-600 transition-colors">Home</Link></li>
            <li aria-hidden="true" className="mx-1.5 text-gray-300 select-none">/</li>
            <li><Link href={`/preventivi/${s.slug}`} className="hover:text-violet-600 transition-colors">{s.label}</Link></li>
            <li aria-hidden="true" className="mx-1.5 text-gray-300 select-none">/</li>
            <li className="text-gray-900 font-medium truncate max-w-[200px]" aria-current="page">{cityName}</li>
          </ol>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-24 pb-20" aria-label="Hero">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          aria-hidden="true"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
            <MapPin className="h-3.5 w-3.5" />
            {regionName}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
            {s.h1}{" "}
            <span className="gradient-text">{s.h1Highlight}</span>
            <br />
            <span className="text-gray-500 text-3xl sm:text-4xl font-bold">a {cityName}</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">{intro}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/sign-up"
              className="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Crea il tuo preventivo gratis
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
            <a
              href={`/preventivi/${s.slug}`}
              className="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Scopri come funziona
            </a>
          </div>
          <p className="text-sm text-gray-400 mt-5">Nessuna carta di credito · Preventivo pronto in 30 secondi</p>
        </div>
      </section>

      {/* ── Osservatorio prezzi e domanda ─────────────────────── */}
      {osservatorio && (
        <section
          className="py-10 bg-white border-b border-gray-100"
          aria-label={`Osservatorio prezzi e domanda ${cityName}`}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-cyan-50/20 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0" aria-hidden="true">
                  <BarChart2 className="h-4 w-4 text-violet-600" />
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  Osservatorio Prezzi e Domanda: {cityName}
                </h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Indice prezzi</div>
                  <div className={`text-2xl font-bold ${osservatorio.priceColorClass}`}>{osservatorio.priceLabel}</div>
                  <div className="text-xs text-gray-400 mt-1">vs. media nazionale</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Domanda</div>
                  <div className={`text-base font-bold ${osservatorio.demandColorClass}`}>{osservatorio.demandLabel}</div>
                  <div className="text-xs text-gray-400 mt-1">{regionName}</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Lead time</div>
                  <div className="text-base font-bold text-gray-800">{osservatorio.avgLeadTime}</div>
                  <div className="text-xs text-gray-400 mt-1">risposta stimata</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Servizi top</div>
                  <ul className="space-y-1.5">
                    {osservatorio.topServices.map((sv) => (
                      <li key={sv} className="flex items-start gap-1 text-xs text-gray-600">
                        <span className="text-violet-400 shrink-0 font-bold" aria-hidden="true">›</span>
                        {sv}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed border-t border-violet-100 pt-4">
                {osservatorio.localInsight}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Main sections (layout-variant order) ─────────────── */}
      {mainSections}

      {/* ── City context ─────────────────────────────────────── */}
      {contextText && (
        <section className="py-10 bg-violet-50/50 border-y border-violet-100/60">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
            <div className="flex gap-4 items-start">
              <div
                className="shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center"
                aria-hidden="true"
              >
                <MapPin className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-violet-700 mb-1.5">
                  {s.label} a {cityName} — mercato locale
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">{contextText}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Città vicine ──────────────────────────────────────── */}
      {nearbyAnchors.length > 0 && (
        <section className="py-16 bg-white border-t border-gray-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <h2 className="text-base font-semibold text-gray-500 mb-5 text-center">
              Preventivi per {s.labelPlural} nelle città vicine
            </h2>
            <div className="flex flex-wrap gap-2 justify-center">
              {nearbyAnchors.map(({ slug, anchorText }) => (
                <a
                  key={slug}
                  href={`/preventivi/${s.slug}/${slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
                >
                  {anchorText}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Related sectors ───────────────────────────────────── */}
      {relatedSectors.length > 0 && (
        <section className="py-14 bg-white border-t border-gray-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <h2 className="text-base font-semibold text-gray-500 mb-5 text-center">
              Scopri anche: preventivi per
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {relatedSectors.map((r) => (
                <a
                  key={r.slug}
                  href={`/preventivi/${r.slug}`}
                  className="flex items-center gap-2 bg-white border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors"
                >
                  <span className="text-violet-400 font-bold" aria-hidden="true">→</span>
                  {r.label}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Approfondimenti ──────────────────────────────────── */}
      {(() => {
        const slugs = SECTOR_ARTICLES[s.slug];
        if (!slugs || slugs.length === 0) return null;
        const articles = slugs
          .map((slug) => BLOG_ARTICLES.find((a) => a.slug === slug))
          .filter((a): a is (typeof BLOG_ARTICLES)[number] => a !== undefined)
          .slice(0, 3);
        if (articles.length === 0) return null;
        return (
          <section className="py-14 bg-gray-50 border-t border-gray-100">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                  >
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">Approfondimenti</h2>
                </div>
                <Link href="/blog" className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors">
                  Tutti gli articoli →
                </Link>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                {articles.map((a) => (
                  <a
                    key={a.slug}
                    href={`/blog/${a.slug}`}
                    className="group flex flex-col bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all duration-200 p-5"
                  >
                    <span className="text-xs font-semibold text-violet-700 mb-2">{a.category}</span>
                    <span className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors leading-snug mb-3">
                      {a.title}
                    </span>
                    <span className="text-xs text-gray-400 mt-auto">{a.readingTimeMin} min di lettura</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── CTA finale ───────────────────────────────────────── */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {cta.headingPrefix}
            <span className="gradient-text">{cta.headingGradient}</span>
          </h2>
          <p className="text-lg text-gray-500 mb-10">
            Nessuna carta di credito richiesta. Il tuo primo preventivo professionale è gratis.
          </p>
          <a
            href="/sign-up"
            className="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold"
          >
            {cta.button}
            <ArrowRight className="ml-2 h-5 w-5" />
          </a>
          <p className="text-sm text-gray-400 mt-4">Preventivo pronto in 30 secondi · Nessun impegno</p>
        </div>
      </section>
    </div>
  );
}
