import { getPdfmake, pdfInfo } from "../lib/pdfmake.js";
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import { fmtEurCents, fmtIsoDateLong, type ProspettoF24 } from "@workspace/config";

// ── A-3: il prospetto F24 in PDF ─────────────────────────────────────────────
// Deliberatamente **non** un facsimile del modello ministeriale: stessi campi,
// stesso ordine, ma su un foglio nostro, con scritto in testa che va ricopiato.
// Un facsimile inviterebbe a presentarlo com'è allo sportello, dove non
// sarebbe accettato, e a firmarlo come se fosse una delega vera.
//
// Marcatura AI Act art. 50 (V2-6a): `none`. Qui non c'è niente di generato da
// un modello — sono i numeri del motore fiscale, calcolati da regole scritte a
// mano, e dichiararlo "AI-generated" sarebbe falso nell'altro verso.

const INK = "#111827";
const MUTED = "#6b7280";
const RULE = "#d1d5db";
const ALERT = "#b45309";

const cella = (t: string, opts: Partial<{ bold: boolean; align: "right" | "left"; fill: string; color: string; size: number }> = {}): TableCell => ({
  text: t,
  fontSize: opts.size ?? 9,
  bold: opts.bold,
  alignment: opts.align ?? "left",
  fillColor: opts.fill,
  color: opts.color,
});

export async function buildF24Pdf(prospetto: ProspettoF24): Promise<{ buffer: Buffer; filename: string }> {
  const content: Content[] = [];

  content.push({
    columns: [
      {
        stack: [
          { text: "Prospetto per il modello F24", fontSize: 18, bold: true },
          { text: prospetto.titolo, fontSize: 10.5, color: MUTED, margin: [0, 3, 0, 0] },
        ],
      },
      {
        stack: [
          { text: "DA VERSARE ENTRO", fontSize: 7.5, color: MUTED, alignment: "right", characterSpacing: 0.5 },
          { text: fmtIsoDateLong(prospetto.scadenza), fontSize: 12, bold: true, alignment: "right" },
          { text: fmtEurCents(prospetto.totaleCents), fontSize: 15, bold: true, alignment: "right", margin: [0, 2, 0, 0] },
        ],
      },
    ],
    margin: [0, 0, 0, 10],
  });

  content.push({
    table: { widths: ["*"], body: [[{ text: prospetto.avvertenze[0] ?? "", fontSize: 8.5, color: ALERT, margin: [8, 6, 8, 6] }]] },
    layout: { hLineColor: () => ALERT, vLineColor: () => ALERT, hLineWidth: () => 0.6, vLineWidth: () => 0.6 },
    margin: [0, 0, 0, 14],
  });

  content.push({ text: "CONTRIBUENTE", fontSize: 7.5, color: MUTED, characterSpacing: 0.5, margin: [0, 0, 0, 4] });
  content.push({
    table: {
      widths: ["35%", "*"],
      body: prospetto.contribuente.map((c) => [
        cella(c.etichetta, { color: MUTED }),
        cella(c.mancante ? "— da completare —" : c.valore, { bold: !c.mancante, color: c.mancante ? ALERT : INK }),
      ]),
    },
    layout: {
      hLineWidth: (i: number, node) => (i === 0 || i === node.table.body.length ? 0.6 : 0.3),
      vLineWidth: () => 0,
      hLineColor: () => RULE,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 14],
  });

  for (const sezione of prospetto.sezioni) {
    content.push({ text: sezione.titolo.toUpperCase(), fontSize: 7.5, color: MUTED, characterSpacing: 0.5, margin: [0, 0, 0, 4] });
    content.push({
      table: {
        headerRows: 1,
        widths: sezione.colonne.map((_, i) => (i === sezione.colonne.length - 1 ? "*" : "auto")),
        body: [
          sezione.colonne.map((c) => cella(c, { bold: true, size: 8, fill: "#f3f4f6" })),
          ...sezione.righe.map((riga) =>
            riga.map((valore, i) => cella(valore, { align: i === riga.length - 2 ? "right" : "left", bold: i === riga.length - 2 })),
          ),
        ],
      },
      layout: {
        hLineWidth: () => 0.3,
        vLineWidth: () => 0,
        hLineColor: () => RULE,
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 6],
    });
    content.push({
      text: `Totale ${sezione.titolo.toLowerCase()}: ${fmtEurCents(sezione.totaleCents)}`,
      fontSize: 9,
      bold: true,
      alignment: "right",
      margin: [0, 0, 0, 14],
    });
  }

  content.push({
    table: { widths: ["*", "auto"], body: [[cella("SALDO FINALE", { bold: true, size: 10 }), cella(fmtEurCents(prospetto.totaleCents), { bold: true, align: "right", size: 12 })]] },
    layout: { hLineWidth: () => 0.6, vLineWidth: () => 0, hLineColor: () => INK, paddingTop: () => 6, paddingBottom: () => 6 },
    margin: [0, 0, 0, 16],
  });

  for (const avvertenza of prospetto.avvertenze.slice(1)) {
    content.push({ text: avvertenza, fontSize: 8, color: ALERT, margin: [0, 0, 0, 6] });
  }

  content.push({
    text: "Il campo «data di versamento» e la firma li compili tu al momento del pagamento. PrevAI non dispone versamenti e non si collega ad alcun conto.",
    fontSize: 8,
    color: MUTED,
    margin: [0, 6, 0, 0],
  });

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 48],
    defaultStyle: { font: "Helvetica", fontSize: 9.5, color: INK },
    info: pdfInfo({ title: `Prospetto F24 — ${prospetto.titolo}`, subject: "Prospetto per la compilazione del modello F24" }, "none"),
    content,
    footer: (page: number, pages: number) => ({
      columns: [
        { text: "Prospetto generato da PrevAI — non è il modello F24 ufficiale", fontSize: 7.5, color: MUTED },
        { text: `Pagina ${page} di ${pages}`, fontSize: 7.5, color: MUTED, alignment: "right" },
      ],
      margin: [40, 12, 40, 0],
    }),
  };

  const buffer = await getPdfmake().createPdf(doc).getBuffer();
  return { buffer, filename: `F24-${prospetto.scadenzaId}-${prospetto.scadenza}.pdf` };
}
