// APP-2 (docs/APP-PLAN.md, dalla Phase 77 di QuoteAI): completa il service
// worker dopo la build del client.
//
// Vite copia public/sw.js così com'è in dist/public; questo script riscrive
// quella copia con la versione (nomi delle cache) e la lista dei file della
// struttura dell'app da precaricare — l'entry, l'App e le pagine che servono
// in cantiere senza rete — letta dalla mappa dei chunk (dist/bundle-map.json,
// plugin in vite.config.ts), così gli hash sono sempre quelli giusti. Gira
// dallo script `build` dopo `vite build` e il prerender.
// PERF-1: prima leggeva il manifest di Vite, che perde il nome di una pagina
// quando Rollup la fonde in un chunk condiviso (la scheda del lavoro spariva
// dal precache).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(import.meta.dirname, "..", "dist", "public");
const swPath = resolve(distDir, "sw.js");
const mapPath = resolve(distDir, "..", "bundle-map.json");

if (!existsSync(swPath) || !existsSync(mapPath)) {
  console.error("dist/public/sw.js o dist/bundle-map.json non trovato — prima vite build");
  process.exit(1);
}

type Chunk = { file: string; isEntry: boolean; imports: string[]; modules: string[]; css: string[] };
const chunks = JSON.parse(readFileSync(mapPath, "utf8")) as Chunk[];
const byFile = new Map(chunks.map((c) => [c.file, c]));

// Moduli sorgente le cui pagine (con tutti i loro import statici) si precaricano.
const SHELL_MODULES = [
  "src/main.tsx",
  "src/App.tsx",
  "src/components/layout/dashboard-layout.tsx",
  "src/pages/dashboard/index.tsx",
  "src/pages/dashboard/new.tsx",
  "src/pages/dashboard/quotes/index.tsx",
  "src/pages/dashboard/quotes/[id].tsx",
  "src/pages/dashboard/jobs/index.tsx",
  "src/pages/dashboard/jobs/[id].tsx",
  // PERF-1: i grafici della scheda del lavoro ora arrivano dopo la pagina.
  "src/components/jobs/overview-charts.tsx",
  "src/pages/dashboard/notifications.tsx",
];

const files = new Set<string>();
function walk(file: string) {
  if (files.has(`/${file}`)) return;
  const chunk = byFile.get(file);
  if (!chunk) return;
  files.add(`/${file}`);
  for (const css of chunk.css) files.add(`/${css}`);
  for (const dep of chunk.imports) walk(dep);
}
for (const mod of SHELL_MODULES) {
  const chunk = chunks.find((c) => c.modules.includes(mod));
  if (!chunk) {
    console.error(`build-sw: ${mod} non è in nessun chunk — aggiorna SHELL_MODULES`);
    process.exit(1);
  }
  walk(chunk.file);
}

const precache = [...files].filter((f) => f.startsWith("/assets/")).sort();
const version = (process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 12) || `local-${Date.now().toString(36)}`;

let sw = readFileSync(swPath, "utf8");
const VERSION_LINE = /const VERSION = "__SW_VERSION__";/;
if (!VERSION_LINE.test(sw) || !sw.includes("/* __PRECACHE__ */ []")) {
  console.error("build-sw: segnaposto mancanti in dist/public/sw.js");
  process.exit(1);
}
sw = sw.replace(VERSION_LINE, `const VERSION = "${version}";`).replace("/* __PRECACHE__ */ []", JSON.stringify(precache));
writeFileSync(swPath, sw);
console.log(`build-sw: versione ${version}, ${precache.length} file della struttura precaricati`);
