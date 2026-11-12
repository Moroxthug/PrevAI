import { Resend } from "resend";
import { MARKET, PREZZI_PIANI, VOCI_PIANI, pianoDaNome, type Lang, type PianoInAbbonamento } from "@workspace/config";
import { logger } from "./logger.js";
import { sendCustomerEmail } from "./connectedEmailSend.js";
import { layout, p, h2, button, infoTable, callout, quote, checklist, C } from "./emailLayout.js";
import { pricesTable, EXAMPLE_PROMPT, EXAMPLE_PRICES } from "./emailCampaign.js";

const FROM = `${MARKET.brand} <no-reply@${MARKET.domain}>`;


export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type PlanTier = PianoInAbbonamento | "oneshot";

// PREZZI-2: il piano si riconosce dal nome commerciale (Artigiano, Mastro,
// Capomastro, Su misura); prima si cercava "pro" o "starter" nel nome e l'Elite
// finiva tra i preventivi singoli.
function getPlanTier(planName: string): PlanTier {
  return pianoDaNome(planName) ?? "oneshot";
}

function getPlanFeatures(planName: string, tier: PlanTier): string[] {
  if (tier !== "oneshot") return VOCI_PIANI[tier].map((v) => escapeHtml(v));
  const isClean = planName.toLowerCase().includes("pulito") || planName.toLowerCase().includes("clean");
  return isClean
    ? ["1 preventivo PDF senza filigrana", "Design professionale e pulito", "Download immediato"]
    : ["1 preventivo PDF", "Download immediato"];
}

function buildSubscriptionEmail(params: {
  userName: string;
  planName: string;
  planPrice: number;
  planInterval: string | null;
}) {
  const { planName, planPrice, planInterval } = params;
  const userName = escapeHtml(params.userName);
  const tier = getPlanTier(planName);
  const isRecurring = !!planInterval;
  const date = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  const intervalLabel = planInterval === "month" ? "mese" : planInterval === "year" ? "anno" : null;
  const priceLabel = intervalLabel ? `€ ${planPrice}/${intervalLabel}` : `€ ${planPrice} (una tantum)`;
  const oneshot = tier === "oneshot";
  const heading = oneshot ? `Preventivo ${planName} sbloccato` : `Benvenuto nel piano ${planName}`;
  const intro = oneshot
    ? `Ciao ${userName}, il tuo acquisto <strong>PrevAI ${escapeHtml(planName)}</strong> è andato a buon fine. Il PDF del tuo preventivo è pronto da scaricare nella dashboard.`
    : `Ciao ${userName}, il tuo abbonamento <strong>PrevAI ${escapeHtml(planName)}</strong> è attivo da oggi. Puoi già creare preventivi professionali${PREZZI_PIANI[tier].preventiviMese === null ? " illimitati" : ""}.`;
  return layout({
    title: `${heading} – PrevAI`,
    preheader: oneshot ? "Il tuo PDF è pronto: scaricalo dalla dashboard." : `Il tuo piano ${planName} è attivo. Ecco il riepilogo.`,
    heading,
    bodyHtml:
      p(intro) +
      infoTable(
        [
          ["Piano", `PrevAI ${escapeHtml(planName)}`],
          ["Data", date],
          isRecurring ? ["Rinnovo", planInterval === "month" ? "Mensile automatico" : "Annuale automatico"] : ["Tipo", "Acquisto singolo"],
          ["Importo", priceLabel],
        ],
        { emphasizeLast: true },
      ) +
      h2(oneshot ? "Cosa include" : "Cosa include il tuo piano") +
      checklist(getPlanFeatures(planName, tier)) +
      button(`${MARKET.siteUrl}/dashboard`, oneshot ? "Scarica il PDF" : "Vai alla dashboard") +
      p(`Hai domande? Scrivici a <a href="mailto:${MARKET.supportEmail}" style="color:${C.purple};">${MARKET.supportEmail}</a>`, { muted: true, small: true, center: true }),
    footerHtml: `Hai ricevuto questa email perché hai effettuato un acquisto su ${MARKET.brand}.${isRecurring ? " Per gestire o disdire l'abbonamento: Impostazioni → Piano." : ""}`,
  });
}

function buildWelcomeEmail(name: string): string {
  const firstName = escapeHtml(name?.split(" ")[0] || name || "");
  return layout({
    title: "Benvenuto su PrevAI",
    preheader: "Il tuo account è pronto: il primo preventivo in meno di un minuto.",
    heading: firstName ? `Benvenuto, ${firstName}` : "Benvenuto su PrevAI",
    lead: "Il tuo account è pronto. Da oggi un preventivo ti prende un minuto, non una serata.",
    bodyHtml:
      p("Scrivi il lavoro come lo diresti a un collega:") +
      quote(EXAMPLE_PROMPT) +
      p("PrevAI lo trasforma in voci, quantità e prezzi:") +
      pricesTable(EXAMPLE_PRICES) +
      p("Prima di iniziare, aggiungi nome, P.IVA e logo nel profilo aziendale: finiscono su ogni PDF.") +
      button(`${MARKET.siteUrl}/dashboard`, "Crea il primo preventivo") +
      p(`La prova gratuita include preventivi illimitati e 3 PDF, senza carta di credito. Hai domande? Rispondi a questa email.`, { muted: true, small: true }),
    footerHtml: `Hai ricevuto questa email perché ti sei appena registrato su ${MARKET.brand}.`,
  });
}

