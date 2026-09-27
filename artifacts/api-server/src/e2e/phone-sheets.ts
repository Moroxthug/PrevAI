// APP-1i — phone contact sheets (QuoteAI Phase 100's qa:phone-sheets, redone).
//
// A full-page phone screenshot is a 6,000 px ribbon nobody reads. This cuts
// each one into phone-sized frames (what a phone shows at once) and lays the
// first few side by side, one row per phone width (360 / 390 / 430), so "what
// does a builder see on the first three screens, on each phone" is one glance.
// Given a baseline run it adds that run's row above each width, for before/after.
//
// No image library: the sheet is an HTML page of CSS-cropped frames that the
// installed Chrome screenshots (same playwright-core channel as qa:visual).
//
//   pnpm --filter @workspace/api-server qa:phone                          # writes .qa/phone/it/<width>/*.png
//   pnpm --filter @workspace/api-server qa:phone-sheets                   # → .qa/phone-sheets/phone/<route>.png + index.html
//   pnpm --filter @workspace/api-server qa:phone-sheets -- --from=phone --baseline=phone-1 --routes=dashboard-quotes --frames=4
//
// Reads  .qa/<from>/<lang>/<width>/*.png   (qa:visual's layout)
// Writes .qa/phone-sheets/<from>/<route>.png + index.html (open it on a phone).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { chromium } from "playwright-core";

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1]!, m[2] ?? "true");
}
const QA = resolve(import.meta.dirname, "../../.qa");
const FROM = args.get("from") ?? "phone";
const LANG = args.get("lang") ?? "it";
const WIDTHS = (args.get("widths") ?? "360,390,430").split(",").map(Number);
/** Viewport height qa:visual used at phone widths (one frame = one screen). */
const FRAME_H = Number(args.get("frame") ?? 812);
const FRAMES = Number(args.get("frames") ?? 3);
const BASELINE = args.get("baseline");
const FILTER = (args.get("routes") ?? "").split(",").filter(Boolean);
const OUT = resolve(QA, "phone-sheets", args.get("out") ?? FROM);

const dirOf = (run: string, w: number) => resolve(QA, run, LANG, String(w));
const widths = WIDTHS.filter((w) => existsSync(dirOf(FROM, w)));
if (!widths.length) {
  console.error(`[phone-sheets] no screenshots under ${resolve(QA, FROM, LANG)} for ${WIDTHS.join("/")} px — run qa:phone (or qa:visual --widths=… --out=${FROM}) first`);
  process.exit(1);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** PNG height from the IHDR chunk (bytes 20–23), so no image library is needed. */
const pngSize = (buf: Buffer) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

type Row = { label: string; uri: string; w: number; h: number };
function row(label: string, file: string): Row {
  const buf = readFileSync(file);
  return { label, uri: `data:image/png;base64,${buf.toString("base64")}`, ...pngSize(buf) };
}

function sheetHtml(name: string, rows: Row[]) {
  const frame = (r: Row, i: number) =>
    i * FRAME_H < r.h
      ? `<div class="f" style="width:${r.w}px;height:${FRAME_H}px;background-image:url(${r.uri});background-position:0 -${i * FRAME_H}px"></div>`
      : `<div class="end" style="width:${r.w}px">(fine pagina)</div>`;
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:20px;background:#fff;font:600 15px/1.3 "Segoe UI",Arial,sans-serif;color:#101031;width:max-content}
h1{font-size:17px;margin:0 0 14px}.r{margin-bottom:24px}.l{margin-bottom:8px}.fs{display:flex;gap:24px;align-items:flex-start}
.f{border:1px solid #dfe1e6;background-color:#f4f5f7;background-repeat:no-repeat}.end{color:#6d6f76;font-weight:600;padding-top:12px}
</style><h1>${esc(name)}</h1>${rows.map((r) => `<div class="r"><div class="l">${esc(r.label)} — ${(r.h / FRAME_H).toFixed(1)} schermate</div><div class="fs">${Array.from({ length: FRAMES }, (_, i) => frame(r, i)).join("")}</div></div>`).join("")}`;
}

mkdirSync(OUT, { recursive: true });
const names = [...new Set(widths.flatMap((w) => readdirSync(dirOf(FROM, w)).filter((f) => f.endsWith(".png"))))]
  .filter((f) => FILTER.length === 0 || FILTER.some((x) => f.includes(x)))
  .sort();

const browser = await chromium.launch({ channel: process.env.QA_CHROME_PATH ? undefined : "chrome", executablePath: process.env.QA_CHROME_PATH, headless: true });
const made: Array<{ name: string; screens: string }> = [];
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const f of names) {
    const name = basename(f, ".png");
    const rows: Row[] = [];
    for (const w of widths) {
      const before = BASELINE ? resolve(dirOf(BASELINE, w), f) : null;
      if (before && existsSync(before)) rows.push(row(`${w} px · prima (${BASELINE})`, before));
      const after = resolve(dirOf(FROM, w), f);
      if (existsSync(after)) rows.push(row(`${w} px${before && existsSync(before) ? ` · dopo (${FROM})` : ""}`, after));
    }
    if (!rows.length) continue;
    await page.setContent(sheetHtml(name, rows));
    await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: true });
    const screens = rows.map((r) => (r.h / FRAME_H).toFixed(1)).join(" / ");
    made.push({ name, screens });
    console.log(`${name.padEnd(64)} ${screens} schermate`);
  }
} finally {
  await browser.close();
}

// One page to flick through on a phone: every sheet with its height per width.
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fogli telefono — ${esc(FROM)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:16px;color:#101031}h1{font-size:20px}figure{margin:0 0 28px}figcaption{font-weight:700;margin-bottom:6px}img{max-width:100%;border:1px solid #dfe1e6;border-radius:8px}</style>
<h1>Fogli telefono — ${esc(FROM)} (${widths.join(" / ")} px, prime ${FRAMES} schermate)</h1>
${made.map((m) => `<figure><figcaption>${esc(m.name)} — ${m.screens} schermate</figcaption><img src="${encodeURIComponent(m.name)}.png" loading="lazy" alt=""></figure>`).join("\n")}
`;
writeFileSync(resolve(OUT, "index.html"), html);
console.log(`\n[phone-sheets] ${made.length} fogli → ${OUT}`);
