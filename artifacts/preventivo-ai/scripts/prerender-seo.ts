import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { SECTORS, CITIES, CITIES_BY_SLUG, CITY_SECTORS, getCityTitle, getCityDesc } from "../src/data/seo-data.js";
import type { SectorData, CityData } from "../src/data/seo-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist/public");
const templatePath = join(distDir, "index.html");

if (!existsSync(templatePath)) {
  console.error("dist/public/index.html not found — run vite build first");
  process.exit(1);
}

const BASE_URL = "https://www.prevai.it";

const SECTOR_OG_IMAGES: Record<string, string> = {
  edilizia: "/og/edilizia.jpg",
  ristrutturazione: "/og/ristrutturazione.jpg",
  elettricista: "/og/elettricista.jpg",
  idraulico: "/og/idraulico.jpg",
  imbianchino: "/og/imbianchino.jpg",
  carpentiere: "/og/carpentiere.jpg",
  falegname: "/og/falegname.jpg",
  termoidraulico: "/og/termoidraulico.jpg",
  freelance: "/og/freelance.jpg",
  geometra: "/og/geometra.jpg",
};

function ogImage(sectorSlug: string): string {
  return SECTOR_OG_IMAGES[sectorSlug] ?? "/opengraph.jpg";
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHeadBlock(opts: {
  title: string;
  description: string;
  canonical: string;
  ogImagePath: string;
  jsonLd: object[];
}): string {
  const { title, description, canonical, ogImagePath, jsonLd } = opts;
  const ogImageUrl = ogImagePath.startsWith("http")
    ? ogImagePath
    : `${BASE_URL}${ogImagePath}`;

  const lines = [
    `  <title>${esc(title)}</title>`,
    `  <meta name="description" content="${esc(description)}" />`,
    `  <link rel="canonical" href="${esc(canonical)}" />`,
    `  <meta property="og:title" content="${esc(title)}" />`,
    `  <meta property="og:description" content="${esc(description)}" />`,
    `  <meta property="og:url" content="${esc(canonical)}" />`,
    `  <meta property="og:image" content="${esc(ogImageUrl)}" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:type" content="website" />`,
    `  <meta property="og:locale" content="it_IT" />`,
    `  <meta property="og:site_name" content="prevai" />`,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${esc(title)}" />`,
    `  <meta name="twitter:description" content="${esc(description)}" />`,
    `  <meta name="twitter:image" content="${esc(ogImageUrl)}" />`,
    ...jsonLd.map((schema) => `  <script type="application/ld+json">${JSON.stringify(schema)}</script>`),
  ];
  return lines.join("\n");
}

/**
 * Strip dashboard and charts chunk modulepreloads so SEO pages don't
 * eagerly fetch code that is only needed inside the authenticated dashboard.
 * The SEO chunk, vendor-react, and the main index chunk are preserved.
 */
function pruneModulepreload(html: string): string {
  return html.replace(
    /<link\s+rel="modulepreload"\s+crossorigin\s+href="\/assets\/(dashboard|charts)-[^"]*\.js"[^>]*>/gi,
    ""
  );
}

function injectHead(template: string, headBlock: string): string {
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, "");
  html = html.replace(/<meta\s+name="description"[^>]*\/?>/i, "");
  html = html.replace(/<link\s+rel="canonical"[^>]*\/?>/i, "");
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
  html = html.replace("<head>", `<head>\n${headBlock}`);
  return html;
}

function injectBody(html: string, bodyHtml: string): string {
  if (!bodyHtml) return html;
  return html.replace(/<div id="root"><\/div>/, `<div id="root">${bodyHtml}</div>`);
}

function writeRoute(relPath: string, html: string): void {
  const outDir = join(distDir, relPath);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html, "utf-8");
}

function buildSectorJsonLd(s: SectorData): object[] {
  const canonical = `${BASE_URL}/seo/${s.slug}`;
  const schemas: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
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
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: s.label, item: canonical },
      ],
    },
  ];
  if (s.faq.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: s.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return schemas;
}

