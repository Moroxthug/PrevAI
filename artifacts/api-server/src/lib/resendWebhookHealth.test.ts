import { describe, it, expect, vi, beforeEach } from "vitest";

let lastEventAt: Date | null = new Date();
vi.mock("@workspace/db", () => ({
  emailEventsTable: { createdAt: "created_at" },
  db: {
    select: () => ({ from: () => ({ orderBy: () => ({ limit: async () => (lastEventAt ? [{ at: lastEventAt }] : []) }) }) }),
  },
}));

const { checkResendWebhook } = await import("./resendWebhookHealth.js");

function fakeFetch(webhooks: Array<{ id: string; endpoint: string; status: string; events?: string[] }>, ok = true) {
  return (async () => ({ ok, status: ok ? 200 : 401, json: async () => ({ data: webhooks }) })) as unknown as typeof fetch;
}
const ALL = ["email.bounced", "email.complained", "email.delivered"];

describe("Resend webhook watchdog", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    lastEventAt = new Date();
  });

  it("is quiet when the webhook is enabled and events are flowing", async () => {
    expect(await checkResendWebhook(fakeFetch([{ id: "w1", endpoint: "https://prevai.it/api/webhooks/resend", status: "enabled", events: ALL }]))).toEqual([]);
  });

  it("flags a disabled webhook (what happened from July to November 2026)", async () => {
    const p = await checkResendWebhook(fakeFetch([{ id: "w1", endpoint: "https://prevai.it/api/webhooks/resend", status: "disabled", events: ALL }]));
    expect(p.join(" ")).toMatch(/"disabled"/);
  });

  it("flags a missing webhook, a missing secret and a week of silence", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    lastEventAt = new Date(Date.now() - 10 * 86_400_000);
    const p = (await checkResendWebhook(fakeFetch([{ id: "w2", endpoint: "https://www.prevai.it/api/webhooks/resend", status: "enabled" }]))).join(" ");
    expect(p).toMatch(/No Resend webhook points at/);
    expect(p).toMatch(/RESEND_WEBHOOK_SECRET/);
    expect(p).toMatch(/for 10 days/);
  });

  it("does not alert just because the API key can't list webhooks", async () => {
    expect(await checkResendWebhook(fakeFetch([], false))).toEqual([]);
  });
});
