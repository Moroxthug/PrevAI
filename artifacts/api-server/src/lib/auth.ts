import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, twoFactor, emailOTP } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db, authUsersTable, authSessionsTable, authAccountsTable, authVerificationsTable, authTwoFactorTable, businessProfilesTable, organizationMembersTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { Resend } from "resend";
import { logger } from "./logger";
import { sendWelcomeEmail, escapeHtml } from "./email";
import { notifyHub } from "./hub";
import { getBaseUrl } from "./baseUrl";
import { recordSecurityAuditEvent } from "./auditLog";
import { layout, p, button, code } from "./emailLayout";
import { MARKET } from "@workspace/config";

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
          await notifyHub("signup", "New signup", user.email);
          await sendWelcomeEmail({ toEmail: user.email, toName: user.name });
        },
      },
    },
  },
});

export function buildResetPasswordEmail(name: string, url: string): string {
  return layout({
    title: "Reimposta la tua password – PrevAI",
    preheader: "Il link per scegliere una nuova password. Se non sei stato tu, ignora questa email.",
    eyebrow: { text: "Sicurezza account", tone: "info" },
    heading: "Reimposta la tua password",
    bodyHtml:
      p(`Ciao ${escapeHtml(name)}, hai chiesto di reimpostare la password del tuo account ${MARKET.brand}. Scegline una nuova dal pulsante qui sotto.`) +
      button(url, "Scegli una nuova password") +
      p("Non hai fatto tu la richiesta? Ignora questa email: la tua password resta invariata.", { muted: true, small: true, center: true }),
  });
}

/** POCKET-1: l'app conferma l'indirizzo con un codice scritto nell'app (un link si aprirebbe nel browser). */
export function buildVerificationCodeEmail(name: string, otp: string): string {
  return layout({
    title: "Il tuo codice – PrevAI",
    preheader: `Il tuo codice di conferma è ${otp}. Vale 15 minuti.`,
    eyebrow: { text: "Conferma indirizzo", tone: "info" },
    heading: "Il tuo codice di conferma",
    bodyHtml:
      p(`Ciao ${escapeHtml(name)}, scrivi questo codice nell'app ${MARKET.brand} per confermare il tuo indirizzo:`) +
      code(otp) +
      p(`Il codice vale 15 minuti. Non hai creato un account su ${MARKET.brand}? Ignora questa email.`, { muted: true, small: true, center: true }),
  });
}

export function buildVerificationEmail(name: string, url: string): string {
  return layout({
    title: "Verifica la tua email – PrevAI",
    preheader: "Un clic per confermare il tuo indirizzo e iniziare a creare preventivi.",
    eyebrow: { text: "Ultimo passo", tone: "brand" },
    heading: "Conferma il tuo indirizzo email",
    bodyHtml:
      p(`Ciao ${escapeHtml(name)}, manca solo un clic: conferma il tuo indirizzo e il tuo account ${MARKET.brand} è pronto.`) +
      button(url, "Conferma email") +
      p(`Non hai creato un account su ${MARKET.brand}? Ignora questa email.`, { muted: true, small: true, center: true }),
  });
}
