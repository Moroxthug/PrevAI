import type { Invoice, InvoiceParty, InvoicePayment } from "@workspace/db";
import { provinceName as provinciaNome } from "@workspace/db";
import { MARKET, fmtEurCents, fmtNumber, type Lang } from "@workspace/config";

// ── Rendering fatture: etichette + HTML ──────────────────────────────────────
// Il PDF (pdf.ts) e la pagina pubblica / email condividono queste etichette
// così il cliente vede lo stesso documento ovunque. Requisiti art. 21 DPR
// 633/72: dati del cedente con P. IVA, data e numero, dati del cessionario,
// descrizione, imponibile e IVA per aliquota, totale. Senza il modulo
// Amministrazione la fattura è "pro-forma" (V2-4, D3); con l'invio allo SdI
// attivo (A-1) il documento è una fattura e il PDF una copia di cortesia:
// le etichette che cambiano stanno in `I_FISCALE`.

export type { Lang };

export const I = {
  invoice: "Fattura pro-forma",
  creditNote: "Nota di credito pro-forma",
  invoiceNo: "Pro-forma n.",
  creditNoteNo: "Nota di credito pro-forma n.",
  /** Stampato su PDF, pagina pubblica ed email finché non c'è l'export SDI (V2-4, D3). */
  proformaNotice: "Documento pro-forma: non costituisce fattura ai sensi dell'art. 21 DPR 633/72 e non ha valore fiscale. La fattura elettronica sarà emessa tramite il Sistema di Interscambio (SDI).",
  issued: "Emessa il",
  due: "Scadenza",
  dueOnReceipt: "Pagamento a vista",
  from: "Emittente",
  billTo: "Intestata a",
  site: "Cantiere",
  job: "Commessa",
  contract: "Contratto",
  description: "Descrizione",
  qty: "Q.tà",
  unit: "Prezzo unitario",
  amount: "Importo",
  subtotal: "Imponibile",
  holdback: "Meno ritenuta a garanzia",
  holdbackNote: "La ritenuta a garanzia è trattenuta come previsto dal contratto (art. 1666 c.c.) e sarà fatturata, con l'IVA applicabile, al collaudo o allo scadere del periodo di garanzia pattuito.",
  taxable: "Imponibile netto",
  total: "Totale da pagare",
  creditTotal: "Importo a credito",
  paid: "Pagato",
  balance: "Residuo da pagare",
  payment: "Modalità di pagamento",
  paymentTerm: "Rata",
  bankTransfer: "Bonifico bancario — IBAN",
  cheque: "Assegno intestato a",
  reference: "Indicare il numero del documento nella causale del pagamento.",
  notes: "Note",
  vat: "P. IVA",
  cf: "C.F.",
  rea: "N° REA / albo",
  customerTaxId: "P. IVA / C.F.",
  email: "Email",
  phone: "Tel.",
  status_draft: "BOZZA",
  status_void: "ANNULLATA",
  status_paid: "PAGATA",
  status_overdue: "SCADUTA",
  status_partially_paid: "PARZIALMENTE PAGATA",
  page: "Pagina",
  refersTo: "Storno della pro-forma",
  netDays: "{n} giorni data fattura",
  type_deposit: "Acconto",
  type_progress: "SAL — stato avanzamento lavori",
  type_final: "Saldo finale",
  type_holdback_release: "Svincolo ritenuta a garanzia",
  type_change_order: "Variante in corso d'opera",
  type_manual: "Fattura pro-forma",
  type_credit_note: "Nota di credito pro-forma",
  paymentsReceived: "Pagamenti ricevuti",
  method_cheque: "Assegno",
  method_cash: "Contanti",
  method_card: "Carta",
  method_bank_transfer: "Bonifico bancario",
  method_credit_note: "Nota di credito",
  method_other: "Altro",
  thanks: "Grazie per la fiducia.",
} satisfies Record<string, string>;

export type IKey = keyof typeof I;

/**
 * A-1: le etichette cambiano quando il documento è una fattura vera (serie
 * FT-, XML trasmesso allo SdI). Il PDF resta una **copia di cortesia**:
 * l'originale è il file elettronico nel cassetto fiscale del cliente.
 */
