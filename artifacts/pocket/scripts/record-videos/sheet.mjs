// node sheet.mjs <video> [n] — a contact sheet (sheet-<video>.png) of n frames taken by Chrome's own <video> from out/<video>.mp4.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// playwright-core and pg come from the API server's install (this app has its own flat npm install without them).
const require = createRequire(new URL("../../../api-server/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url));
const [id, nArg = "12"] = process.argv.slice(2);
const n = Number(nArg);
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1280, height: 400 } });
await p.route("https://rec.test/**", (r) => {
  const u = new URL(r.request().url());
  if (u.pathname === "/") return r.fulfill({ contentType: "text/html", body: `<body style="margin:0;background:#222"><video id=v muted></video><div id=g style="display:grid;grid-template-columns:repeat(3,420px);gap:6px;padding:6px"></div></body>` });
  return r.fulfill({ contentType: "video/mp4", body: readFileSync(join(HERE, "out", `${id}.mp4`)) });
});
await p.goto("https://rec.test/");
const info = await p.evaluate(async (n) => {
  const v = document.getElementById("v");
  v.src = URL.createObjectURL(await (await fetch("/v.mp4")).blob());
  await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener("loadedmetadata", r, { once: true })));
  const d = v.duration;
  for (let i = 0; i < n; i++) {
    const t = (d * (i + 0.5)) / n;
    v.currentTime = t;
    await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
    const c = document.createElement("canvas"); c.width = 420; c.height = 255;
    c.getContext("2d").drawImage(v, 0, 0, 420, 255);
    const w = document.createElement("div"); w.style.cssText = "color:#fff;font:12px sans-serif";
    w.append(c, document.createTextNode(` t=${t.toFixed(1)}s`));
    document.getElementById("g").append(w);
  }
  return { d, w: v.videoWidth, h: v.videoHeight };
}, n);
console.log(JSON.stringify(info));
await p.setViewportSize({ width: 1280, height: Math.ceil(n / 3) * 280 + 20 });
await p.screenshot({ path: join(HERE, `sheet-${id}.png`), fullPage: true });
await b.close();
