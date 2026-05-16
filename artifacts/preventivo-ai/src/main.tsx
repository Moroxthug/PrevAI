import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { SeoNavShell } from "./components/seo-header.tsx";
import "./index.css";

const SEO_CITY_RE = /^\/seo\/[^/]+\/[^/]+\/?$/;
const SEO_SECTOR_RE = /^\/seo\/[^/]+\/?$/;
const BLOG_RE = /^\/blog(\/.*)?$/;

const rootEl = document.getElementById("root")!;
const pathname = window.location.pathname;

const isSeoCity = SEO_CITY_RE.test(pathname);
const isSeoSector = !isSeoCity && SEO_SECTOR_RE.test(pathname);
const isBlog = BLOG_RE.test(pathname);
const hasPrerendered = rootEl.children.length > 0;

if ((isSeoCity || isSeoSector || isBlog) && hasPrerendered) {
  // Pagina pre-renderizzata: monta solo la navbar interattiva,
  // NON fare hydration del contenuto (evita mismatch → pagina bianca)
  const navMount = document.createElement("div");
  navMount.id = "seo-nav-mount";
  navMount.style.cssText = "position:sticky;top:0;z-index:50;width:100%;";
  rootEl.parentElement!.insertBefore(navMount, rootEl);
  createRoot(navMount).render(
    <StrictMode>
      <SeoNavShell />
    </StrictMode>
  );
  // Non montare App su #root — il contenuto statico rimane intatto
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </StrictMode>
  );
}
