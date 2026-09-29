import { MARKET } from "@workspace/config";
import { shell, escapeHtml, FROM, resendOrThrow } from "./emailContracts.js";
import { sendCustomerEmail } from "./connectedEmailSend.js";
import { logger } from "./logger.js";

// ── CLI-1: le email del portale del cliente (QuoteAI Phase 76) ──────────────
// Quattro messaggi transazionali: il codice di accesso, l'invito al portale
// che l'impresa manda a mano, la copia di ogni messaggio dell'impresa (al
// cliente) e la copia di ogni risposta (all'impresa). Invito e messaggi
// partono come le altre email ai clienti (la Gmail collegata se c'è, se no
// Resend a nome dell'impresa con Reply-To); codice e risposte da no-reply@.
// Transazionali: la disiscrizione dal marketing del cliente non le ferma.

export async function sendPortalOtpEmail(params: { toEmail: string; code: string; companyName: string }): Promise<void> {
  const html = shell({
    headerTitle: "Il tuo codice di accesso",
    headerSub: `Area clienti di ${params.companyName}`,
    bodyHtml: `<p>Inserisci questo codice per aprire la tua area clienti. Scade tra 10 minuti.</p><div style="text-align:center;margin:24px 0;"><span style="display:inline-block;font-size:34px;letter-spacing:10px;font-weight:800;color:#4c1d95;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:14px 26px;">${params.code}</span></div>`,
    footer: "Se non hai richiesto questo codice, ignora questa email.",
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: `${params.code} è il tuo codice di accesso ${MARKET.brand}`, html });
}

type FromCompany = { userId: string; toEmail: string; clientName: string; companyName: string; portalUrl: string; logoUrl?: string | null; replyTo?: string | null };

const greet = (name: string) => `Gentile ${escapeHtml(name || "cliente")}`;

export async function sendPortalInviteEmail(params: FromCompany): Promise<void> {
  const company = escapeHtml(params.companyName);
  const html = shell({
    headerTitle: "La tua area clienti",
    headerSub: params.companyName,
    logoUrl: params.logoUrl,
    logoAlt: params.companyName,
    bodyHtml: `<p>${greet(params.clientName)},<br/><br/><strong>${company}</strong> ti ha aperto un'area clienti: preventivi, contratti, fatture, l'avanzamento dei lavori con le foto e i messaggi, tutto in un posto.</p><div class="cta"><a class="btn" href="${params.portalUrl}">Apri la mia area clienti</a></div><p class="muted">Il link è personale. Quando lo apri ti mandiamo per email un codice di 6 cifre per confermare che sei tu.</p>`,
    footer: `Inviata tramite ${MARKET.brand} per conto di ${company}.`,
  });
  await sendCustomerEmail({ userId: params.userId, toEmail: params.toEmail, fromDisplayName: params.companyName, replyTo: params.replyTo, subject: `${params.companyName} — la tua area clienti`, html });
  logger.info({ to: params.toEmail }, "Portal invite email sent");
}

/** Un messaggio dell'impresa, consegnato al cliente col link per rispondere. */
export async function sendClientMessageEmail(params: FromCompany & { senderName: string; body: string; jobName: string | null }): Promise<void> {
  const company = escapeHtml(params.companyName);
  const sender = escapeHtml(params.senderName || params.companyName);
  const job = params.jobName ? escapeHtml(params.jobName) : null;
  const html = shell({
    headerTitle: "Nuovo messaggio",
    headerSub: params.jobName ? `${params.companyName} · ${params.jobName}` : params.companyName,
    logoUrl: params.logoUrl,
    logoAlt: params.companyName,
    bodyHtml: `<p>${greet(params.clientName)},<br/><br/>${sender} ti ha scritto${job ? ` per <strong>${job}</strong>` : ""}:</p><div class="msg">${escapeHtml(params.body)}</div><div class="cta"><a class="btn" href="${params.portalUrl}">Rispondi dall'area clienti</a></div><p class="muted">Rispondi dalla tua area clienti: la risposta arriva direttamente all'impresa.</p>`,
    footer: `Inviata tramite ${MARKET.brand} per conto di ${company}.`,
  });
  const subject = `${params.senderName || params.companyName}${params.jobName ? ` — ${params.jobName}` : ""}: nuovo messaggio`;
  await sendCustomerEmail({ userId: params.userId, toEmail: params.toEmail, fromDisplayName: params.companyName, replyTo: params.replyTo, subject, html });
}

/** La risposta di un cliente, consegnata all'impresa col link allo scambio nell'app. */
export async function sendClientReplyEmail(params: { toEmail: string; clientName: string; body: string; jobName: string | null; dashboardUrl: string }): Promise<void> {
  const client = escapeHtml(params.clientName);
  const job = params.jobName ? escapeHtml(params.jobName) : null;
  const html = shell({
    headerTitle: "Risposta di un cliente",
    headerSub: params.jobName ? `${params.clientName} · ${params.jobName}` : params.clientName,
    bodyHtml: `<p>${client} ti ha risposto${job ? ` per <strong>${job}</strong>` : ""} dalla sua area clienti:</p><div class="msg">${escapeHtml(params.body)}</div><div class="cta"><a class="btn" href="${params.dashboardUrl}">Rispondi su ${MARKET.brand}</a></div>`,
    footer: `Ricevi questa email perché un cliente ti ha scritto dalla sua area clienti ${MARKET.brand}.`,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: `${params.clientName}${params.jobName ? ` — ${params.jobName}` : ""}: nuova risposta`, html });
}
