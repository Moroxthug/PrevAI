// POCKET-7 (docs/VIDEO.md). node record.mjs <video> [--dry] — records one POCKET-7 video from the Expo web app (staging, demo company) into out/<video>.mp4 + .jpg + .json.
// Pipeline: CDP screencast of a 390×844 phone page at 3× → JPEG frames on disk with timestamps; the flow script sets a "camera" (a rect of the page
// in CSS px, 1280:776) and marks chapters, taps and speed-ups; then a second page composes each output frame (crop + tap ripple) and encodes
// H.264 with WebCodecs into an MP4 (mp4-muxer). --dry runs the flow and saves a screenshot per step instead.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// playwright-core and pg come from the API server's install (this app has its own flat npm install without them).
const require = createRequire(new URL("../../../api-server/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url));
const [videoId, ...flags] = process.argv.slice(2);
const DRY = flags.includes("--dry");
const { FLOWS } = await import("./flows.mjs");
const flow = FLOWS[videoId];
if (!flow) throw new Error(`unknown video ${videoId}; known: ${Object.keys(FLOWS).join(", ")}`);

const W = 1280, H = 776, FPS = 30, DPR = 3, VW = 390, VH = 844, ASPECT = W / H;
const token = readFileSync(join(HERE, "token.txt"), "utf8").trim();
const framesDir = join(HERE, "frames", videoId);
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(join(HERE, "out"), { recursive: true });

// Headful, off-screen: headless screencast frames come at CSS size (390 wide); headful gives ~2.5×.
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-position=-3000,0"] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, locale: "it-IT", timezoneId: "Europe/Rome", hasTouch: false });
await ctx.addInitScript((t) => { try { localStorage.setItem("prevai_session-token", t); } catch {}
  // No spell-check squiggles in the videos.
  const off = () => document.querySelectorAll("textarea,input,[contenteditable]").forEach((e) => e.setAttribute("spellcheck", "false"));
  new MutationObserver(off).observe(document, { childList: true, subtree: true });
}, token);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

// ── Timeline (seconds, wall clock) ──
const now = () => Date.now() / 1000;
const frames = []; // { t, file }
const cams = []; // { t, x, y, w } (h = w / ASPECT)
const marks = []; // { t, chapter }
const taps = []; // { t, x, y }
const speeds = []; // { t, f }
let started = 0;
let stepN = 0;

const clampCam = ({ x, y, w }) => {
  const h = w / ASPECT;
  // Wider than the phone: centre it; else keep inside the page.
  const cx = w >= VW ? (VW - w) / 2 : Math.max(0, Math.min(VW - w, x));
  const cy = h >= VH ? (VH - h) / 2 : Math.max(0, Math.min(VH - h, y));
  return { x: cx, y: cy, w };
};

const api = {
  dry: DRY,
  page,
  /** Camera on a rect (CSS px): {x,y,w} or a locator to frame (with padding); `w` defaults to the phone's width. */
  async cam(target, opts = {}) {
    let r;
    if (target && typeof target.boundingBox === "function") {
      const b = await target.boundingBox();
      if (!b) throw new Error("cam: locator not visible");
      const w = opts.w ?? VW;
      const h = w / ASPECT;
      r = { x: b.x + b.width / 2 - w / 2, y: b.y + b.height / 2 - h / 2 + (opts.dy ?? 0), w };
    } else r = { x: 0, y: 0, w: VW, ...target };
    cams.push({ t: now(), ...clampCam(r), ease: opts.ease ?? 0.7 });
  },
  /** The whole phone, small, in the middle. */
  async wide() { cams.push({ t: now(), ...clampCam({ x: 0, y: 0, w: VH * ASPECT }), ease: 0.8 }); },
  chapter(n) { marks.push({ t: now(), chapter: n }); },
  speed(f) { speeds.push({ t: now(), f }); },
  wait: (ms) => page.waitForTimeout(ms),
  async tap(locator, opts = {}) {
    locator = locator.filter({ visible: true }).first();
    await locator.waitFor({ state: "visible", timeout: opts.timeout ?? 20000 });
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const b = await locator.boundingBox();
    if (opts.follow !== false) await api.cam(locator, { w: opts.w });
    await page.waitForTimeout(opts.before ?? 700);
    taps.push({ t: now(), x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await page.waitForTimeout(120);
    await locator.click({ timeout: 10000 });
    await page.waitForTimeout(opts.after ?? 600);
    if (DRY) await shot();
  },
  async type(locator, text, opts = {}) {
    locator = locator.filter({ visible: true }).first();
    await locator.click();
    await page.keyboard.type(text, { delay: opts.delay ?? 45 });
    if (DRY) await shot();
  },
  async scroll(dy, opts = {}) {
    await page.mouse.move(VW / 2, VH / 2);
    const steps = Math.max(1, Math.round(Math.abs(dy) / 40));
    for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await page.waitForTimeout(opts.stepMs ?? 30); }
    await page.waitForTimeout(400);
    if (DRY) await shot();
  },
  shot: () => shot(),
};
async function shot() {
  stepN++;
  await page.screenshot({ path: join(HERE, "frames", videoId, `dry-${String(stepN).padStart(2, "0")}.png`) });
}

// ── Record ──
const cdp = await ctx.newCDPSession(page);
let fi = 0;
cdp.on("Page.screencastFrame", async (f) => {
  const file = `${String(fi++).padStart(5, "0")}.jpg`;
  writeFileSync(join(framesDir, file), Buffer.from(f.data, "base64"));
  frames.push({ t: now(), file, cdpT: f.metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});

await flow.setup?.(api);
if (!DRY) await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: VW * DPR, maxHeight: VH * DPR, everyNthFrame: 1 });
await page.waitForTimeout(300);
started = now();
cams.unshift({ t: started, ...clampCam(flow.start ?? { x: 0, y: 0, w: VW }), ease: 0 });
speeds.unshift({ t: started, f: 1 });
await flow.run(api);
const ended = now();
if (!DRY) await cdp.send("Page.stopScreencast");
await page.waitForTimeout(300);
if (DRY) { await shot(); await browser.close(); console.log("dry run: screenshots in", framesDir); process.exit(0); }

// ── Output timeline: source time → output time with the speed-ups ──
const segs = speeds.map((s, i) => ({ a: s.t, b: i + 1 < speeds.length ? speeds[i + 1].t : ended, f: s.f }));
const outOf = (t) => { let o = 0; for (const s of segs) { if (t <= s.a) break; o += (Math.min(t, s.b) - s.a) / s.f; } return o; };
const total = outOf(ended);
const srcOf = (o) => { let acc = 0; for (const s of segs) { const d = (s.b - s.a) / s.f; if (o <= acc + d) return s.a + (o - acc) * s.f; acc += d; } return ended; };
const chapters = [0, ...marks.filter((m) => m.chapter > 0).sort((a, b) => a.chapter - b.chapter).map((m) => Math.round(outOf(m.t)))];
const timeline = {
  total, frames: frames.map((f) => ({ t: f.t, file: f.file })),
  cams, taps, srcOf: null,
};

// ── Compose + encode in Chrome ──
// The UMD build (defines the global Mp4Muxer), loaded into the encoding page.
const muxer = readFileSync(createRequire(import.meta.url).resolve("mp4-muxer"), "utf8");
const enc = await ctx.newPage();
await enc.route("https://rec.test/**", (r) => {
  const u = new URL(r.request().url());
  if (u.pathname === "/") return r.fulfill({ contentType: "text/html", body: "<html><body></body></html>" });
  const name = u.pathname.slice(1);
  return r.fulfill({ contentType: "image/jpeg", body: readFileSync(join(framesDir, name)) });
});
await enc.goto("https://rec.test/");
await enc.addScriptTag({ content: muxer });
const nOut = Math.ceil(total * FPS);
const outTimes = Array.from({ length: nOut }, (_, i) => srcOf(i / FPS));
const posterAt = srcOf(Math.min(total - 0.1, flow.posterAt ?? total * 0.4));
const res = await enc.evaluate(async ({ W, H, FPS, DPR, timeline, outTimes, posterAt, bg }) => {
  const cv = new OffscreenCanvas(W, H); const g = cv.getContext("2d");
  const frames = timeline.frames;
  const bitmaps = new Map();
  const load = async (file) => { if (!bitmaps.has(file)) { for (const k of bitmaps.keys()) if (bitmaps.size > 2) { bitmaps.get(k).close(); bitmaps.delete(k); } bitmaps.set(file, await createImageBitmap(await (await fetch(`https://rec.test/${file}`)).blob())); } return bitmaps.get(file); };
  const frameAt = (t) => { let lo = 0, hi = frames.length - 1, r = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (frames[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; } return frames[r]; };
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  // Each camera key eases from where the camera was when it started (the previous move may not have finished).
  const camAt = (t) => {
    let i = 0; for (let k = 0; k < timeline.cams.length; k++) if (timeline.cams[k].t <= t) i = k;
    const c = timeline.cams[i]; const p = c.from;
    if (!p || !c.ease) return c;
    const e = ease(Math.min(1, (t - c.t) / c.ease));
    return { x: p.x + (c.x - p.x) * e, y: p.y + (c.y - p.y) * e, w: p.w + (c.w - p.w) * e };
  };
  for (let k = 1; k < timeline.cams.length; k++) timeline.cams[k].from = camAt(timeline.cams[k].t - 1e-6);
  const draw = async (t) => {
    const f = frameAt(t); const bmp = await load(f.file); const cam = camAt(t);
    const s = W / cam.w; // output px per CSS px
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(-cam.x * s, -cam.y * s); const k = (s * 390) / bmp.width; g.scale(k, k);
    g.drawImage(bmp, 0, 0);
    g.restore();
    if (cam.w > 391) { // the phone's edge when zoomed out
      g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 2; g.beginPath(); g.roundRect(-cam.x * s, -cam.y * s, 390 * s, 844 * s, 36 * s / 1); g.stroke();
    }
    for (const tp of timeline.taps) {
      const age = t - tp.t; if (age < -0.12 || age > 0.55) continue;
      const k = Math.max(0, age + 0.12) / 0.67;
      const x = (tp.x - cam.x) * s, y = (tp.y - cam.y) * s;
      g.beginPath(); g.arc(x, y, (18 + 26 * k) * s / 2.2, 0, Math.PI * 2);
      g.fillStyle = `rgba(139,92,246,${0.38 * (1 - k)})`; g.fill();
      g.lineWidth = 3; g.strokeStyle = `rgba(255,255,255,${0.85 * (1 - k)})`; g.stroke();
    }
  };
  const m = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: "avc", width: W, height: H, frameRate: FPS }, fastStart: "in-memory" });
  const encoder = new VideoEncoder({ output: (c, meta) => m.addVideoChunk(c, meta), error: (e) => { throw e; } });
  encoder.configure({ codec: "avc1.640028", width: W, height: H, bitrate: 1_100_000, framerate: FPS, latencyMode: "quality" });
  for (let i = 0; i < outTimes.length; i++) {
    await draw(outTimes[i]);
    const vf = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    encoder.encode(vf, { keyFrame: i % (FPS * 2) === 0 }); vf.close();
    if (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
  }
  await encoder.flush(); m.finalize();
  await draw(posterAt);
  const poster = new Uint8Array(await (await cv.convertToBlob({ type: "image/jpeg", quality: 0.82 })).arrayBuffer());
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  return { mp4: b64(new Uint8Array(m.target.buffer)), jpg: b64(poster) };
}, { W, H, FPS, DPR, timeline, outTimes, posterAt, bg: "#141418" });

writeFileSync(join(HERE, "out", `${videoId}.mp4`), Buffer.from(res.mp4, "base64"));
writeFileSync(join(HERE, "out", `${videoId}.jpg`), Buffer.from(res.jpg, "base64"));
const meta = { id: videoId, secs: Math.round(total), at: chapters, frames: frames.length };
writeFileSync(join(HERE, "out", `${videoId}.json`), JSON.stringify(meta));
console.log(JSON.stringify(meta), `${Math.round(Buffer.from(res.mp4, "base64").length / 1024)} KB`);
await browser.close();
