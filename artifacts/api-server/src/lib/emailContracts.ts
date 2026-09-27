import { MARKET, fmtEur, fmtDateLong, type Lang } from "@workspace/config";
import { logger } from "./logger.js";
import { getBaseUrl } from "./baseUrl.js";
import { sendCustomerEmail } from "./connectedEmailSend.js";
import { resendOrThrow } from "./emailUtils.js";

export { resendOrThrow };

// ── Email contratti (Phase 1) ────────────────────────────────────────────────
// Modulo separato così email.ts (preventivi/abbonamenti) resta leggibile.

const LOGO_URL = `${getBaseUrl()}/prevai-logo.png`;
export const FROM = `${MARKET.brand} <no-reply@${MARKET.domain}>`;

export type EmailLang = Lang;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function shell(params: { lang?: EmailLang; headerTitle: string; headerSub: string; bodyHtml: string; footer: string; accent?: string; logoUrl?: string | null; logoAlt?: string }): string {
  const accent = params.accent ?? "linear-gradient(135deg,#7c3aed,#06b6d4)";
  const logoUrl = params.logoUrl || LOGO_URL;
  return `<!DOCTYPE html>
<html lang="${MARKET.locale}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(params.headerTitle)}</title>
<style>
  body { margin:0; padding:0; background:#f5f3ff; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,0.08); }
  .header { background:${accent}; padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:20px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.88); font-size:14px; margin:0; }
  .body { padding:32px 40px; font-size:15px; color:#1a1a2e; line-height:1.6; }
  .box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:12px; padding:18px 22px; margin:22px 0; font-size:14px; }
  .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #ede9fe; }
  .row:last-child { border-bottom:none; font-weight:700; color:#7c3aed; font-size:16px; }
  .label { color:#6b7280; }
  .cta { text-align:center; margin:28px 0 8px; }
  .btn { display:inline-block; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white !important; font-size:15px; font-weight:600; padding:14px 34px; border-radius:10px; text-decoration:none; }
  .muted { font-size:12.5px; color:#6b7280; text-align:center; }
  .msg { border-left:3px solid #c4b5fd; padding:8px 14px; color:#374151; font-style:italic; margin:18px 0; white-space:pre-wrap; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header"><img src="${logoUrl}" alt="${escapeHtml(params.logoAlt ?? MARKET.brand)}" /><h1>${escapeHtml(params.headerTitle)}</h1><p>${escapeHtml(params.headerSub)}</p></div>
  <div class="body">${params.bodyHtml}</div>
  <div class="footer">${params.footer}</div>
</div>
</body>
</html>`;
}

function eur(n: number): string {
  return fmtEur(n);
}

