// V2-2 — lingua e presentazione denaro/IVA dei documenti preventivo (i tre
// layout pdfmake, il capitolato e il PDF WhatsApp). Unica lingua: italiano.
// Contratti e fatture usano la stessa tabella di formattazione così che ogni
// superficie sia coerente. `lang` resta nelle firme per non spezzare i
// chiamanti ereditati da QuoteAI: vale sempre "it".
import { quoteTaxLines, type TaxBreakdownLine } from "@workspace/db";
import { MARKET, fmtPercent, fmtNumber, QUOTE_DEFAULT_TITLE, QUOTE_NB, QUOTE_ACCEPTANCE_TEXT, QUOTE_FOOTER_NOTE, type Lang } from "@workspace/config";

export type QuoteLang = Lang;

export function resolveQuoteLanguage(_opts: { clientLanguage?: string | null; province?: string | null }): QuoteLang {
  return MARKET.lang;
}

/** Il documento è sempre in italiano; la firma asincrona è conservata per i chiamanti. */
export async function quoteLanguageFor(_quote: { clientId?: string | null; province?: string | null; clientData?: unknown }): Promise<QuoteLang> {
  return MARKET.lang;
}

const Q = {
  defaultTitle: QUOTE_DEFAULT_TITLE,
  quoteNo: "N°",
  taxId: "C.F.",
  gstNo: "P. IVA",
  qstNo: "Cod. SDI",
  tel: "Tel.",
  date: "Data",
  page: "Pagina",
  preparedFor: "SPETT.LE",
  summary: "1. RIEPILOGO",
  detailedBoq: "2. COMPUTO METRICO ESTIMATIVO",
  chapter: "Capitolo",
  chapterSubtotal: "Subtotale capitolo {x}",
  netAmount: "Importo netto",
  notes: "Note",
  standardItem: "Voce standard",
  no: "N°",
  description: "Descrizione",
  unit: "U.M.",
  qty: "Q.tà",
  unitPrice: "Prezzo unit. (€)",
  total: "Totale (€)",
  subtotal: "IMPONIBILE",
  discount: "SCONTO",
  discountedSubtotal: "IMPONIBILE SCONTATO",
  tax: "IVA",
  taxExempt: "OPERAZIONE SENZA IVA",
  grandTotal: "TOTALE IVA INCLUSA",
  paymentTerms: "CONDIZIONI DI PAGAMENTO",
  nb: QUOTE_NB,
  note: "NOTA",
  acceptance: "ACCETTAZIONE DEL PREVENTIVO",
  acceptanceText: QUOTE_ACCEPTANCE_TEXT,
  dateAndLocation: "Data e luogo",
  clientSignature: "Firma del cliente",
  contractorSignature: "Firma dell'impresa",
  draft: "BOZZA",
  provisional: "DOCUMENTO PROVVISORIO – NON VALIDO AI FINI CONTRATTUALI",
  generatedWith: `Documento generato con ${MARKET.brand}`,
  // AI Act art. 50: marcatura visibile dei preventivi elaborati dall'IA (i metadati PDF portano la stessa indicazione).
  generatedWithAi: `Documento generato con ${MARKET.brand} · contenuto elaborato con intelligenza artificiale e verificato dall'impresa`,
  acceptedOnline: "Accettato online da {name} il {date}",
  // capitolato
  specTitle: "CAPITOLATO TECNICO",
  specSubtitle: "Descrizione dettagliata delle lavorazioni",
  scope: "OGGETTO DEI LAVORI",
  item: "Voce",
  quantity: "Quantità",
  // PDF WhatsApp
  quote: "PREVENTIVO",
  client: "Cliente",
  validity: QUOTE_FOOTER_NOTE,
} as const;

export type QKey = keyof typeof Q;

export function qt(key: QKey, _lang?: QuoteLang, vars?: Record<string, string | number>): string {
  let s: string = Q[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** "€ 1.234,56" nei layout (simbolo davanti, come in PrevAI v1). */
export function fmtMoney(amount: number, _lang?: QuoteLang): string {
  return `€ ${fmtNumber(amount, 2)}`;
}

export function fmtQuoteDate(d: Date, _lang?: QuoteLang): string {
  return d.toLocaleDateString(MARKET.locale, { timeZone: MARKET.timeZone });
}

export function fmtRate(rate: number, _lang?: QuoteLang): string {
  return fmtPercent(rate);
}

export type QuoteTaxLine = TaxBreakdownLine & { display: string };

/**
 * Righe IVA di un preventivo (o di una variante): "IVA 22 %", "IVA 10 %",
 * oppure una riga generica "IVA (x %)" quando l'aliquota memorizzata non
 * corrisponde a nessun regime.
 */
export function quoteTaxLinesFor(q: { subtotale: string | number; ivaPercentuale: string | number; ivaValore: string | number; sconto?: { importoScontato?: number } | null }, _province: string | null | undefined, _lang?: QuoteLang): QuoteTaxLine[] {
  const subtotal = Number(q.subtotale);
  const taxable = q.sconto && typeof q.sconto.importoScontato === "number" ? q.sconto.importoScontato : subtotal;
  const rate = Number(q.ivaPercentuale);
  const lines = quoteTaxLines(taxable, rate, Number(q.ivaValore));
  return lines.map((l) => ({
    ...l,
    display: l.code === "TAX" ? `${qt("tax")} (${fmtRate(l.rate)})` : `${l.label} ${fmtRate(l.rate)}`,
  }));
}

/** Numero con separatori italiani (celle di tabella dove il € è in intestazione). */
export function fmtQty(n: number, _lang?: QuoteLang): string {
  return fmtNumber(n, 2);
}
