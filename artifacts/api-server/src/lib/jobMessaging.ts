import { Resend } from "resend";
import { MARKET } from "@workspace/config";
import { logger } from "./logger.js";
import { getBaseUrl } from "./baseUrl.js";
import type { BusinessProfile, Client } from "@workspace/db";
import { sendWhatsappTemplate } from "../routes/whatsapp.js";

// ── Phase 10: richieste di recensione + foto del cantiere condivise ─────────
// Entrambi i messaggi sono rivolti a una riga `clients` esistente (un cliente
// con cui l'impresa ha già un rapporto — base giuridica: legittimo interesse /
// soft spam art. 130 c. 4 Codice Privacy), non a un `leads`. Stessi requisiti
// dei follow-up lead di Phase 9 (blocco identificativo + opt-out funzionante),
// tenuti in questo modulo perché destinatario e token di opt-out stanno su `clients`.

export const REVIEW_REQUEST_DELAY_DAYS = 3;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeForFromHeader(value: string): string {
  return value.replace(/[\r\n"<>]/g, "").trim().slice(0, 60);
}

export function marketingUnsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/public/clients/unsubscribe?token=${encodeURIComponent(token)}`;
}

function identificationBlockHtml(profile: BusinessProfile): string {
  const company = escapeHtml(profile.companyName || "Questa impresa");
  const address = escapeHtml(profile.address || "");
  const contact = [profile.phone, profile.email].filter(Boolean).map(escapeHtml).join(" · ");
  return `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.6;">
      <div>Inviato da: <strong>${company}</strong></div>
      ${address ? `<div>${address}</div>` : ""}
      ${contact ? `<div>${contact}</div>` : ""}
    </div>`;
}

function unsubscribeHtml(token: string): string {
  const url = marketingUnsubscribeUrl(token);
  return `
    <div style="margin-top:8px;font-size:12px;color:#6b7280;">
      Non vuoi più ricevere questi messaggi? <a href="${url}" style="color:#2563eb;">Disiscriviti</a>
    </div>`;
}

function wrapEmailHtml(params: { clientName: string; profile: BusinessProfile; unsubscribeToken: string; subject: string; bodyHtml: string }): string {
  const greeting = `Gentile ${escapeHtml(params.clientName)},`;
  const logo = params.profile.logoUrl ? `<img src="${escapeHtml(params.profile.logoUrl)}" alt="" style="max-height:40px;margin-bottom:16px;" />` : "";
  return `<!DOCTYPE html>
<html lang="${MARKET.locale}"><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    ${logo}
    <p style="font-size:16px;color:#111827;">${greeting}</p>
    <h2 style="font-size:18px;color:#111827;">${escapeHtml(params.subject)}</h2>
    ${params.bodyHtml}
    ${identificationBlockHtml(params.profile)}
    ${unsubscribeHtml(params.unsubscribeToken)}
  </div>
</body></html>`;
}

async function sendEmail(params: { to: string; profile: BusinessProfile; subject: string; html: string; unsubscribeToken: string }): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "resend_not_configured" };
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${sanitizeForFromHeader(params.profile.companyName || MARKET.brand)} via ${MARKET.brand} <no-reply@${MARKET.domain}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      headers: { "List-Unsubscribe": `<${marketingUnsubscribeUrl(params.unsubscribeToken)}>` },
    });
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "Job messaging email failed");
    return { ok: false, reason: err instanceof Error ? err.message : "send_failed" };
  }
}

export type JobMessageResult =
  | { ok: true; channel: "email" | "whatsapp" }
  | { ok: false; reason: string };

function reviewRequestCopy(reviewUrl: string): { subject: string; body: string } {
  return {
    subject: "Grazie per la fiducia — ci lasci una recensione?",
    body: `I lavori sono terminati. Se hai due minuti, una recensione su Google ci aiuta moltissimo a farci conoscere: ${reviewUrl}`,
  };
}

/** Non invia mai a un cliente che ha rifiutato i messaggi promozionali — i chiamanti devono comunque controllare `client.marketingUnsubscribedAt`. */
export async function sendJobReviewRequest(params: {
  client: Client;
  profile: BusinessProfile;
  reviewUrl: string;
  secondaryReviewUrl?: string | null;
  whatsappTemplateName?: string | null;
}): Promise<JobMessageResult> {
  const { client, profile, reviewUrl, secondaryReviewUrl } = params;
  const { subject, body } = reviewRequestCopy(reviewUrl);

  if (client.phone && params.whatsappTemplateName) {
    // I parametri dei template WhatsApp sono fissati all'approvazione: un secondo link non ci sta — solo email.
    const sent = await sendWhatsappTemplate(client.phone, params.whatsappTemplateName, "it", [client.name, reviewUrl]);
    if (sent) return { ok: true, channel: "whatsapp" };
    logger.warn({ clientId: client.id }, "WhatsApp review request failed, falling back to email");
  }

  if (!client.email) return { ok: false, reason: "no_email" };
  const secondLine = secondaryReviewUrl
    ? `<p style="font-size:14px;color:#374151;line-height:1.6;">Preferisci un'altra piattaforma? <a href="${secondaryReviewUrl}" style="color:#2563eb;">${escapeHtml(secondaryReviewUrl)}</a></p>`
    : "";
  const bodyHtml = `<p style="font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(body.split(reviewUrl)[0] ?? "")}<a href="${reviewUrl}" style="color:#2563eb;">${escapeHtml(reviewUrl)}</a></p>${secondLine}`;
  const html = wrapEmailHtml({ clientName: client.name, profile, unsubscribeToken: client.marketingUnsubscribeToken, subject, bodyHtml });
  const result = await sendEmail({ to: client.email, profile, subject, html, unsubscribeToken: client.marketingUnsubscribeToken });
  return result.ok ? { ok: true, channel: "email" } : result;
}

function photoShareCopy(count: number): { subject: string; body: string } {
  return { subject: "Foto dell'avanzamento dei lavori", body: `Ecco ${count > 1 ? `${count} nuove foto` : "una nuova foto"} del tuo cantiere:` };
}

/** `photoUrls` sono link già generati (di norma firmati, a tempo) — questo modulo non li crea. */
export async function sendJobPhotoShare(params: {
  client: Client;
  profile: BusinessProfile;
  photoUrls: string[];
  whatsappTemplateName?: string | null;
}): Promise<JobMessageResult> {
  const { client, profile, photoUrls } = params;
  const { subject, body } = photoShareCopy(photoUrls.length);

  if (client.phone && params.whatsappTemplateName) {
    const sent = await sendWhatsappTemplate(client.phone, params.whatsappTemplateName, "it", [client.name, String(photoUrls.length)]);
    if (sent) return { ok: true, channel: "whatsapp" };
    logger.warn({ clientId: client.id }, "WhatsApp photo share failed, falling back to email");
  }

  if (!client.email) return { ok: false, reason: "no_email" };
  const links = photoUrls.map((u) => `<div style="margin:8px 0;"><a href="${u}" style="color:#2563eb;">${escapeHtml(u)}</a></div>`).join("");
  const bodyHtml = `<p style="font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(body)}</p>${links}`;
  const html = wrapEmailHtml({ clientName: client.name, profile, unsubscribeToken: client.marketingUnsubscribeToken, subject, bodyHtml });
  const result = await sendEmail({ to: client.email, profile, subject, html, unsubscribeToken: client.marketingUnsubscribeToken });
  return result.ok ? { ok: true, channel: "email" } : result;
}
