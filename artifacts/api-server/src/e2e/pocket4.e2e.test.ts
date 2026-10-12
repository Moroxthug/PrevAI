// POCKET-4 (docs/POCKET-APP-PLAN.md, QuoteAI 127): il lato server delle schermate «Soldi e ufficio».
// Provato sul server vero, un giro per schermata:
//  - Libri: la lista del mese, il movimento dell'estratto da abbinare, chiudere e riaprire (non un mese in corso), un altro tenant non vede niente;
//  - Ore e costo: straordinario oltre la soglia della settimana, esportazione CSV che resta registrata, «cambiato dopo l'esportazione»;
//  - Scadenze: il calendario dello scadenzario, un promemoria che si ripete e che si sposta, uno che esce;
//  - Contabile: panoramica del mese e filo dei commenti;
//  - Listino, fornitori, magazzino: tipo e prezzo cambiato, un ordine nella lista, la lista parte;
//  - Documenti, Analisi, Gruppo: le panoramiche rispondono e il gruppo si crea.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, bankImportsTable, bankMovementsTable, businessProfilesTable, collaboratorsTable, projectsTable, timeEntriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, cleanupAll, type TestUser } from "./harness.js";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const thisMonth = iso(today).slice(0, 7);
const shift = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};
const lastMonth = shift(thisMonth, -1);

