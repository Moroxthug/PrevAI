// SQUADRA-1 (docs/PIANO-AZIONE.md riga 52, da QuoteAI fasi 86 e 86b) —
// l'app della squadra: la giornata dell'operaio su /t/:token, le
// segnalazioni dal cantiere senza account, la giornata del capocantiere, le
// attività aggiunte dal cantiere e "Da quando hai guardato".

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db, clientsTable, clientDedupKey, collaboratorsTable, costEntriesTable, jobPhotosTable, notificationsTable, projectTasksTable, projectsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { startServer, stopServer, api, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";

const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const MIN = 60_000;
const HOUR = 60 * MIN;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Change = { kind: string; blockId?: string; taskId?: string; reportId?: string; title?: string; by?: string | null; answer?: string | null; at: string };

async function member(owner: TestUser, role: "foreman" | "viewer"): Promise<TestUser> {
  const email = `e2e-${role}-${owner.userId}@example.invalid`;
  const invite = await owner.api("/api/team/members/invite", { body: { email, role } });
  expect(invite.status, JSON.stringify(invite.body)).toBe(201);
  const token = invite.body.url.split("/team-invite/")[1];
  const user = await createUser({ email, name: `${role} persona` });
  expect((await user.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);
  return user;
}

function reportForm(fields: Record<string, string>, photo = false) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (photo) fd.append("file", new Blob([pngBytes], { type: "image/png" }), "crepa.png");
  return fd;
}

describe("SQUADRA-1 — la giornata dell'operaio e le segnalazioni dal cantiere", () => {
  let owner: TestUser;
  let foreman: TestUser;
  let viewer: TestUser;
  let jobId: string;
  let otherJobId: string;
  let taskId: string;
  let token: string;
  let workerId: string;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Squadra Srl" });
    const [client] = await db.insert(clientsTable).values({ userId: owner.userId, name: "Paola Bianchi", phone: "+39 333 123 4567", dedupKey: clientDedupKey({ name: "Paola Bianchi", phone: "+39 333 123 4567" }) }).returning();

    jobId = (await owner.api("/api/jobs", { body: { name: "Rifacimento cucina", address: "Via Roma 12, Milano" } })).body.job.id;
    await db.update(projectsTable).set({ clientId: client!.id, status: "active" }).where(eq(projectsTable.id, jobId));
    otherJobId = (await owner.api("/api/jobs", { body: { name: "Soletta garage", address: "Via Po 4" } })).body.job.id;
    await db.update(projectsTable).set({ status: "active" }).where(eq(projectsTable.id, otherJobId));
    const task = await owner.api(`/api/jobs/${jobId}/tasks`, { body: { title: "Smontare i vecchi pensili" } });
    expect(task.status, JSON.stringify(task.body)).toBe(201);
    taskId = task.body.task.id;

    const worker = await owner.api("/api/team/workers", { body: { name: "Marco Rossi", hourlyRateCents: 2500 } });
    workerId = worker.body.worker.id;
    // Assegnato solo all'*altro* cantiere; in agenda oggi sulla cucina. Prima
    // di questa fase quella combinazione vedeva il turno e non poteva timbrare.
    expect((await owner.api(`/api/jobs/${otherJobId}/assignments`, { body: { workerId } })).status).toBeLessThan(300);
    const block = await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: workerId, startsAt: new Date(Date.now() - 30 * MIN).toISOString(), endsAt: new Date(Date.now() + 90 * MIN).toISOString(), notes: "Codice cancello 4471" } });
    expect(block.status, JSON.stringify(block.body)).toBe(201);
    token = (await owner.api(`/api/team/workers/${workerId}/invite`, { body: {} })).body.url.split("/t/")[1];

    foreman = await member(owner, "foreman");
    viewer = await member(owner, "viewer");
  }, 180_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("la giornata: il cantiere in agenda, le sue attività, dov'è e chi chiamare", async () => {
    const res = await api(`/api/t/${token}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const today = res.body.todayJobs as Array<{ id: string; address: string; contact: { name: string; phone: string }; blocks: { notes: string }[]; tasks: { id: string; title: string }[] }>;
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ id: jobId, address: "Via Roma 12, Milano", contact: { name: "Paola Bianchi", phone: "+39 333 123 4567" } });
    expect(today[0]!.blocks[0]!.notes).toBe("Codice cancello 4471");
    expect(today[0]!.tasks.map((t) => t.title)).toEqual(["Smontare i vecchi pensili"]);
    // Niente con un prezzo arriva all'operaio.
    expect(JSON.stringify(res.body)).not.toMatch(/Cents|budget|contractValue/i);
  });

  test("un cantiere in agenda è un cantiere su cui si timbra, anche se assegnato altrove", async () => {
    const jobs = (await api(`/api/t/${token}`)).body.jobs as Array<{ id: string }>;
    expect(jobs.map((j) => j.id).sort()).toEqual([jobId, otherJobId].sort());
    const clockIn = await api(`/api/t/${token}/clock-in`, { body: { projectId: jobId } });
    expect(clockIn.status, JSON.stringify(clockIn.body)).toBe(201);
    expect((await api(`/api/t/${token}/entries/${clockIn.body.entry.id}/clock-out`, { body: {} })).status).toBe(200);
  });

  test("un'attività spuntata in cantiere è spuntata in ufficio, e resta nel registro", async () => {
    const res = await api(`/api/t/${token}/tasks/${taskId}`, { body: { status: "done" } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const [row] = await db.select().from(projectTasksTable).where(eq(projectTasksTable.id, taskId));
    expect(row!.status).toBe("done");
    // Ancora in lista oggi (spuntata oggi), così non sparisce sotto il pollice.
    expect((await api(`/api/t/${token}`)).body.todayJobs[0].tasks[0]).toMatchObject({ id: taskId, status: "done" });
    expect((await api(`/api/t/${token}/tasks/not-a-uuid`, { body: { status: "done" } })).status).toBe(400);
    expect((await api(`/api/t/${token}/tasks/${taskId}`, { body: { status: "finito" } })).status).toBe(400);
  });

  test("le attività e i cantieri di un'altra impresa non si raggiungono da questo link", async () => {
    const stranger = await createOrg({ companyName: "Estranei Srl" });
    const theirJob = (await stranger.api("/api/jobs", { body: { name: "Il loro cantiere" } })).body.job.id;
    const theirTask = (await stranger.api(`/api/jobs/${theirJob}/tasks`, { body: { title: "Non tua" } })).body.task.id;
    expect((await api(`/api/t/${token}/tasks/${theirTask}`, { body: { status: "done" } })).status).toBe(404);
    expect((await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: theirJob, kind: "note", body: "ciao" }) })).status).toBe(400);
  });

  test("una foto con una nota finisce nella galleria del cantiere, una volta sola anche se il telefono riprova", async () => {
    const clientRef = randomUUID();
    const send = () => api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "note", body: "Infiltrazione dietro il lavello", clientRef }, true) });
    const first = await send();
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.report).toMatchObject({ kind: "note", authorName: "Marco Rossi", projectName: "Rifacimento cucina" });
    expect(first.body.report.photoId).toBeTruthy();
    const again = await send();
    expect(again.status).toBe(200);
    expect(again.body.report.id).toBe(first.body.report.id);
    const photos = await db.select().from(jobPhotosTable).where(eq(jobPhotosTable.projectId, jobId));
    expect(photos).toHaveLength(1);
    expect(photos[0]!.caption).toContain("Marco Rossi");
  });

  test("una segnalazione vuota è rifiutata invece che registrata", async () => {
    const res = await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "note" }) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EMPTY");
    expect((await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "materials", materialsCents: "0" }) })).body.error).toBe("EMPTY");
    expect((await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "chiacchiere", body: "x" }) })).status).toBe(400);
  });

  test("i materiali diventano un costo da controllare, non un costo confermato", async () => {
    const res = await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "materials", body: "2 scatole di viti", materialsCents: "4250" }) });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const [cost] = await db.select().from(costEntriesTable).where(eq(costEntriesTable.id, res.body.report.costEntryId));
    expect(cost).toMatchObject({ projectId: jobId, category: "materials", totalCents: 4250, status: "pending_review" });
    expect(cost!.description).toContain("Marco Rossi");
  });

  let blockerId: string;
  test("un blocco avvisa l'ufficio con una notifica che arriva al telefono", async () => {
    const res = await api(`/api/t/${token}/reports`, { method: "POST", form: reportForm({ projectId: jobId, kind: "blocker", body: "Manca la corrente in cantiere" }) });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    blockerId = res.body.report.id;
    const notes = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, owner.userId), eq(notificationsTable.type, "field_blocker")));
    expect(notes).toHaveLength(1);
    expect(notes[0]!.title).toContain("Marco Rossi");
    expect(notes[0]!.link).toBe(`/dashboard/jobs/${jobId}`);
  });

  test("il cantiere elenca tutto quello che è arrivato dal campo", async () => {
    const res = await owner.api(`/api/jobs/${jobId}/field-reports`);
    expect(res.status).toBe(200);
    expect((res.body.reports as Array<{ kind: string }>).map((r) => r.kind).sort()).toEqual(["blocker", "materials", "note"]);
    const stranger = await createOrg({ companyName: "Curiosi Srl" });
    expect((await stranger.api(`/api/jobs/${jobId}/field-reports`)).status).toBe(404);
  });

  test("la giornata del capocantiere: chi è dove, cosa è bloccato, le ore da approvare", async () => {
    const res = await foreman.api("/api/crew/today");
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.enabled).toBe(true);
    const kitchen = (res.body.jobs as Array<{ jobId: string; crew: { workerName: string }[] }>).find((j) => j.jobId === jobId);
    expect(kitchen!.crew[0]!.workerName).toBe("Marco Rossi");
    expect((res.body.blockers as Array<{ id: string }>).map((b) => b.id)).toEqual([blockerId]);
    expect((res.body.awaitingApproval as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  test("il capocantiere approva con \"Approva tutte\", come già poteva una riga alla volta", async () => {
    const ids = ((await foreman.api("/api/crew/today")).body.awaitingApproval as Array<{ id: string }>).map((e) => e.id);
    expect((await viewer.api("/api/team/time-entries/approve", { body: { ids } })).status).toBe(403);
    const res = await foreman.api("/api/team/time-entries/approve", { body: { ids } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.approved).toBe(ids.length);
  });

  test("rispondere a un blocco: il lettore no, il capocantiere sì, e l'operaio vede la risposta", async () => {
    expect((await viewer.api(`/api/field-reports/${blockerId}/resolve`, { body: { note: "no" } })).status).toBe(403);
    const stranger = await createOrg({ companyName: "Altri Srl" });
    expect((await stranger.api(`/api/field-reports/${blockerId}/resolve`, { body: {} })).status).toBe(404);
    const res = await foreman.api(`/api/field-reports/${blockerId}/resolve`, { body: { note: "L'elettricista arriva alle 14" } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.report.resolvedAt).toBeTruthy();
    expect((await owner.api("/api/crew/today")).body.blockers).toEqual([]);
    const mine = (await api(`/api/t/${token}`)).body.reports as Array<{ id: string; resolutionNote: string | null }>;
    expect(mine.find((r) => r.id === blockerId)!.resolutionNote).toBe("L'elettricista arriva alle 14");
  });

  test("un'impresa senza le ore della squadra se lo sente dire invece di vedere una giornata vuota", async () => {
    const pro = await createOrg({ companyName: "Pro Srl", plan: "monthly_pro" });
    const res = await pro.api("/api/crew/today");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ enabled: false });
    expect(res.body.requiredPlan).toBeTruthy();
  });
});

describe("SQUADRA-1 — attività dal cantiere e \"Da quando hai guardato\"", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let jobId: string;
  let token: string;
  let workerId: string;
  let otherWorkerId: string;
  let todayBlockId: string;
  let handedBlockId: string;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Bagni Verdi Srl" });
    jobId = (await owner.api("/api/jobs", { body: { name: "Bagno da rifare", address: "Via Verdi 8" } })).body.job.id;
    await db.update(projectsTable).set({ status: "active" }).where(eq(projectsTable.id, jobId));
    workerId = (await owner.api("/api/team/workers", { body: { name: "Luca Capo", hourlyRateCents: 3000 } })).body.worker.id;
    otherWorkerId = (await owner.api("/api/team/workers", { body: { name: "Andrea Apprendista", hourlyRateCents: 1500 } })).body.worker.id;
    const block = await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: workerId, startsAt: new Date(Date.now() - 30 * MIN).toISOString(), endsAt: new Date(Date.now() + 4 * HOUR).toISOString() } });
    expect(block.status, JSON.stringify(block.body)).toBe(201);
    todayBlockId = block.body.block.id;
    // Nella sua settimana prima che guardi; passato a un altro dopo.
    handedBlockId = (await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: workerId, startsAt: new Date(Date.now() + 48 * HOUR).toISOString(), endsAt: new Date(Date.now() + 54 * HOUR).toISOString() } })).body.block.id;
    token = (await owner.api(`/api/team/workers/${workerId}/invite`, { body: {} })).body.url.split("/t/")[1];
    viewer = await member(owner, "viewer");
  }, 180_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("aggiungere attività è spento finché l'ufficio non lo accende per quell'operaio, e solo team:full può", async () => {
    const page = await api(`/api/t/${token}`);
    expect(page.body.worker.canAddTasks).toBe(false);
    const refused = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Rubinetto d'arresto bloccato" } });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toBe("NOT_ALLOWED");

    expect((await viewer.api(`/api/team/workers/${workerId}`, { method: "PUT", body: { canAddTasks: true } })).status).toBe(403);
    const on = await owner.api(`/api/team/workers/${workerId}`, { method: "PUT", body: { canAddTasks: true } });
    expect(on.status, JSON.stringify(on.body)).toBe(200);
    expect(on.body.worker.canAddTasks).toBe(true);
    expect((await api(`/api/t/${token}`)).body.worker.canAddTasks).toBe(true);
  });

  test("un'attività aggiunta dal cantiere porta il suo nome, una volta sola anche se il telefono riprova", async () => {
    const clientRef = randomUUID();
    const first = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Rubinetto d'arresto bloccato", clientRef } });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.task).toMatchObject({ title: "Rubinetto d'arresto bloccato", status: "todo", addedBy: "Luca Capo" });
    const again = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Rubinetto d'arresto bloccato", clientRef } });
    expect(again.status).toBe(200);
    expect(again.body.task.id).toBe(first.body.task.id);

    // L'ufficio vede da dove arriva…
    const job = await owner.api(`/api/jobs/${jobId}`);
    const all = [...job.body.unassignedTasks, ...job.body.milestones.flatMap((m: { tasks: unknown[] }) => m.tasks)] as Array<{ id: string; addedFromFieldBy: string | null }>;
    expect(all.filter((t) => t.id === first.body.task.id)).toHaveLength(1);
    expect(all.find((t) => t.id === first.body.task.id)!.addedFromFieldBy).toBe("Luca Capo");
    // …e lo sa, una volta al giorno, non una per attività.
    await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Massetto molle vicino alla vasca" } });
    const bells = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, owner.userId), eq(notificationsTable.entityType, "project_task")));
    expect(bells).toHaveLength(1);
    expect(bells[0]!.title).toContain("Luca Capo");

    const today = (await api(`/api/t/${token}`)).body.todayJobs as Array<{ id: string; tasks: { title: string; addedBy: string | null }[] }>;
    expect(today.find((j) => j.id === jobId)!.tasks.find((t) => t.title === "Rubinetto d'arresto bloccato")!.addedBy).toBe("Luca Capo");
  });

  test("un titolo vuoto è rifiutato, e il cantiere di un'altra impresa è fuori portata", async () => {
    const empty = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "   " } });
    expect(empty.status).toBe(400);
    expect(empty.body.error).toBe("EMPTY");
    const stranger = await createOrg({ companyName: "Altrove Srl" });
    const theirs = (await stranger.api("/api/jobs", { body: { name: "Non tuo" } })).body.job.id;
    expect((await api(`/api/t/${token}/jobs/${theirs}/tasks`, { method: "POST", body: { title: "furbo" } })).status).toBe(404);
  });

  test("la prima visita fa partire il segno invece di elencare tutto", async () => {
    await db.update(collaboratorsTable).set({ crewSeenAt: null }).where(eq(collaboratorsTable.id, workerId));
    const first = await api(`/api/t/${token}`);
    expect(first.body.changes).toEqual([]);
    const [w] = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.id, workerId));
    expect(w!.crewSeenAt).toBeTruthy();
  });

  test("quello che ha cambiato l'ufficio compare; quello che ha fatto l'operaio no", async () => {
    // Due orologi: il segno è dell'API, le righe del registro del database. Una pausa li separa.
    await sleep(1500);
    const tomorrow = await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: workerId, startsAt: new Date(Date.now() + 24 * HOUR).toISOString(), endsAt: new Date(Date.now() + 30 * HOUR).toISOString() } });
    expect(tomorrow.status).toBe(201);
    expect((await owner.api(`/api/schedule/blocks/${todayBlockId}`, { method: "PUT", body: { endsAt: new Date(Date.now() + 6 * HOUR).toISOString() } })).status).toBe(200);
    // Un turno passato da questo operaio a un altro sparisce dalla sua settimana.
    expect((await owner.api(`/api/schedule/blocks/${handedBlockId}`, { method: "PUT", body: { collaboratorId: otherWorkerId } })).status).toBe(200);
    // Creato e cancellato in mezzo: niente da dire.
    const blip = await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: workerId, startsAt: new Date(Date.now() + 72 * HOUR).toISOString(), endsAt: new Date(Date.now() + 74 * HOUR).toISOString() } });
    await owner.api(`/api/schedule/blocks/${blip.body.block.id}`, { method: "DELETE" });
    // Il turno di un altro non è una novità per questo operaio.
    await owner.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: otherWorkerId, startsAt: new Date(Date.now() + 24 * HOUR).toISOString(), endsAt: new Date(Date.now() + 26 * HOUR).toISOString() } });
    const officeTask = await owner.api(`/api/jobs/${jobId}/tasks`, { body: { title: "Ordinare il mobile lavabo" } });
    // Le mosse dell'operaio: un'attività nuova e una spunta.
    const own = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Tappare i vecchi attacchi" } });
    await api(`/api/t/${token}/tasks/${own.body.task.id}`, { method: "POST", body: { status: "done" } });
    // Un blocco, a cui l'ufficio risponde.
    const fd = new FormData();
    fd.append("projectId", jobId);
    fd.append("kind", "blocker");
    fd.append("body", "Manca la chiusura dell'acqua in strada");
    const blocker = await api(`/api/t/${token}/reports`, { method: "POST", form: fd });
    await owner.api(`/api/field-reports/${blocker.body.report.id}/resolve`, { body: { note: "L'acquedotto passa martedì" } });

    const res = await api(`/api/t/${token}`);
    const changes = res.body.changes as Change[];
    const kinds = (kind: string) => changes.filter((c) => c.kind === kind);
    expect(kinds("shift_added").map((c) => c.blockId)).toEqual([tomorrow.body.block.id]);
    expect(kinds("shift_changed").map((c) => c.blockId)).toEqual([todayBlockId]);
    expect(kinds("shift_removed").map((c) => c.blockId)).toEqual([handedBlockId]);
    expect(changes.some((c) => c.blockId === blip.body.block.id)).toBe(false);
    expect(kinds("task_added").map((c) => c.taskId)).toEqual([officeTask.body.task.id]);
    expect(changes.some((c) => c.taskId === own.body.task.id)).toBe(false);
    expect(kinds("answer")).toHaveLength(1);
    expect(kinds("answer")[0]!.answer).toBe("L'acquedotto passa martedì");
    // Le più recenti prima.
    const ats = changes.map((c) => c.at);
    expect([...ats].sort().reverse()).toEqual(ats);
    expect(typeof res.body.changesUpTo).toBe("string");
  });

  test("ricaricare tiene la lista; \"Ho visto\" la svuota, e una scheda vecchia non la riporta", async () => {
    const before = await api(`/api/t/${token}`);
    expect((before.body.changes as Change[]).length).toBeGreaterThan(0);
    expect((await api(`/api/t/${token}`)).body.changes).toHaveLength(before.body.changes.length);

    expect((await api(`/api/t/${token}/seen`, { method: "POST", body: { upTo: before.body.changesUpTo } })).status).toBe(200);
    expect((await api(`/api/t/${token}`)).body.changes).toEqual([]);
    // Un "Ho visto" più vecchio che arriva tardi (un'altra scheda, una rete lenta) lascia il segno dov'è.
    expect((await api(`/api/t/${token}/seen`, { method: "POST", body: { upTo: new Date(Date.now() - 10 * 86_400_000).toISOString() } })).status).toBe(200);
    expect((await api(`/api/t/${token}`)).body.changes).toEqual([]);
    expect((await api(`/api/t/${token}/seen`, { method: "POST", body: { upTo: "ieri" } })).status).toBe(400);
  });

  test("un'attività dell'operaio spuntata poi dall'ufficio è di nuovo una novità", async () => {
    await sleep(1500);
    const own = await api(`/api/t/${token}/jobs/${jobId}/tasks`, { method: "POST", body: { title: "Fotografare i travetti" } });
    expect((await api(`/api/t/${token}`)).body.changes).toEqual([]);
    expect((await owner.api(`/api/jobs/${jobId}/tasks/${own.body.task.id}`, { method: "PATCH", body: { status: "done" } })).status).toBe(200);
    const changes = (await api(`/api/t/${token}`)).body.changes as Change[];
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "task_done", taskId: own.body.task.id, by: null });
  });
});
