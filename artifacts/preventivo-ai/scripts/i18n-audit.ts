// V2-2f — audit i18n "invertito" (PrevAI è monolingua: solo `it`).
//
//   pnpm --filter @workspace/preventivo-ai i18n-audit            # report, exit 1 sui fallimenti duri
//   pnpm --filter @workspace/preventivo-ai i18n-audit --json     # output leggibile da macchina
//   pnpm --filter @workspace/preventivo-ai i18n-audit --verbose  # elenca ogni letterale sospetto
//
// Fallimenti duri (exit 1):
//   1. una chiave `t("…")` usata in src/ che non esiste nel dizionario `it`
//      (la UI mostrerebbe la chiave grezza);
//   2. un valore del dizionario che sembra inglese (residuo della base QuoteAI);
//   3. (Phase 68) una chiave presente sia in translations.ts sia in
//      translations.dashboard.ts, oppure una chiave solo-dashboard usata da un
//      file raggiungibile dall'entry pubblico (renderizzerebbe la chiave grezza);
//   4. un letterale JSX inglese nelle superfici app (dashboard, firma, portali,
//      onboarding, componenti condivisi) fuori da `t()`.
// Segnalato, non bloccante:
//   5. letterali JSX inglesi nelle pagine pubbliche/marketing (contenuto SEO v1,
//      nomi di prodotti, ecc.): il numero viene registrato nel log di build.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { translations } from "../src/i18n/translations.ts";
import { dashboardTranslations } from "../src/i18n/translations.dashboard.ts";

const ROOT = join(import.meta.dirname, "..", "src");
const json = process.argv.includes("--json");
const verbose = process.argv.includes("--verbose");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => !/translations(.dashboard)?.ts$/.test(f));
// Phase 68: il dizionario è diviso (core = bundle pubblico, dashboard = chunk lazy).
// Gli audit girano sull'unione; §3 controlla la divisione stessa.
const it: Record<string, string> = { ...translations.it, ...dashboardTranslations.it };

// ── Euristica "sembra inglese" ──────────────────────────────────────────────
// Parole funzione inglesi che non esistono in italiano (o sono rarissime). Un
// testo è sospetto se ne contiene almeno una come parola intera. Brand, sigle e
// termini tecnici accettati in italiano sono esclusi a monte.
const EN_STOPWORDS = /\b(the|and|your|you|with|for|from|this|that|are|not|will|has|have|been|when|what|new|add|save|delete|edit|send|sent|paid|customer|please|error|could|cannot|can't|couldn't|don't|doesn't|isn't|we|our|of|to|at|by|or|is|be|an|its|was|were|get|any|yes|only|more|less|than|then|now|here|there|about|after|before|again|back|next|previous|first|last|each|every|some|these|those|them|they|their|which|who|whom|how|why|where|while|until|upon|into|onto|over|under|out|down|days|day|month|year|hours)\b/i;
const IGNORE_TEXT = /^(PrevAI|Stripe|WhatsApp|Google|Gmail|Outlook|Meta|Zapier|Resend|OpenAI|Vercel|Supabase|Groq|PDF|CSV|Excel|Word|IVA|N\/A|OK|—|·|S\.r\.l\.?|S\.p\.A\.?|S\.n\.c\.?|S\.a\.s\.?|Google Business Profile|Meta Lead Ads|Google Local Services Ads|Stripe Connect|Interac e-Transfer|Google Calendar|Outlook Calendar)$/;
// i segnaposto ({days}, {n}) e i composti con trattino (follow-up) non contano come parole
const looksEnglish = (raw: string) => {
  const text = raw.replace(/\{[^}]*\}/g, " ").replace(/-/g, "");
  return !IGNORE_TEXT.test(raw) && EN_STOPWORDS.test(text) && !/^[\d\s$€%.,:/+@-]+$/.test(text);
};

// 1. chiavi usate nel codice
const used = new Map<string, string[]>(); // chiave → file
const keyRe = /\bt\(\s*"([^"]+)"\s*[,)]/g;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(keyRe)) {
    const list = used.get(m[1]!) ?? [];
    list.push(relative(ROOT, f));
    used.set(m[1]!, list);
  }
}
const unknownKeys = [...used.entries()].filter(([k]) => !(k in it)).map(([k, where]) => ({ key: k, files: [...new Set(where)] }));

// 2. valori del dizionario che sembrano inglesi
const englishValues = Object.entries(it)
  .filter(([, v]) => typeof v === "string" && looksEnglish(v))
  .map(([k, v]) => ({ key: k, value: v }));

