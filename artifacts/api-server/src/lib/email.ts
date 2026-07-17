import { Resend } from "resend";
import { logger } from "./logger";

const PREVAI_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#7c3aed"/>
      <stop offset="100%" style="stop-color:#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="28" height="28" rx="6" y="2" fill="url(#g)"/>
  <text x="14" y="20" font-family="system-ui,sans-serif" font-size="15" font-weight="bold" fill="white" text-anchor="middle">P</text>
  <text x="38" y="22" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="#1a1a2e">prev</text>
  <text x="70" y="22" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="#7c3aed">ai</text>
</svg>`;

const LOGO_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(PREVAI_LOGO_SVG).toString("base64")}`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type PlanTier = "pro" | "starter" | "oneshot";

function getPlanTier(planName: string): PlanTier {
  const lower = planName.toLowerCase();
  if (lower.includes("pro")) return "pro";
  if (lower.includes("starter")) return "starter";
  return "oneshot";
}

function getPlanFeatures(planName: string, tier: PlanTier): string {
  if (tier === "pro") {
    return `
      <div class="feature"><span class="check">✓</span> Preventivi illimitati senza filigrana</div>
      <div class="feature"><span class="check">✓</span> PDF professionali con il tuo logo aziendale</div>
      <div class="feature"><span class="check">✓</span> Template premium ad alta qualità</div>
      <div class="feature"><span class="check">✓</span> Branding completamente personalizzabile</div>
      <div class="feature"><span class="check">✓</span> Generazione AI con foto cantiere</div>
      <div class="feature"><span class="check">✓</span> Priorità nella generazione AI</div>
    `;
  }
  if (tier === "starter") {
    return `
      <div class="feature"><span class="check">✓</span> Fino a 20 preventivi al mese</div>
      <div class="feature"><span class="check">✓</span> Download PDF professionale</div>
      <div class="feature"><span class="check">✓</span> Supporto email incluso</div>
    `;
  }
  const isClean = planName.toLowerCase().includes("pulito") || planName.toLowerCase().includes("clean");
  if (isClean) {
    return `
      <div class="feature"><span class="check">✓</span> 1 preventivo PDF senza filigrana</div>
      <div class="feature"><span class="check">✓</span> Design professionale e pulito</div>
      <div class="feature"><span class="check">✓</span> Download immediato</div>
    `;
  }
  return `
    <div class="feature"><span class="check">✓</span> 1 preventivo PDF</div>
    <div class="feature"><span class="check">✓</span> Download immediato</div>
  `;
}

function buildSubscriptionEmail(params: {
  userName: string;
  planName: string;
  planPrice: number;
  planInterval: string | null;
}) {
  const { userName, planName, planPrice, planInterval } = params;
  const tier = getPlanTier(planName);
  const isRecurring = !!planInterval;
  const date = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  const intervalLabel = planInterval === "month" ? "mese" : planInterval === "year" ? "anno" : null;
  const priceLabel = intervalLabel ? `€${planPrice}/${intervalLabel}` : `€${planPrice} (una tantum)`;
  const renewalRow = isRecurring
    ? `<div class="receipt-row">
        <span class="receipt-label">Rinnovo</span>
        <span>${planInterval === "month" ? "Mensile automatico" : "Annuale automatico"}</span>
       </div>`
    : `<div class="receipt-row">
        <span class="receipt-label">Tipo</span>
        <span>Acquisto singolo</span>
       </div>`;

  const headline = tier === "oneshot"
    ? `🎉 Preventivo ${planName} sbloccato!`
    : `🎉 Piano ${planName} attivato!`;

  const subline = tier === "oneshot"
    ? `Il tuo PDF è pronto. Accedi alla dashboard per scaricarlo.`
    : `Il tuo abbonamento è attivo da oggi, ${date}`;

  const bodyIntro = tier === "oneshot"
    ? `Ciao ${userName},<br/><br/>il tuo acquisto <strong>Prevai ${planName}</strong> è andato a buon fine. Puoi accedere alla dashboard e scaricare il PDF del tuo preventivo.`
    : `Ciao ${userName},<br/><br/>il tuo abbonamento <strong>Prevai ${planName}</strong> è stato attivato con successo. Puoi già iniziare a creare preventivi professionali${tier === "pro" ? " illimitati" : ""}.`;

  const features = getPlanFeatures(planName, tier);

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${headline} – Prevai</title>
<style>
  body { margin:0; padding:0; background:#f5f3ff; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,0.08); }
  .header { background:linear-gradient(135deg,#7c3aed,#06b6d4); padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:22px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.85); font-size:14px; margin:0; }
  .body { padding:32px 40px; }
  .greeting { font-size:16px; color:#1a1a2e; margin-bottom:20px; line-height:1.6; }
  .receipt-box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:12px; padding:20px 24px; margin:24px 0; }
  .receipt-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #ede9fe; font-size:14px; }
  .receipt-row:last-child { border-bottom:none; font-weight:700; color:#7c3aed; font-size:16px; }
  .receipt-label { color:#6b7280; }
  .features { margin:24px 0; }
  .feature { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; font-size:14px; color:#374151; }
  .check { color:#7c3aed; font-size:16px; flex-shrink:0; }
  .cta { text-align:center; margin:28px 0; }
  .btn { display:inline-block; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white; font-size:15px; font-weight:600; padding:13px 32px; border-radius:10px; text-decoration:none; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="${LOGO_DATA_URI}" alt="Prevai" />
    <h1>${headline}</h1>
    <p>${subline}</p>
  </div>
  <div class="body">
    <p class="greeting">${bodyIntro}</p>

    <div class="receipt-box">
      <div class="receipt-row">
        <span class="receipt-label">Piano</span>
        <span><strong>Prevai ${planName}</strong></span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Data</span>
        <span>${date}</span>
      </div>
      ${renewalRow}
      <div class="receipt-row">
        <span class="receipt-label">Importo</span>
        <span>${priceLabel}</span>
      </div>
    </div>

    <div class="features">
      ${features}
    </div>

    <div class="cta">
      <a href="https://prevai.it/dashboard" class="btn">Vai alla dashboard →</a>
    </div>

    <p style="font-size:13px;color:#6b7280;text-align:center;">Hai domande? Scrivici su <a href="mailto:supporto@prevai.it" style="color:#7c3aed;">supporto@prevai.it</a></p>
  </div>
  <div class="footer">
    Prevai · Preventivi professionali con l'AI<br/>
    Hai ricevuto questa email perché hai effettuato un acquisto su Prevai.<br/>
    ${isRecurring ? "Per gestire o disdire l'abbonamento accedi alla dashboard → Impostazioni → Piano." : ""}
  </div>
</div>
</body>
</html>`;
}

function buildWelcomeEmail(name: string): string {
  const firstName = name?.split(" ")[0] || name || "Benvenuto";
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Benvenuto su Prevai!</title>
<style>
  body { margin:0; padding:0; background:#f5f3ff; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,0.08); }
  .header { background:linear-gradient(135deg,#7c3aed,#06b6d4); padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:22px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.85); font-size:14px; margin:0; }
  .body { padding:32px 40px; }
  .greeting { font-size:16px; color:#1a1a2e; margin-bottom:20px; line-height:1.6; }
  .trial-box { background:linear-gradient(135deg,#f5f3ff,#e0f2fe); border:1px solid #ddd6fe; border-radius:12px; padding:20px 24px; margin:24px 0; }
  .trial-box h2 { margin:0 0 12px; font-size:16px; font-weight:700; color:#5b21b6; }
  .feature { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; font-size:14px; color:#374151; }
  .check { color:#7c3aed; font-size:16px; font-weight:700; flex-shrink:0; }
  .steps { margin:24px 0; }
  .step { display:flex; align-items:flex-start; gap:14px; margin-bottom:16px; }
  .step-num { background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white; font-size:12px; font-weight:700; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .step-text { font-size:14px; color:#374151; line-height:1.5; }
  .step-text strong { color:#1a1a2e; }
  .cta { text-align:center; margin:28px 0; }
  .btn { display:inline-block; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white; font-size:15px; font-weight:600; padding:13px 32px; border-radius:10px; text-decoration:none; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="${LOGO_DATA_URI}" alt="Prevai" />
    <h1>Benvenuto su Prevai! 🎉</h1>
    <p>Il tuo account è pronto — inizia subito a creare preventivi</p>
  </div>
  <div class="body">
    <p class="greeting">Ciao ${firstName},<br/><br/>sei ora registrato su <strong>Prevai</strong>, il tool che trasforma la descrizione di un lavoro in un preventivo professionale in pochi secondi. Siamo felici di averti con noi!</p>

    <div class="trial-box">
      <h2>🎁 La tua prova gratuita include:</h2>
      <div class="feature"><span class="check">✓</span> <span>Crea <strong>preventivi illimitati</strong> con l'AI</span></div>
      <div class="feature"><span class="check">✓</span> <span>Anteprima completa di ogni preventivo</span></div>
      <div class="feature"><span class="check">✓</span> <span><strong>3 download PDF gratuiti</strong> per provare il servizio</span></div>
      <div class="feature"><span class="check">✓</span> <span>Nessuna carta di credito richiesta per iniziare</span></div>
    </div>

    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text"><strong>Completa il profilo aziendale</strong><br/>Aggiungi nome, P.IVA e logo per personalizzare i PDF.</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text"><strong>Descrivi il lavoro da preventivare</strong><br/>Scrivi (o parla) e l'AI genera il preventivo in pochi secondi.</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text"><strong>Scarica e invia al cliente</strong><br/>PDF professionale pronto, subito. Poi scegli un piano per continuare.</div>
      </div>
    </div>

    <div class="cta">
      <a href="https://prevai.it/dashboard" class="btn">Crea il primo preventivo →</a>
    </div>

    <p style="font-size:13px;color:#6b7280;text-align:center;">Hai domande? Scrivici su <a href="mailto:supporto@prevai.it" style="color:#7c3aed;">supporto@prevai.it</a></p>
  </div>
  <div class="footer">
    Prevai · Preventivi professionali con l'AI<br/>
    Hai ricevuto questa email perché ti sei appena registrato su <a href="https://prevai.it" style="color:#7c3aed;">prevai.it</a>.
  </div>
</div>
</body>
</html>`;
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
      from: "Prevai <no-reply@prevai.it>",
      to: [params.toEmail],
      subject: "Benvenuto su Prevai — il tuo account è pronto 🎉",
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
    ? `🎉 Preventivo ${params.planName} sbloccato – Prevai`
    : `🎉 Piano ${params.planName} attivato – Benvenuto su Prevai!`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "Prevai <no-reply@prevai.it>",
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

function buildQuoteEmailHtml(params: {
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
}): string {
  const companyName = escapeHtml(params.companyName);
  const clientName = escapeHtml(params.clientName);
  const { quoteNumber, totale } = params;
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Preventivo da ${companyName}</title>
<style>
  body { margin:0; padding:0; background:#f5f3ff; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,0.08); }
  .header { background:linear-gradient(135deg,#7c3aed,#06b6d4); padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:20px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.85); font-size:14px; margin:0; }
  .body { padding:32px 40px; }
  .greeting { font-size:16px; color:#1a1a2e; margin-bottom:20px; line-height:1.6; }
  .quote-box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:12px; padding:20px 24px; margin:24px 0; }
  .quote-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #ede9fe; font-size:14px; }
  .quote-row:last-child { border-bottom:none; font-weight:700; color:#7c3aed; font-size:16px; }
  .quote-label { color:#6b7280; }
  .cta { text-align:center; margin:28px 0; }
  .btn { display:inline-block; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white; font-size:15px; font-weight:600; padding:13px 32px; border-radius:10px; text-decoration:none; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="${LOGO_DATA_URI}" alt="Prevai" />
    <h1>Il tuo preventivo è pronto</h1>
    <p>${companyName} ti ha inviato un preventivo professionale</p>
  </div>
  <div class="body">
    <p class="greeting">Ciao ${clientName || "Cliente"},<br/><br/>in allegato trovi il preventivo di <strong>${companyName}</strong>. Per qualsiasi domanda, non esitare a contattarci.</p>

    <div class="quote-box">
      <div class="quote-row">
        <span class="quote-label">Preventivo</span>
        <span><strong>${quoteNumber}</strong></span>
      </div>
      <div class="quote-row">
        <span class="quote-label">Importo totale</span>
        <span>\u20ac ${totale}</span>
      </div>
    </div>

    <p style="font-size:13px;color:#6b7280;text-align:center;">Documento generato con <a href="https://prevai.it" style="color:#7c3aed;">Prevai</a></p>
  </div>
  <div class="footer">
    ${companyName}<br/>
    Hai ricevuto questa email perché sei stato indicato come destinatario del preventivo.
  </div>
</div>
</body>
</html>`;
}

export async function sendQuotePdfEmail(params: {
  toEmail: string;
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  pdfBuffer: Buffer;
  filename: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping quote email");
    throw new Error("Servizio email non configurato");
  }
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "Prevai <no-reply@prevai.it>",
      to: [params.toEmail],
      subject: `Preventivo ${params.quoteNumber} – ${params.companyName}`,
      html: buildQuoteEmailHtml({
        companyName: params.companyName,
        clientName: params.clientName,
        quoteNumber: params.quoteNumber,
        totale: params.totale,
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
    throw new Error("Impossibile inviare l'email con il preventivo");
  }
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
  const { toEmail, companyName, clientName, clientEmail, clientPhone, rawInput, totale, prezzoMinimo, prezzoMassimo, incentivesSummary } = params;
  const safeClientName = escapeHtml(clientName);
  const safeClientEmail = escapeHtml(clientEmail);
  const safeClientPhone = escapeHtml(clientPhone);
  const safeRawInput = escapeHtml(rawInput);
  const safeIncentivesSummary = incentivesSummary ? escapeHtml(incentivesSummary) : incentivesSummary;
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "Prevai <no-reply@prevai.it>",
      to: [toEmail],
      subject: `⚡ Nuovo Lead Convertito da Widget — ${clientName}`,
      html: `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<title>Nuovo Lead Widget</title>
<style>
  body { margin:0; padding:0; background:#f4f4f5; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); border:1px solid #e4e4e7; }
  .header { background:linear-gradient(135deg,#7c3aed,#4f46e5); padding:28px 32px; text-align:center; color:white; }
  .header h1 { font-size:20px; font-weight:700; margin:0; }
  .header p { font-size:13px; color:rgba(255,255,255,0.85); margin:6px 0 0; }
  .body { padding:32px; }
  .section-title { font-size:12px; font-weight:700; text-transform:uppercase; color:#71717a; letter-spacing:0.05em; margin-bottom:12px; border-bottom:1px solid #e4e4e7; padding-bottom:6px; }
  .field { margin-bottom:14px; }
  .label { font-size:11px; color:#a1a1aa; font-weight:600; text-transform:uppercase; }
  .val { font-size:14px; color:#18181b; font-weight:500; margin-top:2px; }
  .price-box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:12px; padding:16px 20px; margin:20px 0; }
  .price-row { display:flex; justify-content:space-between; align-items:center; font-size:14px; color:#4f46e5; font-weight:700; }
  .incentives-box { background:#ecfdf5; border:1px solid #d1fae5; border-radius:12px; padding:16px 20px; margin:20px 0; font-size:13px; color:#065f46; white-space:pre-wrap; line-height:1.5; }
  .footer { background:#f9fafb; padding:20px 32px; text-align:center; font-size:11px; color:#71717a; border-top:1px solid #f4f4f5; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>⚡ Nuovo Lead Convertito</h1>
    <p>Un utente ha appena completato il preventivatore sul tuo sito web</p>
  </div>
  <div class="body">
    <div class="section-title">Contatti del Lead</div>
    <div class="field">
      <div class="label">Nome Cliente</div>
      <div class="val">${safeClientName}</div>
    </div>
    <div class="field">
      <div class="label">Email</div>
      <div class="val"><a href="mailto:${safeClientEmail}" style="color:#4f46e5;">${safeClientEmail}</a></div>
    </div>
    <div class="field">
      <div class="label">Telefono</div>
      <div class="val"><a href="tel:${safeClientPhone}" style="color:#4f46e5;">${safeClientPhone}</a></div>
    </div>

    <div class="section-title">Dettaglio Richiesta</div>
    <div class="field">
      <div class="label">Descrizione e Parametri</div>
      <div class="val" style="white-space:pre-wrap; font-size:13px; color:#3f3f46; line-height:1.5;">${safeRawInput}</div>
    </div>

    <div class="price-box">
      <div class="price-row">
        <span>Stima Generata AI:</span>
        <span style="font-size:16px;">€${prezzoMinimo} – €${prezzoMassimo}</span>
      </div>
      <div style="font-size:11px; color:#71717a; font-weight:normal; margin-top:4px; text-align:right;">Totale preventivo calcolato: €${totale}</div>
    </div>

    ${safeIncentivesSummary ? `<div class="incentives-box"><strong>🎁 ESITO VERIFICA INCENTIVI & BANDI:</strong>\n${safeIncentivesSummary}</div>` : ""}

    <p style="font-size:13px; color:#71717a; line-height:1.5; text-align:center; margin-top:24px;">
      Ti consigliamo di ricontattare il cliente entro 24 ore per fissare il sopralluogo ed ottimizzare la conversione.
    </p>
  </div>
  <div class="footer">
    Prevai Widget • Tecnologia di stima istantanea AI per l'edilizia
  </div>
</div>
</body>
</html>`
    });
    logger.info({ to: toEmail, clientName }, "Widget lead email notification sent to contractor");
  } catch (err) {
    logger.error({ err }, "Failed to send widget lead notification email");
  }
}
