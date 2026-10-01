import { describe, expect, test } from "vitest";
import { collapseShiftEvents, type ShiftEvent } from "./changes.js";

const ME = "w-me";
const OTHER = "w-other";
const at = (m: number) => new Date(Date.UTC(2026, 8, 22, 8, m));
const ev = (e: Partial<ShiftEvent> & Pick<ShiftEvent, "action">): ShiftEvent => ({ blockId: "b1", at: at(0), fromWorker: null, toWorker: null, startsAt: "2026-09-24T06:00:00.000Z", endsAt: "2026-09-24T14:00:00.000Z", ...e });

describe("collapseShiftEvents — cosa significa per un operaio la storia di un turno", () => {
  test("creato su di lui è nuovo; creato su un altro non è niente", () => {
    expect(collapseShiftEvents([ev({ action: "created", fromWorker: ME, toWorker: ME })], ME)?.kind).toBe("shift_added");
    expect(collapseShiftEvents([ev({ action: "created", fromWorker: OTHER, toWorker: OTHER })], ME)).toBeNull();
  });

  test("creato e poi cancellato non è niente", () => {
    expect(collapseShiftEvents([ev({ action: "created", fromWorker: ME, toWorker: ME, at: at(1) }), ev({ action: "deleted", fromWorker: ME, toWorker: ME, at: at(2) })], ME)).toBeNull();
  });

  test("un turno spostato è cambiato; cancellato è tolto", () => {
    expect(collapseShiftEvents([ev({ action: "moved", fromWorker: ME, toWorker: ME })], ME)?.kind).toBe("shift_changed");
    expect(collapseShiftEvents([ev({ action: "updated", fromWorker: ME, toWorker: ME })], ME)?.kind).toBe("shift_changed");
    expect(collapseShiftEvents([ev({ action: "deleted", fromWorker: ME, toWorker: ME })], ME)?.kind).toBe("shift_removed");
  });

  test("passato a un altro è tolto, con dov'era; passato a lui è nuovo", () => {
    const gone = collapseShiftEvents([ev({ action: "moved", fromWorker: ME, toWorker: OTHER, startsAt: "2026-09-25T06:00:00.000Z", endsAt: "2026-09-25T10:00:00.000Z" })], ME);
    expect(gone).toMatchObject({ kind: "shift_removed", startsAt: "2026-09-25T06:00:00.000Z" });
    expect(collapseShiftEvents([ev({ action: "moved", fromWorker: OTHER, toWorker: ME })], ME)?.kind).toBe("shift_added");
  });

  test("via e poi di nuovo suo è un cambio, non una rimozione; conta l'ora, non l'ordine di arrivo", () => {
    const events = [ev({ action: "moved", fromWorker: OTHER, toWorker: ME, at: at(5) }), ev({ action: "moved", fromWorker: ME, toWorker: OTHER, at: at(1) })];
    expect(collapseShiftEvents(events, ME)?.kind).toBe("shift_changed");
    expect(collapseShiftEvents(events, ME)?.at).toEqual(at(5));
  });

  test("nessun evento, nessun verdetto", () => {
    expect(collapseShiftEvents([], ME)).toBeNull();
  });
});
