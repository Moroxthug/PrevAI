import { describe, expect, it } from "vitest";
import { spostaDi } from "./calendario.js";

describe("promemoria che si ripetono", () => {
  it("il mese dopo, senza sforare la fine del mese", () => {
    expect(spostaDi("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(spostaDi("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(spostaDi("2026-12-15", "monthly")).toBe("2027-01-15");
  });
  it("tre mesi e un anno", () => {
    expect(spostaDi("2026-11-30", "quarterly")).toBe("2027-02-28");
    expect(spostaDi("2028-02-29", "annual")).toBe("2029-02-28");
    expect(spostaDi("2026-06-30", "annual")).toBe("2027-06-30");
  });
});
