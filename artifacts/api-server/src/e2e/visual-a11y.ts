// Phase 67 — visual + accessibility sweep of every route.
//
// Boots the real API (harness, ephemeral port, .env.staging), spawns the
// preventivo-ai Vite dev server proxied at it, seeds a showcase account
// (fixtures.ts) and drives the installed Chrome through playwright-core.
// For every route × language × viewport width it records:
//   • a full-page screenshot        → .qa/visual/<lang>/<width>/<route>.png
//   • horizontal overflow           (scrollWidth > clientWidth, with the widest offenders)
//   • axe-core violations           (serious/critical are the exit criterion; moderate listed)
//   • console errors + failed /api requests + React error-boundary text
// and writes .qa/visual/report.{json,md}. Nothing leaves the machine: email
// is captured at the fetch boundary, other vendors are stubbed, AI falls back.
//
//   pnpm --filter @workspace/api-server qa:visual                  # it a 5 larghezze
//   pnpm --filter @workspace/api-server qa:visual -- --widths=375 --routes=quotes,jobs
//   pnpm --filter @workspace/api-server qa:visual -- --keep        # leave the account + servers up and print the token
//   pnpm --filter @workspace/api-server qa:visual -- --screenshots=false --widths=1280,375   # axe-only pass
//   E2E_NO_PURGE=1 pnpm … qa:visual -- --port=5198 --out=visual-quick --routes=…            # alongside a running sweep
//   pnpm --filter @workspace/api-server qa:phone                   # APP-1i: 360/390/430 px, the phone gate (exit 1 on any finding)
//
// APP-1i: at ≤ 640 px every page must pass the phone rules (phoneRules below:
// no sideways scroll, text off the glass edge, no stacks of full-width buttons,
// tables that fit, tabs on one line, fields at 16 px, the primary on screen or
// docked, the end of the page above the tab bar, a height budget). Any finding
// there fails the run. A deliberate exception is `data-phone-ok="<rule> …"` on
// the element or an ancestor, never a silent skip.
//
// Requires Google Chrome (playwright-core `channel: "chrome"`; set
// QA_CHROME_PATH to point at another Chromium build).

import { bootstrapQaEnv, captureResend } from "./qaEnv.js";

process.env.LOG_LEVEL ??= "warn";
bootstrapQaEnv("qa-visual");
process.env.NODE_ENV = "development";

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core/axe.min.js");
const ROOT = resolve(import.meta.dirname, "../../../..");

// Phase 68: the translation dictionary is split (core vs lazy dashboard chunk).
// A key that ends up in the wrong half renders as its raw id ("jobs.tab.costs"),
// so every page's text is scanned for known key ids.
const TRANSLATION_KEYS: Set<string> = new Set(
  ["translations.ts", "translations.dashboard.ts"].flatMap((name) =>
    [...readFileSync(resolve(ROOT, "artifacts/preventivo-ai/src/i18n", name), "utf8").matchAll(/^\s*"([a-zA-Z0-9_.-]+)":/gm)].map((m) => m[1]!),
  ),
);

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1]!, m[2] ?? "true");
}
// APP-1i: `--phone` = the three phones of APP-PLAN §5 (Android small, iPhone, iPhone Pro Max), no axe unless asked.
const PHONE_MODE = args.has("phone");
const LANGS = (args.get("lang") ?? "it").split(",").filter(Boolean) as Array<"it">;
const WIDTHS_IT = (args.get("widths") ?? (PHONE_MODE ? "360,390,430" : "1280,980,768,640,375")).split(",").map(Number);
const WIDTHS_FR = WIDTHS_IT;
const WIDTHS_EN = WIDTHS_IT;
const ROUTE_FILTER = (args.get("routes") ?? "").split(",").filter(Boolean);
const RUN_AXE = PHONE_MODE ? args.get("axe") === "true" : args.get("axe") !== "false";
const SCREENSHOTS = args.get("screenshots") !== "false";
const KEEP = args.has("keep");
const PROVINCE = (args.get("province") ?? "MI");
const VITE_PORT = Number(args.get("port") ?? (PHONE_MODE ? 5196 : 5197));
// A second run alongside a full sweep needs its own port AND its own output dir (the run starts by wiping it).
const OUT = resolve(import.meta.dirname, "../../.qa", args.get("out") ?? (PHONE_MODE ? "phone" : "visual"));

