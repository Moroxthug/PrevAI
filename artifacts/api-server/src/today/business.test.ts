import { describe, expect, it } from "vitest";
import { localMidnight, periodStarts } from "./business.js";

describe("periodStarts", () => {
  it("le settimane cominciano di lunedì, l'ultima è quella in corso", () => {
    // martedì 29 settembre 2026
    expect(periodStarts("W", "2026-09-29")).toEqual({
      starts: ["2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"],
      end: "2026-10-05",
    });
    // Una domenica appartiene alla settimana cominciata il lunedì prima.
    expect(periodStarts("W", "2026-10-04").starts.at(-1)).toBe("2026-09-28");
  });
  it("sei mesi, a cavallo d'anno", () => {
    expect(periodStarts("M", "2026-02-15")).toEqual({ starts: ["2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"], end: "2026-03-01" });
  });
  it("quattro trimestri", () => {
    expect(periodStarts("Q", "2026-09-29")).toEqual({ starts: ["2025-10-01", "2026-01-01", "2026-04-01", "2026-07-01"], end: "2026-10-01" });
  });
});

describe("localMidnight", () => {
  it("è la mezzanotte di Roma, d'estate e d'inverno", () => {
    expect(localMidnight("2026-09-29", "Europe/Rome").toISOString()).toBe("2026-09-28T22:00:00.000Z");
    expect(localMidnight("2026-01-15", "Europe/Rome").toISOString()).toBe("2026-01-14T23:00:00.000Z");
    // Il giorno del cambio all'ora legale (29 marzo 2026): la mezzanotte è ancora l'ora solare.
    expect(localMidnight("2026-03-29", "Europe/Rome").toISOString()).toBe("2026-03-28T23:00:00.000Z");
  });
});
