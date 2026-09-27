import { Resend } from "resend";
import { MARKET, fmtEur } from "@workspace/config";
import { logger } from "./logger.js";
import { getBaseUrl } from "./baseUrl.js";
import { sanitizeForFromHeader } from "./emailUtils.js";
import { type BusinessProfile, type Quote, type QuoteClientData, type QuoteCompanySnapshot } from "@workspace/db";

// ── Phase 21: promemoria dopo l'invio del preventivo ────────────────────────
// Un preventivo viene inviato al cliente e, se non lo accetta, non seguiva
// nulla — ogni altra fase del funnel (lead, recensioni, fatture) ha già un
// follow-up. Riusa il blocco identificativo/disiscrizione dei lead (Phase 9,
// leadMessaging.ts), con chiave l'unsubscribeToken del preventivo perché un
// preventivo non è sempre collegato a una riga clients.

/** Cadenza predefinita in giorni dopo sentAt. Lo stadio 0 parte dopo questi giorni dall'invio. */
export const QUOTE_FOLLOWUP_CADENCE_DAYS = [2, 5, 10] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function quoteUnsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/public/quotes/unsubscribe?token=${encodeURIComponent(token)}`;
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
  const url = quoteUnsubscribeUrl(token);
  return `
    <div style="margin-top:8px;font-size:12px;color:#6b7280;">
      Non vuoi più ricevere promemoria su questo preventivo? <a href="${url}" style="color:#2563eb;">Disiscriviti</a>
    </div>`;
}

function followupCopy(stage: number, quoteNumber: string, totale: string): { subject: string; body: string } {
  const set = [
    { subject: `Ci stai ancora pensando? (Preventivo ${quoteNumber})`, body: `Volevamo sentirti riguardo al preventivo di ${totale}: siamo a disposizione per qualsiasi domanda o modifica.` },
    { subject: `Seguito al tuo preventivo (${quoteNumber})`, body: `Non abbiamo ricevuto risposta e volevamo assicurarci che il preventivo non fosse sfuggito. Rispondi quando vuoi se desideri procedere o hai domande.` },
    { subject: `Ultimo promemoria per il preventivo ${quoteNumber}`, body: `Questo è il nostro ultimo promemoria per ora: se non era il momento giusto, nessun problema. Restiamo a disposizione quando sarai pronto.` },
  ];
  return set[Math.min(stage, set.length - 1)]!;
}

function buildFollowupEmailHtml(params: {
  clientName: string;
  profile: BusinessProfile;
  stage: number;
  unsubscribeToken: string;
  quoteNumber: string;
  totale: string;
  publicUrl: string | null;
}): string {
  const { subject, body } = followupCopy(params.stage, params.quoteNumber, params.totale);
  const greeting = `Gentile ${escapeHtml(params.clientName)},`;
  const logo = params.profile.logoUrl ? `<img src="${escapeHtml(params.profile.logoUrl)}" alt="" style="max-height:40px;margin-bottom:16px;" />` : "";
  const cta = params.publicUrl
    ? `<p style="margin-top:24px;"><a href="${escapeHtml(params.publicUrl)}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Vedi il preventivo</a></p>`
    : "";
  return `<!DOCTYPE html>
<html lang="${MARKET.locale}"><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    ${logo}
    <p style="font-size:16px;color:#111827;">${greeting}</p>
    <h2 style="font-size:18px;color:#111827;">${escapeHtml(subject)}</h2>
    <p style="font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(body)}</p>
    ${cta}
    ${identificationBlockHtml(params.profile)}
    ${unsubscribeHtml(params.unsubscribeToken)}
  </div>
</body></html>`;
}

export type QuoteFollowupResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Invia il promemoria dello stadio indicato all'email del cliente del preventivo.
 * Non invia mai a un preventivo disiscritto — i chiamanti devono comunque
 * controllare `quote.unsubscribedAt` prima (difesa in profondità).
 */
export async function sendQuoteFollowup(params: {
  quote: Quote;
  profile: BusinessProfile;
  stage: number;
}): Promise<QuoteFollowupResult> {
  const { quote, profile, stage } = params;
  const clientData = quote.clientData as QuoteClientData;
  const email = clientData?.email;
  if (!email) return { ok: false, reason: "no_email" };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "resend_not_configured" };

  const companyName = (quote.companySnapshot as QuoteCompanySnapshot | null)?.companyName || profile.companyName || "La tua impresa";
  const quoteNumber = quote.numeroPreventivoData || `N° ${quote.id.slice(0, 4).toUpperCase()}`;
  const totale = fmtEur(Number(quote.totale));
  const publicUrl = `${getBaseUrl()}/p/${quote.id}`;
  const { subject } = followupCopy(stage, quoteNumber, totale);

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${sanitizeForFromHeader(companyName)} via ${MARKET.brand} <no-reply@${MARKET.domain}>`,
      to: [email],
      subject,
      html: buildFollowupEmailHtml({
        clientName: clientData?.nome || "cliente",
        profile,
        stage,
        unsubscribeToken: quote.unsubscribeToken,
        quoteNumber,
        totale,
        publicUrl,
      }),
      headers: { "List-Unsubscribe": `<${quoteUnsubscribeUrl(quote.unsubscribeToken)}>` },
      ...(profile.email ? { replyTo: profile.email } : {}),
    });
    return { ok: true };
  } catch (err) {
    logger.error({ err, quoteId: quote.id }, "Quote follow-up email failed");
    return { ok: false, reason: err instanceof Error ? err.message : "send_failed" };
  }
}