// ── Routes ───────────────────────────────────────────────────────────────────
/**
 * `name`: the label (and screenshot) when one path is checked in several states.
 * `drive`: clicks from the loaded page to that state (a sheet has no URL of its own).
 * `screens`: APP-1i, this page's height budget in phone screens (PHONE_SCREENS otherwise).
 */
type RouteSpec = { path: string; auth: boolean; name?: string; drive?: (page: Page) => Promise<void>; screens?: number };
// APP-1i: opens a phone sheet when its trigger is on screen (the tab bar exists at 980 px and below; no-op wider).
async function openPhoneSheet(page: Page, trigger: string, sheet: string) {
  const b = page.locator(trigger).first();
  if (!(await b.isVisible().catch(() => false))) return;
  await b.click();
  await page.waitForSelector(sheet);
  await page.waitForTimeout(300);
}
function routes(s: import("./fixtures.js").Showcase): RouteSpec[] {
  const pub = (path: string): RouteSpec => ({ path, auth: false });
  const dash = (path: string): RouteSpec => ({ path, auth: true });
  const list: RouteSpec[] = [
    // V2-6: rotte pubbliche italiane reali (prima c'erano ancora i path canadesi di QuoteAI, che finivano sulla 404).
    pub("/"), pub("/whatsapp"), pub("/blog"), pub("/blog/categoria/consigli"),
    pub("/blog/ai-preventivi-artigiani"),
    pub("/preventivi/imbianchino"), pub("/preventivi/imbianchino/bergamo"), pub("/preventivi/come-fare-preventivo"),
    pub("/help"), pub("/help/create-a-quote"),
    pub("/chi-siamo"), pub("/contatti"), pub("/privacy"), pub("/termini"), pub("/mappa-sito"),
    pub("/sign-in"), pub("/sign-up"), pub("/this-route-does-not-exist"),
    pub(`/p/${s.longQuoteId}`), pub(`/i/${s.invoiceToken}`),
    ...(s.signToken ? [pub(`/sign/${s.signToken}`)] : []),
    ...(s.workerToken ? [pub(`/t/${s.workerToken}`)] : []),
    ...(s.teamInviteToken ? [pub(`/team-invite/${s.teamInviteToken}`)] : []),
    dash("/onboarding"),
    dash("/dashboard"), dash("/dashboard/new"), dash("/dashboard/quotes"), dash(`/dashboard/quotes/${s.longQuoteId}`), dash(`/dashboard/quotes/${s.quoteId}`),
    dash("/dashboard/analytics"), dash("/dashboard/settings"), dash("/dashboard/billing"),
    // APP-1b: ogni sezione delle Impostazioni e il catalogo App collegate con un pannello aperto.
    ...["access", "security", "company", "fiscal", "payments", "automations", "widget", "whatsapp", "apps", "plan"].map((s) => dash(`/dashboard/settings/${s}`)),
    dash("/dashboard/settings/apps?app=gmail"),
    dash("/dashboard/catalog"), dash("/dashboard/clients"), ...(s.clientId ? [dash(`/dashboard/clients/${s.clientId}`)] : []),
    dash("/dashboard/leads"), dash("/dashboard/imports"),
    dash("/dashboard/contracts"), dash(`/dashboard/contracts/${s.contractId}`), dash(`/dashboard/contracts/${s.pendingContractId}`),
    dash("/dashboard/invoices"), dash(`/dashboard/invoices/${s.invoiceId}`),
    // A-1: fattura elettronica trasmessa, pagina Amministrazione, scheda SDI.
    ...(s.fiscalInvoiceId ? [dash(`/dashboard/invoices/${s.fiscalInvoiceId}`)] : []),
    dash("/dashboard/amministrazione"), dash("/dashboard/settings/sdi"),
    // A-2: pagina Fisco (calcolo forfettario, soglia, simulatore).
    dash("/dashboard/fisco"),
    dash("/dashboard/jobs"), dash(`/dashboard/jobs/${s.jobId}`), dash(`/dashboard/jobs/${s.jobId}/setup`),
    dash("/dashboard/assistant"), dash("/dashboard/team"), dash("/dashboard/documents"), dash("/dashboard/archive"), dash("/dashboard/notifications"),
    // APP-1i: the phone's own overlays — the public menu, the tab bar's Altro and + sheets.
    { path: "/", auth: false, name: "/ (menu)", drive: (p) => openPhoneSheet(p, ".menu-btn", "[role=dialog]") },
    { path: "/dashboard", auth: true, name: "/dashboard (Altro)", drive: (p) => openPhoneSheet(p, ".tabbar button.tabbar-link", ".more-sheet") },
    { path: "/dashboard", auth: true, name: "/dashboard (nuovo)", drive: (p) => openPhoneSheet(p, ".tb-new, .tabbar-new", "[role=dialog]") },
    // APP-8d: "Chiedi o detta…" on Oggi opens the assistant sheet.
    { path: "/dashboard", auth: true, name: "/dashboard (assistente)", drive: (p) => openPhoneSheet(p, ".asst-ask-main", ".asst-panel") },
  ];
  return list.filter((r) => ROUTE_FILTER.length === 0 || ROUTE_FILTER.some((f) => r.path.includes(f) || (r.name ?? "").includes(f)));
}

