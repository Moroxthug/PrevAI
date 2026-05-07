import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { SeoNavShell } from "./components/seo-header.tsx";
import "./index.css";

const SEO_CITY_RE = /^\/seo\/[^/]+\/[^/]+\/?$/;

const rootEl = document.getElementById("root")!;
const pathname = window.location.pathname;

const isSeoCity = SEO_CITY_RE.test(pathname);
const hasPrerendered = isSeoCity && rootEl.children.length > 0;

if (hasPrerendered) {
  const navMount = document.createElement("div");
  navMount.id = "seo-nav-mount";
  navMount.style.cssText = "position:sticky;top:0;z-index:50;width:100%";
  rootEl.parentElement!.insertBefore(navMount, rootEl);
  createRoot(navMount).render(
    <StrictMode>
      <SeoNavShell />
    </StrictMode>
  );
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </StrictMode>
  );
}
