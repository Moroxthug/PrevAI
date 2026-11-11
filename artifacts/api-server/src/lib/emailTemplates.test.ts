// EMAIL-1: every email PrevAI sends goes through emailLayout.
//
// Renders each template with sample data and checks the invariants that make
// it look right everywhere (dark-mode meta, baked logo header or company chip,
// no <style>-only layout, unsubscribe where required).
//
// Preview: EMAIL_PREVIEW_DIR=/some/dir pnpm vitest run src/lib/emailTemplates.test.ts
// writes one .html per email plus index.html.

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

type Sent = { to?: unknown; subject: string; html: string; headers?: Record<string, string> };
const sent: Sent[] = [];

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (m: Sent) => {
        sent.push(m);
        return { data: { id: "test" }, error: null };
      },
    };
  },
}));
vi.mock("./connectedEmailSend.js", () => ({
  sendCustomerEmail: async (m: Sent) => {
    sent.push(m);
  },
}));

const rendered: Array<{ name: string; subject: string; html: string }> = [];
async function capture(name: string, fn: () => Promise<unknown>): Promise<string> {
  const before = sent.length;
  await fn();
  const m = sent[sent.length - 1];
  if (sent.length === before || !m) throw new Error(`${name}: nothing sent`);
  rendered.push({ name, subject: m.subject, html: m.html });
  return m.html;
}
function keep(name: string, subject: string, html: string): string {
  rendered.push({ name, subject, html });
  return html;
}

const profile = {
  companyName: "Edil Rossi S.r.l.",
  address: "Via Roma 12, 20121 Milano",
  phone: "+39 02 1234567",
  email: "info@edilrossi.it",
  logoUrl: null,
} as never;

beforeAll(() => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.GROQ_API_KEY ??= "test-key-not-used";
  process.env.PREVAI_BASE_URL = "https://prevai.it";
});

