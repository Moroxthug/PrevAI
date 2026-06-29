// Ensure Vercel includes these packages that app.mjs loads via dynamic require()
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
_require("pdfmake");

let app;
try {
  const mod = await import("../artifacts/api-server/dist/app.mjs");
  app = mod.default;
} catch (err) {
  app = (_req, res) => {
    res.status(500).json({ error: "Startup failed", detail: err?.message ?? String(err) });
  };
}

export default app;