export async function sendContractSigningEmail(params: {
  toEmail: string;
  userId: string;
  customerName: string;
  companyName: string;
  contractNumber: string;
  total: number;
  signUrl: string;
  expiresAt: Date;
  language?: EmailLang;
  message?: string;
  companyLogoUrl?: string | null;
  replyTo?: string | null;
}): Promise<void> {
  const company = escapeHtml(params.companyName);
  const customer = escapeHtml(params.customerName || "");
  const expires = fmtDateLong(params.expiresAt);
  const t = {
    title: "Il tuo contratto è pronto per la firma",
    sub: `${params.companyName} ti ha inviato un contratto`,
    body: `Gentile ${customer || "cliente"},<br/><br/><strong>${company}</strong> ha preparato il contratto per i tuoi lavori sulla base del preventivo che hai accettato. Ti chiediamo di leggerlo e firmarlo online: bastano pochi minuti. Riceverai una copia firmata via email non appena entrambe le parti avranno firmato.`,
    btn: "Leggi e firma il contratto",
    hint: `Questo link sicuro è personale e scade il ${expires}. Prima della firma riceverai un codice di conferma a questo indirizzo email.`,
    footer: `Questo contratto è stato inviato tramite ${MARKET.brand} per conto di ${company}. Domande sui lavori? Rispondi direttamente a ${company}.`,
    subject: `Contratto ${params.contractNumber} di ${params.companyName} — pronto per la firma`,
    contract: "Contratto",
    price: "Corrispettivo",
  };
  const html = shell({
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p>${params.message ? `<div class="msg">${escapeHtml(params.message)}</div>` : ""}
      <div class="box"><div class="row"><span class="label">${t.contract}</span><span><strong>${escapeHtml(params.contractNumber)}</strong></span></div>
      <div class="row"><span class="label">${t.price}</span><span>${eur(params.total)}</span></div></div>
      <div class="cta"><a class="btn" href="${params.signUrl}">${t.btn}</a></div><p class="muted">${t.hint}</p>`,
    footer: t.footer,
    logoUrl: params.companyLogoUrl,
    logoAlt: params.companyName,
  });
  await sendCustomerEmail({ userId: params.userId, toEmail: params.toEmail, fromDisplayName: params.companyName, replyTo: params.replyTo, subject: t.subject, html });
  logger.info({ to: params.toEmail, contractNumber: params.contractNumber }, "Contract signing email sent");
}

export async function sendContractOtpEmail(params: { toEmail: string; code: string; companyName: string; language?: EmailLang }): Promise<void> {
  const t = {
    title: "Il tuo codice di verifica",
    sub: `Per firmare il contratto di ${params.companyName}`,
    body: "Inserisci questo codice nella pagina di firma per confermare il tuo indirizzo email. Scade tra 10 minuti.",
    subject: `${params.code} è il tuo codice di firma ${MARKET.brand}`,
    footer: "Se non hai richiesto questo codice, ignora questa email.",
  };
  const html = shell({
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div style="text-align:center;margin:24px 0;"><span style="display:inline-block;font-size:34px;letter-spacing:10px;font-weight:800;color:#4c1d95;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:14px 26px;">${params.code}</span></div>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
}

export async function sendContractSignedEmail(params: {
  toEmail: string;
  userId: string;
  role: "customer" | "contractor";
  customerName: string;
  companyName: string;
  contractNumber: string;
  total: number;
  pdfBuffer: Buffer;
  language?: EmailLang;
  dashboardUrl: string;
  replyTo?: string | null;
}): Promise<void> {
  const company = escapeHtml(params.companyName);
  const customer = escapeHtml(params.customerName);
  const isCustomer = params.role === "customer";
  const t = {
    title: "Contratto firmato da entrambe le parti",
    sub: `Contratto ${params.contractNumber}`,
    body: isCustomer
      ? `Gentile ${customer},<br/><br/>il contratto con <strong>${company}</strong> è ora firmato da entrambe le parti. La tua copia firmata, con il certificato di firma elettronica, è allegata a questa email. Conservala con cura.`
      : `Ottima notizia! <strong>${customer}</strong> ha firmato il contratto ${params.contractNumber}. La copia firmata è allegata e puoi preparare il cantiere.`,
    subject: `Contratto ${params.contractNumber} firmato — ${params.companyName}`,
    footer: `Documento generato e firmato elettronicamente tramite ${MARKET.brand}.`,
    btn: `Apri in ${MARKET.brand}`,
    contract: "Contratto",
    price: "Corrispettivo",
  };
  const html = shell({
    accent: "linear-gradient(135deg,#059669,#06b6d4)",
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div class="box"><div class="row"><span class="label">${t.contract}</span><span><strong>${escapeHtml(params.contractNumber)}</strong></span></div><div class="row"><span class="label">${t.price}</span><span>${eur(params.total)}</span></div></div>${isCustomer ? "" : `<div class="cta"><a class="btn" href="${params.dashboardUrl}">${t.btn}</a></div>`}`,
    footer: t.footer,
  });
  const attachments = [{ filename: `${params.contractNumber}-firmato.pdf`, content: params.pdfBuffer.toString("base64") }];
  if (isCustomer) {
    await sendCustomerEmail({ userId: params.userId, toEmail: params.toEmail, fromDisplayName: params.companyName, replyTo: params.replyTo, subject: t.subject, html, attachments });
  } else {
    await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html, attachments });
  }
}

export async function sendContractDeclinedEmail(params: { toEmail: string; customerName: string; contractNumber: string; reason: string | null; dashboardUrl: string }): Promise<void> {
  const html = shell({
    accent: "linear-gradient(135deg,#dc2626,#f97316)",
    headerTitle: `${params.customerName} ha rifiutato il contratto`,
    headerSub: `Contratto ${params.contractNumber}`,
    bodyHtml: `<p><strong>${escapeHtml(params.customerName)}</strong> ha rifiutato di firmare il contratto ${escapeHtml(params.contractNumber)}.</p>${params.reason ? `<div class="msg">${escapeHtml(params.reason)}</div>` : ""}<p>Puoi modificare il contratto e inviarne una nuova versione, oppure contattare direttamente il cliente.</p><div class="cta"><a class="btn" href="${params.dashboardUrl}">Apri il contratto</a></div>`,
    footer: `Inviato da ${MARKET.brand}.`,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: `Contratto ${params.contractNumber} rifiutato da ${params.customerName}`, html });
}

export async function sendContractReminderEmail(params: {
  toEmail: string;
  userId: string;
  customerName: string;
  companyName: string;
  contractNumber: string;
  signUrl: string;
  expiresAt: Date;
  language?: EmailLang;
  companyLogoUrl?: string | null;
  replyTo?: string | null;
}): Promise<void> {
  const expires = fmtDateLong(params.expiresAt);
  const t = {
    title: "Promemoria: contratto in attesa di firma",
    sub: `${params.companyName}`,
    body: `Gentile ${escapeHtml(params.customerName)},<br/><br/>il contratto ${escapeHtml(params.contractNumber)} di <strong>${escapeHtml(params.companyName)}</strong> è ancora in attesa della tua firma. Il link scade il ${expires}.`,
    btn: "Firma il contratto",
    subject: `Promemoria — contratto ${params.contractNumber} da firmare`,
    footer: `Inviato tramite ${MARKET.brand} per conto di ${escapeHtml(params.companyName)}.`,
  };
  const html = shell({ headerTitle: t.title, headerSub: t.sub, bodyHtml: `<p>${t.body}</p><div class="cta"><a class="btn" href="${params.signUrl}">${t.btn}</a></div>`, footer: t.footer, logoUrl: params.companyLogoUrl, logoAlt: params.companyName });
  await sendCustomerEmail({ userId: params.userId, toEmail: params.toEmail, fromDisplayName: params.companyName, replyTo: params.replyTo, subject: t.subject, html });
}
