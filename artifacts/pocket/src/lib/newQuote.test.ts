import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addManualLine, bodyChapters, canAddNewClient, canSaveManual, canWrite, categoriesOf, clientDataFor, defaultQty, EXAMPLES, filterCatalog, manualBody, manualTotals, newManualChapter,
  newClientBody, newClientData, nextProgress, parseTarget, postalCode, qtyStep, removeManualLine, renameManualChapter, selectionChapter, selectionOf, stepChosen,
  stepStates, summaryOf, ivaRateOf, templateIdOf, termLines, toggleChosen, editManualLine, EMPTY_CLIENT, type CatalogRow, type ManualChapter,
} from "./newQuote.ts";

const rows: CatalogRow[] = [
  { id: "a", nome: "Interior walls, two coats", categoria: "Painting", um: "mq", prezzoUnitario: 2.1 },
  { id: "b", nome: "Floor protection and cleanup", categoria: "Site", um: "a corpo", prezzoUnitario: 180 },
  { id: "c", nome: "Ceilings, two coats", categoria: "painting", um: "mq", prezzoUnitario: 1.65 },
  { id: "d", nome: "Skim coat", categoria: null, um: "mq", prezzoUnitario: 1.4 },
];

test("seven examples, three layouts mapped to the server's templates", () => {
  assert.equal(EXAMPLES.length, 7);
  assert.equal(templateIdOf("standard"), "standard");
  assert.equal(templateIdOf("professional"), "arosio");
  assert.equal(templateIdOf("elegant"), "mariagrazia");
});

test("a description needs something other than spaces; the target is whole dollars", () => {
  assert.equal(canWrite("  \n "), false);
  assert.equal(canWrite("Repaint 3 bedrooms"), true);
  assert.equal(parseTarget("$4,500"), 4500);
  assert.equal(parseTarget(""), null);
});

test("the writing steps tick forward while pending, wait on the last, and finish when settled", () => {
  assert.equal(nextProgress(0, false), 1);
  assert.equal(nextProgress(1, false), 2);
  assert.equal(nextProgress(5, false), 5);
  assert.equal(nextProgress(3, true), 6);
  assert.deepEqual(stepStates(0), ["todo", "todo", "todo", "todo", "todo"]);
  assert.deepEqual(stepStates(3), ["done", "done", "cur", "todo", "todo"]);
  assert.deepEqual(stepStates(6), ["done", "done", "done", "done", "done"]);
});

test("the summary names the quote, counts lines and chapters", () => {
  const s = summaryOf({ titoloPreventivoRiga1: "Analisi Economica e Computo Metrico Prezzato", titoloPreventivoRiga2: "Camere e soffitto del bagno", numeroPreventivoData: "N° 119.2026", totale: 4131.05, capitoli: [{ voci: [{}, {}, {}] }, { voci: [{}, {}] }] });
  assert.deepEqual(s, { title: "Camere e soffitto del bagno", lines: 5, chapters: 2, number: "N° 119.2026", total: 4131.05 });
  assert.equal(summaryOf({ titoloPreventivoRiga1: "Deck", items: [{}, {}] }).title, "Deck");
  assert.equal(summaryOf({ titoloPreventivoRiga1: "Deck", items: [{}, {}] }).lines, 2);
  assert.equal(summaryOf({ descrizioneGenerale: "Paint the hall. Two coats." }).title, "Paint the hall.");
});

test("IVA: le aliquote ammesse, il resto torna all'ordinaria", () => {
  assert.equal(ivaRateOf(10), 10);
  assert.equal(ivaRateOf(0), 0);
  assert.equal(ivaRateOf(4), 4);
  assert.equal(ivaRateOf(13), 22);
  assert.equal(ivaRateOf(null), 22);
});

const chapters = (): ManualChapter[] => {
  let c = [newManualChapter("c1", "l1", "Preparation")];
  c = editManualLine(c, 0, 0, "description", "Floor protection");
  c = editManualLine(c, 0, 0, "um", "lump sum");
  c = editManualLine(c, 0, 0, "prezzoUnitario", "180");
  c = addManualLine(c, 0, "l2");
  c = editManualLine(c, 0, 1, "description", "Primer");
  c = editManualLine(c, 0, 1, "quantita", "48");
  c = editManualLine(c, 0, 1, "prezzoUnitario", "1,85");
  return c;
};

test("manual lines: edits parse numbers, totals are to the cent and tax follows the rate", () => {
  const c = chapters();
  assert.equal(c[0]!.lines[1]!.prezzoUnitario, 1.85);
  const t = manualTotals(c, 22);
  assert.deepEqual(t.lineTotals, [[180, 88.8]]);
  assert.equal(t.subtotale, 268.8);
  assert.equal(t.ivaValore, 59.14);
  assert.equal(t.totale, 327.94);
  assert.equal(manualTotals(c, 0).totale, 268.8);
});

test("manual lines: add, remove, rename; blank lines do not make a quote", () => {
  assert.equal(canSaveManual([newManualChapter("c", "l")]), false);
  const c = chapters();
  assert.equal(canSaveManual(c), true);
  assert.equal(removeManualLine(c, 0, 0)[0]!.lines.length, 1);
  assert.equal(renameManualChapter(c, 0, "Work")[0]!.title, "Work");
  const withBlank = addManualLine(c, 0, "l3");
  assert.equal(bodyChapters(withBlank)[0]!.voci.length, 2);
  assert.equal(bodyChapters([newManualChapter("x", "y")]).length, 0);
  assert.equal(bodyChapters(c)[0]!.lettera, "A");
  assert.equal(bodyChapters(c)[0]!.subtotale, 268.8);
});

