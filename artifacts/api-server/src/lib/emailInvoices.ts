import { MARKET, fmtEurCents, fmtDateLong } from "@workspace/config";
import { logger } from "./logger.js";
import { shell, escapeHtml, type EmailLang } from "./emailContracts.js";
import { sendCustomerEmail } from "./connectedEmailSend.js";

// ── Email fatture (Phase 4) ──────────────────────────────────────────────────
// Stessa veste grafica delle email contratti. Ogni email porta il PDF e un
// link alla pagina pubblica della fattura (/i/:token) dove il cliente vede
// residuo e modalità di pagamento.

const eur = (cents: number) => fmtEurCents(cents);
const day = (d: Date) => fmtDateLong(d);

type Common = {
  toEmail: string;
  userId: string;
  customerName: string;
  companyName: string;
  number: string;
  totalCents: number;
  balanceCents: number;
  dueDate: Date;
  publicUrl: string;
  language?: EmailLang;
  iban?: string | null;
  replyTo?: string | null;
};

function summaryBox(p: Common, t: { invoice: string; due: string; total: string; balance: string; bankTransfer: string }): string {
  return `<div class="box">
    <div class="row"><span class="label">${t.invoice}</span><span><strong>${escapeHtml(p.number)}</strong></span></div>
    <div class="row"><span class="label">${t.due}</span><span>${day(p.dueDate)}</span></div>
    ${p.iban ? `<div class="row"><span class="label">${t.bankTransfer}</span><span>${escapeHtml(p.iban)}</span></div>` : ""}
    ${p.balanceCents !== p.totalCents ? `<div class="row"><span class="label">${t.total}</span><span>${eur(p.totalCents)}</span></div>` : ""}
    <div class="row"><span class="label">${t.balance}</span><span>${eur(p.balanceCents)}</span></div>
  </div>`;
}

/** V2-4 (D3): finché non c'è l'export SDI il documento non è una fattura fiscale — va detto anche nell'email. */
const PROFORMA_NOTICE = "Si tratta di un documento pro-forma senza valore fiscale: la fattura elettronica sarà emessa tramite il Sistema di Interscambio.";
/** A-1: col modulo attivo l'originale è l'XML nel cassetto fiscale; il PDF allegato è una cortesia. */
const FATTURA_NOTICE = "Il PDF allegato è una copia di cortesia: l'originale è la fattura elettronica trasmessa al Sistema di Interscambio e disponibile nel tuo cassetto fiscale.";

const greet = (name: string) => `Gentile ${escapeHtml(name || "cliente")}`;

