// The "Guarda come si fa" link of an empty screen (POCKET-7): Empty's link/onLink, or nothing while the video has no file.
// Apart from lib/videos.ts so that one stays free of the router (its tests run in plain node).
import { router } from "expo-router";
import { watchHref, type VideoFrom, type VideoId } from "./videos";

export function watchLink(id: VideoId, from: VideoFrom, label: string): { link?: string; onLink?: () => void } {
  const href = watchHref(id, from);
  return href ? { link: label, onLink: () => router.push(href) } : {};
}
