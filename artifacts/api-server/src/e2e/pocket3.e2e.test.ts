// POCKET-3 (docs/POCKET-APP-PLAN.md, QuoteAI 126): il lato server delle schermate dei cantieri e della squadra.
// Provato sul server vero:
//  - l'elenco dei cantieri porta squadra, fatturato, costi e scontrini da controllare;
//  - pratiche del cantiere: elenco e aggiunta, e un altro tenant non le vede né le aggiunge;
//  - abbinare il telefono: il titolare fa un codice, l'anteprima non lo consuma, lo scambio vale una volta, il link vecchio dice «sostituito»,
//    un link scaduto può chiederne uno nuovo (notifica al titolare);
//  - posizione in diretta: solo con un'entrata aperta, la vede l'ufficio, sparisce all'uscita e quando l'operaio smette;
//  - assistenza e garanzia: registrare una chiamata, fissare una visita (finisce in agenda), segnarla conclusa, e un altro tenant non la tocca.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, collaboratorsTable, costEntriesTable, crewLocationsTable, notificationsTable, projectsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { startServer, stopServer, api, createOrg, cleanupAll, type TestUser } from "./harness.js";

const HOUR = 3_600_000;

describe("POCKET-3 — cantieri e squadra", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let jobId: string;
  let workerId: string;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Cantieri Srl", plan: "monthly_elite" });
    stranger = await createOrg({ companyName: "Estranei Srl", plan: "monthly_elite" });
    jobId = (await owner.api("/api/jobs", { body: { name: "Bagno via Roma", address: "Via Roma 1, Milano" } })).body.job.id;
    await db.update(projectsTable).set({ status: "active" }).where(eq(projectsTable.id, jobId));
    workerId = (await owner.api("/api/team/workers", { body: { name: "Marco Rossi", hourlyRateCents: 2500 } })).body.worker.id;
    expect((await owner.api(`/api/jobs/${jobId}/assignments`, { body: { workerId } })).status).toBeLessThan(300);
  }, 120_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("l'elenco dei cantieri porta squadra, fatturato, costi e scontrini da controllare", async () => {
    await db.insert(costEntriesTable).values([
      { userId: owner.userId, projectId: jobId, category: "materials", description: "Piastrelle", subtotalCents: 10_000, totalCents: 12_200, status: "confirmed", source: "manual" },
      { userId: owner.userId, projectId: jobId, category: "materials", description: "Scontrino da controllare", subtotalCents: 1_000, totalCents: 1_220, status: "pending_review", source: "receipt" },
    ] as never);
    const res = await owner.api("/api/jobs");
    expect(res.status).toBe(200);
    const job = res.body.items.find((j: { id: string }) => j.id === jobId);
    expect(job).toMatchObject({ crewCount: 1, invoicedCents: 0, costCents: 12_200, pendingReceiptCount: 1, pendingReceiptCents: 1_220 });
    expect(job.crew).toEqual([{ id: workerId, name: "Marco Rossi" }]);
    expect(res.body).toMatchObject({ jobLimit: null, openJobs: 1 });
  });

  test("le pratiche del cantiere: elenco e aggiunta; un altro tenant non le vede", async () => {
    const empty = await owner.api(`/api/jobs/${jobId}/permits`);
    expect(empty.status).toBe(200);
    expect(empty.body.permits).toEqual([]);
    expect((await owner.api(`/api/jobs/${jobId}/permits`, { body: {} })).status).toBe(400);
    const added = await owner.api(`/api/jobs/${jobId}/permits`, { body: { title: "CILA bagno", kind: "building", authority: "Comune di Milano", status: "applied" } });
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    expect(added.body.permits[0]).toMatchObject({ title: "CILA bagno", kind: "building", status: "applied", open: true, authority: "Comune di Milano" });
    expect((await stranger.api(`/api/jobs/${jobId}/permits`)).status).toBe(404);
    expect((await stranger.api(`/api/jobs/${jobId}/permits`, { body: { title: "Non mia" } })).status).toBe(404);
  });

  test("abbinare il telefono: anteprima senza consumare, scambio una volta sola, il link vecchio dice «sostituito»", async () => {
    const first = await owner.api(`/api/team/workers/${workerId}/invite`, { body: {} });
    const oldToken = first.body.url.split("/t/")[1] as string;
    expect((await api(`/api/t/${oldToken}`)).status).toBe(200);

    expect((await owner.api(`/api/team/workers/${workerId}/pairing-code`, { body: {} })).status).toBe(201);
    const made = await owner.api(`/api/team/workers/${workerId}/pairing-code`, { body: {} });
    expect(made.status).toBe(201);
    const code = made.body.code as string;
    expect(code).toMatch(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/);
    expect((await stranger.api(`/api/team/workers/${workerId}/pairing-code`, { body: {} })).status).toBe(404);

    expect((await api("/api/crew/pair/ZZZ-ZZZ")).status).toBe(404);
    const preview = await api(`/api/crew/pair/${code.toLowerCase().replace("-", " ")}`);
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body).toMatchObject({ workerName: "Marco Rossi", companyName: "Cantieri Srl" });
    expect((await api(`/api/crew/pair/${code}`)).status).toBe(200); // l'anteprima non lo consuma

    const paired = await api("/api/crew/pair", { body: { code } });
    expect(paired.status, JSON.stringify(paired.body)).toBe(200);
    expect(paired.body.workerName).toBe("Marco Rossi");
    const newToken = paired.body.token as string;
    expect((await api("/api/crew/pair", { body: { code } })).status).toBe(404); // una volta sola
    expect((await api(`/api/t/${newToken}`)).status).toBe(200);
    expect(JSON.stringify((await api(`/api/t/${newToken}`)).body)).not.toContain(code);

    // Il link di prima è stato sostituito: lo dice, e può chiederne uno nuovo.
    const old = await api(`/api/t/${oldToken}`);
    expect(old.status).toBe(410);
    expect(old.body.error).toBe("REPLACED");
    expect((await api("/api/crew/request-link", { body: { token: "x".repeat(40) } })).status).toBe(404);
    expect((await api("/api/crew/request-link", { body: { token: oldToken } })).status).toBe(200);
    const bell = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, owner.userId), eq(notificationsTable.type, "crew_link_requested")));
    expect(bell).toHaveLength(1);

    // Un codice scaduto lo dice con 410.
    const again = (await owner.api(`/api/team/workers/${workerId}/pairing-code`, { body: {} })).body.code as string;
    await db.update(collaboratorsTable).set({ pairingCodeExpiresAt: new Date(Date.now() - HOUR) }).where(eq(collaboratorsTable.id, workerId));
    expect((await api(`/api/crew/pair/${again}`)).status).toBe(410);
    expect((await api("/api/crew/pair", { body: { code: again } })).status).toBe(410);
    // Il telefono, ora, gira sul link nuovo anche per il resto del test.
    (globalThis as { __crewToken?: string }).__crewToken = newToken;
  });

  test("la posizione in diretta: solo in turno, la vede l'ufficio, sparisce all'uscita e quando si smette", async () => {
    const token = (globalThis as { __crewToken?: string }).__crewToken!;
    expect((await api(`/api/t/${token}/location`, { body: { lat: 45.46, lng: 9.19 } })).status).toBe(409); // non è in turno
    expect((await api(`/api/t/${token}/location`, { body: { lat: 200, lng: 9.19 } })).status).toBe(400);

    const clockIn = await api(`/api/t/${token}/clock-in`, { body: { projectId: jobId } });
    expect(clockIn.status, JSON.stringify(clockIn.body)).toBe(201);
    expect((await api(`/api/t/${token}/location`, { body: { lat: 45.46, lng: 9.19 } })).status).toBe(200);
    expect((await api(`/api/t/${token}/location`, { body: { lat: 45.47, lng: 9.2 } })).status).toBe(200); // aggiorna la stessa riga

    const seen = await owner.api("/api/crew/locations");
    expect(seen.status).toBe(200);
    expect(seen.body.enabled).toBe(true);
    expect(seen.body.items).toHaveLength(1);
    expect(seen.body.items[0]).toMatchObject({ workerId, name: "Marco Rossi", projectName: "Bagno via Roma", lat: 45.47, lng: 9.2 });
    expect((await stranger.api("/api/crew/locations")).body.items).toEqual([]);

    expect((await api(`/api/t/${token}/location/stop`, { body: {} })).status).toBe(200);
    expect((await owner.api("/api/crew/locations")).body.items).toEqual([]);

    expect((await api(`/api/t/${token}/location`, { body: { lat: 45.46, lng: 9.19 } })).status).toBe(200);
    expect(await db.select().from(crewLocationsTable).where(eq(crewLocationsTable.workerId, workerId))).toHaveLength(1);
    expect((await api(`/api/t/${token}/entries/${clockIn.body.entry.id}/clock-out`, { body: {} })).status).toBe(200);
    expect(await db.select().from(crewLocationsTable).where(eq(crewLocationsTable.workerId, workerId))).toHaveLength(0);
  });

  test("assistenza e garanzia: registrare, fissare la visita, concludere; un altro tenant non tocca niente", async () => {
    // Su un cantiere non concluso la chiamata è a pagamento; su uno concluso da poco è in garanzia.
    const open = await owner.api("/api/service-calls", { body: { projectId: jobId, issue: "Una tavola scricchiola" } });
    expect(open.status, JSON.stringify(open.body)).toBe(201);
    expect(open.body.call).toMatchObject({ status: "open", billing: "billable", underWarranty: false });

    await db.update(projectsTable).set({ status: "completed", completedAt: new Date(Date.now() - 30 * 86_400_000) }).where(eq(projectsTable.id, jobId));
    const warranty = await owner.api("/api/service-calls", { body: { projectId: jobId, issue: "Silicone da rifare", reportedBy: "Paola", channel: "email" } });
    expect(warranty.status).toBe(201);
    expect(warranty.body.call).toMatchObject({ billing: "warranty", underWarranty: true, reportedBy: "Paola", channel: "email" });
    const id = warranty.body.call.id as string;

    const startsAt = new Date(Date.now() + 2 * 86_400_000);
    const visit = await owner.api(`/api/service-calls/${id}`, { method: "PATCH", body: { visit: { startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 2 * HOUR).toISOString(), workerId } } });
    expect(visit.status, JSON.stringify(visit.body)).toBe(200);
    expect(visit.body.call).toMatchObject({ status: "booked", workerId, workerName: "Marco Rossi" });
    const sched = await owner.api(`/api/schedule?from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 5 * 86_400_000).toISOString())}`);
    expect(sched.body.blocks.some((b: { title: string }) => b.title === "Silicone da rifare")).toBe(true);
    expect((await owner.api(`/api/service-calls/${id}`, { method: "PATCH", body: { visit: { startsAt: startsAt.toISOString(), endsAt: startsAt.toISOString() } } })).status).toBe(400);

    const done = await owner.api(`/api/service-calls/${id}`, { method: "PATCH", body: { status: "done" } });
    expect(done.body.call.status).toBe("done");
    expect(done.body.call.doneAt).not.toBeNull();

    const list = await owner.api("/api/service-calls");
    expect(list.status).toBe(200);
    expect(list.body.calls).toHaveLength(2);
    expect(list.body.warrantyMonths).toBe(24);
    expect(list.body.kpis).toMatchObject({ open: 1, underWarranty: 1 });
    expect(list.body.warranty[0]).toMatchObject({ projectId: jobId, covered: true });

    expect((await stranger.api("/api/service-calls")).body.calls).toEqual([]);
    expect((await stranger.api(`/api/service-calls/${id}`, { method: "PATCH", body: { status: "open" } })).status).toBe(404);
    expect((await stranger.api("/api/service-calls", { body: { projectId: jobId, issue: "Non mio" } })).status).toBe(404);
  });

  test("la variante abbozzata dall'IA: serve un cantiere mio e un testo", async () => {
    expect((await owner.api(`/api/jobs/${jobId}/change-orders/draft`, { body: {} })).status).toBe(400);
    expect((await stranger.api(`/api/jobs/${jobId}/change-orders/draft`, { body: { text: "Quattro faretti nel soggiorno" } })).status).toBe(404);
  });
});