export async function sendInvoiceEmail(params: Common & { pdfBuffer: Buffer; message?: string; isCreditNote?: boolean; typeLabel: string; fiscale?: boolean }): Promise<void> {
  const company = escapeHtml(params.companyName);
  const cn = params.isCreditNote;
  // A-1: con il modulo Amministrazione il documento è una fattura vera.
  const doc = params.fiscale ? "fattura" : "fattura pro-forma";
  const nota = params.fiscale ? "nota di credito" : "nota di credito pro-forma";
  const Doc = params.fiscale ? "Fattura" : "Fattura pro-forma";
  const Nota = params.fiscale ? "Nota di credito" : "Nota di credito pro-forma";
  const t = {
    title: cn ? Nota : `${params.typeLabel} — ${params.number}`,
    sub: `${params.companyName}`,
    body: cn
      ? `${greet(params.customerName)},<br/><br/><strong>${company}</strong> ti ha emesso una ${nota}. Il documento è allegato a questa email e il saldo è stato aggiornato di conseguenza.`
      : `${greet(params.customerName)},<br/><br/><strong>${company}</strong> ti ha inviato una ${doc} per i tuoi lavori. Il PDF è allegato; puoi consultarla anche online insieme alle modalità di pagamento. ${params.fiscale ? FATTURA_NOTICE : PROFORMA_NOTICE}`,
    btn: cn ? "Vedi la nota di credito" : params.fiscale ? "Vedi la fattura e paga" : "Vedi la pro-forma e paga",
    footer: `${params.fiscale ? "Fattura inviata" : "Pro-forma inviata"} tramite ${MARKET.brand} per conto di ${company}. Domande? Rispondi direttamente a ${company}.`,
    subject: cn ? `${Nota} ${params.number} di ${params.companyName}` : `${Doc} ${params.number} di ${params.companyName} — ${eur(params.balanceCents)}`,
    invoice: cn ? "Nota di credito" : params.fiscale ? "Fattura" : "Pro-forma", due: "Scadenza", total: "Totale", balance: cn ? "Importo" : "Da pagare", bankTransfer: "Bonifico — IBAN",
  };
  const html = shell({
    accent: cn ? "linear-gradient(135deg,#0f766e,#06b6d4)" : undefined,
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p>${params.message ? `<div class="msg">${escapeHtml(params.message)}</div>` : ""}${summaryBox(params, t)}<div class="cta"><a class="btn" href="${params.publicUrl}">${t.btn}</a></div>`,
    footer: t.footer,
  });
  await sendCustomerEmail({
    userId: params.userId,
    toEmail: params.toEmail,
    fromDisplayName: params.companyName,
    replyTo: params.replyTo,
    subject: t.subject,
    html,
    attachments: [{ filename: `${params.number}.pdf`, content: params.pdfBuffer.toString("base64") }],
  });
  logger.info({ to: params.toEmail, number: params.number }, "Invoice email sent");
}

export async function sendInvoiceReminderEmail(params: Common & { daysOverdue: number; pdfBuffer?: Buffer }): Promise<void> {
  const company = escapeHtml(params.companyName);
  const t = {
    title: "Promemoria di pagamento", sub: `Pro-forma ${params.number}`,
    body: `${greet(params.customerName)},<br/><br/>un gentile promemoria: la fattura pro-forma <strong>${escapeHtml(params.number)}</strong> di <strong>${company}</strong>, scaduta il ${day(params.dueDate)}, presenta un residuo di <strong>${eur(params.balanceCents)}</strong>. Se hai già pagato, ignora questo messaggio.`,
    btn: "Vedi la pro-forma e paga", subject: `Promemoria — pro-forma ${params.number} (${eur(params.balanceCents)})`, footer: `Inviato tramite ${MARKET.brand} per conto di ${company}.`,
    invoice: "Pro-forma", due: "Scaduta il", total: "Totale", balance: "Da pagare", bankTransfer: "Bonifico — IBAN",
  };
  const html = shell({ accent: "linear-gradient(135deg,#d97706,#f97316)", headerTitle: t.title, headerSub: t.sub, bodyHtml: `<p>${t.body}</p>${summaryBox(params, t)}<div class="cta"><a class="btn" href="${params.publicUrl}">${t.btn}</a></div>`, footer: t.footer });
  await sendCustomerEmail({
    userId: params.userId,
    toEmail: params.toEmail,
    fromDisplayName: params.companyName,
    replyTo: params.replyTo,
    subject: t.subject,
    html,
    ...(params.pdfBuffer ? { attachments: [{ filename: `${params.number}.pdf`, content: params.pdfBuffer.toString("base64") }] } : {}),
  });
}

export async function sendPaymentReceiptEmail(params: Common & { paidCents: number; paidOn: Date }): Promise<void> {
  const company = escapeHtml(params.companyName);
  const settled = params.balanceCents <= 0;
  const t = {
    title: settled ? "Pagamento ricevuto — grazie!" : "Pagamento parziale ricevuto", sub: `Pro-forma ${params.number}`,
    body: `${greet(params.customerName)},<br/><br/><strong>${company}</strong> conferma di aver ricevuto il tuo pagamento di <strong>${eur(params.paidCents)}</strong> il ${day(params.paidOn)} per la pro-forma ${escapeHtml(params.number)}.${settled ? " La pro-forma è ora interamente pagata; la fattura elettronica seguirà tramite SDI." : ` Residuo: <strong>${eur(params.balanceCents)}</strong>.`}`,
    btn: "Vedi la pro-forma", subject: settled ? `Ricevuta — pro-forma ${params.number} pagata` : `Ricevuta — pagamento di ${eur(params.paidCents)} sulla pro-forma ${params.number}`, footer: `Inviato tramite ${MARKET.brand} per conto di ${company}.`,
    invoice: "Pro-forma", due: "Scadenza", total: "Totale", balance: "Residuo", bankTransfer: "Bonifico — IBAN",
  };
  const html = shell({ accent: "linear-gradient(135deg,#059669,#06b6d4)", headerTitle: t.title, headerSub: t.sub, bodyHtml: `<p>${t.body}</p>${summaryBox({ ...params, iban: settled ? null : params.iban }, t)}<div class="cta"><a class="btn" href="${params.publicUrl}">${t.btn}</a></div>`, footer: t.footer });
  await sendCustomerEmail({ userId: params.userId, toEmail: params.toEmail, fromDisplayName: params.companyName, replyTo: params.replyTo, subject: t.subject, html });
}
