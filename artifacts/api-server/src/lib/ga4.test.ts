import { describe, expect, it } from "vitest";
import { ga4PurchasePayload, gaClientIdFromCookie } from "./ga4";

describe("gaClientIdFromCookie", () => {
  it("reads the client id out of the _ga cookie", () => {
    expect(gaClientIdFromCookie("foo=1; _ga=GA1.1.123456789.1700000000; _ga_D2B39E0ELW=GS1.1.x")).toBe("123456789.1700000000");
    expect(gaClientIdFromCookie("_ga=GA1.2.42.99")).toBe("42.99");
  });
  it("ignores look-alike cookies and missing headers", () => {
    expect(gaClientIdFromCookie("_ga_D2B39E0ELW=GS1.1.123.456")).toBeUndefined();
    expect(gaClientIdFromCookie(undefined)).toBeUndefined();
  });
});

describe("ga4PurchasePayload", () => {
  it("builds a purchase in euros under the browser's client id", () => {
    const p = ga4PurchasePayload({ clientId: "1.2", userId: "u1", transactionId: "cs_1", valueCents: 2400, currency: "eur", itemId: "monthly_mastro" });
    expect(p.client_id).toBe("1.2");
    expect(p.user_id).toBe("u1");
    expect(p.events[0]).toEqual({
      name: "purchase",
      params: { transaction_id: "cs_1", value: 24, currency: "EUR", items: [{ item_id: "monthly_mastro", item_name: "monthly_mastro", quantity: 1 }] },
    });
  });
  it("falls back to a server client id when the cookie was absent", () => {
    expect(ga4PurchasePayload({ clientId: undefined, userId: "u1", transactionId: "cs_2", valueCents: null, currency: null, itemId: "x" }).client_id).toBe("srv.u1");
  });
});
