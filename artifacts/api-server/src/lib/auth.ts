import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, authUsersTable, authSessionsTable, authAccountsTable, authVerificationsTable } from "@workspace/db";
import { Resend } from "resend";
import { logger } from "./logger";
import { sendWelcomeEmail } from "./email";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const secret = process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET or SESSION_SECRET must be set");
}

function getBaseURL(): string {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const first = domains.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  return process.env.BETTER_AUTH_URL ?? "http://localhost:5000";
}

function getTrustedOrigins(): string[] {
  const origins: string[] = ["http://localhost:5000", "http://localhost:80"];
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    for (const d of domains.split(",")) {
      const trimmed = d.trim();
      if (trimmed) origins.push(`https://${trimmed}`);
    }
  }
  if (process.env.BETTER_AUTH_URL) {
    origins.push(process.env.BETTER_AUTH_URL);
  }
  return origins;
}

export const auth = betterAuth({
  secret,
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  trustedOrigins: getTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUsersTable,
      session: authSessionsTable,
      account: authAccountsTable,
      verification: authVerificationsTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    async sendResetPassword({ user, url }) {
      if (!resend) {
        logger.warn("RESEND_API_KEY not set — skipping password reset email");
        return;
      }
      try {
        await resend.emails.send({
          from: "Prevai <no-reply@prevai.it>",
          to: [user.email],
          subject: "Reimposta la tua password – Prevai",
          html: buildResetPasswordEmail(user.name, url),
        });
      } catch (err) {
        logger.error({ err }, "Failed to send password reset email");
      }
    },
  },
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      if (!resend) return;
      try {
        await resend.emails.send({
          from: "Prevai <no-reply@prevai.it>",
          to: [user.email],
          subject: "Verifica la tua email – Prevai",
          html: buildVerificationEmail(user.name, url),
        });
      } catch (err) {
        logger.error({ err }, "Failed to send verification email");
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendWelcomeEmail({ toEmail: user.email, toName: user.name });
        },
      },
    },
  },
});

function buildResetPasswordEmail(name: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><title>Reimposta password – Prevai</title></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.10)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:28px 40px;text-align:center">
  <span style="font-size:26px;font-weight:700"><span style="color:#fff">prev</span><span style="color:#e0f2fe">ai</span></span>
</td></tr>
<tr><td style="background:#fff;padding:32px 40px">
  <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e">Reimposta la tua password</h1>
  <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7">Ciao ${name},<br/>hai richiesto di reimpostare la password del tuo account Prevai. Clicca sul pulsante qui sotto:</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
    <tr><td align="center" style="border-radius:10px;background:linear-gradient(135deg,#7c3aed,#06b6d4)">
      <a href="${url}" style="display:inline-block;color:#fff;font-size:15px;font-weight:600;padding:13px 32px;border-radius:10px;text-decoration:none">Reimposta password →</a>
    </td></tr>
  </table>
  <p style="margin:0;font-size:13px;color:#9ca3af">Non hai richiesto questo? Ignora questa email. La tua password rimane invariata.</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
  <p style="margin:0;font-size:12px;color:#9ca3af">&copy; ${new Date().getFullYear()} Prevai · Preventivi professionali con l'AI</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildVerificationEmail(name: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><title>Verifica email – Prevai</title></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.10)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:28px 40px;text-align:center">
  <span style="font-size:26px;font-weight:700"><span style="color:#fff">prev</span><span style="color:#e0f2fe">ai</span></span>
</td></tr>
<tr><td style="background:#fff;padding:32px 40px">
  <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e">Verifica il tuo indirizzo email</h1>
  <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7">Ciao ${name},<br/>clicca sul pulsante qui sotto per verificare il tuo indirizzo email su Prevai.</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
    <tr><td align="center" style="border-radius:10px;background:linear-gradient(135deg,#7c3aed,#06b6d4)">
      <a href="${url}" style="display:inline-block;color:#fff;font-size:15px;font-weight:600;padding:13px 32px;border-radius:10px;text-decoration:none">Verifica email →</a>
    </td></tr>
  </table>
  <p style="margin:0;font-size:13px;color:#9ca3af">Non hai creato un account su Prevai? Ignora questa email.</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
  <p style="margin:0;font-size:12px;color:#9ca3af">&copy; ${new Date().getFullYear()} Prevai · Preventivi professionali con l'AI</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
