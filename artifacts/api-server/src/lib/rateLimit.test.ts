import { describe, test, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { ipRateLimiter, userRateLimiter, widgetKeySoftLimiter } from "./rateLimit";
import { SharedRateLimitStore, bucketPart } from "./rateLimitStore";
import { tettoIaEurCents, statoTettoIa, TETTO_IA_MINIMO_EUR_CENTS, USD_TO_EUR_APPROX } from "@workspace/config";

// SEC-2 (riga 43): limiters shared across instances, per person, a widget key
// that can't be spent from outside, and the monthly AI cap. The Postgres side
// of the store is covered by src/e2e/limits.e2e.test.ts; here the store runs
// on its memory fallback (no database in the unit suite).

process.env.RATE_LIMIT_STORE = "memory";

describe("limiter names", () => {
  test("every limiter needs its own name: it is the prefix of its shared rows", () => {
    ipRateLimiter({ name: "test.dup", windowMs: 60_000, max: 1, message: "x" });
    expect(() => userRateLimiter({ name: "test.dup", windowMs: 60_000, max: 1, message: "x" })).toThrow(/already used/);
  });

  test("bucket keys never carry a long secret in clear", () => {
    expect(bucketPart("user_123")).toBe("user_123");
    expect(bucketPart("::ffff:10.0.0.1")).toBe("::ffff:10.0.0.1");
    const key = "pk_" + "a".repeat(80);
    expect(bucketPart(key)).toMatch(/^h[0-9a-f]{32}$/);
    expect(bucketPart(key)).not.toContain("aaaa");
    expect(bucketPart("chiave con spazi")).toMatch(/^h[0-9a-f]{32}$/);
  });

  test("the store falls back to a per-instance counter without the shared table", async () => {
    const store = new SharedRateLimitStore("test.fallback");
    store.init({ windowMs: 60_000 } as never);
    expect((await store.increment("k")).totalHits).toBe(1);
    expect((await store.increment("k")).totalHits).toBe(2);
    await store.decrement("k");
    expect((await store.get("k"))?.totalHits).toBe(1);
    await store.resetKey("k");
    expect(await store.get("k")).toBeUndefined();
    store.shutdown();
  });
});

describe("limiters over HTTP", () => {
  let server: Server;
  let base = "";
  beforeAll(async () => {
    const app = express();
    app.use((req, res, next) => {
      res.locals.userId = String(req.headers["x-org"] ?? "org_1");
      res.locals.actorUserId = String(req.headers["x-actor"] ?? "");
      next();
    });
    const perPerson = userRateLimiter({ name: "test.perPerson", windowMs: 60_000, max: 2, message: "stop" });
    app.get("/person", perPerson, (_req, res) => { res.json({ ok: true }); });
    const soft = widgetKeySoftLimiter({ name: "test.widgetSoft", windowMs: 60_000, max: 2, message: "stop" });
    app.post("/widget", soft, (_req, res) => { res.json({ degraded: res.locals.aiDegraded ?? null }); });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => { server.close(); });

  test("the per-user limit is per person: one member can't use up the team", async () => {
    const as = (actor: string) => fetch(`${base}/person`, { headers: { "x-org": "org_1", "x-actor": actor } }).then((r) => r.status);
    expect([await as("anna"), await as("anna"), await as("anna")]).toEqual([200, 200, 429]);
    // Same company, another person: still has the whole budget.
    expect([await as("marco"), await as("marco")]).toEqual([200, 200]);
  });

  test("a 429 says why in both fields the app reads", async () => {
    const r = await fetch(`${base}/person`, { headers: { "x-actor": "anna" } });
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ error: "stop", message: "stop", code: "RATE_LIMITED" });
  });

  test("the widget key limit never blocks: past it the request goes on without the AI", async () => {
    const send = () => fetch(`${base}/widget`, { method: "POST", headers: { "x-api-key": "pk_widget_test" } }).then(async (r) => [r.status, (await r.json()).degraded]);
    expect(await send()).toEqual([200, null]);
    expect(await send()).toEqual([200, null]);
    expect(await send()).toEqual([200, "key_hourly"]);
    // Another company's key is untouched.
    expect(await fetch(`${base}/widget`, { method: "POST", headers: { "x-api-key": "pk_other" } }).then(async (r) => (await r.json()).degraded)).toBeNull();
  });
});

describe("monthly AI cap (lib/config tetto-ia.ts)", () => {
  test("30 % of the plan's monthly price, never below the minimum", () => {
    expect(tettoIaEurCents("free")).toBe(TETTO_IA_MINIMO_EUR_CENTS);
    expect(tettoIaEurCents(null)).toBe(TETTO_IA_MINIMO_EUR_CENTS);
    expect(tettoIaEurCents("monthly_starter")).toBe(570);
    expect(tettoIaEurCents("monthly_pro")).toBe(1470);
    expect(tettoIaEurCents("monthly_elite")).toBe(2370);
  });

  test("a staff override wins: a number is the cap, null means no cap", () => {
    expect(tettoIaEurCents("monthly_starter", 5000)).toBe(5000);
    expect(tettoIaEurCents("monthly_elite", null)).toBeNull();
    expect(tettoIaEurCents("monthly_pro", undefined)).toBe(1470);
  });

  test("spend is in dollar cents, the cap in euro cents", () => {
    const cap = 1000;
    const atCap = cap / USD_TO_EUR_APPROX;
    expect(statoTettoIa(atCap - 5, cap)).toMatchObject({ superato: false, avviso: true });
    expect(statoTettoIa(atCap + 1, cap)).toMatchObject({ superato: true, avviso: true });
    expect(statoTettoIa(0.5 * atCap, cap)).toMatchObject({ superato: false, avviso: false });
    expect(statoTettoIa(1e9, null)).toMatchObject({ superato: false, avviso: false, tettoEurCents: null });
  });
});
