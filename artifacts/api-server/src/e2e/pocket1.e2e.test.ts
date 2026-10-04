// POCKET-1 (docs/POCKET-APP-PLAN.md): il lato server dell'app Expo. L'app chiama l'API dalla sua
// origine (https://localhost) con un token bearer e senza cookie. Provato qui sul server vero:
//  - preflight e CORS rispondono all'app senza credenziali; un'altra origine non riceve niente;
//  - l'accesso restituisce il token in un header esposto, e il solo token è la sessione;
//  - un cookie mandato dall'origine dell'app non conta; l'impresa attiva viaggia in X-Active-Org;
//  - i due passaggi si completano con il cookie nel tunnel X-Auth-Cookie;
//  - un account nuovo creato dall'app conferma l'indirizzo con un codice di 6 cifre (niente link),
//    e i codici valgono solo per un indirizzo non ancora confermato;
//  - il link di reimpostazione della password torna nell'app (prevai://forgot-password), e solo quello;
//  - gli inviti aperti per l'indirizzo e l'anteprima di un codice d'accesso.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { db, authUsersTable, organizationMembersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { startServer, stopServer, createOrg, cleanupUsers, type TestUser } from "./harness.js";
import { auth } from "../lib/auth.js";
import { emailsTo, linksIn } from "./mailbox.js";

const APP = "https://localhost";
const PASSWORD = "E2e-App-Passw0rd!!";
const DEEP_LINK = "prevai://forgot-password";
let baseUrl = "";
let owner: TestUser;
let userId = "";
const email = `e2e-app-${randomUUID()}@example.invalid`;
const made: string[] = [];
const settle = () => new Promise((r) => setTimeout(r, 300));

type Res = { status: number; body: any; headers: Headers };

async function call(path: string, opts: { method?: string; body?: unknown; origin?: string; headers?: Record<string, string>; redirect?: "manual" } = {}): Promise<Res> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.origin) headers.origin = opts.origin;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: opts.redirect,
  });
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body, headers: res.headers };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const exposed = (h: Headers): string[] => (h.get("access-control-expose-headers") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

function totp(uri: string, at = Date.now()): string {
  const u = new URL(uri);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of u.searchParams.get("secret")!.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v !== -1) bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / Number(u.searchParams.get("period") ?? 30))));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const o = hmac[hmac.length - 1]! & 0xf;
  const code = ((hmac[o]! & 0x7f) << 24) | (hmac[o + 1]! << 16) | (hmac[o + 2]! << 8) | hmac[o + 3]!;
  return String(code % 10 ** Number(u.searchParams.get("digits") ?? 6)).padStart(6, "0");
}

const newEmail = (tag: string) => `e2e-pk1-${tag}-${randomUUID().slice(0, 8)}@example.invalid`;
const linkMails = (to: string) => emailsTo(to).filter((m) => linksIn(m).some((l) => l.includes("/api/auth/verify-email")));
const codeMails = (to: string) => emailsTo(to).filter((m) => /\b\d{6}\b/.test(m.subject));
const codeIn = (to: string) => codeMails(to).at(-1)?.subject.match(/\b(\d{6})\b/)?.[1] ?? null;

async function signUp(address: string, origin?: string) {
  const r = await call("/api/auth/sign-up/email", { origin, body: { name: "Pocket Person", email: address, password: PASSWORD, callbackURL: "/onboarding" } });
  expect(r.status).toBe(200);
  const [u] = await db.select({ id: authUsersTable.id }).from(authUsersTable).where(eq(authUsersTable.email, address));
  made.push(u!.id);
  await settle();
  return u!.id;
}

async function verified(address: string): Promise<boolean> {
  const [u] = await db.select({ v: authUsersTable.emailVerified }).from(authUsersTable).where(eq(authUsersTable.email, address));
  return !!u?.v;
}

beforeAll(async () => {
  baseUrl = await startServer();
  owner = await createOrg({ companyName: "E2E App Owner Co" });
  userId = await signUp(email);
  await db.update(authUsersTable).set({ emailVerified: true }).where(eq(authUsersTable.id, userId));
});

afterAll(async () => {
  await cleanupUsers([owner?.userId, ...made].filter(Boolean) as string[]);
  if (made.length) await db.delete(authUsersTable).where(inArray(authUsersTable.id, made)).catch(() => undefined);
  await stopServer();
});

