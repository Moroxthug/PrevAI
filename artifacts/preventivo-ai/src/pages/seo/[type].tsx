import { useParams, Link } from "wouter";
import { ArrowRight, CheckCircle2, Clock, FileText, Shield, TrendingUp, Star, Building2, BookOpen, X, MapPin } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { SECTORS, DEFAULT_SECTOR, RELATED_SECTORS, CITY_SECTORS, CITIES } from "@/data/seo-data";
import { BLOG_ARTICLES, SECTOR_ARTICLES } from "@/data/blog-data";

const TIER1_CITY_SLUGS_ORDERED = [
  "roma", "milano", "napoli", "torino", "palermo", "genova", "bologna",
  "firenze", "bari", "catania", "venezia", "verona", "messina", "padova",
  "trieste", "brescia", "reggio-calabria", "modena", "parma", "prato",
];
const TIER1_SLUG_SET = new Set(TIER1_CITY_SLUGS_ORDERED);
const TIER1_CITIES = CITIES
  .filter((c) => TIER1_SLUG_SET.has(c.slug))
  .sort((a, b) => TIER1_CITY_SLUGS_ORDERED.indexOf(a.slug) - TIER1_CITY_SLUGS_ORDERED.indexOf(b.slug));

function ExcelWordComparisonBlock({ tool }: { tool: "Excel" | "Word" }) {
  const rows = tool === "Excel"
    ? [
        { label: "Calcola IVA e totali", old: false, new: true },
        { label: "Nessuna formula da impostare", old: false, new: true },
        { label: "Funziona da smartphone", old: false, new: true },
        { label: "PDF professionale immediato", old: false, new: true },
        { label: "Archivio preventivi sempre accessibile", old: false, new: true },
        { label: "Logo aziendale automatico", old: false, new: true },
        { label: "Prezzi di mercato suggeriti dall'AI", old: false, new: true },
        { label: "Si può usare offline", old: true, new: false },
      ]
    : [
        { label: "Formattazione automatica", old: false, new: true },
        { label: "Calcola IVA e totali", old: false, new: true },
        { label: "Funziona da smartphone", old: false, new: true },
        { label: "PDF senza conversioni .docx", old: false, new: true },
        { label: "Struttura professionale predefinita", old: false, new: true },
        { label: "Logo aziendale automatico", old: false, new: true },
        { label: "Genera testo in automatico", old: false, new: true },
        { label: "Editing manuale libero", old: true, new: true },
      ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">
            Modello {tool} vs <span className="gradient-text">prevai</span>: confronto diretto
          </h2>
          <p className="text-gray-500 mt-3 text-base">Cosa riesci a fare con un template {tool} e cosa con prevai</p>
        </div>
        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-100">
            <div className="py-3 px-5 text-sm font-semibold text-gray-500">Funzionalità</div>
            <div className="py-3 px-5 text-sm font-semibold text-gray-600 text-center border-l border-gray-100">Template {tool}</div>
            <div className="py-3 px-5 text-sm font-semibold text-center border-l border-gray-100" style={{ color: "#7C3AED" }}>prevai AI</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className={`grid grid-cols-3 border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
              <div className="py-3.5 px-5 text-sm text-gray-700 flex items-center">{r.label}</div>
              <div className="py-3.5 px-5 flex items-center justify-center border-l border-gray-100">
                {r.old
                  ? <CheckCircle2 className="h-5 w-5 text-green-400" />
                  : <X className="h-5 w-5 text-red-300" />}
              </div>
              <div className="py-3.5 px-5 flex items-center justify-center border-l border-gray-100">
                {r.new
                  ? <CheckCircle2 className="h-5 w-5 text-violet-500" />
                  : <X className="h-5 w-5 text-red-300" />}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/sign-up"
            className="btn-gradient inline-flex h-12 items-center justify-center px-8 text-base font-semibold"
          >
            Prova prevai gratis — niente carta di credito
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ComeFareGuideBlock() {
  const steps = [
    {
      n: "1",
      h: "Raccogli le informazioni sul lavoro",
      body: "Prima di iniziare, verifica di avere: il tipo di intervento, le dimensioni approssimative (mq, ml, pezzi), i materiali richiesti dal cliente, i dati del committente (nome, indirizzo, email). Con prevai puoi raccogliere tutto direttamente durante il sopralluogo dal telefono.",
    },
    {
      n: "2",
      h: "Definisci le voci di costo",
      body: "Un preventivo professionale separa manodopera e materiali. Ogni voce deve avere: descrizione dettagliata, unità di misura (mq, ml, ore, corpo), quantità, prezzo unitario e importo. L'AI di prevai genera questa struttura automaticamente dalla tua descrizione in italiano.",
    },
    {
      n: "3",
      h: "Applica l'aliquota IVA corretta",
      body: "In Italia l'IVA varia per categoria: 4% per lavori di edilizia agevolata, 10% per ristrutturazioni edilizie, 22% per la maggior parte degli altri lavori. Un errore sull'IVA può costare caro. prevai applica l'aliquota giusta in automatico in base al tipo di lavoro descritto.",
    },
    {
      n: "4",
      h: "Aggiungi le condizioni di pagamento",
      body: "Scrivi sempre le condizioni: acconto richiesto (es. 30% all'accettazione), saldo a fine lavori, modalità di pagamento accettate (bonifico, contanti entro €2.000), tempi di esecuzione previsti e validità dell'offerta (tipicamente 30 giorni).",
    },
    {
      n: "5",
      h: "Invia il preventivo al cliente",
      body: "Il formato migliore è il PDF: non può essere modificato accidentalmente e si apre su qualsiasi dispositivo. Invialo via email o WhatsApp. Con prevai scarichi il PDF con un clic, già formattato con la tua intestazione aziendale e logo.",
    },
  ];

  return (
    <section className="py-20 bg-gray-50/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">
            Guida completa: come fare un preventivo professionale
          </h2>
          <p className="text-gray-500 mt-3 text-base">Segui questi 5 passi per creare un preventivo che il cliente firmerà subito</p>
        </div>
        <div className="space-y-6">
          {steps.map((s) => (
            <div key={s.n} className="bg-white rounded-2xl p-6 card-soft">
              <div className="flex items-start gap-4">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                >
                  {s.n}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2">{s.h}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreventiviGratisPlansBlock() {
  const plans = [
    {
      name: "Piano Starter",
      price: "29€",
      period: "/mese",
      highlight: false,
      badge: null,
      features: [
        "20 preventivi al mese",
        "PDF professionale scaricabile",
        "Logo e intestazione aziendale",
        "IVA calcolata automaticamente",
        "Archivio preventivi digitale",
      ],
      cta: "Inizia con Starter",
      href: "/sign-up",
    },
    {
      name: "Piano Pro",
      price: "79€",
      period: "/mese",
      highlight: true,
      badge: "Più scelto",
      features: [
        "Preventivi illimitati",
        "Tutto di Starter, incluso",
        "Capitolato dettagliato AI",
        "Listino prezzi personalizzato",
        "Priorità nella generazione AI",
      ],
      cta: "Passa a Pro",
      href: "/sign-up",
    },
    {
      name: "Preventivo Singolo",
      price: "29€",
      period: " una tantum",
      highlight: false,
      badge: null,
      features: [
        "1 preventivo PDF",
        "Nessun abbonamento",
        "Stesso output del piano Starter",
        "Ideale per chi ha raramente clienti",
        "Pagamento sicuro via Stripe",
      ],
      cta: "Acquista singolo",
      href: "/sign-up",
    },
  ];

  return (
    <section className="py-20 bg-gray-50/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">
            Quanto costa il software preventivi?
          </h2>
          <p className="text-gray-500 mt-3 text-base">Inizia gratis, poi scegli il piano più adatto alla tua attività</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl p-6 flex flex-col ${p.highlight ? "shadow-lg border-2 border-violet-400 bg-white" : "border border-gray-100 bg-white card-soft"}`}
            >
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>
                    {p.badge}
                  </span>
                </div>
              )}
              <div className="mb-5">
                <h3 className="text-base font-semibold text-gray-900 mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-3xl font-extrabold text-gray-900">{p.price}</span>
                  <span className="text-sm text-gray-500">{p.period}</span>
                </div>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`inline-flex h-10 items-center justify-center px-5 rounded-lg text-sm font-semibold transition-colors ${p.highlight ? "btn-gradient" : "btn-gradient-outline"}`}
              >
                {p.cta}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-400 mt-6">Registrazione gratuita · Nessuna carta di credito richiesta per iniziare</p>
      </div>
    </section>
  );
}

