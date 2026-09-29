import { describe, test, expect, beforeAll } from "vitest";
import { portalToken, portalUrl, hashToken, maskEmail, otpHash, otpMatches, contractCanSign } from "./service.js";
import { clientPagePath } from "./messages.js";

beforeAll(() => {
  process.env.INVOICE_LINK_SECRET ??= "unit-test-secret";
});

describe("link del portale", () => {
  test("è deterministico per cliente e cambia tra clienti e imprese", () => {
    const a = portalToken({ id: "11111111-1111-1111-1111-111111111111", userId: "u1" });
    expect(portalToken({ id: "11111111-1111-1111-1111-111111111111", userId: "u1" })).toBe(a);
    expect(portalToken({ id: "22222222-2222-2222-2222-222222222222", userId: "u1" })).not.toBe(a);
    expect(portalToken({ id: "11111111-1111-1111-1111-111111111111", userId: "u2" })).not.toBe(a);
    expect(a).toMatch(/^[A-Za-z0-9_-]{40,}$/); // base64url senza padding: sta in un segmento di percorso
    expect(portalUrl(a)).toMatch(new RegExp(`/portal/${a}$`));
    expect(hashToken(a)).toHaveLength(64);
  });
});

describe("email mascherata", () => {
  test("tiene i primi due caratteri e il dominio", () => {
    expect(maskEmail("cliente@example.com")).toBe("cl•••@example.com");
    expect(maskEmail("a@b.co")).toBe("a@b.co"); // troppo corta: servono due caratteri davanti
  });
});

describe("codice di accesso", () => {
  const portal = { clientId: "c1", otpHash: otpHash("c1", "123456") };
  test("vale solo il codice salvato, e mai senza codice", () => {
    expect(otpMatches(portal, "123456")).toBe(true);
    expect(otpMatches(portal, "123457")).toBe(false);
    expect(otpMatches({ clientId: "c2", otpHash: portal.otpHash }, "123456")).toBe(false); // legato all'id del cliente
    expect(otpMatches({ clientId: "c1", otpHash: null }, "123456")).toBe(false);
  });
});

describe("'firma ora' dal portale", () => {
  const future = new Date(Date.now() + 86_400_000);
  const signer = { email: "Cliente@Example.com", status: "pending" };
  test("solo un contratto inviato o visto, non scaduto, il cui firmatario è la casella del cliente", () => {
    expect(contractCanSign({ status: "sent", expiresAt: future }, signer, "cliente@example.com")).toBe(true);
    expect(contractCanSign({ status: "viewed", expiresAt: null }, signer, "cliente@example.com")).toBe(true);
    expect(contractCanSign({ status: "signed", expiresAt: future }, signer, "cliente@example.com")).toBe(false);
    expect(contractCanSign({ status: "sent", expiresAt: new Date(Date.now() - 1000) }, signer, "cliente@example.com")).toBe(false);
    expect(contractCanSign({ status: "sent", expiresAt: future }, signer, "altro@example.com")).toBe(false);
    expect(contractCanSign({ status: "sent", expiresAt: future }, { ...signer, status: "declined" }, "cliente@example.com")).toBe(false);
    expect(contractCanSign({ status: "sent", expiresAt: future }, undefined, "cliente@example.com")).toBe(false);
    expect(contractCanSign({ status: "sent", expiresAt: future }, signer, null)).toBe(false);
  });
});

describe("indirizzo della pagina del cliente", () => {
  test("è l'md5 della dedup key, come il raggruppamento dei preventivi", () => {
    expect(clientPagePath({ dedupKey: "mario rossi|mario@example.com|3331234567" })).toMatch(/^[0-9a-f]{32}$/);
  });
});
