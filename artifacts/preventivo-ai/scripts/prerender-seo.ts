import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SECTORS,
  ACTIVE_CITIES,
  CITY_SECTORS,
} from "../src/data/seo-data.js";
import type { SectorData } from "../src/data/seo-data.js";
import {
  strHash,
  getOgImagePath,
} from "../src/data/seo-render-engine.js";
import {
  BLOG_ARTICLES,
  BLOG_CATEGORIES,
  BLOG_LIST_TITLE,
  BLOG_LIST_DESCRIPTION,
  getArticlesByCategory,
} from "../src/data/blog-data.js";
import type { BlogArticle, BlogCategory } from "../src/data/blog-data.js";
import { paginaCitta } from "../src/data/citta/pagina.js";
import { extractToc, injectHeadingIds } from "../src/data/blog-toc.js";
import {
  TESTIMONIALS,
  AGGREGATE_RATING,
} from "../src/components/testimonials-section.js";
import { translations } from "../src/i18n/translations.js";
import { HELP_ARTICLES } from "../src/data/help-articles.js";
import { HELP_VIDEOS, toVtt } from "../src/data/help-videos.js";
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
// pages where React renders from scratch — the app shell (app.html) and
// 404.html — preload the chunk and the chunks it statically pulls in, so the
// first render does not wait on a second round trip. The build-time-rendered
// pages do not (PERF-1): they hydrate after the page's load event, and a
// preload in <head> competed with the CSS and the hero (Lighthouse counted
// ~190 kB of JavaScript before the LCP). The names carry content hashes, so
// they are read off dist/.
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

const STATIC_LOGO = `<img src="/prevai-logo-144.png" alt="prevai" width="144" height="72" style="height: 72px; width: auto; object-fit: contain;">`;

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

// ─── Phase 2B: City grid on sector pages ───────────────────────────────────

// ─── Phase 2C: Related sectors (used on both sector + city pages) ───────────

// ─── Modelli Word da scaricare (solo /preventivi/modello-word/) ───────────────

// ─── Approfondimenti section (blog articles related to a sector) ─────────────

// ─── Phase 4: City context block (max 1 per city page) ─────────────────────

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

// ─── Phase 3: Sector body — 2 layout variants ──────────────────────────────

// ─── Phase 3: City body — 3 layout variants ────────────────────────────────

// ─── Phase 9: Osservatorio Prezzi e Domanda ────────────────────────────────

// ─── "Quanto costa" block: extra unique text for city pages (improves text/HTML ratio) ────

// The homepage (dist/index.html) gets its SEO <head> only.
// It used to also get a hand-written static copy of the hero (buildHomepageBodyHtml),
// which drifted from the real React homepage after the pixel redesign and was served
// as a stale flash on every cold load of "/" AND of every /dashboard/* route (index.html
// is the SPA fallback) until the bundle replaced it. The real page is client-rendered;
// crawlers execute JS. Do not reintroduce a static body here unless it is generated
// from the React tree (renderToString + hydrateRoot), never hand-copied.


// ─── Main execution ─────────────────────────────────────────────────────────

const template = pruneModulepreload(readFileSync(templatePath, "utf-8"));

