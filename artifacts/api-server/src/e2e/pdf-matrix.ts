// Phase 67 — render every PDF the product produces across the matrix
// provincia (MI/NA) × logo (con/senza) × documento, più il preventivo lungo
// da 30 righe che forza i salti pagina. Files land in
// .qa/pdfs/<province>-<logo>/… for eyeballing; the script checks that each
// renders, is a PDF, reports the page count and — since V2-6 — that the text has
// no English residue and the AI Act art. 50 marking is where it belongs (exit 1 otherwise).
//
//   pnpm --filter @workspace/api-server qa:pdf
//   E2E_NO_PURGE=1 pnpm --filter @workspace/api-server qa:pdf   # while qa:visual is running

import { bootstrapQaEnv, captureResend } from "./qaEnv.js";

process.env.LOG_LEVEL ??= "warn";
bootstrapQaEnv("qa-pdf");

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const OUT = resolve(import.meta.dirname, "../../.qa/pdfs");

const mailbox = await captureResend();
const { installVendorStubs } = await import("./vendorStub.js");
installVendorStubs();
const { db, businessProfilesTable, invoicesTable, quotesTable, contractsTable } = await import("@workspace/db");
const { eq, and } = await import("drizzle-orm");
const { startServer, stopServer, createOrg, cleanupAll } = await import("./harness.js");
const { seedShowcase, setSignTokenCapture, loadShowcaseRows } = await import("./fixtures.js");
const { generateQuotePdfBuffer, generateCapitolatoPdfBuffer } = await import("../quotes/pdf.js");
const { generateQuoteWhatsappPdfBuffer } = await import("../lib/generateQuoteWhatsappPdfBuffer.js");
const { contractPdfBuffer, createContractFromQuote } = await import("../contracts/service.js");
const { invoicePdfBuffer, buildInvoiceContext, createInvoice } = await import("../invoices/service.js");

setSignTokenCapture(() => {
  for (let i = mailbox.length - 1; i >= 0; i--) {
    const l = mailbox[i]!.links.find((x) => x.includes("/sign/"));
    if (l) return l.split("/sign/")[1]!.split(/[/?#]/)[0]!;
  }
  return null;
});

type Row = { dir: string; file: string; pages: number | null; bytes: number; error?: string };
const rows: Row[] = [];

function pageCount(buf: Buffer): number | null {
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
  const m = buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g);
  return m ? m.length : null;
}

// V2-6 — l'audit i18n del frontend non copre i template PDF del backend: qui
// ogni PDF renderizzato viene riletto (pdf-parse) e si controlla che il testo
// non contenga residui inglesi ereditati da QuoteAI e che la marcatura AI Act
// art. 50 (metadati Keywords/Subject + riga a piè di pagina) ci sia solo dove
// deve: preventivi = IA, contratti = bozza assistita, fatture = nessuna.
const _require = createRequire(import.meta.url);
const { PDFParse } = _require("pdf-parse") as {
  PDFParse: new (opts: { data: Uint8Array }) => {
    getText(): Promise<{ text: string }>;
    getInfo(): Promise<{ info?: Record<string, unknown> }>;
    destroy(): Promise<void>;
  };
};
// Intestazioni e etichette QuoteAI: le fixture usano solo nomi/descrizioni italiane, quindi ogni match è un residuo.
const ENGLISH_RESIDUE = /\b(Unit Price|Total \(\$\)|Subtotal|Quote No|Prepared for|Payment terms|Grand total|Invoice|Contractor|Customer|Signature|Page \d+ of|Quantity|Amount due|Due date|Balance due|Holdback|Deposit|Milestone|GST|HST|QST|PST)\b/;
type Provenance = "ai" | "ai_assisted" | "none";
function expectedProvenance(file: string): Provenance {
  if (file.startsWith("quote-")) return "ai";
  if (file.startsWith("contract-")) return "ai_assisted";
  return "none";
}
async function lintPdf(file: string, buf: Buffer): Promise<string[]> {
  const problems: string[] = [];
  // pdfjs trasferisce i dati a un worker: gli si passa una copia Uint8Array, non il Buffer di pdfmake.
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    // Chiamate in sequenza: getText/getInfo in parallelo sullo stesso parser trasferiscono due volte i dati al worker e falliscono.
    const { text: rawText } = await parser.getText();
    const { info } = await parser.getInfo();
    const text = rawText.replace(/\s+/g, " ");
    const en = text.match(ENGLISH_RESIDUE);
    if (en) problems.push(`residuo inglese nel testo: "${en[0]}"`);
    const keywords = String(info?.Keywords ?? "");
    const subject = String(info?.Subject ?? "");
    const want = expectedProvenance(file);
    const marked = /AI Act art\. 50/.test(keywords);
    if (want === "none" && marked) problems.push("fattura marcata come IA");
    if (want !== "none" && !marked) problems.push("manca la marcatura IA nei metadati (Keywords)");
    if (want === "ai" && !/AI-generated/.test(keywords)) problems.push("Keywords senza AI-generated");
    if (want === "ai_assisted" && !/AI-assisted/.test(keywords)) problems.push("Keywords senza AI-assisted");
    if (want !== "none" && !/intelligenza artificiale/.test(subject)) problems.push("Subject senza indicazione IA");
    if (String(info?.Creator ?? "") !== "PrevAI") problems.push(`Creator = ${String(info?.Creator)}`);
    // La riga "contenuto elaborato con intelligenza artificiale" va sui preventivi definitivi;
    // le bozze portano al suo posto DOCUMENTO PROVVISORIO, il capitolato ha il proprio piè di pagina.
    const isQuoteFinal = want === "ai" && !file.includes("watermark") && !file.includes("capitolato");
    if (isQuoteFinal && !/intelligenza artificiale/.test(text)) problems.push("manca la riga IA a piè di pagina");
  } finally {
    await parser.destroy().catch(() => {});
  }
  return problems;
}