// 3. divisione core/dashboard (Phase 68). Una chiave dashboard è sicura solo se
//    ogni file che la usa è raggiungibile unicamente dalle radici dashboard.
//    Percorriamo il grafo statico degli import dall'entry pubblico più le pagine
//    pubbliche lazy; tutto ciò che raggiungono deve trovare le chiavi in translations.ts.
const rel = (f: string) => relative(ROOT, f).split(sep).join("/");
const byRel = new Map(files.map((f) => [rel(f), f]));
function resolveImport(fromRel: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? spec.slice(2) : spec.startsWith(".") ? join(fromRel, "..", spec).split(sep).join("/") : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (byRel.has(c)) return c;
  return null;
}
function reachable(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(byRel.get(f)!, "utf8");
    for (const m of src.matchAll(/\bimport(?:\s[^;]*?\sfrom)?\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const r = resolveImport(f, (m[1] ?? m[2])!);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return seen;
}
const PUBLIC_LAZY_ROOTS = [...byRel.keys()].filter((f) => /^pages\/(seo|blog|p|i|sign|t|team-invite)\//.test(f));
// main.tsx/App.tsx raggiungono la dashboard solo via import() dinamico; li togliamo così il grafo dell'entry resta pubblico.
const entryGraph = (() => {
  const seen = new Set<string>();
  const stack = ["main.tsx", "App.tsx"];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(byRel.get(f)!, "utf8");
    for (const m of src.matchAll(/^\s*import(?:\s[^;]*?\sfrom)?\s+["']([^"']+)["']/gm)) {
      const r = resolveImport(f, m[1]!);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return seen;
})();
const publicFiles = new Set([...entryGraph, ...reachable(PUBLIC_LAZY_ROOTS)]);
const duplicateKeys = Object.keys(dashboardTranslations.it).filter((k) => k in translations.it);
const dashboardKeyOnPublicPage = [...used.entries()]
  .filter(([k]) => k in dashboardTranslations.it && !(k in translations.it))
  .map(([k, where]) => ({ key: k, files: [...new Set(where.map((w) => w.split(sep).join("/")))].filter((w) => publicFiles.has(w)) }))
  .filter((x) => x.files.length > 0);

// 4./5. letterali inglesi nel JSX (fuori da t())
const APP_DIRS = ["pages/dashboard/", "pages/sign/", "pages/t/", "pages/i/", "pages/p/", "pages/team-invite/", "pages/onboarding.tsx", "pages/sign-in.tsx", "pages/sign-up.tsx", "pages/admin", "components/"];
const isApp = (f: string) => APP_DIRS.some((d) => rel(f).startsWith(d));
// nodo di testo tra tag: almeno due parole, inizia con una lettera, non è un'espressione
const textRe = />\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’,.!?&-]*(?:\s+[A-Za-zÀ-ÿ0-9'’,.!?&%$€()-]+){1,})\s*</g;
const attrRe = /\b(placeholder|title|aria-label|alt)="([A-Za-zÀ-ÿ][^"{}]{3,})"/g;
type Hit = { file: string; line: number; text: string };
const hardcodedApp: Hit[] = [];
const hardcodedPublic: Hit[] = [];
for (const f of files) {
  if (!f.endsWith(".tsx")) continue;
  const src = readFileSync(f, "utf8");
  const lineOf = (idx: number) => src.slice(0, idx).split("\n").length;
  const target = isApp(f) ? hardcodedApp : hardcodedPublic;
  for (const m of src.matchAll(textRe)) {
    const text = m[1]!.trim();
    if (!looksEnglish(text)) continue;
    // frammenti di codice: "=> x", pezzi di template, css
    if (/=>|\bconst\b|\breturn\b|className=/.test(text)) continue;
    target.push({ file: rel(f), line: lineOf(m.index!), text });
  }
  for (const m of src.matchAll(attrRe)) {
    const text = m[2]!.trim();
    if (!looksEnglish(text) || /esempio\.it|example\.com|@/.test(text)) continue;
    target.push({ file: rel(f), line: lineOf(m.index!), text: `${m[1]}="${text}"` });
  }
}

const report = {
  keys: { it: Object.keys(it).length, used: used.size },
  unknownKeys,
  englishValues,
  duplicateKeys,
  dashboardKeyOnPublicPage,
  hardcodedApp,
  hardcodedPublic,
};

const byFile = (hits: Hit[]) => {
  const m = new Map<string, number>();
  for (const h of hits) m.set(h.file, (m.get(h.file) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`dizionario it: ${report.keys.it} chiavi · chiavi referenziate nel codice: ${report.keys.used}`);
  console.log(`\n1. chiavi t("…") assenti dal dizionario: ${unknownKeys.length}`);
  for (const u of unknownKeys) console.log(`   ${u.key}  ← ${u.files.join(", ")}`);
  console.log(`\n2. valori del dizionario che sembrano inglesi: ${englishValues.length}`);
  for (const e of englishValues.slice(0, verbose ? Infinity : 40)) console.log(`   ${e.key} = ${JSON.stringify(e.value)}`);
  console.log(`\n3. split: chiavi in entrambi i dizionari: ${duplicateKeys.length}`);
  for (const k of duplicateKeys) console.log(`   ${k}`);
  console.log(`   chiavi solo-dashboard usate da un file pubblico: ${dashboardKeyOnPublicPage.length}`);
  for (const u of dashboardKeyOnPublicPage) console.log(`   ${u.key}  ← ${u.files.join(", ")}`);
  console.log(`\n4. letterali inglesi nel JSX app (fuori da t()): ${hardcodedApp.length}`);
  for (const [f, n] of byFile(hardcodedApp)) console.log(`   ${String(n).padStart(3)}  ${f}`);
  if (verbose) for (const h of hardcodedApp) console.log(`   ${h.file}:${h.line}  ${h.text}`);
  console.log(`\n5. letterali inglesi nel JSX pubblico/marketing (segnalati): ${hardcodedPublic.length}`);
  for (const [f, n] of byFile(hardcodedPublic)) console.log(`   ${String(n).padStart(3)}  ${f}`);
  if (verbose) for (const h of hardcodedPublic) console.log(`   ${h.file}:${h.line}  ${h.text}`);
}

const hard = unknownKeys.length + englishValues.length + duplicateKeys.length + dashboardKeyOnPublicPage.length + hardcodedApp.length;
process.exit(hard > 0 ? 1 : 0);