afterAll(() => {
  const dir = process.env.EMAIL_PREVIEW_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const links: string[] = [];
  rendered.forEach((r, i) => {
    const file = `${String(i + 1).padStart(2, "0")}-${r.name}.html`;
    fs.writeFileSync(path.join(dir, file), r.html);
    links.push(`<li><a href="${file}">${r.name}</a> — ${r.subject.replace(/</g, "&lt;")}</li>`);
  });
  fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html><meta charset="utf-8"><title>Email PrevAI</title><ul>${links.join("")}</ul>`);
});

describe("EMAIL-1 templates", () => {
  it("renders every email with the shared layout", { timeout: 60_000 }, async () => {
    const email = await import("./email.js");
    const auth = await import("./auth.js");
    const contracts = await import("./emailContracts.js");
    const invoices = await import("./emailInvoices.js");
    const portal = await import("./emailPortal.js");
    const team = await import("./emailTeam.js");
    const account = await import("./emailAccount.js");
    const lead = await import("./leadMessaging.js");
    const quoteMsg = await import("./quoteMessaging.js");
    const job = await import("./jobMessaging.js");
    const client = await import("./clientMessage.js");
    const campaign = await import("./emailCampaign.js");

    const inAMonth = new Date(Date.now() + 30 * 864e5);

    // PrevAI → its users
    await capture("welcome", () => email.sendWelcomeEmail({ toEmail: "mario@example.com", toName: "Mario Bianchi" }));
    await capture("subscription", () => email.sendSubscriptionEmail({ toEmail: "mario@example.com", toName: "Mario", planName: "Mastro", planPrice: 24, planInterval: "month" }));
    keep("auth-verify", "Verifica la tua email – PrevAI", auth.buildVerificationEmail("Mario", "https://prevai.it/api/auth/verify?token=x"));
    keep("auth-code", "123456 è il tuo codice PrevAI", auth.buildVerificationCodeEmail("Mario", "123456"));
    keep("auth-reset", "Reimposta la tua password – PrevAI", auth.buildResetPasswordEmail("Mario", "https://prevai.it/reset?token=x"));
    await capture("quote-accepted", () => email.sendQuoteAcceptedEmail({ toEmail: "mario@example.com", companyName: "Edil Rossi", clientName: "Giulia Verdi", quoteNumber: "N° 12.2026 del 10/11/2026", totale: "18.450,00", acceptedAt: "11 novembre 2026", quoteUrl: "https://prevai.it/dashboard/quotes/1" }));
    await capture("widget-lead", () => email.sendWidgetLeadNotification({ toEmail: "mario@example.com", companyName: "Edil Rossi", clientName: "Giulia Verdi", clientEmail: "giulia@example.com", clientPhone: "+39 333 1234567", rawInput: "Rifacimento bagno 6 mq, piastrelle e sanitari nuovi", totale: "9.800,00", prezzoMinimo: "8.500", prezzoMassimo: "11.000", incentivesSummary: "Bonus ristrutturazione 50%" }));
    await capture("contract-declined", () => contracts.sendContractDeclinedEmail({ toEmail: "mario@example.com", customerName: "Giulia Verdi", contractNumber: "C-2026-004", reason: "Vorrei rivedere i tempi di consegna.", dashboardUrl: "https://prevai.it/dashboard" }));
    await capture("client-reply", () => portal.sendClientReplyEmail({ toEmail: "mario@example.com", clientName: "Giulia Verdi", body: "Va bene per lunedì alle 8.", jobName: "Bagno via Roma", dashboardUrl: "https://prevai.it/dashboard" }));
    await capture("team-invite", () => team.sendTeamMemberInviteEmail({ toEmail: "luca@example.com", companyName: "Edil Rossi", inviterName: "Mario", role: "Capocantiere", url: "https://prevai.it/invite/x" }));
    await capture("account-export", () => account.sendExportReadyEmail({ to: "mario@example.com", name: "Mario", parts: 2, bytes: 52_000_000, expiresAt: inAMonth, url: "https://prevai.it/export/x" }));
    await capture("account-deletion", () => account.sendDeletionRequestedEmail({ to: "mario@example.com", name: "Mario", scheduledFor: inAMonth, ownsOrg: true, cancelUrl: "https://prevai.it/cancel" }));

    // Company → its customers
    await capture("quote-to-client", () => email.sendQuotePdfEmail({ toEmail: "giulia@example.com", userId: "u1", companyName: "Edil Rossi S.r.l.", clientName: "Giulia Verdi", quoteNumber: "N° 12.2026 del 10/11/2026", totale: "18.450,00", pdfBuffer: Buffer.from("x"), filename: "p.pdf", publicUrl: "https://prevai.it/p/abc", aiGenerated: true }));
    await capture("widget-client", () => email.sendWidgetClientConfirmationEmail({ toEmail: "giulia@example.com", userId: "u1", clientName: "Giulia", companyName: "Edil Rossi S.r.l.", companyPhone: "+39 02 1234567", companyEmail: "info@edilrossi.it", prezzoMinimo: "8.500", prezzoMassimo: "11.000" }));
    await capture("contract-sign", () => contracts.sendContractSigningEmail({ toEmail: "giulia@example.com", userId: "u1", customerName: "Giulia Verdi", companyName: "Edil Rossi S.r.l.", contractNumber: "C-2026-004", total: 18450, signUrl: "https://prevai.it/c/x", expiresAt: inAMonth, message: "Ecco il contratto come concordato al telefono." }));
    await capture("contract-otp", () => contracts.sendContractOtpEmail({ toEmail: "giulia@example.com", code: "482913", companyName: "Edil Rossi S.r.l." }));
    await capture("invoice", () => invoices.sendInvoiceEmail({ toEmail: "giulia@example.com", userId: "u1", customerName: "Giulia Verdi", companyName: "Edil Rossi S.r.l.", number: "PF-2026-031", totalCents: 553_500, balanceCents: 553_500, dueDate: inAMonth, publicUrl: "https://prevai.it/i/x", iban: "IT60X0542811101000000123456", pdfBuffer: Buffer.from("x"), typeLabel: "Fattura pro-forma" }));
    await capture("invoice-reminder", () => invoices.sendInvoiceReminderEmail({ toEmail: "giulia@example.com", userId: "u1", customerName: "Giulia Verdi", companyName: "Edil Rossi S.r.l.", number: "PF-2026-031", totalCents: 553_500, balanceCents: 200_000, dueDate: new Date(), publicUrl: "https://prevai.it/i/x", daysOverdue: 5 }));
    await capture("portal-invite", () => portal.sendPortalInviteEmail({ userId: "u1", toEmail: "giulia@example.com", clientName: "Giulia Verdi", companyName: "Edil Rossi S.r.l.", portalUrl: "https://prevai.it/portal/x" }));
    keep("lead-followup", "Sei ancora interessato al tuo progetto?", lead.buildFollowupEmailHtml({ clientName: "Giulia Verdi", profile, stage: 0, unsubscribeToken: "tok" }));
    keep("quote-followup", "Ci stai ancora pensando?", quoteMsg.buildFollowupEmailHtml({ clientName: "Giulia Verdi", profile, stage: 0, unsubscribeToken: "tok", quoteNumber: "N° 12.2026", totale: "€ 18.450,00", publicUrl: "https://prevai.it/p/abc" }));
    keep("job-review", "Grazie per la fiducia", job.wrapEmailHtml({ clientName: "Giulia Verdi", profile, unsubscribeToken: "tok", subject: "Grazie per la fiducia — ci lasci una recensione?", bodyHtml: "<p>Ci farebbe piacere una tua recensione.</p>" }));
    keep("client-message", "Sopralluogo", client.buildClientMessageHtml({ subject: "Sopralluogo", body: "Buongiorno Giulia,\nconfermo il sopralluogo per lunedì alle 8.\n\nA presto,\nMario", profile }));

    // Campaigns
    for (const [id, c] of Object.entries(campaign.CAMPAIGN_EXAMPLES)) {
      keep(`campaign-${id}`, c.subject, campaign.buildCampaignEmail({ ...c, firstName: "Mario" }, { unsubscribeUrl: "https://prevai.it/api/public/unsubscribe?t=x", campaignId: id }));
    }

    expect(rendered.length).toBeGreaterThan(20);
    for (const r of rendered) {
      expect(r.html, r.name).toContain('name="color-scheme" content="light dark"');
      expect(r.html, r.name).toMatch(/\/email\/header\.png|class="e-chipwrap"/);
      expect(r.html, r.name).not.toContain("prevai-logo.png");
      expect(r.html, r.name).not.toMatch(/class="(box|row|cta|btn|msg|muted)"/);
      expect(r.html, r.name).not.toContain("undefined");
    }
    for (const n of ["lead-followup", "quote-followup", "job-review"]) {
      expect(rendered.find((r) => r.name === n)!.html).toContain("Annulla l'iscrizione");
    }
    expect(rendered.find((r) => r.name === "client-message")!.html.toLowerCase()).not.toContain("iscrizione");
  });

  it("campaigns tag own links with UTM and leave others alone", async () => {
    const { withUtm, campaignHeaders } = await import("./emailCampaign.js");
    expect(withUtm("https://prevai.it/dashboard", "nov")).toContain("utm_campaign=nov");
    expect(withUtm("https://example.com/x", "nov")).toBe("https://example.com/x");
    expect(campaignHeaders("https://prevai.it/u?t=1")["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("escapes user text in the layout", async () => {
    const { layout } = await import("./emailLayout.js");
    const html = layout({ title: "<x>", heading: "<script>", bodyHtml: "", brand: { kind: "company", name: '"><img src=x>' } });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('"><img src=x>');
  });
});
