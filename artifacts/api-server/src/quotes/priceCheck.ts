// PREZZI-1 (docs/PIANO-AZIONE.md riga 53, da QuoteAI fase 79) — controllo
// prezzi di un preventivo. Ogni voce di un preventivo ancora modificabile
// viene cercata per nome fra i dati dell'impresa: il listino
// (Impostazioni → Listino), i prezzi imparati dagli scontrini (quanto paga
// l'impresa, `price_intelligence`) e il suo storico (la mediana di quanto ha
// fatto pagare la stessa voce nei preventivi passati). Una voce è segnalata
// quando il riferimento si discosta di almeno il 5 % o quando è sotto il costo
// dell'ultimo acquisto. Qui solo l'abbinamento e i conti puri; le rotte in
// routes/quotes.ts caricano le righe e scrivono.
import { db, priceCatalogItemsTable, priceIntelligenceTable, quotesTable, type QuoteChapter } from "@workspace/db";
import { and, desc, eq, ne } from "drizzle-orm";

/** Una voce è segnalata quando il riferimento si discosta da quello preventivato almeno di tanto. */
const PRICE_CHECK_THRESHOLD_PCT = 5;
/** Prezzi imparati: la media degli ultimi N scontrini della voce. */
const RECENT_SAMPLES = 5;
/** Servono almeno tanti scontrini (o righe di preventivi passati) prima di fidarsi. */
const MIN_SAMPLES = 3;
/** Quanto devono coincidere due nomi (parole in comune ÷ il nome più corto) per essere la stessa voce. */
const MIN_MATCH_SCORE = 0.6;
/** Quanti preventivi passati guardare per lo storico. */
const HISTORY_QUOTES = 300;

const STOPWORDS = new Set([
  "per", "con", "senza", "del", "della", "delle", "dei", "degli", "dello", "dal", "dalla", "nel", "nella", "nei", "sul", "sulla", "sui", "alla", "alle", "agli", "tra", "fra",
  "fornitura", "posa", "opera", "compreso", "compresa", "incluso", "inclusa", "inclusi", "comprese", "manodopera", "materiale", "materiali", "nuovo", "nuova", "nuovi", "nuove",
  "esistente", "esistenti", "ogni", "onere", "oneri", "completo", "completa", "finito", "finita", "cadauno", "cadauna",
]);

/** Parole minuscole, senza accenti, di 3+ lettere o cifre, senza le parole vuote, in qualunque ordine. */
export function nameTokens(s: string): Set<string> {
  const norm = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const out = new Set<string>();
  for (const w of norm.split(/[^a-z0-9]+/)) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    // singolare/plurale e maschile/femminile alla buona: "piastrelle" e "piastrella" → "piastrell"
    out.add(/^[a-z]{5,}[aeio]$/.test(w) ? w.slice(0, -1) : w);
  }
  return out;
}

/** Parole in comune ÷ l'insieme più piccolo: 1 quando un nome è contenuto nell'altro. */
export function matchScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

const UNIT_ALIASES: Record<string, string> = {
  mq: "mq", m2: "mq", metroquadro: "mq", metriquadri: "mq", metroquadri: "mq",
  mc: "mc", m3: "mc", metrocubo: "mc", metricubi: "mc",
  ml: "ml", m: "ml", metrolineare: "ml", metrilineari: "ml", mt: "ml",
  h: "h", hr: "h", ora: "h", ore: "h",
  gg: "gg", giorno: "gg", giorni: "gg", gior: "gg",
  cad: "cad", n: "cad", nr: "cad", pz: "cad", pezzo: "cad", pezzi: "cad", cadauno: "cad", cadauna: "cad", unita: "cad",
  corpo: "corpo", acorpo: "corpo", forfait: "corpo", forfettario: "corpo", cp: "corpo",
  kg: "kg", q: "q", t: "t", ton: "t", tonnellata: "t",
  l: "l", lt: "l", litro: "l", litri: "l",
  sacco: "sacco", sacchi: "sacco", sc: "sacco", conf: "conf", confezione: "conf", cf: "conf",
};

/** Porta un'unità di misura a una forma sola; "" se ignota, così un'unità sconosciuta non blocca mai l'abbinamento. */
export function normalizeUnit(u: string | null | undefined): string {
  if (!u) return "";
  const k = u.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[²]/g, "2").replace(/[³]/g, "3").replace(/[^a-z0-9]/g, "");
  return UNIT_ALIASES[k] ?? k;
}

type PriceSource = "listino" | "scontrini" | "storico";

export type PriceReference = { key: string; name: string; unit: string | null; unitPrice: number; source: PriceSource; sampleCount: number; vendor: string | null };

