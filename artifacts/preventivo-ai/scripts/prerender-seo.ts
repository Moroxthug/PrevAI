import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SECTORS,
  ACTIVE_CITIES,
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
  getSameCityOtherSectors,
  buildCityJsonLd as buildCityJsonLdFromEngine,
  getOgImagePath,
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
import { translations } from "../src/i18n/translations.js";
import { HELP_ARTICLES } from "../src/data/help-articles.js";
import {
  FAQ_LANDING_AMMINISTRAZIONE,
  LANDING_AMMINISTRAZIONE_PATH,
  LANDING_AMMINISTRAZIONE_SEO,
  NOME_OFFERTA,
  landingAmministrazioneIndicizzabile,
} from "../src/data/amministrazione-landing.js";

function testimonialText(key: string): string {
  return translations.it[`testimonials.${key}.text`] ?? "";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist/public");
const templatePath = join(distDir, "index.html");

if (!existsSync(templatePath)) {
  console.error("dist/public/index.html not found — run vite build first");
  process.exit(1);
}

const BASE_URL = "https://prevai.it";


// ─── Core utilities ────────────────────────────────────────────────────────

const ogImage = getOgImagePath; // one map for the engine, the OG generator and this script

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
  /** V2-2: sito monolingua; conservato per compatibilità dei call site. */
  lang?: "it";
  altUrl?: string;
}): string {
  const { title, description, canonical, ogImagePath, jsonLd } = opts;
  const ogImageUrl = ogImagePath.startsWith("http")
    ? ogImagePath
    : `${BASE_URL}${ogImagePath}`;
  const hreflangLines = [
    `  <link rel="alternate" hreflang="it-IT" href="${esc(canonical)}" />`,
    `  <link rel="alternate" hreflang="x-default" href="${esc(canonical)}" />`,
  ];
  const lines = [
    `  <title>${esc(title)}</title>`,
    `  <meta name="description" content="${esc(description)}" />`,
    `  <link rel="canonical" href="${esc(canonical)}" />`,
    ...hreflangLines,
    `  <meta property="og:title" content="${esc(title)}" />`,
    `  <meta property="og:description" content="${esc(description)}" />`,
    `  <meta property="og:url" content="${esc(canonical)}" />`,
    `  <meta property="og:image" content="${esc(ogImageUrl)}" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:type" content="website" />`,
    `  <meta property="og:locale" content="it_IT" />`,
    `  <meta property="og:site_name" content="PrevAI" />`,
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
 * Since Phase 61 the Vite config no longer emits a "dashboard" manual chunk
 * (the entry no longer statically reaches it), so this is a no-op guard kept
 * in case a manual chunk is reintroduced.
 */
function pruneModulepreload(html: string): string {
  return html.replace(
    /<link\s+rel="modulepreload"\s+crossorigin\s+href="\/assets\/(dashboard|charts)-[^"]*\.js"[^>]*>/gi,
    ""
  );
}

function injectHead(template: string, headBlock: string, _lang: string = "it"): string {
  let html = template;
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${"it-IT"}"`);
  html = html.replace(/<title>[^<]*<\/title>/, "");
  html = html.replace(/<meta\s+name="description"[^>]*\/?>/i, "");
  html = html.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*\/?>/gi, "");
  html = html.replace(/<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="keywords"[^>]*\/?>/gi, "");
  html = html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
  // After <meta charset> + viewport: the charset declaration must stay within
  // the first 1024 bytes of the document, and a <title> with an en dash was
  // landing in front of it (Phase 68).
  const viewport = /<meta\s+name="viewport"[^>]*>/i.exec(html);
  html = viewport
    ? html.slice(0, viewport.index + viewport[0].length) + `\n${headBlock}` + html.slice(viewport.index + viewport[0].length)
    : html.replace("<head>", `<head>\n${headBlock}`);
  return html;
}

function injectBody(html: string, bodyHtml: string): string {
  if (!bodyHtml) return html;
  return html.replace(/<div id="root"><\/div>/, `<div id="root">${bodyHtml}</div>`);
}

