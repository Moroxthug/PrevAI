// V2-4: alcuni preventivi storici v1 avevano nel titolo il segnaposto letterale
// "[Comune] ([Prov])" ricopiato dall'esempio del prompt quando il luogo non era
// noto. Il prompt ora lo vieta; questa pulizia difensiva copre i modelli che lo
// ricopiano comunque.
export function stripLocationPlaceholder(title: string): string {
  return title
    .replace(/\s*[–-]\s*\[?Comune\]?\s*\(\[?Prov\]?\)/gi, "")
    .replace(/\[descrizione breve\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