export const I_FISCALE: Partial<Record<IKey, string>> = {
  invoice: "Fattura",
  creditNote: "Nota di credito",
  invoiceNo: "Fattura n.",
  creditNoteNo: "Nota di credito n.",
  proformaNotice:
    "Copia di cortesia. L'originale è la fattura elettronica trasmessa al Sistema di Interscambio (SdI) dell'Agenzia delle Entrate e disponibile nel cassetto fiscale del destinatario.",
  refersTo: "Storno della fattura",
  type_manual: "Fattura",
  type_credit_note: "Nota di credito",
};

export function ti(key: IKey, _lang?: Lang): string {
  return I[key];
}

/** Etichetta del documento: pro-forma o fattura, secondo `invoices.fiscale`. */
export function tiDoc(inv: { fiscale?: boolean | null }, key: IKey, _lang?: Lang): string {
  return (inv.fiscale ? I_FISCALE[key] : undefined) ?? I[key];
}

/** Le etichette IVA sono già italiane ("IVA"); conservata per i chiamanti. */
export function taxLabel(label: string, _lang?: Lang): string {
  return label;
}

export function fmtCents(cents: number, _lang?: Lang): string {
  return fmtEurCents(cents);
}

export function fmtDay(d: Date | string | null | undefined, _lang?: Lang): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(MARKET.locale, { dateStyle: "long", timeZone: MARKET.timeZone });
}

export function fmtQty(q: number, _lang?: Lang): string {
  return fmtNumber(q, Number.isInteger(q) ? 0 : 2);
}

export function provinceName(code: string | null | undefined, _lang?: Lang): string {
  return provinciaNome(code);
}

export function isCreditNote(inv: Pick<Invoice, "type">): boolean {
  return inv.type === "credit_note";
}

export function invoiceTitle(inv: Pick<Invoice, "type" | "title"> & { fiscale?: boolean | null }, lang: Lang): string {
  return inv.title || tiDoc(inv, `type_${inv.type}` as IKey, lang);
}

export function partyLines(p: InvoiceParty, lang: Lang, opts: { registration: boolean }): string[] {
  const lines = [
    p.address ?? "",
    [p.city, p.province, p.postalCode].filter(Boolean).join(", "),
    p.email ? `${ti("email", lang)}: ${p.email}` : "",
    p.phone ? `${ti("phone", lang)}: ${p.phone}` : "",
  ];
  if (opts.registration) {
    if (p.vatNumber) lines.push(`${ti("vat", lang)}: ${p.vatNumber}`);
    if (p.codiceFiscale) lines.push(`${ti("cf", lang)}: ${p.codiceFiscale}`);
    if (p.reaNumber) lines.push(`${ti("rea", lang)}: ${p.reaNumber}`);
  } else if (p.businessNumber) {
    lines.push(`${ti("customerTaxId", lang)}: ${p.businessNumber}`);
  }
  return lines.filter(Boolean);
}

export function dueText(inv: Pick<Invoice, "issueDate" | "dueDate">, lang: Lang): string {
  const days = Math.round((inv.dueDate.getTime() - inv.issueDate.getTime()) / 86_400_000);
  if (days <= 0) return `${ti("dueOnReceipt", lang)}`;
  return `${fmtDay(inv.dueDate, lang)} · ${ti("netDays", lang).replace("{n}", String(days))}`;
}

export function watermark(inv: Pick<Invoice, "status" | "totalCents" | "paidCents">): IKey | null {
  if (inv.status === "draft") return "status_draft";
  if (inv.status === "void") return "status_void";
  if (inv.status === "paid") return "status_paid";
  if (inv.status === "overdue") return "status_overdue";
  if (inv.status === "partially_paid") return "status_partially_paid";
  return null;
}