function buildCityJsonLd(s: SectorData, city: CityData): object[] {
  const canonical = `${BASE_URL}/seo/${s.slug}/${city.slug}`;
  const cityFaq = [
    {
      q: `Come faccio un preventivo professionale a ${city.name}?`,
      a: `Con prevai bastano 30 secondi. Descrivi il lavoro in italiano nel campo di testo, il motore AI genera automaticamente il documento con voci di costo, quantità, prezzi unitari e IVA. Puoi scaricarlo come PDF e inviarlo subito al tuo cliente a ${city.name}.`,
    },
    {
      q: `prevai funziona per ${s.labelPlural} a ${city.name} e in tutta la ${city.region}?`,
      a: `Sì. prevai è un'applicazione web accessibile da qualsiasi dispositivo con connessione internet. Non ci sono limitazioni geografiche: funziona a ${city.name} come in qualsiasi altra città italiana.`,
    },
    {
      q: `Quanto costa il software per ${s.labelPlural}?`,
      a: `Il piano Starter è 29 €/mese con 20 preventivi inclusi. Il piano Pro è 79 €/mese con preventivi illimitati. Puoi anche acquistare preventivi singoli da 29 € senza abbonamento.`,
    },
    {
      q: `Devo installare qualcosa per usarlo a ${city.name}?`,
      a: `No. prevai funziona direttamente dal browser del tuo smartphone, tablet o PC. Nessun download, nessuna installazione, nessun aggiornamento manuale.`,
    },
  ];
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "prevai",
      description: `Software di preventivazione AI per ${s.labelPlural} a ${city.name} (${city.region}).`,
      url: canonical,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "it",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `Preventivi ${s.label} a ${city.name}`,
      description: `Software di preventivazione AI per ${s.labelPlural} a ${city.name}`,
      serviceType: `Preventivazione ${s.label}`,
      provider: { "@type": "Organization", name: "prevai", url: BASE_URL },
      areaServed: [
        { "@type": "City", name: city.name },
        { "@type": "State", name: city.region },
        { "@type": "Country", name: "Italia" },
      ],
      url: canonical,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: s.label, item: `${BASE_URL}/seo/${s.slug}` },
        { "@type": "ListItem", position: 3, name: city.name, item: canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: cityFaq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
}

function buildSectorBodyHtml(s: SectorData): string {
  const benefitCards = s.benefits
    .map(
      (b) => `
        <div class="bg-white p-7 rounded-2xl">
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(b.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(b.desc)}</p>
        </div>`
    )
    .join("");

  const howItWorksSteps = s.howItWorks
    .map(
      (step, i) => `
        <div>
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5 bg-violet-600">${i + 1}</div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(step.step)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(step.desc)}</p>
        </div>`
    )
    .join("");

  const useCaseItems = s.useCases
    .map(
      (uc) => `
        <li class="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5">
          <span class="text-sm text-gray-700">${esc(uc)}</span>
        </li>`
    )
    .join("");

  const faqItems = s.faq
    .map(
      (f) => `
        <div class="bg-white rounded-2xl p-6">
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(f.q)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(f.a)}</p>
        </div>`
    )
    .join("");

  return `<div class="flex flex-col min-h-screen bg-white">
  <section class="relative overflow-hidden bg-white pt-24 pb-20">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
      <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
        ${esc(s.h1)} <span class="gradient-text">${esc(s.h1Highlight)}</span>
      </h1>
      <p class="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">${esc(s.intro)}</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/sign-up" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Crea il tuo preventivo in 60 secondi
        </a>
        <a href="#come-funziona" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Come funziona
        </a>
      </div>
      <p class="text-sm text-gray-400 mt-5">Nessuna carta di credito richiesta &middot; Preventivo pronto in 30 secondi</p>
    </div>
  </section>

  <section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <h2 class="text-3xl font-bold text-gray-900 text-center mb-14">${esc(s.h2Benefits)}</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">${benefitCards}
      </div>
    </div>
  </section>

  <section id="come-funziona" class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <h2 class="text-3xl font-bold text-gray-900 text-center mb-14">${esc(s.h2HowItWorks)}</h2>
      <div class="grid md:grid-cols-3 gap-8">${howItWorksSteps}
      </div>
    </div>
  </section>

  <section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <h2 class="text-3xl font-bold text-gray-900 text-center mb-12">${esc(s.h2UseCases)}</h2>
      <ul class="grid sm:grid-cols-2 gap-3">${useCaseItems}
      </ul>
    </div>
  </section>

  <section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <h2 class="text-3xl font-bold text-gray-900 text-center mb-12">${esc(s.h2Faq)}</h2>
      <div class="space-y-4">${faqItems}
      </div>
    </div>
  </section>

  <section class="py-24 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">
        Pronto a creare il tuo primo preventivo <span class="gradient-text">in 30 secondi</span>?
      </h2>
      <p class="text-lg text-gray-500 mb-10">
        Unisciti a centinaia di ${esc(s.h1Highlight.toLowerCase())} italiani che usano prevai ogni giorno.
        Nessuna carta di credito. Nessun impegno.
      </p>
      <a href="/sign-up" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        Inizia Gratuitamente
      </a>
    </div>
  </section>
</div>`;
}

