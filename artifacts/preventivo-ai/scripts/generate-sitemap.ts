import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { SECTORS, CITIES, CITY_SECTORS } from "../src/data/seo-data.js";
import { BLOG_ARTICLES, BLOG_CATEGORIES } from "../src/data/blog-data.js";
import { PUBLIC_ROUTES } from "../src/data/sitemap-routes.js";

const BASE_URL = "https://www.prevai.it";
const TODAY = new Date().toISOString().split("T")[0];

const TIER1_CITY_SLUGS = new Set([
  "roma", "milano", "napoli", "torino", "palermo", "genova", "bologna",
  "firenze", "bari", "catania", "venezia", "verona", "messina", "padova",
  "trieste", "brescia", "reggio-calabria", "modena", "parma", "prato",
]);

function url(loc: string, priority: string, changefreq: string, lastmod = TODAY): string {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const entries: string[] = [];

// Static public routes — add trailing slash to all paths except root "/"
for (const route of PUBLIC_ROUTES) {
  const loc = route.path === "/" ? `${BASE_URL}/` : `${BASE_URL}${route.path}/`;
  entries.push(url(loc, route.priority, route.changefreq));
}

// SEO sector landing pages
const citySectorSet = new Set(CITY_SECTORS);
for (const sectorSlug of Object.keys(SECTORS)) {
  const priority = citySectorSet.has(sectorSlug) ? "0.8" : "0.7";
  entries.push(url(`${BASE_URL}/seo/${sectorSlug}/`, priority, "monthly", "2026-05-01"));
}

// SEO city×sector pages
for (const sectorSlug of CITY_SECTORS) {
  for (const city of CITIES) {
    const priority = TIER1_CITY_SLUGS.has(city.slug) ? "0.7" : "0.6";
    entries.push(url(`${BASE_URL}/seo/${sectorSlug}/${city.slug}/`, priority, "monthly", "2026-05-01"));
  }
}

// Blog — categories get a stable aggregate date; articles use their real publishedAt
for (const cat of BLOG_CATEGORIES) {
  entries.push(url(`${BASE_URL}/blog/categoria/${cat.slug}/`, "0.7", "weekly", "2026-05-01"));
}
for (const article of BLOG_ARTICLES) {
  entries.push(url(`${BASE_URL}/blog/${article.slug}/`, "0.7", "monthly", article.publishedAt));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

const outPath = join(__dirname, "../public/sitemap.xml");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, sitemap, "utf-8");
console.log(`Sitemap written: ${outPath} (${entries.length} URLs)`);
