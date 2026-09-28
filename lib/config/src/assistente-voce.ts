// ── APP-8e: l'assistente risponde a voce (docs/ASSISTENTE-PLAN.md) ──────────
// D17 (motore della voce) è aperta. La proposta è la catena: dettatura Whisper
// su Groq (c'è) → testo in streaming (c'è da APP-8a) → sintesi vocale frase
// per frase. La sintesi di un fornitore parte solo se sul server c'è la sua
// chiave (AS-2); senza, l'app usa la voce del browser, gratuita — il ripiego
// della proposta. Qui le regole che servono a server e app insieme.

/** Come risponde l'assistente: mai a voce, a voce quando la domanda è stata dettata, sempre (conversazione a voce). */
export const ASSISTANT_VOICE_MODES = ["off", "dictated", "always"] as const;
export type AssistantVoiceMode = (typeof ASSISTANT_VOICE_MODES)[number];
export const ASSISTANT_VOICE_MODE_LABEL: Record<AssistantVoiceMode, string> = {
  off: "Solo testo",
  dictated: "A voce quando detti",
  always: "Conversazione a voce",
};

/** Velocità della voce: 1 = normale. */
export const ASSISTANT_VOICE_RATES = [0.85, 1, 1.15, 1.3] as const;

/**
 * La voce del fornitore (D17 proposta: OpenAI `gpt-4o-mini-tts`). Provvisoria:
 * la sceglie il titolare fra i campioni (AS-3). Le istruzioni chiedono la voce
 * "calma e neutra" del piano.
 */
export const ASSISTANT_TTS = {
  model: "gpt-4o-mini-tts",
  voice: "coral",
  instructions: "Parla in italiano, con tono calmo, neutro e cordiale, a ritmo naturale. Leggi importi e date come li direbbe una persona.",
} as const;

/** Una frase mandata alla sintesi, al massimo. Le risposte lunghe vanno a pezzi. */
export const ASSISTANT_SPEECH_MAX_CHARS = 600;

/**
 * D18 aperta: minuti di voce inclusi al mese per posto (proposta 300, solo
 * sulla voce del fornitore, che costa). `null` = nessun tetto: i minuti si
 * contano e si mostrano, ma non fermano nulla finché il titolare non decide.
 */
export const ASSISTANT_VOICE_MINUTES_PER_SEAT: number | null = null;

/** Secondi di parlato stimati per un testo (italiano ≈ 14 caratteri al secondo a velocità 1). */
export function estimateSpeechSeconds(text: string, rate = 1): number {
  return Math.max(1, Math.round(text.length / 14 / (rate || 1)));
}

/** Il testo da dire: senza grassetti, elenchi, titoli e link, con gli spazi in ordine. */
export function spokenText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/^\s*(?:[-•]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parole che finiscono col punto senza chiudere la frase ("n. 3", "sig. Rossi"). */
const ABBREVIATION = /(?:^|\s)(?:n|nr|num|sig|sigg|sig\.ra|dott|ing|geom|arch|avv|es|ecc|pag|art|tel|cod|rif|via|p|pz|mq|mc|ml|kg|ca)\.$/i;
/** Sotto questa lunghezza un pezzo aspetta il successivo, così non si parla a singhiozzo. */
const MIN_CHARS = 12;

/**
 * Taglia in frasi il testo che arriva a pezzi: così si comincia a parlare alla
 * prima frase finita, non alla fine della risposta. `push` restituisce le
 * frasi complete arrivate fin qui, `flush` quello che resta alla fine.
 */
export class SentenceChunker {
  private buf = "";

  push(delta: string): string[] {
    this.buf += delta;
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const ch = this.buf[i]!;
      const next = this.buf[i + 1];
      // Fine frase: un a capo, oppure . ! ? … seguito da uno spazio (non "1.200", non un punto in fondo al pezzo arrivato; i due punti no, a metà frase).
      const endsLine = ch === "\n";
      const endsSentence = /[.!?…]/.test(ch) && next !== undefined && /\s/.test(next);
      if (!endsLine && !endsSentence) continue;
      const piece = this.buf.slice(start, i + 1);
      if (endsSentence && ch === "." && ABBREVIATION.test(piece.trimEnd())) continue;
      const spoken = spokenText(piece);
      if (spoken.length < MIN_CHARS && !endsLine) continue;
      if (spoken) out.push(...splitLong(spoken));
      start = i + 1;
    }
    this.buf = this.buf.slice(start);
    return out;
  }

  flush(): string[] {
    const spoken = spokenText(this.buf);
    this.buf = "";
    return spoken ? splitLong(spoken) : [];
  }
}

/** Una frase oltre il massimo va a pezzi sulle virgole, poi sugli spazi. */
function splitLong(s: string): string[] {
  if (s.length <= ASSISTANT_SPEECH_MAX_CHARS) return [s];
  const out: string[] = [];
  let rest = s;
  while (rest.length > ASSISTANT_SPEECH_MAX_CHARS) {
    const window = rest.slice(0, ASSISTANT_SPEECH_MAX_CHARS);
    const cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf(" "));
    const at = cut > 0 ? cut + 1 : ASSISTANT_SPEECH_MAX_CHARS;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}
