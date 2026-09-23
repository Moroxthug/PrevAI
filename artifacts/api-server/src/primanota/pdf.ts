import { getPdfmake, pdfInfo } from "../lib/pdfmake.js";
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import { fmtEurCents, fmtIsoDateLong, guidaFaiDaTe } from "@workspace/config";
import type { Pacchetto } from "./chiusura.js";
import type { ChiusuraAnno } from "@workspace/db";

// ── A-4: il pacchetto dell'anno in PDF ───────────────────────────────────────
// Quello che il titolare stampa o manda al commercialista. Come il prospetto
// F24 di A-3, non imita un modello ministeriale: è un foglio nostro che dice in
// testa che cosa è e che cosa non è.
//
// Marcatura AI Act art. 50: `none` — numeri del motore fiscale, regole scritte
// a mano, nessun contenuto generato da un modello.

const INK = "#111827";
const MUTED = "#6b7280";
const RULE = "#d1d5db";
const ALERT = "#b45309";

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const cella = (t: string, opts: Partial<{ bold: boolean; align: "right" | "left"; fill: string; color: string; size: number }> = {}): TableCell => ({
  text: t,
  fontSize: opts.size ?? 9,
  bold: opts.bold,
  alignment: opts.align ?? "left",
  fillColor: opts.fill,
  color: opts.color,
});

const layoutRighe = {
  hLineWidth: () => 0.3,
  vLineWidth: () => 0,
  hLineColor: () => RULE,
  paddingTop: () => 4,
  paddingBottom: () => 4,
};

function titoloSezione(t: string): Content {
  return { text: t.toUpperCase(), fontSize: 7.5, color: MUTED, characterSpacing: 0.5, margin: [0, 10, 0, 4] };
}

