import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { SeoNavShell } from "./components/seo-header.tsx";
import "./index.css";

const SEO_CITY_RE = /^\/seo\/[^/]+\/[^/]+\/?$/;
const SEO_SECTOR_RE = /^\/seo\/[^/]+\/?$/;

const rootEl = document.getElementById("root")!;
const pathname = window.location.pathname;

const isSeoCity = SEO_CITY_RE.test(pathname);
const isSeoSector = !isSeoCity && SEO_SECTOR_RE.test(pathname);
const hasPrerendered = (isSeoCity || isSeoSector) && rootEl.children.length > 0;

if (hasPrerendered) {
  if (isSeoSector) {
    // Sector pages: prerendered HTML includes a static header inside #root's flex column.
    // Replace the static header in-place with the interactive SeoNavShell so there is
    // zero height change and zero CLS (no layout shift from the swap).
    const staticHeader = rootEl.querySelector<HTMLElement>(":scope > * > header");
    if (staticHeader) {
      const navMount = document.createElement("div");
      navMount.id = "seo-nav-mount";
      // height:64px matches the static header so the in-place swap is height-neutral
      // (zero layout shift regardless of when React renders SeoNavShell).
      navMount.style.cssText = "position:sticky;top:0;z-index:50;width:100%;height:64px;";
      staticHeader.parentElement!.replaceChild(navMount, staticHeader);
      createRoot(navMount).render(
        <StrictMode>
          <SeoNavShell />
        </StrictMode>
      );
    }
  } else {
    // City pages: no header in prerendered HTML; mount SeoNavShell before #root.
    const navMount = document.createElement("div");
    navMount.id = "seo-nav-mount";
    navMount.style.cssText = "position:sticky;top:0;z-index:50;width:100%";
    rootEl.parentElement!.insertBefore(navMount, rootEl);
    createRoot(navMount).render(
      <StrictMode>
        <SeoNavShell />
      </StrictMode>
    );
  }
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </StrictMode>
  );
}
