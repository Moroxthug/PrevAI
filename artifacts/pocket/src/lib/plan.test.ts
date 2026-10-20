import assert from "node:assert/strict";
import { test } from "node:test";
import { featureRows, meterOf } from "./plan.ts";

test("a meter is near at 80% and full at all of it", () => {
  assert.deepEqual(meterOf({ used: 142, limit: 500 }), { value: 0.284, level: "ok" });
  assert.equal(meterOf({ used: 48, limit: 60 }).level, "near");
  assert.equal(meterOf({ used: 3, limit: 3 }).level, "full");
  assert.equal(meterOf({ used: 70, limit: 60 }).value, 1);
  assert.equal(meterOf({ used: 0, limit: 0 }).level, "full");
});

const PRO = ["quotes", "quote_email", "acceptance_notifications", "catalog", "contracts", "jobs", "costs", "invoicing", "team_accounts"];
const ELITE = [...PRO, "team_time", "assistant", "analytics_pro", "calendar_sync", "invoice_card_payments", "public_api", "gmail_send", "meta_lead_ads"];

test("Pro lists its caps and locks what Elite (and the Fisco add-on) adds", () => {
  const rows = featureRows(PRO, { quotes: { used: 51, limit: 60 }, openJobs: { used: 3, limit: 3 }, logins: 2 });
  assert.deepEqual(rows.slice(0, 2).map((r) => [r.id, r.count]), [["quotes", 60], ["jobs", 3]]);
  assert.equal(rows.find((r) => r.id === "logins")?.count, 2);
  assert.deepEqual(rows.filter((r) => !r.included).map((r) => r.id), ["teamTime", "assistant", "analytics", "books", "calendar", "cards", "gmail"]);
});

test("Elite has one unlimited row; only PrevAI Fisco stays locked until the add-on", () => {
  const rows = featureRows(ELITE, { quotes: null, openJobs: null, logins: 5 });
  assert.equal(rows[0]?.id, "unlimited");
  assert.deepEqual(rows.filter((r) => !r.included).map((r) => [r.id, r.tier]), [["books", "fisco"]]);
  assert.equal(featureRows([...ELITE, "sdi_invoicing", "admin_suite"], { quotes: null, openJobs: null, logins: 5 }).every((r) => r.included), true);
});

test("a company with no plan has no rows", () => {
  assert.deepEqual(featureRows([], { quotes: null, openJobs: null, logins: 1 }), []);
});
