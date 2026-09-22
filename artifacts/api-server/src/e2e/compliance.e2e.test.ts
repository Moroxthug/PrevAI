// A-0 — Compliance e fondamenta (docs/AMMINISTRAZIONE-PLAN.md §6.5), the
// runtime half: the org-wide "2FA required" policy really locks out a user
// who has not enrolled (403 `two_factor_required` on everything but what the
// dashboard gate needs), the owner cannot switch it on before enrolling
// themselves, only the owner can switch it, and `business_profiles.iban` is
// stored encrypted (`enc1:` prefix) while reads stay transparent — including
// legacy plaintext rows written before A-0.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db, authUsersTable, businessProfilesTable, organizationMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";
import { decryptField, isEncryptedField } from "../lib/fieldCrypto.js";

let owner: TestUser;
let member: TestUser;

async function setTwoFactor(userId: string, enabled: boolean): Promise<void> {
  await db.update(authUsersTable).set({ twoFactorEnabled: enabled }).where(eq(authUsersTable.id, userId));
}

beforeAll(async () => {
  await startServer();
  owner = await createOrg({ province: "MI", companyName: "E2E Compliance Srl" });
  member = await createUser({ name: "E2E Office Member" });
  await db.insert(organizationMembersTable).values({
    ownerId: owner.userId,
    userId: member.userId,
    invitedEmail: member.email,
    invitedByUserId: owner.userId,
    role: "office",
    status: "active",
    joinedAt: new Date(),
  } as typeof organizationMembersTable.$inferInsert);
});

afterAll(async () => {
  await cleanupAll();
  await stopServer();
});

describe("A-0: org 2FA policy", () => {
  test("defaults off; the owner cannot require 2FA before enrolling themselves", async () => {
    const before = await owner.api("/api/security/policy");
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({ twoFactorRequired: false, twoFactorEnabled: false, twoFactorLocked: false });

    const refused = await owner.api("/api/security/policy", { method: "PATCH", body: { twoFactorRequired: true } });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe("two_factor_not_enabled");

    const bad = await owner.api("/api/security/policy", { method: "PATCH", body: { twoFactorRequired: "yes" } });
    expect(bad.status).toBe(400);
  });

  test("a non-owner member cannot change the policy", async () => {
    const res = await member.api("/api/security/policy", { method: "PATCH", body: { twoFactorRequired: true } });
    expect(res.status).toBe(403);
  });

  test("once required, a member without 2FA is locked out of everything but the gate's endpoints", async () => {
    await setTwoFactor(owner.userId, true);
    const on = await owner.api("/api/security/policy", { method: "PATCH", body: { twoFactorRequired: true } });
    expect(on.status).toBe(200);
    expect(on.body).toMatchObject({ twoFactorRequired: true, twoFactorEnabled: true });
    const [row] = await db.select({ v: businessProfilesTable.twoFactorRequired }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, owner.userId));
    expect(row?.v).toBe(true);

    // The owner (enrolled) keeps working.
    expect((await owner.api("/api/quotes")).status).toBe(200);

    // The member (not enrolled) is blocked on reads and writes alike…
    const blockedList = await member.api("/api/quotes");
    expect(blockedList.status).toBe(403);
    expect(blockedList.body.error).toBe("two_factor_required");
    const blockedWrite = await member.api("/api/quotes", { method: "POST", body: { descrizione: "Blocked" } });
    expect(blockedWrite.status).toBe(403);
    expect(blockedWrite.body.error).toBe("two_factor_required");

    // …except what the dashboard gate needs to explain itself and let them enrol or leave.
    const policy = await member.api("/api/security/policy");
    expect(policy.status).toBe(200);
    expect(policy.body).toMatchObject({ twoFactorRequired: true, twoFactorEnabled: false });
    expect((await member.api("/api/business-profile")).status).toBe(200);
    expect((await member.api("/api/team/orgs")).status).toBe(200);

    // Enrolling lifts the block on the next request.
    await setTwoFactor(member.userId, true);
    expect((await member.api("/api/quotes")).status).toBe(200);
  });

  test("the owner can switch the policy back off; both switches are in the audit log", async () => {
    const off = await owner.api("/api/security/policy", { method: "PATCH", body: { twoFactorRequired: false } });
    expect(off.status).toBe(200);
    expect(off.body.twoFactorRequired).toBe(false);
    await setTwoFactor(member.userId, false);
    expect((await member.api("/api/quotes")).status).toBe(200);

    const log = await owner.api("/api/security/audit-log");
    expect(log.status).toBe(200);
    const actions = (log.body.events as { action: string }[]).map((e) => e.action);
    expect(actions).toContain("two_factor.policy_enabled");
    expect(actions).toContain("two_factor.policy_disabled");
  });
});

describe("A-0: fiscal fields encrypted at rest", () => {
  const iban = "IT60X0542811101000000123456";

  test("IBAN is normalised, stored as enc1:… and read back in clear", async () => {
    const put = await owner.api("/api/business-profile", { method: "PUT", body: { companyName: "E2E Compliance Srl", iban: "it60 x054 2811 1010 0000 0123 456" } });
    expect(put.status).toBe(200);
    expect(put.body.iban).toBe(iban);

    const [row] = await db.select({ iban: businessProfilesTable.iban }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, owner.userId));
    expect(row?.iban).toBeTruthy();
    expect(isEncryptedField(row!.iban)).toBe(true);
    expect(row!.iban).not.toContain(iban);
    expect(decryptField(row!.iban)).toBe(iban);

    const get = await owner.api("/api/business-profile");
    expect(get.status).toBe(200);
    expect(get.body.iban).toBe(iban);
  });

  test("a legacy plaintext row (written before A-0) still reads; clearing stores NULL", async () => {
    const legacy = `IT${randomUUID().replace(/-/g, "").slice(0, 25).toUpperCase()}`;
    await db.update(businessProfilesTable).set({ iban: legacy }).where(eq(businessProfilesTable.userId, owner.userId));
    const get = await owner.api("/api/business-profile");
    expect(get.body.iban).toBe(legacy);

    const clear = await owner.api("/api/business-profile", { method: "PUT", body: { companyName: "E2E Compliance Srl", iban: null } });
    expect(clear.status).toBe(200);
    expect(clear.body.iban).toBeNull();
    const [row] = await db.select({ iban: businessProfilesTable.iban }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, owner.userId));
    expect(row?.iban).toBeNull();
  });
});
