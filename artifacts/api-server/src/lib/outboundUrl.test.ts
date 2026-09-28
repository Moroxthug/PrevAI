// SEC-3: customer webhooks and push endpoints never reach internal addresses.

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { checkWebhookUrl, isPrivateAddress, isPushServiceEndpoint, postWebhook } from "./outboundUrl";

const saved = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "production"; });
afterEach(() => { process.env.NODE_ENV = saved; });

describe("isPrivateAddress", () => {
  test.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "not-an-ip"])("%s is private", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  test.each(["8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700::1111", "::ffff:8.8.8.8"])("%s is public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("checkWebhookUrl (production)", () => {
  test.each([
    "http://hooks.example.com/x",
    "https://127.0.0.1/x",
    "https://[::1]/x",
    "https://169.254.169.254/latest/meta-data",
    "https://10.0.0.5:8443/",
    "https://localhost/x",
    "https://db.internal/x",
    "https://intranet/x",
    "https://user:pw@hooks.example.com/x",
    "not a url",
  ])("refuses %s", (u) => {
    expect(checkWebhookUrl(u).ok).toBe(false);
  });
  test("accepts a public https URL", () => {
    expect(checkWebhookUrl("https://hooks.zapier.com/hooks/catch/1/abc").ok).toBe(true);
  });
  test("a name that resolves to loopback is refused at connect time", async () => {
    await expect(postWebhook("https://localtest.me/x", "{}", {}, 3000)).rejects.toThrow(/privat|ENOTFOUND|EAI_AGAIN/);
  });
});

describe("isPushServiceEndpoint", () => {
  test.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/QGx",
  ])("accepts %s", (u) => {
    expect(isPushServiceEndpoint(u)).toBe(true);
  });
  test.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com.evil.com/x",
    "https://evilfcm.googleapis.com.attacker.net/x",
    "https://169.254.169.254/x",
    "https://fcm.googleapis.com:8080/x",
    "https://push.e2e-test.invalid/send/x",
  ])("refuses %s", (u) => {
    expect(isPushServiceEndpoint(u)).toBe(false);
  });
});
