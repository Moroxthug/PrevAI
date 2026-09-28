// ── APP-8f: quando qualcuno parla ────────────────────────────────────────────
// Un rilevatore semplice sul volume del microfono: impara il rumore di fondo,
// dice "parla" quando il livello resta sopra per un attimo e "ha finito"
// dopo un po' di silenzio. Serve a due cose: parlare sopra l'assistente lo
// zittisce (barge-in), e l'ascolto a mani libere dopo la domanda di conferma
// si ferma da solo. Niente esce dal telefono: si guarda solo il volume.

export type VoiceActivityOptions = {
  /** How long the level must stay up before it counts as speech (ms). */
  startMs?: number;
  /** Silence after speech that ends it (ms). */
  silenceMs?: number;
  /** Times the noise floor the level must reach (higher while the assistant is talking: its own echo). */
  factor?: number;
  /** Lowest RMS that can be speech, whatever the floor. */
  minRms?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
};

export type VoiceActivity = { stop: () => void };

type Ctx = typeof AudioContext;
const AudioCtx = (): Ctx | null => (typeof window === "undefined" ? null : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctx }).webkitAudioContext ?? null));

export const voiceActivitySupported = () => AudioCtx() !== null;

/** Watches a microphone stream. The stream stays the caller's: stop() closes only the analysis. */
export function watchVoiceActivity(stream: MediaStream, opts: VoiceActivityOptions = {}): VoiceActivity {
  const Ctor = AudioCtx();
  if (!Ctor) return { stop: () => {} };
  const { startMs = 150, silenceMs = 1100, factor = 3, minRms = 0.015 } = opts;
  const ctx = new Ctor();
  void ctx.resume().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const TICK = 40;
  let floor = 0.004;
  let above = 0;
  let below = 0;
  let speaking = false;
  let stopped = false;

  const id = window.setInterval(() => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
    const rms = Math.sqrt(sum / buf.length);
    const threshold = Math.max(minRms, floor * factor);
    if (!speaking) {
      // The floor follows the room only while nobody speaks (slowly up, quickly down).
      floor = rms < floor ? floor * 0.8 + rms * 0.2 : floor * 0.97 + Math.min(rms, threshold) * 0.03;
      above = rms > threshold ? above + TICK : 0;
      if (above >= startMs) { speaking = true; below = 0; opts.onSpeechStart?.(); }
    } else {
      below = rms < threshold * 0.7 ? below + TICK : 0;
      if (below >= silenceMs) { speaking = false; above = 0; opts.onSpeechEnd?.(); }
    }
  }, TICK);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(id);
      try { source.disconnect(); } catch { /* already gone */ }
      void ctx.close().catch(() => {});
    },
  };
}

/** The microphone with the browser's echo cancellation: the assistant's own voice should not count as someone speaking. */
export function openMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
}
