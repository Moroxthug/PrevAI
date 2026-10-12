import test from "node:test";
import assert from "node:assert/strict";
import { burdenPercent, burdenShare, canGoNext, employeeFlag, firstNames, hoursFrom, jobCards, multiplierFrom, periodStatus, premiumPercent, warnings, withCodes, type PayReport, type WorkerPay } from "./pay.ts";

const report = (o: Partial<PayReport> = {}): PayReport => ({
  period: { start: "2026-09-01", end: "2026-09-30" }, today: "2026-10-11", isCurrent: false, employees: [], subcontractors: [], jobs: [],
  totals: { hours: 0, overtimeHours: 0, grossCents: 0, burdenCents: 0, costCents: 0, premiumCents: 0 }, pending: { count: 0, hours: 0 },
  warnings: { missingPayrollId: [], zeroRate: [] }, exports: [], changedSinceExport: [],
  settings: { frequency: "monthly", anchorDate: "2026-01-05", overtimeWeeklyHours: null, overtimeMultiplier: 1.25, payrollCodes: {} },
  previousStart: "2026-08-01", nextStart: "2026-10-01", ...o,
});
const worker = (o: Partial<WorkerPay> = {}): WorkerPay => ({ workerId: "w", name: "Luca Bianchi", payrollId: "L01", hours: 10, lines: [{ kind: "regular", hours: 10, quantity: null, rateCents: 1200, amountCents: 12000 }], grossCents: 12000, jobs: [], ...o });

test("period status: exported, in progress, ready", () => {
  assert.equal(periodStatus(report({ exports: [{ id: "x", format: "generic", exportedAt: "2026-10-02T08:00:00Z", exportedByName: null }] })).kind, "exported");
  assert.equal(periodStatus(report({ isCurrent: true, period: { start: "2026-10-01", end: "2026-10-31" } })).kind, "progress");
  assert.equal(periodStatus(report()).kind, "ready");
});
test("you can step forward only to a period that has started", () => {
  assert.equal(canGoNext(report()), true);
  assert.equal(canGoNext(report({ nextStart: "2026-11-01" })), false);
});
test("warnings come in the board's order and the card is empty when nothing needs a look", () => {
  assert.deepEqual(warnings(report(), { pendingNames: [] }), []);
  const w = warnings(report({ pending: { count: 2, hours: 9 }, changedSinceExport: ["Anna"], warnings: { missingPayrollId: ["Luca"], zeroRate: ["Dev"] } }), { pendingNames: ["Luca"] });
  assert.deepEqual(w.map((x) => x.key), ["approve", "changed", "payroll", "rate"]);
});
test("first names, once each", () => {
  assert.deepEqual(firstNames(["Luca Bianchi", "Luca Rossi", "Anna Conti"]), ["Luca", "Anna"]);
});
test("an employee is flagged for a missing code first, then a missing rate", () => {
  assert.equal(employeeFlag(worker()), null);
  assert.equal(employeeFlag(worker({ payrollId: null })), "noPayroll");
  assert.equal(employeeFlag(worker({ lines: [{ kind: "regular", hours: 3, quantity: null, rateCents: 0, amountCents: 0 }] })), "noRate");
});
test("jobs biggest first with their share; the burden as a share of wages", () => {
  const job = (name: string, total: number, burden = 0) => ({ projectId: name, name, hours: 1, overtimeHours: 0, straightCents: total - burden, premiumCents: 0, burdenCents: burden, allowanceCents: 0, totalCents: total });
  const cards = jobCards([job("a", 100), job("b", 300, 60)]);
  assert.deepEqual(cards.map((c) => [c.key, c.share]), [["b", 0.75], ["a", 0.25]]);
  assert.equal(burdenPercent([job("b", 300, 60)]), 25);
  assert.equal(burdenPercent([job("a", 100)]), null);
  assert.equal(burdenShare({ wages: 1000, burden: 150 }), 15);
});
test("the overtime fields: hours 1 to 80, premium in percent as a multiplier", () => {
  assert.equal(hoursFrom("40"), 40);
  assert.equal(hoursFrom("0"), null);
  assert.equal(hoursFrom("abc"), null);
  assert.equal(multiplierFrom("25"), 1.25);
  assert.equal(multiplierFrom("12,5"), 1.125);
  assert.equal(multiplierFrom(""), null);
  assert.equal(premiumPercent(1.25), 25);
});
test("payroll codes: only the written ones are kept", () => {
  assert.deepEqual(withCodes({}, { a: " L01 ", b: "  " }).payrollCodes, { a: "L01" });
});