// main.tsx imports the App on demand (static SEO pages never load it). The
// build-time-rendered pages hydrate with it, so they preload the chunk — and
// the chunks it statically pulls in — to avoid a second round trip before
// hydration. The names carry content hashes, so they are read off dist/.
const APP_PRELOADS: string[] = (() => {
  const assets = join(distDir, "assets");
  const app = readdirSync(assets).find((f) => /^App-[\w-]+\.js$/.test(f));
  if (!app) return [];
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(join(assets, file), "utf8");
    for (const m of src.matchAll(/(?:^|[^.\w])import\s*["']\.\/([\w-]+\.js)["']|from\s*["']\.\/([\w-]+\.js)["']/g)) walk((m[1] ?? m[2])!);
  };
  walk(app);
  return [...seen];
})();
function injectAppPreload(html: string): string {
  const links = APP_PRELOADS.map((f) => `<link rel="modulepreload" crossorigin href="/assets/${f}">`).join("\n    ");
  return links ? html.replace("</head>", `    ${links}\n  </head>`) : html;
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
      <a href="/sign-in/" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full">Accedi</a>
      <a href="/sign-up/" class="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold">Registrati</a>
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
          <li><a href="/preventivi/imbianchino/" class="hover:text-foreground transition-colors">Imbianchino</a></li>
          <li><a href="/preventivi/muratore/" class="hover:text-foreground transition-colors">Muratore</a></li>
          <li><a href="/preventivi/elettricista/" class="hover:text-foreground transition-colors">Elettricista</a></li>
          <li><a href="/preventivi/pittore/" class="hover:text-foreground transition-colors">Pittore</a></li>
          <li><a href="/preventivi/idraulico/" class="hover:text-foreground transition-colors">Idraulico</a></li>
          <li><a href="/preventivi/piastrellista/" class="hover:text-foreground transition-colors">Piastrellista</a></li>
          <li><a href="/preventivi/edilizia/" class="hover:text-foreground transition-colors">Imprese Edili</a></li>
          <li><a href="/preventivi/giardiniere/" class="hover:text-foreground transition-colors">Giardiniere</a></li>
          <li><a href="/preventivi/ristrutturazione/" class="hover:text-foreground transition-colors">Ristrutturazioni</a></li>
          <li><a href="/preventivi/serramentista/" class="hover:text-foreground transition-colors">Serramentista</a></li>
          <li><a href="/preventivi/carpentiere/" class="hover:text-foreground transition-colors">Carpentieri</a></li>
          <li><a href="/preventivi/tetto/" class="hover:text-foreground transition-colors">Coperture e Tetti</a></li>
          <li><a href="/preventivi/falegname/" class="hover:text-foreground transition-colors">Falegnami</a></li>
          <li><a href="/preventivi/condizionatori/" class="hover:text-foreground transition-colors">Condizionatori</a></li>
          <li><a href="/preventivi/freelance/" class="hover:text-foreground transition-colors">Freelance</a></li>
          <li><a href="/preventivi/pavimentista/" class="hover:text-foreground transition-colors">Pavimentista</a></li>
          <li><a href="/preventivi/geometra/" class="hover:text-foreground transition-colors">Geometri</a></li>
          <li><a href="/preventivi/termoidraulico/" class="hover:text-foreground transition-colors">Termoidraulico</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Guide</h4>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/blog/" class="hover:text-foreground transition-colors font-medium text-foreground/80">Blog &amp; Approfondimenti</a></li>
          <li><a href="/preventivi/modello-excel/" class="hover:text-foreground transition-colors">Modello Excel</a></li>
          <li><a href="/preventivi/modello-word/" class="hover:text-foreground transition-colors">Modello Word</a></li>
          <li><a href="/preventivi/come-fare-preventivo/" class="hover:text-foreground transition-colors">Come Fare un Preventivo</a></li>
          <li><a href="/preventivi/preventivi-gratis/" class="hover:text-foreground transition-colors">Preventivi Gratis</a></li>
        </ul>
        <h4 class="font-semibold mt-8 mb-4 text-sm uppercase tracking-wider text-foreground">Azienda</h4>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/chi-siamo/" class="hover:text-foreground transition-colors">Chi Siamo</a></li>
          <li><a href="/contatti/" class="hover:text-foreground transition-colors">Contatti</a></li>
          <li><button class="hover:text-foreground transition-colors text-left">Supporto</button></li>
          <li><a href="/privacy/" class="hover:text-foreground transition-colors">Privacy Policy</a></li>
          <li><a href="/termini/" class="hover:text-foreground transition-colors">Termini di Servizio</a></li>
          <li><a href="/mappa-sito/" class="hover:text-foreground transition-colors">Mappa del Sito</a></li>
        </ul>
      </div>
    </div>
    <div class="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">© ${CURRENT_YEAR} prevai. Tutti i diritti riservati.</div>
  </div>
</footer>`;

const STATIC_WHATSAPP = `<a href="/whatsapp/" aria-label="Chatta con noi su WhatsApp" class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full shadow-lg shadow-green-200/60 transition-all duration-200 hover:scale-105 active:scale-95" style="background:rgb(37,211,102)"><span class="flex h-14 w-14 items-center justify-center rounded-full" style="background:rgb(37,211,102)"><img src="/wa-icon.svg" alt="" width="28" height="28" loading="lazy" decoding="async"></span><span class="pr-5 text-white text-sm font-semibold whitespace-nowrap hidden sm:inline-block">Hai bisogno di aiuto?</span></a>`;

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
  for (const city of ACTIVE_CITIES) {
    const arr = byRegion.get(city.region) ?? [];
    arr.push(city);
    byRegion.set(city.region, arr);
  }
  const regionBlocks = Array.from(byRegion.entries())
    .map(([region, cities]) => {
      const cityLinks = cities
        .map(
          (c) =>
            `<a href="/preventivi/${esc(s.slug)}/${esc(c.slug)}/" class="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(c.name)}</a>`
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
        `<a href="/preventivi/${esc(r.slug)}/" class="flex items-center gap-2 bg-white border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors">
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
      <a href="/blog/" class="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors">Tutti gli articoli →</a>
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
  const canonical = `${BASE_URL}/preventivi/${s.slug}/`;
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
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "127",
        bestRating: "5",
        worstRating: "1",
      },
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
        <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
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
      <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        ${ctaBtn}
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
  </section>`;

  const sRelated = buildRelatedSectorsSection(s, "Servizi correlati — genera preventivi per");
  const sCityGrid = CITY_SECTORS.includes(s.slug) ? buildSectorCityGrid(s) : "";
  const sApprofondimenti = buildApprofondimentiSection(s.slug);
  const sDeepDive = buildSectorDeepDive(s);

  const middleSections =
    layout === 0
      ? [sBenefits, sHowItWorks, sUseCases, sItalianMarket, sDeepDive, sFaq]
      : [sHowItWorks, sUseCases, sBenefits, sFaq, sItalianMarket, sDeepDive];

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

// ─── Sector long-form text section — boosts text/HTML ratio ────────────────
function buildSectorDeepDive(s: SectorData): string {
  const labelL = s.label.toLowerCase();
  const labelPL = s.labelPlural;
  const useCasesText = s.useCases.slice(0, 6).map((u) => u.toLowerCase()).join(", ");
  const benefitsP = s.benefits
    .map((b) => `<strong>${esc(b.title)}.</strong> ${esc(b.desc)}`)
    .join(" ");
  return `<section class="py-20 bg-white" aria-label="Approfondimento ${esc(labelL)}">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">Tutto quello che serve a un ${esc(labelL)} moderno</h2>
      </div>
      <div class="prose prose-lg max-w-none text-gray-600 leading-relaxed space-y-6">
        <p>Per un <strong>${esc(labelL)}</strong> in Italia, fare un preventivo professionale è spesso un secondo lavoro: ore sottratte al cantiere, ricerche di prezzi su listini cartacei, calcoli ripetitivi su fogli Excel costruiti negli anni. Il risultato è quasi sempre un documento approssimativo, fuori formato, che fa perdere clienti rispetto a un concorrente con un&apos;offerta più chiara e leggibile. <strong>prevai</strong> nasce proprio per chiudere questa distanza: descrivi il lavoro in italiano, in una manciata di frasi, e in trenta secondi hai un preventivo completo, professionale, pronto da inviare via WhatsApp o email.</p>
        <p>Il software è pensato per il modo concreto in cui lavorano i <strong>${esc(labelPL)}</strong> italiani. La maggior parte dei preventivi nasce in cantiere o al telefono con il cliente, raramente in ufficio. Per questo prevai funziona perfettamente da smartphone: niente installazioni, niente sincronizzazioni complicate, solo un browser. Apri la pagina, descrivi il lavoro mentre lo stai ancora ispezionando, e quando torni in macchina hai già un PDF da consegnare. La differenza tra inviare un preventivo entro un&apos;ora dal sopralluogo e farlo arrivare due giorni dopo è la differenza tra ottenere il lavoro o vederlo andare a un altro.</p>
        <p>Tra i casi d&apos;uso più frequenti gestiti dai nostri utenti ci sono ${esc(useCasesText)}. Per ognuno di questi scenari, l&apos;intelligenza artificiale di prevai conosce le voci tipiche, le unità di misura ricorrenti — metri quadri, metri lineari, ore di manodopera, corpo — e i prezzi medi praticati sul mercato italiano. Tu puoi sempre modificare le voci, sostituire i prezzi con i tuoi listini personali, aggiungere o togliere capitoli, ma il punto di partenza non è mai un foglio bianco: è un preventivo già strutturato che ti fa risparmiare il 90% del tempo.</p>
        <h3 class="text-xl font-semibold text-gray-900 mt-10 mb-3">I vantaggi concreti per chi lavora ogni giorno</h3>
        <p>${benefitsP}</p>
        <h3 class="text-xl font-semibold text-gray-900 mt-10 mb-3">Pensato per la fiscalità italiana</h3>
        <p>A differenza dei software internazionali, prevai è progettato attorno alle regole concrete che un <strong>${esc(labelL)}</strong> italiano incontra ogni giorno. L&apos;IVA al 10% per le ristrutturazioni residenziali, l&apos;IVA al 22% per i nuovi impianti, il regime forfettario senza IVA: tutto è gestito automaticamente in base alla tipologia di intervento e al regime fiscale del professionista. I dati aziendali (partita IVA, codice fiscale, codice destinatario per la fatturazione elettronica) vengono memorizzati una volta e applicati ad ogni preventivo, e ogni documento rispetta il formato che i clienti italiani — privati, condomini, piccole imprese — si aspettano di ricevere.</p>
        <h3 class="text-xl font-semibold text-gray-900 mt-10 mb-3">Da preventivo a lavoro acquisito</h3>
        <p>Un preventivo ben fatto non è solo un documento contabile: è uno strumento di vendita. La cura grafica, la chiarezza delle voci, la presenza del logo aziendale e dei dati di contatto raccontano al cliente che ha davanti un professionista serio. Tutti i preventivi generati con prevai includono intestazione personalizzata, suddivisione per capitoli di lavoro, descrizione tecnica per ogni voce, prezzi unitari e subtotali, indicazione dell&apos;IVA e del totale finale, condizioni di pagamento e validità. Il cliente riceve un PDF ordinato, su una pagina sola quando possibile, che può confrontare con quello degli altri ${esc(labelPL)} consultati — e nella maggior parte dei casi la scelta cade su chi ha presentato l&apos;offerta più professionale, anche a parità di prezzo.</p>
        <p>Iniziare è gratuito: non servono carte di credito né configurazioni complesse. Crei un account in trenta secondi, generi il tuo primo preventivo gratis e decidi solo dopo se attivare uno dei piani in abbonamento (per chi fa preventivi tutti i giorni) o se pagare un preventivo singolo all&apos;occorrenza. Migliaia di <strong>${esc(labelPL)}</strong>, artigiani e piccole imprese italiane usano già prevai ogni settimana. Provalo e scopri perché non si torna più indietro al vecchio modello Excel.</p>
      </div>
    </div>
  </section>`;
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
    { name: s.label, href: `/preventivi/${s.slug}/` },
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
        <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Crea il tuo preventivo gratis
        </a>
        <a href="/preventivi/${esc(s.slug)}/" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
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
      `<a href="/preventivi/${esc(s.slug)}/${esc(slug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(anchorText)}</a>`
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

  const sQuantoCosta = buildQuantoCostaBlock(s, city, intel);
  const sContext = buildCityContextBlock(city, s);
  const sameCityOtherSectors = getSameCityOtherSectors(s.slug, city.slug);
  const sSameCityOther = sameCityOtherSectors.length
    ? `<section class="py-14 bg-gray-50 border-t border-gray-100">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">Altri servizi a ${esc(cityName)}</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${sameCityOtherSectors
          .map(
            (r) =>
              `<a href="/preventivi/${esc(r.slug)}/${esc(city.slug)}/" class="flex items-center gap-2 bg-white border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors">
          <span class="text-violet-400 font-bold" aria-hidden="true">→</span> ${esc(r.label)} a ${esc(cityName)}
        </a>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";
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
      <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
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
  ${sQuantoCosta}
  ${sContext}
  ${sNearby}
  ${sSameCityOther}
  ${sRelated}
  ${sApprofondimenti}
  ${sCta}
</div>`;
}

// ─── "Quanto costa" block: extra unique text for city pages (improves text/HTML ratio) ────

function buildQuantoCostaBlock(
  s: SectorData,
  city: CityData,
  intel: CityIntelligence | undefined,
): string {
  const cityName = city.name;
  const regionName = city.region;
  const sectorLabel = s.label.toLowerCase();
  const pricePct = intel ? Math.round((intel.priceIndex - 1.0) * 100) : 0;
  const priceNote = !intel
    ? `in linea con la media italiana`
    : pricePct > 5
      ? `mediamente del <strong>${pricePct}% più alti</strong> rispetto alla media nazionale`
      : pricePct < -5
        ? `mediamente del <strong>${Math.abs(pricePct)}% più bassi</strong> rispetto alla media nazionale`
        : `in linea con la media nazionale (variazione contenuta entro il ±5%)`;

  const demandText = intel ? DEMAND_TEXT[intel.demandLevel] : "stabile";

  const examples = s.useCases.slice(0, 4).map((uc, i) => {
    const base = 250 + i * 320 + (strHash(city.slug + s.slug + String(i)) % 180);
    const factor = intel ? intel.priceIndex : 1.0;
    const low = Math.round((base * factor) / 10) * 10;
    const high = Math.round((base * factor * 1.7) / 10) * 10;
    return { label: uc, range: `da ${low}€ a ${high}€` };
  });

  const examplesList = examples
    .map(
      (e) =>
        `<li class="flex items-start justify-between gap-4 bg-white rounded-xl px-5 py-3.5 border border-gray-100">
          <span class="text-sm text-gray-700 leading-snug">${esc(e.label)}</span>
          <span class="text-sm font-semibold text-violet-700 whitespace-nowrap">${esc(e.range)}</span>
        </li>`,
    )
    .join("\n        ");

  const paragraph1 = `A ${esc(cityName)} il costo medio per un servizio di ${esc(sectorLabel)} è ${priceNote}. La domanda nel ${esc(regionName)} è attualmente ${esc(demandText)}, condizione che influisce sui tempi di risposta dei professionisti e sulla negoziazione del prezzo finale. I prezzi indicati qui sotto sono intervalli di mercato medi raccolti da preventivi reali generati con prevai per lavori nella zona di ${esc(cityName)} e nelle località limitrofe.`;
  const paragraph2 = `Ogni preventivo dipende da fattori specifici: superficie esatta dell'intervento, qualità dei materiali richiesti, accessibilità del cantiere, urgenza dell'esecuzione e personalizzazioni concordate con il committente. Per questo ti consigliamo di richiedere sempre un sopralluogo o di fornire una descrizione dettagliata: con prevai puoi farlo in 30 secondi descrivendo il lavoro in linguaggio naturale e ricevere un documento professionale, modificabile e pronto da inviare al cliente via WhatsApp o email.`;

  return `<section class="py-20 bg-white border-t border-gray-100" aria-label="Quanto costa ${esc(sectorLabel)} a ${esc(cityName)}">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="text-center mb-10">
      <h2 class="text-2xl font-bold text-gray-900">Quanto costa un ${esc(sectorLabel)} a ${esc(cityName)}</h2>
      <p class="text-sm text-gray-400 mt-2">Range di prezzo orientativi per i lavori più richiesti</p>
    </div>
    <div class="space-y-4 text-gray-600 leading-relaxed text-base mb-8">
      <p>${paragraph1}</p>
      <p>${paragraph2}</p>
    </div>
    <ul class="space-y-2.5">
      ${examplesList}
    </ul>
    <p class="text-xs text-gray-400 mt-6 text-center">Prezzi medi di mercato a ${esc(cityName)} aggiornati al ${CURRENT_YEAR}. IVA esclusa. Variazioni possibili in base alle caratteristiche specifiche del lavoro.</p>
  </div>
</section>`;
}

// The homepage (dist/index.html, dist/fr/index.html) gets its SEO <head> only.
// It used to also get a hand-written static copy of the hero (buildHomepageBodyHtml),
// which drifted from the real React homepage after the pixel redesign and was served
// as a stale flash on every cold load of "/" AND of every /dashboard/* route (index.html
// is the SPA fallback) until the bundle replaced it. The real page is client-rendered;
// crawlers execute JS. Do not reintroduce a static body here unless it is generated
// from the React tree (renderToString + hydrateRoot), never hand-copied.


// ─── Main execution ─────────────────────────────────────────────────────────

const template = pruneModulepreload(readFileSync(templatePath, "utf-8"));

// Phase 68: "/", "/fr" and the six static pages (about, contact, privacy,
// terms, WhatsApp, sitemap) are rendered by the real React tree — built with
// `vite build --ssr src/entry-server.tsx --outDir dist/server`, see the
// `build` script — and hydrated by main.tsx, so the hero paints from HTML and
// crawlers see the same DOM users get (the hand-written bodies this replaced
// had drifted to the pre-redesign layout). React 19 hoists <title>/<meta>/
// <link> to the front of the string; the head is authored by buildHeadBlock()
// here, so those are stripped.
const ssrEntry = join(__dirname, "../dist/server/entry-server.js");
if (!existsSync(ssrEntry)) {
  console.error("dist/server/entry-server.js not found — run `vite build --ssr src/entry-server.tsx --outDir dist/server` first");
  process.exit(1);
}
const { renderPage } = (await import(pathToFileURL(ssrEntry).href)) as { renderPage: (path: string, lang: "it") => Promise<string> };
function stripHoistedHead(html: string): string {
  return html.replace(/^(?:\s*(?:<(?:link|meta)\b[^>]*\/?>|<title>[^<]*<\/title>))+/, "");
}
let count = 0;

console.log("Prerendering SEO pages...");

// Phase 1: Prerender homepage
const homepageWebSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PrevAI",
  url: BASE_URL,
  description: "Software AI per preventivi professionali in 30 secondi. Pensato per artigiani, imprese e liberi professionisti italiani.",
  inLanguage: "it",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/preventivi/{search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};
const homepageSoftwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PrevAI",
  description: "Software di preventivazione con AI per artigiani, piccole imprese e liberi professionisti italiani.",
  url: `${BASE_URL}/`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Prova gratuita disponibile" },
  audience: { "@type": "BusinessAudience", audienceType: "Artigiani, piccole imprese, imprese edili, liberi professionisti" },
  inLanguage: "it",
  provider: { "@type": "Organization", name: "PrevAI", url: BASE_URL },
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
    reviewRating: { "@type": "Rating", ratingValue: String(t.rating), bestRating: "5", worstRating: "1" },
    reviewBody: testimonialText(t.key),
  })),
};
const homepageHeadBlock = buildHeadBlock({
  title: "prevai – Preventivi Online per Artigiani e Aziende | AI in 30s",
  description: "Dimentica Excel e i documenti scritti a mano. Descrivi il lavoro a parole tue e prevai genera un preventivo professionale con IVA, voci di costo e totali in 30 secondi. Prova gratis.",
  canonical: `${BASE_URL}/`,
  ogImagePath: "/opengraph.jpg",
  jsonLd: [homepageWebSiteSchema, homepageSoftwareSchema],
});
const homepageHtml = injectAppPreload(injectBody(injectHead(template, homepageHeadBlock), stripHoistedHead(await renderPage("/", "it"))));
writeFileSync(templatePath, homepageHtml, "utf-8");
count++;
console.log("  ✓ Homepage prerendered");

// French homepage
// V2-2: nessuna homepage /fr (sito monolingua).

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

  const canonical = `${BASE_URL}/preventivi/${sectorSlug}/`;
  const jsonLd = buildSectorJsonLd(sector);
  const ogImagePath = ogImage(sectorSlug);

  const headBlock = buildHeadBlock({ title, description, canonical, ogImagePath, jsonLd });
  const bodyHtml = buildSectorBodyHtml(sector);
  const html = injectBody(injectHead(template, headBlock), bodyHtml);
  writeRoute(`preventivi/${sectorSlug}`, html);
  count++;


  if (!CITY_SECTORS.includes(sectorSlug)) continue;

  for (const city of ACTIVE_CITIES) {
    const cityCanonical = `${BASE_URL}/preventivi/${sectorSlug}/${city.slug}/`;
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
    // Phase 68: the 210 city pages and the 23 blog pages were written without the site header/footer — in production they showed only the (Italian) nav shell and no footer.
    const cityBodyHtml = wrapInPublicLayout(buildCityBodyHtml(sector, city));
    const cityHtml = injectBody(injectHead(template, cityHeadBlock), cityBodyHtml);
    writeRoute(`preventivi/${sectorSlug}/${city.slug}`, cityHtml);
    count++;

  }
}
console.log("  ✓ Sector + city pages prerendered");

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

function buildArticleJsonLd(article: BlogArticle, imagePath: string): object[] {
  const canonical = `${BASE_URL}/blog/${article.slug}/`;
  const imageUrl = imagePath.startsWith("http") ? imagePath : `${BASE_URL}${imagePath}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.metaDescription,
      image: [imageUrl],
      url: canonical,
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
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
    <a href="/sign-up/" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
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
      <li><a href="/blog/" class="hover:text-violet-600 transition-colors">Blog</a></li>
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
    return `<a href="/preventivi/${esc(sectorSlug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:border-violet-300 hover:text-violet-700 transition-colors">
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

  const geoSectorSlug = article.relatedSectors.find((slug) => CITY_SECTORS.includes(slug));
  const geoSector = geoSectorSlug ? SECTORS[geoSectorSlug] : undefined;
  const citySection = geoSector ? `<section class="border-t border-gray-100 bg-white py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Preventivi ${esc(geoSector.labelPlural)} nella tua città</h2>
    <div class="flex flex-wrap gap-3">
      ${ACTIVE_CITIES
        .map(
          (city) =>
            `<a href="/preventivi/${esc(geoSector.slug)}/${esc(city.slug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:border-violet-300 hover:text-violet-700 transition-colors">
        <span class="text-violet-400 font-bold">→</span> ${esc(city.name)}
      </a>`
        )
        .join("\n      ")}
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
    <a href="/sign-up/" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
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
    ${citySection}
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
      <li><a href="/blog/" class="hover:text-violet-600 transition-colors">Blog</a></li>
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
  <a href="/blog/" class="mt-6 inline-block text-violet-600 text-sm font-semibold">Torna al Blog →</a>
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
    <a href="/sign-up/" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
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
const blogListHtml = injectBody(injectHead(template, blogListHeadBlock), wrapInPublicLayout(buildBlogListBodyHtml()));
writeRoute("blog", blogListHtml);
count++;
console.log("  ✓ Blog list page prerendered");

// Blog category pages
for (const category of BLOG_CATEGORIES) {
  const categoryCanonical = `${BASE_URL}/blog/categoria/${category.slug}/`;
  const categoryHeadBlock = buildHeadBlock({
    title: `${category.name} — Blog prevai`,
    description: category.description,
    canonical: categoryCanonical,
    ogImagePath: "/opengraph.jpg",
    jsonLd: buildBlogCategoryJsonLd(category),
  });
  const categoryHtml = injectBody(injectHead(template, categoryHeadBlock), wrapInPublicLayout(buildBlogCategoryBodyHtml(category)));
  writeRoute(`blog/categoria/${category.slug}`, categoryHtml);
  count++;
}
console.log(`  ✓ ${BLOG_CATEGORIES.length} blog category pages prerendered`);

// Individual blog articles
for (const article of BLOG_ARTICLES) {
  const articleCanonical = `${BASE_URL}/blog/${article.slug}/`;
  const articleOgImage = `/og/blog/${article.slug}.png`;
  const articleHeadBlock = buildHeadBlock({
    title: `${article.seoTitle ?? article.title} | prevai`,
    description: article.metaDescription,
    canonical: articleCanonical,
    ogImagePath: articleOgImage,
    jsonLd: buildArticleJsonLd(article, articleOgImage),
  });
  const articleHtml = injectBody(injectHead(template, articleHeadBlock), wrapInPublicLayout(buildBlogArticleBodyHtml(article)));
  writeRoute(`blog/${article.slug}`, articleHtml);
  count++;
}
console.log(`  ✓ ${BLOG_ARTICLES.length} blog articles prerendered`);

// ─── Static SPA pages prerender (bodies from entry-server.tsx, see above) ───

function buildBreadcrumbJsonLd(name: string, path: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
      { "@type": "ListItem", position: 2, name, item: `${BASE_URL}${path}` },
    ],
  };
}

function buildWebPageJsonLd(name: string, description: string, path: string, type = "WebPage"): object {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name,
    description,
    url: `${BASE_URL}${path}`,
    inLanguage: "it",
    isPartOf: { "@type": "WebSite", name: "PrevAI", url: BASE_URL },
  };
}

async function buildStaticPageHtml(opts: {
  slug: string;
  title: string;
  description: string;
  path: string;
  jsonLd: object[];
  bodyHtml: string;
  ogImagePath?: string;
  /** A-5: pagine che esistono ma non vanno indicizzate (la landing dell'add-on in bozza). */
  noIndex?: boolean;
}): Promise<void> {
  const headBlock = buildHeadBlock({
    title: opts.title,
    description: opts.description,
    canonical: `${BASE_URL}${opts.path}`,
    ogImagePath: opts.ogImagePath ?? "/opengraph.jpg",
    jsonLd: opts.jsonLd,
  });
  let html = injectAppPreload(injectBody(injectHead(template, headBlock), opts.bodyHtml));
  if (opts.noIndex) {
    // Si sostituisce il meta della shell invece di aggiungerne un secondo:
    // con due meta robots in conflitto non si sa quale legga il crawler (A-4).
    const prima = html;
    html = html.replace('<meta name="robots" content="index, follow" />', '<meta name="robots" content="noindex, nofollow" />');
    if (html === prima) throw new Error(`prerender: meta robots della shell non trovato per ${opts.path}`);
  }
  writeRoute(opts.slug, html);
  count++;
}

// /chi-siamo/
const chiSiamoOrgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PrevAI",
  url: `${BASE_URL}/`,
  logo: `${BASE_URL}/icon-192.png`,
  description: "prevai è il software di preventivazione AI per artigiani e liberi professionisti italiani. Genera preventivi professionali in 30 secondi descrivendo il lavoro in italiano.",
  foundingDate: "2025",
  foundingLocation: { "@type": "Place", name: "Italia" },
  contactPoint: {
    "@type": "ContactPoint",
    email: "info@prevai.it",
    contactType: "customer service",
    availableLanguage: "it",
  },
};
await buildStaticPageHtml({
  slug: "chi-siamo",
  title: translations.it["about.seoTitle"],
  description: translations.it["about.seoDescription"],
  path: "/chi-siamo/",
  jsonLd: [chiSiamoOrgJsonLd, buildBreadcrumbJsonLd("Chi siamo", "/chi-siamo/")],
  bodyHtml: stripHoistedHead(await renderPage("/chi-siamo", "it")),
});

// /contatti/
const contattiJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contatta prevai",
  url: `${BASE_URL}/contatti/`,
  description: "Contatta il team prevai per assistenza, domande sul prodotto o richieste commerciali.",
  mainEntity: {
    "@type": "Organization",
    name: "PrevAI",
    url: `${BASE_URL}/`,
    email: "info@prevai.it",
    contactPoint: [
      { "@type": "ContactPoint", email: "info@prevai.it", contactType: "customer support", availableLanguage: "it" },
      { "@type": "ContactPoint", email: "privacy@prevai.it", contactType: "privacy inquiries", availableLanguage: "it" },
    ],
  },
};
await buildStaticPageHtml({
  slug: "contatti",
  title: translations.it["contact.seoTitle"],
  description: translations.it["contact.seoDescription"],
  path: "/contatti/",
  jsonLd: [contattiJsonLd, buildBreadcrumbJsonLd("Contatti", "/contatti/")],
  bodyHtml: stripHoistedHead(await renderPage("/contatti", "it")),
});

// /privacy/ — rispecchia src/pages/privacy-policy.tsx (la route reale)
const privacyDescription = "Informativa sulla privacy di PrevAI — come raccogliamo, usiamo e proteggiamo i tuoi dati personali.";
await buildStaticPageHtml({
  slug: "privacy",
  title: "Privacy Policy | PrevAI",
  description: privacyDescription,
  path: "/privacy/",
  jsonLd: [buildWebPageJsonLd("Privacy Policy", privacyDescription, "/privacy/"), buildBreadcrumbJsonLd("Privacy Policy", "/privacy/")],
  bodyHtml: stripHoistedHead(await renderPage("/privacy", "it")),
});

// /termini/ — rispecchia src/pages/terms.tsx (la route reale)
const terminiDescription = "Termini e condizioni per l'utilizzo della piattaforma PrevAI per la generazione di preventivi con intelligenza artificiale.";
await buildStaticPageHtml({
  slug: "termini",
  title: "Termini di servizio | PrevAI",
  description: terminiDescription,
  path: "/termini/",
  jsonLd: [buildWebPageJsonLd("Termini di servizio", terminiDescription, "/termini/"), buildBreadcrumbJsonLd("Termini di servizio", "/termini/")],
  bodyHtml: stripHoistedHead(await renderPage("/termini", "it")),
});

// /whatsapp/
await buildStaticPageHtml({
  slug: "whatsapp",
  title: translations.it["whatsapp.seoTitle"],
  description: translations.it["whatsapp.seoDescription"],
  path: "/whatsapp/",
  jsonLd: [buildWebPageJsonLd("Preventivi su WhatsApp", translations.it["whatsapp.seoDescription"], "/whatsapp/"), buildBreadcrumbJsonLd("WhatsApp", "/whatsapp/")],
  bodyHtml: stripHoistedHead(await renderPage("/whatsapp", "it")),
});

// /mappa-sito/
await buildStaticPageHtml({
  slug: "mappa-sito",
  title: translations.it["sitemap.seoTitle"],
  description: translations.it["sitemap.seoDescription"],
  path: "/mappa-sito/",
  jsonLd: [buildWebPageJsonLd("Mappa del sito", translations.it["sitemap.seoDescription"], "/mappa-sito/"), buildBreadcrumbJsonLd("Mappa del sito", "/mappa-sito/")],
  bodyHtml: stripHoistedHead(await renderPage("/mappa-sito", "it")),
});

// /fisco/ — A-5, landing dell'add-on PrevAI Fisco. noindex finché l'offerta è in bozza.
await buildStaticPageHtml({
  slug: "fisco",
  title: LANDING_AMMINISTRAZIONE_SEO.title,
  description: LANDING_AMMINISTRAZIONE_SEO.description,
  path: LANDING_AMMINISTRAZIONE_PATH,
  noIndex: !landingAmministrazioneIndicizzabile(),
  jsonLd: [
    buildWebPageJsonLd(NOME_OFFERTA, LANDING_AMMINISTRAZIONE_SEO.description, LANDING_AMMINISTRAZIONE_PATH),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_LANDING_AMMINISTRAZIONE.map((f) => ({ "@type": "Question", name: f.domanda, acceptedAnswer: { "@type": "Answer", text: f.risposta } })),
    },
    buildBreadcrumbJsonLd(NOME_OFFERTA, LANDING_AMMINISTRAZIONE_PATH),
  ],
  bodyHtml: stripHoistedHead(await renderPage("/fisco", "it")),
});

console.log(`  ✓ 7 SPA pages prerendered (chi-siamo, contatti, privacy, termini, whatsapp, mappa-sito, fisco)`);

// Phase 70: centro assistenza — indice + una pagina per articolo, resi dallo
// stesso albero React (title/description del SeoHead della pagina sono quelli
// ripetuti qui nell'head; tenerli identici così crawler e DOM idratato coincidono).
const helpIndexTitle = translations.it["help.seoTitle"];
const helpIndexDescription = translations.it["help.seoDescription"];
await buildStaticPageHtml({
  slug: "help",
  title: helpIndexTitle,
  description: helpIndexDescription,
  path: "/help/",
  jsonLd: [buildWebPageJsonLd("Centro assistenza", helpIndexDescription, "/help/", "CollectionPage"), buildBreadcrumbJsonLd("Centro assistenza", "/help/")],
  bodyHtml: stripHoistedHead(await renderPage("/help", "it")),
});
for (const article of HELP_ARTICLES) {
  const path = `/help/${article.slug}/`;
  await buildStaticPageHtml({
    slug: `help/${article.slug}`,
    title: `${article.title.it} | prevai`,
    description: article.summary.it,
    path,
    jsonLd: [
      buildWebPageJsonLd(article.title.it, article.summary.it, path, "TechArticle"),
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Centro assistenza", item: `${BASE_URL}/help/` },
          { "@type": "ListItem", position: 3, name: article.title.it, item: `${BASE_URL}${path}` },
        ],
      },
    ],
    bodyHtml: stripHoistedHead(await renderPage(`/help/${article.slug}`, "it")),
  });
}
console.log(`  ✓ ${HELP_ARTICLES.length + 1} help-centre pages prerendered`);

console.log(`Prerendered ${count} pages total (1 homepage + SEO sector pages + ${BLOG_CATEGORIES.length} category pages + ${BLOG_ARTICLES.length + 1} blog pages + 7 SPA pages + ${HELP_ARTICLES.length + 1} help pages).`);
