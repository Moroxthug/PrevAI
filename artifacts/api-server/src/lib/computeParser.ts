export interface ParsedItem {
  descrizione: string;
  um: string;
  quantita: number;
  prezzoUnitario: number;
  totale: number;
}

export interface ParsedChapter {
  lettera: string;
  titolo: string;
  osservazione: string;
  voci: ParsedItem[];
  subtotale: number;
}

export function isComputoMetrico(text: string): boolean {
  const lines = text.split(/\r?\n/);
  const chapterLines = lines.filter(l => l.match(/^##\s+\d+\.\s/));
  const voceLines = lines.filter(l => l.match(/:\s*[\d.,]+\s*[a-zA-Z./°]+\s*[×x]\s*[\d.,]+\s*€\//) || l.match(/=\s*\*\*[\d.,]+\s*€\*\*/));
  // Trigger only if we have at least 2 chapters and at least 5 voce lines
  return chapterLines.length >= 2 && voceLines.length >= 5;
}

function parseEuro(s: string): number {
  const cleaned = s.trim().replace(/\./g, "").replace(/,/g, ".");
  return Number(cleaned) || 0;
}

const CHAPTER_RE = /^##\s+\d+\.\s*(.+?)(?:\s*\(.+?\))?\s*$/;
const SUBTOTALE_RE = /Subtotale Categoria:\s*([\d.,]+)\s*€/i;

// Voce standard: : QTA UM × PU €/UM = **TOT €**
const VOCE_RE = /:\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*[×x]\s*([\d.,]+)\s*€\/([a-zA-Z./°]+)\s*=\s*\*\*([\d.,]+)\s*€\*\*/;

// Voce senza prezzo unitario: : QTA UM = **TOT €**
const VOCE_NO_PU_RE = /:\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*=\s*\*\*([\d.,]+)\s*€\*\*/;

// Voce multipla: : QTA UM × PU €/UM × QTA2 UM2 = **TOT €**
const VOCE_MULTI_RE = /:\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*[×x]\s*([\d.,]+)\s*€\/([a-zA-Z./°]+)\s*[×x]\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*=\s*\*\*([\d.,]+)\s*€\*\*/;

function extractDesc(line: string): string {
  const colonIdx = line.indexOf(":");
  const prefix = colonIdx >= 0 ? line.substring(0, colonIdx) : line;
  return prefix
    .replace(/^\*+\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
}

function normalizeLines(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("*") && !line.includes("€") && !line.includes(":") && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (!next.startsWith("##") && !next.startsWith("*")) {
        result.push(line + " " + next);
        i += 2;
        continue;
      }
    }
    result.push(line);
    i++;
  }
  return result;
}

export function parseComputoMetrico(text: string): ParsedChapter[] | null {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const lines = normalizeLines(rawLines);
  const chapters: ParsedChapter[] = [];
  let currentChapter: ParsedChapter | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Capitolo
    const chapterMatch = line.match(CHAPTER_RE);
    if (chapterMatch) {
      if (currentChapter) chapters.push(currentChapter);
      currentChapter = {
        lettera: String.fromCharCode(65 + chapters.length),
        titolo: chapterMatch[1].trim(),
        osservazione: "Voce ordinaria",
        voci: [],
        subtotale: 0,
      };
      continue;
    }

    if (!currentChapter) continue;

    // Subtotale
    const subtotaleMatch = line.match(SUBTOTALE_RE);
    if (subtotaleMatch) {
      currentChapter.subtotale = parseEuro(subtotaleMatch[1]);
      continue;
    }

    // Voce multipla (× ×)
    const multiMatch = line.match(VOCE_MULTI_RE);
    if (multiMatch) {
      const [, qty, um, pu, _puUm, qty2, _um2, tot] = multiMatch;
      const q = parseEuro(qty);
      const q2 = parseEuro(qty2);
      const t = parseEuro(tot);
      currentChapter.voci.push({
        descrizione: extractDesc(line),
        um: um.trim(),
        quantita: q * q2,
        prezzoUnitario: t / (q * q2),
        totale: t,
      });
      continue;
    }

    // Voce standard
    const voceMatch = line.match(VOCE_RE);
    if (voceMatch) {
      const [, qty, um, pu, _puUm, tot] = voceMatch;
      currentChapter.voci.push({
        descrizione: extractDesc(line),
        um: um.trim(),
        quantita: parseEuro(qty),
        prezzoUnitario: parseEuro(pu),
        totale: parseEuro(tot),
      });
      continue;
    }

    // Voce senza prezzo unitario (solo = totale)
    const noPuMatch = line.match(VOCE_NO_PU_RE);
    if (noPuMatch) {
      const [, qty, um, tot] = noPuMatch;
      const q = parseEuro(qty);
      const t = parseEuro(tot);
      currentChapter.voci.push({
        descrizione: extractDesc(line),
        um: um.trim(),
        quantita: q,
        prezzoUnitario: q > 0 ? t / q : t,
        totale: t,
      });
      continue;
    }
  }

  if (currentChapter) chapters.push(currentChapter);

  // Se non ci sono capitoli o nessuna voce, return null
  if (chapters.length === 0 || chapters.every(c => c.voci.length === 0)) return null;

  // Calcola subtotale per capitoli che non ce l'hanno
  chapters.forEach(c => {
    if (c.subtotale === 0) {
      c.subtotale = c.voci.reduce((sum, v) => sum + v.totale, 0);
    }
  });

  return chapters;
}
