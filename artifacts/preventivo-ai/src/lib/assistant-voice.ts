import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ASSISTANT_VOICE_MODES, ASSISTANT_VOICE_RATES, type AssistantVoiceMode } from "@workspace/config";

// ── APP-8e: l'assistente risponde a voce ─────────────────────────────────────
// Le frasi arrivano mentre la risposta si scrive (SentenceChunker) e si dicono
// una dopo l'altra: la prima appena è finita. Voce del server se c'è la chiave
// del fornitore (D17, AS-2), altrimenti la voce del browser, gratuita. Le
// preferenze sono di questo dispositivo: chi usa il telefono in cantiere e il
// computer in ufficio le vuole diverse.

export type VoicePrefs = { mode: AssistantVoiceMode; rate: number; voiceName: string | null };
export type VoiceInfo = { provider: "openai" | "browser"; voice: string | null; minutesUsed: number; minutesIncluded: number | null };

const PREFS_KEY = "prevai:assistant-voice";
const DEFAULT_PREFS: VoicePrefs = { mode: "dictated", rate: 1, voiceName: null };
const PREFS_EVENT = "prevai:assistant-voice-prefs";

export function readVoicePrefs(): VoicePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<VoicePrefs> | null;
    if (!raw) return DEFAULT_PREFS;
    return {
      mode: (ASSISTANT_VOICE_MODES as readonly string[]).includes(raw.mode ?? "") ? raw.mode! : DEFAULT_PREFS.mode,
      rate: (ASSISTANT_VOICE_RATES as readonly number[]).includes(raw.rate ?? 0) ? raw.rate! : 1,
      voiceName: typeof raw.voiceName === "string" ? raw.voiceName : null,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeVoicePrefs(p: VoicePrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private window: only this session */ }
  window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: p }));
}

/** The prefs, shared live between the chat and Impostazioni → Assistente. */
export function useVoicePrefs(): [VoicePrefs, (patch: Partial<VoicePrefs>) => void] {
  const [prefs, setPrefs] = useState<VoicePrefs>(readVoicePrefs);
  useEffect(() => {
    const on = (e: Event) => setPrefs((e as CustomEvent<VoicePrefs>).detail);
    window.addEventListener(PREFS_EVENT, on);
    return () => window.removeEventListener(PREFS_EVENT, on);
  }, []);
  const update = useCallback((patch: Partial<VoicePrefs>) => writeVoicePrefs({ ...readVoicePrefs(), ...patch }), []);
  return [prefs, update];
}

