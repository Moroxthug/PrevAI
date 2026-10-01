// UX-1: pure helpers for the route effects (components/route-effects.tsx), kept
// free of the DOM so they run under `tsx --test`.

export type ScrollMap = Record<string, number>;

/** One history entry = path + query: a job's "notes" tab and its "photos" tab are different screens with different scroll. */
export function routeKey(pathname: string, search: string): string {
  const q = search && search !== "?" ? (search.startsWith("?") ? search : `?${search}`) : "";
  return pathname + q;
}

/** Remember a position; the oldest entries drop out so a long session cannot grow the map without bound. */
export function remember(map: ScrollMap, key: string, y: number, cap = 40): ScrollMap {
  const next: ScrollMap = { ...map };
  delete next[key]; // re-insert so the most recently used entry is the newest
  next[key] = Math.max(0, Math.round(y));
  const keys = Object.keys(next);
  for (let i = 0; i < keys.length - cap; i++) delete next[keys[i]!];
  return next;
}

export function parseScrollMap(raw: string | null): ScrollMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ScrollMap = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** What a screen reader hears when the page changes: the page's own heading, else the tab title without the brand suffix. */
export function announcement(heading: string | null | undefined, title: string | null | undefined): string {
  const h = (heading ?? "").replace(/\s+/g, " ").trim();
  if (h) return h;
  return (title ?? "").replace(/\s*[·|–-]\s*PrevAI\s*$/i, "").replace(/\s+/g, " ").trim();
}