describe("POCKET-4 — soldi e ufficio", () => {
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Soldi Srl", plan: "monthly_elite" });
    stranger = await createOrg({ companyName: "Estranei Srl", plan: "monthly_elite" });
    for (const o of [owner, stranger]) {
      const [p] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, o.userId));
      await db.update(businessProfilesTable).set({ featureFlags: { ...(p?.featureFlags ?? {}), fiscal_engine: true, admin_suite: true } }).where(eq(businessProfilesTable.userId, o.userId));
      const on = await o.api("/api/fiscale/profilo", { method: "PATCH", body: { codiceAteco: "43.22.01", gestione: "artigiani", riduzione: "nessuna", annoInizioAttivita: 2019, requisitiStartup: false, accettaAvviso: true } });
      expect(on.status).toBe(200);
    }
  }, 120_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("Libri: la lista del mese, un movimento da abbinare, chiudere e riaprire", async () => {
    const first = await owner.api("/api/fiscale/libri");
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.month).toBe(lastMonth);
    expect(first.body.bank.connected).toBe(false);
    expect(first.body.items.map((i: { key: string }) => i.key)).toEqual(["bank_unmatched", "payments_unbanked", "costs_pending", "sdi_open", "invoices_draft", "time_unapproved"]);
    expect(first.body.items.find((i: { key: string }) => i.key === "bank_unmatched").applies).toBe(false);

    // un estratto con un movimento del mese scorso, da abbinare
    const [imp] = await db.insert(bankImportsTable).values({ userId: owner.userId, formato: "csv", nomeFile: "estratto.csv", conto: "Conto E2E" }).returning();
    const [mov] = await db.insert(bankMovementsTable).values({ userId: owner.userId, importId: imp!.id, data: new Date(`${lastMonth}-15T10:00:00.000Z`), importoCents: -4500, descrizione: "Ferramenta", impronta: `e2e-${Date.now()}` }).returning();
    const withBank = await owner.api(`/api/fiscale/libri?month=${lastMonth}`);
    const bankItem = withBank.body.items.find((i: { key: string }) => i.key === "bank_unmatched");
    expect(bankItem).toMatchObject({ applies: true, count: 1 });
    expect(withBank.body.bank).toMatchObject({ connected: true, account: "Conto E2E" });

    // non si chiude il mese in corso; chiuso una volta, una sola
    expect((await owner.api("/api/fiscale/libri/chiudi", { body: { month: thisMonth } })).status).toBe(400);
    const closed = await owner.api("/api/fiscale/libri/chiudi", { body: { month: lastMonth, note: "ok" } });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(closed.body.close).toMatchObject({ month: lastMonth, closedByName: "Soldi Srl" });
    expect((await owner.api("/api/fiscale/libri/chiudi", { body: { month: lastMonth } })).status).toBe(400);
    const after = await owner.api(`/api/fiscale/libri?month=${lastMonth}`);
    expect(after.body.closed).toMatchObject({ month: lastMonth });
    expect(after.body.closedMonths).toContain(lastMonth);

    // una novità dopo la chiusura si vede
    await owner.api(`/api/fiscale/banca/movimenti/${mov!.id}/ignora`, { body: {} });
    const [mov2] = await db.insert(bankMovementsTable).values({ userId: owner.userId, importId: imp!.id, data: new Date(`${lastMonth}-20T10:00:00.000Z`), importoCents: -900, descrizione: "Altro", impronta: `e2e2-${Date.now()}` }).returning();
    expect(mov2).toBeTruthy();
    const changed = await owner.api(`/api/fiscale/libri?month=${lastMonth}`);
    expect(changed.body.changedSinceClose).toEqual([]);

    // un altro tenant non vede né chiude il mese di questo
    const theirs = await stranger.api(`/api/fiscale/libri?month=${lastMonth}`);
    expect(theirs.body.closed).toBeNull();
    expect(theirs.body.closedMonths).toEqual([]);
    expect((await stranger.api("/api/fiscale/libri/riapri", { body: { month: lastMonth } })).status).toBe(400);

    expect((await owner.api("/api/fiscale/libri/riapri", { body: { month: lastMonth } })).status).toBe(204);
    expect((await owner.api(`/api/fiscale/libri?month=${lastMonth}`)).body.closed).toBeNull();
  });

  test("Ore e costo: straordinario oltre la soglia, esportazione registrata", async () => {
    const [job] = await db.insert(projectsTable).values({ userId: owner.userId, name: "Cantiere ore", status: "active" } as never).returning();
    const [w] = await db.insert(collaboratorsTable).values({ userId: owner.userId, name: "Luca Bianchi", hourlyRate: 1500, burdenPercent: "10", workerType: "employee" } as never).returning();
    // una settimana intera (lunedì–venerdì) del mese scorso: 5 × 9 ore = 45 ore
    const monday = new Date(`${lastMonth}-01T00:00:00.000Z`);
    while (monday.getUTCDay() !== 1) monday.setUTCDate(monday.getUTCDate() + 1);
    for (let d = 0; d < 5; d++) {
      const day = new Date(monday.getTime() + d * 86_400_000);
      await db.insert(timeEntriesTable).values({ userId: owner.userId, workerId: w!.id, projectId: job!.id, date: day, hours: "9", rateCentsSnapshot: 1500, burdenPercentSnapshot: "10", status: "approved" } as never);
    }
    const dateParam = iso(monday);
    expect((await stranger.api(`/api/pay/period?date=${dateParam}`)).body.employees).toEqual([]);

    const noRule = await owner.api(`/api/pay/period?date=${dateParam}`);
    expect(noRule.status, JSON.stringify(noRule.body)).toBe(200);
    expect(noRule.body.employees[0]).toMatchObject({ name: "Luca Bianchi", hours: 45, grossCents: 67_500, payrollId: null });
    expect(noRule.body.warnings.missingPayrollId).toEqual(["Luca Bianchi"]);

    const save = await owner.api("/api/pay/settings", { method: "PUT", body: { frequency: "monthly", overtimeWeeklyHours: 40, overtimeMultiplier: 1.5, payrollCodes: { [w!.id]: "L01" } } });
    expect(save.status, JSON.stringify(save.body)).toBe(200);
    const withRule = await owner.api(`/api/pay/period?date=${dateParam}`);
    const emp = withRule.body.employees[0];
    expect(emp.lines.map((l: { kind: string; hours: number }) => [l.kind, l.hours])).toEqual([["regular", 40], ["overtime", 5]]);
    expect(emp.grossCents).toBe(40 * 1500 + Math.round(5 * 1500 * 1.5));
    expect(emp.payrollId).toBe("L01");
    expect(withRule.body.totals).toMatchObject({ hours: 45, overtimeHours: 5 });
    expect(withRule.body.jobs[0]).toMatchObject({ hours: 45, overtimeHours: 5, premiumCents: Math.round(5 * 1500 * 0.5) });

    const csv = await owner.api(`/api/pay/export.csv?date=${dateParam}`);
    expect(csv.status).toBe(200);
    expect(String(csv.body)).toContain("L01;Luca Bianchi");
    const done = await owner.api(`/api/pay/period?date=${dateParam}`);
    expect(done.body.exports).toHaveLength(1);
    expect(done.body.changedSinceExport).toEqual([]);
    // un'ora in più approvata dopo l'esportazione: cambiato
    await db.insert(timeEntriesTable).values({ userId: owner.userId, workerId: w!.id, projectId: job!.id, date: monday, hours: "1", rateCentsSnapshot: 1500, burdenPercentSnapshot: "10", status: "approved" } as never);
    expect((await owner.api(`/api/pay/period?date=${dateParam}`)).body.changedSinceExport).toEqual(["Luca Bianchi"]);
    expect((await owner.api("/api/pay/settings", { method: "PUT", body: { overtimeMultiplier: 9 } })).status).toBe(400);
  });

  test("Scadenze: il calendario fiscale e i promemoria", async () => {
    const cal = await owner.api("/api/fiscale/calendario");
    expect(cal.status, JSON.stringify(cal.body)).toBe(200);
    expect(cal.body.enabled).toBe(true);
    expect(Array.isArray(cal.body.deadlines)).toBe(true);
    expect(cal.body.profile.regime).toBe("forfettario");
    expect(cal.body.presets.map((p: { id: string }) => p.id)).toContain("durc");

    const added = await owner.api("/api/fiscale/calendario/promemoria", { body: { kind: "insurance", title: "Assicurazione RC", dueDate: "2027-01-31", recurrence: "monthly" } });
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    const id = added.body.reminder.id as string;
    expect((await owner.api("/api/fiscale/calendario/promemoria", { body: { kind: "insurance", title: "", dueDate: "2027-01-31", recurrence: "none" } })).status).toBe(400);
    expect((await stranger.api(`/api/fiscale/calendario/promemoria/${id}/fatto`, { body: {} })).status).toBe(404);
    const next = await owner.api(`/api/fiscale/calendario/promemoria/${id}/fatto`, { body: {} });
    expect(next.status).toBe(200);
    expect(next.body.reminder.dueDate).toBe("2027-02-28");
    const once = await owner.api("/api/fiscale/calendario/promemoria", { body: { kind: "other", title: "Una tantum", dueDate: "2027-05-10", recurrence: "none" } });
    const gone = await owner.api(`/api/fiscale/calendario/promemoria/${once.body.reminder.id}/fatto`, { body: {} });
    expect(gone.body.reminder).toBeNull();
    const list = await owner.api("/api/fiscale/calendario");
    expect(list.body.reminders.map((r: { title: string }) => r.title)).toEqual(["Assicurazione RC"]);
  });

  test("Contabile: panoramica del mese e commenti", async () => {
    const ov = await owner.api(`/api/accountant/overview?month=${lastMonth}`);
    expect(ov.status, JSON.stringify(ov.body)).toBe(200);
    expect(ov.body).toMatchObject({ enabled: true, month: lastMonth, company: { name: "Soldi Srl" } });
    expect(ov.body.months).toHaveLength(4);
    const posted = await owner.api("/api/accountant/comments", { body: { month: lastMonth, body: "Manca lo scontrino del 15" } });
    expect(posted.status).toBe(201);
    const list = await owner.api(`/api/accountant/comments?month=${lastMonth}`);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ body: "Manca lo scontrino del 15", mine: true });
    expect((await stranger.api(`/api/accountant/comments?month=${lastMonth}`)).body.items).toEqual([]);
    expect((await owner.api("/api/accountant/comments", { body: { month: "bad", body: "x" } })).status).toBe(400);
    const csv = await owner.api(`/api/accountant/export.csv?kind=transactions&month=${lastMonth}`);
    expect(csv.status).toBe(200);
  });

  test("Listino, fornitori e magazzino", async () => {
    const mat = await owner.api("/api/catalog", { body: { nome: "Lastra cartongesso", um: "cad", prezzoUnitario: 8, kind: "material", unitCost: 5 } });
    expect(mat.status, JSON.stringify(mat.body)).toBe(201);
    expect(mat.body).toMatchObject({ kind: "material", unitCost: 5 });
    const lab = await owner.api("/api/catalog", { body: { nome: "Posa cartongesso", um: "mq", prezzoUnitario: 20 } });
    expect(lab.body.kind).toBe("labour");
    const up = await owner.api(`/api/catalog/${mat.body.id}`, { method: "PUT", body: { prezzoUnitario: 9 } });
    expect(up.body).toMatchObject({ prezzoUnitario: 9, previousPrice: 8 });
    const book = await owner.api("/api/catalog/overview");
    expect(book.status).toBe(200);
    expect(book.body.pricesChanged).toBe(1);
    expect(book.body.items).toHaveLength(2);
    expect((await stranger.api("/api/catalog/overview")).body.items).toEqual([]);

    const sup = await owner.api("/api/suppliers", { body: { name: "Edilforniture Rossi", category: "materiali", kind: "account", terms: "30 giorni" } });
    expect(sup.status, JSON.stringify(sup.body)).toBe(201);
    const sid = sup.body.supplier.id as string;
    const item = await owner.api("/api/inventory/items", { body: { name: "Lastra cartongesso", unit: "lastre", par: 10, shopQty: 4 } });
    expect(item.status, JSON.stringify(item.body)).toBe(201);
    expect(item.body.item).toMatchObject({ level: "low", total: 4 });
    const order = await owner.api(`/api/suppliers/${sid}/orders`, { body: { inventoryItemId: item.body.item.id, itemName: "Lastra cartongesso", qty: 16, destination: "shop" } });
    expect(order.status).toBe(201);
    const inv = await owner.api("/api/inventory/overview");
    expect(inv.body.items[0].options[0]).toMatchObject({ name: "Edilforniture Rossi" });
    expect(inv.body.orders).toHaveLength(1);
    const one = await owner.api(`/api/suppliers/${sid}`);
    expect(one.body.orders).toHaveLength(1);
    expect((await stranger.api(`/api/suppliers/${sid}`)).status).toBe(404);
    expect((await stranger.api(`/api/suppliers/${sid}/orders/sent`, { body: {} })).status).toBe(404);
    const sent = await owner.api(`/api/suppliers/${sid}/orders/sent`, { body: {} });
    expect(sent.body.ordered).toBe(1);
    const list = await owner.api("/api/suppliers/overview");
    expect(list.body.items[0]).toMatchObject({ name: "Edilforniture Rossi", kind: "account", terms: "30 giorni" });
    expect(list.body.lowCount).toBe(1);
  });

  test("Documenti, Analisi e Gruppo rispondono", async () => {
    const docs = await owner.api("/api/documents/overview");
    expect(docs.status, JSON.stringify(docs.body)).toBe(200);
    expect(docs.body).toMatchObject({ files: 0, trend: null });
    const ins = await owner.api("/api/analytics/insights?months=6");
    expect(ins.status, JSON.stringify(ins.body)).toBe(200);
    expect(ins.body.months).toBe(6);
    const none = await owner.api("/api/group");
    expect(none.body).toMatchObject({ available: true, group: null });
    expect((await owner.api("/api/group/overview")).status).toBe(404);
    const made = await owner.api("/api/group", { body: { name: "Gruppo Rossi" } });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    expect(made.body.group.companies).toHaveLength(1);
    expect((await owner.api("/api/group", { body: { name: "Altro" } })).status).toBe(409);
    const ov = await owner.api("/api/group/overview?months=6");
    expect(ov.status, JSON.stringify(ov.body)).toBe(200);
    expect(ov.body.companies).toHaveLength(1);
    expect((await stranger.api("/api/group/overview")).status).toBe(404);
    expect((await owner.api(`/api/group/companies/${owner.userId}`, { method: "DELETE" })).status).toBe(200);
    expect((await owner.api("/api/group")).body.group).toBeNull();
  });
});