/** Which voice the server offers (GET /api/assistant/voice); on any error the browser's. */
export function useVoiceInfo(enabled = true): VoiceInfo {
  const { data } = useQuery({
    queryKey: ["assistant-voice"],
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<VoiceInfo> => {
      const res = await fetch("/api/assistant/voice", { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
  });
  return data ?? { provider: "browser", voice: null, minutesUsed: 0, minutesIncluded: null };
}

export const browserSpeechAvailable = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** The browser's Italian voices, the better-sounding ones first. */
export function italianVoices(): SpeechSynthesisVoice[] {
  if (!browserSpeechAvailable()) return [];
  const score = (v: SpeechSynthesisVoice) => (/natural|neural|online|premium|enhanced/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : 2);
  return window.speechSynthesis.getVoices().filter((v) => /^it([-_]|$)/i.test(v.lang)).sort((a, b) => score(a) - score(b));
}

/** The voice list loads late in Chrome: re-read it when it changes. */
export function useItalianVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(italianVoices);
  useEffect(() => {
    if (!browserSpeechAvailable()) return;
    const on = () => setVoices(italianVoices());
    window.speechSynthesis.addEventListener("voiceschanged", on);
    on();
    return () => window.speechSynthesis.removeEventListener("voiceschanged", on);
  }, []);
  return voices;
}

type Item = { text: string; audio: Promise<Blob | null> | null };
type SpeakerOptions = { server: () => boolean; prefs: () => VoicePrefs; onSpeaking: (on: boolean) => void; onFirstAudio: () => void };

/** A near-silent wav: played on a tap so iOS lets this page play audio later, after an await. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/**
 * Says sentences in order. With the server's voice each sentence is fetched
 * as soon as it arrives (the next downloads while this one plays); if the
 * server says no, that sentence and the rest go to the browser's voice.
 */
export class Speaker {
  private queue: Item[] = [];
  private playing = false;
  private ended = true;
  private gen = 0;
  private first = true;
  private audio: HTMLAudioElement | null = null;
  private fetches = new Set<AbortController>();
  private serverOff = false;

  constructor(private opts: SpeakerOptions) {}

  /** Call inside a tap (send, mic): unlocks audio on iOS and Safari. */
  unlock() {
    if (!this.audio && typeof Audio !== "undefined") this.audio = new Audio();
    if (this.audio && !this.playing) { this.audio.src = SILENCE; void this.audio.play().catch(() => {}); }
    if (browserSpeechAvailable() && !this.playing) window.speechSynthesis.resume();
  }

  /** A new answer begins. */
  begin() {
    this.stop();
    this.ended = false;
    this.first = true;
  }

  enqueue(text: string) {
    const useServer = this.opts.server() && !this.serverOff;
    this.queue.push({ text, audio: useServer ? this.fetchAudio(text) : null });
    if (!this.playing) void this.run(this.gen);
  }

  /** No more sentences for this answer. */
  end() {
    this.ended = true;
    if (!this.playing && this.queue.length === 0) this.opts.onSpeaking(false);
  }

  stop() {
    this.gen++;
    this.queue = [];
    for (const c of this.fetches) c.abort();
    this.fetches.clear();
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute("src"); }
    if (browserSpeechAvailable()) window.speechSynthesis.cancel();
    if (this.playing) this.opts.onSpeaking(false);
    this.playing = false;
  }

  private fetchAudio(text: string): Promise<Blob | null> {
    const ctrl = new AbortController();
    this.fetches.add(ctrl);
    return fetch("/api/assistant/speech", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, rate: this.opts.prefs().rate }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        // 503 = no provider key, 402 = minutes over: the browser's voice from now on.
        if (res.status === 503 || res.status === 402) this.serverOff = true;
        return res.ok ? res.blob() : null;
      })
      .catch(() => null)
      .finally(() => this.fetches.delete(ctrl));
  }

  private async run(gen: number) {
    this.playing = true;
    this.opts.onSpeaking(true);
    while (gen === this.gen && this.queue.length > 0) {
      const item = this.queue.shift()!;
      const blob = item.audio ? await item.audio : null;
      if (gen !== this.gen) return;
      if (blob) await this.playBlob(blob, gen);
      else await this.speakBrowser(item.text, gen);
    }
    if (gen !== this.gen) return;
    this.playing = false;
    if (this.ended) this.opts.onSpeaking(false);
  }

  private markFirst() {
    if (!this.first) return;
    this.first = false;
    this.opts.onFirstAudio();
  }

  private playBlob(blob: Blob, gen: number): Promise<void> {
    this.audio ??= new Audio();
    const a = this.audio;
    const url = URL.createObjectURL(blob);
    return new Promise<void>((resolve) => {
      const done = () => { a.onended = a.onerror = a.onplaying = null; URL.revokeObjectURL(url); resolve(); };
      a.onplaying = () => { if (gen === this.gen) this.markFirst(); };
      a.onended = done;
      a.onerror = done;
      a.src = url;
      a.play().catch(done);
    });
  }

  private speakBrowser(text: string, gen: number): Promise<void> {
    if (!browserSpeechAvailable()) return Promise.resolve();
    const { rate, voiceName } = this.opts.prefs();
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "it-IT";
      u.rate = rate;
      const voices = italianVoices();
      const v = voices.find((x) => x.name === voiceName) ?? voices[0];
      if (v) u.voice = v;
      // Some browsers never fire onend for a cancelled or voiceless utterance: a timeout keeps the queue moving.
      const guard = window.setTimeout(() => resolve(), 2000 + text.length * 120 / rate);
      u.onstart = () => { if (gen === this.gen) this.markFirst(); };
      u.onend = u.onerror = () => { window.clearTimeout(guard); resolve(); };
      window.speechSynthesis.speak(u);
    });
  }
}

/** One Speaker for a chat, stopped when the chat goes away. */
export function useSpeaker(serverVoice: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const server = useRef(serverVoice);
  server.current = serverVoice;
  const ref = useRef<Speaker | null>(null);
  ref.current ??= new Speaker({
    server: () => server.current,
    prefs: readVoicePrefs,
    onSpeaking: setSpeaking,
    onFirstAudio: () => {
      // "Fatta quando": dal silenzio (fine dettatura) o dall'invio alla prima parola detta.
      try { performance.mark("asst-voice:first-audio"); } catch { /* old browsers */ }
    },
  });
  useEffect(() => () => ref.current?.stop(), []);
  return { speaker: ref.current, speaking };
}
