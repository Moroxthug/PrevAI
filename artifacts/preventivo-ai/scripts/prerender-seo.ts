import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SECTORS,
  CITIES,
  CITIES_BY_SLUG,
  CITY_SECTORS,
  getCityTitle,
  getCityDesc,
  RELATED_SECTORS,
  CITY_CONTEXT,
} from "../src/data/seo-data.js";
import type { SectorData, CityData } from "../src/data/seo-data.js";
import { CITY_INTELLIGENCE, DEMAND_TEXT } from "../src/data/seo-intelligence.js";
import type { CityIntelligence } from "../src/data/seo-intelligence.js";
import {
  strHash,
  getCityIntro,
  getCityFaqItems,
  getCityLayout,
  getCityCtaVariant,
  getCityCtaTexts,
  getCityHowItWorksSteps,
  getNearbyAnchors,
  buildCityJsonLd as buildCityJsonLdFromEngine,
} from "../src/data/seo-render-engine.js";
import {
  BLOG_ARTICLES,
  BLOG_CATEGORIES,
  BLOG_LIST_TITLE,
  BLOG_LIST_DESCRIPTION,
  SECTOR_ARTICLES,
  getArticlesByCategory,
} from "../src/data/blog-data.js";
import type { BlogArticle, BlogCategory } from "../src/data/blog-data.js";
import { extractToc, injectHeadingIds } from "../src/data/blog-toc.js";
import {
  TESTIMONIALS,
  AGGREGATE_RATING,
} from "../src/components/testimonials-section.js";

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

const TOP20_CITY_SLUGS = [
  "roma", "milano", "napoli", "torino", "palermo", "genova", "bologna",
  "firenze", "bari", "catania", "venezia", "verona", "messina", "padova",
  "trieste", "brescia", "reggio-calabria", "modena", "parma", "prato",
];

// ─── Core utilities ────────────────────────────────────────────────────────

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

// ─── PublicLayout wrapper ────────────────────────────────────────────────────
// Wraps prerendered body content in the same HTML structure that React renders
// for PublicLayout so hydration finds a matching DOM and produces zero CLS.

const CURRENT_YEAR = new Date().getFullYear();

const STATIC_LOGO = `<img src="/prevai-logo.png" alt="prevai" width="144" height="72" style="height: 72px; width: auto; object-fit: contain;">`;

const STATIC_HEADER = `<header class="sticky top-0 z-50 w-full transition-all duration-300 bg-transparent border-b border-transparent">
  <div class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
    <a href="/" class="flex items-center">${STATIC_LOGO}</a>
    <nav class="flex items-center gap-3">
      <a href="/sign-in" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full">Accedi</a>
      <a href="/sign-up" class="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold">Registrati</a>
    </nav>
  </div>
</header>`;

const STATIC_FOOTER = `<footer class="border-t py-12 md:py-16 bg-white">
  <div class="container mx-auto px-4 md:px-6">
    <div class="grid grid-cols-1 md:grid-cols-5 gap-8">
      <div class="md:col-span-2">
        <a href="/" class="flex items-center mb-4">${STATIC_LOGO}</a>
        <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">Il software di preventivazione con AI per artigiani e PMI italiane. Veloce, professionale, pronto in 30 secondi.</p>
      </div>
      <div class="md:col-span-2">
        <h4 class="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Professioni</h4>
        <ul class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <li><a href="/seo/imbianchino/" class="hover:text-foreground transition-colors">Imbianchino</a></li>
          <li><a href="/seo/muratore/" class="hover:text-foreground transition-colors">Muratore</a></li>
          <li><a href="/seo/elettricista/" class="hover:text-foreground transition-colors">Elettricista</a></li>
          <li><a href="/seo/pittore/" class="hover:text-foreground transition-colors">Pittore</a></li>
          <li><a href="/seo/idraulico/" class="hover:text-foreground transition-colors">Idraulico</a></li>
          <li><a href="/seo/piastrellista/" class="hover:text-foreground transition-colors">Piastrellista</a></li>
          <li><a href="/seo/edilizia/" class="hover:text-foreground transition-colors">Imprese Edili</a></li>
          <li><a href="/seo/giardiniere/" class="hover:text-foreground transition-colors">Giardiniere</a></li>
          <li><a href="/seo/ristrutturazione/" class="hover:text-foreground transition-colors">Ristrutturazioni</a></li>
          <li><a href="/seo/serramentista/" class="hover:text-foreground transition-colors">Serramentista</a></li>
          <li><a href="/seo/carpentiere/" class="hover:text-foreground transition-colors">Carpentieri</a></li>
          <li><a href="/seo/tetto/" class="hover:text-foreground transition-colors">Coperture e Tetti</a></li>
          <li><a href="/seo/falegname/" class="hover:text-foreground transition-colors">Falegnami</a></li>
          <li><a href="/seo/condizionatori/" class="hover:text-foreground transition-colors">Condizionatori</a></li>
          <li><a href="/seo/freelance/" class="hover:text-foreground transition-colors">Freelance</a></li>
          <li><a href="/seo/pavimentista/" class="hover:text-foreground transition-colors">Pavimentista</a></li>
          <li><a href="/seo/geometra/" class="hover:text-foreground transition-colors">Geometri</a></li>
          <li><a href="/seo/termoidraulico/" class="hover:text-foreground transition-colors">Termoidraulico</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Guide</h4>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/blog/" class="hover:text-foreground transition-colors font-medium text-foreground/80">Blog &amp; Approfondimenti</a></li>
          <li><a href="/seo/modello-excel/" class="hover:text-foreground transition-colors">Modello Excel</a></li>
          <li><a href="/seo/modello-word/" class="hover:text-foreground transition-colors">Modello Word</a></li>
          <li><a href="/seo/come-fare-preventivo/" class="hover:text-foreground transition-colors">Come Fare un Preventivo</a></li>
          <li><a href="/seo/preventivi-gratis/" class="hover:text-foreground transition-colors">Preventivi Gratis</a></li>
        </ul>
        <h4 class="font-semibold mt-8 mb-4 text-sm uppercase tracking-wider text-foreground">Azienda</h4>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/chi-siamo/" class="hover:text-foreground transition-colors">Chi Siamo</a></li>
          <li><a href="/contatti/" class="hover:text-foreground transition-colors">Contatti</a></li>
          <li><button class="hover:text-foreground transition-colors text-left">Supporto</button></li>
          <li><a href="/privacy/" class="hover:text-foreground transition-colors">Privacy Policy</a></li>
          <li><a href="/termini/" class="hover:text-foreground transition-colors">Termini di Servizio</a></li>
        </ul>
      </div>
    </div>
    <div class="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">© ${CURRENT_YEAR} prevai. Tutti i diritti riservati.</div>
  </div>
</footer>`;

