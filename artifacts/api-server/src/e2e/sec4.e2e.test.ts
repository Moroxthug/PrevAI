// SEC-4 (docs/PIANO-AZIONE.md riga 45) — the parts CHK-1 had not looked at:
//  • the customer's quote link: signed, revocable, with an expiry (links sent
//    before keep working until LEGACY_VALID_UNTIL);
//  • ids of another company in a request body (client, quote);
//  • API keys follow their creator (still on the team, same role, 2FA).

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, quotesTable, quotePublicLinksTable, businessProfilesTable, clientsTable, organizationMembersTable, authUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, seedQuote, cleanupAll, api, daysAgo, daysFromNow } from "./harness.js";
import { quoteLinkRef, LEGACY_CREATED_BEFORE } from "../quotes/publicLink.js";
import { createApiKey } from "../lib/apiKeys.js";

beforeAll(startServer);
afterAll(async () => {
  await cleanupAll();
  await stopServer();
});

const before = (days: number) => new Date(LEGACY_CREATED_BEFORE.getTime() - days * 86_400_000);
// "Created after the change": later than any managed link made so far (legacyCutoff).
const afterChange = () => new Date(Math.max(Date.now(), LEGACY_CREATED_BEFORE.getTime()) + 60_000);

describe("customer link to a quote", () => {
  test("share → signed link opens and accepts; the bare UUID of a new quote does not", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ createdAt: afterChange() }).where(eq(quotesTable.id, quote.id));

    const state = await org.api(`/api/quotes/${quote.id}/public-link`);
    expect(state.body).toMatchObject({ url: null, managed: true, revoked: false });

    const shared = await org.api(`/api/quotes/${quote.id}/public-link`, { method: "POST", body: {} });
    expect(shared.status, JSON.stringify(shared.body)).toBe(200);
    expect(shared.body.url).toMatch(new RegExp(`/p/${quote.id}\\.[\\w-]{22}$`));
    const ref = (shared.body.url as string).split("/p/")[1]!;
    expect((await api(`/api/public/quotes/${quote.id}`)).status).toBe(404);
    expect(new Date(shared.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 179 * 86_400_000);

    expect((await api(`/api/public/quotes/${ref}`)).status).toBe(200);
    expect((await api(`/api/public/quotes/${ref}/incentives`)).status).toBe(200);
    // A signature that doesn't match is just "not found".
    expect((await api(`/api/public/quotes/${quote.id}.${"A".repeat(22)}`)).status).toBe(404);
    expect((await api(`/api/public/quotes/${quote.id}.${"A".repeat(22)}/accept`, { body: { nomeConferma: "Mario" } })).status).toBe(404);

    const accepted = await api(`/api/public/quotes/${ref}/accept`, { body: { nomeConferma: "Mario Rossi" } });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    // Sharing again keeps the same link.
    expect((await org.api(`/api/quotes/${quote.id}/public-link`, { method: "POST", body: {} })).body.url).toBe(shared.body.url);
  });

  test("revoke kills every link sent (and the reminders); sharing again makes a new one", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ createdAt: afterChange(), nextFollowUpAt: daysFromNow(10) }).where(eq(quotesTable.id, quote.id));
    const first = (await org.api(`/api/quotes/${quote.id}/public-link`, { method: "POST", body: {} })).body.url as string;
    const firstRef = first.split("/p/")[1]!;

    const revoked = await org.api(`/api/quotes/${quote.id}/public-link`, { method: "DELETE" });
    expect(revoked.status, JSON.stringify(revoked.body)).toBe(200);
    expect(revoked.body).toMatchObject({ url: null, revoked: true });
    expect((await api(`/api/public/quotes/${firstRef}`)).status).toBe(404);
    const [row] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
    expect(row!.nextFollowUpAt).toBeNull();

    const second = (await org.api(`/api/quotes/${quote.id}/public-link`, { method: "POST", body: {} })).body.url as string;
    expect(second).not.toBe(first);
    expect((await api(`/api/public/quotes/${second.split("/p/")[1]}`)).status).toBe(200);
    expect((await api(`/api/public/quotes/${firstRef}`)).status).toBe(404);
  });

  test("an expired link answers 410; sharing again reopens it", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "unlocked" });
    const url = (await org.api(`/api/quotes/${quote.id}/public-link`, { method: "POST", body: {} })).body.url as string;
    await db.update(quotePublicLinksTable).set({ expiresAt: daysAgo(1) }).where(eq(quotePublicLinksTable.quoteId, quote.id));
    const expired = await api(`/api/public/quotes/${url.split("/p/")[1]}`);
    expect(expired.status).toBe(410);
    expect(expired.body.code).toBe("LINK_EXPIRED");
    await org.api(`/api/quotes/${quote.id}/public-link`, { method: "POST", body: {} });
    expect((await api(`/api/public/quotes/${url.split("/p/")[1]}`)).status).toBe(200);
  });

  test("links sent before SEC-4 (bare UUID) keep working until revoked", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ createdAt: before(10) }).where(eq(quotesTable.id, quote.id));
    expect((await api(`/api/public/quotes/${quote.id}`)).status).toBe(200);
    // Sharing it with the new link doesn't break the one already in the inbox…
    await org.api(`/api/quotes/${quote.id}/public-link`, { method: "POST", body: {} });
    expect((await api(`/api/public/quotes/${quote.id}`)).status).toBe(200);
    // …revoking does.
    await org.api(`/api/quotes/${quote.id}/public-link`, { method: "DELETE" });
    expect((await api(`/api/public/quotes/${quote.id}`)).status).toBe(404);
  });

  test("a draft can't be shared; another company's quote can't be touched", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const other = await createOrg({ plan: "monthly_pro" });
    const draft = await seedQuote(org.userId, { status: "draft" });
    expect((await org.api(`/api/quotes/${draft.id}/public-link`, { method: "POST", body: {} })).status).toBe(409);
    const theirs = await seedQuote(other.userId, { status: "unlocked" });
    expect((await org.api(`/api/quotes/${theirs.id}/public-link`, { method: "POST", body: {} })).status).toBe(404);
    expect((await org.api(`/api/quotes/${theirs.id}/public-link`, { method: "DELETE" })).status).toBe(404);
    expect((await org.api(`/api/quotes/${theirs.id}/public-link`)).status).toBe(404);
  });

  test("the quote email carries the signed link", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "unlocked" });
    const sent = await org.api(`/api/quotes/${quote.id}/send-pdf-email`, { body: { toEmail: "cliente-sec4@example.invalid", clientName: "Cliente" } });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    const [link] = await db.select().from(quotePublicLinksTable).where(eq(quotePublicLinksTable.quoteId, quote.id));
    expect(link).toBeTruthy();
    expect(quoteLinkRef(quote.id, link!.version)).toMatch(new RegExp(`^${quote.id}\\.`));
  });
});