export async function buildPacchettoPdf(p: Pacchetto, chiusura: ChiusuraAnno | undefined): Promise<{ buffer: Buffer; filename: string }> {
  const content: Content[] = [];

  content.push({
    columns: [
      {
        stack: [
          { text: `Chiusura dell'anno ${p.anno}`, fontSize: 18, bold: true },
          { text: [p.impresa.denominazione, p.impresa.partitaIva ? `P. IVA ${p.impresa.partitaIva}` : "", p.impresa.codiceFiscale ? `C.F. ${p.impresa.codiceFiscale}` : ""].filter(Boolean).join(" · "), fontSize: 10, color: MUTED, margin: [0, 3, 0, 0] },
        ],
      },
      {
        stack: [
          { text: "GENERATO IL", fontSize: 7.5, color: MUTED, alignment: "right", characterSpacing: 0.5 },
          { text: fmtIsoDateLong(p.generatoAt.slice(0, 10)), fontSize: 11, bold: true, alignment: "right" },
          chiusura && chiusura.stato === "chiuso"
            ? { text: `Anno chiuso (versione ${chiusura.versione})`, fontSize: 8.5, color: MUTED, alignment: "right", margin: [0, 2, 0, 0] }
            : { text: "Anno non ancora chiuso", fontSize: 8.5, color: ALERT, alignment: "right", margin: [0, 2, 0, 0] },
        ],
      },
    ],
    margin: [0, 0, 0, 10],
  });

  content.push({
    table: { widths: ["*"], body: [[{ stack: p.prospetto.avvertenze.map((a) => ({ text: a, fontSize: 8.5, color: ALERT, margin: [0, 1, 0, 1] })), margin: [8, 5, 8, 5] }]] },
    layout: { hLineColor: () => ALERT, vLineColor: () => ALERT, hLineWidth: () => 0.6, vLineWidth: () => 0.6 },
    margin: [0, 0, 0, 6],
  });

  // Prospetto per la dichiarazione
  content.push(titoloSezione(`Prospetto per il modello Redditi PF ${p.prospetto.annoPresentazione} — invio entro il ${fmtIsoDateLong(p.prospetto.termineInvio)}`));
  content.push({
    table: {
      headerRows: 1,
      widths: ["auto", "*", "auto"],
      body: [
        [cella("Rigo", { bold: true, size: 8, fill: "#f3f4f6" }), cella("Voce", { bold: true, size: 8, fill: "#f3f4f6" }), cella("Valore", { bold: true, size: 8, fill: "#f3f4f6", align: "right" })],
        ...p.prospetto.righi.map((r) => [
          cella(r.rigo, { bold: true }),
          { stack: [{ text: r.descrizione, fontSize: 9 }, ...(r.nota ? [{ text: r.nota, fontSize: 7.5, color: MUTED }] : [])] } as TableCell,
          cella(r.valore, { align: "right", bold: r.importoCents !== undefined }),
        ]),
      ],
    },
    layout: layoutRighe,
  });

  // Utile netto
  const u = p.utile;
  content.push(titoloSezione("Utile netto dopo le tasse"));
  content.push({
    table: {
      widths: ["*", "auto"],
      body: [
        [cella("Ricavi incassati"), cella(fmtEurCents(u.ricaviCents), { align: "right" })],
        [cella("Costi pagati"), cella("− " + fmtEurCents(u.costiCents), { align: "right" })],
        [cella("Margine prima delle tasse", { bold: true }), cella(fmtEurCents(u.margineCents), { align: "right", bold: true })],
        [cella("Imposta sostitutiva di competenza"), cella("− " + fmtEurCents(u.impostaCents), { align: "right" })],
        [cella("Contributi previdenziali di competenza"), cella("− " + fmtEurCents(u.contributiCents), { align: "right" })],
        ...(u.bolloCents > 0 ? [[cella("Imposta di bollo"), cella("− " + fmtEurCents(u.bolloCents), { align: "right" })]] : []),
        [cella("Utile netto", { bold: true, size: 10 }), cella(fmtEurCents(u.utileNettoCents), { align: "right", bold: true, size: 10 })],
      ],
    },
    layout: layoutRighe,
  });
  content.push({
    text: `Nel forfettario i costi reali non riducono l'imposta: il coefficiente del ${p.profilo.coefficientePercent} % dà per scontati costi pari a ${fmtEurCents(u.costiPresuntiCents)}; quelli registrati sono ${fmtEurCents(u.costiCents)}.`,
    fontSize: 8,
    color: MUTED,
    margin: [0, 4, 0, 0],
  });

  // Prima nota mese per mese
  const t = p.primaNota.totali;
  content.push(titoloSezione("Prima nota — entrate e uscite per mese"));
  content.push({
    table: {
      headerRows: 1,
      widths: ["*", "auto", "auto", "auto"],
      body: [
        ["Mese", "Entrate", "Uscite", "Saldo"].map((h, i) => cella(h, { bold: true, size: 8, fill: "#f3f4f6", align: i === 0 ? "left" : "right" })),
        ...t.mesi.map((m) => [
          cella(MESI[m.mese - 1]!),
          cella(fmtEurCents(m.entrateCents), { align: "right" }),
          cella(fmtEurCents(m.usciteCents), { align: "right" }),
          cella(fmtEurCents(m.entrateCents - m.usciteCents), { align: "right" }),
        ]),
        [cella("Totale", { bold: true }), cella(fmtEurCents(t.entrateCents), { align: "right", bold: true }), cella(fmtEurCents(t.usciteCents), { align: "right", bold: true }), cella(fmtEurCents(t.saldoCents), { align: "right", bold: true })],
      ],
    },
    layout: layoutRighe,
  });
  content.push({
    text: `Di cui: incassi di fatture ${fmtEurCents(t.incassiCents)}, altri ricavi ${fmtEurCents(t.altriRicaviCents)}, costi ${fmtEurCents(t.costiCents)}, tasse e contributi versati ${fmtEurCents(t.versamentiCents)}, prelievi/apporti/giroconti ${fmtEurCents(t.movimentiNeutriCents)}. Estratto conto: ${p.banca.daAbbinare.n} movimenti ancora da abbinare.`,
    fontSize: 8,
    color: MUTED,
    margin: [0, 4, 0, 0],
  });
  for (const a of p.primaNota.avvisi) content.push({ text: "• " + a.testo, fontSize: 8, color: ALERT, margin: [0, 2, 0, 0] });

  // Versamenti
  content.push(titoloSezione(`Versamenti registrati per l'anno ${p.anno}`));
  if (p.versamenti.length === 0) {
    content.push({ text: "Nessun versamento registrato in PrevAI per questo anno.", fontSize: 9, color: MUTED });
  } else {
    content.push({
      table: {
        headerRows: 1,
        widths: ["auto", "*", "auto", "auto"],
        body: [
          ["Data", "Tipo", "Codice", "Importo"].map((h, i) => cella(h, { bold: true, size: 8, fill: "#f3f4f6", align: i === 3 ? "right" : "left" })),
          ...p.versamenti.map((v) => [cella(v.data.split("-").reverse().join("/")), cella(v.tipo.replace(/_/g, " ")), cella(v.codiceTributo || "—"), cella(fmtEurCents(v.importoCents), { align: "right" })]),
        ],
      },
      layout: layoutRighe,
    });
  }

  // Guida
  content.push(titoloSezione("Se la presenti da solo"));
  content.push({
    ol: guidaFaiDaTe(p.anno).map((g) => ({ text: [{ text: g.titolo + ". ", bold: true }, g.testo], fontSize: 8.5, margin: [0, 0, 0, 3] })),
  });

  if (chiusura && chiusura.stato === "chiuso") {
    content.push({ text: `Impronta della chiusura (sha256): ${chiusura.impronta}`, fontSize: 7, color: MUTED, margin: [0, 12, 0, 0] });
  }

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 48],
    defaultStyle: { font: "Helvetica", fontSize: 9.5, color: INK },
    info: pdfInfo({ title: `Chiusura dell'anno ${p.anno} — ${p.impresa.denominazione}`, subject: "Prospetto per la dichiarazione dei redditi (regime forfettario)" }, "none"),
    content,
    footer: (page: number, pages: number) => ({
      columns: [
        { text: "Prospetto generato da PrevAI — non è la dichiarazione dei redditi", fontSize: 7.5, color: MUTED },
        { text: `Pagina ${page} di ${pages}`, fontSize: 7.5, color: MUTED, alignment: "right" },
      ],
      margin: [40, 12, 40, 0],
    }),
  };

  const buffer = await getPdfmake().createPdf(doc).getBuffer();
  return { buffer, filename: `chiusura-${p.anno}.pdf` };
}
