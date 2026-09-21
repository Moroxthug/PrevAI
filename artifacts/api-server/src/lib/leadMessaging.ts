import { Resend } from "resend";
import { MARKET } from "@workspace/config";
import { logger } from "./logger.js";
import { getBaseUrl } from "./baseUrl.js";
import type { BusinessProfile, Lead } from "@workspace/db";
import { sendWhatsappTemplate } from "../routes/whatsapp.js";

// ── Phase 9: follow-up lead conforme al GDPR / art. 130 Codice Privacy ──────
// Ogni messaggio automatico (email o WhatsApp) inviato a un lead deve avere:
//   1. Identificazione del mittente — la ragione sociale dell'impresa.
//   2. Un indirizzo valido, più un recapito telefonico o email.
//   3. Un meccanismo di disiscrizione funzionante, immediato.
// Questo modulo è l'unico punto che compone quel blocco, così nessun template
// futuro può uscire senza.

/** Cadenza predefinita in giorni dopo lo stadio precedente. Lo stadio 0 parte dopo questi giorni dalla creazione del lead. */
export const FOLLOWUP_CADENCE_DAYS = [1, 3, 7] as const;

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

export function unsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/public/leads/unsubscribe?token=${encodeURIComponent(token)}`;
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
  const url = unsubscribeUrl(token);
  return `
    <div style="margin-top:8px;font-size:12px;color:#6b7280;">
      Non vuoi più ricevere questi messaggi? <a href="${url}" style="color:#2563eb;">Disiscriviti</a>
    </div>`;
}

function followupCopy(stage: number): { subject: string; body: string } {
  const set = [
    { subject: "Sei ancora interessato al tuo progetto?", body: "Volevamo solo sentirti: saremmo felici di aiutarti a realizzare il tuo progetto. Rispondi a questa email o contattaci quando vuoi." },
    { subject: "Seguito alla tua richiesta di preventivo", body: "Non abbiamo ricevuto risposta e volevamo assicurarci che la tua richiesta non fosse sfuggita. Rispondiamo volentieri a ogni domanda." },
    { subject: "Ultimo promemoria", body: "Questo è il nostro ultimo messaggio per ora: se non era il momento giusto, nessun problema. Restiamo a disposizione quando sarai pronto." },
  ];
  return set[Math.min(stage, set.length - 1)]!;
}

function buildFollowupEmailHtml(params: { clientName: string; profile: BusinessProfile; stage: number; unsubscribeToken: string }): string {
  const { subject, body } = followupCopy(params.stage);
  const greeting = `Gentile ${escapeHtml(params.clientName)},`;
  const logo = params.profile.logoUrl ? `<img src="${escapeHtml(params.profile.logoUrl)}" alt="" style="max-height:40px;margin-bottom:16px;" />` : "";
  return `<!DOCTYPE html>
<html lang="${MARKET.locale}"><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    ${logo}
    <p style="font-size:16px;color:#111827;">${greeting}</p>
    <h2 style="font-size:18px;color:#111827;">${escapeHtml(subject)}</h2>
    <p style="font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(body)}</p>
    ${identificationBlockHtml(params.profile)}
    ${unsubscribeHtml(params.unsubscribeToken)}
  </div>
</body></html>`;
}

export type LeadFollowupResult =
  | { ok: true; channel: "email" | "whatsapp" }
  | { ok: false; reason: string };

/**
 * Invia il follow-up dello stadio indicato sul canale preferito del lead,
 * con fallback all'email quando WhatsApp non è disponibile. Non invia mai a un
 * lead disiscritto — i chiamanti devono comunque controllare
 * `lead.unsubscribedAt` prima (difesa in profondità).
 */
export async function sendLeadFollowup(params: {
  lead: Lead;
  profile: BusinessProfile;
  stage: number;
  whatsappTemplateName?: string | null;
}): Promise<LeadFollowupResult> {
  const { lead, profile, stage } = params;

  if (lead.preferredChannel === "whatsapp" && lead.phone && params.whatsappTemplateName) {
    const { subject } = followupCopy(stage);
    const sent = await sendWhatsappTemplate(lead.phone, params.whatsappTemplateName, "it", [lead.name, subject]);
    if (sent) return { ok: true, channel: "whatsapp" };
    logger.warn({ leadId: lead.id }, "WhatsApp follow-up failed, falling back to email");
  }

  if (!lead.email) return { ok: false, reason: "no_email" };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "resend_not_configured" };

  const { subject } = followupCopy(stage);
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${sanitizeForFromHeader(profile.companyName || MARKET.brand)} via ${MARKET.brand} <no-reply@${MARKET.domain}>`,
      to: [lead.email],
      subject,
      html: buildFollowupEmailHtml({ clientName: lead.name, profile, stage, unsubscribeToken: lead.unsubscribeToken }),
      headers: { "List-Unsubscribe": `<${unsubscribeUrl(lead.unsubscribeToken)}>` },
    });
    return { ok: true, channel: "email" };
  } catch (err) {
    logger.error({ err, leadId: lead.id }, "Lead follow-up email failed");
    return { ok: false, reason: err instanceof Error ? err.message : "send_failed" };
  }
}