const slug = (path: string) => (path === "/" ? "home" : path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60)) || "home";

// ── Vite ─────────────────────────────────────────────────────────────────────
let vite: ChildProcess | null = null;
async function startVite(apiBase: string): Promise<string> {
  const url = `http://localhost:${VITE_PORT}`;
  // A stale server from an aborted run would answer the health check below
  // and then vanish under us — refuse to share the port.
  const busy = await fetch(url, { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
  if (busy) throw new Error(`port ${VITE_PORT} is already in use (a previous run's vite? pass --port=<n>)`);
  vite = spawn("pnpm", ["--filter", "@workspace/preventivo-ai", "exec", "vite", "--port", String(VITE_PORT), "--strictPort", "--clearScreen", "false"], {
    cwd: ROOT,
    env: { ...process.env, API_PROXY_TARGET: apiBase, PORT: String(VITE_PORT), BROWSER: "none" },
    shell: process.platform === "win32", // pnpm is a .cmd here and node refuses those without a shell
    stdio: ["ignore", "pipe", "pipe"],
  });
  vite.stderr?.on("data", (d) => process.stderr.write(`[vite] ${d}`));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return url;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`vite did not come up on ${url}`);
}
async function stopVite(): Promise<void> {
  if (!vite?.pid) return;
  const child = vite;
  vite = null;
  if (process.platform === "win32") {
    // `shell: true` means the pid is cmd.exe → pnpm → node; /T takes the tree.
    await new Promise<void>((done) => spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }).on("exit", () => done()));
  } else {
    child.kill("SIGTERM");
    await new Promise<void>((done) => child.on("exit", () => done()));
  }
}

// ── Per-page checks ──────────────────────────────────────────────────────────
type AxeNode = { target: string[]; html: string; any: Array<{ data?: Record<string, unknown> }> };
type AxeViolation = { id: string; impact: "minor" | "moderate" | "serious" | "critical" | null; help: string; helpUrl: string; nodes: AxeNode[] };
type PageResult = {
  lang: string; width: number; path: string; auth: boolean;
  title: string; screenshot: string;
  overflow: { scrollWidth: number; clientWidth: number; offenders: string[] } | null;
  /** APP-1i: phone-rule findings at ≤ PHONE_WIDTH (each one fails the run). */
  phone: PhoneFinding[];
  axe: Array<{ id: string; impact: string; help: string; count: number; targets: string[]; detail: string[] }>;
  consoleErrors: string[]; failedRequests: string[]; boundary: string | null; rawKeys: string[]; error?: string;
};

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // Lazy routes + query loaders: wait for skeletons / spinners to clear.
  await page.waitForFunction(() => !document.querySelector(".skeleton, .animate-pulse, .animate-spin, [aria-busy='true']"), null, { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth + 1) return null;
    const cw = doc.clientWidth;
    const offenders: Array<[number, string]> = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= cw + 1) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.visibility === "hidden") continue;
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      offenders.push([r.right - cw, `${el.tagName.toLowerCase()}${id}${cls}`]);
    }
    offenders.sort((a, b) => b[0] - a[0]);
    return { scrollWidth: doc.scrollWidth, clientWidth: cw, offenders: offenders.slice(0, 4).map(([px, sel]) => `${sel} (+${Math.round(px)}px)`) };
  });
}

