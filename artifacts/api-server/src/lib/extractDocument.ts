import { createRequire } from "node:module";
import { logger } from "./logger.js";

const _require = createRequire(import.meta.url);

export async function extractFromPdf(buffer: Buffer): Promise<string> {
  let pdfText = "";
  try {
    const { PDFParse } = _require("pdf-parse") as {
      PDFParse: new (opts: { data: Buffer }) => {
        getText(): Promise<{ text: string }>;
        destroy(): Promise<void>;
      };
    };
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy().catch(() => {});
    pdfText = result.text.slice(0, 50000);
  } catch (err) {
    logger.warn({ err }, "pdf-parse failed, falling back to empty text");
  }
  return pdfText.trim();
}

export async function extractFromDocx(buffer: Buffer): Promise<string> {
  let docText = "";
  try {
    const mammoth = _require("mammoth") as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    docText = result.value.slice(0, 50000);
  } catch (err) {
    logger.warn({ err }, "mammoth failed, falling back to empty text");
  }
  return docText.trim();
}

export async function extractFromXlsx(buffer: Buffer): Promise<string> {
  let sheetText = "";
  try {
    const XLSX = _require("xlsx") as {
      read: (data: Buffer, opts: { type: "buffer" }) => {
        SheetNames: string[];
        Sheets: Record<string, unknown>;
      };
      utils: {
        sheet_to_csv: (sheet: unknown) => string;
      };
    };
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const csvParts: string[] = [];
    for (const sheetName of workbook.SheetNames.slice(0, 3)) {
      const sheet = workbook.Sheets[sheetName];
      if (sheet) {
        csvParts.push(`--- ${sheetName} ---\n${XLSX.utils.sheet_to_csv(sheet)}`);
      }
    }
    sheetText = csvParts.join("\n\n").slice(0, 50000);
  } catch (err) {
    logger.warn({ err }, "xlsx failed, falling back to empty text");
  }
  return sheetText.trim();
}
