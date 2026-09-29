// AGENDA-1 (riga 51) — l'agenda dei lavori da capo a fondo: finestra +
// blocchi + doppie prenotazioni, spostamenti e riassegnazioni (col segno del
// promemoria azzerato), controllo dei riferimenti, la pagina /t dell'operaio
// coi suoi blocchi, il giro dei promemoria della sera (email, niente due
// volte, di nuovo dopo uno spostamento, spento dall'interruttore) e l'invio
// come evento con orario a un Google Calendar finto. Portato da QuoteAI fase 75.

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, calendarConnectionsTable, calendarSyncedEventsTable, scheduleBlocksTable } from "@workspace/db";
import { runScheduleReminderMaintenance } from "../schedule/maintenance.js";
import { encryptSecret } from "../lib/crypto.js";
import { startServer, stopServer, createOrg, cleanupAll, daysFromNow } from "./harness.js";
import { emailsTo } from "./mailbox.js";
import { stubHost, json, requestsTo, resetRecorded } from "./vendorStub.js";

const GCAL = "https://www.googleapis.com/";

/** 08:00 → 16:00 a Roma in un dato giorno (ISO con +02:00: ottobre 2026 è ancora ora legale fino al 25). */
const shift = (day: string, from = 8, to = 16) => ({ startsAt: `${day}T${String(from).padStart(2, "0")}:00:00+02:00`, endsAt: `${day}T${String(to).padStart(2, "0")}:00:00+02:00` });
const win = (from: string, to: string) => `/api/schedule?from=${encodeURIComponent(`${from}T00:00:00+02:00`)}&to=${encodeURIComponent(`${to}T00:00:00+02:00`)}`;