// ── APP-1i: phone rules ──────────────────────────────────────────────────────
// What a machine can see of "calm on a phone" (QuoteAI Phase 100's rules, made
// the gate here, plus the phone gutter of QuoteAI Phase 82 and 16 px fields).
// Each finding names what it found so the fix is obvious from the report alone.
type PhoneRule = "gutter" | "stacked-buttons" | "full-width-stat" | "wide-table" | "wrapping-tabs" | "small-field" | "tall-page" | "primary-offscreen" | "under-tabbar";
type PhoneFinding = { rule: PhoneRule; detail: string };
const PHONE_WIDTH = 640;
/** Text closer than this to either edge of the glass (px). */
const GUTTER_MIN = 12;
/** App pages taller than this many phone screens fail (a route may set its own `screens`). */
const PHONE_SCREENS = 8;

async function phoneRules(page: Page, width: number, r: RouteSpec): Promise<PhoneFinding[]> {
  if (width > PHONE_WIDTH) return [];
  // tsx wraps named helpers in `__name(…)`, which the page does not have.
  await page.evaluate("globalThis.__name = globalThis.__name || function (f) { return f }").catch(() => {});
  const found = await page.evaluate(({ budget, app, gutterMin }) => {
    const out: Array<{ rule: string; detail: string }> = [];
    const cw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    // A deliberate exception: data-phone-ok="rule …" on the element or an ancestor.
    const exempt = (el: Element, rule: string) => {
      const h = el.closest("[data-phone-ok]");
      return !!h && (h.getAttribute("data-phone-ok") ?? "").split(/\s+/).includes(rule);
    };
    const label = (el: Element) => {
      const h = el as HTMLElement;
      const cls = typeof h.className === "string" && h.className ? "." + h.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      const text = (h.innerText ?? "").trim().replace(/\s+/g, " ").slice(0, 28);
      return `${el.tagName.toLowerCase()}${h.id ? `#${h.id}` : ""}${cls}${text ? ` "${text}"` : ""}`;
    };
    const shown = (el: Element) => {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) !== 0 && !el.closest("[inert], [aria-hidden='true']");
    };
    const inFixed = (el: Element) => {
      for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
        const pos = getComputedStyle(p).position;
        if (pos === "fixed" || pos === "sticky") return true;
      }
      return false;
    };
    const dialogOpen = !!document.querySelector("[role='dialog']");
    // With a sheet open the page behind it is not what is being checked.
    const inScope = (el: Element) => !dialogOpen || !!el.closest("[role='dialog']");

    // 1. Text within GUTTER_MIN px of the glass (measured on the glyphs, clipped by any box that hides the overhang).
    const range = document.createRange();
    const gut: Array<[number, string]> = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? "").join("").trim();
      if (!own || exempt(el, "gutter") || !inScope(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.position === "fixed" || Number(cs.opacity) === 0) continue;
      if (el.getBoundingClientRect().width <= 1) continue; // .sr-only
      let left = Infinity, right = -Infinity, top = Infinity;
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType !== Node.TEXT_NODE || !(n.textContent ?? "").trim()) continue;
        range.selectNodeContents(n);
        for (const b of Array.from(range.getClientRects())) {
          if (b.width === 0 || b.height === 0) continue;
          left = Math.min(left, b.left); right = Math.max(right, b.right); top = Math.min(top, b.top + window.scrollY);
        }
      }
      if (left === Infinity || top < -1000) continue;
      // A row that scrolls sideways (tabs, chips) runs to the glass on purpose: its text slides past the edge.
      let scroller = false;
      for (let p: HTMLElement | null = el; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if ((ox === "auto" || ox === "scroll") && p.scrollWidth > p.clientWidth + 1) { scroller = true; break; }
      }
      if (scroller) continue;
      for (let p: HTMLElement | null = el; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX === "visible") continue;
        const pr = p.getBoundingClientRect();
        left = Math.max(left, pr.left); right = Math.min(right, pr.right);
      }
      if (right - left <= 0 || right <= 0 || left >= cw) continue;
      const worst = Math.min(left, cw - right);
      if (worst < gutterMin) gut.push([worst, `${label(el)} ${Math.round(worst)}px`]);
    }
    gut.sort((a, b) => a[0] - b[0]);
    if (gut.length) out.push({ rule: "gutter", detail: `${gut.length} text(s) under ${gutterMin}px from the edge: ${gut.slice(0, 3).map(([, s]) => s).join(", ")}` });

    // 2. More than two full-width buttons stacked in a column (a switch row, a section toggle and a list row are rows, not actions).
    const btns = Array.from(document.querySelectorAll(".btn, button:not([role='switch']), a[role='button']"))
      .filter((b) => !(b.matches("button[aria-expanded]:not(.btn)") || b.matches("li > button:not(.btn)")))
      .filter((b) => shown(b) && inScope(b) && !inFixed(b) && !exempt(b, "stacked-buttons") && b.getBoundingClientRect().width >= cw * 0.7)
      .map((b) => ({ el: b, r: b.getBoundingClientRect() }))
      .sort((a, b) => a.r.top - b.r.top);
    let run: typeof btns = [];
    const flush = () => {
      if (run.length > 2) out.push({ rule: "stacked-buttons", detail: `${run.length} full-width buttons in a column: ${run.slice(0, 4).map((x) => label(x.el)).join(", ")}` });
      run = [];
    };
    for (const b of btns) {
      const prev = run[run.length - 1];
      if (prev && b.r.top - prev.r.bottom > 24) flush();
      if (!prev || b.r.top >= prev.r.bottom - 2) run.push(b);
    }
    flush();

    // 3. A stat card holding one number across the whole width (use a strip).
    const stats = Array.from(document.querySelectorAll(".stat-card:not(.editable)")).filter((s) => shown(s) && inScope(s) && !exempt(s, "full-width-stat") && s.getBoundingClientRect().width >= cw * 0.8);
    if (stats.length) out.push({ rule: "full-width-stat", detail: `${stats.length} full-width .stat-card: ${stats.slice(0, 3).map(label).join(", ")}` });

    // 4. A data table wider than its box (sideways scrolling for data: use rows).
    for (const t of Array.from(document.querySelectorAll("table"))) {
      if (!shown(t) || !inScope(t) || !t.parentElement || exempt(t, "wide-table")) continue;
      const box = t.parentElement.clientWidth;
      if (t.scrollWidth > box + 1) out.push({ rule: "wide-table", detail: `${label(t)} is ${t.scrollWidth}px in a ${box}px box` });
    }

    // 5. Tabs / pill rows wrapping to a second line (they scroll instead).
    for (const row of Array.from(document.querySelectorAll(".pills:not(.choices), .stabs, [role='tablist'], .seg"))) {
      if (!shown(row) || !inScope(row) || exempt(row, "wrapping-tabs")) continue;
      const tops = new Set(Array.from(row.children).filter(shown).map((c) => Math.round(c.getBoundingClientRect().top / 6)));
      if (tops.size > 1) out.push({ rule: "wrapping-tabs", detail: `${label(row)} wraps to ${tops.size} lines` });
    }

    // 6. A field under 16 px: iOS zooms the page in when it gets focus.
    const small = Array.from(document.querySelectorAll("input, select, textarea"))
      .filter((f) => !(f as HTMLInputElement).type || !["checkbox", "radio", "range", "hidden", "file", "color", "submit", "button"].includes((f as HTMLInputElement).type))
      .filter((f) => shown(f) && inScope(f) && !exempt(f, "small-field") && parseFloat(getComputedStyle(f).fontSize) < 16);
    if (small.length) out.push({ rule: "small-field", detail: `${small.length} field(s) under 16px: ${small.slice(0, 3).map((f) => `${label(f)} ${getComputedStyle(f).fontSize}`).join(", ")}` });

    // 7. App pages taller than their budget.
    const screens = document.documentElement.scrollHeight / vh;
    if (app && !dialogOpen && screens > budget) out.push({ rule: "tall-page", detail: `${screens.toFixed(1)} phone screens (budget ${budget})` });

    // 8. The page's marked primary action is neither on screen one nor docked.
    const primary = Array.from(document.querySelectorAll("[data-primary-action]")).find((p) => shown(p) && inScope(p));
    if (primary && !inFixed(primary) && !exempt(primary, "primary-offscreen") && primary.getBoundingClientRect().top + window.scrollY > vh) {
      out.push({ rule: "primary-offscreen", detail: `${label(primary)} starts ${Math.round(primary.getBoundingClientRect().top + window.scrollY)}px down` });
    }
    return out;
  }, { budget: r.screens ?? PHONE_SCREENS, app: r.auth, gutterMin: GUTTER_MIN });

  // 9. With the bottom tab bar, the end of the page must clear it.
  const covered = await page.evaluate(async () => {
    const bar = document.querySelector(".tabbar");
    if (!bar || getComputedStyle(bar).display === "none" || document.querySelector("[role='dialog']")) return null;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const top = bar.getBoundingClientRect().top;
    let bottom = 0;
    for (const el of Array.from(document.querySelectorAll("main *"))) {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (b.height === 0 || cs.position === "fixed" || cs.visibility === "hidden") continue;
      // Docked things (the action bar, sheets) sit over the page, not at its end.
      if (el.closest("[role='dialog'], .action-bar, .tabbar, [data-phone-ok~='under-tabbar']")) continue;
      bottom = Math.max(bottom, b.bottom);
    }
    window.scrollTo(0, 0);
    return bottom > top + 1 ? `content ends ${Math.round(bottom - top)}px under the tab bar` : null;
  });
  if (covered) found.push({ rule: "under-tabbar", detail: covered });
  return found as PhoneFinding[];
}

