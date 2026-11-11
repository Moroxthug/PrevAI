import { MARKET, fmtEur, fmtDateLong, type Lang } from "@workspace/config";
import { logger } from "./logger.js";
import { sendCustomerEmail } from "./connectedEmailSend.js";
import { resendOrThrow } from "./emailUtils.js";
import { layout, button, code, C, type Tone } from "./emailLayout.js";

export { resendOrThrow };

// ── Email contratti (Phase 1) ────────────────────────────────────────────────
// Modulo separato così email.ts (preventivi/abbonamenti) resta leggibile.

export const FROM = `${MARKET.brand} <no-reply@${MARKET.domain}>`;

export type EmailLang = Lang;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** EMAIL-1: legacy `accent` gradients → a status tone in the new layout. */
function toneFromAccent(accent: string | undefined): Tone {
  if (!accent) return "brand";
  if (/#059669|#0f766e/.test(accent)) return "success";
  if (/#dc2626/.test(accent)) return "danger";
  if (/#d97706/.test(accent)) return "warning";
  return "brand";
}

/**
 * EMAIL-1: the bodies written for the old <style>-based shell use a handful of
 * classes (box/row/label, cta/btn, msg, muted). Turn them into the inline,
 * table-based blocks of emailLayout so every client renders them the same.
 */
export function inlineLegacyBody(html: string): string {
  let out = html.replace(
    /<div class="row"><span class="label">([\s\S]*?)<\/span><span>([\s\S]*?)<\/span><\/div>/g,
    (_m, l: string, v: string) =>
      `<tr><td class="e-muted e-line" style="padding:12px 0;border-bottom:1px solid ${C.line};font-size:13.5px;color:${C.muted};">${l}</td><td align="right" class="e-title e-line" style="padding:12px 0;border-bottom:1px solid ${C.line};font-size:14px;font-weight:600;color:${C.navy};text-align:right;">${v}</td></tr>`,
  );
  out = out.replace(/<div class="box">((?:\s*<tr>[\s\S]*?<\/tr>)*\s*)<\/div>/g, (_m, rows: string) => {
    // last row: no border, emphasised (totals / amount due)
    const fixed = rows.replace(/<tr>((?:(?!<tr>)[\s\S])*)<\/tr>\s*$/, (_r, last: string) =>
      `<tr>${last
        .replace(/border-bottom:1px solid [^;]+;/g, "")
        .replace(/class="e-title e-line" style="([^"]*)font-size:14px;font-weight:600;color:[^;]+;/, `class="e-accent" style="$1font-size:17px;font-weight:700;color:${C.purple};`)}</tr>`,
    );
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-panel" style="margin:22px 0;background:#fafafa;border:1px solid ${C.line};border-radius:12px;"><tr><td style="padding:6px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${fixed}</table></td></tr></table>`;
  });
  out = out.replace(/<div class="cta">\s*<a class="btn" href="([^"]*)">([\s\S]*?)<\/a>\s*<\/div>/g, (_m, href: string, label: string) =>
    button(href.replace(/&amp;/g, "&"), label.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")),
  );
  out = out.replace(
    /<div class="msg">([\s\S]*?)<\/div>/g,
    (_m, text: string) =>
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td class="e-quote" style="padding:4px 0 4px 16px;border-left:3px solid #c9bdf5;font-size:15px;line-height:1.65;color:${C.ink};font-style:italic;white-space:pre-wrap;">${text}</td></tr></table>`,
  );
  out = out.replace(/<p class="muted">/g, `<p class="e-muted" style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${C.muted};text-align:center;">`);
  out = out.replace(/<p>/g, `<p class="e-ink" style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${C.ink};">`);
  return out;
}

/**
 * Shared shell for contracts / invoices / portal / team / account emails.
 * EMAIL-1: now a thin adapter over emailLayout.layout(). When `logoUrl` or
 * `logoAlt` is given the email is sent for a company and carries its brand.
 */
export function shell(params: { lang?: EmailLang; headerTitle: string; headerSub: string; bodyHtml: string; footer: string; accent?: string; logoUrl?: string | null; logoAlt?: string; unsubscribeUrl?: string | null }): string {
  const forCompany = params.logoAlt !== undefined || !!params.logoUrl;
  const tone = toneFromAccent(params.accent);
  return layout({
    title: params.headerTitle,
    preheader: params.headerSub ? `${params.headerSub} — ${params.headerTitle}` : params.headerTitle,
    brand: forCompany ? { kind: "company", name: params.logoAlt ?? MARKET.brand, logoUrl: params.logoUrl } : { kind: "prevai" },
    eyebrow: params.headerSub && !(forCompany && params.headerSub === params.logoAlt) ? { text: params.headerSub, tone } : undefined,
    heading: params.headerTitle,
    bodyHtml: inlineLegacyBody(params.bodyHtml),
    footerHtml: params.footer,
    hidePrevaiLinks: forCompany,
    unsubscribeUrl: params.unsubscribeUrl,
  });
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
    bodyHtml: `<p>${t.body}</p>${code(params.code)}`,
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
    ...(isCustomer ? { logoAlt: params.companyName } : {}),
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