// Phase 68: "/" and the six static pages (about, contact, privacy,
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
const homepageHtml = injectBody(injectHead(template, homepageHeadBlock), stripHoistedHead(await renderPage("/", "it")));
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
  // Ottobre 2026: corpo dal componente React (design delle pagine pubbliche),
  // renderizzato a build time e idratato come la home.
  const bodyHtml = stripHoistedHead(await renderPage(`/preventivi/${sectorSlug}`, "it"));
  const html = injectBody(injectHead(template, headBlock), bodyHtml);
  writeRoute(`preventivi/${sectorSlug}`, html);
  count++;

  if (!CITY_SECTORS.includes(sectorSlug)) continue;

  for (const city of ACTIVE_CITIES) {
    // Ottobre 2026: pagine città dai dati verificati (data/citta/), stesso
    // componente React per head e corpo, così titolo e contenuto coincidono.
    const pg = paginaCitta(sectorSlug, city.slug);
    if (!pg) continue;
    const cityHeadBlock = buildHeadBlock({
      title: pg.title,
      description: pg.description,
      canonical: pg.canonical,
      ogImagePath: ogImage(sectorSlug),
      jsonLd: pg.jsonLd,
    });
    const cityBodyHtml = stripHoistedHead(await renderPage(`/preventivi/${sectorSlug}/${city.slug}`, "it"));
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
      dateModified: article.updatedAt ?? article.publishedAt,
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
  const shownDate = article.updatedAt ?? article.publishedAt;
  const dateStr = (article.updatedAt ? "Aggiornato il " : "") + new Date(shownDate).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  const header = `<header style="background:linear-gradient(135deg,rgba(124,58,237,0.04),rgba(6,182,212,0.04))" class="pt-14 pb-10 border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="flex items-center gap-3 mb-5">
      <span class="text-xs font-semibold px-2.5 py-1 rounded-full" style="${catStyle}">${esc(article.category)}</span>
      <span class="text-xs text-gray-400">${article.readingTimeMin} min di lettura</span>
      <time class="text-xs text-gray-400" datetime="${shownDate}">${dateStr}</time>
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
  let html = injectBody(injectHead(template, headBlock), opts.bodyHtml);
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
// POCKET-7 (riga 64): la pagina dei video brevi, e i sottotitoli .vtt accanto ai file.
await buildStaticPageHtml({
  slug: "help/video",
  title: "Video: PrevAI in pochi minuti | prevai",
  description: "Brevi video muti con i sottotitoli: il primo preventivo, l'app in un minuto, il cantiere, il bonifico. Registrati dall'app PrevAI.",
  path: "/help/video/",
  jsonLd: [buildWebPageJsonLd("Video: PrevAI in pochi minuti", "Brevi video muti con i sottotitoli dell'app PrevAI.", "/help/video/", "CollectionPage"), buildBreadcrumbJsonLd("Video", "/help/video/")],
  bodyHtml: stripHoistedHead(await renderPage("/help/video", "it")),
});
for (const v of HELP_VIDEOS) writeFileSync(join(distDir, "video", `${v.file}.vtt`), toVtt(v));
console.log(`  ✓ ${HELP_ARTICLES.length + 2} help-centre pages prerendered, ${HELP_VIDEOS.length} video subtitles`);

// SEO-1 (riga 47): pagina servita da Vercel con stato 404 per ogni indirizzo
// che non è un file e non è una rotta dell'app (vercel.json → rewrites). Prima
// ogni indirizzo inesistente riceveva la home con 200, canonical sulla home e
// "index, follow": Google lo contava come duplicato (soft 404). Qui niente
// canonical, niente hreflang/og, niente JSON-LD, noindex; il corpo è la
// NotFound di React. `data-not-found` dice a main.tsx di non trattarla come
// pagina statica anche sotto /blog/ o /preventivi/.
{
  const notFoundHead = [
    `  <title>${esc(translations.it["notFound.title"])}</title>`,
    `  <meta name="description" content="${esc(translations.it["notFound.description"])}" />`,
  ].join("\n");
  let html = injectAppPreload(injectBody(injectHead(template, notFoundHead), stripHoistedHead(await renderPage("/404", "it"))));
  const prima = html;
  html = html.replace('<meta name="robots" content="index, follow" />', '<meta name="robots" content="noindex, follow" />');
  if (html === prima) throw new Error("prerender: meta robots della shell non trovato per 404.html");
  html = html.replace('<div id="root">', '<div id="root" data-not-found="">');
  if (/<link\b[^>]*rel="canonical"/.test(html)) throw new Error("prerender: 404.html non deve avere un canonical");
  writeFileSync(join(distDir, "404.html"), html, "utf-8");
  console.log("  ✓ 404.html prerendered");
}

// PERF-1: la shell delle rotte dell'app (dashboard, accesso, link dei clienti
// — i rewrite di vercel.json). Prima ricevevano index.html, cioè la homepage
// prerenderizzata: ~56 kB di HTML, i modulepreload della homepage e il suo
// contenuto a video finché l'App non lo sostituiva. Qui: root vuota (main.tsx
// fa createRoot), solo i preload dell'App, noindex. È anche la pagina che il
// service worker tiene per aprire l'app senza rete (public/sw.js).
{
  const appHead = [
    `  <title>PrevAI</title>`,
    `  <meta name="description" content="PrevAI: preventivi, cantieri e fatture per artigiani e imprese." />`,
  ].join("\n");
  let html = injectAppPreload(injectHead(template, appHead));
  const prima = html;
  html = html.replace('<meta name="robots" content="index, follow" />', '<meta name="robots" content="noindex, nofollow" />');
  if (html === prima) throw new Error("prerender: meta robots della shell non trovato per app.html");
  if (!html.includes('<div id="root"></div>')) throw new Error("prerender: app.html deve avere la root vuota");
  writeFileSync(join(distDir, "app.html"), html, "utf-8");
  console.log("  ✓ app.html (shell dell'app)");
}

console.log(`Prerendered ${count} pages total (1 homepage + SEO sector pages + ${BLOG_CATEGORIES.length} category pages + ${BLOG_ARTICLES.length + 1} blog pages + 7 SPA pages + ${HELP_ARTICLES.length + 1} help pages).`);