// ── HTML ─────────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const INVOICE_CSS = `
.inv { font-family: system-ui,-apple-system,"Segoe UI",sans-serif; color:#111827; font-size:14px; line-height:1.5; position:relative; }
.inv .wm { position:absolute; right:0; top:0; font-size:12px; font-weight:800; letter-spacing:0.12em; padding:4px 10px; border-radius:6px; border:2px solid currentColor; }
.inv .wm.draft { color:#92400e; } .inv .wm.void { color:#991b1b; } .inv .wm.paid { color:#047857; } .inv .wm.overdue { color:#b91c1c; } .inv .wm.partially_paid { color:#1d4ed8; }
.inv h1 { font-size:24px; margin:0 0 2px; letter-spacing:-0.01em; }
.inv .sub { color:#6b7280; font-size:13px; margin-bottom:20px; }
.inv .meta { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
.inv .party-label { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280; margin-bottom:2px; }
.inv .party-name { font-weight:700; font-size:15px; }
.inv .party-line { font-size:12.5px; color:#374151; }
.inv table.kv { font-size:13px; border-collapse:collapse; margin-bottom:16px; }
.inv table.kv th { text-align:left; color:#6b7280; font-weight:600; padding:2px 16px 2px 0; font-size:12px; white-space:nowrap; }
.inv table.kv td { padding:2px 0; }
.inv table.grid { width:100%; border-collapse:collapse; font-size:13px; margin:8px 0 12px; }
.inv table.grid th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:#6b7280; border-bottom:1px solid #d1d5db; padding:6px 8px; }
.inv table.grid td { padding:7px 8px; border-bottom:1px solid #f3f4f6; vertical-align:top; }
.inv table.grid .num { text-align:right; white-space:nowrap; }
.inv table.totals { width:100%; max-width:360px; margin-left:auto; border-collapse:collapse; font-size:13.5px; }
.inv table.totals td { padding:5px 8px; }
.inv table.totals tr.total td { font-weight:800; font-size:16px; border-top:2px solid #111827; background:#f9fafb; }
.inv table.totals tr.muted td { color:#6b7280; }
.inv table.totals tr.balance td { font-weight:700; color:#047857; }
.inv .box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:10px; padding:12px 16px; margin:20px 0 8px; font-size:13px; }
.inv .box h3 { margin:0 0 6px; font-size:12px; text-transform:uppercase; letter-spacing:0.06em; color:#5b21b6; }
.inv .note { font-size:12px; color:#5b5f6b; margin-top:8px; }
.inv .thanks { margin-top:18px; color:#374151; font-size:13px; }
.inv .table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
.inv .table-wrap:focus-visible { outline:2px solid #1e3a5f; outline-offset:2px; }
@media (max-width: 480px) {
  .inv .meta { grid-template-columns:1fr; gap:12px; }
  .inv table.grid th, .inv table.grid td { padding:6px 4px; font-size:12px; }
  .inv table.totals { max-width:none; }
}
`;

export function renderInvoiceHtml(inv: Invoice, payments: InvoicePayment[] = []): string {
  const lang = MARKET.lang;
  const credit = isCreditNote(inv);
  const parts: string[] = [];
  const wm = watermark(inv);
  if (wm) parts.push(`<div class="wm ${inv.status}">${ti(wm, lang)}</div>`);
  parts.push(`<h1>${esc(invoiceTitle(inv, lang))}</h1>`);
  parts.push(`<div class="sub">${credit ? tiDoc(inv, "creditNoteNo", lang) : tiDoc(inv, "invoiceNo", lang)} <strong>${esc(inv.number)}</strong> · ${ti("issued", lang)} ${fmtDay(inv.issueDate, lang)}${credit ? "" : ` · ${ti("due", lang)}: ${esc(dueText(inv, lang))}`}</div>`);

  const party = (label: string, p: InvoiceParty, registration: boolean) =>
    `<div><div class="party-label">${label}</div><div class="party-name">${esc(p.name)}</div>${partyLines(p, lang, { registration }).map((l) => `<div class="party-line">${esc(l)}</div>`).join("")}</div>`;
  parts.push(`<div class="meta">${party(ti("from", lang), inv.contractor, true)}${party(ti("billTo", lang), inv.customer, false)}</div>`);

  const kv: string[] = [];
  if (inv.siteAddress) kv.push(`<tr><th>${ti("site", lang)}</th><td>${esc(inv.siteAddress)}</td></tr>`);
  if (inv.paymentTermLabel) kv.push(`<tr><th>${ti("paymentTerm", lang)}</th><td>${esc(inv.paymentTermLabel)}</td></tr>`);
  if (kv.length) parts.push(`<table class="kv">${kv.join("")}</table>`);

  const rows = inv.lines
    .map((l) => `<tr><td>${esc(l.description)}</td><td class="num">${fmtQty(l.quantity, lang)}</td><td class="num">${fmtCents(l.unitCents, lang)}</td><td class="num">${fmtCents(l.amountCents, lang)}</td></tr>`)
    .join("");
  parts.push(`<div class="table-wrap" tabindex="0" role="region" aria-label="${ti("description", lang)}"><table class="grid"><thead><tr><th>${ti("description", lang)}</th><th class="num">${ti("qty", lang)}</th><th class="num">${ti("unit", lang)}</th><th class="num">${ti("amount", lang)}</th></tr></thead><tbody>${rows}</tbody></table></div>`);

  const totals: string[] = [];
  totals.push(`<tr><td>${ti("subtotal", lang)}</td><td class="num">${fmtCents(inv.subtotalCents, lang)}</td></tr>`);
  if (inv.holdbackCents > 0) {
    totals.push(`<tr><td>${ti("holdback", lang)} (${inv.holdbackPercent}%)</td><td class="num">− ${fmtCents(inv.holdbackCents, lang)}</td></tr>`);
    totals.push(`<tr class="muted"><td>${ti("taxable", lang)}</td><td class="num">${fmtCents(inv.taxableCents, lang)}</td></tr>`);
  }
  for (const t of inv.taxLines) {
    totals.push(`<tr><td>${esc(taxLabel(t.label, lang))} ${t.rate} %${t.registrationNumber ? ` <span style="color:#6b7280">(${esc(t.registrationNumber)})</span>` : ""}</td><td class="num">${fmtCents(t.amountCents, lang)}</td></tr>`);
  }
  totals.push(`<tr class="total"><td>${credit ? ti("creditTotal", lang) : ti("total", lang)}</td><td class="num">${fmtCents(inv.totalCents, lang)}</td></tr>`);
  if (!credit && inv.paidCents > 0 && inv.status !== "void") {
    totals.push(`<tr class="muted"><td>${ti("paid", lang)}</td><td class="num">− ${fmtCents(inv.paidCents, lang)}</td></tr>`);
    totals.push(`<tr class="balance"><td>${ti("balance", lang)}</td><td class="num">${fmtCents(Math.max(0, inv.totalCents - inv.paidCents), lang)}</td></tr>`);
  }
  parts.push(`<table class="totals">${totals.join("")}</table>`);
  if (inv.holdbackCents > 0) parts.push(`<p class="note">${ti("holdbackNote", lang)}</p>`);

  if (!credit && inv.status !== "void" && inv.status !== "paid") {
    const pi = inv.paymentInstructions ?? {};
    const lines: string[] = [];
    if (pi.iban) lines.push(`<div>${ti("bankTransfer", lang)} <strong>${esc(pi.iban)}</strong></div>`);
    if (pi.chequePayableTo) lines.push(`<div>${ti("cheque", lang)} <strong>${esc(pi.chequePayableTo)}</strong></div>`);
    if (pi.note) lines.push(`<div>${esc(pi.note)}</div>`);
    if (lines.length) parts.push(`<div class="box"><h3>${ti("payment", lang)}</h3>${lines.join("")}<div class="note">${ti("reference", lang)}</div></div>`);
  }

  if (payments.length > 0 && !credit) {
    const prow = payments.map((p) => `<tr><td>${fmtDay(p.date, lang)}</td><td>${ti(`method_${p.method}` as IKey, lang)}${p.reference ? ` · ${esc(p.reference)}` : ""}</td><td class="num">${fmtCents(p.amountCents, lang)}</td></tr>`).join("");
    parts.push(`<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;margin:16px 0 4px">${ti("paymentsReceived", lang)}</h3><table class="grid"><tbody>${prow}</tbody></table>`);
  }

  if (inv.notes) parts.push(`<div class="note"><strong>${ti("notes", lang)}:</strong> ${esc(inv.notes).replace(/\n/g, "<br/>")}</div>`);
  parts.push(`<p class="thanks">${ti("thanks", lang)}</p>`);
  return `<div class="inv">${parts.join("\n")}</div>`;
}
