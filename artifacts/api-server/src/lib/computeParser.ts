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

// ───────────────────────────────────────────────────────────────────────────────
// 1. Detect structured computo metrico (markdown format with ## chapters)
// ───────────────────────────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────────────────────────
// 2. Detect and parse tabular "computo metrico" format (PDF extracts like:
//    Demolizioni   Rimozione marciapiede in CLS    mq      16.00
//    Costruzioni   Posa di guaina impermeabile ...  mq      31.00
// ───────────────────────────────────────────────────────────────────────────────

const TABULAR_CATEGORIES = /^(?:Demolizioni|Costruzioni|Impianti|Muratura|Finiture|Strutture|Chiusure|Rasante|Controsoffitti|Impermeabilizzazioni|Pavimentazioni|Rivestimenti|Verniciature|Falegnameria|Infissi|Fabbro|Giardino|Spese|Generale|Varie|Installazioni|Ripristini|Accatastamenti|Trasporti|Smaltimenti|Noleggi|Assistenza|Progetto|Direzione|Collaudi|Certificazioni|Pratiche|Permessi|Documentazione|Geologia|Topografia|Rilievo|sicurezza|Coordinamento|Cantiere|Altro)\b/i;

const TABULAR_UMS = /^(?:mq|ml|mc|n\.|n\.?|cpo|cad|kg|ore|a\.c\.|a\.c|a\.c\.?|m|m²|m³|cm|mm|lt|l|kg|q|t|kw|kwh|kW|kWh|pezzi|pz|unità|u|pers|giorni|gg|settimane|sett|mesi|mese|ann|ha|km|mld|mm|percento|%|m²\/ml|ml\/mq|€|euro|numero|n|cad|voce|forfait|corpo|globale|forfett|m|mcar|mcarr|mac|macc|maccar|mq|mql|mquad|mquadri|m2|m3|mt|mtl|mtli|mtr|mtrl|mtrli|n|nr|num|numero|p|pc|pchi|pe|pezz|pzz|pz|q|qli|quint|quintali|s|set|sett|settim|sm|smalt|smaltimento|sp|spe|spes|t|ton|tonn|tonnell|tonnellate|u|ud|unit|unità|v|voc|voce|voci|€|€\/mq|€\/ml|€\/mc|€\/n|€\/cpo|€\/cad|€\/kg|€\/ore|€\/a\.c|€\/m|€\/m²|€\/m³|€\/cm|€\/mm|€\/lt|€\/l|€\/kg|€\/q|€\/t|€\/kw|€\/kwh|€\/kW|€\/kWh|€\/pezzi|€\/pz|€\/unità|€\/u|€\/pers|€\/giorni|€\/gg|€\/settimane|€\/sett|€\/mesi|€\/mese|€\/ann|€\/ha|€\/km|€\/mld|€\/mm|€\/percento|€\/%)\b/i;

const TABULAR_NUM_RE = /[\d.,]+\s*$/;

export function isTabularComputoMetrico(text: string): boolean {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  // Need at least 10 lines that start with a category keyword
  const categoryLines = lines.filter(l => TABULAR_CATEGORIES.test(l.trim()));
  return categoryLines.length >= 10;
}

interface TabularVoce {
  categoria: string;
  descrizione: string;
  um: string;
  quantita: number;
}

interface TabularSection {
  titolo: string;
  voci: TabularVoce[];
}

