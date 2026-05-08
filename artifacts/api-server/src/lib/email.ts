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
