import test from "node:test";
import assert from "node:assert/strict";
import { applyPatch, brandKeyOf, defaultSchedule, defaultsOf, depositOf, looksLikeCf, looksLikePiva, netOf, pageOf, withDeposit, withHoldback, withNet, type Profile } from "./profile.ts";

test("a deposit takes from the last payment and gives it back, so the terms keep adding up", () => {
  const s = defaultSchedule();
  assert.equal(depositOf(s), 30);
  const up = withDeposit(s, 40, "Acconto")!;
  assert.equal(depositOf(up), 40);
  assert.equal(up.terms.at(-1)!.value, 0);
  assert.equal(up.terms.reduce((n, t) => n + t.value, 0), 100);
  const down = withDeposit(up, 10, "Deposit")!;
  assert.equal(down.terms.reduce((n, t) => n + t.value, 0), 100);
});

test("a deposit the last payment can't give is refused, and no deposit drops the term", () => {
  assert.equal(withDeposit(defaultSchedule(), 45, "Acconto"), null);
  const none = withDeposit(defaultSchedule(), 0, "Deposit")!;
  assert.equal(none.terms.some((t) => t.type === "deposit"), false);
  assert.equal(depositOf(none), 0);
});

test("a company with no deposit gets one added first, from the last payment", () => {
  const none = withDeposit(defaultSchedule(), 0, "Deposit")!;
  const again = withDeposit(none, 5, "Deposit upon signing")!;
  assert.equal(again.terms[0]!.type, "deposit");
  assert.equal(again.terms[0]!.dueDays, 0);
  assert.equal(again.terms.reduce((n, t) => n + t.value, 0), 100);
});

test("the payment terms are the days the payments after the deposit give", () => {
  const s = defaultSchedule();
  assert.equal(netOf(s), "net15");
  assert.equal(netOf(withNet(s, "receipt")), "receipt");
  assert.equal(netOf(withNet(s, "net30")), "net30");
  assert.equal(withNet(s, "net30").terms[0]!.dueDays, 0, "the deposit stays due on signing");
});

test("holdback is on or off with its percent kept", () => {
  const h = withHoldback(defaultSchedule(), true);
  assert.deepEqual(h.holdback, { enabled: true, percent: 10 });
  assert.deepEqual(withHoldback(h, false).holdback, { enabled: false, percent: 10 });
  assert.deepEqual(withHoldback(h, true, 5).holdback, { enabled: true, percent: 5 });
});

test("a patch changes only the keys of a page", () => {
  const p = { pocketSettings: { tax: { split: true, showAs: "line" } }, automationSettings: { invoiceReminders: true, autoSendInvoices: false } } as unknown as Profile;
  const n = applyPatch(p, { companyName: "X", pocketSettings: { tax: { split: false }, invoices: { terms: "net30" } }, automationSettings: { autoSendInvoices: true } });
  assert.equal(n.companyName, "X");
  assert.deepEqual(n.pocketSettings.tax, { split: false, showAs: "line" });
  assert.deepEqual(n.pocketSettings.invoices, { terms: "net30" });
  assert.deepEqual(n.automationSettings, { invoiceReminders: true, autoSendInvoices: true });
  assert.deepEqual(pageOf(p, "quotes"), {});
});

test("the quote defaults PrevAI has no column for start at 30 days, no markup, no copy", () => {
  assert.deepEqual(defaultsOf(null), { validDays: 30, markup: 0, copyToMe: false });
  assert.deepEqual(defaultsOf({ pocketSettings: { defaults: { validDays: 45, copyToMe: true } } }), { validDays: 45, markup: 0, copyToMe: true });
});

test("a partita IVA and a codice fiscale look right with or without the spaces", () => {
  assert.equal(looksLikePiva("012 345 678 90"), true);
  assert.equal(looksLikePiva("IT01234567890"), true);
  assert.equal(looksLikePiva("0123456789"), false);
  assert.equal(looksLikePiva(""), false);
  assert.equal(looksLikeCf("RSSMRA80A01H501U"), true);
  assert.equal(looksLikeCf("01234567890"), true);
  assert.equal(looksLikeCf("RSSMRA80A01"), false);
});

test("a saved colour is one of the swatches, or the violet", () => {
  const colours = { violet: "#6A2FBF", harbour: "#1F4F86", forest: "#1F7A45", brick: "#B4462B", teal: "#1E7F80", charcoal: "#2B2B30" };
  assert.equal(brandKeyOf("#1f4f86", colours), "harbour");
  assert.equal(brandKeyOf(null, colours), "violet");
  assert.equal(brandKeyOf("#123456", colours), "violet");
});

test("the next invoice number is one more than this year's highest", async () => {
  const { nextInvoiceNumber } = await import("./profile.ts");
  assert.equal(nextInvoiceNumber(["PF-2026-0003", "PF-2026-0012", "PF-2025-0099", "NC-2026-0004"], 2026), "PF-2026-0013");
  assert.equal(nextInvoiceNumber([], 2026), "PF-2026-0001");
});
