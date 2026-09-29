// PERF-1 (riga 49) — budget del JavaScript per schermata.
//
//   pnpm --filter @workspace/preventivo-ai build        (o solo `vite build`)
//   pnpm --filter @workspace/preventivo-ai qa:bundle
//   pnpm --filter @workspace/preventivo-ai qa:bundle -- --verbose   # file per file
//
// Legge la mappa dei chunk scritta dal build (dist/bundle-map.json, plugin in
// vite.config.ts) e le rotte di src/App.tsx, e per ogni schermata somma il
// JavaScript che il browser deve scaricare prima di disegnarla: l'entry
// (index.html → main.tsx), il chunk dell'App, il layout della dashboard
// quando la rotta lo usa, il chunk della pagina e tutti i loro import statici
// (ricorsivi: Vite li precarica con modulepreload). Gli import dinamici
// (dialoghi, grafici caricati dopo il primo disegno) non contano.
// Le pagine statiche SEO (/preventivi/…, /blog/…) caricano solo l'entry:
// main.tsx non importa l'App su quelle pagine.
// Misura in gzip livello 9 (Vercel serve brotli, ~15 % più piccolo: il budget
// è quindi prudente). Esce con 1 se una schermata supera il suo budget
// (scripts/bundle-budget.json), se un budget nomina una schermata che non
// esiste più o se una rotta di App.tsx non si riconosce: lo script non deve
// diventare cieco quando cambia App.tsx.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, "dist/public");
const MAP = resolve(ROOT, "dist/bundle-map.json");
const VERBOSE = process.argv.includes("--verbose");

type Chunk = { file: string; isEntry: boolean; imports: string[]; dynamicImports: string[]; modules: string[] };
type Budget = { groups: Record<string, number>; screens: Record<string, number> };

if (!existsSync(MAP)) {
  console.error("[qa:bundle] dist/bundle-map.json manca — esegui prima `pnpm --filter @workspace/preventivo-ai build`");
  process.exit(2);
}
const chunks = JSON.parse(readFileSync(MAP, "utf8")) as Chunk[];
const byFile = new Map(chunks.map((c) => [c.file, c]));
const budget = JSON.parse(readFileSync(resolve(ROOT, "scripts/bundle-budget.json"), "utf8")) as Budget;

const gz = new Map<string, number>();
function gzipKb(file: string): number {
  let n = gz.get(file);
  if (n === undefined) {
    n = gzipSync(readFileSync(resolve(DIST, file)), { level: 9 }).length / 1024;
    gz.set(file, n);
  }
  return n;
}

/** The chunk holding a source module (path relative to the package, e.g. "src/App.tsx"). */
function chunkOf(module: string): string {
  const c = chunks.find((x) => x.modules.includes(module));
  if (!c) throw new Error(`${module}: in nessun chunk del build`);
  return c.file;
}

/** Chunks + all their static imports, recursively. */
function closure(files: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...files];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    const c = byFile.get(f);
    if (!c) throw new Error(`chunk ${f} assente dalla mappa`);
    seen.add(f);
    stack.push(...c.imports);
  }
  return seen;
}

const entry = chunks.find((c) => c.isEntry)?.file;
if (!entry) throw new Error("nessun entry nel build");
const app = chunkOf("src/App.tsx");
const layout = chunkOf("src/components/layout/dashboard-layout.tsx");

