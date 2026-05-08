import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { SECTORS, CITIES, CITY_SECTORS } from "../src/data/seo-data.js";
import { BLOG_ARTICLES } from "../src/data/blog-data.js";

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

entries.push(url(`${BASE_URL}/`, "1.0", "weekly"));
entries.push(url(`${BASE_URL}/privacy`, "0.4", "yearly"));
entries.push(url(`${BASE_URL}/termini`, "0.4", "yearly"));

const citySectorSet = new Set(CITY_SECTORS);
for (const sectorSlug of Object.keys(SECTORS)) {
  const priority = citySectorSet.has(sectorSlug) ? "0.8" : "0.7";
  entries.push(url(`${BASE_URL}/seo/${sectorSlug}`, priority, "monthly"));
}

for (const sectorSlug of CITY_SECTORS) {
  for (const city of CITIES) {
    const priority = TIER1_CITY_SLUGS.has(city.slug) ? "0.7" : "0.6";
    entries.push(url(`${BASE_URL}/seo/${sectorSlug}/${city.slug}`, priority, "monthly"));
  }
}

entries.push(url(`${BASE_URL}/blog`, "0.8", "weekly"));
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