describe("another company's ids in a request body", () => {
  test("jobs, invoices and the old CRM form refuse a foreign client or quote", async () => {
    const a = await createOrg();
    const b = await createOrg();
    const [theirClient] = await db.insert(clientsTable).values({ userId: b.userId, name: "Cliente di B", email: "b-client@example.invalid", dedupKey: `sec4-${b.userId}` }).returning();
    const theirQuote = await seedQuote(b.userId, { status: "unlocked" });

    const job = await a.api("/api/jobs", { body: { name: "Furto", clientId: theirClient!.id } });
    expect(job.status, JSON.stringify(job.body)).toBe(404);
    const inv = await a.api("/api/invoices", { body: { clientId: theirClient!.id, lines: [{ description: "x", quantity: 1, unitCents: 100 }] } });
    expect(inv.status, JSON.stringify(inv.body)).toBe(404);
    expect(JSON.stringify(inv.body)).not.toContain("Cliente di B");
    const crm = await a.api("/api/crm/projects", { body: { name: "Furto", quoteId: theirQuote.id } });
    expect(crm.status, JSON.stringify(crm.body)).toBe(404);

    // Same through the public API.
    const { rawKey } = await createApiKey(a.userId, a.userId, "owner", "sec4");
    const v1job = await api("/api/v1/public/jobs", { body: { name: "Furto", clientId: theirClient!.id }, token: rawKey });
    expect(v1job.status, JSON.stringify(v1job.body)).toBe(404);
    const v1inv = await api("/api/v1/public/invoices", { body: { clientId: theirClient!.id, lines: [{ description: "x", quantity: 1, unitCents: 100 }] }, token: rawKey });
    expect(v1inv.status, JSON.stringify(v1inv.body)).toBe(404);
  });
});

describe("API keys follow their creator", () => {
  test("member removed or role changed → key suspended; company 2FA → creator needs it", async () => {
    const org = await createOrg();
    const member = await createUser();
    await db.insert(organizationMembersTable).values({ ownerId: org.userId, userId: member.userId, role: "admin", status: "active", invitedEmail: member.email, invitedByUserId: org.userId, joinedAt: new Date() });
    const { rawKey } = await createApiKey(org.userId, member.userId, "admin", "member key");
    expect((await api("/api/v1/public/quotes", { token: rawKey })).status).toBe(200);

    await db.update(organizationMembersTable).set({ role: "viewer" }).where(eq(organizationMembersTable.userId, member.userId));
    const changed = await api("/api/v1/public/quotes", { token: rawKey });
    expect(changed.status).toBe(403);
    expect(changed.body.error).toBe("API_KEY_ROLE_CHANGED");

    await db.update(organizationMembersTable).set({ role: "admin", status: "suspended" }).where(eq(organizationMembersTable.userId, member.userId));
    const gone = await api("/api/v1/public/quotes", { token: rawKey });
    expect(gone.status).toBe(403);
    expect(gone.body.error).toBe("API_KEY_CREATOR_GONE");

    const { rawKey: ownerKey } = await createApiKey(org.userId, org.userId, "owner", "owner key");
    expect((await api("/api/v1/public/quotes", { token: ownerKey })).status).toBe(200);
    await db.update(businessProfilesTable).set({ twoFactorRequired: true }).where(eq(businessProfilesTable.userId, org.userId));
    const no2fa = await api("/api/v1/public/quotes", { token: ownerKey });
    expect(no2fa.status).toBe(403);
    expect(no2fa.body.error).toBe("two_factor_required");
    await db.update(authUsersTable).set({ twoFactorEnabled: true }).where(eq(authUsersTable.id, org.userId));
    expect((await api("/api/v1/public/quotes", { token: ownerKey })).status).toBe(200);
  });
});
