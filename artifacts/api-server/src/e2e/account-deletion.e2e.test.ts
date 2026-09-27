// APP-1c — cancellazione dell'account in autonomia: richiesta con password,
// annullamento, promemoria, cancellazione a 30 giorni con i documenti che la
// legge fa conservare, e fine della conservazione.

import { randomUUID } from "node:crypto";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { db, accountDeletionsTable, authAccountsTable, organizationMembersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, cleanupAll, seedQuote, api } from "./harness.js";
import { runAccountDeletionMaintenance } from "../account/deletion.js";

const PASSWORD = "Segreta-e2e-123";
const DAY = 86_400_000;

async function withPassword(userId: string) {
  await db.insert(authAccountsTable).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: await hashPassword(PASSWORD) });
}

const n = async (table: string, userId: string) =>
  (await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(table)} where user_id = ${userId}`)).rows[0]!.n;

async function seedDocuments(userId: string) {
  const contract = (status: string, num: string) => sql`
    insert into contracts (user_id, contract_number, province, template_key, document, variables, status)
    values (${userId}, ${num}, 'MI', 'appalto', '{}'::jsonb, '{}'::jsonb, ${status})`;
  await db.execute(contract("signed", "C-2026-001"));
  await db.execute(contract("draft", "C-2026-002"));
  const invoice = (status: string, num: string) => sql`
    insert into invoices (user_id, number, province, due_date, contractor, customer, status)
    values (${userId}, ${num}, 'MI', now(), '{}'::jsonb, '{}'::jsonb, ${status})`;
  await db.execute(invoice("sent", "F-2026-001"));
  await db.execute(invoice("draft", "F-2026-002"));
}

describe("account deletion (APP-1c)", () => {
  const subjects: string[] = [];
  beforeAll(startServer);
  afterAll(async () => {
    for (const id of subjects) {
      for (const t of ["contracts", "invoices"]) await db.execute(sql`delete from ${sql.identifier(t)} where user_id = ${id}`);
      await db.delete(accountDeletionsTable).where(eq(accountDeletionsTable.subjectUserId, id));
    }
    await cleanupAll();
    await stopServer();
  });

  test("request with password, cancel, request again; the team sees the date", async () => {
    const owner = await createOrg({ companyName: "Cancellanda Srl" });
    subjects.push(owner.userId);
    await withPassword(owner.userId);
    const member = await createUser({ name: "Membro Squadra" });
    await db.insert(organizationMembersTable).values({ ownerId: owner.userId, userId: member.userId, role: "office", status: "active", invitedEmail: member.email, invitedByUserId: owner.userId, joinedAt: new Date() });

    expect((await api("/api/account/deletion")).status).toBe(401);
    const s0 = await owner.api("/api/account/deletion");
    expect(s0.status).toBe(200);
    expect(s0.body).toMatchObject({ available: true, graceDays: 30, own: null, org: null });

    // No "ELIMINA" → 400; wrong password → 403 and nothing written.
    expect((await owner.api("/api/account/deletion", { body: { password: PASSWORD, confirm: "elimina" } })).status).toBe(400);
    expect((await owner.api("/api/account/deletion", { body: { password: "sbagliata", confirm: "ELIMINA" } })).status).toBe(403);
    expect(await db.select().from(accountDeletionsTable).where(eq(accountDeletionsTable.subjectUserId, owner.userId))).toHaveLength(0);

    const r1 = await owner.api("/api/account/deletion", { body: { password: PASSWORD, confirm: "ELIMINA", reason: "chiudo l'attività" } });
    expect(r1.status).toBe(201);
    expect(r1.body.own.ownsOrg).toBe(true);
    const days = (new Date(r1.body.own.scheduledFor).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect((await owner.api("/api/account/deletion", { body: { password: PASSWORD, confirm: "ELIMINA" } })).status).toBe(409);

    // The member keeps using the org and is told when it disappears.
    const m = await member.api("/api/account/deletion");
    expect(m.body.own).toBeNull();
    expect(m.body.org.scheduledFor).toBe(r1.body.own.scheduledFor);

    expect((await owner.api("/api/account/deletion", { method: "DELETE" })).status).toBe(200);
    expect((await owner.api("/api/account/deletion")).body.own).toBeNull();
    expect((await owner.api("/api/account/deletion", { method: "DELETE" })).status).toBe(404);
    const [annullata] = await db.select().from(accountDeletionsTable).where(eq(accountDeletionsTable.subjectUserId, owner.userId));
    expect(annullata!.stato).toBe("annullata");

    expect((await owner.api("/api/account/deletion", { body: { password: PASSWORD, confirm: "ELIMINA" } })).status).toBe(201);
  });

  test("reminder at 7 days, deletion at 30 keeps signed contracts and issued invoices, then retention ends", async () => {
    const owner = await createOrg({ companyName: "Da Cancellare Srl" });
    subjects.push(owner.userId);
    await withPassword(owner.userId);
    const member = await createUser({ name: "Resta Qui" });
    await db.insert(organizationMembersTable).values({ ownerId: owner.userId, userId: member.userId, role: "viewer", status: "active", invitedEmail: member.email, invitedByUserId: owner.userId, joinedAt: new Date() });
    await seedQuote(owner.userId);
    await seedDocuments(owner.userId);
    await db.execute(sql`insert into app_events (user_id, actor_user_id, kind, surface) values (${owner.userId}, ${owner.userId}, 'app_open', 'android')`);

    expect((await owner.api("/api/account/deletion", { body: { password: PASSWORD, confirm: "ELIMINA" } })).status).toBe(201);
    const byOwner = eq(accountDeletionsTable.subjectUserId, owner.userId);

    // 6 days before: reminder only, nothing deleted.
    await db.update(accountDeletionsTable).set({ scheduledFor: new Date(Date.now() + 6 * DAY) }).where(byOwner);
    const e1 = await runAccountDeletionMaintenance();
    expect(e1.promemoria).toBeGreaterThanOrEqual(1);
    expect(await n("quotes", owner.userId)).toBe(1);
    expect((await db.select().from(accountDeletionsTable).where(byOwner))[0]!.reminderSentAt).not.toBeNull();

    // Due: everything goes except the legal documents.
    await db.update(accountDeletionsTable).set({ scheduledFor: new Date(Date.now() - 1000) }).where(byOwner);
    const e2 = await runAccountDeletionMaintenance();
    expect(e2.cancellati).toBeGreaterThanOrEqual(1);
    expect(e2.errori).toBe(0);

    expect((await db.execute(sql`select 1 from auth_user where id = ${owner.userId}`)).rows).toHaveLength(0);
    for (const t of ["business_profiles", "quotes", "app_events", "auth_session", "auth_account", "audit_log"]) expect(await n(t, owner.userId), t).toBe(0);
    expect(await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.ownerId, owner.userId))).toHaveLength(0);
    // The member's own login survives; only the membership went.
    expect((await db.execute(sql`select 1 from auth_user where id = ${member.userId}`)).rows).toHaveLength(1);

    const kept = await db.execute<{ status: string }>(sql`select status from contracts where user_id = ${owner.userId}`);
    expect(kept.rows.map((r) => r.status)).toEqual(["signed"]);
    const keptInv = await db.execute<{ status: string }>(sql`select status from invoices where user_id = ${owner.userId}`);
    expect(keptInv.rows.map((r) => r.status)).toEqual(["sent"]);

    const [done] = await db.select().from(accountDeletionsTable).where(byOwner);
    expect(done!.stato).toBe("completata");
    expect(done!.email).toBeNull();
    expect(done!.emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(done!.summary!.retained).toEqual({ contracts: 1, invoices: 1 });
    expect(done!.summary!.deleted.quotes).toBe(1);
    expect(done!.retainUntil!.getFullYear()).toBe(new Date().getFullYear() + 10);

    // Ten years later.
    await db.update(accountDeletionsTable).set({ retainUntil: new Date(Date.now() - 1000) }).where(byOwner);
    const e3 = await runAccountDeletionMaintenance();
    expect(e3.conservazioneScaduta).toBeGreaterThanOrEqual(1);
    expect(await n("contracts", owner.userId)).toBe(0);
    expect(await n("invoices", owner.userId)).toBe(0);
    expect((await db.select().from(accountDeletionsTable).where(byOwner))[0]!.retentionClearedAt).not.toBeNull();
  });
});
