import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, twoFactor, emailOTP } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db, authUsersTable, authSessionsTable, authAccountsTable, authVerificationsTable, authTwoFactorTable, businessProfilesTable, organizationMembersTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { Resend } from "resend";
import { logger } from "./logger";
import { sendWelcomeEmail, escapeHtml } from "./email";
import { getBaseUrl } from "./baseUrl";
import { recordSecurityAuditEvent } from "./auditLog";

// Minimal, duplicate-of-`resolveActingOrg` org lookup — kept local rather than
// imported from ../middlewares/authMiddleware to avoid that module's circular
// import back onto `auth` here. Only used to scope audit rows written from
// better-auth's own request lifecycle (login, 2FA, session revoke).
async function resolveOrgForAudit(actorId: string): Promise<string> {
  const [profile] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, actorId));
  if (profile) return actorId;
  const [membership] = await db
    .select()
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.userId, actorId), eq(organizationMembersTable.status, "active")))
    .orderBy(asc(organizationMembersTable.joinedAt))
    .limit(1);
  return membership?.ownerId ?? actorId;
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Gmail and most webmail clients strip data: URI images from HTML emails,
// so the logo must be a real hosted URL rather than an inline base64 SVG.
const LOGO_URL = `${getBaseUrl()}/prevai-logo.png`;

const secret = process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET or SESSION_SECRET must be set");
}

function getBaseURL(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.PREVAI_BASE_URL) return process.env.PREVAI_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5000";
}

export function getTrustedOrigins(): string[] {
  // Fase 41: local dev servers are trusted only outside production (a reset
  // link's callbackURL must never be able to point at a program on localhost).
  const origins: string[] = process.env.NODE_ENV === "production" ? [] : ["http://localhost:5000", "http://localhost:3000"];
  if (process.env.BETTER_AUTH_URL) origins.push(process.env.BETTER_AUTH_URL);
  if (process.env.PREVAI_BASE_URL) origins.push(process.env.PREVAI_BASE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);
  // Support additional trusted origins via env var (comma-separated)
  const extra = process.env.TRUSTED_ORIGINS;
  if (extra) {
    for (const o of extra.split(",")) {
      const trimmed = o.trim();
      if (trimmed) origins.push(trimmed);
    }
  }
  return origins;
}

/**
 * The phone app (artifacts/pocket) calls from https://localhost and signs in with a bearer
 * token, no cookies: CORS answers these origins without credentials (app.ts, nativeApp.ts);
 * better-auth still checks a sign-in's Origin against its trusted list. capacitor://localhost
 * is for an iOS shell later.
 */
export const NATIVE_APP_ORIGINS = ["https://localhost", "capacitor://localhost"];

/**
 * The app's password-reset deep link. better-auth sends the emailed link through
 * /reset-password/:token?callbackURL=prevai://forgot-password and only redirects when that URL
 * matches a trusted origin; a custom-scheme pattern matches scheme and host exactly, so only
 * this one deep link is trusted.
 */
const NATIVE_APP_SCHEMES = ["prevai://forgot-password"];

const fromNativeApp = (request: Request | undefined): boolean => {
  const origin = request?.headers.get("origin");
  return !!origin && NATIVE_APP_ORIGINS.includes(origin);
};

/**
 * POCKET-1: l'app del telefono conferma un indirizzo nuovo con un codice di 6 cifre scritto
 * nell'app, non con un link: il link si aprirebbe nel browser, farebbe entrare la persona
 * lì e lascerebbe l'app senza accesso. Sono serviti solo i due endpoint che confermano un
 * indirizzo, e solo per un account il cui indirizzo non è ancora confermato: per uno già
 * confermato un codice sarebbe un modo di entrare con la sola casella di posta (senza
 * password né secondo passaggio), quindi non si manda e non si accetta niente.
 */