async function runAxe(page: Page): Promise<PageResult["axe"]> {
  await page.addScriptTag({ path: AXE_PATH });
  const res = await page.evaluate(async () => {
    const axe = (window as any).axe;
    const r = await axe.run(document, { resultTypes: ["violations"], rules: { "region": { enabled: false } } });
    return r.violations as AxeViolation[];
  });
  return res
    .filter((v) => v.impact === "moderate" || v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id, impact: v.impact!, help: v.help, count: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
      // color-contrast carries fg/bg/ratio; other rules a snippet of the element.
      detail: v.nodes.slice(0, 3).map((n) => {
        const d = n.any?.[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string } | undefined;
        return d?.fgColor ? `${d.fgColor} on ${d.bgColor} = ${d.contrastRatio} (need ${d.expectedContrastRatio})` : n.html.slice(0, 120);
      }),
    }));
}

async function checkPage(ctx: BrowserContext, base: string, r: RouteSpec, lang: string, width: number): Promise<PageResult> {
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("response", (res) => { if (res.status() >= 400 && res.url().includes("/api/")) failedRequests.push(`${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`); });
  await page.setViewportSize({ width, height: width <= 640 ? 812 : 800 });
  const dir = resolve(OUT, lang, String(width));
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${slug(r.name ?? r.path)}.png`);
  const result: PageResult = { lang, width, path: r.name ?? r.path, auth: r.auth, title: "", screenshot: file, overflow: null, phone: [], axe: [], consoleErrors, failedRequests, boundary: null, rawKeys: [] };
  try {
    await page.goto(`${base}${r.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settle(page);
    if (r.drive) { await r.drive(page); await settle(page); }
    result.title = await page.title();
    result.boundary = await page.evaluate(() => {
      const t = document.body.innerText;
      const m = /Qualcosa è andato storto|Impossibile raggiungere PrevAI|Something went wrong/i.exec(t);
      return m ? m[0] : null;
    });
    const tokens: string[] = await page.evaluate(() => Array.from(new Set((document.body.innerText.match(/\b[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_-]+){1,6}\b/g) ?? []))));
    result.rawKeys = tokens.filter((t) => TRANSLATION_KEYS.has(t));
    result.overflow = await overflow(page);
    result.phone = await phoneRules(page, width, r);
    if (SCREENSHOTS) await page.screenshot({ path: file, fullPage: true });
    if (RUN_AXE) result.axe = await runAxe(page);
  } catch (e) {
    result.error = (e as Error).message.slice(0, 300);
  } finally {
    await page.close();
  }
  return result;
}