export default function SeoLanding() {
  const params = useParams();
  const slug = (params as { type?: string }).type ?? "professionista";
  const s = SECTORS[slug] ?? DEFAULT_SECTOR;

  const canonical = `https://www.prevai.it/preventivi/${s.slug}/`;
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
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.prevai.it/" },
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
      <section className="relative overflow-hidden bg-white pt-24 pb-20" aria-label="Hero">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          aria-hidden="true"
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

      {/* ── Guide-specific blocks ────────────────────────── */}
      {slug === "modello-excel" && <ExcelWordComparisonBlock tool="Excel" />}
      {slug === "modello-word" && <ExcelWordComparisonBlock tool="Word" />}
      {slug === "come-fare-preventivo" && <ComeFareGuideBlock />}
      {slug === "preventivi-gratis" && <PreventiviGratisPlansBlock />}

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

      {/* ── Preventivi nelle principali città ─────────────── */}
      {CITY_SECTORS.includes(slug) && TIER1_CITIES.length > 0 && (
        <section className="py-16 bg-gray-50/60">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900">
                Preventivi {s.labelPlural} nelle principali città
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                Seleziona la tua città per un preventivo personalizzato con tariffe locali
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {TIER1_CITIES.map((city) => (
                <Link
                  key={city.slug}
                  href={`/preventivi/${slug}/${city.slug}`}
                  className="flex items-center gap-2.5 bg-white hover:bg-violet-50 border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 transition-colors group"
                >
                  <MapPin className="h-3.5 w-3.5 text-violet-400 group-hover:text-violet-600 shrink-0" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-violet-700 truncate">
                    {city.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

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
                  href={`/preventivi/${r.slug}`}
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

      {/* ── Approfondimenti ──────────────────────────────── */}
      {SECTOR_ARTICLES[slug] && SECTOR_ARTICLES[slug].length > 0 && (() => {
        const articles = SECTOR_ARTICLES[slug]
          .map((articleSlug) => BLOG_ARTICLES.find((a) => a.slug === articleSlug))
          .filter((a): a is (typeof BLOG_ARTICLES)[number] => a !== undefined);
        if (articles.length === 0) return null;
        return (
          <section className="py-16 bg-gray-50/60">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>
                  <BookOpen className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Approfondimenti</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Guide e consigli pratici per {s.h1Highlight.toLowerCase()}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {articles.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/blog/${a.slug}`}
                    className="group flex flex-col bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all p-5"
                  >
                    <span className="text-xs font-semibold text-violet-600 mb-2">{a.category}</span>
                    <span className="text-sm font-semibold text-gray-800 group-hover:text-violet-700 transition-colors leading-snug mb-2">
                      {a.title}
                    </span>
                    <span className="text-xs text-gray-400 mt-auto">{a.readingTimeMin} min di lettura</span>
                  </Link>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link href="/blog" className="text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors">
                  Vedi tutte le guide →
                </Link>
              </div>
            </div>
          </section>
        );
      })()}

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
