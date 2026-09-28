/**
 * APP-8d — opens the one assistant from anywhere (the "Chiedi o detta…" row on
 * Oggi): the launcher in the top bar listens and opens its panel, starting the
 * dictation when the microphone was the thing tapped.
 */
export type OpenAssistantRequest = { dictate: boolean };

const listeners = new Set<(r: OpenAssistantRequest) => void>();

export function openAssistant(r: OpenAssistantRequest = { dictate: false }): void {
  for (const l of listeners) l(r);
}

export function onOpenAssistant(l: (r: OpenAssistantRequest) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
