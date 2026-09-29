// SEO-1 (riga 47, docs/PIANO-AZIONE.md): vercel.json manda a index.html solo
// le rotte dell'app; tutto ciò che non è un file prerenderizzato e non è una
// rotta riceve 404.html con stato 404 (prima: la home con 200 = soft 404).
// Il rischio è il contrario: una rotta nuova in App.tsx dimenticata qui
// risponderebbe 404 in produzione. Questo test legge ogni <Route path="…">
// di App.tsx e controlla che un redirect o un rewrite di vercel.json la copra
// (le pagine prerenderizzate — PATHS.*, /preventivi, /blog, /help — le serve
// il filesystem prima dei rewrite). Le sorgenti di vercel.json qui sono regex
// semplici (nessun :param), quindi valgono anche come RegExp JavaScript.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = resolve(__dirname, "../../..");
const cfg = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
  redirects: { source: string; destination: string }[];
  rewrites: { source: string; destination: string }[];
};
const APP = readFileSync(join(ROOT, "artifacts/preventivo-ai/src/App.tsx"), "utf8");

const asRegex = (source: string) => new RegExp(`^${source}$`);
const slashRedirect = cfg.redirects.find((r) => r.destination === "/$1/")!;
const redirects = cfg.redirects.filter((r) => r !== slashRedirect).map((r) => asRegex(r.source));
const spaRewrites = cfg.rewrites.filter((r) => r.destination === "/index.html").map((r) => asRegex(r.source));
const PRERENDERED = /^\/(?:preventivi|blog|help)\//;

/** L'indirizzo come arriva ai rewrite: parametri riempiti e barra finale aggiunta dal redirect. */
function concrete(routePath: string, param: string): string {
  const filled = routePath.replace(/:\w+\*/g, "x").replace(/:\w+/g, param);
  return asRegex(slashRedirect.source).test(filled) ? `${filled}/` : filled;
}

function servedBy(path: string): "redirect" | "spa" | "static" | "404" {
  if (redirects.some((re) => re.test(path))) return "redirect";
  if (spaRewrites.some((re) => re.test(path))) return "spa";
  if (PRERENDERED.test(path)) return "static";
  return "404";
}

describe("404 veri (vercel.json)", () => {
  const routes = [...APP.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]!);

  test("App.tsx ha rotte letterali da controllare", () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  test.each(routes)("la rotta %s non risponde 404", (route) => {
    // Un token di link pubblico (/p/<id>.<firma>) contiene un punto: niente barra finale.
    for (const param of ["abc123", "abc123.sig"]) {
      expect(servedBy(concrete(route, param)), concrete(route, param)).not.toBe("404");
    }
  });

  test.each([
    "/pagina-inesistente-xyz/",
    "/dashboardx/",
    "/p/",
    "/p/a/b/",
    "/admin/",
    "/fr/",
    "/wp-login.php",
  ])("%s non è una rotta dell'app", (path) => {
    expect(servedBy(path)).not.toBe("spa");
    expect(redirects.some((re) => re.test(path))).toBe(false);
  });

  test("nessun rewrite generico verso index.html", () => {
    for (const re of spaRewrites) expect(re.test("/qualsiasi-cosa/")).toBe(false);
  });
});
