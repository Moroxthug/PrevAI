// Fase 17 (docs/PIANO-AZIONE.md): il widget gira sui siti delle imprese e
// chiama /api/public/* da un'altra origine. Se l'host che chiama viene
// rediretto (oggi www.prevai.it → prevai.it, 308), il preflight CORS riceve
// un redirect senza Access-Control-Allow-Origin e il browser blocca tutto:
// la configurazione non si carica e il lead ricade sulla stima locale senza
// mai arrivare all'impresa. Nessun test interno lo vede (stessa origine, curl
// senza Origin) — per questo il widget deve puntare all'host canonico, lo
// stesso di MARKET.siteUrl, e mai a un host che redirige.
//
// Il file è un artefatto già compilato (il sorgente è rimasto in v1, in
// artifacts/mockup-sandbox): si corregge a mano e questo test lo controlla.
// Pinna anche i redirect ereditati da v1 che Google ha ancora in coda.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { MARKET } from "@workspace/config";

const ROOT = resolve(__dirname, "../../..");
const WIDGET_JS = join(ROOT, "artifacts/preventivo-ai/public/widget.js");
const VERCEL_JSON = join(ROOT, "vercel.json");

type Redirect = { source: string; destination: string; permanent?: boolean };

describe("host canonico", () => {
  test("il widget chiama l'API sull'host canonico, senza redirect in mezzo", () => {
    const js = readFileSync(WIDGET_JS, "utf8");
    const hosts = [...js.matchAll(/https:\/\/(?:www\.)?prevai\.it/g)].map((m) => m[0]);
    expect(hosts.length).toBeGreaterThan(0);
    expect(new Set(hosts)).toEqual(new Set([MARKET.siteUrl]));
    expect(js).toMatch(new RegExp(`apiBaseUrl:[\\w$]+="${MARKET.siteUrl.replace(/\./g, "\\.")}"`));
  });

  test("i vecchi URL /seo/* di v1 portano a /preventivi/*, prima della barra finale", () => {
    const cfg = JSON.parse(readFileSync(VERCEL_JSON, "utf8")) as { redirects?: Redirect[] };
    const redirects = cfg.redirects ?? [];
    const seo = redirects.findIndex((r) => r.source === "/seo/(.*)");
    expect(seo).toBeGreaterThanOrEqual(0);
    expect(redirects[seo]).toMatchObject({ destination: "/preventivi/$1", permanent: true });
    const slash = redirects.findIndex((r) => r.destination === "/$1/");
    expect(seo).toBeLessThan(slash);
  });
});
