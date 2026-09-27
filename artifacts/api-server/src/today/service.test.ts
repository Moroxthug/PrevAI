import { describe, expect, test } from "vitest";
import { daysPastDue, localDay, localDaysBetween, rankNeedsYou, type NeedsYouItem } from "./service.js";

// APP-1 (da QuoteAI Phase 104): "Serve a te" is one list merged from five
// sources, so its order is the whole point.

const item = (kind: NeedsYouItem["kind"], id: string, extra: Partial<NeedsYouItem> = {}): NeedsYouItem => ({ id, kind, title: id, subtitle: "", at: null, href: "/", ...extra });

describe("rankNeedsYou", () => {
  test("money first, then hours, then people waiting", () => {
    const ranked = rankNeedsYou([item("waiting", "q"), item("followup", "l"), item("hours", "h"), item("overdue", "i"), item("bonifico", "b")]);
    expect(ranked.map((i) => i.kind)).toEqual(["bonifico", "overdue", "hours", "followup", "waiting"]);
  });

  test("the most overdue invoice leads its group", () => {
    const ranked = rankNeedsYou([item("overdue", "a", { days: 3 }), item("overdue", "b", { days: 40 }), item("overdue", "c", { days: 12 })]);
    expect(ranked.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  test("the oldest follow-up and the longest-waiting quote first", () => {
    const at = (d: string) => ({ at: `2026-09-${d}T12:00:00Z` });
    expect(rankNeedsYou([item("followup", "late", at("25")), item("followup", "early", at("20"))]).map((i) => i.id)).toEqual(["early", "late"]);
    expect(rankNeedsYou([item("waiting", "recent", at("22")), item("waiting", "long", at("02"))]).map((i) => i.id)).toEqual(["long", "recent"]);
  });

  test("does not reorder the list it was given", () => {
    const input = [item("waiting", "q"), item("bonifico", "b")];
    rankNeedsYou(input);
    expect(input.map((i) => i.id)).toEqual(["q", "b"]);
  });
});

describe("localDay", () => {
  test("a late evening in Italy is already the next day in UTC terms, not in Rome", () => {
    // 23:30 in Rome on the 25th (CEST, UTC+2) = 21:30 UTC.
    expect(localDay(new Date("2026-09-25T21:30:00Z"))).toBe("2026-09-25");
    // 00:30 in Rome on the 26th = 22:30 UTC on the 25th.
    expect(localDay(new Date("2026-09-25T22:30:00Z"))).toBe("2026-09-26");
  });
});

describe("localDaysBetween", () => {
  test("counts Italian calendar days, not 24-hour blocks", () => {
    expect(localDaysBetween(new Date("2026-09-25T06:00:00Z"), new Date("2026-09-25T21:00:00Z"))).toBe(0);
    expect(localDaysBetween(new Date("2026-09-25T21:00:00Z"), new Date("2026-09-25T22:30:00Z"))).toBe(1);
  });
});

describe("daysPastDue", () => {
  const due = new Date("2026-09-25T00:00:00Z"); // due on the 25th (a date-only value)

  test("due today is not late, even late in the evening", () => {
    expect(daysPastDue(due, new Date("2026-09-25T21:00:00Z"))).toBe(0);
  });

  test("just after midnight in Italy it is one day late — not zero", () => {
    expect(daysPastDue(due, new Date("2026-09-25T22:30:00Z"))).toBe(1);
  });
});