const STATIC_WHATSAPP = `<a href="https://wa.me/393791059492" target="_blank" rel="noopener noreferrer" aria-label="Chatta con noi su WhatsApp" class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full shadow-lg shadow-green-200/60 transition-all duration-200 hover:scale-105 active:scale-95" style="background: rgb(37, 211, 102);"><span class="flex h-14 w-14 items-center justify-center rounded-full" style="background: rgb(37, 211, 102);"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" fill="white"><path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.675 4.797 1.849 6.785L2 30l7.438-1.82A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.842-1.6l-.418-.248-4.41 1.08 1.112-4.3-.272-.44A11.46 11.46 0 0 1 4.5 16C4.5 9.649 9.649 4.5 16 4.5S27.5 9.649 27.5 16 22.351 27.5 16 27.5zm6.29-8.61c-.344-.172-2.036-1.004-2.352-1.118-.317-.115-.547-.172-.778.172-.23.344-.893 1.118-1.094 1.348-.2.23-.403.258-.747.086-.344-.172-1.452-.535-2.766-1.707-1.022-.912-1.713-2.038-1.913-2.382-.2-.344-.021-.53.15-.7.155-.155.344-.403.517-.604.172-.2.23-.344.344-.574.115-.23.057-.43-.029-.603-.086-.172-.778-1.876-1.066-2.568-.28-.673-.566-.582-.778-.593l-.663-.011c-.23 0-.603.086-.919.43s-1.207 1.18-1.207 2.876 1.236 3.337 1.408 3.567c.172.23 2.432 3.712 5.892 5.206.824.355 1.467.568 1.969.727.827.263 1.58.226 2.175.137.663-.099 2.036-.832 2.323-1.635.287-.804.287-1.493.2-1.636-.086-.143-.317-.23-.66-.402z"/></svg></span><span class="pr-5 text-white text-sm font-semibold whitespace-nowrap hidden sm:inline-block">Hai bisogno di aiuto?</span></a>`;

function wrapInPublicLayout(contentHtml: string): string {
  return `<div class="min-h-[100dvh] flex flex-col bg-background text-foreground">
${STATIC_HEADER}
<main class="flex-1 flex flex-col">${contentHtml}</main>
${STATIC_FOOTER}
${STATIC_WHATSAPP}
</div>`;
}

// ─── Phase 7: Visible HTML breadcrumb ──────────────────────────────────────

function buildBreadcrumb(items: { name: string; href: string | null }[]): string {
  const crumbs = items
    .map((item, i) => {
      const sep =
        i > 0
          ? `<li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>`
          : "";
      const content = item.href === null
        ? `<li class="text-gray-900 font-medium truncate max-w-[200px]" aria-current="page">${esc(item.name)}</li>`
        : `<li><a href="${esc(item.href)}" class="hover:text-violet-600 transition-colors">${esc(item.name)}</a></li>`;
      return sep + content;
    })
    .join("\n      ");
  return `<nav aria-label="Percorso di navigazione" class="bg-white border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
    <ol class="flex items-center text-sm text-gray-500 flex-wrap">
      ${crumbs}
    </ol>
  </div>
</nav>`;
}

// ─── Phase 2B: City grid on sector pages ───────────────────────────────────

function buildSectorCityGrid(s: SectorData): string {
  const byRegion = new Map<string, CityData[]>();
  for (const city of CITIES) {
    const arr = byRegion.get(city.region) ?? [];
    arr.push(city);
    byRegion.set(city.region, arr);
  }
  const regionBlocks = Array.from(byRegion.entries())
    .map(([region, cities]) => {
      const cityLinks = cities
        .map(
          (c) =>
            `<a href="/seo/${esc(s.slug)}/${esc(c.slug)}/" class="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(c.name)}</a>`
        )
        .join("\n            ");
      return `<div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">${esc(region)}</h3>
          <div class="flex flex-wrap gap-2">
            ${cityLinks}
          </div>
        </div>`;
    })
    .join("\n        ");
  return `<section class="py-20 bg-gray-50">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-12">
      <h2 class="text-2xl font-bold text-gray-900">Preventivi ${esc(s.label)} nelle principali città</h2>
      <p class="text-sm text-gray-500 mt-2">Seleziona la tua città per informazioni e prezzi locali</p>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      ${regionBlocks}
    </div>
  </div>
</section>`;
}

// ─── Phase 2C: Related sectors (used on both sector + city pages) ───────────

function buildRelatedSectorsSection(s: SectorData, heading?: string): string {
  const related = RELATED_SECTORS[s.slug];
  if (!related || related.length === 0) return "";
  const h = heading ?? "Servizi correlati";
  const links = related
    .map(
      (r) =>
        `<a href="/seo/${esc(r.slug)}/" class="flex items-center gap-2 bg-white border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors">
          <span class="text-violet-400 font-bold" aria-hidden="true">→</span> ${esc(r.label)}
        </a>`
    )
    .join("\n      ");
  return `<section class="py-14 bg-white border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">${esc(h)}</h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      ${links}
    </div>
  </div>
</section>`;
}

// ─── Approfondimenti section (blog articles related to a sector) ─────────────

function buildApprofondimentiSection(sectorSlug: string): string {
  const slugs = SECTOR_ARTICLES[sectorSlug];
  if (!slugs || slugs.length === 0) return "";
  const articles = slugs
    .map((slug) => BLOG_ARTICLES.find((a) => a.slug === slug))
    .filter((a): a is BlogArticle => a !== null && a !== undefined)
    .slice(0, 3);
  if (articles.length === 0) return "";

  const cards = articles
    .map(
      (a) =>
        `<a href="/blog/${esc(a.slug)}/" class="group flex flex-col bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all duration-200 p-5">
          <span class="text-xs font-semibold text-violet-700 mb-2">${esc(a.category)}</span>
          <span class="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors leading-snug mb-3">${esc(a.title)}</span>
          <span class="text-xs text-gray-400 mt-auto">${a.readingTimeMin} min di lettura</span>
        </a>`
    )
    .join("\n      ");

  return `<section class="py-14 bg-gray-50 border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-base font-semibold text-gray-900">Approfondimenti</h2>
      <a href="/blog" class="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors">Tutti gli articoli →</a>
    </div>
    <div class="grid sm:grid-cols-3 gap-4">
      ${cards}
    </div>
  </div>
</section>`;
}

// ─── Phase 4: City context block (max 1 per city page) ─────────────────────

function buildCityContextBlock(city: CityData, s: SectorData): string {
  const context = CITY_CONTEXT[city.slug];
  if (!context) return "";
  return `<section class="py-10 bg-violet-50/50 border-y border-violet-100/60">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="flex gap-4 items-start">
      <div class="shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div>
        <h2 class="text-sm font-semibold text-violet-700 mb-1.5">${esc(s.label)} a ${esc(city.name)} — mercato locale</h2>
        <p class="text-sm text-gray-600 leading-relaxed">${esc(context)}</p>
      </div>
    </div>
  </div>
</section>`;
}