// Routes from App.tsx: lazy page constants + <Route path=…> (one- or multi-line).
const appSrc = readFileSync(resolve(ROOT, "src/App.tsx"), "utf8");
const lazyPages = new Map<string, string>();
for (const m of appSrc.matchAll(/const (\w+) = lazy\(\(\) => import\("@\/(pages\/[^"]+)"\)\)/g)) {
  const rel = `src/${m[2]}`;
  const mod = [".tsx", ".ts", "/index.tsx"].map((ext) => rel + ext).find((f) => chunks.some((c) => c.modules.includes(f)));
  if (!mod) throw new Error(`pagina ${m[1]} (${rel}) non trovata nel build`);
  lazyPages.set(m[1]!, chunkOf(mod));
}
const paths = Object.fromEntries(
  [...readFileSync(resolve(ROOT, "src/data/sitemap-routes.ts"), "utf8").matchAll(/name: "(\w+)",\s*path: "([^"]+)"/g)].map((m) => [m[1]!, m[2]!]),
);

type Screen = { name: string; group?: string; files: string[] };
const screens: Screen[] = [];
for (const m of appSrc.matchAll(/<Route path=(\{[\w.]+\}|"[^"]+") component=\{\(\) => (\(\s*\n[^\n]*|[^\n]*)/g)) {
  const raw = m[1]!.replace(/^[{"]|[}"]$/g, "");
  const body = m[2]!;
  if (body.includes("<Redirect") || raw.includes(":rest*")) continue;
  const name = raw.startsWith("PATHS.") ? paths[raw.slice(6)] : raw;
  if (!name) throw new Error(`rotta ${raw}: percorso non trovato in sitemap-routes.ts`);
  if (screens.some((s) => s.name === name)) continue;
  // The route's page: the first lazy page named in the route (Home is static, inside the App chunk).
  const page = [...body.matchAll(/<(\w+) \/>/g)].map((x) => x[1]!).find((n) => lazyPages.has(n));
  if (!page && name !== "/") throw new Error(`rotta ${name}: pagina non riconosciuta`);
  screens.push({ name, files: [entry, app, ...(body.includes("<DashboardLayout>") ? [layout] : []), ...(page ? [lazyPages.get(page)!] : [])] });
}
if (screens.length < 40) throw new Error(`solo ${screens.length} rotte lette da App.tsx: la regex non segue più il file`);
screens.push({ name: "/preventivi/… /blog/… (statiche)", group: "static", files: [entry] });

function groupOf(s: Screen): string {
  if (s.group) return s.group;
  if (s.files.includes(layout) || s.name.startsWith("/dashboard") || s.name.startsWith("/studio")) return "dashboard";
  if (/:(token|id)$/.test(s.name)) return "link";
  if (/^\/(sign-in|sign-up|reset-password|onboarding)/.test(s.name)) return "auth";
  return "public";
}

type Row = { name: string; group: string; kb: number; limit: number; files: Array<[string, number]> };
const rows: Row[] = screens.map((s) => {
  const sized = [...closure(s.files)].filter((f) => f.endsWith(".js")).map((f) => [f, gzipKb(f)] as [string, number]).sort((a, b) => b[1] - a[1]);
  const group = groupOf(s);
  const limit = budget.screens[s.name] ?? budget.groups[group];
  if (limit === undefined) throw new Error(`nessun budget per il gruppo ${group}`);
  return { name: s.name, group, kb: sized.reduce((t, [, n]) => t + n, 0), limit, files: sized };
});

rows.sort((a, b) => a.group.localeCompare(b.group) || b.kb - a.kb);
const over = rows.filter((r) => r.kb > r.limit);
for (const r of rows) {
  console.log(`${r.group.padEnd(9)} ${r.name.padEnd(40)} ${r.kb.toFixed(1).padStart(6)} kB / ${String(r.limit).padStart(3)} kB${r.kb > r.limit ? "  ← SOPRA IL BUDGET" : ""}`);
  if (VERBOSE || r.kb > r.limit) for (const [f, n] of r.files) console.log(`            ${n.toFixed(1).padStart(6)} kB  ${f}`);
}
const stale = Object.keys(budget.screens).filter((k) => !rows.some((r) => r.name === k));
if (stale.length) console.log(`\n[qa:bundle] budget per schermate che non esistono più: ${stale.join(", ")}`);
console.log(`\n[qa:bundle] ${rows.length} schermate, JS gzip prima del primo disegno — ${over.length ? `${over.length} sopra il budget` : "tutte nel budget"}`);
process.exit(over.length || stale.length ? 1 : 0);
