import { test } from "node:test";
import assert from "node:assert/strict";
import { dayDate, money, sentence, shortDate, time } from "./format.ts";

// Come il sito (artifacts/preventivo-ai/src/lib/money.ts): Intl it-IT, spazio non separabile prima di €.
const SPACE = "[\u00a0\u202f ]";

test("soldi: it-IT in euro", () => {
  assert.match(money(4131.05), new RegExp(`^4\\.?131,05${SPACE}€$`));
  assert.match(money(18000, "it-IT", { cents: false }), new RegExp(`^18\\.000${SPACE}€$`));
});

test("date e orari", () => {
  const d = new Date(2026, 8, 29, 14, 30);
  assert.equal(shortDate(d), "29 set");
  assert.equal(time(d), "14:30");
});

test("data dei campi senza virgola, frase con un solo punto", () => {
  assert.equal(dayDate(new Date(2026, 8, 29)), "mar 29 set");
  assert.equal(sentence("alle 9:12 a.m.."), "alle 9:12 a.m.");
  assert.equal(sentence("alle 09:12."), "alle 09:12.");
});

test("relativeWhen: minuti, ore, oggi, ieri, giorno della settimana, data", async () => {
  const { relativeWhen } = await import("./format.ts");
  const now = new Date(2026, 8, 29, 15, 0); // mar 29 set, ore 15
  assert.equal(relativeWhen(new Date(2026, 8, 29, 14, 48), now), "12 min fa");
  assert.equal(relativeWhen(new Date(2026, 8, 29, 13, 0), now), "2 h fa");
  assert.equal(relativeWhen(new Date(2026, 8, 29, 1, 0), now), "oggi");
  assert.equal(relativeWhen(new Date(2026, 8, 28, 20, 0), now), "ieri");
  assert.equal(relativeWhen(new Date(2026, 8, 25, 9, 0), now), "ven");
  assert.equal(relativeWhen(new Date(2026, 8, 12, 9, 0), now), "12 set");
});
