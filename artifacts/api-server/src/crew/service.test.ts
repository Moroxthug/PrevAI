import { describe, expect, test } from "vitest";
import { localToday, touchesLocalDay } from "./service.js";

// SQUADRA-1: "oggi" sulla pagina dell'operaio e nella giornata del
// capocantiere è il giorno italiano, mentre i blocchi sono salvati come
// istanti UTC.

const block = (startsAt: string, endsAt: string) => ({ startsAt: new Date(startsAt), endsAt: new Date(endsAt) });

describe("touchesLocalDay", () => {
  test("un turno di sera è sul suo giorno italiano, non sul giorno UTC", () => {
    // 23:00-01:00 CEST tra il 22 e il 23 settembre = 21:00-23:00 UTC del 22.
    const late = block("2026-09-22T21:00:00Z", "2026-09-22T23:00:00Z");
    expect(touchesLocalDay(late, "2026-09-22")).toBe(true);
    expect(touchesLocalDay(late, "2026-09-23")).toBe(true);
    // 00:30-04:00 CEST del 23 = 22:30-02:00 UTC: per l'UTC comincia il 22.
    const night = block("2026-09-22T22:30:00Z", "2026-09-23T02:00:00Z");
    expect(touchesLocalDay(night, "2026-09-22")).toBe(false);
    expect(touchesLocalDay(night, "2026-09-23")).toBe(true);
  });

  test("un blocco che finisce esattamente a mezzanotte non arriva al giorno dopo", () => {
    // 08:00-24:00 CEST del 22.
    const b = block("2026-09-22T06:00:00Z", "2026-09-22T22:00:00Z");
    expect(touchesLocalDay(b, "2026-09-22")).toBe(true);
    expect(touchesLocalDay(b, "2026-09-23")).toBe(false);
  });

  test("un blocco di più giorni copre ogni giorno in mezzo", () => {
    const b = block("2026-09-21T06:00:00Z", "2026-09-24T14:00:00Z");
    for (const d of ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]) expect(touchesLocalDay(b, d)).toBe(true);
    expect(touchesLocalDay(b, "2026-09-25")).toBe(false);
    expect(touchesLocalDay(b, "2026-09-20")).toBe(false);
  });
});

describe("localToday", () => {
  test("è la data italiana, non quella del server", () => {
    expect(localToday(new Date("2026-09-22T22:30:00Z"))).toBe("2026-09-23"); // 00:30 CEST
    expect(localToday(new Date("2026-12-22T22:30:00Z"))).toBe("2026-12-22"); // 23:30 CET
  });
});
