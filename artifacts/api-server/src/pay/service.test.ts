import { describe, expect, it } from "vitest";
import { addDays, periodOf, splitOvertime, weekStart } from "./service.js";

const e = (id: string, date: string, hours: number, workerId = "w1") => ({ id, workerId, projectId: "p", date, hours, rate: 1000, burden: 0 });

describe("periodi di paga", () => {
  it("il lunedì della settimana", () => {
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // domenica
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekStart("2026-10-07")).toBe("2026-10-05");
  });
  it("mensile: il mese intero, anche febbraio", () => {
    expect(periodOf("2026-10-11", { frequency: "monthly", anchorDate: "2026-01-05" })).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(periodOf("2028-02-10", { frequency: "monthly", anchorDate: "2026-01-05" })).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
  it("settimanale e ogni due settimane partono dal lunedì", () => {
    expect(periodOf("2026-10-11", { frequency: "weekly", anchorDate: "2026-01-05" })).toEqual({ start: "2026-10-05", end: "2026-10-11" });
    const p = periodOf("2026-10-11", { frequency: "biweekly", anchorDate: "2026-01-05" });
    expect(p.end).toBe(addDays(p.start, 13));
    expect(new Date(`${p.start}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(p.start <= "2026-10-11" && "2026-10-11" <= p.end).toBe(true);
  });
});

describe("straordinario", () => {
  it("senza soglia tutto è ordinario", () => {
    expect(splitOvertime([e("a", "2026-10-05", 50)], null)[0]).toMatchObject({ regular: 50, overtime: 0 });
  });
  it("oltre la soglia della settimana: le ore dell'ultimo giorno sono straordinario, e la settimana dopo riparte", () => {
    const s = splitOvertime([e("a", "2026-10-05", 20), e("b", "2026-10-06", 15), e("c", "2026-10-07", 8), e("d", "2026-10-12", 8)], 40);
    expect(s.map((x) => [x.id, x.regular, x.overtime])).toEqual([["a", 20, 0], ["b", 15, 0], ["c", 5, 3], ["d", 8, 0]]);
  });
  it("ogni operaio ha la sua soglia", () => {
    const s = splitOvertime([e("a", "2026-10-05", 30, "w1"), e("b", "2026-10-05", 30, "w2"), e("c", "2026-10-06", 15, "w1")], 40);
    expect(s.find((x) => x.id === "c")).toMatchObject({ regular: 10, overtime: 5 });
    expect(s.find((x) => x.id === "b")).toMatchObject({ regular: 30, overtime: 0 });
  });
});
