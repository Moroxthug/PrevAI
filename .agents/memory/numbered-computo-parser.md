---
name: Numbered computo metrico parser
description: Critical pitfalls in parseNumberedComputoMetrico for Italian "A. Demolizioni + N° rows + Subtotale capitolo" format
---

## The rule

The section header regex in `parseNumberedComputoMetrico` MUST end with `$` and contain only letters/spaces — no optional `€` suffix. The correct pattern is:

```
/^([A-Z])\.\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]*)$/
```

**Why:** Italian computo PDFs have a QUADRO SINTETICO section before the COMPUTO METRICO DETTAGLIATO. Both sections contain chapter headers like "A. Demolizioni", but the quadro sintetico version has "€ 18.442,00  Voce ordinaria" appended. If the regex matches these summary rows, it creates empty sections A/B/C/D/E first. Then when the REAL detail section headers appear, the "don't re-open same section" guard fires → `currentSection = null` → ALL voci are discarded silently.

**How to apply:** Any time you touch the section-header detection in `parseNumberedComputoMetrico` (computeParser.ts), verify the regex has a strict `$` end anchor and does NOT contain `(?:€.*)?` or similar optional suffixes that would allow € amounts to pass through.

## Voce descriptions must be enriched by AI

The deterministic paths (numbered and tabular) extract SHORT descriptions from the PDF (e.g. "Rimozione marciapiede in CLS"). These are just titles — not the professional capitolato-style descriptions the user expects.

Fix: after deterministic extraction (prices/quantities fixed), call `enrichVociDescrizioni(chapters)` which fires ONE `gpt-4o-mini` call to expand ALL voce descriptions into `"shortTitle\nTechnical capitolato description"` format. Prices/quantities/UMs are NEVER touched. Falls back to short descriptions silently if AI fails.

Both numbered AND tabular paths must call this function before setting `aiData`.

## Secondary lesson

Never add "don't re-open same letter section" logic to this parser. The quadro sintetico problem is solved at the regex level. Re-open guards only mask symptoms while causing actual data loss.

## Chapter descriptions

The `getChapterDescription(titolo)` function in quotes.ts provides professional Italian osservazione text for each chapter type (Demolizioni, Costruzioni, Giardino, Muratura, Generale, etc.). Both deterministic paths (numbered and tabular) must call this instead of hardcoding "Voce ordinaria".
