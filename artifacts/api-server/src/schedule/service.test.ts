import { describe, test, expect } from "vitest";
import { findConflicts, reminderDue, reminderBody, localParts } from "./service.js";

const at = (iso: string) => new Date(iso);

describe("schedule conflicts", () => {
  test("same worker + overlapping intervals conflict; touching ends and other workers do not", () => {
    const a = { id: "a", collaboratorId: "w1", startsAt: at("2026-09-22T12:00:00Z"), endsAt: at("2026-09-22T20:00:00Z") };
    const b = { id: "b", collaboratorId: "w1", startsAt: at("2026-09-22T16:00:00Z"), endsAt: at("2026-09-22T22:00:00Z") };
    const c = { id: "c", collaboratorId: "w1", startsAt: at("2026-09-22T20:00:00Z"), endsAt: at("2026-09-22T23:00:00Z") }; // starts when a ends
    const d = { id: "d", collaboratorId: "w2", startsAt: at("2026-09-22T12:00:00Z"), endsAt: at("2026-09-22T20:00:00Z") }; // other worker
    const e = { id: "e", collaboratorId: null, startsAt: at("2026-09-22T12:00:00Z"), endsAt: at("2026-09-22T20:00:00Z") }; // unassigned
    const map = findConflicts([a, b, c, d, e]);
    expect(map.get("a")).toEqual(["b"]);
    expect(map.get("b")?.sort()).toEqual(["a", "c"]);
    expect(map.get("c")).toEqual(["b"]);
    expect(map.has("d")).toBe(false);
    expect(map.has("e")).toBe(false);
  });
});

describe("reminder window (ora italiana)", () => {
  // 2026-09-22 08:00 a Roma (CEST, UTC+2) = 06:00Z: il turno del martedì.
  const block = { startsAt: at("2026-09-22T06:00:00Z"), reminderSentAt: null };

  test("lunedì 14:59 → non ancora; 15:00 → 'tomorrow'; il cron delle 16:00Z (18:00) lo manda", () => {
    expect(reminderDue(block, at("2026-09-21T12:59:00Z"))).toBeNull();
    expect(reminderDue(block, at("2026-09-21T13:00:00Z"))).toBe("tomorrow");
    expect(reminderDue(block, at("2026-09-21T16:00:00Z"))).toBe("tomorrow");
    // D'inverno (CET, UTC+1) il cron delle 16:00Z è alle 17:00: sempre dopo le 15.
    expect(reminderDue({ startsAt: at("2026-12-02T07:00:00Z"), reminderSentAt: null }, at("2026-12-01T16:00:00Z"))).toBe("tomorrow");
  });

  test("la mattina stessa → 'today'; dopo l'inizio, già mandato o fra due giorni → niente", () => {
    expect(reminderDue(block, at("2026-09-22T04:00:00Z"))).toBe("today");
    expect(reminderDue(block, at("2026-09-22T06:30:00Z"))).toBeNull();
    expect(reminderDue({ ...block, reminderSentAt: at("2026-09-21T16:05:00Z") }, at("2026-09-21T17:00:00Z"))).toBeNull();
    expect(reminderDue(block, at("2026-09-20T16:00:00Z"))).toBeNull();
  });

  test("giorno e ora seguono Roma, non UTC", () => {
    // 22:30Z del 21 settembre è già la mezzanotte e mezza del 22 in Italia.
    expect(localParts(at("2026-09-21T22:30:00Z"))).toEqual({ day: "2026-09-22", hour: 0 });
    expect(localParts(at("2026-12-21T23:30:00Z"))).toEqual({ day: "2026-12-22", hour: 0 });
  });
});

describe("reminder body", () => {
  const block = { title: "", startsAt: at("2026-09-22T05:30:00Z"), endsAt: at("2026-09-22T14:30:00Z"), allDay: false, notes: "Cancello: codice 4471." };
  test("domani, orari locali, cantiere + indirizzo, note", () => {
    expect(reminderBody({ kind: "tomorrow", block, jobName: "Bagno Rossi", address: "Via Roma 12, Bergamo" })).toBe("Domani 07:30-16:30: Bagno Rossi, Via Roma 12, Bergamo. Cancello: codice 4471.");
  });
  test("oggi, tutto il giorno, senza cantiere → etichetta di ripiego", () => {
    expect(reminderBody({ kind: "today", block: { ...block, allDay: true, notes: "" }, jobName: null, address: null })).toBe("Oggi tutto il giorno: Turno.");
  });
  test("il titolo del blocco vince sul nome del cantiere", () => {
    expect(reminderBody({ kind: "today", block: { ...block, title: "Ritiro materiale", notes: "" }, jobName: "Bagno Rossi", address: null })).toBe("Oggi 07:30-16:30: Ritiro materiale.");
  });
});
