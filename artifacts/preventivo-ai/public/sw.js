/* eslint-disable no-undef */
// APP-2 (docs/APP-PLAN.md): il service worker di PrevAI, dalla Phase 77 di QuoteAI.
//
// Scritto a mano (niente workbox): quattro cache e tre regole.
//   • Struttura dell'app — /index.html più il JavaScript/CSS della dashboard,
//     precaricati all'installazione così l'app si apre anche senza rete. La
//     lista la scrive scripts/build-sw.ts dal manifest di Vite (il segnaposto
//     `__PRECACHE__`) e il nome della cache porta la versione
//     (`__SW_VERSION__`), così un deploy cambia la struttura tutta insieme.
//     In sviluppo i segnaposto restano e valgono solo le regole a runtime.
//   • /assets/* — hanno l'hash nel nome e non cambiano: prima la cache.
//   • Le letture che servono ad aprire la dashboard senza rete (sessione,
//     profilo, piano, Oggi, preventivi, cantieri, notifiche) — prima la rete,
//     l'ultima risposta buona tenuta in `prevai-api` e servita con
//     `X-Served-From: sw-cache` quando la rete non c'è. Il resto di /api non si
//     tocca mai, e le scritture non passano di qui. La cache delle letture si
//     svuota all'uscita (src/lib/pwa.ts) e quando la sessione non c'è più.
//   • Navigazioni — prima la rete, poi la struttura salvata, poi una piccola
//     pagina "Sei offline".
// Push: mostra la notifica cifrata dal server (api-server/src/lib/push.ts) e al
// tocco apre (o porta davanti) la pagina collegata.

const VERSION = "__SW_VERSION__";
const PRECACHE = /* __PRECACHE__ */ [];

const SHELL_CACHE = `prevai-shell-${VERSION}`;
const ASSET_CACHE = `prevai-assets-${VERSION}`;
const STATIC_CACHE = `prevai-static-${VERSION}`;
const API_CACHE = "prevai-api";
const KEEP = new Set([SHELL_CACHE, ASSET_CACHE, STATIC_CACHE, API_CACHE]);

const SHELL_URL = "/index.html";
const STATIC_PRECACHE = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/prevai-logo.png", "/fonts/figtree-latin-wght-normal.woff2", "/fonts/inter-latin-wght-normal.woff2"];

/** Letture tenute per l'uso senza rete (solo il percorso; la query fa parte della chiave). */
const OFFLINE_API = /^\/api\/(auth\/get-session|business-profile|payments\/subscription|home|today\/[a-z-]+|quotes|jobs|notifications|team\/orgs|push\/config)$/;

const OFFLINE_HTML = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PrevAI — sei offline</title>
<style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#101031}main{max-width:22rem;padding:2rem;text-align:center}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0 0 1.25rem;color:#5b6180}button{border:0;border-radius:999px;padding:.7rem 1.4rem;background:#101031;color:#fff;font-size:1rem}</style></head>
<body><main><h1>Sei offline</h1><p>Questa pagina non è ancora salvata su questo dispositivo. Ricollegati e riprova.</p><button onclick="location.reload()">Riprova</button></main></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      // La struttura deve esserci; un pezzo mancante non è grave (si scarica quando serve).
      await shell.add(new Request(SHELL_URL, { cache: "reload" }));
      const assets = await caches.open(ASSET_CACHE);
      await Promise.all(PRECACHE.map((u) => assets.add(u).catch(() => undefined)));
      const statics = await caches.open(STATIC_CACHE);
      await Promise.all(STATIC_PRECACHE.map((u) => statics.add(u).catch(() => undefined)));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (!KEEP.has(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  else if (data.type === "CLEAR_API_CACHE") event.waitUntil(caches.delete(API_CACHE));
  else if (data.type === "GET_VERSION" && event.source) event.source.postMessage({ type: "VERSION", version: VERSION });
});

function withHeader(res, name, value) {
  const headers = new Headers(res.headers);
  headers.set(name, value);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function networkFirstApi(req, pathname) {
  const cache = await caches.open(API_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) {
      // Nessuna sessione (uscito, scaduta): niente di quello che è in cache appartiene più a chi usa il browser.
      if (pathname === "/api/auth/get-session") {
        const text = await res.clone().text().catch(() => "");
        if (text.trim() === "" || text.trim() === "null") {
          await caches.delete(API_CACHE);
          return res;
        }
      }
      cache.put(req, res.clone()).catch(() => undefined);
    } else if (res.status === 401 || res.status === 403 || res.status === 404) {
      cache.delete(req).catch(() => undefined);
    }
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return withHeader(cached, "X-Served-From", "sw-cache");
    return new Response(JSON.stringify({ error: "OFFLINE", message: "Sei offline e questi dati non sono ancora salvati su questo dispositivo." }), { status: 503, headers: { "Content-Type": "application/json", "X-Served-From": "sw-offline" } });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => undefined);
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone()).catch(() => undefined);
      return res;
    })
    .catch(() => undefined);
  return cached || (await refresh) || new Response("", { status: 503 });
}

async function navigate(req) {
  try {
    return await fetch(req);
  } catch {
    const shell = await caches.match(SHELL_URL);
    if (shell) return shell;
    return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) {
    if (OFFLINE_API.test(url.pathname)) event.respondWith(networkFirstApi(req, url.pathname));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(navigate(req));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }
  if (/\.(png|jpe?g|webp|svg|ico|woff2?|webmanifest)$/.test(url.pathname)) event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "PrevAI";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      lang: "it",
      data: { link: data.link || "/dashboard/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/dashboard/notifications";
  const url = new URL(link, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          if ("navigate" in client) client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