async function emit(dir: string, file: string, make: () => Promise<Buffer>) {
  const abs = resolve(OUT, dir);
  mkdirSync(abs, { recursive: true });
  try {
    const buf = await make();
    writeFileSync(resolve(abs, file), buf);
    const pages = pageCount(buf);
    const lint = pages === null ? [] : await lintPdf(file, buf);
    rows.push({ dir, file, pages, bytes: buf.length, error: pages === null ? "not a PDF" : lint.length ? lint.join("; ") : undefined });
    console.log(`${dir}/${file}`.padEnd(64), pages === null ? "NOT A PDF" : `${pages} page(s), ${(buf.length / 1024).toFixed(0)} KB${lint.length ? `  ✗ ${lint.join("; ")}` : ""}`);
  } catch (e) {
    rows.push({ dir, file, pages: null, bytes: 0, error: (e as Error).message.slice(0, 200) });
    console.log(`${dir}/${file}`.padEnd(64), `ERROR ${(e as Error).message.slice(0, 120)}`);
  }
}

rmSync(OUT, { recursive: true, force: true });
try {
  await startServer();
  for (const province of ["MI", "NA"] as const) {
    for (const withLogo of [true, false]) {
      const dir = `${province}-${withLogo ? "logo" : "nologo"}`;
      const org = await createOrg({ province, companyName: province === "NA" ? "Ristrutturazioni Esposito Srl" : "Ristrutturazioni Nord Srl" });
      const s = await seedShowcase(org, { withLogo });
      const { quote, longQuote, invoice } = await loadShowcaseRows(s);
      const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));

      await emit(dir, "quote-standard.pdf", () => generateQuotePdfBuffer(quote, profile ?? null, false));
      await emit(dir, "quote-long-30-lines.pdf", () => generateQuotePdfBuffer(longQuote, profile ?? null, false));
      await emit(dir, "quote-long-watermark-trial.pdf", () => generateQuotePdfBuffer(longQuote, profile ?? null, true));
      await emit(dir, "quote-capitolato-long.pdf", () => generateCapitolatoPdfBuffer(longQuote, profile ?? null));
      await emit(dir, "quote-whatsapp-long.pdf", () => generateQuoteWhatsappPdfBuffer(longQuote, profile ?? null));

      await emit(dir, `contract-signed-${s.language}.pdf`, async () => (await contractPdfBuffer(s.contractId)).buffer);
      await emit(dir, `contract-sent-unsigned-${s.language}.pdf`, async () => (await contractPdfBuffer(s.pendingContractId)).buffer);
      await emit(dir, `contract-draft-long.pdf`, async () => {
        const { contract } = await createContractFromQuote({ userId: org.userId, quoteId: s.longQuoteId, language: "it", actor: "contractor" });
        return (await contractPdfBuffer(contract.id)).buffer;
      });

      await emit(dir, `invoice-progress-partly-paid-${s.language}.pdf`, async () => (await invoicePdfBuffer(invoice.id)).buffer);
      const deposit = (await db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, s.jobId), eq(invoicesTable.type, "deposit"))))[0];
      if (deposit) await emit(dir, `invoice-deposit-draft-${s.language}.pdf`, async () => (await invoicePdfBuffer(deposit.id)).buffer);
      await emit(dir, `invoice-manual-long.pdf`, async () => {
        const ctx = await buildInvoiceContext({ userId: org.userId, language: "it" });
        const lines = Array.from({ length: 28 }, (_, i) => ({ description: `Line ${i + 1} — ${i % 4 === 0 ? "supply and install of finish carpentry, including all trims, casings and caulking" : "labour"}`, quantity: 1 + (i % 3), unitCents: 12_500 + i * 1_000, amountCents: (1 + (i % 3)) * (12_500 + i * 1_000) }));
        const inv = await createInvoice({ userId: org.userId, ctx, type: "manual", source: "manual", actor: "contractor", dueDays: 30, lines });
        return (await invoicePdfBuffer(inv.id)).buffer;
      });

      // Sanity: the two chains share the same tax profile on the quote row.
      const [q] = await db.select({ ivaPercentuale: quotesTable.ivaPercentuale, totale: quotesTable.totale }).from(quotesTable).where(eq(quotesTable.id, s.quoteId));
      const [c] = await db.select({ language: contractsTable.language, total: contractsTable.variables }).from(contractsTable).where(eq(contractsTable.id, s.contractId));
      console.log(`  ${dir}: quote tax ${q?.ivaPercentuale}% total ${q?.totale} · contract ${c?.language} total ${(c?.total as { total?: number } | null)?.total}`);
    }
  }
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify(rows, null, 2));
  const bad = rows.filter((r) => r.error);
  console.log(`\n[qa-pdf] ${rows.length} PDFs → ${OUT}${bad.length ? ` — ${bad.length} FAILED` : ""}`);
} finally {
  await cleanupAll().catch((e) => console.error("[qa-pdf] cleanup failed", e));
  await stopServer();
}
process.exit(rows.some((r) => r.error) ? 1 : 0);
