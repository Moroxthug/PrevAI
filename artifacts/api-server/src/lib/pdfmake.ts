import pdfmake from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

// pdfmake's default export is ONE shared object. Until Phase 63 each PDF
// module (quotes, WhatsApp quote, invoices, contracts) assigned its own
// `lib.fonts = {…}` on that object and cached the result locally — so the
// last module to initialise won, and a warm function instance that had
// rendered an invoice (Roboto only) would then crash every contract signing
// with "Font 'Serif' in style 'bold' is not defined". Register the union
// once, here, and have every module take its instance from this file.

export type PdfMakeInstance = {
  fonts: Record<string, Record<string, string>>;
  createPdf(docDef: TDocumentDefinitions): { getBuffer(): Promise<Buffer> };
};

const HELVETICA = { normal: "Helvetica", bold: "Helvetica-Bold", italics: "Helvetica-Oblique", bolditalics: "Helvetica-BoldOblique" };
const TIMES = { normal: "Times-Roman", bold: "Times-Bold", italics: "Times-Italic", bolditalics: "Times-BoldItalic" };

export const PDF_FONTS: Record<string, Record<string, string>> = {
  Roboto: HELVETICA, // pdfmake's default font name, mapped onto the built-in Helvetica
  Helvetica: HELVETICA,
  Serif: TIMES, // contracts
};

// V2-6 — AI Act art. 50(2): i documenti generati o assistiti dall'IA portano
// la marcatura nei metadati PDF (Info dictionary: Subject + Keywords), così
// che lettori e archivi la riconoscano senza aprire il file. La stessa
// provenienza compare anche nel piè di pagina visibile (quotes/pdf.ts).
export type PdfProvenance = "ai" | "ai_assisted" | "none";

export const PDF_AI_KEYWORDS: Record<Exclude<PdfProvenance, "none">, string> = {
  ai: "AI-generated, contenuto generato con intelligenza artificiale, AI Act art. 50",
  ai_assisted: "AI-assisted, bozza redatta con l'ausilio di intelligenza artificiale e rivista dall'impresa, AI Act art. 50",
};

export const PDF_AI_SUBJECT: Record<Exclude<PdfProvenance, "none">, string> = {
  ai: "Documento generato con intelligenza artificiale (AI Act art. 50)",
  ai_assisted: "Documento redatto con l'ausilio di intelligenza artificiale (AI Act art. 50)",
};

type PdfInfo = NonNullable<TDocumentDefinitions["info"]>;

/** Metadati `info` di pdfmake: creator/producer PrevAI più la marcatura IA quando la provenienza lo richiede. */
export function pdfInfo(base: { title: string; author?: string; subject?: string }, provenance: PdfProvenance): PdfInfo {
  const info: PdfInfo = { ...base, creator: "PrevAI", producer: "PrevAI" };
  if (provenance !== "none") {
    info.subject = base.subject ? `${base.subject} — ${PDF_AI_SUBJECT[provenance]}` : PDF_AI_SUBJECT[provenance];
    info.keywords = PDF_AI_KEYWORDS[provenance];
  }
  return info;
}

let _instance: PdfMakeInstance | null = null;

export function getPdfmake(): PdfMakeInstance {
  if (_instance) return _instance;
  const lib = pdfmake as unknown as PdfMakeInstance;
  lib.fonts = PDF_FONTS;
  _instance = lib;
  return lib;
}
