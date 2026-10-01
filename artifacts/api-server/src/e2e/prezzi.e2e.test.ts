// PREZZI-1 (docs/PIANO-AZIONE.md riga 53, da QuoteAI fase 79) — il controllo
// prezzi del preventivo: voci che si discostano dal listino, sotto l'ultimo
// costo, «Riprezza» con i totali ricalcolati, blocco dopo l'accettazione e
// confini fra imprese e fra ruoli.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, auditLogTable, priceCatalogItemsTable, priceIntelligenceTable, quotesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, cleanupAll, seedQuote, type TestUser } from "./harness.js";

async function viewerOf(owner: TestUser): Promise<TestUser> {
  const email = `e2e-viewer-${owner.userId}@example.invalid`;
  const invite = await owner.api("/api/team/members/invite", { body: { email, role: "viewer" } });
  expect(invite.status, JSON.stringify(invite.body)).toBe(201);
  const token = invite.body.url.split("/team-invite/")[1];
  const user = await createUser({ email, name: "Lettore" });
  expect((await user.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);
  return user;
}

describe("PREZZI-1 — controllo prezzi del preventivo", () => {
  let owner: TestUser;
  let other: TestUser;
  let viewer: TestUser;
  let quoteId: string;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Prezzi Srl" });
    other = await createOrg({ companyName: "Altra Srl" });
    viewer = await viewerOf(owner);

    await db.insert(priceCatalogItemsTable).values([
      { userId: owner.userId, nome: "Pittura pareti", um: "mq", prezzoUnitario: "10.00" },
      { userId: owner.userId, nome: "Cartongesso lastre", um: "mq", prezzoUnitario: "14.00" },
    ]);
    // tre scontrini di piastrelle a 54 €/mq
    await db.insert(priceIntelligenceTable).values([54, 54, 54].map((p) => ({ userId: owner.userId, workType: "Piastrelle 60x60", unitPrice: String(p), unit: "mq", vendor: "Bricoman" })));

    const q = await seedQuote(owner.userId);
    quoteId = q.id;
    await db.update(quotesTable).set({
      capitoli: [{ lettera: "A", titolo: "Finiture", subtotale: 0, voci: [
        { descrizione: "Pittura pareti", um: "mq", quantita: 100, prezzoUnitario: 8, totale: 800 }, // listino 10: +25 %
        { descrizione: "Cartongesso lastre", um: "mq", quantita: 40, prezzoUnitario: 13.9, totale: 556 }, // +0,7 %: sotto soglia
        { descrizione: "Piastrelle gres 60x60", um: "mq", quantita: 50, prezzoUnitario: 50, totale: 2500 }, // costo 54: sotto costo
        { descrizione: "Pulizia", um: "a corpo", quantita: 1, prezzoUnitario: 300, totale: 300 },
      ] }],
      subtotale: "4156", ivaPercentuale: "22", ivaValore: "914.32", totale: "5070.32", sconto: null, pdfUrl: "https://example.invalid/old.pdf",
    }).where(eq(quotesTable.id, quoteId));
  });

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("segnala la voce lontana dal listino e quella sotto costo, non le altre", async () => {
    const r = await owner.api(`/api/quotes/${quoteId}/price-check`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.editable).toBe(true);
    expect(r.body.linesChecked).toBe(4);
    expect(r.body.belowCostCount).toBe(1);
    const f = r.body.findings as { index: number; source: string; referenceUnitPrice: number; belowCost: boolean; marginPct: number | null; changePct: number }[];
    expect(f.map((x) => [x.index, x.source, x.referenceUnitPrice, x.belowCost])).toEqual([[0, "listino", 10, false], [2, "scontrini", 54, true]]);
    expect(f[1]!.marginPct).toBe(-8);
    expect(f[0]!.changePct).toBe(25);
  });

  test("un'altra impresa non lo vede", async () => {
    expect((await other.api(`/api/quotes/${quoteId}/price-check`)).status).toBe(404);
    expect((await other.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [{ chapter: "A", index: 0, unitPrice: 10 }] } })).status).toBe(404);
  });

  test("il lettore guarda ma non riprezza", async () => {
    expect((await viewer.api(`/api/quotes/${quoteId}/price-check`)).status).toBe(200);
    expect((await viewer.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [{ chapter: "A", index: 0, unitPrice: 10 }] } })).status).toBe(403);
  });

  test("voci inesistenti o prezzi assurdi sono rifiutati", async () => {
    expect((await owner.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [{ chapter: "Z", index: 0, unitPrice: 10 }] } })).status).toBe(400);
    expect((await owner.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [{ chapter: "A", index: 9, unitPrice: 10 }] } })).status).toBe(400);
    expect((await owner.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [{ chapter: "A", index: 0, unitPrice: -1 }] } })).status).toBe(400);
    expect((await owner.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [] } })).status).toBe(400);
  });

  test("riprezza: totali ricalcolati sul server, PDF azzerato, traccia nel registro", async () => {
    const r = await owner.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [{ chapter: "A", index: 0, unitPrice: 10 }, { chapter: "A", index: 2, unitPrice: 54 }] } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.applied).toBe(2);
    // 1000 + 556 + 2700 + 300 = 4556; IVA 22 % = 1002,32; totale 5558,32
    expect(r.body.totale).toEqual({ from: 5070.32, to: 5558.32 });
    const [row] = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId));
    expect(Number(row!.subtotale)).toBe(4556);
    expect(Number(row!.ivaValore)).toBe(1002.32);
    expect(Number(row!.totale)).toBe(5558.32);
    expect(row!.pdfUrl).toBeNull();
    const audit = await db.select().from(auditLogTable).where(and(eq(auditLogTable.entityId, quoteId), eq(auditLogTable.action, "repriced")));
    expect(audit).toHaveLength(1);

    const after = await owner.api(`/api/quotes/${quoteId}/price-check`);
    expect(after.body.findings).toEqual([]);
  });

  test("dopo l'accettazione non si riprezza più", async () => {
    await db.update(quotesTable).set({ status: "accepted" }).where(eq(quotesTable.id, quoteId));
    const check = await owner.api(`/api/quotes/${quoteId}/price-check`);
    expect(check.body.editable).toBe(false);
    const r = await owner.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [{ chapter: "A", index: 0, unitPrice: 9 }] } });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("LOCKED");
  });
});
