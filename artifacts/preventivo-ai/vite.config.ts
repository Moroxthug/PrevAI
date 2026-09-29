import { defineConfig, type Plugin } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
const port = Number(process.env.PORT ?? "5173");
const basePath = process.env.BASE_PATH ?? "/";

// Phase 69: the commit becomes the Sentry release (VERCEL_GIT_COMMIT_SHA is
// set at build time on Vercel), and source maps are emitted only when a
// SENTRY_AUTH_TOKEN is present to upload them — scripts/sentry-sourcemaps.mjs
// deletes them from dist/public after the upload so they are never served.
const release = process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "";
const emitSourcemaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

// PERF-1: chunk graph with the source modules and CSS of every chunk, for
// scripts/bundle-budget.ts (`qa:bundle`) and scripts/build-sw.ts. Vite's
// manifest loses a page's name when Rollup merges it into a shared chunk;
// this does not. Written to dist/ (not dist/public), so it is never deployed.
function bundleMap(): Plugin {
  return {
    name: "prevai-bundle-map",
    apply: "build",
    generateBundle(_options, bundle) {
      const rel = (id: string) => path.relative(import.meta.dirname, id.replace(/\?.*$/, "")).split(path.sep).join("/");
      const chunks = Object.values(bundle).flatMap((c) => c.type !== "chunk" ? [] : [{
        file: c.fileName,
        isEntry: c.isEntry,
        imports: c.imports,
        dynamicImports: c.dynamicImports,
        modules: Object.keys(c.modules).map(rel),
        css: [...(c.viteMetadata?.importedCss ?? [])],
      }]);
      mkdirSync(path.resolve(import.meta.dirname, "dist"), { recursive: true });
      writeFileSync(path.resolve(import.meta.dirname, "dist/bundle-map.json"), JSON.stringify(chunks));
    },
  };
}

export default defineConfig(({ isSsrBuild }) => ({
  base: basePath,
  define: {
    "import.meta.env.VITE_RELEASE": JSON.stringify(release),
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(isSsrBuild ? [] : [bundleMap()]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  ssr: {
    // CommonJS packages whose named exports tsx (which runs the prerender script) cannot resolve: bundle them into dist/server.
    noExternal: ["react-helmet-async"],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 500,
    sourcemap: emitSourcemaps && !isSsrBuild ? "hidden" : false,
    rollupOptions: {
      output: {
        // Not for the SSR build of entry-server.tsx (one Node file; Rollup rejects manual chunks there).
        manualChunks: isSsrBuild ? undefined : (id) => {
          // Only long-lived vendor libraries are grouped by hand (cache stability).
          // recharts is deliberately NOT grouped: a manual chunk drags its whole
          // dependency tree in and every page chunk ended up importing it. Grouping app pages into a
          // manual chunk made Rollup pull every shared module those pages touch
          // (ui/*, hooks, the auth client) into that chunk, so the public entry
          // ended up statically importing — and modulepreloading — the whole
          // 1.5 MB dashboard bundle on the marketing homepage (Phase 61).
          // Lazy routes now split naturally, one chunk per page.
          // @radix-ui used to be grouped too: a grouped chunk holds every
          // primitive used anywhere, and the public entry (which needs only
          // Tooltip/Toast) had to load all 136 kB of it on the homepage.
          // Rollup now splits it by usage (Phase 68). lucide-react stays
          // grouped — split by usage it became ~150 one-icon chunks.
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          // PERF-1: the router and Helmet are only needed by the App; the static
          // SEO pages mount one header with plain React (~12 kB gzip saved there).
          if (id.includes("node_modules/react-helmet-async") || id.includes("node_modules/wouter")) {
            return "vendor-router";
          }
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "vendor-react";
          }
          if (
            id.includes("node_modules/@tanstack/react-query") ||
            id.includes("node_modules/@tanstack/query-core")
          ) {
            return "vendor-query";
          }
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // In produzione frontend e API condividono lo stesso dominio (un solo
    // deploy Vercel); in dev locale girano su porte separate, quindi le
    // fetch relative a /api/* servono questo proxy per raggiungere l'api-server.
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
}));
