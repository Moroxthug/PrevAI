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

function url(loc: string, priority: string, changefreq: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const entries: string[] = [];

// Static public routes — sourced from src/data/sitemap-routes.ts (same file App.tsx uses)
for (const route of PUBLIC_ROUTES) {
  entries.push(url(`${BASE_URL}${route.path}`, route.priority, route.changefreq));
}

// SEO sector landing pages — driven by SECTORS data
const citySectorSet = new Set(CITY_SECTORS);
for (const sectorSlug of Object.keys(SECTORS)) {
  const priority = citySectorSet.has(sectorSlug) ? "0.8" : "0.7";
  entries.push(url(`${BASE_URL}/seo/${sectorSlug}`, priority, "monthly"));
}

// SEO city×sector pages — driven by CITY_SECTORS × CITIES data
for (const sectorSlug of CITY_SECTORS) {
  for (const city of CITIES) {
    const priority = TIER1_CITY_SLUGS.has(city.slug) ? "0.7" : "0.6";
    entries.push(url(`${BASE_URL}/seo/${sectorSlug}/${city.slug}`, priority, "monthly"));
  }
}

// Blog — driven by BLOG_CATEGORIES and BLOG_ARTICLES data
for (const cat of BLOG_CATEGORIES) {
  entries.push(url(`${BASE_URL}/blog/categoria/${cat.slug}`, "0.7", "weekly"));
}
for (const article of BLOG_ARTICLES) {
  entries.push(url(`${BASE_URL}/blog/${article.slug}`, "0.7", "monthly"));
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