export async function sendWelcomeEmail(params: {
  toEmail: string;
  toName: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping welcome email");
    return;
  }
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: FROM,
      to: [params.toEmail],
      subject: "Benvenuto su PrevAI — il tuo account è pronto 🎉",
      html: buildWelcomeEmail(params.toName),
    });
    logger.info({ to: params.toEmail }, "Welcome email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send welcome email (non-fatal)");
  }
}

export async function sendSubscriptionEmail(params: {
  toEmail: string;
  toName: string;
  planName: string;
  planPrice: number;
  planInterval: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping subscription email");
    return;
  }

  const tier = getPlanTier(params.planName);
  const subject = tier === "oneshot"
    ? `🎉 Preventivo ${params.planName} sbloccato – PrevAI`
    : `🎉 Piano ${params.planName} attivato – Benvenuto su PrevAI!`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: FROM,
      to: [params.toEmail],
      subject,
      html: buildSubscriptionEmail({
        userName: params.toName,
        planName: params.planName,
        planPrice: params.planPrice,
        planInterval: params.planInterval,
      }),
    });
    logger.info({ to: params.toEmail, plan: params.planName }, "Subscription email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send subscription email (non-fatal)");
  }
}


const QUOTE_EMAIL_COPY = {
  view: "Visualizza e accetta online",
  viewHint: "Puoi consultare il preventivo completo nel browser e accettarlo con un clic.",
  title: (c: string) => `Preventivo da ${c}`,
  ready: "Il tuo preventivo è pronto",
  sent: (c: string) => `${c} ti ha inviato un preventivo professionale`,
  greeting: (n: string, c: string) => `Gentile ${n || "cliente"},<br/><br/>in allegato trovi il preventivo di <strong>${c}</strong>. Per qualsiasi domanda, non esitare a contattarci.`,
  quote: "Preventivo",
  total: "Importo totale",
  generated: "Documento generato con",
  // AI Act art. 50: il destinatario sa che il preventivo allegato è stato elaborato con IA.
  aiNotice: "Il preventivo allegato è stato elaborato con l'ausilio di intelligenza artificiale e verificato dall'impresa che te lo invia.",
  footer: "Hai ricevuto questa email perché sei indicato come destinatario di questo preventivo.",
  subject: (n: string, c: string) => `Preventivo ${n} – ${c}`,
  money: (t: string) => `€ ${t}`,
} as const;

function buildQuoteEmailHtml(params: {
  lang?: Lang;
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  publicUrl?: string | null;
  logoUrl?: string | null;
  aiGenerated?: boolean;
}): string {
  const companyName = escapeHtml(params.companyName);
  const clientName = escapeHtml(params.clientName);
  const { quoteNumber, totale, publicUrl } = params;
  const c = QUOTE_EMAIL_COPY;
  const cta = publicUrl ? button(publicUrl, c.view) + p(c.viewHint, { muted: true, small: true, center: true }) : "";
  return layout({
    title: c.title(params.companyName),
    preheader: `${c.sent(params.companyName)} — ${c.money(totale)}`,
    brand: { kind: "company", name: params.companyName, logoUrl: params.logoUrl },
    heading: c.ready,
    bodyHtml:
      p(c.greeting(clientName, companyName)) +
      infoTable([[c.quote, escapeHtml(quoteNumber)], [c.total, c.money(escapeHtml(totale))]], { emphasizeLast: true }) +
      cta,
    footerHtml: `${companyName} · ${c.footer}${params.aiGenerated ? `<br/>${c.aiNotice}` : ""}`,
    hidePrevaiLinks: true,
  });
}


