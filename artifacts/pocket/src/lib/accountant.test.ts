import test from "node:test";
import assert from "node:assert/strict";
import { accessEnded, canSend, checks, companyInitials, exportsFor, monthState, type AccountantOverview } from "./accountant.ts";

const ov = (o: Partial<AccountantOverview> = {}): AccountantOverview => ({
  enabled: true, today: "2026-10-11", company: { name: "Edilizia Rossi", ownerName: "Marco Rossi" }, you: { name: "Anna", role: "bookkeeper" }, fiscalYearEnd: null, province: null,
  month: "2026-09", months: [], bank: { total: 10, matched: 7 }, receipts: { total: 4, attached: 4 }, invoices: { total: 5, issued: 3, issuedCents: 120000 }, payroll: null, ...o,
});

test("the parts that apply: nothing listed for an empty part", () => {
  assert.deepEqual(checks(ov()).map((c) => [c.key, c.pct, c.complete]), [["bank", 70, false], ["receipts", 100, true], ["invoices", 60, false]]);
  assert.deepEqual(checks(ov({ bank: null, receipts: { total: 0, attached: 0 }, invoices: { total: 0, issued: 0, issuedCents: 0 } })), []);
  assert.equal(checks(ov())[2]!.drafts, 2);
});
test("a month is closed or in progress", () => {
  assert.equal(monthState({ closed: { at: "x", by: null } }), "closed");
  assert.equal(monthState(undefined), "inProgress");
});
test("the files of a month", () => {
  assert.deepEqual(exportsFor("2026-09").map((f) => f.key), ["transactions", "invoices"]);
  assert.match(exportsFor("2026-09")[0]!.path, /kind=transactions&month=2026-09/);
});
test("access ended: the company the phone last opened is gone and was one where the person was the contabile", () => {
  const known = [{ orgId: "u3", companyName: "Edilizia Rossi", role: "bookkeeper" }, { orgId: "u4", companyName: "Altra", role: "foreman" }];
  assert.deepEqual(accessEnded([{ orgId: "u1" }], "u3", known), { ended: true, company: "Edilizia Rossi" });
  assert.deepEqual(accessEnded([{ orgId: "u1" }], "u4", known), { ended: false, company: "" });
  assert.deepEqual(accessEnded([{ orgId: "u3" }], "u3", known), { ended: false, company: "" });
  assert.deepEqual(accessEnded([], null, known), { ended: false, company: "" });
});
test("initials and the comment box", () => {
  assert.equal(companyInitials("Edilizia Rossi"), "ER");
  assert.equal(companyInitials("Rossi"), "RO");
  assert.equal(canSend("  "), false);
  assert.equal(canSend("Manca lo scontrino"), true);
  assert.equal(canSend("x".repeat(2001)), false);
});