// ── Report ───────────────────────────────────────────────────────────────────
function writeReport(results: PageResult[], meta: Record<string, unknown>) {
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify({ meta, results }, null, 2));
  const lines: string[] = [`# Visual + a11y sweep — ${new Date().toISOString()}`, "", "```json", JSON.stringify(meta), "```", ""];
  const sev = (r: PageResult) => r.axe.filter((a) => a.impact === "serious" || a.impact === "critical").reduce((s, a) => s + a.count, 0);
  const byPath = new Map<string, PageResult[]>();
  for (const r of results) byPath.set(r.path, [...(byPath.get(r.path) ?? []), r]);

  lines.push("## Summary", "", "| route | overflow (lang@width) | axe serious/critical | console errors | failed /api | boundary/error |", "|---|---|---|---|---|---|");
  for (const [path, rs] of byPath) {
    const ov = rs.filter((r) => r.overflow).map((r) => `${r.lang}@${r.width}`).join(", ") || "—";
    const ax = rs.reduce((s, r) => s + sev(r), 0);
    const ce = rs.reduce((s, r) => s + r.consoleErrors.length, 0);
    const fr = rs.reduce((s, r) => s + r.failedRequests.length, 0);
    const be = rs.filter((r) => r.boundary || r.error).map((r) => `${r.lang}@${r.width}: ${r.boundary ?? r.error}`).join("; ") || "—";
    lines.push(`| \`${path}\` | ${ov} | ${ax || "—"} | ${ce || "—"} | ${fr || "—"} | ${be} |`);
  }

  lines.push("", "## axe violations (moderate+), by rule", "");
  const byRule = new Map<string, { impact: string; help: string; where: string[] }>();
  for (const r of results) for (const a of r.axe) {
    const e = byRule.get(a.id) ?? { impact: a.impact, help: a.help, where: [] };
    e.where.push(`${r.path} ${r.lang}@${r.width} ×${a.count}: ${a.targets.map((t, i) => `${t} — ${a.detail[i] ?? ""}`).join(" | ")}`);
    byRule.set(a.id, e);
  }
  for (const [id, e] of [...byRule].sort((a, b) => b[1].where.length - a[1].where.length)) {
    lines.push(`### ${id} — ${e.impact} — ${e.help}`, "");
    for (const w of e.where.slice(0, 40)) lines.push(`- ${w}`);
    if (e.where.length > 40) lines.push(`- … ${e.where.length - 40} more`);
    lines.push("");
  }

  lines.push(`## Phone rules (≤ ${PHONE_WIDTH}px) — blocking (APP-1i)`, "");
  const byPhoneRule = new Map<string, string[]>();
  for (const r of results) for (const w of r.phone) byPhoneRule.set(w.rule, [...(byPhoneRule.get(w.rule) ?? []), `\`${r.path}\` ${r.lang}@${r.width}: ${w.detail}`]);
  if (!byPhoneRule.size) lines.push("None.", "");
  for (const [rule, where] of [...byPhoneRule].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${rule} (${where.length})`, "");
    for (const w of where.slice(0, 60)) lines.push(`- ${w}`);
    if (where.length > 60) lines.push(`- … ${where.length - 60} more`);
    lines.push("");
  }

  lines.push("## Overflow details", "");
  for (const r of results) if (r.overflow) lines.push(`- \`${r.path}\` ${r.lang}@${r.width}: ${r.overflow.scrollWidth}/${r.overflow.clientWidth} — ${r.overflow.offenders.join(", ")}`);
  lines.push("", "## Raw translation keys on the page", "");
  for (const r of results) if (r.rawKeys.length) lines.push(`- \`${r.path}\` ${r.lang}@${r.width}: ${r.rawKeys.join(", ")}`);
  lines.push("", "## Console errors / failed requests", "");
  for (const r of results) {
    if (!r.consoleErrors.length && !r.failedRequests.length) continue;
    lines.push(`- \`${r.path}\` ${r.lang}@${r.width}:`);
    for (const c of [...new Set(r.consoleErrors)]) lines.push(`  - console: ${c}`);
    for (const f of [...new Set(r.failedRequests)]) lines.push(`  - request: ${f}`);
  }
  writeFileSync(resolve(OUT, "report.md"), lines.join("\n") + "\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────
const mailbox = await captureResend();
const { installVendorStubs } = await import("./vendorStub.js");
installVendorStubs();
const { startServer, stopServer, createOrg, cleanupAll } = await import("./harness.js");
const { seedShowcase, setSignTokenCapture } = await import("./fixtures.js");
setSignTokenCapture(() => {
  for (let i = mailbox.length - 1; i >= 0; i--) {
    const l = mailbox[i]!.links.find((x) => x.includes("/sign/"));
    if (l) return l.split("/sign/")[1]!.split(/[/?#]/)[0]!;
  }
  return null;
});

let browser: Browser | null = null;
const t0 = Date.now();
try {
  const apiBase = await startServer();
  process.env.PREVAI_BASE_URL = `http://localhost:${VITE_PORT}`;
  const frontend = await startVite(apiBase);
  console.log(`[qa-visual] api ${apiBase} · frontend ${frontend}`);

  const org = await createOrg({ province: PROVINCE, companyName: PROVINCE === "NA" ? "Ristrutturazioni Esposito Srl" : "Ristrutturazioni Nord Srl" });
  const showcase = await seedShowcase(org, { withLogo: true, withSdi: true });
  console.log(`[qa-visual] showcase seeded for ${org.email}:`, { ...showcase, invoiceToken: "…", signToken: showcase.signToken ? "…" : null, workerToken: showcase.workerToken ? "…" : null, teamInviteToken: showcase.teamInviteToken ? "…" : null });

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  browser = await chromium.launch({ channel: process.env.QA_CHROME_PATH ? undefined : "chrome", executablePath: process.env.QA_CHROME_PATH, headless: true });
  const results: PageResult[] = [];
  const all = routes(showcase);
  for (const lang of LANGS) {
    const widths = WIDTHS_IT;
    for (const auth of [false, true]) {
      const rs = all.filter((r) => r.auth === auth);
      if (!rs.length) continue;
      const ctx = await browser.newContext({
        locale: "it-IT",
        extraHTTPHeaders: auth ? { authorization: `Bearer ${org.token}` } : {},
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      await ctx.addInitScript((l: string) => { try { localStorage.setItem("prevai-lang", l); } catch {} }, lang);
      for (const width of widths) {
        for (const r of rs) {
          const res = await checkPage(ctx, frontend, r, lang, width);
          results.push(res);
          const flags = [res.overflow && "OVERFLOW", res.phone.length && `PHONE:${[...new Set(res.phone.map((w) => w.rule))].join(",")}`,res.axe.some((a) => a.impact !== "moderate") && `AXE:${res.axe.filter((a) => a.impact !== "moderate").map((a) => a.id).join(",")}`, res.consoleErrors.length && `CONSOLE:${res.consoleErrors.length}`, res.failedRequests.length && `API:${res.failedRequests.length}`, res.boundary && `BOUNDARY:${res.boundary}`, res.rawKeys.length && `RAWKEY:${res.rawKeys.join(",")}`, res.error && `ERROR:${res.error}`].filter(Boolean);
          console.log(`${lang}@${String(width).padStart(4)} ${(r.name ?? r.path).padEnd(60)} ${flags.join(" ") || "ok"}`);
        }
      }
      await ctx.close();
    }
  }
  writeReport(results, { phoneMode: PHONE_MODE, langs: LANGS, widthsEn: WIDTHS_EN, widthsFr: WIDTHS_FR, province: PROVINCE, routes: all.length, pages: results.length, seconds: Math.round((Date.now() - t0) / 1000) });
  const serious = results.reduce((s, r) => s + r.axe.filter((a) => a.impact !== "moderate").reduce((x, a) => x + a.count, 0), 0);
  const overflows = results.filter((r) => r.overflow).length;
  const rawKeyPages = results.filter((r) => r.rawKeys.length).length;
  // APP-1i: the phone gate — sideways scroll or any phone rule at ≤ PHONE_WIDTH, or a page that did not load there.
  const phoneFailed = results.filter((r) => r.width <= PHONE_WIDTH && (r.overflow || r.phone.length || r.error || r.boundary));
  console.log(`\n[qa-visual] ${results.length} pages in ${Math.round((Date.now() - t0) / 1000)}s — overflow on ${overflows}, axe serious/critical nodes ${serious}, raw i18n keys on ${rawKeyPages}, phone gate failed on ${phoneFailed.length} → ${resolve(OUT, "report.md")}`);
  if (phoneFailed.length) process.exitCode = 1;
  if (KEEP) {
    console.log(`[qa-visual] --keep: account ${org.email} left in place; bearer ${org.token}; frontend ${frontend} (API ${apiBase}). Ctrl-C to stop.`);
    await new Promise(() => {});
  }
} finally {
  await browser?.close().catch(() => {});
  if (!KEEP) {
    await cleanupAll().catch((e) => console.error("[qa-visual] cleanup failed", e));
    await stopVite();
    await stopServer();
  }
}
process.exit(typeof process.exitCode === "number" ? process.exitCode : 0);
