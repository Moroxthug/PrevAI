// The assistant layer's voice (HomeAI.dc.html): record what the person says, send it to the server (Whisper, POST /api/assistant/listen, Italian), and read the
// answer aloud. PrevAI's own voice is POST /api/assistant/speech (APP-8e, an MP3 from the provider the server is set up with); when the server has none (503
// VOICE_BROWSER), the month's minutes are over (402) or it fails, the phone's own voice reads it (expo-speech, it-IT), so an answer is never silent.
// Not covered by node tests (native modules).
import { Platform } from "react-native";
import { API_ORIGIN } from "./session";
import { uploadFile } from "./jobUpload";

export type Heard = { ok: true; text: string } | { ok: false; problem: "empty" | "plan" | "offline" | "failed" };

/** What a finished recording becomes on the server: the text, or why not. */
export async function listen(uri: string): Promise<Heard> {
  const web = Platform.OS === "web";
  const r = await uploadFile<{ text: string }>("/api/assistant/listen", "audio", { uri, name: web ? "voice.webm" : "voice.m4a", type: web ? "audio/webm" : "audio/mp4" }, {});
  if (r.ok) return { ok: true, text: r.data.text };
  return { ok: false, problem: r.status === 0 ? "offline" : r.status === 403 ? "plan" : r.status === 422 ? "empty" : "failed" };
}

/** The phone's own voice, in Italian. Resolves when it has finished. */
async function speakOnDevice(text: string): Promise<void> {
  const Speech = await import("expo-speech");
  await new Promise<void>((done) => {
    Speech.speak(text, { language: "it-IT", onDone: () => done(), onStopped: () => done(), onError: () => done() });
    setTimeout(done, 90_000);
  });
}

/** Reads `text` aloud. Resolves when it has finished. */
export async function speak(text: string, onStart?: () => void): Promise<void> {
  let res: Response | null = null;
  try { res = await fetch(`${API_ORIGIN}/api/assistant/speech`, { method: "POST", headers: { "content-type": "application/json", accept: "audio/mpeg" }, body: JSON.stringify({ text: text.slice(0, 600) }) }); } catch { res = null; }
  if (!res || !res.ok) { onStart?.(); return speakOnDevice(text); }
  const bytes = new Uint8Array(await res.arrayBuffer());
  let uri: string;
  if (Platform.OS === "web") {
    uri = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
  } else {
    const { File, Paths } = await import("expo-file-system");
    const file = new File(Paths.cache, `reply-${Date.now()}.mp3`);
    file.create({ overwrite: true });
    file.write(bytes);
    uri = file.uri;
  }
  const { createAudioPlayer, setAudioModeAsync } = await import("expo-audio");
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  const player = createAudioPlayer({ uri });
  await new Promise<void>((done) => {
    const sub = player.addListener("playbackStatusUpdate", (s: { didJustFinish?: boolean }) => { if (s.didJustFinish) { sub.remove(); done(); } });
    onStart?.();
    player.play();
    setTimeout(done, 60_000);
  });
  player.remove();
}
