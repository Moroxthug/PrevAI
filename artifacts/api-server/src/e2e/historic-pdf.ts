// V2-3 (docs/PIANO-AZIONE.md): render the PDF of real, historic quotes from
// the staging copy of production with the v2 renderer — the check that v2
// draws v1 data correctly (numbering, IVA lines, chapters, company snapshot).
// No storage, no email: the bytes land in .qa/pdfs/historic/.
//
//   pnpm --filter @workspace/api-server qa:historic-pdf            # 5 most recent unlocked quotes
//   pnpm --filter @workspace/api-server qa:historic-pdf <quoteId>  # one specific quote

import { bootstrapQaEnv } from "./qaEnv.js";
bootstrapQaEnv("qa-historic");

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { desc, eq, inArray } from "drizzle-orm";

// Dynamic: static imports are hoisted above bootstrapQaEnv(), and @workspace/db
// reads DATABASE_URL at import time.
const { db, quotesTable, businessProfilesTable } = await import("@workspace/db");
const { generateQuotePdfBuffer } = await import("../quotes/pdf.js");

const outDir = resolve(import.meta.dirname, "../../.qa/pdfs/historic");
mkdirSync(outDir, { recursive: true });

const wanted = process.argv[2];
const quotes = wanted
  ? await db.select().from(quotesTable).where(eq(quotesTable.id, wanted))
  : await db.select().from(quotesTable).where(inArray(quotesTable.status, ["unlocked", "accepted"])).orderBy(desc(quotesTable.createdAt)).limit(5);
if (quotes.length === 0) throw new Error("no quotes found");

let failures = 0;
for (const quote of quotes) {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, quote.userId));
  try {
    const pdf = await generateQuotePdfBuffer(quote, profile ?? null, false);
    if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("not a PDF");
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    const file = resolve(outDir, `${quote.id}.pdf`);
    writeFileSync(file, pdf);
    console.log(`ok   ${quote.id}  ${quote.numeroPreventivoData ?? "(no number)"}  IVA ${quote.ivaPercentuale}%  totale ${quote.totale}  ${pages} pages  ${pdf.byteLength} B`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${quote.id}  ${(err as Error).message}`);
  }
}
console.log(`\n${quotes.length - failures}/${quotes.length} rendered → ${outDir}`);
process.exit(failures ? 1 : 0);
