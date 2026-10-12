import test from "node:test";
import assert from "node:assert/strict";
import { checklist, closeState, dayDate, defaultMonth, filterCounts, lineOf, linesFor, matches, monthChips, monthLines, needsPicker, openCount, otherActions, parseNa, serializeNa, shiftMonth, suggestion, type BankLine, type CheckItem, type MovimentoDto, type Suggerimento } from "./books.ts";

const item = (key: CheckItem["key"], count: number, applies = true): CheckItem => ({ key, applies, count, cents: 0, rows: [] });
const line = (o: Partial<BankLine>): BankLine => ({ id: "l", date: "2026-09-28", description: "x", amountCents: 100, status: "unmatched", match: null, suggestions: [], ...o });
const abbina = (id: string, certezza: "alta" | "media"): Suggerimento => ({ azione: "abbina", tipo: "incasso", id, etichetta: `Incasso ${id}`, certezza });
const incasso = (invoiceId: string, certezza: "alta" | "media"): Suggerimento => ({ azione: "registra_incasso", invoiceId, etichetta: `Fattura ${invoiceId}`, certezza });

test("months shift across the year", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-11", 3), "2027-02");
});
test("chips: the last four months ending now, closed ones marked; opens on the month just ended", () => {
  const c = monthChips("2026-10-01", ["2026-08", "2026-07"]);
  assert.deepEqual(c.map((x) => [x.month, x.closed]), [["2026-07", true], ["2026-08", true], ["2026-09", false], ["2026-10", false]]);
  assert.equal(defaultMonth("2026-10-01"), "2026-09");
  assert.equal(defaultMonth("2026-01-15"), "2025-12");
});
test("the checklist leaves out what does not apply and counts open, done and not needed", () => {
  const list = checklist([item("bank_unmatched", 3), item("payments_unbanked", 2, false), item("costs_pending", 0), item("sdi_open", 2)], new Set(["sdi_open"]));
  assert.deepEqual(list.map((i) => [i.key, i.open, i.na]), [["bank_unmatched", true, false], ["costs_pending", false, false], ["sdi_open", false, true]]);
  assert.equal(openCount(list), 1);
});
test("close: not before the month is over, not with items open, once", () => {
  const open = checklist([item("bank_unmatched", 1)], new Set());
  const done = checklist([item("bank_unmatched", 0)], new Set());
  assert.equal(closeState("2026-10", "2026-10-31", done, false), "notOver");
  assert.equal(closeState("2026-09", "2026-10-01", open, false), "openItems");
  assert.equal(closeState("2026-09", "2026-10-01", done, false), "ready");
  assert.equal(closeState("2026-09", "2026-10-01", open, true), "closed");
});
test("not-needed marks round-trip and survive garbage", () => {
  assert.deepEqual([...parseNa(serializeNa(new Set(["b", "a"])))], ["a", "b"]);
  assert.equal(parseNa("{nope").size, 0);
  assert.equal(parseNa(null).size, 0);
});
test("a bank day prints as that calendar day", () => {
  const d = dayDate("2026-09-28");
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 8, 28]);
});
test("a movement from the server becomes a line: state, match and a description with the counterpart", () => {
  const m: MovimentoDto = { id: "a", data: "2026-09-16", importoCents: -4100, descrizione: "CARTA 1234", controparte: "ENI STATION", stato: "abbinato", abbinamento: { tipo: "costo", id: "c" }, suggerimenti: [] };
  const l = lineOf(m);
  assert.equal(l.status, "matched");
  assert.equal(l.match, "costo");
  assert.equal(l.description, "ENI STATION · CARTA 1234");
  assert.equal(lineOf({ ...m, stato: "ignorato", abbinamento: null }).status, "ignored");
  assert.equal(lineOf({ ...m, stato: "da_abbinare", abbinamento: null, controparte: "" }).description, "CARTA 1234");
});
test("lines of the month, newest first, split by filter", () => {
  const ls = [line({ id: "a", date: "2026-09-16", status: "matched" }), line({ id: "b", date: "2026-09-28" }), line({ id: "c", date: "2026-08-30" }), line({ id: "d", date: "2026-09-18", status: "ignored" })];
  const m = monthLines(ls, "2026-09");
  assert.deepEqual(m.map((l) => l.id), ["b", "d", "a"]);
  assert.deepEqual(filterCounts(m), { open: 1, matched: 1, ignored: 1 });
  assert.deepEqual(linesFor(m, "ignored").map((l) => l.id), ["d"]);
});
test("suggestions: the sure ones first; costs and F24 are other actions, not matches", () => {
  const cost: Suggerimento = { azione: "registra_costo", etichetta: "Registra come costo", categoria: "materials" };
  const l = line({ suggestions: [abbina("m", "media"), cost, incasso("f", "alta")] });
  assert.deepEqual(matches(l).map((s) => s.azione === "abbina" ? s.id : s.invoiceId), ["f", "m"]);
  assert.equal(suggestion(l) && suggestion(l)!.certezza, "alta");
  assert.deepEqual(otherActions(l), [cost]);
  assert.equal(suggestion(line({})), null);
});
test("one sure match applies in one tap; none, several sure ones or several unsure ones open the sheet", () => {
  assert.equal(needsPicker(line({})), true);
  assert.equal(needsPicker(line({ suggestions: [abbina("1", "alta"), abbina("2", "media"), abbina("3", "media")] })), false);
  assert.equal(needsPicker(line({ suggestions: [abbina("1", "alta"), incasso("2", "alta")] })), true);
  assert.equal(needsPicker(line({ suggestions: [abbina("1", "media")] })), false);
  assert.equal(needsPicker(line({ suggestions: [abbina("1", "media"), abbina("2", "media")] })), true);
});