// ─── JSON-LD schema builders ────────────────────────────────────────────────

function buildSectorJsonLd(s: SectorData): object[] {
  const canonical = `${BASE_URL}/seo/${s.slug}/`;
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
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
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
  return buildCityJsonLdFromEngine(s, city);
}

// ─── Phase 3: Sector body — 2 layout variants ──────────────────────────────

function buildSectorBodyHtml(s: SectorData): string {
  const layout = strHash(s.slug) % 2;

  const breadcrumb = buildBreadcrumb([
    { name: "Home", href: "/" },
    { name: s.label, href: null },
  ]);

  const sHero = `<section class="relative overflow-hidden bg-white pt-24 pb-20">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
      <div class="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Pensato per il mercato italiano
      </div>
      <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
        ${esc(s.h1)} <span class="gradient-text">${esc(s.h1Highlight)}</span>
      </h1>
      <p class="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">${esc(s.intro)}</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/sign-up" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Crea il tuo preventivo gratis
        </a>
        <a href="#come-funziona" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Come funziona
        </a>
      </div>
      <p class="text-sm text-gray-400 mt-5">Nessuna carta di credito &middot; Preventivo pronto in 30 secondi</p>
    </div>
  </section>`;

  const sBenefits = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">${esc(s.h2Benefits)}</h2>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${s.benefits.map((b) => `<div class="card-soft bg-white p-7 rounded-2xl flex flex-col">
          <div class="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mb-5 shrink-0" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true"></div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(b.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(b.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const sHowItWorks = `<section id="come-funziona" class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">${esc(s.h2HowItWorks)}</h2>
      </div>
      <div class="grid md:grid-cols-3 gap-8">
        ${s.howItWorks.map((step, i) => `<div>
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">${i + 1}</div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(step.step)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(step.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const sUseCases = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">${esc(s.h2UseCases)}</h2>
      </div>
      <ul class="grid sm:grid-cols-2 gap-3">
        ${s.useCases.map((uc) => `<li class="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 card-soft">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <span class="text-sm text-gray-700">${esc(uc)}</span>
        </li>`).join("")}
      </ul>
    </div>
  </section>`;

  const sItalianMarket = `<section class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <div class="rounded-2xl p-10 md:p-14 relative overflow-hidden" style="background:linear-gradient(135deg,rgba(124,58,237,0.06),rgba(6,182,212,0.06))">
        <div class="relative z-10">
          <div class="flex items-center gap-3 mb-6">
            <div class="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
            </div>
            <h2 class="text-2xl font-bold text-gray-900">Pensato per il mercato italiano</h2>
          </div>
          <div class="grid md:grid-cols-3 gap-6 text-sm text-gray-600 leading-relaxed">
            <div>
              <div class="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                IVA italiana integrata
              </div>
              <p>Il calcolo dell&apos;IVA al 10%, 22% e con regime forfettario è automatico. Nessun errore nella dichiarazione.</p>
            </div>
            <div>
              <div class="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Dati aziendali italiani
              </div>
              <p>Partita IVA, Codice Fiscale, Codice SDI — tutti i campi obbligatori per la fatturazione italiana.</p>
            </div>
            <div>
              <div class="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                Lessico tecnico in italiano
              </div>
              <p>L&apos;AI è addestrata con terminologia edilizia, impiantistica e artigianale italiana per preventivi precisi.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const sFaq = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">${esc(s.h2Faq)}</h2>
      </div>
      <div class="space-y-4">
        ${s.faq.map((f) => `<div class="bg-white rounded-2xl p-6 card-soft">
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(f.q)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(f.a)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const ctaVariant = strHash(s.slug + "cta") % 3;
  const ctaHeading =
    ctaVariant === 0
      ? `Pronto a creare il tuo primo preventivo <span class="gradient-text">in 30 secondi</span>?`
      : ctaVariant === 1
        ? `Smetti di perdere tempo con Excel. <span class="gradient-text">Inizia gratis</span>.`
        : `Unisciti a migliaia di ${esc(s.h1Highlight.toLowerCase())} italiani. <span class="gradient-text">È gratis</span>.`;
  const ctaBtn =
    ctaVariant === 0 ? "Inizia Gratuitamente" : ctaVariant === 1 ? "Crea account gratuito" : "Prova gratis — nessun impegno";

  const sCta = `<section class="py-24 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">${ctaHeading}</h2>
      <p class="text-lg text-gray-500 mb-10">
        Nessuna carta di credito. Nessun impegno. Il tuo primo preventivo è gratis.
      </p>
      <a href="/sign-up" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        ${ctaBtn}
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
  </section>`;

  const sRelated = buildRelatedSectorsSection(s, "Servizi correlati — genera preventivi per");
  const sCityGrid = CITY_SECTORS.includes(s.slug) ? buildSectorCityGrid(s) : "";
  const sApprofondimenti = buildApprofondimentiSection(s.slug);

  const middleSections =
    layout === 0
      ? [sBenefits, sHowItWorks, sUseCases, sItalianMarket, sFaq]
      : [sHowItWorks, sUseCases, sBenefits, sFaq, sItalianMarket];

  return wrapInPublicLayout(`<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  ${sHero}
  ${middleSections.join("\n  ")}
  ${sRelated}
  ${sCityGrid}
  ${sApprofondimenti}
  ${sCta}
</div>`);
}

// ─── Phase 3: City body — 3 layout variants ────────────────────────────────

// ─── Phase 9: Osservatorio Prezzi e Domanda ────────────────────────────────

function buildOsservatorio(s: SectorData, city: CityData, intel: CityIntelligence): string {
  const pct = Math.round(Math.abs(intel.priceIndex - 1.0) * 100);
  const priceLabel = intel.priceIndex > 1.0 ? `+${pct}%` : intel.priceIndex < 1.0 ? `\u2212${pct}%` : `\u00b10%`;
  const priceColor =
    intel.priceIndex > 1.05 ? "text-amber-600" : intel.priceIndex < 0.95 ? "text-green-600" : "text-gray-800";
  const demandLabels: Record<CityIntelligence["demandLevel"], string> = {
    LOW: "Moderata", MEDIUM: "Media", HIGH: "Elevata", CRITICAL: "Molto elevata",
  };
  const demandColors: Record<CityIntelligence["demandLevel"], string> = {
    LOW: "text-green-600", MEDIUM: "text-blue-600", HIGH: "text-amber-600", CRITICAL: "text-red-600",
  };
  const [sv1, sv2, sv3] = intel.topServices;
  void s;
  return `<section class="py-10 bg-white border-b border-gray-100" aria-label="Osservatorio prezzi e domanda ${esc(city.name)}">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <div class="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-cyan-50/20 p-6 md:p-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <h2 class="text-base font-bold text-gray-900">Osservatorio Prezzi e Domanda: ${esc(city.name)}</h2>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Indice prezzi</div>
          <div class="text-2xl font-bold ${priceColor}">${priceLabel}</div>
          <div class="text-xs text-gray-400 mt-1">vs. media nazionale</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Domanda</div>
          <div class="text-base font-bold ${demandColors[intel.demandLevel]}">${demandLabels[intel.demandLevel]}</div>
          <div class="text-xs text-gray-400 mt-1">${esc(city.region)}</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Lead time</div>
          <div class="text-base font-bold text-gray-800">${esc(intel.avgLeadTime)}</div>
          <div class="text-xs text-gray-400 mt-1">risposta stimata</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Servizi top</div>
          <ul class="space-y-1.5">
            <li class="flex items-start gap-1 text-xs text-gray-600"><span class="text-violet-400 shrink-0 font-bold" aria-hidden="true">&rsaquo;</span>${esc(sv1)}</li>
            <li class="flex items-start gap-1 text-xs text-gray-600"><span class="text-violet-400 shrink-0 font-bold" aria-hidden="true">&rsaquo;</span>${esc(sv2)}</li>
            <li class="flex items-start gap-1 text-xs text-gray-600"><span class="text-violet-400 shrink-0 font-bold" aria-hidden="true">&rsaquo;</span>${esc(sv3)}</li>
          </ul>
        </div>
      </div>
      <p class="text-sm text-gray-500 leading-relaxed border-t border-violet-100 pt-4">${esc(intel.localInsight)}</p>
    </div>
  </div>
</section>`;
}

function buildCityBodyHtml(s: SectorData, city: CityData): string {
  const layout = getCityLayout(s, city);
  const cityName = city.name;
  const regionName = city.region;
  const intel = CITY_INTELLIGENCE[city.slug];
  const intro = getCityIntro(s, city);

  const breadcrumb = buildBreadcrumb([
    { name: "Home", href: "/" },
    { name: s.label, href: `/seo/${s.slug}/` },
    { name: cityName, href: null },
  ]);

  const sHero = `<section class="relative overflow-hidden bg-white pt-24 pb-20">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
      <div class="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
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
        <a href="/seo/${esc(s.slug)}/" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Scopri come funziona
        </a>
      </div>
      <p class="text-sm text-gray-400 mt-5">Nessuna carta di credito &middot; Preventivo pronto in 30 secondi</p>
    </div>
  </section>`;

  const sOsservatorio = intel ? buildOsservatorio(s, city, intel) : "";

  const sBenefits = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">Perché i ${esc(s.labelPlural)} di ${esc(cityName)} scelgono prevai</h2>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${s.benefits.map((b) => `<div class="card-soft bg-white p-7 rounded-2xl flex flex-col">
          <div class="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mb-5 shrink-0" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true"></div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(b.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(b.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const howItWorksSteps = getCityHowItWorksSteps(cityName);
  const sHowItWorks = `<section class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">Preventivo professionale a ${esc(cityName)} in 3 passi</h2>
      </div>
      <div class="grid md:grid-cols-3 gap-10">
        ${howItWorksSteps.map((step) => `<div>
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">${esc(step.n)}</div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(step.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(step.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const sUseCases = `<section class="py-20 ${layout === 2 ? "bg-white" : "bg-gray-50"}">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">Preventivi per questi lavori a ${esc(cityName)}</h2>
      </div>
      <ul class="grid sm:grid-cols-2 gap-3">
        ${s.useCases.map((uc) => `<li class="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 card-soft">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <span class="text-sm text-gray-700">${esc(uc)}</span>
        </li>`).join("")}
      </ul>
    </div>
  </section>`;

  const cityFaqItems = getCityFaqItems(s, city);

  const sFaq = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">Domande frequenti</h2>
      </div>
      <div class="space-y-4">
        ${cityFaqItems.map((f) => `<div class="bg-white rounded-2xl p-6 card-soft">
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(f.q)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(f.a)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const nearbyLinks = getNearbyAnchors(s, city)
    .map(({ slug, anchorText }) =>
      `<a href="/seo/${esc(s.slug)}/${esc(slug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(anchorText)}</a>`
    )
    .join("\n          ");

  const sNearby = nearbyLinks
    ? `<section class="py-16 bg-white border-t border-gray-100">
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

  const sContext = buildCityContextBlock(city, s);
  const sRelated = buildRelatedSectorsSection(s, `Scopri anche: preventivi per`);
  const sApprofondimenti = buildApprofondimentiSection(s.slug);

  const ctaTexts = getCityCtaTexts(getCityCtaVariant(s, city), cityName);
  const ctaHeading =
    `${esc(ctaTexts.headingPrefix)}<span class="gradient-text">${esc(ctaTexts.headingGradient)}</span>`;

  const sCta = `<section class="py-24 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">${ctaHeading}</h2>
      <p class="text-lg text-gray-500 mb-10">
        Nessuna carta di credito richiesta. Il tuo primo preventivo professionale è gratis.
      </p>
      <a href="/sign-up" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        ${esc(ctaTexts.button)}
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
      <p class="text-sm text-gray-400 mt-4">Preventivo pronto in 30 secondi &middot; Nessun impegno</p>
    </div>
  </section>`;

  const mainSections =
    layout === 0
      ? [sBenefits, sHowItWorks, sUseCases, sFaq]
      : layout === 1
        ? [sHowItWorks, sUseCases, sBenefits, sFaq]
        : [sUseCases, sBenefits, sHowItWorks, sFaq];

  return `<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  ${sHero}
  ${sOsservatorio}
  ${mainSections.join("\n  ")}
  ${sContext}
  ${sNearby}
  ${sRelated}
  ${sApprofondimenti}
  ${sCta}
</div>`;
}

// ─── Phase 1: Homepage prerender ────────────────────────────────────────────

function buildHomepageBodyHtml(): string {
  const sectorLinks = Object.values(SECTORS)
    .map(
      (s) =>
        `<a href="/seo/${esc(s.slug)}/" class="group flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 text-center hover:border-violet-200 hover:shadow-sm transition-all">
          <div class="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm text-violet-600 bg-violet-50" aria-hidden="true">${esc(s.label.charAt(0))}</div>
          <span class="text-sm font-medium text-gray-700 group-hover:text-violet-700 transition-colors">${esc(s.label)}</span>
        </a>`
    )
    .join("\n      ");

  const top20Cities = TOP20_CITY_SLUGS.map((slug) => CITIES_BY_SLUG[slug]).filter(Boolean);
  const cityLinks = top20Cities
    .map(
      (city) =>
        `<a href="/seo/ristrutturazione/${esc(city.slug)}/" class="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(city.name)}</a>`
    )
    .join("\n      ");

  return `<div class="flex flex-col min-h-screen bg-white">
  <section class="relative overflow-hidden bg-white pt-28 pb-36">
    <div class="mesh-blob mesh-blob-1" aria-hidden="true"></div>
    <div class="mesh-blob mesh-blob-2" aria-hidden="true"></div>
    <div class="mesh-blob mesh-blob-3" aria-hidden="true"></div>
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
      <h1 class="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl leading-[1.1]">
        Crea preventivi professionali in <span class="gradient-text">30 secondi</span> con l&apos;AI
      </h1>
      <p class="mx-auto mt-8 max-w-2xl text-xl text-gray-500 leading-relaxed">
        Dimentica Excel e i documenti scritti a mano. Descrivi il lavoro a parole tue e prevai genera un documento impeccabile, pronto da inviare al cliente.
      </p>
      <div class="mt-12 flex flex-col sm:flex-row justify-center gap-4">
        <a href="/sign-up" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Inizia Gratuitamente
          <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
        <a href="#come-funziona" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Vedi come funziona
        </a>
      </div>
      <p class="mt-6 text-sm text-gray-400">
        ✓ Gratis per iniziare &nbsp;&middot;&nbsp; ✓ Nessuna carta richiesta &nbsp;&middot;&nbsp; ✓ Preventivo in 30 secondi
      </p>
    </div>
  </section>

  <section id="come-funziona" class="fade-in-section py-28 bg-gray-50/60">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900 sm:text-4xl">Basta Excel. Basta fogli scritti a mano.</h2>
        <p class="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">prevai trasforma una descrizione in linguaggio naturale in un preventivo professionale con tutti i calcoli già fatti.</p>
      </div>
      <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <div class="card-soft bg-white rounded-2xl p-8">
          <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-white mb-6" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-3">Scrivi in italiano</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Nessun campo da compilare. Descrivi il lavoro come lo descriveresti a voce — l&apos;AI capisce e struttura tutto automaticamente.</p>
        </div>
        <div class="card-soft bg-white rounded-2xl p-8">
          <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-white mb-6" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-3">PDF professionale immediato</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Voci di costo, quantità, prezzi unitari, IVA e totale — tutto calcolato e formattato. Pronto da inviare via WhatsApp o email.</p>
        </div>
        <div class="card-soft bg-white rounded-2xl p-8">
          <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-white mb-6" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-3">Correggi quello che vuoi</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Ogni voce è modificabile direttamente nell&apos;anteprima. Cambia prezzi, aggiungi lavorazioni, personalizza le condizioni di pagamento.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="fade-in-section py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h2 class="text-2xl font-bold text-gray-900 sm:text-3xl">Preventivi per ogni professione</h2>
        <p class="mt-3 text-base text-gray-500">Imbianchini, elettricisti, idraulici, falegnami, muratori e molti altri — prevai funziona per tutti.</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-w-5xl mx-auto">
        ${sectorLinks}
      </div>
    </div>
  </section>

  <section class="fade-in-section py-20 bg-gray-50/60">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <div class="mb-10">
        <h2 class="text-2xl font-bold text-gray-900 sm:text-3xl">Preventivi nelle principali città italiane</h2>
        <p class="mt-3 text-base text-gray-500">Usato da artigiani e professionisti da Nord a Sud Italia.</p>
      </div>
      <div class="flex flex-wrap gap-3 justify-center max-w-3xl mx-auto">
        ${cityLinks}
      </div>
    </div>
  </section>

  <section class="fade-in-section py-14 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-8">
        <span class="inline-block bg-amber-50 text-amber-600 text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-3">Recensioni verificate</span>
        <h2 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Cosa dicono <span class="gradient-text">di noi</span></h2>
        <div class="flex items-center justify-center gap-2 mt-3" aria-label="Valutazione media ${AGGREGATE_RATING.ratingValue} su 5">
          <div class="flex gap-0.5" aria-hidden="true">
            ${Array.from({ length: 5 }).map(() => `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-400 fill-amber-400" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join("")}
          </div>
          <span class="text-sm font-bold text-gray-800">${AGGREGATE_RATING.ratingValue}</span>
          <span class="text-sm text-gray-400">/5 &middot; ${AGGREGATE_RATING.reviewCount} recensioni</span>
        </div>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
        ${TESTIMONIALS.map((t) => {
          const initials = t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
          const stars = Array.from({ length: 5 }).map((_, i) =>
            `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 ${i < t.rating ? "text-amber-400 fill-amber-400" : "text-gray-100 fill-gray-100"}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
          ).join("");
          return `<div class="bg-white rounded-xl border border-gray-100 p-5 card-soft flex flex-col gap-3">
            <div class="flex gap-0.5" aria-label="${t.rating} stelle su 5">${stars}</div>
            <p class="text-sm text-gray-700 leading-relaxed flex-1">&ldquo;${esc(t.text)}&rdquo;</p>
            <div class="flex items-center gap-3 pt-2 border-t border-gray-50">
              <div class="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">${initials}</div>
              <div>
                <div class="text-sm font-semibold text-gray-900">${esc(t.name)}</div>
                <div class="text-xs text-gray-400">${esc(t.role)} &middot; ${esc(t.city)}</div>
              </div>
            </div>
          </div>`;
        }).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="fade-in-section py-28 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
        Pronto a creare il tuo primo preventivo <span class="gradient-text">in 30 secondi</span>?
      </h2>
      <p class="text-lg text-gray-500 mb-10">
        Unisciti a centinaia di professionisti italiani che usano prevai ogni giorno. Nessuna carta di credito. Nessun impegno.
      </p>
      <a href="/sign-up" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        Inizia Gratuitamente
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
  </section>
</div>`;
}

// ─── Main execution ─────────────────────────────────────────────────────────

const template = pruneModulepreload(readFileSync(templatePath, "utf-8"));
let count = 0;

console.log("Prerendering SEO pages...");

// Phase 1: Prerender homepage
const homepageAggregateRatingSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "prevai",
  url: BASE_URL,
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: AGGREGATE_RATING.ratingValue,
    reviewCount: String(AGGREGATE_RATING.reviewCount),
    bestRating: "5",
    worstRating: "1",
  },
  review: TESTIMONIALS.map((t) => ({
    "@type": "Review",
    author: { "@type": "Person", name: t.name },
    reviewRating: { "@type": "Rating", ratingValue: String(t.rating), bestRating: "5" },
    reviewBody: t.text,
  })),
};
const homepageWebSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "prevai",
  url: BASE_URL,
  description: "Software AI per preventivi professionali in 30 secondi. Per artigiani, PMI e freelance italiani.",
  inLanguage: "it",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${BASE_URL}/seo/{search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};
const homepageSoftwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "prevai",
  description: "Software di preventivazione con intelligenza artificiale per artigiani, PMI e professionisti italiani.",
  url: BASE_URL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Prova gratuita disponibile" },
  audience: { "@type": "BusinessAudience", audienceType: "Artigiani, PMI, Professionisti, Freelance" },
  inLanguage: "it",
  availableLanguage: "Italian",
  provider: { "@type": "Organization", name: "prevai", url: BASE_URL },
};
const homepageHeadBlock = buildHeadBlock({
  title: "prevai – Preventivi Online per Artigiani e Aziende | AI in 30 Secondi",
  description: "Crea preventivi professionali in 30 secondi con l'AI. Software di preventivazione per artigiani, PMI e professionisti italiani. Niente Excel, niente errori. Provalo gratis.",
  canonical: BASE_URL,
  ogImagePath: "/opengraph.jpg",
  jsonLd: [homepageWebSiteSchema, homepageSoftwareSchema, homepageAggregateRatingSchema],
});
const homepageHtml = injectBody(injectHead(template, homepageHeadBlock), buildHomepageBodyHtml());
writeFileSync(templatePath, homepageHtml, "utf-8");
count++;
console.log("  ✓ Homepage prerendered");

// Phase 2–8: Sector + city pages
for (const [sectorSlug, sector] of Object.entries(SECTORS)) {
  // Phase 3A: deterministic title/desc variant via hash (not always [0])
  const titleHash = strHash(sectorSlug + "t");
  const title =
    sector.titleVariants.length > 0
      ? sector.titleVariants[titleHash % sector.titleVariants.length]
      : sector.titleTag;
  const descHash = strHash(sectorSlug + "d");
  const description =
    sector.descriptionVariants.length > 0
      ? sector.descriptionVariants[descHash % sector.descriptionVariants.length]
      : sector.metaDescription;

  const canonical = `${BASE_URL}/seo/${sectorSlug}/`;
  const jsonLd = buildSectorJsonLd(sector);
  const ogImagePath = ogImage(sectorSlug);

  const headBlock = buildHeadBlock({ title, description, canonical, ogImagePath, jsonLd });
  const bodyHtml = buildSectorBodyHtml(sector);
  const html = injectBody(injectHead(template, headBlock), bodyHtml);
  writeRoute(`seo/${sectorSlug}`, html);
  count++;

  if (!CITY_SECTORS.includes(sectorSlug)) continue;

  for (const city of CITIES) {
    const cityCanonical = `${BASE_URL}/seo/${sectorSlug}/${city.slug}/`;
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

// ─── Blog JSON-LD builders ───────────────────────────────────────────────────

function buildBlogListJsonLd(): object[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: BLOG_LIST_TITLE,
      description: BLOG_LIST_DESCRIPTION,
      url: `${BASE_URL}/blog/`,
      inLanguage: "it",
      publisher: {
        "@type": "Organization",
        name: "prevai",
        url: BASE_URL,
        logo: { "@type": "ImageObject", url: `${BASE_URL}/icon-192.png`, width: 192, height: 192 },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog/` },
      ],
    },
  ];
}

function buildArticleJsonLd(article: BlogArticle): object[] {
  const canonical = `${BASE_URL}/blog/${article.slug}/`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.metaDescription,
      url: canonical,
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      inLanguage: "it",
      author: {
        "@type": "Organization",
        name: "prevai",
        url: BASE_URL,
      },
      publisher: {
        "@type": "Organization",
        name: "prevai",
        url: BASE_URL,
        logo: { "@type": "ImageObject", url: `${BASE_URL}/icon-192.png`, width: 192, height: 192 },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog/` },
        { "@type": "ListItem", position: 3, name: article.title, item: canonical },
      ],
    },
  ];
}

// ─── Blog list page body HTML ─────────────────────────────────────────────────

const BLOG_CATEGORY_STYLE: Record<string, string> = {
  Professioni: "background:#f5f3ff;color:#6d28d9",
  Prezzi: "background:#ecfeff;color:#0e7490",
  Consigli: "background:#fffbeb;color:#d97706",
  Tool: "background:#f0fdf4;color:#15803d",
  Innovazione: "background:#eff6ff;color:#1d4ed8",
  Business: "background:#fff1f2;color:#be123c",
};

function buildBlogListBodyHtml(): string {
  const breadcrumb = `<nav aria-label="Percorso di navigazione" class="bg-white border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
    <ol class="flex items-center text-sm text-gray-500 flex-wrap">
      <li><a href="/" class="hover:text-violet-600 transition-colors">Home</a></li>
      <li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>
      <li class="text-gray-900 font-medium" aria-current="page">Blog</li>
    </ol>
  </div>
</nav>`;

  const hero = `<section class="bg-white pt-16 pb-12 border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
    <div class="inline-flex items-center gap-2 rounded-full bg-violet-100 border border-violet-200 px-4 py-1.5 text-sm font-medium text-violet-700 mb-6">
      Approfondimenti
    </div>
    <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-4 leading-tight">
      Guide e consigli per <span class="gradient-text">artigiani e PMI</span>
    </h1>
    <p class="text-lg text-gray-500 max-w-2xl mx-auto">${esc(BLOG_LIST_DESCRIPTION)}</p>
  </div>
</section>`;

  const categoryLinks = BLOG_CATEGORIES.map((cat) => {
    const cs = BLOG_CATEGORY_STYLE[cat.name] ?? "background:#f3f4f6;color:#374151";
    return `<a href="/blog/categoria/${esc(cat.slug)}/" class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors" style="${cs}">${esc(cat.name)}</a>`;
  }).join("\n      ");

  const categoryStrip = `<section class="border-b border-gray-100 bg-white py-4">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <div class="flex flex-wrap gap-2 items-center">
      <span class="text-xs font-semibold uppercase tracking-wider mr-1" style="color:#9ca3af">Categorie:</span>
      ${categoryLinks}
    </div>
  </div>
</section>`;

  const cards = BLOG_ARTICLES.map((a) => {
    const catStyle = BLOG_CATEGORY_STYLE[a.category] ?? "background:#f3f4f6;color:#374151";
    const dateStr = new Date(a.publishedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    return `<a href="/blog/${esc(a.slug)}/" class="group flex flex-col bg-white rounded-2xl border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all duration-200 overflow-hidden">
      <div class="p-6 flex flex-col flex-1">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full" style="${catStyle}">${esc(a.category)}</span>
          <span class="text-xs text-gray-400">${a.readingTimeMin} min</span>
        </div>
        <h2 class="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-violet-700 transition-colors flex-1">${esc(a.title)}</h2>
        <p class="text-xs text-gray-500 leading-relaxed mb-4">${esc(a.metaDescription.slice(0, 130))}...</p>
        <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
          <time class="text-xs text-gray-400" datetime="${a.publishedAt}">${dateStr}</time>
          <span class="text-xs font-semibold text-violet-600">Leggi →</span>
        </div>
      </div>
    </a>`;
  }).join("\n    ");

  const grid = `<section class="py-14">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      ${cards}
    </div>
  </div>
</section>`;

  const cta = `<section class="py-16 bg-gray-50 border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">
      Pronto a creare preventivi in <span class="gradient-text">30 secondi</span>?
    </h2>
    <p class="text-gray-500 mb-8 text-sm">Nessuna carta di credito. Nessun impegno. Il tuo primo preventivo è gratis.</p>
    <a href="/sign-up" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
      Inizia Gratuitamente
    </a>
  </div>
</section>`;

  return `<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  ${hero}
  ${categoryStrip}
  ${grid}
  ${cta}
</div>`;
}

// ─── Blog article page body HTML ──────────────────────────────────────────────

function buildBlogArticleBodyHtml(article: BlogArticle): string {
  const breadcrumb = `<nav aria-label="Percorso di navigazione" class="bg-white border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
    <ol class="flex items-center text-sm text-gray-500 flex-wrap">
      <li><a href="/" class="hover:text-violet-600 transition-colors">Home</a></li>
      <li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>
      <li><a href="/blog" class="hover:text-violet-600 transition-colors">Blog</a></li>
      <li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>
      <li class="text-gray-900 font-medium truncate max-w-[200px]" aria-current="page">${esc(article.title)}</li>
    </ol>
  </div>
</nav>`;

  const catStyle = BLOG_CATEGORY_STYLE[article.category] ?? "background:#f3f4f6;color:#374151";
  const dateStr = new Date(article.publishedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  const header = `<header style="background:linear-gradient(135deg,rgba(124,58,237,0.04),rgba(6,182,212,0.04))" class="pt-14 pb-10 border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="flex items-center gap-3 mb-5">
      <span class="text-xs font-semibold px-2.5 py-1 rounded-full" style="${catStyle}">${esc(article.category)}</span>
      <span class="text-xs text-gray-400">${article.readingTimeMin} min di lettura</span>
      <time class="text-xs text-gray-400" datetime="${article.publishedAt}">${dateStr}</time>
    </div>
    <h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl leading-tight mb-4">${esc(article.title)}</h1>
    <p class="text-base text-gray-500 leading-relaxed">${esc(article.metaDescription)}</p>
  </div>
</header>`;

  const toc = extractToc(article.contentHtml);
  const bodyHtml = injectHeadingIds(article.contentHtml);

  const tocHtml = toc.length >= 2
    ? `<nav aria-label="Sommario" class="mb-10 rounded-xl border border-violet-100 px-6 py-5" style="background:rgba(124,58,237,0.04)">
  <p class="text-xs font-bold uppercase tracking-wider mb-3" style="color:#7c3aed">Sommario</p>
  <ol class="space-y-1.5">
    ${toc.map((item) => `<li${item.level === 3 ? ' class="pl-4"' : ""}>
      <a href="#${item.id}" class="text-sm text-gray-700 hover:text-violet-700 transition-colors leading-snug">${item.level === 3 ? '<span class="mr-1 text-gray-400">–</span>' : ""}${esc(item.text)}</a>
    </li>`).join("\n    ")}
  </ol>
</nav>`
    : "";

  const body = `<div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl py-10">
  ${tocHtml}
  <div class="prose prose-gray prose-headings:font-bold prose-h2:text-xl prose-h3:text-base prose-p:leading-relaxed prose-li:leading-relaxed prose-a:text-violet-600 max-w-none">
    ${bodyHtml}
  </div>
</div>`;

  const relatedSectorLinks = article.relatedSectors.map((sectorSlug) => {
    const sector = SECTORS[sectorSlug];
    if (!sector) return "";
    return `<a href="/seo/${esc(sectorSlug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:border-violet-300 hover:text-violet-700 transition-colors">
      <span class="text-violet-400 font-bold">→</span> Preventivi ${esc(sector.label)}
    </a>`;
  }).filter(Boolean).join("\n    ");

  const relatedSectorsSection = relatedSectorLinks ? `<section class="border-t border-gray-100 bg-gray-50 py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Preventivi per settore</h2>
    <div class="flex flex-wrap gap-3">
      ${relatedSectorLinks}
    </div>
  </div>
</section>` : "";

  const relatedArticles = BLOG_ARTICLES.filter(
    (a) => a.slug !== article.slug &&
      (a.relatedSectors.some((s) => article.relatedSectors.includes(s)) ||
        a.category === article.category)
  ).slice(0, 3);

  const relatedCards = relatedArticles.map((a) => {
    const cs = BLOG_CATEGORY_STYLE[a.category] ?? "background:#f3f4f6;color:#374151";
    return `<a href="/blog/${esc(a.slug)}/" class="group flex flex-col bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all p-4">
      <span class="text-xs font-semibold px-2 py-0.5 rounded-full self-start mb-2" style="${cs}">${esc(a.category)}</span>
      <span class="text-xs font-semibold text-gray-800 group-hover:text-violet-700 transition-colors leading-snug">${esc(a.title)}</span>
    </a>`;
  }).join("\n    ");

  const relatedArticlesSection = relatedCards ? `<section class="py-12 border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-lg font-bold text-gray-900 mb-6">Articoli correlati</h2>
    <div class="grid sm:grid-cols-3 gap-4">
      ${relatedCards}
    </div>
  </div>
</section>` : "";

  const cta = `<section class="py-16 border-t border-violet-100/60" style="background:linear-gradient(135deg,rgba(124,58,237,0.04),rgba(6,182,212,0.04))">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">
      Pronto a creare preventivi in <span class="gradient-text">30 secondi</span>?
    </h2>
    <p class="text-gray-500 mb-8 text-sm">Nessuna carta di credito. Nessun impegno. Il tuo primo preventivo è gratis.</p>
    <a href="/sign-up" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
      Inizia Gratuitamente
      <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
    </a>
  </div>
</section>`;

  return `<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  <article class="flex-1">
    ${header}
    ${body}
    ${relatedSectorsSection}
    ${relatedArticlesSection}
  </article>
  ${cta}
</div>`;
}

// ─── Blog JSON-LD builder for category pages ──────────────────────────────────

function buildBlogCategoryJsonLd(category: BlogCategory): object[] {
  const canonical = `${BASE_URL}/blog/categoria/${category.slug}/`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${category.name} — Blog prevai`,
      description: category.description,
      url: canonical,
      inLanguage: "it",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog/` },
        { "@type": "ListItem", position: 3, name: category.name, item: canonical },
      ],
    },
  ];
}

