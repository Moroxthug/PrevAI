import assert from "node:assert/strict";
import { test } from "node:test";
import { waNumber } from "./messaging.ts";

test("a WhatsApp number is made international, Italian when it has no prefix", () => {
  assert.equal(waNumber("333 123 4567"), "+393331234567");
  assert.equal(waNumber("0039 333 1234567"), "+393331234567");
  assert.equal(waNumber("39 333 1234567"), "+393331234567");
  assert.equal(waNumber("02 1234567"), "+39021234567");
  assert.equal(waNumber("+44 20 7946 0958"), "+442079460958");
  assert.equal(waNumber("555"), null);
});
