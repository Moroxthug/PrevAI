// The short videos (POCKET-7, row 64): which there are, how long, where each chapter starts, and the file. The videos are real MP4s recorded from the
// app (scripts/record-videos, docs/VIDEO.md), silent, 1280×776 like the player's frame, served by the website from /video/. A video with
// no file reads Coming soon in Help and has no "Guarda come si fa" link. The chapter times and lengths come from the recording: the site's copy of this
// list (artifacts/preventivo-ai/src/data/help-videos.ts) is checked against this one by videos.test.ts.
import type { Href } from "expo-router";

export type VideoId = "quotes" | "overview" | "jobs" | "crew" | "bonifico" | "app";
export type VideoDef = {
  id: VideoId; secs: number; icon: "mic" | "orb" | "cone" | "users" | "bank" | "link"; tone: "violet" | "indigo" | "amber" | "azure" | "sage" | "teal";
  /** Where each of the four chapters starts, in seconds. */
  at: number[];
  /** The file's name under /video/ (an MP4 and a JPG poster with the same name); null while the video is not recorded. */
  file: string | null;
};

export const VIDEOS: VideoDef[] = [
  { id: "quotes", secs: 47, icon: "mic", tone: "violet", at: [0, 4, 25, 37], file: "quotes" },
  { id: "overview", secs: 48, icon: "orb", tone: "indigo", at: [0, 11, 20, 38], file: "overview" },
  { id: "jobs", secs: 94, icon: "cone", tone: "amber", at: [0, 20, 45, 70], file: null },
  { id: "crew", secs: 58, icon: "users", tone: "azure", at: [0, 15, 30, 45], file: null },
  { id: "bonifico", secs: 40, icon: "bank", tone: "sage", at: [0, 6, 15, 31], file: "bonifico" },
  { id: "app", secs: 80, icon: "link", tone: "teal", at: [0, 20, 40, 60], file: null },
];

export const videoOf = (id: string | undefined): VideoDef | undefined => VIDEOS.find((v) => v.id === id);
export const playable = (v: VideoDef | undefined): v is VideoDef & { file: string } => !!v?.file;

/** Where the files are: the website, or EXPO_PUBLIC_VIDEO_BASE in development (a local copy of the site's public/video). */
export const VIDEO_BASE = (process.env.EXPO_PUBLIC_VIDEO_BASE ?? "https://prevai.it/video/").replace(/\/?$/, "/");
export const videoUrl = (file: string, base = VIDEO_BASE): string => `${base}${file}.mp4`;
export const posterUrl = (file: string, base = VIDEO_BASE): string => `${base}${file}.jpg`;

/** The screens a video can be opened from, sent with the video events so we learn where people get stuck. */
export const VIDEO_FROM = ["help", "quotes", "jobs", "team", "integrations", "invoices", "first-run", "home"] as const;
export type VideoFrom = (typeof VIDEO_FROM)[number];

/** The player for a video, opened from a screen; null when the video has no file yet (the caller then shows no link). */
export function watchHref(id: VideoId, from: VideoFrom): Href | null {
  if (!playable(videoOf(id))) return null;
  return { pathname: "/video-player", params: { video: id, from } } as Href;
}

/** 72 seconds as "1:12". */
export function clock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type Chapter = { at: number; title: string; caption: string };

/** The chapter playing at a position (the last one that has begun). */
export function chapterAt(chapters: Chapter[], pos: number): number {
  let i = 0;
  chapters.forEach((c, k) => { if (pos >= c.at) i = k; });
  return i;
}

/** How full each chapter's segment of the scrub bar is, 0 to 1. */
export function segmentFill(chapters: Chapter[], total: number, pos: number): number[] {
  return chapters.map((c, i) => {
    const a = c.at;
    const b = i + 1 < chapters.length ? chapters[i + 1]!.at : total;
    return pos >= b ? 1 : pos <= a ? 0 : (pos - a) / (b - a);
  });
}

/** The knob's distance across a bar of this width (gaps of 3 between the segments). */
export function knobX(chapters: Chapter[], total: number, pos: number, width: number, gap = 3): number {
  const w = (width - gap * (chapters.length - 1)) / chapters.length;
  let x = 0;
  chapters.forEach((c, i) => {
    const a = c.at;
    const b = i + 1 < chapters.length ? chapters[i + 1]!.at : total;
    if (pos >= b) x += w + gap;
    else if (pos > a) x += (w * (pos - a)) / (b - a);
  });
  return x;
}

export const SPEEDS = [1, 1.25, 1.5, 2] as const;
export const clampPos = (p: number, total: number): number => Math.max(0, Math.min(total, p));

/**
 * The two usage events of a video, once per opening: started when it first plays, finished when it reaches the end (a seek to the end counts).
 * Returns the events still to send for this state and remembers the ones sent.
 */
export function videoEvents(sent: { started: boolean; finished: boolean }, now: { playing: boolean; pos: number; total: number }): Array<"video_started" | "video_finished"> {
  const out: Array<"video_started" | "video_finished"> = [];
  if (!sent.started && now.playing) { sent.started = true; out.push("video_started"); }
  if (sent.started && !sent.finished && now.total > 0 && now.pos >= now.total - 0.5) { sent.finished = true; out.push("video_finished"); }
  return out;
}