function strHash(s: string): number {
  return s.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

function getCityIntro(sectorLabel: string, sectorLabelPlural: string, cityName: string, regionName: string): string {
  const variants = [
    `Sei un ${sectorLabel.toLowerCase()} a ${cityName} e perdi ore a fare preventivi su Excel o carta? prevai è il software di preventivazione con AI pensato per i professionisti del settore in ${regionName}. Descrivi il lavoro in italiano, ottieni un documento professionale in 30 secondi.`,
    `${cityName} conta migliaia di artigiani e PMI attive nel settore. I ${sectorLabelPlural} che usano prevai rispondono ai clienti in pochi minuti anziché in giorni, e vincono più lavori. Nessun Excel, nessun foglio di carta.`,
    `In una città come ${cityName} la concorrenza è alta. I ${sectorLabelPlural} che inviano il preventivo per primi hanno un vantaggio decisivo. Con prevai lo fai in 30 secondi ancora mentre sei dal cliente — direttamente dallo smartphone.`,
    `Operare come ${sectorLabel.toLowerCase()} a ${cityName} significa gestire tanti clienti con richieste diverse. prevai semplifica la parte amministrativa: descrivi il lavoro, l'AI genera il preventivo completo e tu ti concentri sul mestiere.`,
  ];
  const hash = strHash(cityName);
  return variants[hash % variants.length];
}

function buildCityBodyHtml(s: SectorData, city: CityData): string {
  const cityName = city.name;
  const regionName = city.region;
  const intro = getCityIntro(s.label, s.labelPlural, cityName, regionName);

  const benefitCards = s.benefits
    .map(
      (b) => `
        <div class="bg-white p-7 rounded-2xl">
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(b.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(b.desc)}</p>
        </div>`
    )
    .join("");

  const useCaseItems = s.useCases
    .map(
      (uc) => `
        <li class="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5">
          <span class="text-sm text-gray-700">${esc(uc)}</span>
        </li>`
    )
    .join("");

  const cityFaqItems = [
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
      a: `Il piano Starter è 29 €/mese con 20 preventivi inclusi. Il piano Pro è 79 €/mese con preventivi illimitati. Puoi anche acquistare preventivi singoli da 29 € senza abbonamento.`,
    },
    {
      q: `Devo installare qualcosa per usarlo a ${cityName}?`,
      a: `No. prevai funziona direttamente dal browser del tuo smartphone, tablet o PC. Nessun download, nessuna installazione, nessun aggiornamento manuale.`,
    },
  ]
    .map(
      (f) => `
        <div class="bg-white rounded-2xl p-6">
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(f.q)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(f.a)}</p>
        </div>`
    )
    .join("");

  const nearbyLinks = city.nearbySlug
    .map((slug) => {
      const nearbyCity = CITIES_BY_SLUG[slug];
      if (!nearbyCity) return "";
      return `<a href="/seo/${esc(s.slug)}/${esc(nearbyCity.slug)}" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(nearbyCity.name)}</a>`;
    })
    .filter(Boolean)
    .join("\n          ");

  const nearbySection =
    nearbyLinks.length > 0
      ? `
  <section class="py-16 bg-white border-t">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">
        Preventivi per ${esc(s.labelPlural)} nelle città vicine
      </h2>
      <div class="flex flex-wrap gap-2 justify-center">
          ${nearbyLinks}
      </div>
    </div>
  </section>`
      : "";

  return `<div class="flex flex-col min-h-screen bg-white">
  <section class="relative overflow-hidden bg-white pt-24 pb-20">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
      <div class="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
        ${esc(regionName)}
      </div>
      <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
        ${esc(s.h1)} <span class="gradient-text">${esc(s.h1Highlight)}</span><br />
        <span class="text-gray-500 text-3xl sm:text-4xl font-bold">a ${esc(cityName)}</span>
      </h1>
      <p class="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">${esc(intro)}</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/sign-up" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Crea il tuo preventivo gratis
        </a>
        <a href="/seo/${esc(s.slug)}" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Scopri come funziona
        </a>
      </div>
      <p class="text-sm text-gray-400 mt-5">Nessuna carta di credito &middot; Preventivo pronto in 30 secondi</p>
    </div>
  </section>

  <section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <h2 class="text-3xl font-bold text-gray-900 text-center mb-14">
        Perché i ${esc(s.labelPlural)} di ${esc(cityName)} usano prevai
      </h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">${benefitCards}
      </div>
    </div>
  </section>

  <section class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <h2 class="text-3xl font-bold text-gray-900 text-center mb-14">
        Preventivo professionale a ${esc(cityName)} in 3 passi
      </h2>
      <div class="grid md:grid-cols-3 gap-10">
        <div>
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5 bg-violet-600">1</div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">Descrivi il lavoro</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Dal tuo smartphone a ${esc(cityName)}, scrivi cosa devi fare nel linguaggio che usi ogni giorno. L&#39;AI capisce la terminologia di settore.</p>
        </div>
        <div>
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5 bg-violet-600">2</div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">L&#39;AI genera il preventivo</h3>
          <p class="text-sm text-gray-500 leading-relaxed">prevai identifica le voci di costo, stima le quantità e calcola totali e IVA in automatico. Zero errori, zero calcoli manuali.</p>
        </div>
        <div>
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5 bg-violet-600">3</div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">Invia al cliente</h3>
          <p class="text-sm text-gray-500 leading-relaxed">PDF professionale in 30 secondi. Lo mandi via WhatsApp o email al tuo cliente a ${esc(cityName)} prima ancora di uscire dal cantiere.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <h2 class="text-3xl font-bold text-gray-900 text-center mb-12">
        Preventivi per questi lavori a ${esc(cityName)}
      </h2>
      <ul class="grid sm:grid-cols-2 gap-3">${useCaseItems}
      </ul>
    </div>
  </section>

  <section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <h2 class="text-3xl font-bold text-gray-900 text-center mb-12">Domande frequenti</h2>
      <div class="space-y-4">${cityFaqItems}
      </div>
    </div>
  </section>${nearbySection}

  <section class="py-24 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">
        Inizia a creare preventivi a ${esc(cityName)} <span class="gradient-text">in 30 secondi</span>
      </h2>
      <p class="text-lg text-gray-500 mb-10">
        Nessuna carta di credito richiesta. Il tuo primo preventivo professionale è gratis.
      </p>
      <a href="/sign-up" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        Inizia Gratuitamente
      </a>
      <p class="text-sm text-gray-400 mt-4">Preventivo pronto in 30 secondi &middot; Nessun impegno</p>
    </div>
  </section>
</div>`;
}

