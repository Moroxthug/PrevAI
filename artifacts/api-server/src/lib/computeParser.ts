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

function parseEuro(s: string): number {
  const t = s.trim();
  // Italian format: comma = decimal separator, dot = thousands separator
  // BUT if there is NO comma, the dot might be decimal separator (e.g., 16.00)
  // or thousands separator (e.g., 1.000). We distinguish them:
  if (t.includes(",")) {
    // Comma present: comma is decimal, dots are thousands
    return Number(t.replace(/\./g, "").replace(/,/g, ".")) || 0;
  }
  // No comma: check if dot is thousands separator (followed by exactly 3 digits)
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    // e.g., 1.000, 12.500, 1.000.000 — dot is thousands separator
    return Number(t.replace(/\./g, "")) || 0;
  }
  // Dot is decimal separator (e.g., 16.00, 22.50, 0.30)
  return Number(t) || 0;
}

// ───────────────────────────────────────────────────────────────────────────────
// 1. Markdown-style computo metrico (with ## chapters and : QTA × PU €/UM = TOT)
// ───────────────────────────────────────────────────────────────────────────────

export function isComputoMetrico(text: string): boolean {
  const lines = text.split(/\r?\n/);
  const chapterLines = lines.filter(l => l.match(/^##\s+\d+\.\s/));
  const voceLines = lines.filter(l => l.match(/:\s*[\d.,]+\s*[a-zA-Z./°]+\s*[×x]\s*[\d.,]+\s*€\//) || l.match(/=\s*\*\*[\d.,]+\s*€\*\*/));
  return chapterLines.length >= 2 && voceLines.length >= 5;
}

const CHAPTER_RE = /^##\s+\d+\.\s*(.+?)(?:\s*\(.+?\))?\s*$/;
const SUBTOTALE_RE = /Subtotale Categoria:\s*([\d.,]+)\s*€/i;
const VOCE_RE = /:\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*[×x]\s*([\d.,]+)\s*€\/([a-zA-Z./°]+)\s*=\s*\*\*([\d.,]+)\s*€\*\*/;
const VOCE_NO_PU_RE = /:\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*=\s*\*\*([\d.,]+)\s*€\*\*/;
const VOCE_MULTI_RE = /:\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*[×x]\s*([\d.,]+)\s*€\/([a-zA-Z./°]+)\s*[×x]\s*([\d.,]+)\s*([a-zA-Z./°]+)\s*=\s*\*\*([\d.,]+)\s*€\*\*/;

function extractDesc(line: string): string {
  const colonIdx = line.indexOf(":");
  const prefix = colonIdx >= 0 ? line.substring(0, colonIdx) : line;
  return prefix.replace(/^\*+\s*/, "").replace(/\*\*/g, "").trim();
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
    const subtotaleMatch = line.match(SUBTOTALE_RE);
    if (subtotaleMatch) {
      currentChapter.subtotale = parseEuro(subtotaleMatch[1]);
      continue;
    }
    const multiMatch = line.match(VOCE_MULTI_RE);
    if (multiMatch) {
      const [, qty, um, pu, _puUm, qty2, _um2, tot] = multiMatch;
      const q = parseEuro(qty);
      const q2 = parseEuro(qty2);
      const t = parseEuro(tot);
      currentChapter.voci.push({
        descrizione: extractDesc(line), um: um.trim(), quantita: q * q2,
        prezzoUnitario: t / (q * q2), totale: t,
      });
      continue;
    }
    const voceMatch = line.match(VOCE_RE);
    if (voceMatch) {
      const [, qty, um, pu, _puUm, tot] = voceMatch;
      currentChapter.voci.push({
        descrizione: extractDesc(line), um: um.trim(), quantita: parseEuro(qty),
        prezzoUnitario: parseEuro(pu), totale: parseEuro(tot),
      });
      continue;
    }
    const noPuMatch = line.match(VOCE_NO_PU_RE);
    if (noPuMatch) {
      const [, qty, um, tot] = noPuMatch;
      const q = parseEuro(qty);
      const t = parseEuro(tot);
      currentChapter.voci.push({
        descrizione: extractDesc(line), um: um.trim(), quantita: q,
        prezzoUnitario: q > 0 ? t / q : t, totale: t,
      });
      continue;
    }
  }

  if (currentChapter) chapters.push(currentChapter);
  if (chapters.length === 0 || chapters.every(c => c.voci.length === 0)) return null;
  chapters.forEach(c => {
    if (c.subtotale === 0) c.subtotale = c.voci.reduce((sum, v) => sum + v.totale, 0);
  });
  return chapters;
}

// ───────────────────────────────────────────────────────────────────────────────
// 2. Robust tabular computo metrico parser (PDF extracts with multi-line descriptions)
// ───────────────────────────────────────────────────────────────────────────────

// Valid units of measure for a computo metrico (NOT dimensions like cm, mm, lt, l)
const VALID_UMS = [
  "mq", "ml", "mc",
  "n.", "n", "nr", "num", "numero",
  "cpo", "cad", "corpo",
  "kg", "q", "qli", "quint", "quintali",
  "t", "ton", "tonn", "tonnell", "tonnellate",
  "ore", "h", "hh",
  "a.c.", "a.c", "ac",
  "pezzi", "pz", "pzz", "p", "pc", "pe",
  "unità", "u", "ud", "unit",
  "pers",
  "giorni", "gg",
  "settimane", "sett", "settim", "set",
  "mesi", "mese",
  "ann",
  "ha",
  "km",
  "mld",
  "kw", "kwh", "kW", "kWh",
  "voce", "voc", "voci",
  "forfait", "forfett", "globale",
  "€", "euro",
  "m", "mt", "mtr", "mtrl", "mtrli",
  "m2", "m3", "m²", "m³",
  "mtl", "mtli",
  "percento", "%",
];

function isValidUM(token: string): boolean {
  const t = token.toLowerCase().replace(/\.$/, ""); // strip trailing dot
  if (VALID_UMS.includes(t)) return true;
  if (VALID_UMS.includes(token.toLowerCase())) return true;
  // special: "n." with trailing dot
  if (token.toLowerCase() === "n.") return true;
  if (token.toLowerCase() === "cad.") return true;
  return false;
}

/**
 * Try to parse a line as [description] [UM] [quantity].
 * Returns null if the last two tokens are not a valid UM + number.
 */
function tryParseVoceLine(text: string): { descrizione: string; um: string; quantita: number } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  const lastToken = tokens[tokens.length - 1];
  const secondLastToken = tokens[tokens.length - 2];

  // Last token must be a number (quantity)
  const isQta = /^[\d.,]+$/.test(lastToken);
  if (!isQta) return null;
  const quantita = parseEuro(lastToken);
  if (quantita <= 0) return null;

  // Second-to-last token must be a valid UM
  const um = secondLastToken.toLowerCase();
  if (!isValidUM(secondLastToken)) return null;

  // Everything before is the description
  const descrizione = tokens.slice(0, tokens.length - 2).join(" ").trim();
  return { descrizione, um, quantita };
}

// Category keywords that appear at the start of a line
const CATEGORY_RE = /^(Demolizioni|Costruzioni|Impianti|Muratura|Finiture|Strutture|Chiusure|Rasante|Controsoffitti|Impermeabilizzazioni|Pavimentazioni|Rivestimenti|Verniciature|Falegnameria|Infissi|Fabbro|Giardino|Spese|Generale|Varie|Installazioni|Ripristini|Accatastamenti|Trasporti|Smaltimenti|Noleggi|Assistenza|Progetto|Direzione|Collaudi|Certificazioni|Pratiche|Permessi|Documentazione|Geologia|Topografia|Rilievo|sicurezza|Coordinamento|Cantiere|Altro)\b/i;

function startsWithCategory(line: string): { categoria: string; rest: string } | null {
  const match = line.trim().match(CATEGORY_RE);
  if (!match) return null;
  return { categoria: match[0], rest: line.trim().slice(match[0].length).trim() };
}

export interface TabularVoce {
  categoria: string;
  descrizione: string;
  um: string;
  quantita: number;
}

export interface TabularSection {
  titolo: string;
  voci: TabularVoce[];
}

export function isTabularComputoMetrico(text: string): boolean {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const categoryLines = lines.filter(l => CATEGORY_RE.test(l.trim()));
  return categoryLines.length >= 10;
}

/**
 * Robustly parse a tabular computo metrico where descriptions may span multiple lines.
 *
 * Pattern:
 *   Demolizioni  [description on same line or next lines]  [UM]  [QTA]
 *
 * The category can appear on a line by itself, followed by description lines,
 * and the last line(s) may contain UM + QTA.
 */
export function parseTabularComputoMetrico(text: string): { sections: TabularSection[]; totalVoci: number; rawVoci: TabularVoce[] } | null {
  const rawLines = text.split(/\r?\n/).map(l => l.trim());
  const lines: string[] = [];
  for (const l of rawLines) {
    if (l.length === 0) continue;
    // Skip page markers and headers
    if (/^\s*Pagina\s+\d+/i.test(l)) continue;
    if (/^\s*COMPUTO\s+METRICO/i.test(l)) continue;
    if (/^\s*OPERE\s+/i.test(l) && l.length < 40) continue;
    if (/^\s*U\.M\.\s*QTA\s*PRIX/i.test(l)) continue;
    lines.push(l);
  }

  const voci: TabularVoce[] = [];
  let currentCategory: string | null = null;
  let descLines: string[] = [];

  function flushVoce() {
    if (!currentCategory || descLines.length === 0) {
      currentCategory = null;
      descLines = [];
      return;
    }

    // Try the last line as UM+QTA
    const lastLine = descLines[descLines.length - 1];
    const parsed = tryParseVoceLine(lastLine);
    if (parsed) {
      const desc = descLines.slice(0, -1).join(" ").trim();
      const fullDesc = desc ? (desc + " " + parsed.descrizione).trim() : parsed.descrizione;
      if (fullDesc) {
        voci.push({
          categoria: currentCategory,
          descrizione: fullDesc,
          um: parsed.um,
          quantita: parsed.quantita,
        });
      }
    } else {
      // Try to find UM+QTA somewhere in the accumulated lines
      let found = false;
      for (let i = descLines.length - 1; i >= 0; i--) {
        const p = tryParseVoceLine(descLines[i]);
        if (p) {
          const desc = descLines.slice(0, i).join(" ").trim();
          const fullDesc = desc ? (desc + " " + p.descrizione).trim() : p.descrizione;
          if (fullDesc) {
            voci.push({ categoria: currentCategory, descrizione: fullDesc, um: p.um, quantita: p.quantita });
          }
          found = true;
          break;
        }
      }
      if (!found) {
        // Could not parse — this voce is incomplete, discard
        // But log it for debugging
      }
    }
    currentCategory = null;
    descLines = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const catResult = startsWithCategory(line);

    // Section headers
    if (/^SISTEMAZIONE\s+/i.test(line) && line.length < 60) continue;
    if (/^Opere\s+(interne|esterne)/i.test(line) && line.length < 60) continue;
    if (/^Facciata/i.test(line) && line.length < 60) continue;
    if (/^Lato\s+/i.test(line) && line.length < 40) continue;
    if (/^\s*\d+\.\s*\d+/i.test(line)) continue; // skip numbers like 1.00 at start

    if (catResult) {
      // New category line — flush previous voce if any
      if (currentCategory) {
        flushVoce();
      }
      currentCategory = catResult.categoria;
      if (catResult.rest) {
        // Try to parse the rest as a complete voce
        const parsed = tryParseVoceLine(catResult.rest);
        if (parsed) {
          // Complete voce on a single line
          voci.push({
            categoria: currentCategory,
            descrizione: parsed.descrizione,
            um: parsed.um,
            quantita: parsed.quantita,
          });
          currentCategory = null;
          descLines = [];
        } else {
          // Start accumulating description
          descLines = [catResult.rest];
        }
      } else {
        // Category line with no rest — description will follow
        descLines = [];
      }
    } else {
      // Not a category line
      if (currentCategory) {
        descLines.push(line);
      }
    }
  }

  // Flush the last voce
  if (currentCategory && descLines.length > 0) {
    flushVoce();
  }

  if (voci.length === 0) return null;

  // Group by category into sections
  const categoryMap = new Map<string, TabularVoce[]>();
  for (const v of voci) {
    if (!categoryMap.has(v.categoria)) {
      categoryMap.set(v.categoria, []);
    }
    categoryMap.get(v.categoria)!.push(v);
  }

  const sections: TabularSection[] = [];
  for (const [categoria, catVoci] of categoryMap) {
    sections.push({
      titolo: categoria.charAt(0).toUpperCase() + categoria.slice(1).toLowerCase(),
      voci: catVoci,
    });
  }

  return { sections, totalVoci: voci.length, rawVoci: voci };
}

// ───────────────────────────────────────────────────────────────────────────────
// 3. Price estimation for tabular computo voci (deterministic, no AI)
// ───────────────────────────────────────────────────────────────────────────────

export function estimatePriceForVoce(categoria: string, descrizione: string, um: string): number {
  const desc = descrizione.toLowerCase();
  const cat = categoria.toLowerCase();
  const unit = um.toLowerCase();

  const basePrices: Record<string, number> = {
    // Demolizioni
    "demolizione": 45,
    "scavo": 85,
    "scrostamento": 28,
    "rimozione": 40,
    "demolizione tramezzi": 35,
    "demolizione massetto": 35,
    "demolizione solaio": 650,
    "demolizione scala": 1800,
    // Costruzioni / strutture
    "ripristino": 45,
    "intonaco": 42,
    "guaina": 35,
    "impermeabilizzazione": 40,
    "polistirene": 32,
    "membrana": 22,
    "tubazione": 35,
    "tnt": 20,
    "rinterro": 30,
    "formazione": 75,
    "cls": 110,
    "getto": 95,
    "muretto": 280,
    "soletta": 120,
    "scalini": 1800,
    "piastrellatura": 90,
    "pavimentazione": 85,
    "zoccolatura": 28,
    "zoccolino": 22,
    "rivestimento": 75,
    "tramezzi": 65,
    "massetto": 55,
    "canaletta": 75,
    // Ponteggio
    "ponteggio": 28,
    "noleggio": 22,
    // Facciate / cappotto
    "cappotto": 75,
    "rasante": 35,
    "intonachino": 30,
    "grondaia": 22,
    "pluviale": 180,
    "davanzale": 320,
    "soglia": 300,
    "telaio": 1400,
    "monoblocco": 1800,
    "finestra": 900,
    "porta": 1200,
    "porta finestra": 1600,
    // Balconi
    "balcone": 2800,
    // Verniciature
    "verniciatura": 450,
    "pulizia": 380,
    "idropulizia": 25,
    "trattamento": 35,
    // Impianti
    "colonna": 450,
    "fognaria": 55,
    "scarico": 40,
    "elettrico": 550,
    "idraulico": 350,
    "riscaldamento": 2800,
    "caldaia": 2200,
    "termosifoni": 85,
    "radiatore": 320,
    "condizionamento": 1800,
    "split": 1400,
    "vespaio": 45,
    "barriera": 35,
    "igloo": 28,
    // Generico
    "opere": 60,
    "lavori": 55,
    "servizi": 50,
    "messa in sicurezza": 120,
    "apertura": 850,
    "chiusura": 650,
    "adeguamento": 75,
    "rifacimento": 80,
    "realizzazione": 70,
    "posa": 65,
    "installazione": 75,
    "fornitura": 85,
    "spostamento": 55,
  };

  for (const [key, price] of Object.entries(basePrices)) {
    if (desc.includes(key)) return price;
  }

  if (cat.includes("demoliz")) return 40;
  if (cat.includes("costruz")) return 70;
  if (cat.includes("impiant")) return 450;
  if (cat.includes("finitur")) return 55;
  if (cat.includes("vernic")) return 400;
  if (cat.includes("falegn")) return 120;
  if (cat.includes("infiss")) return 1300;
  if (cat.includes("strutture")) return 150;
  if (cat.includes("muratura")) return 250;
  if (cat.includes("chiusure")) return 900;

  if (unit === "mq" || unit === "m2" || unit === "m²") return 65;
  if (unit === "ml" || unit === "m" || unit === "mt" || unit === "mtr") return 35;
  if (unit === "mc" || unit === "m3" || unit === "m³") return 55;
  if (unit === "n." || unit === "n" || unit === "nr" || unit === "num" || unit === "numero") return 1200;
  if (unit === "cpo" || unit === "corpo" || unit === "cad") return 1800;
  if (unit === "kg" || unit === "q" || unit === "qli" || unit === "quint" || unit === "quintali") return 5;
  if (unit === "ore" || unit === "h" || unit === "hh") return 55;
  if (unit === "a.c." || unit === "a.c" || unit === "ac") return 2500;
  if (unit === "pezzi" || unit === "pz" || unit === "pzz" || unit === "p" || unit === "pc" || unit === "pe") return 120;
  if (unit === "unità" || unit === "u" || unit === "ud" || unit === "unit") return 120;
  if (unit === "giorni" || unit === "gg") return 350;
  if (unit === "settimane" || unit === "sett" || unit === "settim" || unit === "set") return 1800;
  if (unit === "mesi" || unit === "mese") return 7200;
  if (unit === "ann") return 86400;
  if (unit === "ha") return 500;
  if (unit === "km") return 80;
  if (unit === "mld") return 3;
  if (unit === "kw" || unit === "kwh" || unit === "kW" || unit === "kWh") return 200;
  if (unit === "voce" || unit === "voc" || unit === "voci") return 150;
  if (unit === "forfait" || unit === "forfett" || unit === "globale") return 2500;
  if (unit === "€" || unit === "euro") return 1;
  if (unit === "percento" || unit === "%") return 1;

  return 80;
}
