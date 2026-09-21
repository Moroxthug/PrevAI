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
  etransferEmail?: string | null;
  replyTo?: string | null;
};

function summaryBox(p: Common, t: { invoice: string; due: string; total: string; balance: string; etransfer: string }): string {
  return `<div class="box">
    <div class="row"><span class="label">${t.invoice}</span><span><strong>${escapeHtml(p.number)}</strong></span></div>
    <div class="row"><span class="label">${t.due}</span><span>${day(p.dueDate)}</span></div>
    ${p.etransferEmail ? `<div class="row"><span class="label">${t.etransfer}</span><span>${escapeHtml(p.etransferEmail)}</span></div>` : ""}
    ${p.balanceCents !== p.totalCents ? `<div class="row"><span class="label">${t.total}</span><span>${eur(p.totalCents)}</span></div>` : ""}
    <div class="row"><span class="label">${t.balance}</span><span>${eur(p.balanceCents)}</span></div>
  </div>`;
}

const greet = (name: string) => `Gentile ${escapeHtml(name || "cliente")}`;

export async function sendInvoiceEmail(params: Common & { pdfBuffer: Buffer; message?: string; isCreditNote?: boolean; typeLabel: string }): Promise<void> {
  const company = escapeHtml(params.companyName);
  const cn = params.isCreditNote;
  const t = {
    title: cn ? "Nota di credito" : `${params.typeLabel} — ${params.number}`,
    sub: `${params.companyName}`,
    body: cn
      ? `${greet(params.customerName)},<br/><br/><strong>${company}</strong> ti ha emesso una nota di credito. Il documento è allegato a questa email e il saldo della tua fattura è stato aggiornato di conseguenza.`
      : `${greet(params.customerName)},<br/><br/><strong>${company}</strong> ti ha inviato una fattura per i tuoi lavori. Il PDF è allegato; puoi consultarla anche online insieme alle modalità di pagamento.`,
    btn: cn ? "Vedi la nota di credito" : "Vedi la fattura e paga",
    footer: `Fattura inviata tramite ${MARKET.brand} per conto di ${company}. Domande? Rispondi direttamente a ${company}.`,
    subject: cn ? `Nota di credito ${params.number} di ${params.companyName}` : `Fattura ${params.number} di ${params.companyName} — ${eur(params.balanceCents)}`,
    invoice: cn ? "Nota di credito" : "Fattura", due: "Scadenza", total: "Totale", balance: cn ? "Importo" : "Da pagare", etransfer: "Bonifico — IBAN",
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
    title: "Promemoria di pagamento", sub: `Fattura ${params.number}`,
    body: `${greet(params.customerName)},<br/><br/>un gentile promemoria: la fattura <strong>${escapeHtml(params.number)}</strong> di <strong>${company}</strong>, scaduta il ${day(params.dueDate)}, presenta un residuo di <strong>${eur(params.balanceCents)}</strong>. Se hai già pagato, ignora questo messaggio.`,
    btn: "Vedi la fattura e paga", subject: `Promemoria — fattura ${params.number} (${eur(params.balanceCents)})`, footer: `Inviato tramite ${MARKET.brand} per conto di ${company}.`,
    invoice: "Fattura", due: "Scaduta il", total: "Totale", balance: "Da pagare", etransfer: "Bonifico — IBAN",
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
    title: settled ? "Pagamento ricevuto — grazie!" : "Pagamento parziale ricevuto", sub: `Fattura ${params.number}`,
    body: `${greet(params.customerName)},<br/><br/><strong>${company}</strong> conferma di aver ricevuto il tuo pagamento di <strong>${eur(params.paidCents)}</strong> il ${day(params.paidOn)} per la fattura ${escapeHtml(params.number)}.${settled ? " La fattura è ora interamente pagata." : ` Residuo: <strong>${eur(params.balanceCents)}</strong>.`}`,
    btn: "Vedi la fattura", subject: settled ? `Ricevuta — fattura ${params.number} pagata` : `Ricevuta — pagamento di ${eur(params.paidCents)} sulla fattura ${params.number}`, footer: `Inviato tramite ${MARKET.brand} per conto di ${company}.`,
    invoice: "Fattura", due: "Scadenza", total: "Totale", balance: "Residuo", etransfer: "Bonifico — IBAN",
  };
  const html = shell({ accent: "linear-gradient(135deg,#059669,#06b6d4)", headerTitle: t.title, headerSub: t.sub, bodyHtml: `<p>${t.body}</p>${summaryBox({ ...params, etransferEmail: settled ? null : params.etransferEmail }, t)}<div class="cta"><a class="btn" href="${params.publicUrl}">${t.btn}</a></div>`, footer: t.footer });
  await sendCustomerEmail({ userId: params.userId, toEmail: params.toEmail, fromDisplayName: params.companyName, replyTo: params.replyTo, subject: t.subject, html });
}