function buildWidgetClientConfirmationEmail(params: {
  clientName: string;
  companyName: string;
  companyPhone: string | null;
  companyEmail: string | null;
  prezzoMinimo: string;
  prezzoMassimo: string;
  incentivesSummary?: string;
  logoUrl?: string | null;
}): string {
  // clientName, companyName and incentivesSummary arrive already escaped.
  const { clientName, companyName, companyPhone, companyEmail, prezzoMinimo, prezzoMassimo, incentivesSummary } = params;
  const contactLine = [companyPhone, companyEmail].filter((v): v is string => !!v).map((v) => escapeHtml(v)).join(" · ");
  const rawCompany = companyName.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  return layout({
    title: `La tua richiesta è stata ricevuta – ${rawCompany}`,
    preheader: `Stima indicativa € ${prezzoMinimo} – € ${prezzoMassimo}. Ti ricontatteremo a breve.`,
    brand: { kind: "company", name: rawCompany, logoUrl: params.logoUrl },
    heading: "Grazie, abbiamo la tua richiesta",
    bodyHtml:
      p(`Ciao ${clientName}, grazie per aver chiesto una stima a <strong>${companyName}</strong>. Ti ricontatteremo a breve per fissare un sopralluogo e definire il preventivo definitivo.`) +
      infoTable([["Stima indicativa", `€ ${escapeHtml(prezzoMinimo)} – € ${escapeHtml(prezzoMassimo)}`]], { emphasizeLast: true }) +
      (incentivesSummary ? callout(`<strong>Agevolazioni potenzialmente applicabili</strong><br/>${incentivesSummary.replace(/\n/g, "<br/>")}`, "success") : "") +
      p(
        `Questa è una stima automatica generata con l'AI e può variare dopo il sopralluogo tecnico.${incentivesSummary ? " Anche le agevolazioni indicate sono una stima preliminare, da confermare in sede di sopralluogo tecnico e fiscale." : ""}${contactLine ? ` Per qualsiasi domanda: ${contactLine}.` : ""}`,
        { muted: true, small: true },
      ),
    footerHtml: `Hai ricevuto questa email perché hai chiesto un preventivo tramite il sito di ${companyName}.`,
    hidePrevaiLinks: true,
  });
}

/** PREZZI-2: una richiesta per il piano Su misura, a noi. */
export async function sendSuMisuraRequest(r: { nome: string; impresa: string; email: string; telefono?: string; persone?: string; messaggio?: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping Su misura request email");
    return;
  }
  const riga = (k: string, v?: string) => (v ? `<p><strong>${k}:</strong> ${escapeHtml(v)}</p>` : "");
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: FROM,
    to: [`info@${MARKET.domain}`],
    replyTo: r.email,
    subject: `Richiesta piano Su misura: ${r.impresa}`,
    html: riga("Nome", r.nome) + riga("Impresa", r.impresa) + riga("Email", r.email) + riga("Telefono", r.telefono) + riga("Persone", r.persone) + riga("Messaggio", r.messaggio),
  });
}

export async function sendWidgetClientConfirmationEmail(params: {
  toEmail: string;
  userId: string;
  clientName: string;
  companyName: string;
  companyPhone: string | null;
  companyEmail: string | null;
  prezzoMinimo: string;
  prezzoMassimo: string;
  incentivesSummary?: string;
  companyLogoUrl?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping widget client confirmation email");
    return;
  }
  try {
    await sendCustomerEmail({
      userId: params.userId,
      toEmail: params.toEmail,
      fromDisplayName: params.companyName,
      replyTo: params.companyEmail,
      subject: `La tua richiesta a ${params.companyName} è stata ricevuta`,
      html: buildWidgetClientConfirmationEmail({
        clientName: escapeHtml(params.clientName),
        companyName: escapeHtml(params.companyName),
        companyPhone: params.companyPhone,
        companyEmail: params.companyEmail,
        prezzoMinimo: params.prezzoMinimo,
        prezzoMassimo: params.prezzoMassimo,
        incentivesSummary: params.incentivesSummary ? escapeHtml(params.incentivesSummary) : undefined,
        logoUrl: params.companyLogoUrl ?? null,
      }),
    });
    logger.info({ to: params.toEmail }, "Widget client confirmation email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send widget client confirmation email (non-fatal)");
  }
}


function buildWidgetLeadNotificationHtml(params: {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  rawInput: string;
  totale: string;
  prezzoMinimo: string;
  prezzoMassimo: string;
  incentivesSummary?: string;
}): string {
  const name = escapeHtml(params.clientName);
  const email = escapeHtml(params.clientEmail);
  const phone = escapeHtml(params.clientPhone);
  const telHref = `tel:${params.clientPhone.replace(/[^\d+]/g, "")}`;
  return layout({
    title: "Nuova richiesta dal widget",
    preheader: `${params.clientName} ha chiesto una stima: € ${params.prezzoMinimo} – € ${params.prezzoMassimo}`,
    heading: `${params.clientName} vuole un preventivo`,
    lead: "Ha appena completato il preventivatore sul tuo sito. Chi richiama entro 24 ore chiude molti più lavori.",
    bodyHtml:
      infoTable([
        ["Cliente", name],
        ["Email", `<a href="mailto:${email}" style="color:${C.purple};text-decoration:none;">${email}</a>`],
        ["Telefono", `<a href="${escapeHtml(telHref)}" style="color:${C.purple};text-decoration:none;">${phone}</a>`],
      ]) +
      h2("La richiesta") +
      quote(params.rawInput) +
      infoTable(
        [
          ["Totale calcolato", `€ ${escapeHtml(params.totale)}`],
          ["Stima mostrata al cliente", `€ ${escapeHtml(params.prezzoMinimo)} – € ${escapeHtml(params.prezzoMassimo)}`],
        ],
        { emphasizeLast: true },
      ) +
      (params.incentivesSummary ? callout(`<strong>Verifica incentivi e bandi</strong><br/>${escapeHtml(params.incentivesSummary).replace(/\n/g, "<br/>")}`, "success") : "") +
      button(telHref, "Chiama ora") +
      p(`Lo trovi anche in <a href="${MARKET.siteUrl}/dashboard" style="color:${C.purple};">${MARKET.brand}</a>, tra le richieste.`, { muted: true, small: true, center: true }),
    footerHtml: `Ricevi questa email perché il widget ${MARKET.brand} è attivo sul tuo sito.`,
  });
}