describe("l'origine dell'app del telefono", () => {
  test("il preflight risponde all'app, senza credenziali", async () => {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "OPTIONS",
      headers: { origin: APP, "access-control-request-method": "POST", "access-control-request-headers": "content-type,authorization,x-active-org" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(APP);
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    expect(res.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  test("l'accesso restituisce il token in un header esposto; il solo token è la sessione", async () => {
    const signIn = await call("/api/auth/sign-in/email", { origin: APP, body: { email, password: PASSWORD } });
    expect(signIn.status).toBe(200);
    const token = signIn.headers.get("set-auth-token");
    expect(token).toBeTruthy();
    expect(signIn.headers.get("access-control-allow-origin")).toBe(APP);
    expect(signIn.headers.get("access-control-allow-credentials")).toBeNull();
    expect(exposed(signIn.headers)).toEqual(expect.arrayContaining(["set-auth-token", "x-active-org", "x-auth-cookie"]));

    const me = await call("/api/auth/get-session", { origin: APP, headers: bearer(token!) });
    expect(me.body?.user?.id).toBe(userId);
    const api = await call("/api/business-profile", { origin: APP, headers: bearer(token!) });
    expect(api.status).not.toBe(401);
    expect(api.headers.get("access-control-allow-origin")).toBe(APP);
  });

  test("un cookie mandato dall'origine dell'app non conta", async () => {
    const web = await fetch(`${baseUrl}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
    expect(web.status).toBe(200);
    const cookie = web.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    expect(cookie).toContain("session_token");
    const asApp = await call("/api/auth/get-session", { origin: APP, headers: { cookie } });
    expect(asApp.body ?? null).toBeNull();
    expect((await call("/api/business-profile", { origin: APP, headers: { cookie } })).status).toBe(401);
  });

  test("un'origine che non è l'app non riceve nessuna risposta CORS", async () => {
    const res = await call("/api/auth/sign-in/email", { origin: "https://evil.example", body: { email, password: PASSWORD } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const pre = await fetch(`${baseUrl}/api/jobs`, { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "GET" } });
    expect(pre.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("l'impresa attiva viaggia in X-Active-Org", () => {
  test("il cambio risponde con l'header; mandarlo vale come quell'impresa; una in cui non sei viene ignorata", async () => {
    await db.insert(organizationMembersTable).values({ ownerId: owner.userId, userId, invitedEmail: email, invitedByUserId: owner.userId, role: "office", status: "active", joinedAt: new Date() });
    const signIn = await call("/api/auth/sign-in/email", { origin: APP, body: { email, password: PASSWORD } });
    const token = signIn.headers.get("set-auth-token")!;

    const sw = await call("/api/team/switch", { origin: APP, headers: bearer(token), body: { orgId: owner.userId } });
    expect(sw.status).toBe(200);
    expect(sw.headers.get("x-active-org")).toBe(owner.userId);

    const asMember = await call("/api/business-profile", { origin: APP, headers: { ...bearer(token), "x-active-org": owner.userId } });
    expect(asMember.status).toBe(200);
    expect(asMember.body?.companyName).toBe("E2E App Owner Co");

    const stranger = await createOrg({ companyName: "E2E Not Yours Co" });
    try {
      const forged = await call("/api/business-profile", { origin: APP, headers: { ...bearer(token), "x-active-org": stranger.userId } });
      expect(forged.body?.companyName ?? null).not.toBe("E2E Not Yours Co");
    } finally {
      await cleanupUsers([stranger.userId]);
    }
  });
});

describe("i due passaggi dall'app", () => {
  test("il cookie a metà accesso viaggia in X-Auth-Cookie; il codice completa l'accesso", async () => {
    const first = await call("/api/auth/sign-in/email", { origin: APP, body: { email, password: PASSWORD } });
    const token = first.headers.get("set-auth-token")!;
    const enable = await call("/api/auth/two-factor/enable", { origin: APP, headers: bearer(token), body: { password: PASSWORD, issuer: "PrevAI" } });
    expect(enable.status).toBe(200);
    const uri: string = enable.body.totpURI;
    expect((await call("/api/auth/two-factor/verify-totp", { origin: APP, headers: bearer(token), body: { code: totp(uri) } })).status).toBe(200);

    const half = await call("/api/auth/sign-in/email", { origin: APP, body: { email, password: PASSWORD } });
    expect(half.status).toBe(200);
    expect(half.body?.twoFactorRedirect).toBe(true);
    const carried = half.headers.get("x-auth-cookie");
    expect(carried).toMatch(/better-auth\.two_factor=/);
    expect(carried).not.toMatch(/session_token/);

    // Senza il cookie portato il codice non ha niente da completare.
    expect((await call("/api/auth/two-factor/verify-totp", { origin: APP, body: { code: totp(uri) } })).status).toBeGreaterThanOrEqual(400);
    // Un cookie di sessione infilato nel tunnel viene scartato.
    const smuggled = await call("/api/auth/get-session", { origin: APP, headers: { "x-auth-cookie": `better-auth.session_token=${token}` } });
    expect(smuggled.body ?? null).toBeNull();

    const done = await call("/api/auth/two-factor/verify-totp", { origin: APP, headers: { "x-auth-cookie": carried! }, body: { code: totp(uri) } });
    expect(done.status).toBe(200);
    const session = done.headers.get("set-auth-token");
    expect(session).toBeTruthy();
    expect((await call("/api/auth/get-session", { origin: APP, headers: bearer(session!) })).body?.user?.id).toBe(userId);
  });
});

describe("confermare un indirizzo nuovo nell'app", () => {
  test("registrazione dall'app: niente link ma un codice; uno sbagliato rifiutato, quello giusto fa entrare con un token", async () => {
    const address = newEmail("app");
    await signUp(address, APP);
    expect(linkMails(address)).toHaveLength(0);

    const send = await call("/api/auth/email-otp/send-verification-otp", { origin: APP, body: { email: address, type: "email-verification" } });
    expect(send.status).toBe(200);
    await settle();
    const code = codeIn(address);
    expect(code).toMatch(/^\d{6}$/);
    const mail = codeMails(address).at(-1)!;
    expect(mail.html).toContain(code);
    expect(linksIn(mail).some((l) => l.includes("verify-email"))).toBe(false);

    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
    const bad = await call("/api/auth/email-otp/verify-email", { origin: APP, body: { email: address, otp: wrong } });
    expect(bad.status).toBe(400);
    expect(bad.headers.get("set-auth-token")).toBeNull();
    expect(await verified(address)).toBe(false);

    const ok = await call("/api/auth/email-otp/verify-email", { origin: APP, body: { email: address, otp: code } });
    expect(ok.status).toBe(200);
    const token = ok.headers.get("set-auth-token");
    expect(token).toBeTruthy();
    expect(await verified(address)).toBe(true);
    expect((await call("/api/auth/get-session", { origin: APP, headers: bearer(token!) })).body?.user?.email).toBe(address);

    // Usato una volta: lo stesso codice non fa più niente.
    expect((await call("/api/auth/email-otp/verify-email", { origin: APP, body: { email: address, otp: code } })).status).toBe(400);
  });

  test("la registrazione dal sito riceve ancora il link di conferma", async () => {
    const address = newEmail("web");
    await signUp(address);
    expect(linkMails(address)).toHaveLength(1);
  });

  test("un indirizzo già confermato: nessun codice mandato, nessun codice accettato", async () => {
    const address = newEmail("confirmed");
    await signUp(address);
    await db.update(authUsersTable).set({ emailVerified: true }).where(eq(authUsersTable.email, address));
    const before = emailsTo(address).length;

    const send = await call("/api/auth/email-otp/send-verification-otp", { origin: APP, body: { email: address, type: "email-verification" } });
    expect(send.status).toBe(200);
    await settle();
    expect(emailsTo(address).length).toBe(before);

    for (const otp of ["000000", "123456"]) {
      const r = await call("/api/auth/email-otp/verify-email", { origin: APP, body: { email: address, otp } });
      expect(r.status).toBe(400);
      expect(r.headers.get("set-auth-token")).toBeNull();
    }
  });

  test("gli altri endpoint del plugin non sono serviti", async () => {
    for (const path of ["/api/auth/sign-in/email-otp", "/api/auth/forget-password/email-otp", "/api/auth/email-otp/reset-password", "/api/auth/email-otp/check-verification-otp", "/api/auth/email-otp/request-password-reset", "/api/auth/email-otp/change-email", "/api/auth/email-otp/request-email-change"]) {
      const r = await call(path, { origin: APP, body: { email: "x@example.invalid", otp: "000000", type: "sign-in" } });
      expect(r.status, path).toBe(404);
    }
  });
});

describe("la password dimenticata, dall'app", () => {
  test("il link torna nell'app, un token sbagliato torna con un errore, nessun altro bersaglio è fidato", async () => {
    expect((await call("/api/auth/request-password-reset", { origin: APP, body: { email, redirectTo: DEEP_LINK } })).status).toBe(200);
    await settle();

    const link = emailsTo(email).flatMap((m) => linksIn(m)).find((l) => l.includes("/api/auth/reset-password/"));
    expect(link).toBeTruthy();
    const res = await fetch(link!.replace(/^https?:\/\/[^/]+/, baseUrl), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect((res.headers.get("location") ?? "").startsWith(`${DEEP_LINK}?token=`)).toBe(true);

    const bad = await fetch(`${baseUrl}/api/auth/reset-password/not-a-token?callbackURL=${encodeURIComponent(DEEP_LINK)}`, { redirect: "manual" });
    expect(bad.status).toBe(302);
    expect(bad.headers.get("location")).toContain("error=INVALID_TOKEN");

    const ctx = await auth.$context;
    const trusted = (url: string) => ctx.isTrustedOrigin(url, { allowRelativePaths: true });
    expect(trusted(DEEP_LINK)).toBe(true);
    expect(trusted(`${DEEP_LINK}?token=abc`)).toBe(true);
    expect(trusted("prevai://evil")).toBe(false);
    expect(trusted("prevai://evil/forgot-password")).toBe(false);
    expect(trusted("myapp://forgot-password")).toBe(false);
    expect(trusted("https://evil.example/forgot-password")).toBe(false);
  });
});

describe("inviti e codici d'accesso", () => {
  test("gli inviti aperti per l'indirizzo si vedono e si accettano; quelli di altri no", async () => {
    const invitee = await signUp(newEmail("invitee"));
    const [row] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, invitee));
    await db.update(authUsersTable).set({ emailVerified: true }).where(eq(authUsersTable.id, invitee));
    const [member] = await db
      .insert(organizationMembersTable)
      .values({ ownerId: owner.userId, invitedEmail: row!.email, invitedByUserId: owner.userId, role: "foreman", status: "invited", inviteTokenExpiresAt: new Date(Date.now() + 86_400_000) })
      .returning();
    const signIn = await call("/api/auth/sign-in/email", { origin: APP, body: { email: row!.email, password: PASSWORD } });
    const token = signIn.headers.get("set-auth-token")!;

    const list = await call("/api/team/pending-invites", { origin: APP, headers: bearer(token) });
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([{ id: member!.id, companyName: "E2E App Owner Co", role: "foreman", logoUrl: null }]);

    // Un altro account non vede e non accetta l'invito di questo.
    const other = await call("/api/team/pending-invites/" + member!.id + "/accept", { origin: APP, headers: bearer(owner.token), method: "POST" });
    expect(other.status).toBe(404);

    const accept = await call(`/api/team/pending-invites/${member!.id}/accept`, { origin: APP, headers: bearer(token), method: "POST" });
    expect(accept.status).toBe(200);
    expect(accept.headers.get("x-active-org")).toBe(owner.userId);
    expect((await call("/api/team/pending-invites", { origin: APP, headers: bearer(token) })).body.items).toEqual([]);
  });

  test("l'anteprima di un codice d'accesso dice impresa e ruolo, senza usarlo", async () => {
    const created = await owner.api("/api/team/codes", { method: "POST", body: { role: "viewer", label: "Giuseppe" } });
    expect(created.status).toBe(201);
    const typed: string = created.body.code;

    const who = await signUp(newEmail("joiner"));
    await db.update(authUsersTable).set({ emailVerified: true }).where(eq(authUsersTable.id, who));
    const [u] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, who));
    const token = (await call("/api/auth/sign-in/email", { origin: APP, body: { email: u!.email, password: PASSWORD } })).headers.get("set-auth-token")!;

    const preview = await call(`/api/team/code/${encodeURIComponent(typed)}`, { origin: APP, headers: bearer(token) });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ companyName: "E2E App Owner Co", role: "viewer" });
    // L'anteprima non ha usato il codice: si può ancora usare.
    const redeem = await call("/api/team/code/redeem", { origin: APP, headers: bearer(token), body: { code: typed } });
    expect(redeem.status).toBe(200);
    expect(redeem.headers.get("x-active-org")).toBe(owner.userId);

    expect((await call("/api/team/code/ZZZZ-ZZZZ", { origin: APP, headers: bearer(token) })).status).toBe(404);
    expect((await call("/api/team/code/ABC", { origin: APP, headers: bearer(token) })).status).toBe(400);
    expect((await call(`/api/team/code/${encodeURIComponent(typed)}`, { origin: APP, headers: bearer(token) })).status).toBe(409);
  });
});
