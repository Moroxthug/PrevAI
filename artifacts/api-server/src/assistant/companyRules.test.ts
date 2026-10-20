import { describe, expect, it } from "vitest";
import { FOLLOWUP_DRAFT_DAYS, REMINDER_DRAFT_DAYS, daysBetween, followupDraft, isQuiet, levelsOf, localClock, localDay, nextMonthStart, overLimit, reminderDraft, ruleOf } from "./companyRules.js";

describe("company assistant rules", () => {
  it("a company that chose nothing keeps what the automations always did: follow-ups and reminders go out", () => {
    expect(levelsOf(null)).toEqual({ followups: 1, reminders: 1, receipts: 1, scheduling: 0, crew: 1 });
    expect(levelsOf({ followups: 0, crew: 2 })).toEqual({ followups: 0, reminders: 1, receipts: 1, scheduling: 0, crew: 2 });
    expect(levelsOf({ reminders: 7 as never })).toMatchObject({ reminders: 1 });
  });

  it("a level is a rule", () => {
    expect([ruleOf(0), ruleOf(1), ruleOf(2)]).toEqual(["ask", "send", "off"]);
  });

  it("quiet hours span midnight and Sunday is quiet all day", () => {
    const q = { on: true, from: 20 * 60, until: 7 * 60, sunday: true };
    expect(isQuiet(q, 2, 21 * 60)).toBe(true);
    expect(isQuiet(q, 2, 6 * 60 + 59)).toBe(true);
    expect(isQuiet(q, 2, 12 * 60)).toBe(false);
    expect(isQuiet(q, 0, 12 * 60)).toBe(true);
    expect(isQuiet({ ...q, on: false }, 2, 23 * 60)).toBe(false);
    expect(isQuiet({ on: true, from: 13 * 60, until: 14 * 60, sunday: false }, 3, 13 * 60 + 30)).toBe(true);
  });

  it("the company's clock and day are Rome's", () => {
    const at = new Date("2026-07-05T22:30:00Z"); // Monday 00:30 in Rome (summer time)
    expect(localClock(at, "Europe/Rome")).toEqual({ day: 1, minute: 30 });
    expect(localDay(at, "Europe/Rome")).toBe("2026-07-06");
    expect(nextMonthStart("2026-12-15")).toBe("2027-01-01");
    expect(nextMonthStart("2026-07-06")).toBe("2026-08-01");
  });

  it("the drafts are in Italian, with the amount in euro and the link", () => {
    const r = reminderDraft({ client: "Dana Bianchi", number: "PF-2026-0012", balanceCents: 234000, due: new Date("2026-09-20T10:00:00Z"), link: "https://prevai.it/f/x", who: "Marco" });
    expect(r).toContain("Buongiorno Dana");
    expect(r).toContain("PF-2026-0012");
    expect(r).toMatch(/2\.340,00\s€/);
    expect(r).toContain("20 settembre");
    expect(r).toContain("https://prevai.it/f/x");
    expect(r.endsWith("Grazie, Marco")).toBe(true);
    const f = followupDraft({ client: "", title: "Bagno", link: "https://prevai.it/p/y", who: "Marco" });
    expect(f.startsWith("Buongiorno, le scrivo per il preventivo «Bagno»")).toBe(true);
    expect(f).toContain("https://prevai.it/p/y");
  });

  it("drafts follow the automatic cadence, and an order over the limit asks", () => {
    expect([...REMINDER_DRAFT_DAYS]).toEqual([3, 7, 14]);
    expect(FOLLOWUP_DRAFT_DAYS).toBe(2);
    expect(daysBetween(new Date("2026-10-01T10:00:00Z"), new Date("2026-10-04T09:00:00Z"))).toBe(2);
    expect(daysBetween(new Date("2026-10-05T10:00:00Z"), new Date("2026-10-04T09:00:00Z"))).toBe(0);
    expect(overLimit(30001, 30000)).toBe(true);
    expect(overLimit(30000, 30000)).toBe(false);
  });
});