export async function sendWidgetLeadNotification(params: {
  toEmail: string;
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  rawInput: string;
  totale: string;
  prezzoMinimo: string;
  prezzoMassimo: string;
  incentivesSummary?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping widget lead notification email");
    return;
  }
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: FROM,
      to: [params.toEmail],
      subject: `Nuova richiesta dal tuo sito — ${params.clientName}`,
      html: buildWidgetLeadNotificationHtml(params),
    });
    logger.info({ to: params.toEmail, clientName: params.clientName }, "Widget lead email notification sent to contractor");
  } catch (err) {
    logger.error({ err }, "Failed to send widget lead notification email");
  }
}

export async function sendQuotePdfEmail(params: {
  toEmail: string;
  userId: string;
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  pdfBuffer: Buffer;
  filename: string;
  publicUrl?: string | null;
  companyLogoUrl?: string | null;
  replyTo?: string | null;
  lang?: Lang;
  /** Marcatura AI Act art. 50 nel corpo dell'email (vedi quotes/pdf.ts quoteProvenance). */
  aiGenerated?: boolean;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping quote email");
    throw new Error("Email service not configured");
  }
  try {
    await sendCustomerEmail({
      userId: params.userId,
      toEmail: params.toEmail,
      fromDisplayName: params.companyName,
      replyTo: params.replyTo,
      subject: QUOTE_EMAIL_COPY.subject(params.quoteNumber, params.companyName),
      html: buildQuoteEmailHtml({
        lang: params.lang,
        companyName: params.companyName,
        clientName: params.clientName,
        quoteNumber: params.quoteNumber,
        totale: params.totale,
        publicUrl: params.publicUrl ?? null,
        logoUrl: params.companyLogoUrl ?? null,
        aiGenerated: params.aiGenerated ?? false,
      }),
      attachments: [
        {
          filename: params.filename,
          content: params.pdfBuffer.toString("base64"),
        },
      ],
    });
    logger.info({ to: params.toEmail, quoteNumber: params.quoteNumber }, "Quote PDF email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send quote PDF email");
    throw new Error("Failed to send the quote email", { cause: err });
  }
}

function buildQuoteAcceptedEmail(params: {
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  acceptedAt: string;
  quoteUrl: string;
}): string {
  const clientName = escapeHtml(params.clientName);
  const { quoteNumber, totale, acceptedAt, quoteUrl } = params;
  return layout({
    title: "Preventivo accettato",
    preheader: `${params.clientName} ha accettato il preventivo ${quoteNumber} (€ ${totale}).`,
    heading: `${params.clientName} ha detto sì`,
    bodyHtml:
      p(`<strong>${clientName}</strong> ha confermato il preventivo online il ${escapeHtml(acceptedAt)}. Il prossimo passo: trasformarlo in un contratto firmato e incassare l'acconto.`) +
      infoTable(
        [
          ["Preventivo", escapeHtml(quoteNumber)],
          ["Accettato da", clientName],
          ["Totale", `€ ${escapeHtml(totale)}`],
        ],
        { emphasizeLast: true },
      ) +
      button(quoteUrl, "Apri il preventivo"),
    footerHtml: `Ricevi questa email perché le notifiche di accettazione sono attive nelle impostazioni di ${MARKET.brand}.`,
  });
}

export async function sendQuoteAcceptedEmail(params: {
  toEmail: string;
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  acceptedAt: string;
  quoteUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping quote-accepted email");
    return;
  }
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: FROM,
    to: [params.toEmail],
    subject: `${params.clientName} ha accettato il preventivo ${params.quoteNumber}`,
    html: buildQuoteAcceptedEmail(params),
  });
  logger.info({ to: params.toEmail, quoteNumber: params.quoteNumber }, "Quote accepted email sent");
}
