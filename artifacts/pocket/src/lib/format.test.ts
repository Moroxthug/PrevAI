import { test } from "node:test";
import assert from "node:assert/strict";
import { money, shortDate, time } from "./format.ts";

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
