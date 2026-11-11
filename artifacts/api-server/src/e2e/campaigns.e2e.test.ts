// EMAIL-2 against a real database (staging): audience filters, the frozen
// recipient list, batched sending, the unsubscribe link, no double sends.
// Resend is mocked — nothing leaves the machine.

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db, authUsersTable, emailEventsTable, settingsTable, emailCampaignsTable, emailCampaignRecipientsTable, marketingPreferencesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

type Mail = { to: string[]; subject: string; html: string; headers?: Record<string, string> };
const batches: Mail[][] = [];
const singles: Mail[] = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async (m: Mail) => (singles.push(m), { data: { id: "single" }, error: null }) };
    batch = { send: async (ms: Mail[]) => (batches.push(ms), { data: { data: ms.map((_, i) => ({ id: `re_${batches.length}_${i}` })) }, error: null }) };
  },
}));

const tag = randomUUID().slice(0, 8);
const ids = { ok: `e2e-camp-ok-${tag}`, unsub: `e2e-camp-unsub-${tag}`, bounced: `e2e-camp-bounce-${tag}`, unverified: `e2e-camp-unver-${tag}` };
const mail = (k: string) => `${k}-${tag}@e2e.local`;
let previousIdentity: string | undefined;
let campaignId = "";

beforeAll(async () => {
  process.env.RESEND_API_KEY ??= "re_test";
  const now = new Date();
  await db.insert(authUsersTable).values([
    { id: ids.ok, name: "anna verdi", email: mail("ok"), emailVerified: true, createdAt: now, updatedAt: now },
    { id: ids.unsub, name: "Bruno", email: mail("unsub"), emailVerified: true, createdAt: now, updatedAt: now },
    { id: ids.bounced, name: "Carla", email: mail("bounced"), emailVerified: true, createdAt: now, updatedAt: now },
    { id: ids.unverified, name: "Dario", email: mail("unverified"), emailVerified: false, createdAt: now, updatedAt: now },
  ]);
  await db.insert(marketingPreferencesTable).values({ userId: ids.unsub, unsubscribedAt: now, unsubscribeSource: "settings" });
  await db.insert(emailEventsTable).values({ type: "email.bounced", to: [mail("bounced").toUpperCase()], subject: "x" });
  const [s] = await db.select().from(settingsTable).where(eq(settingsTable.key, "campaign_sender_identity"));
  previousIdentity = s?.value;
});

afterAll(async () => {
  if (campaignId) await db.delete(emailCampaignsTable).where(eq(emailCampaignsTable.id, campaignId));
  await db.delete(emailEventsTable).where(eq(emailEventsTable.subject, "x"));
  await db.delete(authUsersTable).where(inArray(authUsersTable.id, Object.values(ids)));
  if (previousIdentity === undefined) await db.delete(settingsTable).where(eq(settingsTable.key, "campaign_sender_identity"));
  else await db.update(settingsTable).set({ value: previousIdentity }).where(eq(settingsTable.key, "campaign_sender_identity"));
});

describe("EMAIL-2 campaigns", () => {
  it("audience leaves out unsubscribed, bounced and unverified people", async () => {
    const { audienceMembers } = await import("../campaigns/audiences.js");
    const emails = (await audienceMembers("nuovi_30")).map((m) => m.email);
    expect(emails).toContain(mail("ok"));
    expect(emails).not.toContain(mail("unsub"));
    expect(emails).not.toContain(mail("bounced"));
    expect(emails).not.toContain(mail("unverified"));
  });

  it("refuses to start without a test and a sender identity, then sends once in batches", async () => {
    const svc = await import("../campaigns/service.js");
    const { CAMPAIGN_EXAMPLES } = await import("../lib/emailCampaign.js");
    const c = await svc.createCampaign({ name: `e2e ${tag}`, audience: "nuovi_30", content: svc.campaignContentSchema.parse(CAMPAIGN_EXAMPLES.attivazione) }, null);
    campaignId = c.id;

    await expect(svc.startCampaign(c.id)).rejects.toMatchObject({ code: "NO_TEST" });
    await svc.sendTest(c.id, [mail("ok")], ids.ok, "Anna Verdi");
    expect(singles.at(-1)!.subject).toMatch(/^\[PROVA\]/);

    await db.delete(settingsTable).where(eq(settingsTable.key, "campaign_sender_identity"));
    await expect(svc.startCampaign(c.id)).rejects.toMatchObject({ code: "NO_IDENTITY" });
    await db.insert(settingsTable).values({ key: "campaign_sender_identity", value: "PrevAI prova · Via Roma 1, Milano · P.IVA 00000000000" });

    await svc.startCampaign(c.id);
    await expect(svc.startCampaign(c.id)).rejects.toMatchObject({ code: "NOT_DRAFT" });
    const progress = await svc.processCampaign(c.id, 20_000);
    expect(progress.remaining).toBe(0);

    const sentTo = batches.flat().map((m) => m.to[0]);
    expect(sentTo.filter((e) => e === mail("ok"))).toHaveLength(1);
    const anna = batches.flat().find((m) => m.to[0] === mail("ok"))!;
    expect(anna.html).toContain("Ciao Anna,");
    expect(anna.html).toContain("P.IVA 00000000000");
    expect(anna.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    const done = await svc.getCampaign(c.id);
    expect(done.status).toBe("inviata");
    expect(done.sentCount).toBe(done.recipientsTotal);

    // Running again sends nothing.
    const before = batches.length;
    await svc.processCampaign(c.id, 5_000);
    expect(batches.length).toBe(before);

    // The link in the email unsubscribes Anna.
    const token = /unsubscribe\?token=([a-f0-9]+)/.exec(anna.html)![1]!;
    expect(await svc.setSubscribedByToken(token, false, "link")).toEqual({ userId: ids.ok });
    expect(await svc.getSubscribed(ids.ok)).toBe(false);
    const [row] = await db.select().from(emailCampaignRecipientsTable).where(eq(emailCampaignRecipientsTable.userId, ids.ok));
    expect(row!.status).toBe("inviata");
  });

  it("a spam complaint unsubscribes the account, without touching an earlier choice", async () => {
    const svc = await import("../campaigns/service.js");
    expect(await svc.unsubscribeEmails([mail("bounced").toUpperCase(), "nobody@e2e.local"], "complaint")).toBe(1);
    expect(await svc.getSubscribed(ids.bounced)).toBe(false);
    await svc.unsubscribeEmails([mail("unsub")], "complaint");
    const [p] = await db.select().from(marketingPreferencesTable).where(eq(marketingPreferencesTable.userId, ids.unsub));
    expect(p!.unsubscribeSource).toBe("settings");
  });
});
