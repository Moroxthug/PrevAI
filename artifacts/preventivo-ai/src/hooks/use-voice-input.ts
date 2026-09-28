import { useCallback, useRef, useState } from "react";
import { watchVoiceActivity, type VoiceActivity } from "@/lib/voice-activity";

const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickMimeType(): string {
  for (const type of PREFERRED_MIME_TYPES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

interface UseVoiceInputOptions {
  onTranscribed: (text: string) => void;
  onError?: (message: string) => void;
  /** APP-8f: an automatic listen heard nobody and was dropped. */
  onNoSpeech?: () => void;
}

/**
 * APP-8f — how a recording starts. `stream`: a microphone already open (the
 * barge-in hands over its own, so the first syllable is not lost waiting for
 * getUserMedia). `autoStop`: hands-free — it stops by itself after a pause,
 * and is dropped without transcribing if nobody speaks within `waitMs`.
 */
export type StartRecordingOptions = { stream?: MediaStream; autoStop?: boolean; waitMs?: number; speaking?: boolean };

export function useVoiceInput({ onTranscribed, onError, onNoSpeech }: UseVoiceInputOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const activityRef = useRef<VoiceActivity | null>(null);
  const timersRef = useRef<number[]>([]);
  const discardRef = useRef(false);

  const cleanupStream = useCallback(() => {
    activityRef.current?.stop();
    activityRef.current = null;
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const transcribe = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      formData.append("audio", blob, `recording.${ext}`);

      const res = await fetch("/api/speech/transcribe", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        onError?.(data.error || "Trascrizione non riuscita. Riprova.");
        return;
      }
      if (data.text && typeof data.text === "string" && data.text.trim()) {
        onTranscribed(data.text.trim());
      } else {
        onError?.("Non ho capito: riprova parlando più vicino al telefono.");
      }
    } catch {
      onError?.("Connessione assente o instabile. Riprova.");
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscribed, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async (opts: StartRecordingOptions = {}) => {
    if (isRecording || (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive")) {
      opts.stream?.getTracks().forEach(track => track.stop());
      return;
    }
    if (!opts.stream && !navigator.mediaDevices?.getUserMedia) {
      onError?.("Questo browser non permette di registrare l'audio.");
      return;
    }
    try {
      const stream = opts.stream ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      discardRef.current = false;

      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        cleanupStream();
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        chunksRef.current = [];
        if (discardRef.current) { discardRef.current = false; onNoSpeech?.(); return; }
        if (blob.size > 0) {
          void transcribe(blob);
        }
      };

      recorder.start();
      setIsRecording(true);
      if (opts.autoStop) {
        // Hands-free: a pause ends it; nobody speaking drops it; never longer than 30 s.
        let heard = Boolean(opts.speaking);
        activityRef.current = watchVoiceActivity(stream, {
          startMs: 120,
          silenceMs: 1200,
          onSpeechStart: () => { heard = true; },
          onSpeechEnd: () => stopRecording(),
        });
        timersRef.current.push(window.setTimeout(() => { if (!heard) { discardRef.current = true; stopRecording(); } }, opts.waitMs ?? 7000));
        timersRef.current.push(window.setTimeout(() => stopRecording(), 30_000));
      }
    } catch {
      onError?.("Microfono non disponibile: controlla i permessi del browser.");
      cleanupStream();
    }
  }, [isRecording, cleanupStream, transcribe, onError, onNoSpeech, stopRecording]);

  return { isRecording, isTranscribing, startRecording, stopRecording };
}
