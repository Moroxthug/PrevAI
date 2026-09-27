import { describe, expect, test } from "vitest";
import { localDayFor, toIsoDate } from "./dates.js";

describe("localDayFor — giorno di calendario italiano", () => {
  test("una timbratura dopo mezzanotte ora italiana va sul nuovo giorno", () => {
    // 00:30 CEST del 21 settembre = 22:30 UTC del 20
    expect(toIsoDate(localDayFor(new Date("2026-09-20T22:30:00Z")))).toBe("2026-09-21");
  });

  test("una timbratura serale resta sul giorno italiano", () => {
    // 23:30 CET del 28 febbraio = 22:30 UTC dello stesso giorno
    expect(toIsoDate(localDayFor(new Date("2026-02-28T22:30:00Z")))).toBe("2026-02-28");
  });

  test("restituisce la mezzanotte UTC di quel giorno (convenzione delle colonne `date`)", () => {
    expect(localDayFor(new Date("2026-03-01T03:00:00Z")).toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});
