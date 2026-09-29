import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { SeoNavShell } from "./components/seo-header.tsx";
import "./index.css";
import { initAnalytics } from "./lib/analytics.ts";
import { initErrorTracking } from "./lib/error-tracking.ts";
import { initPwa } from "./lib/pwa.ts";

initErrorTracking();
initAnalytics();
// APP-2: service worker + install prompt capture, before React so the early
// beforeinstallprompt event is not missed.
initPwa();

// Statically prerendered pages (hand-built bodies in scripts/prerender-seo.ts):
// sector + city landing pages under /preventivi/ and the blog. V2-6: the
// regex still matched the QuoteAI paths (/quotes/…, /fr/soumissions/…), so the
// Italian landing pages got the whole App rendered over them (CLS 0.82 on
// the city pages).
const STATIC_SEO_RE = /^\/(?:preventivi\/[^/]+(?:\/[^/]+)?|blog(?:\/.*)?)\/?$/;
// Pages rendered at build time by entry-server.tsx (keep in sync with SSR_PAGES there).
const SSR_PAGE_RE = /^\/(?:whatsapp|chi-siamo|contatti|privacy|termini|mappa-sito|fisco|help(?:\/[a-z0-9-]+)?)?\/?$/;

const rootEl = document.getElementById("root")!;
const pathname = window.location.pathname;
// SEO-1: 404.html (vercel.json) carries the React NotFound; the App re-renders it.
const hasPrerendered = rootEl.children.length > 0 && !("notFound" in rootEl.dataset);

if (STATIC_SEO_RE.test(pathname) && hasPrerendered) {
  // Static page: the body is not React-rendered, so it is not hydrated (a
  // mismatch would blank it). Only the header becomes interactive: the
  // session-aware SeoNavShell is mounted INTO the static <header>, replacing
  // identical markup, so nothing moves (Phase 68 — it used to be inserted as
  // a second, Italian-labelled header above the page; /fr/soumissions pages
  // were not matched at all and got the whole App re-rendered over them,
  // CLS 0.79).
  // The site header (sticky, from wrapInPublicLayout) — not an article <header>.
  const staticHeader = rootEl.querySelector<HTMLElement>("header.sticky");
  const lang = "it" as const;
  if (staticHeader) {
    const mount = document.createElement("div");
    mount.className = "contents";
    staticHeader.before(mount);
    createRoot(mount).render(<SeoNavShell lang={lang} replaces={staticHeader} />);
  }
} else {
  // Everything React-rendered loads the App chunk on demand: the static SEO
  // pages above never pay for it (it is ~2/3 of the entry's JavaScript).
  const hydrate = SSR_PAGE_RE.test(pathname) && hasPrerendered;
  // react-helmet-async comes with the App (PERF-1): the static pages above never need it.
  const start = () => void Promise.all([import("./App.tsx"), import("react-helmet-async")]).then(([{ default: App }, { HelmetProvider }]) => {
    const tree = (
      <StrictMode>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </StrictMode>
    );
    if (hydrate) {
      // "/" and the static public pages: server-rendered at build time
      // (Phase 68) — hydrate so the hero paints from the HTML and nothing
      // shifts. On a mismatch React 19 re-renders the tree client-side, so
      // the worst case is a console warning, never a blank page.
      hydrateRoot(rootEl, tree);
    } else {
      createRoot(rootEl).render(tree);
    }
  });
  if (hydrate) {
    // PERF-1: the build-time-rendered pages already show everything from the
    // HTML (links are plain <a>), so the ~190 kB of App JavaScript waits for
    // the page's own load instead of competing with the CSS, the font and
    // the hero. They used to modulepreload it in <head>: Lighthouse counted
    // it before the LCP (home 78, /whatsapp 75). And it waits for an idle
    // moment after load: started right at load, evaluating the App and
    // hydrating ran before the first frame and held the first paint ~0.9 s.
    // The app shell (app.html) and 404.html still preload it: there nothing
    // shows until React renders.
    const whenIdle = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 2000 }) : setTimeout(start, 200));
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });
  } else {
    start();
  }
}