// ─── Blog category page body HTML ─────────────────────────────────────────────

const BLOG_CATEGORY_COLOR_STYLE: Record<string, string> = {
  Professioni: "background:#f5f3ff;color:#6d28d9",
  Prezzi: "background:#ecfeff;color:#0e7490",
  Consigli: "background:#fffbeb;color:#d97706",
  Tool: "background:#f0fdf4;color:#15803d",
  Innovazione: "background:#eff6ff;color:#1d4ed8",
  Business: "background:#fff1f2;color:#be123c",
};

function buildBlogCategoryBodyHtml(category: BlogCategory): string {
  const articles = getArticlesByCategory(category.name);
  const catStyle = BLOG_CATEGORY_COLOR_STYLE[category.name] ?? "background:#f3f4f6;color:#374151";

  const breadcrumb = `<nav aria-label="Percorso di navigazione" class="bg-white border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
    <ol class="flex items-center text-sm text-gray-500 flex-wrap">
      <li><a href="/" class="hover:text-violet-600 transition-colors">Home</a></li>
      <li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>
      <li><a href="/blog" class="hover:text-violet-600 transition-colors">Blog</a></li>
      <li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>
      <li class="text-gray-900 font-medium" aria-current="page">${esc(category.name)}</li>
    </ol>
  </div>
</nav>`;

  const hero = `<section style="background:linear-gradient(135deg,rgba(124,58,237,0.06),rgba(6,182,212,0.04))" class="pt-14 pb-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
    <span class="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold mb-5" style="${catStyle}">${esc(category.name)}</span>
    <h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl mb-3 leading-tight">
      Articoli su <span class="gradient-text">${esc(category.name)}</span>
    </h1>
    <p class="text-base text-gray-500 leading-relaxed max-w-2xl mx-auto">${esc(category.description)}</p>
    <p class="text-xs text-gray-400 mt-3">${articles.length} ${articles.length === 1 ? "articolo" : "articoli"}</p>
  </div>
</section>`;

  const cards = articles.map((a) => {
    const cs = BLOG_CATEGORY_COLOR_STYLE[a.category] ?? "background:#f3f4f6;color:#374151";
    const dateStr = new Date(a.publishedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    return `<a href="/blog/${esc(a.slug)}/" class="group flex flex-col bg-white rounded-2xl border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all duration-200 overflow-hidden">
      <div class="p-6 flex flex-col flex-1">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full" style="${cs}">${esc(a.category)}</span>
          <span class="text-xs text-gray-400">${a.readingTimeMin} min</span>
        </div>
        <h2 class="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-violet-700 transition-colors flex-1">${esc(a.title)}</h2>
        <p class="text-xs text-gray-500 leading-relaxed mb-4">${esc(a.metaDescription.slice(0, 130))}...</p>
        <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
          <time class="text-xs text-gray-400" datetime="${a.publishedAt}">${dateStr}</time>
          <span class="text-xs font-semibold text-violet-600">Leggi →</span>
        </div>
      </div>
    </a>`;
  }).join("\n    ");

  const grid = articles.length > 0
    ? `<section class="py-12">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      ${cards}
    </div>
  </div>
</section>`
    : `<section class="py-20 text-center text-gray-400">
  <p class="text-lg font-medium">Nessun articolo in questa categoria.</p>
  <a href="/blog" class="mt-6 inline-block text-violet-600 text-sm font-semibold">Torna al Blog →</a>
</section>`;

  const otherCats = BLOG_CATEGORIES.filter((c) => c.slug !== category.slug);
  const catLinks = otherCats.map((c) => {
    const cs = BLOG_CATEGORY_COLOR_STYLE[c.name] ?? "background:#f3f4f6;color:#374151";
    return `<a href="/blog/categoria/${esc(c.slug)}/" class="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold transition-colors" style="${cs}">${esc(c.name)}</a>`;
  }).join("\n      ");

  const otherCatsSection = `<section class="py-10 bg-gray-50 border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">Altre categorie</h2>
    <div class="flex flex-wrap gap-3">
      ${catLinks}
    </div>
  </div>
</section>`;

  const cta = `<section class="py-16 bg-white border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">
      Pronto a creare preventivi in <span class="gradient-text">30 secondi</span>?
    </h2>
    <p class="text-gray-500 mb-8 text-sm">Nessuna carta di credito. Nessun impegno. Il tuo primo preventivo è gratis.</p>
    <a href="/sign-up" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
      Inizia Gratuitamente
    </a>
  </div>
</section>`;

  return `<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  ${hero}
  ${grid}
  ${otherCatsSection}
  ${cta}
</div>`;
}

// ─── Blog prerendering ────────────────────────────────────────────────────────

// Blog list page
const blogListHeadBlock = buildHeadBlock({
  title: BLOG_LIST_TITLE,
  description: BLOG_LIST_DESCRIPTION,
  canonical: `${BASE_URL}/blog/`,
  ogImagePath: "/opengraph.jpg",
  jsonLd: buildBlogListJsonLd(),
});
const blogListHtml = injectBody(injectHead(template, blogListHeadBlock), buildBlogListBodyHtml());
writeRoute("blog", blogListHtml);
count++;
console.log("  ✓ Blog list page prerendered");

// Blog category pages
for (const category of BLOG_CATEGORIES) {
  const categoryCanonical = `${BASE_URL}/blog/categoria/${category.slug}`;
  const categoryHeadBlock = buildHeadBlock({
    title: `${category.name} — Blog prevai`,
    description: category.description,
    canonical: categoryCanonical,
    ogImagePath: "/opengraph.jpg",
    jsonLd: buildBlogCategoryJsonLd(category),
  });
  const categoryHtml = injectBody(injectHead(template, categoryHeadBlock), buildBlogCategoryBodyHtml(category));
  writeRoute(`blog/categoria/${category.slug}`, categoryHtml);
  count++;
}
console.log(`  ✓ ${BLOG_CATEGORIES.length} blog category pages prerendered`);

// Individual blog articles
for (const article of BLOG_ARTICLES) {
  const articleCanonical = `${BASE_URL}/blog/${article.slug}/`;
  const articleOgImage = `/og/blog/${article.slug}.png`;
  const articleHeadBlock = buildHeadBlock({
    title: `${article.title} | prevai Blog`,
    description: article.metaDescription,
    canonical: articleCanonical,
    ogImagePath: articleOgImage,
    jsonLd: buildArticleJsonLd(article),
  });
  const articleHtml = injectBody(injectHead(template, articleHeadBlock), buildBlogArticleBodyHtml(article));
  writeRoute(`blog/${article.slug}`, articleHtml);
  count++;
}
console.log(`  ✓ ${BLOG_ARTICLES.length} blog articles prerendered`);

console.log(`Prerendered ${count} pages total (1 homepage + SEO sector pages + ${BLOG_CATEGORIES.length} category pages + ${BLOG_ARTICLES.length + 1} blog pages).`);
