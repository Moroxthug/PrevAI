// Genera i modelli di preventivo Word (.docx) di src/data/modelli-word.ts in
// public/modelli/. Nessuna dipendenza: un .docx è uno zip di XML
// (WordprocessingML), scritto qui con node:zlib. Data fissa negli zip e nei
// metadati, così i file cambiano solo quando cambiano i dati.
//   pnpm --filter @workspace/preventivo-ai gen:modelli-word
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync, crc32 } from "node:zlib";

import { MODELLI_WORD, fileModello, type ModelloWord } from "../src/data/modelli-word.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../public");
const FIXED_DATE = "2026-10-21T00:00:00Z";

// ─── zip ─────────────────────────────────────────────────────────────────────

function zip(files: { name: string; data: string }[]): Buffer {
  // DOS date/time of FIXED_DATE (2026-10-21 00:00).
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (10 << 5) | 21;
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const raw = Buffer.from(f.data, "utf8");
    const comp = deflateRawSync(raw, { level: 9 });
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 names
    lh.writeUInt16LE(8, 8); // deflate
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);

    offset += lh.length + name.length + comp.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

// ─── WordprocessingML ────────────────────────────────────────────────────────

const NAVY = "1F2A44";
const LIGHT = "EEF1F6";

function x(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface RunOpts { bold?: boolean; size?: number; color?: string; italic?: boolean }

function run(text: string, o: RunOpts = {}): string {
  const rPr = [
    o.bold ? "<w:b/>" : "",
    o.italic ? "<w:i/>" : "",
    o.color ? `<w:color w:val="${o.color}"/>` : "",
    o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : "",
  ].join("");
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
}

interface ParaOpts { align?: "left" | "right" | "center"; after?: number; before?: number; style?: string; keepNext?: boolean }

function para(runs: string | string[], o: ParaOpts = {}): string {
  const pPr = [
    o.style ? `<w:pStyle w:val="${o.style}"/>` : "",
    o.keepNext ? "<w:keepNext/>" : "",
    `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 80}"/>`,
    o.align && o.align !== "left" ? `<w:jc w:val="${o.align === "right" ? "right" : "center"}"/>` : "",
  ].join("");
  return `<w:p><w:pPr>${pPr}</w:pPr>${Array.isArray(runs) ? runs.join("") : runs}</w:p>`;
}

function cell(content: string, width: number, o: { fill?: string; span?: number; align?: "left" | "right" | "center" } = {}): string {
  const tcPr = [
    `<w:tcW w:w="${width}" w:type="dxa"/>`,
    o.span ? `<w:gridSpan w:val="${o.span}"/>` : "",
    o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : "",
    `<w:vAlign w:val="center"/>`,
  ].join("");
  const body = content.startsWith("<w:p>") ? content : para(content, { align: o.align, after: 0 });
  return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${body}</w:tc>`;
}

function table(widths: number[], rows: string[], borders = true): string {
  const b = borders
    ? `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="B8C0CC"/>`).join("")}</w:tblBorders>`
    : `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((k) => `<w:${k} w:val="nil"/>`).join("")}</w:tblBorders>`;
  const total = widths.reduce((a, c) => a + c, 0);
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:jc w:val="right"/>${b}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`;
}

function row(cells: string[], header = false): string {
  return `<w:tr>${header ? "<w:trPr><w:tblHeader/></w:trPr>" : "<w:trPr><w:cantSplit/></w:trPr>"}${cells.join("")}</w:tr>`;
}

function heading(text: string): string {
  return para(run(text, { bold: true, size: 22, color: NAVY }), { before: 240, after: 100, keepNext: true });
}

function bullet(text: string): string {
  return para([run("•  "), run(text)], { after: 40 });
}

const CONDIZIONI_COMUNI = [
  "Validità dell'offerta: 30 giorni dalla data del preventivo.",
  "Tempi di esecuzione: ___ giorni lavorativi dall'accettazione; inizio lavori previsto il __/__/____.",
  "Pagamento: acconto del ___ % all'accettazione, saldo a fine lavori, con bonifico bancario (IBAN ________________).",
  "Eventuali lavori non previsti saranno concordati per iscritto prima dell'esecuzione.",
  "Garanzia sui lavori secondo il Codice civile (artt. 1667 e 1669 c.c.) e, per i consumatori, il Codice del consumo.",
];

function documentXml(m: ModelloWord): string {
  // A4, margini 2 cm: larghezza utile 9638 twip.
  const W = [520, 4318, 900, 900, 1400, 1600];
  const header = row(
    ["N.", "Descrizione", "U.M.", "Q.tà", "Prezzo unit. €", "Importo €"].map((h, i) =>
      cell(para(run(h, { bold: true, color: "FFFFFF", size: 18 }), { align: i >= 4 ? "right" : i >= 2 ? "center" : "left", after: 0 }), W[i], { fill: NAVY })),
    true,
  );
  let n = 0;
  const righe = m.voci.map((v) => {
    if (v.capitolo) {
      return row([cell(para(run(v.capitolo, { bold: true, size: 19, color: NAVY }), { after: 0 }), W.reduce((a, c) => a + c, 0), { span: 6, fill: LIGHT })]);
    }
    n++;
    return row([
      cell(para(run(String(n), { size: 19 }), { after: 0 }), W[0]),
      cell(para(run(v.descrizione ?? "", { size: 19 }), { after: 0 }), W[1]),
      cell(para(run(v.um ?? "", { size: 19 }), { align: "center", after: 0 }), W[2]),
      cell("", W[3]),
      cell("", W[4]),
      cell("", W[5]),
    ]);
  });
  // Righe vuote per voci aggiuntive.
  for (let i = 0; i < 3; i++) {
    righe.push(row([cell("", W[0]), cell("", W[1]), cell("", W[2]), cell("", W[3]), cell("", W[4]), cell("", W[5])]));
  }

  const T = [2800, 1600];
  const totali = table(T, [
    row([cell(para(run("Imponibile", { bold: true }), { after: 0 }), T[0]), cell(para(run("€ "), { align: "right", after: 0 }), T[1])]),
    row([cell(para(run("IVA ___ %"), { after: 0 }), T[0]), cell(para(run("€ "), { align: "right", after: 0 }), T[1])]),
    row([
      cell(para(run("TOTALE", { bold: true, color: "FFFFFF" }), { after: 0 }), T[0], { fill: NAVY }),
      cell(para(run("€ ", { bold: true, color: "FFFFFF" }), { align: "right", after: 0 }), T[1], { fill: NAVY }),
    ]),
  ]);

  const body = [
    para(run("[RAGIONE SOCIALE / NOME DITTA]", { bold: true, size: 30, color: NAVY }), { after: 40 }),
    para(run("Indirizzo · CAP Città (Prov.)", { size: 19, color: "555555" }), { after: 20 }),
    para(run("P.IVA ___________ · C.F. ___________ · Iscr. CCIAA / REA ___________", { size: 19, color: "555555" }), { after: 20 }),
    para(run("Tel. ___________ · Email ___________ · PEC ___________", { size: 19, color: "555555" }), { after: 240 }),

    para(run(`PREVENTIVO N. ____ del __/__/____`, { bold: true, size: 28 }), { after: 60 }),
    para(run(m.titolo, { italic: true, size: 20, color: "555555" }), { after: 200 }),

    table([4819, 4819], [
      row([
        cell([
          para(run("Spett.le cliente", { bold: true, size: 19, color: NAVY }), { after: 40 }),
          para(run("Nome e cognome / ragione sociale: ____________", { size: 19 }), { after: 20 }),
          para(run("Indirizzo: ____________", { size: 19 }), { after: 20 }),
          para(run("C.F. / P.IVA: ____________", { size: 19 }), { after: 20 }),
          para(run("Tel. / email: ____________", { size: 19 }), { after: 0 }),
        ].join(""), 4819),
        cell([
          para(run("Luogo dei lavori", { bold: true, size: 19, color: NAVY }), { after: 40 }),
          para(run("Indirizzo del cantiere: ____________", { size: 19 }), { after: 20 }),
          para(run("Data del sopralluogo: __/__/____", { size: 19 }), { after: 20 }),
          para(run("Riferimento: ____________", { size: 19 }), { after: 0 }),
        ].join(""), 4819),
      ]),
    ]),

    para([run("Oggetto: ", { bold: true }), run(m.oggetto)], { before: 200, after: 80 }),
    para(run("Facendo seguito alla Vostra richiesta, Vi sottoponiamo la nostra migliore offerta per i lavori descritti di seguito.", { size: 20 }), { after: 160 }),

    table(W, [header, ...righe]),
    para("", { after: 120 }),
    totali,
    para(run("IVA: 10% per manutenzione e ristrutturazione su abitazioni (verificare i beni significativi), 22% negli altri casi. In regime forfettario: operazione senza applicazione dell'IVA ai sensi dell'art. 1, commi 54–89, L. 190/2014, con marca da bollo da 2 € oltre 77,47 €.", { size: 16, italic: true, color: "555555" }), { before: 100, after: 100 }),

    heading("Condizioni"),
    ...[...m.condizioni, ...CONDIZIONI_COMUNI].map(bullet),

    heading("Non compreso nel preventivo"),
    ...m.esclusioni.map(bullet),

    heading("Accettazione"),
    para(run("Il cliente dichiara di aver letto e accettato il presente preventivo e le condizioni indicate.", { size: 20 }), { after: 240 }),
    table([4819, 4819], [
      row([
        cell([para(run("L'impresa", { bold: true, size: 19 }), { after: 400 }), para(run("Firma ____________________", { size: 19 }), { after: 0 })].join(""), 4819),
        cell([para(run("Per accettazione, il cliente", { bold: true, size: 19 }), { after: 400 }), para(run("Firma ____________________   Data __/__/____", { size: 19 }), { after: 0 })].join(""), 4819),
      ]),
    ], false),

    para(run("I dati del cliente sono trattati ai sensi del Regolamento UE 2016/679 (GDPR) solo per la gestione del preventivo e dell'eventuale contratto.", { size: 15, color: "777777" }), { before: 300, after: 60 }),
    para(run("Modello gratuito di prevai.it — con prevai lo stesso preventivo si crea in 30 secondi descrivendo il lavoro a parole: https://prevai.it", { size: 15, color: "777777" }), { after: 0 }),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="it-IT"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const APP = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>prevai.it</Application></Properties>`;

function coreXml(m: ModelloWord): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(m.titolo)}</dc:title><dc:subject>Modello di preventivo in Word — ${x(m.mestiere)}</dc:subject><dc:creator>prevai.it</dc:creator><dc:language>it-IT</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${FIXED_DATE}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${FIXED_DATE}</dcterms:modified></cp:coreProperties>`;
}

mkdirSync(join(OUT_DIR, "modelli"), { recursive: true });
for (const m of MODELLI_WORD) {
  const buf = zip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "_rels/.rels", data: RELS },
    { name: "word/document.xml", data: documentXml(m) },
    { name: "word/_rels/document.xml.rels", data: DOC_RELS },
    { name: "word/styles.xml", data: STYLES },
    { name: "docProps/core.xml", data: coreXml(m) },
    { name: "docProps/app.xml", data: APP },
  ]);
  const out = join(OUT_DIR, fileModello(m));
  writeFileSync(out, buf);
  console.log(`  ✓ ${fileModello(m)} (${(buf.length / 1024).toFixed(1)} KB)`);
}
console.log(`Modelli Word: ${MODELLI_WORD.length} file in public/modelli/`);