const template = pruneModulepreload(readFileSync(templatePath, "utf-8"));
let count = 0;

console.log("Prerendering SEO pages...");

for (const [sectorSlug, sector] of Object.entries(SECTORS)) {
  const canonical = `${BASE_URL}/seo/${sectorSlug}`;
  const title = sector.titleVariants[0] ?? sector.titleTag;
  const description = sector.descriptionVariants[0] ?? sector.metaDescription;
  const jsonLd = buildSectorJsonLd(sector);
  const ogImagePath = ogImage(sectorSlug);

  const headBlock = buildHeadBlock({ title, description, canonical, ogImagePath, jsonLd });
  const bodyHtml = buildSectorBodyHtml(sector);
  const html = injectBody(injectHead(template, headBlock), bodyHtml);
  writeRoute(`seo/${sectorSlug}`, html);
  count++;

  if (!CITY_SECTORS.includes(sectorSlug)) continue;

  for (const city of CITIES) {
    const cityCanonical = `${BASE_URL}/seo/${sectorSlug}/${city.slug}`;
    const cityTitle = getCityTitle(sector, city.name, city.slug);
    const cityDesc = getCityDesc(sector, city.name, city.slug, city.region);
    const cityJsonLd = buildCityJsonLd(sector, city);

    const cityHeadBlock = buildHeadBlock({
      title: cityTitle,
      description: cityDesc,
      canonical: cityCanonical,
      ogImagePath: ogImage(sectorSlug),
      jsonLd: cityJsonLd,
    });
    const cityBodyHtml = buildCityBodyHtml(sector, city);
    const cityHtml = injectBody(injectHead(template, cityHeadBlock), cityBodyHtml);
    writeRoute(`seo/${sectorSlug}/${city.slug}`, cityHtml);
    count++;
  }
}

console.log(`Prerendered ${count} SEO pages.`);
