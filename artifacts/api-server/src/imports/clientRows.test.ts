import { describe, expect, it } from "vitest";
import { phoneOk, planClientRows, type ExistingClient } from "./clientRows.js";

const existing: ExistingClient[] = [
  { id: "c1", name: "Dana Bianchi", email: "dana.b@libero.it", phone: "333 123 4567", dedupKey: "dana bianchi|dana.b@libero.it|333 123 4567" },
  { id: "c2", name: "Tommaso e Lena Rossi", email: null, phone: "+39 02 1234567", dedupKey: "tommaso e lena rossi||+39 02 1234567" },
];

describe("planClientRows", () => {
  it("adds a clean row, skips one already there and one repeated in the file", () => {
    const p = planClientRows([
      { row: 2, name: "Condominio Verdi", phone: "347 555 0199" },
      { row: 3, name: "Dana Bianchi", email: "dana.b@libero.it", phone: "333 123 4567" },
      { row: 4, name: "Condominio Verdi", phone: "347 555 0199" },
    ], existing);
    expect(p.clean.map((r) => r.row)).toEqual([2]);
    expect(p.skipped).toBe(2);
    expect(p.matches).toEqual([]);
  });
  it("flags a different name with the same email or phone as a match to review, with or without +39", () => {
    const p = planClientRows([{ row: 5, name: "Priya Nair", email: "DANA.B@libero.it" }, { row: 6, name: "T. Rossi", phone: "02 1234567" }], existing);
    expect(p.matches).toEqual([
      { row: 5, name: "Priya Nair", existingId: "c1", existingName: "Dana Bianchi", why: "email" },
      { row: 6, name: "T. Rossi", existingId: "c2", existingName: "Tommaso e Lena Rossi", why: "phone" },
    ]);
    expect(p.clean).toEqual([]);
  });
  it("reports a row without a name, a short phone or a bad email", () => {
    const p = planClientRows([{ row: 1, name: " ", email: "a@b.it" }, { row: 2, name: "Panificio Marchetti", phone: "333-55" }, { row: 3, name: "Gilli", email: "gilli.example.com" }], existing);
    expect(p.errors).toEqual([{ row: 1, name: "", why: "no_name" }, { row: 2, name: "Panificio Marchetti", why: "short_phone" }, { row: 3, name: "Gilli", why: "bad_email" }]);
  });
  it("accepts an Italian mobile or landline, with or without the country code", () => {
    expect(phoneOk("333 123 4567")).toBe(true);
    expect(phoneOk("+39 333 1234567")).toBe(true);
    expect(phoneOk("0039 02 1234567")).toBe(true);
    expect(phoneOk("123")).toBe(false);
    expect(phoneOk(undefined)).toBe(false);
  });
});