type PriceCheckFinding = {
  chapter: string;
  index: number;
  description: string;
  um: string;
  quantita: number;
  quotedUnitPrice: number;
  referenceUnitPrice: number;
  referenceName: string;
  referenceUnit: string | null;
  source: PriceSource;
  sampleCount: number;
  vendor: string | null;
  /** (riferimento − preventivato) ÷ preventivato, in percentuale, un decimale. */
  changePct: number;
  /** Di quanto si sposta il totale della voce se la si riprezza al riferimento. */
  deltaTotal: number;
  /** Il prezzo preventivato è sotto quanto l'impresa ha pagato l'ultima volta. */
  belowCost: boolean;
  /** Margine sulla voce rispetto all'ultimo costo pagato, in percentuale; null senza uno scontrino. */
  marginPct: number | null;
};

export type PriceCheck = { checkedAt: string; thresholdPct: number; linesChecked: number; findings: PriceCheckFinding[]; belowCostCount: number; deltaTotal: number };

// A parità di nome il listino batte lo storico: è un prezzo scelto, non una media.
const SOURCE_RANK: Record<PriceSource, number> = { scontrini: 3, listino: 2, storico: 1 };

function bestReference(description: string, um: string, refs: PriceReference[]): PriceReference | null {
  const tokens = nameTokens(description);
  if (tokens.size === 0) return null;
  const unit = normalizeUnit(um);
  if (unit === "corpo") return null; // a corpo non ha un prezzo unitario da confrontare
  let best: { ref: PriceReference; score: number } | null = null;
  for (const ref of refs) {
    if (ref.unitPrice <= 0) continue;
    const refUnit = normalizeUnit(ref.unit);
    if (unit && refUnit && unit !== refUnit) continue;
    const score = matchScore(tokens, nameTokens(ref.name));
    if (score < MIN_MATCH_SCORE) continue;
    if (!best || score > best.score || (score === best.score && SOURCE_RANK[ref.source] > SOURCE_RANK[best.ref.source])) best = { ref, score };
  }
  return best?.ref ?? null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Puro: quali voci si discostano dal riferimento di almeno la soglia, o stanno sotto l'ultimo costo. */
export function priceCheckChapters(capitoli: QuoteChapter[], refs: PriceReference[], now = new Date()): PriceCheck {
  const findings: PriceCheckFinding[] = [];
  // Gli scontrini sono costi, non prezzi di vendita: fanno da pavimento (sotto costo), non da bersaglio.
  const costRefs = refs.filter((r) => r.source === "scontrini");
  const priceRefs = refs.filter((r) => r.source !== "scontrini");
  let linesChecked = 0;
  for (const cap of capitoli) {
    cap.voci.forEach((v, index) => {
      if (!(v.prezzoUnitario > 0)) return;
      linesChecked++;
      const cost = bestReference(v.descrizione, v.um, costRefs);
      const belowCost = !!cost && v.prezzoUnitario < cost.unitPrice;
      const marginPct = cost ? Math.round(((v.prezzoUnitario - cost.unitPrice) / v.prezzoUnitario) * 1000) / 10 : null;
      // Sotto costo il riferimento è il costo stesso; altrimenti il listino o lo storico.
      const ref = belowCost ? cost : bestReference(v.descrizione, v.um, priceRefs);
      if (!ref) return;
      const changePct = Math.round(((ref.unitPrice - v.prezzoUnitario) / v.prezzoUnitario) * 1000) / 10;
      if (!belowCost && Math.abs(changePct) < PRICE_CHECK_THRESHOLD_PCT) return;
      const deltaTotal = round2((ref.unitPrice - v.prezzoUnitario) * v.quantita);
      findings.push({ chapter: cap.lettera, index, description: v.descrizione, um: v.um, quantita: v.quantita, quotedUnitPrice: v.prezzoUnitario, referenceUnitPrice: ref.unitPrice, referenceName: ref.name, referenceUnit: ref.unit, source: ref.source, sampleCount: ref.sampleCount, vendor: ref.vendor, changePct, deltaTotal, belowCost, marginPct });
    });
  }
  return { checkedAt: now.toISOString(), thresholdPct: PRICE_CHECK_THRESHOLD_PCT, linesChecked, findings, belowCostCount: findings.filter((f) => f.belowCost).length, deltaTotal: round2(findings.reduce((s, f) => s + f.deltaTotal, 0)) };
}

/** Puro: piega gli scontrini (i più recenti per primi) in un riferimento per voce; sotto MIN_SAMPLES la voce si salta. */
export function learnedReferences(rows: { workType: string; unitPrice: string | number; unit: string | null; vendor: string | null }[]): PriceReference[] {
  const groups = new Map<string, { name: string; unit: string | null; prices: number[]; vendors: Map<string, number> }>();
  for (const r of rows) {
    const key = r.workType.trim().toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { name: r.workType.trim(), unit: r.unit, prices: [], vendors: new Map() };
      groups.set(key, g);
    }
    if (g.prices.length >= RECENT_SAMPLES) continue;
    const p = Number(r.unitPrice);
    if (!(p > 0)) continue;
    g.prices.push(p);
    if (r.vendor) g.vendors.set(r.vendor, (g.vendors.get(r.vendor) ?? 0) + 1);
  }
  const out: PriceReference[] = [];
  for (const [key, g] of groups) {
    if (g.prices.length < MIN_SAMPLES) continue;
    const avg = g.prices.reduce((a, b) => a + b, 0) / g.prices.length;
    const vendor = [...g.vendors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    out.push({ key: `scontrini:${key}`, name: g.name, unit: g.unit, unitPrice: round2(avg), source: "scontrini", sampleCount: g.prices.length, vendor });
  }
  return out;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Puro: le righe dei preventivi passati raggruppate per stesse parole e stessa unità; la mediana con almeno MIN_SAMPLES righe. */
export function historyReferences(pastChapters: QuoteChapter[][]): PriceReference[] {
  const groups = new Map<string, { name: string; unit: string; prices: number[] }>();
  for (const capitoli of pastChapters) {
    for (const cap of capitoli) {
      for (const v of cap.voci) {
        const unit = normalizeUnit(v.um);
        if (!(v.prezzoUnitario > 0) || unit === "corpo") continue;
        const tokens = [...nameTokens(v.descrizione)].sort();
        if (tokens.length === 0) continue;
        const key = `${tokens.join(" ")}|${unit}`;
        const g = groups.get(key) ?? { name: v.descrizione.trim(), unit: v.um, prices: [] };
        g.prices.push(v.prezzoUnitario);
        groups.set(key, g);
      }
    }
  }
  const out: PriceReference[] = [];
  for (const [key, g] of groups) {
    if (g.prices.length < MIN_SAMPLES) continue;
    out.push({ key: `storico:${key}`, name: g.name, unit: g.unit, unitPrice: round2(median(g.prices)), source: "storico", sampleCount: g.prices.length, vendor: null });
  }
  return out;
}

/** I riferimenti dell'impresa: voci del listino, prezzi imparati dagli scontrini e storico dei preventivi passati (esclusi quello in esame e le bozze). */
export async function loadPriceReferences(userId: string, excludeQuoteId: string): Promise<PriceReference[]> {
  const [catalog, learned, past] = await Promise.all([
    db.select({ id: priceCatalogItemsTable.id, nome: priceCatalogItemsTable.nome, um: priceCatalogItemsTable.um, prezzo: priceCatalogItemsTable.prezzoUnitario }).from(priceCatalogItemsTable).where(eq(priceCatalogItemsTable.userId, userId)),
    db
      .select({ workType: priceIntelligenceTable.workType, unitPrice: priceIntelligenceTable.unitPrice, unit: priceIntelligenceTable.unit, vendor: priceIntelligenceTable.vendor })
      .from(priceIntelligenceTable)
      .where(eq(priceIntelligenceTable.userId, userId))
      .orderBy(desc(priceIntelligenceTable.createdAt))
      .limit(2000),
    db
      .select({ capitoli: quotesTable.capitoli })
      .from(quotesTable)
      .where(and(eq(quotesTable.userId, userId), ne(quotesTable.id, excludeQuoteId), ne(quotesTable.status, "draft")))
      .orderBy(desc(quotesTable.createdAt))
      .limit(HISTORY_QUOTES),
  ]);
  return [
    ...catalog.map((c): PriceReference => ({ key: `listino:${c.id}`, name: c.nome, unit: c.um, unitPrice: Number(c.prezzo), source: "listino", sampleCount: 1, vendor: null })),
    ...learnedReferences(learned),
    ...historyReferences(past.map((q) => (q.capitoli ?? []) as QuoteChapter[])),
  ];
}

/** Applica nuovi prezzi unitari alle voci indicate e ricalcola ogni totale (capitoli, subtotale, imponibile, IVA, totale). */
export function repriceChapters(
  capitoli: QuoteChapter[],
  changes: { chapter: string; index: number; unitPrice: number }[],
  taxRatePct: number,
  discountPct: number,
): { capitoli: QuoteChapter[]; subtotale: number; sconto: { percentuale: number; importoScontato: number } | null; ivaValore: number; totale: number; applied: number } {
  let applied = 0;
  const next = capitoli.map((cap) => {
    const voci = cap.voci.map((v, i) => {
      const c = changes.find((x) => x.chapter === cap.lettera && x.index === i);
      const prezzoUnitario = c ? c.unitPrice : v.prezzoUnitario;
      if (c && c.unitPrice !== v.prezzoUnitario) applied++;
      return { ...v, prezzoUnitario, totale: round2(v.quantita * prezzoUnitario) };
    });
    return { ...cap, voci, subtotale: round2(voci.reduce((s, v) => s + v.totale, 0)) };
  });
  const subtotale = round2(next.reduce((s, c) => s + c.subtotale, 0));
  const imponibile = discountPct > 0 ? round2(subtotale * (1 - discountPct / 100)) : subtotale;
  const ivaValore = round2(imponibile * (taxRatePct / 100));
  const totale = round2(imponibile + ivaValore);
  return { capitoli: next, subtotale, sconto: discountPct > 0 ? { percentuale: discountPct, importoScontato: imponibile } : null, ivaValore, totale, applied };
}
