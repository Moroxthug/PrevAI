import test from "node:test";
import assert from "node:assert/strict";
import { buildItems, defaultSelection, doneVerb, f24Path, featuredReturn, filterCounts, groups, isEmptyCalendar, kpis, lookOf, marks, monthTicks, wordOf, type ComplianceOverview, type DeadlineDto, type ReminderDto } from "./compliance.ts";

const dl = (o: Partial<DeadlineDto>): DeadlineDto => ({
  key: "2026:saldo", anno: 2026, chiave: "saldo", kind: "imposta", label: "Saldo e primo acconto", description: "", amountCents: 120000, authority: "Agenzia delle Entrate", dueDate: "2026-11-30",
  filedAt: null, daysLeft: 0, state: "upcoming", hasF24: true, lines: [{ label: "Imposta sostitutiva", cents: 120000 }], versatoCents: 0, notReviewed: false, ...o,
});
const rm = (o: Partial<ReminderDto>): ReminderDto => ({ id: "r1", kind: "insurance", preset: null, title: "Assicurazione RC", authority: "", dueDate: "2026-12-01", recurrence: "annual", remindDaysBefore: 30, notes: "", lastDoneAt: null, daysLeft: 0, state: "upcoming", ...o });
const ov = (o: Partial<ComplianceOverview> = {}): ComplianceOverview => ({ enabled: true, today: "2026-10-11", deadlines: [], filed: [], filedThisYear: { count: 0, onTime: 0 }, reminders: [], presets: [], profile: { regime: "forfettario", gestione: "artigiani", riduzione: "nessuna", completo: true }, ...o });

test("look: filed, late, within 90 days, later", () => {
  assert.equal(lookOf(5, true), "filed");
  assert.equal(lookOf(-1, false), "overdue");
  assert.equal(lookOf(90, false), "due");
  assert.equal(lookOf(91, false), "later");
});
test("items: open ones by date, then the filed ones, latest first; far-off ones stay out", () => {
  const items = buildItems(ov({
    deadlines: [dl({ key: "b", dueDate: "2026-11-30" }), dl({ key: "a", dueDate: "2026-10-20" }), dl({ key: "far", dueDate: "2028-01-01" })],
    filed: [dl({ key: "f1", dueDate: "2026-06-30", filedAt: "2026-06-20T10:00:00Z", state: "filed" }), dl({ key: "f2", dueDate: "2026-05-31", filedAt: "2026-05-30T10:00:00Z", state: "filed" })],
    reminders: [rm({ dueDate: "2026-12-01" })],
  }));
  assert.deepEqual(items.map((i) => i.id), ["a", "b", "reminder:r1", "f1", "f2"]);
});
test("the verbs: a payment is paid, the declaration filed, insurance renewed", () => {
  assert.equal(doneVerb({ source: "deadline", kind: "imposta" }), "markPaid");
  assert.equal(doneVerb({ source: "deadline", kind: "dichiarazione" }), "markFiled");
  assert.equal(doneVerb({ source: "reminder", kind: "insurance" }), "markRenewed");
  assert.equal(doneVerb({ source: "reminder", kind: "safety" }), "markDone");
});
test("words: late days, due, paid today", () => {
  const [late] = buildItems(ov({ deadlines: [dl({ dueDate: "2026-10-08" })] }));
  assert.deepEqual(wordOf(late!), { kind: "late", days: 3 });
  const [paid] = buildItems(ov({ filed: [dl({ filedAt: "2026-10-11T08:00:00Z", state: "filed" })] }));
  assert.deepEqual(wordOf(paid!), { kind: "paidToday" });
});
test("numbers, groups and filter counts", () => {
  const items = buildItems(ov({ deadlines: [dl({ key: "a", dueDate: "2026-10-01" }), dl({ key: "b", dueDate: "2026-10-20" }), dl({ key: "c", dueDate: "2027-03-01" })], filed: [dl({ key: "f", filedAt: "2026-06-20T10:00:00Z", state: "filed" })] }));
  const k = kpis(items, { count: 1, onTime: 1 });
  assert.equal(k.late, 1);
  assert.equal(k.next30, 1);
  assert.deepEqual(groups(items, "all").map((g) => g.key), ["late", "next", "later", "filed"]);
  assert.deepEqual(groups(items, "overdue").map((g) => g.key), ["late"]);
  assert.deepEqual(filterCounts(items), { all: 4, due: 2, overdue: 1, filed: 1 });
  assert.equal(defaultSelection(items), "a");
});
test("featured payment: the next open one with an amount, else the latest filed; the declaration is never it", () => {
  const items = buildItems(ov({ deadlines: [dl({ key: "dich", kind: "dichiarazione", amountCents: 0, dueDate: "2026-10-12" }), dl({ key: "pay", dueDate: "2026-11-30" })] }));
  assert.equal(featuredReturn(items)?.id, "pay");
  assert.equal(f24Path(featuredReturn(items)!), "/api/fiscale/scadenzario/saldo/f24.pdf?anno=2026");
});
test("the 90 day strip: late items at the left edge, alternating lanes; month ticks inside the horizon", () => {
  const items = buildItems(ov({ deadlines: [dl({ key: "a", dueDate: "2026-10-01" }), dl({ key: "b", dueDate: "2026-11-10" })] }));
  const m = marks(items);
  assert.equal(m[0]!.pct, 3.5);
  assert.deepEqual(m.map((x) => x.lane), ["up", "dn"]);
  assert.deepEqual(monthTicks("2026-10-11").map((t) => t.month), ["2026-11", "2026-12", "2027-01"]);
});
test("an empty calendar has no deadlines, filed ones or reminders", () => {
  assert.equal(isEmptyCalendar(ov()), true);
  assert.equal(isEmptyCalendar(ov({ reminders: [rm({})] })), false);
});
