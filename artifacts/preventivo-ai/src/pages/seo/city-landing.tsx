import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { ArrowRight, CheckCircle2, MapPin, Clock, Shield, FileText, TrendingUp, Building2 } from "lucide-react";
import { SECTORS, DEFAULT_SECTOR, CITIES_BY_SLUG } from "@/data/seo-data";

// Varianti di testo per l'intro geo, per diversificare il contenuto fra le città
function getCityIntro(sectorLabel: string, sectorLabelPlural: string, cityName: string, regionName: string): string {
  const variants = [
    `Sei un ${sectorLabel.toLowerCase()} a ${cityName} e perdi ore a fare preventivi su Excel o carta? prevai è il software di preventivazione con AI pensato per i professionisti del settore in ${regionName}. Descrivi il lavoro in italiano, ottieni un documento professionale in 30 secondi.`,
    `${cityName} conta migliaia di artigiani e PMI attive nel settore. I ${sectorLabelPlural} che usano prevai rispondono ai clienti in pochi minuti anziché in giorni, e vincono più lavori. Nessun Excel, nessun foglio di carta.`,
    `In una città come ${cityName} la concorrenza è alta. I ${sectorLabelPlural} che inviano il preventivo per primi hanno un vantaggio decisivo. Con prevai lo fai in 30 secondi ancora mentre sei dal cliente — direttamente dallo smartphone.`,
    `Operare come ${sectorLabel.toLowerCase()} a ${cityName} significa gestire tanti clienti con richieste diverse. prevai semplifica la parte amministrativa: descrivi il lavoro, l'AI genera il preventivo completo e tu ti concentri sul mestiere.`,
  ];
  // Determina la variante in modo deterministico dalla città
  const hash = cityName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return variants[hash % variants.length];
}

// Restituisce un elenco di città vicine leggibili dato un array di slug
function getNearbyLabels(slugs: string[]): { name: string; slug: string }[] {
  return slugs
    .map((slug) => {
      const city = CITIES_BY_SLUG[slug];
      return city ? { name: city.name, slug: city.slug } : null;
    })
    .filter(Boolean) as { name: string; slug: string }[];
}

