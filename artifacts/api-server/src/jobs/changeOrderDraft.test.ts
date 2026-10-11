import { describe, it, expect } from "vitest";
import { parseDraft } from "./changeOrderDraft.js";

describe("parseDraft", () => {
  it("keeps priced lines and the days", () => {
    const d = parseDraft(JSON.stringify({ title: "Quattro faretti", description: "x", days: 1, items: [{ descrizione: "Faretto LED", um: "n", quantita: 4, prezzoUnitario: 85 }] }));
    expect(d?.items).toEqual([{ descrizione: "Faretto LED", um: "n", quantita: 4, prezzoUnitario: 85 }]);
    expect(d?.scheduleDeltaDays).toBe(1);
  });
  it("drops lines without a description or a valid price, and fixes the quantity", () => {
    const d = parseDraft(JSON.stringify({ items: [{ descrizione: "", prezzoUnitario: 10 }, { descrizione: "A", prezzoUnitario: "abc" }, { descrizione: "B", quantita: -2, prezzoUnitario: 5 }] }));
    expect(d?.items).toEqual([{ descrizione: "B", um: "", quantita: 1, prezzoUnitario: 5 }]);
    expect(d?.scheduleDeltaDays).toBe(0);
  });
  it("is null for nothing usable", () => {
    expect(parseDraft("not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ items: [] }))).toBeNull();
  });
});