async function waitFor<T>(probe: () => Promise<T | null | undefined | false>, label: string, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await probe();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

describe("Agenda dei lavori (AGENDA-1)", () => {
  let baseUrl = "";
  beforeAll(async () => {
    baseUrl = await startServer();
  });
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });
  beforeEach(() => resetRecorded());

  test("piani: free rifiutato, Pro ha l'agenda senza operai, finestre sbagliate 400", async () => {
    const free = await createOrg({ plan: "free" });
    const refused = await free.api(win("2026-10-05", "2026-10-12"));
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ error: "PLAN_REQUIRED" });

    const pro = await createOrg({ plan: "monthly_pro" });
    const board = await pro.api(win("2026-10-05", "2026-10-12"));
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    expect(board.body).toMatchObject({ blocks: [], workers: [], jobs: [] });

    const created = await pro.api("/api/schedule/blocks", { body: { ...shift("2026-10-06"), title: "Sopralluogo" } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.block).toMatchObject({ collaboratorId: null, projectId: null, label: "Sopralluogo", conflicts: [], allDay: false });

    expect((await pro.api(win("2026-10-12", "2026-10-05"))).status).toBe(400);
    expect((await pro.api(win("2026-01-01", "2026-06-01"))).status).toBe(400);
    expect((await pro.api("/api/schedule/blocks", { body: { startsAt: "2026-10-06T16:00:00+02:00", endsAt: "2026-10-06T08:00:00+02:00" } })).status).toBe(400);
  });

  test("blocchi su un cantiere: doppie prenotazioni da entrambi i lati, riassegnare le toglie, fasi sovrapposte, riferimenti controllati, eliminazione", async () => {
    const org = await createOrg({ companyName: "Squadra Srl" });
    const job = await org.api("/api/jobs", { body: { name: "Bagno Rossi", address: "Via Roma 12, Bergamo" } });
    expect(job.status, JSON.stringify(job.body)).toBe(201);
    const jobId = job.body.job.id as string;
    const ms = await org.api(`/api/jobs/${jobId}/milestones`, { body: { title: "Demolizioni", plannedStart: "2026-10-06", plannedEnd: "2026-10-08" } });
    expect(ms.status).toBe(201);
    const marco = (await org.api("/api/team/workers", { body: { name: "Marco Muratore", role: "Muratore", phone: "3331234567" } })).body.worker;
    const luca = (await org.api("/api/team/workers", { body: { name: "Luca Aiuto", role: "Manovale" } })).body.worker;

    const a = await org.api("/api/schedule/blocks", { body: { projectId: jobId, milestoneId: ms.body.milestone.id, collaboratorId: marco.id, ...shift("2026-10-06"), notes: "Cancello: codice 4471" } });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    expect(a.body.block).toMatchObject({ projectName: "Bagno Rossi", projectAddress: "Via Roma 12, Bergamo", milestoneTitle: "Demolizioni", collaboratorName: "Marco Muratore", label: "Bagno Rossi", conflicts: [] });

    // Sovrapposizione sullo stesso operaio → segnata da entrambi i lati, ma salvata.
    const b = await org.api("/api/schedule/blocks", { body: { projectId: jobId, collaboratorId: marco.id, ...shift("2026-10-06", 14, 18) } });
    expect(b.status).toBe(201);
    expect(b.body.block.conflicts).toEqual([a.body.block.id]);
    const board = await org.api(win("2026-10-05", "2026-10-12"));
    const byId = Object.fromEntries(board.body.blocks.map((x: { id: string }) => [x.id, x]));
    expect(byId[a.body.block.id].conflicts).toEqual([b.body.block.id]);
    expect(byId[b.body.block.id].conflicts).toEqual([a.body.block.id]);
    expect(board.body.workers.map((w: { name: string; hasPhone: boolean; hasEmail: boolean }) => [w.name, w.hasPhone, w.hasEmail])).toEqual([["Luca Aiuto", false, false], ["Marco Muratore", true, false]]);
    expect(board.body.jobs[0]).toMatchObject({ id: jobId, milestones: [{ title: "Demolizioni", plannedStart: "2026-10-06", plannedEnd: "2026-10-08" }] });
    expect((await org.api(`${win("2026-10-05", "2026-10-12")}&projectId=${jobId}`)).body.blocks).toHaveLength(2);

    // Il secondo blocco passa a Luca → niente più conflitto, e il segno del promemoria si azzera.
    await db.update(scheduleBlocksTable).set({ reminderSentAt: new Date() }).where(eq(scheduleBlocksTable.id, b.body.block.id));
    const moved = await org.api(`/api/schedule/blocks/${b.body.block.id}`, { method: "PUT", body: { collaboratorId: luca.id } });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    expect(moved.body.block).toMatchObject({ collaboratorName: "Luca Aiuto", conflicts: [], reminderSentAt: null });
    // Cambiare solo le note lascia il segno.
    await db.update(scheduleBlocksTable).set({ reminderSentAt: new Date() }).where(eq(scheduleBlocksTable.id, b.body.block.id));
    expect((await org.api(`/api/schedule/blocks/${b.body.block.id}`, { method: "PUT", body: { notes: "Portare la livella laser" } })).body.block.reminderSentAt).not.toBeNull();

    // Operai e cantieri di un'altra impresa non si possono usare.
    const other = await createOrg({ companyName: "Altra Srl" });
    const foreign = await other.api("/api/schedule/blocks", { body: { collaboratorId: marco.id, ...shift("2026-10-07") } });
    expect(foreign.status).toBe(400);
    expect(foreign.body.error).toBe("INVALID_REFERENCE");
    expect((await other.api(`/api/schedule/blocks/${a.body.block.id}`, { method: "PUT", body: { notes: "x" } })).status).toBe(404);
    expect((await other.api(`/api/schedule/blocks/${a.body.block.id}`, { method: "DELETE" })).status).toBe(404);
    // Una fase di un altro cantiere viene rifiutata.
    const job2 = await org.api("/api/jobs", { body: { name: "Terrazzo" } });
    expect((await org.api("/api/schedule/blocks", { body: { projectId: job2.body.job.id, milestoneId: ms.body.milestone.id, ...shift("2026-10-07") } })).status).toBe(400);

    expect((await org.api(`/api/schedule/blocks/${a.body.block.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await org.api(`/api/schedule/blocks/${a.body.block.id}`, { method: "DELETE" })).status).toBe(404);
    expect((await org.api(win("2026-10-05", "2026-10-12"))).body.blocks).toHaveLength(1);
  });

  test("la pagina /t dell'operaio mostra i suoi prossimi blocchi", async () => {
    const org = await createOrg({ companyName: "Cantieri Bianchi Srl" });
    const job = (await org.api("/api/jobs", { body: { name: "Cucina Verdi", address: "Via Dante 3, Milano" } })).body.job;
    const worker = (await org.api("/api/team/workers", { body: { name: "Paolo Operaio", email: `paolo-${org.userId}@example.invalid` } })).body.worker;
    const invite = await org.api(`/api/team/workers/${worker.id}/invite`, { body: { send: false } });
    const token = invite.body.url.split("/t/")[1] as string;

    const tomorrow = new Date(Date.now() + 86_400_000);
    const day = tomorrow.toISOString().slice(0, 10);
    const created = await org.api("/api/schedule/blocks", { body: { projectId: job.id, collaboratorId: worker.id, startsAt: `${day}T06:00:00Z`, endsAt: `${day}T14:00:00Z`, notes: "Portare il flessibile" } });
    expect(created.status).toBe(201);
    // Un blocco di nessuno e uno lontano nel futuro non devono comparire.
    await org.api("/api/schedule/blocks", { body: { projectId: job.id, startsAt: `${day}T06:00:00Z`, endsAt: `${day}T14:00:00Z` } });
    await org.api("/api/schedule/blocks", { body: { projectId: job.id, collaboratorId: worker.id, startsAt: "2031-01-06T07:00:00Z", endsAt: "2031-01-06T15:00:00Z" } });

    const page = await fetch(`${baseUrl}/api/t/${token}`).then(async (r) => ({ status: r.status, body: await r.json() }));
    expect(page.status).toBe(200);
    expect(page.body.schedule).toHaveLength(1);
    expect(page.body.schedule[0]).toMatchObject({ label: "Cucina Verdi", address: "Via Dante 3, Milano", notes: "Portare il flessibile", allDay: false, startsAt: `${day}T06:00:00.000Z` });
  });

  test("promemoria della sera: email a chi ce l'ha, una volta per blocco, di nuovo dopo uno spostamento, spento dall'interruttore", async () => {
    const org = await createOrg({ companyName: "Promemoria Srl" });
    const job = (await org.api("/api/jobs", { body: { name: "Bagno Rossi", address: "Via Roma 12, Bergamo" } })).body.job;
    const marcoEmail = `marco-${org.userId}@example.invalid`;
    const marco = (await org.api("/api/team/workers", { body: { name: "Marco Muratore", email: marcoEmail } })).body.worker;
    const nobody = (await org.api("/api/team/workers", { body: { name: "Senza Contatti" } })).body.worker;

    // Martedì 2026-10-06 08:00-16:00 per entrambi.
    const blocks = [] as string[];
    for (const w of [marco, nobody]) {
      const r = await org.api("/api/schedule/blocks", { body: { projectId: job.id, collaboratorId: w.id, ...shift("2026-10-06"), notes: w.id === marco.id ? "Cancello: codice 4471" : "" } });
      expect(r.status).toBe(201);
      blocks.push(r.body.block.id as string);
    }

    // Lunedì 14:30 a Roma → troppo presto.
    expect(await runScheduleReminderMaintenance(new Date("2026-10-05T12:30:00Z"))).toEqual({ email: 0, skipped: 0 });

    // Lunedì 18:00 a Roma (il cron delle 16:00Z) → un'email, uno senza canale.
    const evening = new Date("2026-10-05T16:00:00Z");
    expect(await runScheduleReminderMaintenance(evening)).toEqual({ email: 1, skipped: 1 });
    const mail = emailsTo(marcoEmail).at(-1)!;
    expect(mail.subject).toBe("Promemoria Srl — domani: Bagno Rossi");
    expect(mail.html).toContain("Domani 08:00-16:00: Bagno Rossi, Via Roma 12, Bergamo. Cancello: codice 4471");
    for (const id of blocks) expect((await db.select().from(scheduleBlocksTable).where(eq(scheduleBlocksTable.id, id)))[0]!.reminderSentAt).not.toBeNull();

    // La stessa sera di nuovo → niente.
    expect(await runScheduleReminderMaintenance(evening)).toEqual({ email: 0, skipped: 0 });

    // Il blocco di Marco va a mercoledì → segno azzerato → martedì sera riparte, come "domani" col nuovo giorno.
    expect((await org.api(`/api/schedule/blocks/${blocks[0]}`, { method: "PUT", body: shift("2026-10-07", 7, 15) })).body.block.reminderSentAt).toBeNull();
    expect(await runScheduleReminderMaintenance(new Date("2026-10-06T16:00:00Z"))).toEqual({ email: 1, skipped: 0 });
    expect(emailsTo(marcoEmail).at(-1)!.html).toContain("Domani 07:00-15:00: Bagno Rossi");

    // Un blocco aggiunto dopo il giro della sera riceve l'avviso il giorno stesso, prima dell'inizio.
    const late = await org.api("/api/schedule/blocks", { body: { projectId: job.id, collaboratorId: marco.id, ...shift("2026-10-08", 15, 18) } });
    expect(late.status).toBe(201);
    expect(await runScheduleReminderMaintenance(new Date("2026-10-08T10:00:00Z"))).toEqual({ email: 1, skipped: 0 });
    expect(emailsTo(marcoEmail).at(-1)!.html).toContain("Oggi 15:00-18:00");

    // Interruttore spento → il giro lascia stare il blocco.
    const quiet = await createOrg({ companyName: "Silenzio Srl", profile: { automationSettings: { notifyOnQuoteAccepted: true, autoDraftContract: true, autoSendInvoices: false, invoiceAutoSendAfterHours: 0, invoiceReminders: true, scheduleReminders: false } } });
    const qEmail = `q-${quiet.userId}@example.invalid`;
    const qw = (await quiet.api("/api/team/workers", { body: { name: "Operaio Quieto", email: qEmail } })).body.worker;
    const qb = await quiet.api("/api/schedule/blocks", { body: { collaboratorId: qw.id, ...shift("2026-10-06"), title: "Giornata in magazzino" } });
    expect(await runScheduleReminderMaintenance(evening)).toEqual({ email: 0, skipped: 0 });
    expect((await db.select().from(scheduleBlocksTable).where(eq(scheduleBlocksTable.id, qb.body.block.id)))[0]!.reminderSentAt).toBeNull();
    // Riacceso dalle impostazioni → parte.
    const put = await quiet.api("/api/business-profile", { method: "PUT", body: { automationSettings: { scheduleReminders: true } } });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(await runScheduleReminderMaintenance(evening)).toEqual({ email: 1, skipped: 0 });
    expect(emailsTo(qEmail).at(-1)!.html).toContain("Domani 08:00-16:00: Giornata in magazzino.");
  });

  test("sincronizzazione calendario: un blocco diventa un evento con orario, lo spostamento lo aggiorna, l'eliminazione lo cancella", async () => {
    const org = await createOrg({ companyName: "Calendario Srl" });
    await db.insert(calendarConnectionsTable).values({
      userId: org.userId,
      provider: "google",
      accountEmail: `cal-${org.userId.slice(-6)}@gmail.example`,
      accessTokenEnc: encryptSecret("ya29.e2e-cal"),
      refreshTokenEnc: encryptSecret("1//e2e-cal-refresh"),
      tokenExpiresAt: daysFromNow(1),
    });
    let nextId = 0;
    stubHost(GCAL, (req) => {
      if (req.method === "POST") return json(200, { id: `gblk_${++nextId}` });
      if (req.method === "PATCH") return json(200, { id: req.url.split("/events/")[1]!.split("?")[0] });
      if (req.method === "DELETE") return new Response(null, { status: 204 });
      return json(404, {});
    });
    const job = (await org.api("/api/jobs", { body: { name: "Bagno Rossi" } })).body.job;
    const marco = (await org.api("/api/team/workers", { body: { name: "Marco Muratore" } })).body.worker;
    const created = await org.api("/api/schedule/blocks", { body: { projectId: job.id, collaboratorId: marco.id, ...shift("2026-10-06") } });
    const blockId = created.body.block.id as string;

    const synced = await waitFor(async () => (await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.scheduleBlockId, blockId)))[0], "riga calendar_synced_events del blocco");
    expect(synced).toMatchObject({ status: "synced", externalEventId: "gblk_1", milestoneId: null });
    const post = requestsTo(GCAL).find((r) => r.method === "POST")!;
    expect(JSON.parse(post.body ?? "{}")).toEqual({ summary: "Marco Muratore · Bagno Rossi", description: "", start: { dateTime: "2026-10-06T06:00:00.000Z" }, end: { dateTime: "2026-10-06T14:00:00.000Z" } });

    resetRecorded();
    await org.api(`/api/schedule/blocks/${blockId}`, { method: "PUT", body: shift("2026-10-07") });
    const patch = await waitFor(async () => requestsTo(GCAL).find((r) => r.method === "PATCH"), "PATCH a Google");
    expect(patch.url).toContain("/events/gblk_1");
    expect(JSON.parse(patch.body ?? "{}").start).toEqual({ dateTime: "2026-10-07T06:00:00.000Z" });

    resetRecorded();
    expect((await org.api(`/api/schedule/blocks/${blockId}`, { method: "DELETE" })).status).toBe(200);
    expect(requestsTo(GCAL).some((r) => r.method === "DELETE" && r.url.includes("/events/gblk_1"))).toBe(true);
    expect(await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.scheduleBlockId, blockId))).toHaveLength(0);
  });
});