export function parseTabularComputoMetrico(text: string): { sections: TabularSection[]; totalVoci: number } | null {
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];

  // 1. Normalize: merge continuation lines (lines that don't start with a category)
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    // Check if this line starts with a category
    const isCategoryLine = TABULAR_CATEGORIES.test(line);

    if (isCategoryLine) {
      lines.push(line);
    } else if (lines.length > 0 && !TABULAR_CATEGORIES.test(lines[lines.length - 1])) {
      // Previous line was also not a category line — might be header, skip or merge
      // But if previous line is a section header, keep this
      lines.push(line);
    } else {
      // This could be a continuation of the previous voce's description
      // But in the tabular format, each line is standalone
      lines.push(line);
    }
  }

  // 2. Parse each line
  const voci: TabularVoce[] = [];
  let currentSection = "Generale";
  const sectionSet = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip page markers, headers
    if (/^\s*Pagina\s+\d+/i.test(trimmed)) continue;
    if (/^\s*COMPUTO\s+METRICO/i.test(trimmed)) continue;
    if (/^\s*OPERE\s+/i.test(trimmed) && trimmed.length < 40) continue;
    if (/^\s*SISTEMAZIONE\s+/i.test(trimmed) && !trimmed.includes("  ") && trimmed.length < 60) {
      // Section header like "SISTEMAZIONE FACCIATE"
      currentSection = trimmed;
      sectionSet.add(currentSection);
      continue;
    }
    if (/^\s*Opere\s+interne/i.test(trimmed) && trimmed.length < 60) {
      currentSection = trimmed;
      sectionSet.add(currentSection);
      continue;
    }
    if (/^\s*Opere\s+esterne/i.test(trimmed) && trimmed.length < 60) {
      currentSection = trimmed;
      sectionSet.add(currentSection);
      continue;
    }
    if (/^\s*Facciata/i.test(trimmed) && trimmed.length < 60) {
      currentSection = trimmed;
      sectionSet.add(currentSection);
      continue;
    }

    // Check if starts with a category keyword
    const catMatch = trimmed.match(TABULAR_CATEGORIES);
    if (!catMatch) continue;

    const categoria = catMatch[0].trim();
    const rest = trimmed.slice(categoria.length).trim();

    // Try to find UM and quantity at the end of the line
    // The format is: DESCRIPTION ... UM    QTA
    // We need to extract the last number (quantity) and the word before it (UM)
    const parts = rest.split(/\s{2,}/); // split by 2+ spaces (columns)

    if (parts.length >= 2) {
      // Last part should be quantity
      const lastPart = parts[parts.length - 1].trim();
      const qtyMatch = lastPart.match(/^[\d.,]+\s*$/);
      if (qtyMatch) {
        const quantita = parseEuro(lastPart);
        // Second-to-last part should be UM
        const umPart = parts[parts.length - 2].trim();
        const um = umPart.toLowerCase();
        // Everything before is the description
        const descrizione = parts.slice(0, parts.length - 2).join(" ").trim();
        if (descrizione && quantita > 0) {
          voci.push({ categoria, descrizione, um, quantita });
          continue;
        }
      }
    }

    // Fallback: try to find the last number in the line
    const allTokens = rest.split(/\s+/);
    if (allTokens.length >= 3) {
      const lastToken = allTokens[allTokens.length - 1];
      const qtyMatch = lastToken.match(/^[\d.,]+$/);
      if (qtyMatch) {
        const quantita = parseEuro(lastToken);
        const umToken = allTokens[allTokens.length - 2];
        const um = umToken.toLowerCase();
        const descrizione = allTokens.slice(0, allTokens.length - 2).join(" ").trim();
        if (descrizione && quantita > 0) {
          voci.push({ categoria, descrizione, um, quantita });
        }
      }
    }
  }

  if (voci.length === 0) return null;

  // 3. Group by category into sections
  const sections: TabularSection[] = [];
  const categoryMap = new Map<string, TabularVoce[]>();

  for (const v of voci) {
    if (!categoryMap.has(v.categoria)) {
      categoryMap.set(v.categoria, []);
    }
    categoryMap.get(v.categoria)!.push(v);
  }

  for (const [categoria, catVoci] of categoryMap) {
    sections.push({
      titolo: categoria.charAt(0).toUpperCase() + categoria.slice(1).toLowerCase(),
      voci: catVoci,
    });
  }

  return { sections, totalVoci: voci.length };
}
