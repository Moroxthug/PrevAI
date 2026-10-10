import { test } from "vitest";
import assert from "node:assert/strict";
import { startsNewVersion } from "./versions.js";

test("startsNewVersion: solo un preventivo inviato, ancora attivo e non già in revisione", () => {
  const sent = new Date();
  assert.equal(startsNewVersion({ sentAt: sent, status: "unlocked", revisionOpen: false }), true);
  assert.equal(startsNewVersion({ sentAt: sent, status: "unlocked", revisionOpen: true }), false);
  assert.equal(startsNewVersion({ sentAt: null, status: "unlocked", revisionOpen: false }), false);
  assert.equal(startsNewVersion({ sentAt: sent, status: "accepted", revisionOpen: false }), false);
  assert.equal(startsNewVersion({ sentAt: null, status: "draft", revisionOpen: false }), false);
});
