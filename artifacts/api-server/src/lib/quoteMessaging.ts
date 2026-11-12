import { Resend } from "resend";
import { MARKET, fmtEur } from "@workspace/config";
import { logger } from "./logger.js";
import { getBaseUrl } from "./baseUrl.js";
import { publicQuoteLink } from "../quotes/publicLink.js";
import { fillTemplate, savedTemplate } from "./savedTemplates.js";
import { sanitizeForFromHeader } from "./emailUtils.js";
import { type BusinessProfile, type Quote, type QuoteClientData, type QuoteCompanySnapshot } from "@workspace/db";
import { layout, p, button, textParagraphs, companyIdentification } from "./emailLayout.js";

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

function quoteUnsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/public/quotes/unsubscribe?token=${encodeURIComponent(token)}`;
}



function followupCopy(stage: number, quoteNumber: string, totale: string): { subject: string; body: string } {
  const set = [
    { subject: `Ci stai ancora pensando? (Preventivo ${quoteNumber})`, body: `Volevamo sentirti riguardo al preventivo di ${totale}: siamo a disposizione per qualsiasi domanda o modifica.` },
    { subject: `Seguito al tuo preventivo (${quoteNumber})`, body: `Non abbiamo ricevuto risposta e volevamo assicurarci che il preventivo non fosse sfuggito. Rispondi quando vuoi se desideri procedere o hai domande.` },
    { subject: `Ultimo promemoria per il preventivo ${quoteNumber}`, body: `Questo è il nostro ultimo promemoria per ora: se non era il momento giusto, nessun problema. Restiamo a disposizione quando sarai pronto.` },
  ];
  return set[Math.min(stage, set.length - 1)]!;
}

export function buildFollowupEmailHtml(params: {
  clientName: string;
  profile: BusinessProfile;
  stage: number;
  unsubscribeToken: string;
  quoteNumber: string;
  totale: string;
  publicUrl: string | null;
  /** POCKET-5: the wording the person wrote (an approved suggestion, or the template saved in the app); it replaces the greeting and the body. */
  text?: string | null;
}): string {
  const { subject, body } = followupCopy(params.stage, params.quoteNumber, params.totale);
  const own = params.text?.trim();
  const bodyHtml = own ? textParagraphs(own) : p(`Gentile ${escapeHtml(params.clientName)},`) + p(escapeHtml(body));
  return layout({
    title: subject,
    preheader: own ? own.slice(0, 140) : body,
    brand: { kind: "company", name: params.profile.companyName || "", logoUrl: params.profile.logoUrl },
    heading: subject,
    bodyHtml: bodyHtml + (params.publicUrl ? button(params.publicUrl, "Vedi il preventivo") : ""),
    footerHtml: companyIdentification(params.profile),
    unsubscribeUrl: quoteUnsubscribeUrl(params.unsubscribeToken),
    hidePrevaiLinks: true,
  });
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
  /** POCKET-5: a text the person approved in the app (Proposals); without it, the wording saved in Message templates (f1–f3), then the standard one. */
  text?: string;
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
  // SEC-4: a reminder moves the link's expiry forward, but never reopens a link the company revoked.
  const link = await publicQuoteLink(quote, { share: true, reopen: false });
  if (!link.url) return { ok: false, reason: "link_revoked" };
  const publicUrl = link.url;
  const { subject } = followupCopy(stage, quoteNumber, totale);
  // POCKET-5 (QuoteAI 128.10): the wording saved in the app for this stage, with its slots filled.
  const saved = savedTemplate(profile.pocketSettings, `f${Math.min(stage, 2) + 1}`);
  const text = params.text?.trim() || (saved ? fillTemplate(saved, { first: (clientData?.nome ?? "").trim().split(/\s+/)[0] ?? "", job: quote.titoloPreventivoRiga2?.trim() || "", link: publicUrl, amount: totale, me: "", co: companyName }) : null);

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
        text,
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
