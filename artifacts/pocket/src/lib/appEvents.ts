// The app's usage events (POST /api/app/events, the APP-5 table app_events). POCKET-7 sends the two video events: which video, from which screen.
// Best effort: never awaited by a screen, never retried, never an error on screen (the server answers 204 even before its table exists).
import Constants from "expo-constants";
import { api } from "./api";

export type AppEvent = { kind: "video_started" | "video_finished"; entityId: string; from: string; surface: "android" | "ios" | "web" };

export function sendAppEvent(e: AppEvent): void {
  const appVersion = Constants.expoConfig?.version;
  void api("/api/app/events", { method: "POST", body: { ...e, viewport: "phone", ...(appVersion ? { appVersion } : null) } }).catch(() => undefined);
}
