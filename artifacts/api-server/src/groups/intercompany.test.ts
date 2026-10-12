import { describe, expect, it } from "vitest";
import { matchGroupCompany, normalizeCompanyName, partitaIva11, type GroupCompanyKey } from "./intercompany.js";

const companies: GroupCompanyKey[] = [
  { orgId: "a", name: "Rossi Edilizia Srl", email: "a@rossi.it", businessNumber: "IT01234567890" },
  { orgId: "b", name: "Rossi Costruzioni S.r.l.", email: null, businessNumber: "09876543210" },
  { orgId: "c", name: "Bianchi Impianti", email: "info@bianchi.it", businessNumber: null },
];

describe("lavoro fra imprese dello stesso gruppo", () => {
  it("la partita IVA, con o senza IT e spazi", () => {
    expect(partitaIva11("IT 01234567890")).toBe("01234567890");
    expect(partitaIva11("1234")).toBeNull();
    expect(partitaIva11(null)).toBeNull();
  });
  it("il nome senza la forma societaria", () => {
    expect(normalizeCompanyName("Rossi Edilizia S.r.l.")).toBe("rossi edilizia");
    expect(normalizeCompanyName("Rossi & Figli S.n.c.")).toBe("rossi e figli");
    expect(normalizeCompanyName("Bianchi Impianti")).toBe("bianchi impianti");
  });
  it("prima la P. IVA, poi l'email, poi il nome; mai se stessa", () => {
    expect(matchGroupCompany({ name: "Altro nome", businessNumber: "01234567890" }, companies, "c")).toBe("a");
    expect(matchGroupCompany({ name: "x", email: "INFO@bianchi.it" }, companies, "a")).toBe("c");
    expect(matchGroupCompany({ name: "Rossi Costruzioni" }, companies, "a")).toBe("b");
    expect(matchGroupCompany({ businessNumber: "01234567890" }, companies, "a")).toBeNull();
    expect(matchGroupCompany({ name: "Cliente qualunque" }, companies, "a")).toBeNull();
  });
});
