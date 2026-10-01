import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { announcement, parseScrollMap, remember, routeKey } from "@/lib/scroll-memory";

// UX-1 — what the browser does for a multi-page site and a single-page app has to do by hand:
//  · a new screen opens at the top, Back/Forward/reload return to where the person was;
//  · a screen reader hears that the screen changed (and focus is not left on a link that is gone);
//  · a keyboard user can skip the menu.

const STORE = "prevai-scroll";
const loadMap = () => {
  try { return parseScrollMap(sessionStorage.getItem(STORE)); } catch { return {}; }
};
const saveMap = (map: Record<string, number>) => {
  try { sessionStorage.setItem(STORE, JSON.stringify(map)); } catch { /* private mode: scroll memory is a convenience */ }
};

const here = () => routeKey(window.location.pathname, window.location.search);
const instantTop = (y: number) => window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });

function navigationType(): string {
  try {
    return (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type ?? "navigate";
  } catch {
    return "navigate";
  }
}

/** Scroll to `y` as soon as the page is tall enough (lazy chunks and queries fill it in after the route change); give up on the first sign the person scrolls. */
function restoreScroll(y: number): () => void {
  let stopped = false;
  let timer = 0;
  const start = performance.now();
  const stop = () => { stopped = true; };
  const owners = ["wheel", "touchstart", "keydown", "mousedown"] as const;
  owners.forEach((e) => window.addEventListener(e, stop, { passive: true, once: true }));
  const step = () => {
    if (stopped) return;
    const room = document.documentElement.scrollHeight - window.innerHeight;
    if (room >= y || performance.now() - start > 1600) {
      instantTop(Math.min(y, Math.max(0, room)));
      return;
    }
    timer = window.setTimeout(step, 30);
  };
  timer = window.setTimeout(step, 30);
  return () => {
    stopped = true;
    clearTimeout(timer);
    owners.forEach((e) => window.removeEventListener(e, stop));
  };
}

function mainElement(): HTMLElement | null {
  const el = document.querySelector<HTMLElement>("main");
  if (el && !el.hasAttribute("tabindex")) el.tabIndex = -1;
  return el;
}

// One shared state, with the listeners installed when this module loads — before wouter subscribes to the very same events. Wouter's own
// popstate handler re-renders synchronously, and the route effect below must already know the navigation was a Back/Forward when it runs.
const S = { key: "", path: "", popAt: -1e9, frozen: false, first: true, initial: null as number | null, map: {} as Record<string, number> };

function install() {
  if (typeof window === "undefined" || typeof history === "undefined") return;
  S.map = loadMap();
  S.key = here();
  S.path = window.location.pathname;
  history.scrollRestoration = "manual";
  // Opening the app on a reload or a Back from another site returns to the saved place (kept until the first navigation: React StrictMode runs the route effect twice in development).
  const type = navigationType();
  S.initial = (type === "reload" || type === "back_forward") && !window.location.hash ? (S.map[S.key] ?? null) : null;

  // Positions are written as the person scrolls; while a navigation is in flight they are frozen, because the old screen is torn down
  // and the browser clamps the scroll — that fake position must not overwrite the real one.
  let timer = 0;
  const flush = () => {
    timer = 0;
    if (S.frozen) return;
    S.map = remember(S.map, S.key, window.scrollY);
    saveMap(S.map);
  };
  const leaving = (pop: boolean) => () => {
    if (here() === S.key) return; // same screen (a #anchor, a replaced query): nothing to remember
    if (!S.frozen) {
      S.map = remember(S.map, S.key, window.scrollY);
      saveMap(S.map);
    }
    S.frozen = true;
    S.initial = null;
    window.setTimeout(() => { S.frozen = false; }, 3000); // safety net: a navigation that never reaches the route effect must not freeze the memory for good
    if (pop) S.popAt = performance.now();
  };
  window.addEventListener("scroll", () => { if (!S.frozen && !timer) timer = window.setTimeout(flush, 120); }, { passive: true });
  window.addEventListener("pushState", leaving(false));
  window.addEventListener("popstate", leaving(true));
  // The page is going away (reload, tab closed): keep the last real position for the reload case.
  window.addEventListener("pagehide", () => { if (!S.frozen) flush(); });
}
install();

export function RouteEffects() {
  const [pathname] = useLocation();
  const search = useSearch();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const s = S;
    const key = here();
    const pathChanged = s.path !== window.location.pathname;
    const isPop = performance.now() - s.popAt < 1500;
    const first = s.first;
    s.first = false;
    s.key = key;
    s.path = window.location.pathname;

    let cancelRestore: (() => void) | undefined;
    const release = () => { s.frozen = false; };
    const hash = window.location.hash;

    if (S.initial != null && !pathChanged) {
      if (!hash) cancelRestore = restoreScroll(S.initial);
    } else if (first) {
      // A fresh visit starts at the top, where the browser already put it.
    } else if (isPop) {
      // Back/Forward: the saved place, or the top for a screen never scrolled. Going *forward* to a query already seen starts fresh instead.
      if (!hash && s.map[key] !== undefined) cancelRestore = restoreScroll(s.map[key]!);
      else if (!hash && pathChanged) instantTop(0);
    } else if (pathChanged && !hash) {
      instantTop(0);
    }
    release();

    // The screen changed: say so, once the new screen has a heading (its chunk and data arrive after the route change).
    let cancelled = false;
    let timer = 0;
    if (!first && pathChanged) {
      const began = performance.now();
      const settle = () => {
        if (cancelled) return;
        const main = mainElement();
        const heading = main?.querySelector("h1")?.textContent;
        if (!heading && performance.now() - began < 1500) {
          timer = window.setTimeout(settle, 100);
          return;
        }
        const text = announcement(heading, document.title);
        // Clear first so the same words twice in a row (two lists of the same kind) are still announced.
        setMessage("");
        window.setTimeout(() => !cancelled && setMessage(text), 60);
        // Focus: only when it was left on something that is gone or inside the old screen. A menu link the person just used keeps focus.
        const active = document.activeElement;
        const lost = !active || active === document.body || !document.contains(active) || !!main?.contains(active);
        const dialogOpen = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
        const typing = active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
        if (main && lost && !dialogOpen && !typing) main.focus({ preventScroll: true });
      };
      timer = window.setTimeout(settle, 80);
    }
    return () => {
      cancelled = true;
      cancelRestore?.();
      if (timer) clearTimeout(timer);
    };
    // `search` is a dependency on purpose: a screen's query is part of its history entry (a job's open tab).
  }, [pathname, search]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

/** First stop of the Tab key: jump over the menu to the screen itself. */
export function SkipLink() {
  return (
    <a
      href="#contenuto"
      className="skip-link"
      onClick={(e) => {
        e.preventDefault();
        const main = mainElement();
        main?.focus({ preventScroll: true });
        main?.scrollIntoView({ block: "start" });
      }}
    >
      Vai al contenuto
    </a>
  );
}
