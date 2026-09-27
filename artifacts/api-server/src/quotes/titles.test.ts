import assert from "node:assert/strict";
import { test } from "vitest";
import { stripLocationPlaceholder } from "./titles.js";

// V2-4: alcuni preventivi v1 avevano "[Comune] ([Prov])" letterale nel titolo
test("stripLocationPlaceholder toglie i segnaposto dell'esempio del prompt", () => {
  assert.equal(stripLocationPlaceholder("Intervento di rifacimento bagno – [Comune] ([Prov])"), "Intervento di rifacimento bagno");
  assert.equal(stripLocationPlaceholder("Intervento di [descrizione breve] - Comune (Prov)"), "Intervento di");
  assert.equal(stripLocationPlaceholder("Intervento di tinteggiatura – Milano (MI)"), "Intervento di tinteggiatura – Milano (MI)");
});
