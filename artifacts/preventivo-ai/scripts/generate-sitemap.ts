import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { SECTORS, CITIES, CITY_SECTORS } from "../src/data/seo-data.js";

const BASE_URL = "https://www.prevai.it";
const TODAY = new Date().toISOString().split("T")[0];

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
entries.push(url(`${BASE_URL}/sign-up`, "0.4", "monthly"));
entries.push(url(`${BASE_URL}/sign-in`, "0.4", "monthly"));

for (const sectorSlug of Object.keys(SECTORS)) {
  entries.push(url(`${BASE_URL}/seo/${sectorSlug}`, "0.7", "monthly"));
}

for (const sectorSlug of CITY_SECTORS) {
  for (const city of CITIES) {
    entries.push(url(`${BASE_URL}/seo/${sectorSlug}/${city.slug}`, "0.6", "monthly"));
  }
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