const EMAIL_OTP_PATHS = ["/email-otp/send-verification-otp", "/email-otp/verify-email"];
const EMAIL_OTP_DISABLED = [
  "/email-otp/check-verification-otp",
  "/sign-in/email-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

async function unverifiedUser(email: unknown): Promise<boolean> {
  if (typeof email !== "string" || !email) return false;
  const [row] = await db
    .select({ emailVerified: authUsersTable.emailVerified })
    .from(authUsersTable)
    .where(eq(authUsersTable.email, email.trim().toLowerCase()))
    .limit(1);
  return !!row && !row.emailVerified;
}

export const auth = betterAuth({
  secret,
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  trustedOrigins: [...getTrustedOrigins(), ...NATIVE_APP_ORIGINS, ...NATIVE_APP_SCHEMES],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUsersTable,
      session: authSessionsTable,
      account: authAccountsTable,
      verification: authVerificationsTable,
      twoFactor: authTwoFactorTable,
    },
  }),
  plugins: [
    bearer(),
    twoFactor({ issuer: "PrevAI" }),
    emailOTP({
      otpLength: 6,
      expiresIn: 15 * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      disableSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "email-verification") return;
        if (!resend) {
          logger.warn("RESEND_API_KEY not set — skipping verification code email");
          return;
        }
        try {
          const [user] = await db.select({ name: authUsersTable.name }).from(authUsersTable).where(eq(authUsersTable.email, email)).limit(1);
          await resend.emails.send({
            from: "PrevAI <no-reply@prevai.it>",
            to: [email],
            subject: `${otp} è il tuo codice PrevAI`,
            html: buildVerificationCodeEmail(user?.name ?? "", otp),
          });
        } catch (err) {
          logger.error({ err }, "Failed to send verification code email");
        }
      },
    }),
  ],
  disabledPaths: EMAIL_OTP_DISABLED,
  hooks: {
    // POCKET-1: i codici confermano solo un indirizzo non ancora confermato (vedi EMAIL_OTP_PATHS).
    before: createAuthMiddleware(async (ctx) => {
      if (!ctx.path || !EMAIL_OTP_PATHS.includes(ctx.path)) return undefined;
      const body = (ctx.body ?? {}) as { email?: unknown; type?: unknown };
      if (ctx.path === "/email-otp/send-verification-otp") {
        if (body.type !== "email-verification" || !(await unverifiedUser(body.email))) return ctx.json({ success: true });
        return undefined;
      }
      if (!(await unverifiedUser(body.email))) throw new APIError("BAD_REQUEST", { code: "INVALID_OTP", message: "Invalid OTP" });
      return undefined;
    }),
    // IMPORTANT: better-auth re-throws any non-APIError raised in an `after`
    // hook, which replaces the endpoint's real response with a 500 — so a bug
    // or transient DB error in this best-effort audit logging would turn a
    // correct login into "invalid credentials" for the user. Never let
    // anything in here escape; log and swallow instead.
    after: createAuthMiddleware(async (ctx) => {
      try {
        const newSession = ctx.context.newSession;
        if (newSession && (ctx.path === "/sign-in/email" || ctx.path === "/sign-up/email" || ctx.path === "/two-factor/verify-totp" || ctx.path === "/two-factor/verify-backup-code")) {
          const orgId = await resolveOrgForAudit(newSession.user.id);
          await recordSecurityAuditEvent({
            orgId,
            actorUserId: newSession.user.id,
            action: "login",
            ipAddress: newSession.session.ipAddress ?? null,
            userAgent: newSession.session.userAgent ?? null,
          });
          return;
        }
        const session = ctx.context.session;
        if (!session) return;
        if (ctx.path === "/two-factor/enable") {
          const orgId = await resolveOrgForAudit(session.user.id);
          await recordSecurityAuditEvent({ orgId, actorUserId: session.user.id, action: "two_factor.enabled" });
        } else if (ctx.path === "/two-factor/disable") {
          const orgId = await resolveOrgForAudit(session.user.id);
          await recordSecurityAuditEvent({ orgId, actorUserId: session.user.id, action: "two_factor.disabled" });
        } else if (ctx.path === "/revoke-session") {
          const orgId = await resolveOrgForAudit(session.user.id);
          await recordSecurityAuditEvent({ orgId, actorUserId: session.user.id, action: "session.revoked" });
        } else if (ctx.path === "/revoke-sessions" || ctx.path === "/revoke-other-sessions") {
          const orgId = await resolveOrgForAudit(session.user.id);
          await recordSecurityAuditEvent({ orgId, actorUserId: session.user.id, action: "session.revoked_all" });
        }
      } catch (err) {
        logger.error({ err, path: ctx.path }, "Security audit hook failed (non-fatal, auth response unaffected)");
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // Phase 64: a reset is how a user takes an account back — every session
    // that existed before it (including an attacker's) must die with it.
    // better-auth defaults this to false.
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      if (!resend) {
        logger.warn("RESEND_API_KEY not set — skipping password reset email");
        return;
      }
      try {
        await resend.emails.send({
          from: "PrevAI <no-reply@prevai.it>",
          to: [user.email],
          subject: "Reimposta la tua password – PrevAI",
          html: buildResetPasswordEmail(user.name, url),
        });
      } catch (err) {
        logger.error({ err }, "Failed to send password reset email");
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }, request) {
      if (!resend) return;
      // POCKET-1: l'app del telefono chiede un codice al posto del link (si aprirebbe nel browser).
      if (fromNativeApp(request)) return;
      try {
        await resend.emails.send({
          from: "PrevAI <no-reply@prevai.it>",
          to: [user.email],
          subject: "Verifica la tua email – PrevAI",
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
  <img src="${LOGO_URL}" alt="PrevAI" height="36" />
</td></tr>
<tr><td style="background:#fff;padding:32px 40px">
  <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e">Reimposta la tua password</h1>
  <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7">Ciao ${escapeHtml(name)},<br/>hai richiesto di reimpostare la password del tuo account Prevai. Clicca sul pulsante qui sotto:</p>
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

/** POCKET-1: l'app conferma l'indirizzo con un codice scritto nell'app (un link si aprirebbe nel browser). */
function buildVerificationCodeEmail(name: string, code: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><title>Il tuo codice – PrevAI</title></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.10)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:28px 40px;text-align:center">
  <img src="${LOGO_URL}" alt="PrevAI" height="36" />
</td></tr>
<tr><td style="background:#fff;padding:32px 40px">
  <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e">Il tuo codice di conferma</h1>
  <p style="margin:0;font-size:14px;color:#374151;line-height:1.7">Ciao ${escapeHtml(name)},<br/>scrivi questo codice nell'app PrevAI per confermare il tuo indirizzo:</p>
  <p style="margin:22px 0;font-size:32px;font-weight:800;letter-spacing:8px;color:#1a1a2e;font-variant-numeric:tabular-nums">${escapeHtml(code)}</p>
  <p style="margin:0;font-size:13px;color:#9ca3af">Il codice vale 15 minuti. Non hai creato un account su PrevAI? Ignora questa email.</p>
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
  <img src="${LOGO_URL}" alt="PrevAI" height="36" />
</td></tr>
<tr><td style="background:#fff;padding:32px 40px">
  <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e">Verifica il tuo indirizzo email</h1>
  <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7">Ciao ${escapeHtml(name)},<br/>clicca sul pulsante qui sotto per verificare il tuo indirizzo email su Prevai.</p>
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
