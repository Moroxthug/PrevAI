// Phase 68: build-time rendering of the React-owned public pages.
//
// Built with `vite build --ssr src/entry-server.tsx --outDir dist/server` and
// called by scripts/prerender-seo.ts for "/", "/fr" and the six static pages
// (about, contact, privacy, terms, WhatsApp, sitemap). The markup goes into
// <div id="root"> of each page's index.html and main.tsx hydrates it, so the
// hero (the LCP element) paints from the HTML instead of after ~230 kB of
// JavaScript has downloaded and run, and the crawler sees the same DOM the
// user gets (the hand-written bodies this replaced had drifted to the
// pre-redesign layout). The sector/blog pages keep their hand-built static
// bodies and are not hydrated; everything else stays an SPA shell.
//
// `prerender` (react-dom/static) waits for every lazy route chunk before
// resolving, so the lazy pages render in full; hydrateRoot then attaches to
// the Suspense boundaries as their chunks arrive in the browser.
import { StrictMode } from "react";
import ReactDOMStatic from "react-dom/static";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import type { Lang } from "./i18n/translations";
import { HELP_ARTICLES } from "./data/help-articles";

/** Routes rendered at build time. Keep in sync with SSR_PAGE_RE in main.tsx. */
export const SSR_PAGES: ReadonlyArray<{ path: string; lang: Lang }> = [
  { path: "/", lang: "it" },
  { path: "/whatsapp", lang: "it" },
  { path: "/chi-siamo", lang: "it" },
  { path: "/contatti", lang: "it" },
  { path: "/privacy-policy", lang: "it" },
  { path: "/terms", lang: "it" },
  { path: "/mappa-sito", lang: "it" },
  // Phase 70: help centre index + every article.
  { path: "/help", lang: "it" },
  ...HELP_ARTICLES.map((a) => ({ path: `/help/${a.slug}`, lang: "it" as const })),
];

export async function renderPage(path: string, lang: Lang): Promise<string> {
  // CommonJS package, Node build: `prerenderToNodeStream` (the web-stream
  // `prerender` only exists in the browser/edge builds) and no named exports.
  const { prelude } = await ReactDOMStatic.prerenderToNodeStream(
    <StrictMode>
      <HelmetProvider context={{}}>
        <App ssr={{ path, lang }} />
      </HelmetProvider>
    </StrictMode>,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
