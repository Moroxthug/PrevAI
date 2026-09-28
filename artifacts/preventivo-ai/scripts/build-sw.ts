// APP-2 (docs/APP-PLAN.md, dalla Phase 77 di QuoteAI): completa il service
// worker dopo la build del client.
//
// Vite copia public/sw.js così com'è in dist/public; questo script riscrive
// quella copia con la versione (nomi delle cache) e la lista dei file della
// struttura dell'app da precaricare — l'entry, l'App e le pagine che servono
// in cantiere senza rete — letta dal manifest di Vite, così gli hash sono
// sempre quelli giusti. Gira dallo script `build` dopo `vite build` e il
// prerender. Il manifest di Vite (.vite/manifest.json) non viene pubblicato.

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(import.meta.dirname, "..", "dist", "public");
const swPath = resolve(distDir, "sw.js");
const manifestDir = resolve(distDir, ".vite");
const manifestPath = resolve(manifestDir, "manifest.json");

if (!existsSync(swPath)) {
  console.error("dist/public/sw.js non trovato — prima vite build");
  process.exit(1);
}

type ManifestChunk = { file: string; src?: string; isEntry?: boolean; imports?: string[]; css?: string[] };
const manifest: Record<string, ManifestChunk> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

// Pagine i cui pezzi si precaricano (chiavi del manifest di Vite = percorsi dei sorgenti).
const SHELL_ENTRIES = [
  // The App chunk (a dynamic import of main.tsx) is not a manifest key of its own: it comes in as an import of the pages below.
  "index.html",
  "src/pages/dashboard/index.tsx",
  "src/pages/dashboard/new.tsx",
  "src/pages/dashboard/quotes/index.tsx",
  "src/pages/dashboard/quotes/[id].tsx",
  "src/pages/dashboard/jobs/index.tsx",
  "src/pages/dashboard/jobs/[id].tsx",
  "src/pages/dashboard/notifications.tsx",
];

const files = new Set<string>();
const seen = new Set<string>();
function walk(key: string) {
  if (seen.has(key)) return;
  seen.add(key);
  const chunk = manifest[key];
  if (!chunk) return;
  files.add(`/${chunk.file}`);
  for (const css of chunk.css ?? []) files.add(`/${css}`);
  for (const dep of chunk.imports ?? []) walk(dep);
}
for (const entry of SHELL_ENTRIES) {
  if (!manifest[entry]) console.warn(`build-sw: ${entry} non è nel manifest di Vite (saltato)`);
  walk(entry);
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
// Il manifest serviva solo qui: non va pubblicato con il sito.
rmSync(manifestDir, { recursive: true, force: true });
console.log(`build-sw: versione ${version}, ${precache.length} file della struttura precaricati`);
