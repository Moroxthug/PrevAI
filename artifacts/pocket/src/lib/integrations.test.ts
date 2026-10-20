import assert from "node:assert/strict";
import { test } from "node:test";
import { APPS, counts, requiredPlan, stateOf, tileOrder, unlocked, unresolvedFailures, visible, type AppId, type State } from "./integrations.ts";

test("a status becomes a state", () => {
  assert.equal(stateOf(null), "none");
  assert.equal(stateOf({ connected: false }), "none");
  assert.equal(stateOf({ connected: false, available: false }), "soon");
  assert.equal(stateOf({ connected: true }), "connected");
  assert.equal(stateOf({ connected: true, isEnabled: false }), "paused");
  assert.equal(stateOf({ connected: true }, true), "attention");
});

test("a failure counts until a later row for the same thing succeeds", () => {
  const rows = [
    { status: "success", entityType: "invoice", entityId: "a" },
    { status: "failed", entityType: "invoice", entityId: "a" },
    { status: "failed", entityType: "invoice", entityId: "b" },
    { status: "failed", entityType: "payment_pull", entityId: "c" },
  ];
  assert.deepEqual(unresolvedFailures(rows).map((r) => r.entityId), ["b"]);
});

test("a plan unlocks an app by feature; the Fisco add-on brings SdI", () => {
  const sdi = APPS.find((a) => a.id === "sdi")!;
  const wa = APPS.find((a) => a.id === "wa")!;
  assert.equal(unlocked(sdi, "monthly_elite", ["sdi_invoicing"]), true);
  assert.equal(unlocked(sdi, "monthly_elite", ["quotes"]), false);
  assert.equal(unlocked(wa, "monthly_starter", []), true);
  assert.equal(unlocked(APPS.find((a) => a.id === "drive")!, "free", []), true);
  assert.equal(requiredPlan(sdi), "fisco");
  assert.equal(requiredPlan(APPS.find((a) => a.id === "gcal")!), "monthly_elite");
});

const states = (o: Partial<Record<AppId, State>>): Record<AppId, State> => Object.fromEntries(APPS.map((a) => [a.id, o[a.id] ?? "none"])) as Record<AppId, State>;

test("tiles put what can be connected first, coming soon next, then plan-locked", () => {
  const s = states({ drive: "soon", sdi: "locked", stripe: "none" });
  const order = tileOrder(APPS, s).map((a) => a.id);
  assert.equal(order.at(-1), "sdi");
  assert.ok(order.indexOf("drive") > order.indexOf("stripe"));
  assert.ok(order.indexOf("drive") < order.indexOf("sdi"));
});

test("counts and the search", () => {
  assert.deepEqual(counts(states({ sdi: "attention", stripe: "connected", gmail: "paused", drive: "soon" })), { on: 3, attention: 1 });
  const words = (id: AppId) => (id === "gcal" ? "Google Calendar cantieri sul calendario" : id);
  assert.deepEqual(visible(APPS, "all", "calendar", words).map((a) => a.id), ["gcal"]);
  assert.equal(visible(APPS, "acct", "", words).length, 2);
});