test("manual body: the chapters, the client, the title, the exempt rate, the terms", () => {
  const b = manualBody({ title: " Bedrooms ", chapters: chapters(), clientData: { nome: "Dana", indirizzo: "Via Roma 17" }, iva: 22, terms: "deposit30", notes: "", templateId: "standard" });
  assert.equal(b.titoloPreventivoRiga1, "Bedrooms");
  assert.equal(b.ivaPercentuale, 22);
  assert.deepEqual(b.condizioniPagamento, ["30% di acconto alla firma", "70% a fine lavori"]);
  assert.equal("note" in b, false);
  assert.equal(b.capitoli[0]!.voci[0]!.totale, 180);
  const x = manualBody({ title: "", chapters: chapters(), iva: 0, terms: "net15", notes: " Park in the back " });
  assert.equal(x.ivaPercentuale, 0);
  assert.equal("titoloPreventivoRiga1" in x, false);
  assert.equal("clientData" in x, false);
  assert.equal(x.note, "Park in the back");
  assert.deepEqual(termLines("half"), ["50% alla firma", "50% a fine lavori"]);
});

test("client: the form needs a name; postal codes are tidied; clientData and the client body", () => {
  assert.equal(canAddNewClient(EMPTY_CLIENT), false);
  assert.equal(postalCode(" 65 100 "), "65100");
  assert.equal(postalCode("abc"), "abc");
  const f = { ...EMPTY_CLIENT, name: " Priya Nair ", address: "Via Roma 212", city: "Pescara", province: "PE", postalCode: "65 100", phone: "333 123 4567" };
  assert.deepEqual(newClientData(f), { nome: "Priya Nair", indirizzo: "Via Roma 212", city: "Pescara", province: "PE", postalCode: "65100", phone: "333 123 4567" });
  assert.deepEqual(newClientBody(f), { name: "Priya Nair", address: "Via Roma 212", city: "Pescara", province: "PE", postalCode: "65100", phone: "333 123 4567" });
  assert.deepEqual(clientDataFor(null, f), newClientData(f));
  assert.deepEqual(clientDataFor({ id: "1", name: "Dana", data: { nome: "Dana Whitfield", email: "d@x.ca" } }, null), { indirizzo: "", nome: "Dana Whitfield", email: "d@x.ca" });
  assert.equal(clientDataFor(null, null), undefined);
  assert.equal(clientDataFor(null, EMPTY_CLIENT), undefined);
});

test("price list: categories once each, search and category filter", () => {
  assert.deepEqual(categoriesOf(rows), ["Painting", "Site"]);
  assert.deepEqual(filterCatalog(rows, "", null).map((r) => r.id), ["a", "b", "c", "d"]);
  assert.deepEqual(filterCatalog(rows, "", "painting").map((r) => r.id), ["a", "c"]);
  assert.deepEqual(filterCatalog(rows, "coat", null).map((r) => r.id), ["a", "c", "d"]);
  assert.deepEqual(filterCatalog(rows, "painting ceil", null).map((r) => r.id), []);
  assert.deepEqual(filterCatalog(rows, "walls", "Site").map((r) => r.id), []);
});

test("price list: una superficie parte da 20 e si muove di 5, un corpo da 1 e di 1", () => {
  assert.equal(defaultQty("mq"), 20);
  assert.equal(qtyStep("mq"), 5);
  assert.equal(defaultQty("a corpo"), 1);
  assert.equal(defaultQty("cad"), 1);
  assert.equal(defaultQty("h"), 1);
  assert.equal(qtyStep("ml"), 5);
  assert.equal(qtyStep("cad"), 1);
});

test("price list: add toggles, the stepper never goes below one step, the total is before tax", () => {
  let sel = toggleChosen([], rows[0]!);
  sel = toggleChosen(sel, rows[1]!);
  assert.deepEqual(sel, [{ id: "a", qty: 20 }, { id: "b", qty: 1 }]);
  sel = stepChosen(sel, rows[0]!, 1);
  assert.equal(sel[0]!.qty, 25);
  sel = stepChosen(stepChosen(sel, rows[0]!, -1), rows[0]!, -1);
  assert.equal(sel[0]!.qty, 15);
  for (let i = 0; i < 10; i++) sel = stepChosen(sel, rows[0]!, -1);
  assert.equal(sel[0]!.qty, 5);
  const s = selectionOf(sel, rows);
  assert.equal(s.subtotal, 190.5);
  assert.deepEqual(s.rows.map((r) => r.total), [10.5, 180]);
  assert.equal(toggleChosen(sel, rows[0]!).length, 1);
  assert.equal(selectionOf([{ id: "gone", qty: 1 }], rows).rows.length, 0);
  const ch = selectionChapter(s.rows, "Scope", "c");
  assert.equal(ch.lines.length, 2);
  assert.equal(ch.lines[0]!.description, "Interior walls, two coats");
  assert.equal(manualTotals([ch], 0).subtotale, 190.5);
});