export default function SeoCityLanding() {
  const params = useParams() as { type?: string; city?: string };
  const sectorSlug = params.type ?? "";
  const citySlug = params.city ?? "";

  const s = SECTORS[sectorSlug] ?? DEFAULT_SECTOR;
  const city = CITIES_BY_SLUG[citySlug];
  const cityName = city?.name ?? citySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const regionName = city?.region ?? "Italia";
  const nearby = city ? getNearbyLabels(city.nearbySlug) : [];

  const titleTag = `Preventivo ${s.label} a ${cityName} | prevai – AI in 30s`;
  const metaDesc = `Software di preventivazione AI per ${s.labelPlural} a ${cityName}. Crea preventivi professionali in 30 secondi. Nessuna carta di credito. Usato in tutta ${regionName}.`;

  useEffect(() => {
    document.title = titleTag;

    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = metaDesc;

    // canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `https://www.prevai.it/seo/${s.slug}/${citySlug}`;

    // JSON-LD
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "prevai",
      description: `Software di preventivazione AI per ${s.labelPlural} a ${cityName} (${regionName}).`,
      url: `https://www.prevai.it/seo/${s.slug}/${citySlug}`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "it",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
      areaServed: [
        { "@type": "City", name: cityName },
        { "@type": "State", name: regionName },
        { "@type": "Country", name: "Italia" },
      ],
    };
    let script = document.getElementById("seo-geo-jsonld") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "seo-geo-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      document.title = "prevai – Preventivi Facili";
      if (script?.parentNode) script.parentNode.removeChild(script);
      if (canonical?.parentNode) canonical.parentNode.removeChild(canonical);
    };
  }, [titleTag, metaDesc, s.slug, citySlug, s.labelPlural, cityName, regionName]);

  const intro = getCityIntro(s.label, s.labelPlural, cityName, regionName);

  return (
    <div className="flex flex-col min-h-screen bg-white">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-24 pb-20">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
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
            <Link
              href="/sign-up"
              className="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Crea il tuo preventivo gratis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href={`/seo/${s.slug}`}
              className="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Scopri come funziona
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-5">Nessuna carta di credito · Preventivo pronto in 30 secondi</p>
        </div>
      </section>

      {/* ── Vantaggi ─────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">
              Perché i {s.labelPlural} di {cityName} usano prevai
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Risparmia tempo amministrativo ogni settimana e presenta ai tuoi clienti un documento che ispira fiducia.
            </p>
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

      {/* ── 3 passi ──────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">
              Preventivo professionale a {cityName} in 3 passi
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                n: "1",
                title: "Descrivi il lavoro",
                desc: `Dal tuo smartphone a ${cityName}, scrivi cosa devi fare nel linguaggio che usi ogni giorno. L'AI capisce la terminologia di settore.`,
              },
              {
                n: "2",
                title: "L'AI genera il preventivo",
                desc: "prevai identifica le voci di costo, stima le quantità e calcola totali e IVA in automatico. Zero errori, zero calcoli manuali.",
              },
              {
                n: "3",
                title: "Invia al cliente",
                desc: `PDF professionale in 30 secondi. Lo mandi via WhatsApp o email al tuo cliente a ${cityName} prima ancora di uscire dal cantiere.`,
              },
            ].map((item) => (
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

      {/* ── Lavori tipici ─────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">
              Preventivi per questi lavori a {cityName}
            </h2>
            <p className="text-gray-500 mt-3">
              Casi d'uso più comuni per i {s.labelPlural} che operano in {regionName}.
            </p>
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

      {/* ── Pensato per il mercato italiano ───────────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div
            className="rounded-2xl p-10 md:p-14 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.05), rgba(6,182,212,0.05))" }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
              >
                <Building2 className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Costruito per il mercato italiano — {regionName} inclusa
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600 leading-relaxed">
              <div>
                <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                  IVA italiana integrata
                </div>
                <p>Calcolo automatico IVA al 4%, 10% o 22%. prevai conosce le aliquote corrette per ogni categoria di lavoro nel mercato italiano.</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-violet-500" />
                  Documenti conformi
                </div>
                <p>Partita IVA, Codice Fiscale, intestazione professionale: i campi rispettano il formato dei documenti commerciali italiani.</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-500" />
                  Lessico tecnico italiano
                </div>
                <p>L'AI è addestrata sul lessico tecnico degli artigiani e delle PMI italiane. Capisce il tuo settore nella tua lingua.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ geo ───────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Domande frequenti</h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q: `Come faccio un preventivo professionale a ${cityName}?`,
                a: `Con prevai bastano 30 secondi. Descrivi il lavoro in italiano nel campo di testo, il motore AI genera automaticamente il documento con voci di costo, quantità, prezzi unitari e IVA. Puoi scaricarlo come PDF e inviarlo subito al tuo cliente a ${cityName}.`,
              },
              {
                q: `prevai funziona per ${s.labelPlural} a ${cityName} e in tutta la ${regionName}?`,
                a: `Sì. prevai è un'applicazione web accessibile da qualsiasi dispositivo con connessione internet. Non ci sono limitazioni geografiche: funziona a ${cityName} come in qualsiasi altra città italiana.`,
              },
              {
                q: `Quanto costa il software per ${s.labelPlural}?`,
                a: `Il piano Starter è 29 €/mese con 20 preventivi inclusi. Il piano Pro è 79 €/mese con preventivi illimitati. Puoi anche acquistare preventivi singoli da 29 € senza abbonamento. Tutte le opzioni sono senza vincoli.`,
              },
              {
                q: `Devo installare qualcosa per usarlo?`,
                a: `No. prevai funziona direttamente dal browser del tuo smartphone, tablet o PC. Nessun download, nessuna installazione, nessun aggiornamento manuale.`,
              },
            ].map((f) => (
              <div key={f.q} className="bg-white rounded-2xl p-6 card-soft">
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Città vicine ──────────────────────────────────────── */}
      {nearby.length > 0 && (
        <section className="py-16 bg-white border-t">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <h2 className="text-base font-semibold text-gray-500 mb-5 text-center">
              Preventivi per {s.labelPlural} nelle città vicine
            </h2>
            <div className="flex flex-wrap gap-2 justify-center">
              {nearby.map(({ name, slug }) => (
                <Link
                  key={slug}
                  href={`/seo/${s.slug}/${slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
                >
                  <MapPin className="h-3 w-3" />
                  {name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA finale ───────────────────────────────────────── */}
      <section className="py-24 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-violet-500" />
            <span className="text-sm font-semibold text-violet-600">Risparmia ore ogni settimana</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Inizia a creare preventivi a {cityName}{" "}
            <span className="gradient-text">in 30 secondi</span>
          </h2>
          <p className="text-lg text-gray-500 mb-10">
            Nessuna carta di credito richiesta. Il tuo primo preventivo professionale è gratis.
          </p>
          <Link
            href="/sign-up"
            className="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold"
          >
            Inizia Gratuitamente
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <p className="text-sm text-gray-400 mt-4">Preventivo pronto in 30 secondi · Nessun impegno</p>
        </div>
      </section>
    </div>
  );
}
