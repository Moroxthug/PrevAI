// POCKET-7 (docs/VIDEO.md), node staging.mjs — the staging pair the recorder drives: API v2 from dist on 5080 (staging DB, dev Groq key only) + Expo web on 8104 with /api proxied through Metro.
// The site's public/video is served on 8105 (with Range: the player seeks); EXPO_PUBLIC_VIDEO_BASE points the app at it.
import { spawn } from "node:child_process";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url)).replace(/[\\/]$/, "");
const parse = (f) => Object.fromEntries(readFileSync(f, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const staging = parse(`${REPO}/.env.staging`);
const dev = parse(`${REPO}/.env`);
const apiEnv = { ...process.env, ...staging, PORT: "5080", GROQ_API_KEY: dev.GROQ_API_KEY ?? "", RATE_LIMIT_STORE: "memory", NODE_ENV: "development" };
delete apiEnv.AI_INTEGRATIONS_OPENAI_API_KEY; delete apiEnv.AI_INTEGRATIONS_OPENAI_BASE_URL;
const api = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], { cwd: `${REPO}/artifacts/api-server`, env: apiEnv, stdio: "inherit" });

const VIDEO_DIR = `${REPO}/artifacts/preventivo-ai/public/video`;
createServer((req, res) => {
  const name = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");
  if (!/^[a-z0-9-]+\.(mp4|jpg|vtt)$/.test(name)) { res.writeHead(404).end(); return; }
  const file = `${VIDEO_DIR}/${name}`;
  let size; try { size = statSync(file).size; } catch { res.writeHead(404).end(); return; }
  const type = name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".jpg") ? "image/jpeg" : "text/vtt";
  const head = { "content-type": type, "accept-ranges": "bytes", "access-control-allow-origin": "*", "cache-control": "no-store" };
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (m) {
    const start = m[1] ? Number(m[1]) : 0; const end = m[2] ? Number(m[2]) : size - 1;
    res.writeHead(206, { ...head, "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
  } else { res.writeHead(200, { ...head, "content-length": size }); createReadStream(file).pipe(res); }
}).listen(8105, "127.0.0.1");

const webEnv = { ...process.env, API_PROXY_TARGET: "http://127.0.0.1:5080", EXPO_PUBLIC_API_ORIGIN: "http://localhost:8104", EXPO_PUBLIC_VIDEO_BASE: process.env.EXPO_PUBLIC_VIDEO_BASE ?? "http://127.0.0.1:8105/", POCKET_DRIVE: "Q:" };
const web = spawn(process.execPath, [`${REPO}/artifacts/pocket/scripts/dev-web.mjs`, "8104"], { cwd: `${REPO}/artifacts/pocket`, env: webEnv, stdio: "inherit" });

const stop = () => { api.kill(); web.kill(); process.exit(0); };
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, stop);
api.on("exit", (c) => { console.error("api exited", c); });
web.on("exit", (c) => { console.error("web exited", c); stop(); });
