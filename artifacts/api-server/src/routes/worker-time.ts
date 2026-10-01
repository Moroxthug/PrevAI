import { Router } from "express";
import { z } from "zod";
import {
  db,
  collaboratorsTable,
  projectsTable,
  projectAssignmentsTable,
  milestonesTable,
  timeEntriesTable,
  scheduleBlocksTable,
  businessProfilesTable,
  hasFeature,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, isNull, isNotNull, lt } from "drizzle-orm";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { hashToken } from "../contracts/service.js";
import { parseIsoDate, toIsoDate, localDayFor } from "../jobs/dates.js";
import { createNotification, writeAudit } from "../lib/notifications.js";
import { distanceMeters } from "../lib/geo.js";
import { blockLabel } from "../schedule/service.js";
import multer from "multer";
import { FIELD_REPORT_KINDS, fieldReportsTable, projectTasksTable } from "@workspace/db";
import { photoUpload } from "../jobs/photos.js";
import { addFieldTask, blocksOnDay, createFieldReport, FieldReportError, localToday, serializeReports, siteContacts, tasksForJobs } from "../crew/service.js";
import { workerChanges } from "../crew/changes.js";

/** A clock-in session longer than this is auto-capped at clock-out — a forgotten clock-out shouldn't silently log a 30h day. */
const MAX_SESSION_HOURS = 16;

// ── Public worker time-entry endpoints (/t/:token) ───────────────────────────
// No login: the magic-link token identifies the worker (hashed before
// lookup, expiring, revocable from the Team page). Workers see only their
// company's open jobs and their own entries; nothing money-related leaks.

const router = Router();
const viewLimiter = ipRateLimiter({ name: "worker-time.viewLimiter", windowMs: 60_000, max: 60, message: "Too many requests" });
const writeLimiter = ipRateLimiter({ name: "worker-time.writeLimiter", windowMs: 15 * 60_000, max: 60, message: "Too many requests. Try again in a few minutes." });

async function resolveWorker(rawToken: string) {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 200) return null;
  const [worker] = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.timeTokenHash, hashToken(rawToken)));
  if (!worker || !worker.active) return null;
  if (worker.timeTokenExpiresAt && worker.timeTokenExpiresAt < new Date()) return { expired: true as const, worker };
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, worker.userId));
  // The company must still be on a plan with time tracking.
  if (!hasFeature(profile, "team_time")) return { expired: true as const, worker };
  return { expired: false as const, worker, companyName: profile?.companyName ?? "", language: "it" as const };
}

/**
 * Jobs the worker may log time on: assigned ones, else every open job of the company.
 * SQUADRA-1: a job they are *booked* on (a schedule block from two weeks back
 * to two weeks ahead) counts as assigned — before this, a foreman who put a
 * labourer on Thursday's board without also adding them to the job's team
 * produced a worker who could see Thursday and could not clock in on it.
 */
async function workerJobs(worker: { id: string; userId: string }) {
  const assigned = await db.select({ projectId: projectAssignmentsTable.projectId }).from(projectAssignmentsTable).where(eq(projectAssignmentsTable.collaboratorId, worker.id));
  const booked = await db
    .select({ projectId: scheduleBlocksTable.projectId })
    .from(scheduleBlocksTable)
    .where(and(eq(scheduleBlocksTable.collaboratorId, worker.id), isNotNull(scheduleBlocksTable.projectId), gte(scheduleBlocksTable.endsAt, new Date(Date.now() - 14 * 86_400_000)), lt(scheduleBlocksTable.startsAt, new Date(Date.now() + 15 * 86_400_000))));
  const ids = [...new Set([...assigned.map((a) => a.projectId), ...booked.map((b) => b.projectId!)])];
  const conds = [eq(projectsTable.userId, worker.userId), inArray(projectsTable.status, ["planning", "active"])];
  if (ids.length) conds.push(inArray(projectsTable.id, ids));
  const jobs = await db
    .select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address, latitude: projectsTable.latitude, longitude: projectsTable.longitude, geofenceRadiusMeters: projectsTable.geofenceRadiusMeters })
    .from(projectsTable)
    .where(and(...conds))
    .orderBy(asc(projectsTable.name))
    .limit(50);
  const milestones = jobs.length ? await db.select({ id: milestonesTable.id, projectId: milestonesTable.projectId, title: milestonesTable.title, status: milestonesTable.status, sortOrder: milestonesTable.sortOrder }).from(milestonesTable).where(and(inArray(milestonesTable.projectId, jobs.map((j) => j.id)), inArray(milestonesTable.status, ["planned", "in_progress"]))).orderBy(asc(milestonesTable.sortOrder)) : [];
  return jobs.map((j) => ({ ...j, milestones: milestones.filter((m) => m.projectId === j.id).map((m) => ({ id: m.id, title: m.title, status: m.status })) }));
}

const serializeOwnEntry = (e: typeof timeEntriesTable.$inferSelect, jobName: string | null, milestoneTitle: string | null) => ({
  id: e.id,
  projectId: e.projectId,
  projectName: jobName,
  milestoneId: e.milestoneId,
  milestoneTitle,
  date: toIsoDate(e.date),
  hours: Number(e.hours),
  note: e.note,
  status: e.status,
  rejectedReason: e.rejectedReason,
  clockInAt: e.clockInAt ? e.clockInAt.toISOString() : null,
  clockOutAt: e.clockOutAt ? e.clockOutAt.toISOString() : null,
  geofenceFlagged: e.geofenceFlagged,
  createdAt: e.createdAt.toISOString(),
});

/** Distance check against a job's (optional, manually-set) geofence — flags only, never blocks. */
function geofenceFlag(job: { latitude: string | null; longitude: string | null; geofenceRadiusMeters: number | null }, lat: number | undefined, lng: number | undefined) {
  if (!job.latitude || !job.longitude || !job.geofenceRadiusMeters || lat === undefined || lng === undefined) return false;
  return distanceMeters(Number(job.latitude), Number(job.longitude), lat, lng) > job.geofenceRadiusMeters;
}

async function ownEntries(worker: { id: string }, jobs: { id: string; name: string; milestones: { id: string; title: string }[] }[]) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, worker.id), gte(timeEntriesTable.date, since))).orderBy(desc(timeEntriesTable.date), desc(timeEntriesTable.createdAt)).limit(120);
  const jobName = new Map(jobs.map((j) => [j.id, j.name]));
  const msTitle = new Map(jobs.flatMap((j) => j.milestones.map((m) => [m.id, m.title] as const)));
  // Entries on jobs no longer open still show up (name resolved separately).
  const missing = rows.map((r) => r.projectId).filter((id) => !jobName.has(id));
  if (missing.length) for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(inArray(projectsTable.id, [...new Set(missing)]))) jobName.set(p.id, p.name);
  return rows.map((r) => serializeOwnEntry(r, jobName.get(r.projectId) ?? null, r.milestoneId ? (msTitle.get(r.milestoneId) ?? null) : null));
}

/** AGENDA-1: i blocchi dell'operaio da oggi per due settimane — quelli di cui parla il promemoria della sera. */
async function workerSchedule(worker: { id: string }) {
  const from = localDayFor(new Date());
  const to = new Date(from.getTime() + 15 * 86_400_000);
  const rows = await db
    .select()
    .from(scheduleBlocksTable)
    .where(and(eq(scheduleBlocksTable.collaboratorId, worker.id), lt(scheduleBlocksTable.startsAt, to), gte(scheduleBlocksTable.endsAt, from)))
    .orderBy(asc(scheduleBlocksTable.startsAt))
    .limit(60);
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter((x): x is string => !!x))];
  const projects = new Map<string, { name: string; address: string }>();
  if (projectIds.length) for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address }).from(projectsTable).where(inArray(projectsTable.id, projectIds))) projects.set(p.id, p);
  const milestoneIds = [...new Set(rows.map((r) => r.milestoneId).filter((x): x is string => !!x))];
  const milestones = new Map<string, string>();
  if (milestoneIds.length) for (const m of await db.select({ id: milestonesTable.id, title: milestonesTable.title }).from(milestonesTable).where(inArray(milestonesTable.id, milestoneIds))) milestones.set(m.id, m.title);
  return rows.map((b) => {
    const project = b.projectId ? projects.get(b.projectId) : undefined;
    return {
      id: b.id,
      projectId: b.projectId,
      label: blockLabel(b, project?.name ?? null),
      address: project?.address || null,
      milestoneTitle: b.milestoneId ? (milestones.get(b.milestoneId) ?? null) : null,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      allDay: b.allDay,
      notes: b.notes,
    };
  });
}

/**
 * SQUADRA-1: the worker's day. The jobs they are booked on today (or clocked
 * in on), each with its open tasks, the site address and the person on site
 * to call. Built from their own blocks only — a worker never sees another
 * crew's day or anything with a price on it.
 */
async function workerToday(worker: { id: string; userId: string }, activeProjectId: string | null) {
  const day = localToday();
  const blocks = await blocksOnDay(eq(scheduleBlocksTable.collaboratorId, worker.id), day);
  const ids = [...new Set([...blocks.map((b) => b.projectId).filter((x): x is string => !!x), ...(activeProjectId ? [activeProjectId] : [])])];
  if (!ids.length) return [];
  const projects = await db.select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address }).from(projectsTable).where(and(eq(projectsTable.userId, worker.userId), inArray(projectsTable.id, ids)));
  const contacts = await siteContacts(projects.map((p) => p.id));
  const tasks = await tasksForJobs(projects.map((p) => p.id), new Date(`${day}T00:00:00Z`));
  return projects
    .map((p) => {
      const own = blocks.filter((b) => b.projectId === p.id);
      return {
        id: p.id,
        name: p.name,
        address: p.address || null,
        contact: contacts.get(p.id) ?? null,
        blocks: own.map((b) => ({ id: b.id, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), allDay: b.allDay, notes: b.notes })),
        tasks: tasks.get(p.id) ?? [],
      };
    })
    .sort((a, b) => (a.blocks[0]?.startsAt ?? "~").localeCompare(b.blocks[0]?.startsAt ?? "~"));
}

async function ownReports(worker: { id: string }) {
  const rows = await db.select().from(fieldReportsTable).where(and(eq(fieldReportsTable.workerId, worker.id), gte(fieldReportsTable.createdAt, new Date(Date.now() - 14 * 86_400_000)))).orderBy(desc(fieldReportsTable.createdAt)).limit(20);
  return serializeReports(rows);
}

const clientRefSchema = z.string().uuid().optional();

// GET /api/t/:token
router.get("/t/:token", viewLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r) {
      res.status(404).json({ error: "INVALID" });
      return;
    }
    if (r.expired) {
      res.status(410).json({ error: "EXPIRED", workerName: r.worker.name });
      return;
    }
    const jobs = await workerJobs(r.worker);
    const [openEntry] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, r.worker.id), isNotNull(timeEntriesTable.clockInAt), isNull(timeEntriesTable.clockOutAt)));
    const activeEntry = openEntry ? serializeOwnEntry(openEntry, jobs.find((j) => j.id === openEntry.projectId)?.name ?? null, null) : null;
    // SQUADRA-1: on the very first visit everything is new, so there is no
    // "since" yet — start the marker now instead of listing the whole schedule.
    const now = new Date();
    if (!r.worker.crewSeenAt) await db.update(collaboratorsTable).set({ crewSeenAt: now }).where(eq(collaboratorsTable.id, r.worker.id));
    const changes = r.worker.crewSeenAt ? await workerChanges(r.worker, r.worker.crewSeenAt, now) : [];
    res.json({
      worker: { name: r.worker.name, role: r.worker.role, canAddTasks: r.worker.canAddTasks },
      companyName: r.companyName,
      language: r.language,
      jobs,
      entries: await ownEntries(r.worker, jobs),
      activeEntry,
      today: toIsoDate(localDayFor(now)),
      schedule: await workerSchedule(r.worker),
      todayJobs: await workerToday(r.worker, openEntry?.projectId ?? null),
      reports: await ownReports(r.worker),
      changes,
      changesUpTo: now.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error loading worker page");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/t/:token/entries
router.post("/t/:token/entries", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const body = z.object({ projectId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hours: z.number().min(0.25).max(24), milestoneId: z.string().uuid().nullable().optional(), note: z.string().max(300).optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const date = parseIsoDate(d.date)!;
    if (date.getTime() > Date.now() + 86_400_000 || date.getTime() < Date.now() - 45 * 86_400_000) {
      res.status(400).json({ error: "DATE_RANGE", message: "Hours can be logged for the last 45 days only." });
      return;
    }
    const jobs = await workerJobs(r.worker);
    const job = jobs.find((j) => j.id === d.projectId);
    if (!job) {
      res.status(400).json({ error: "Invalid job" });
      return;
    }
    const milestoneId = d.milestoneId && job.milestones.some((m) => m.id === d.milestoneId) ? d.milestoneId : null;
    // Cap a day at 24 h across entries.
    const sameDay = await db.select({ hours: timeEntriesTable.hours }).from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, r.worker.id), eq(timeEntriesTable.date, date)));
    if (sameDay.reduce((s, x) => s + Number(x.hours), 0) + d.hours > 24) {
      res.status(400).json({ error: "TOO_MANY_HOURS", message: "More than 24 hours on one day." });
      return;
    }
    const [entry] = await db
      .insert(timeEntriesTable)
      .values({ userId: r.worker.userId, workerId: r.worker.id, projectId: job.id, milestoneId, date, hours: d.hours.toFixed(2), rateCentsSnapshot: r.worker.hourlyRate, burdenPercentSnapshot: String(Number(r.worker.burdenPercent)), note: d.note ?? "", status: "submitted", enteredBy: "worker" })
      .returning();
    await db.update(collaboratorsTable).set({ lastTimeEntryAt: new Date() }).where(eq(collaboratorsTable.id, r.worker.id));
    // One notification per worker per day keeps the bell useful.
    const dayKey = toIsoDate(localDayFor(new Date()));
    const already = await db.select({ id: timeEntriesTable.id }).from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, r.worker.id), eq(timeEntriesTable.enteredBy, "worker"), gte(timeEntriesTable.createdAt, new Date(`${dayKey}T00:00:00Z`)))).limit(2);
    if (already.length <= 1) {
      await createNotification({ userId: r.worker.userId, type: "time_entry_submitted", title: `${r.worker.name} ha registrato ore`, body: `${d.hours} h su ${job.name} — da approvare in Squadra.`, link: "/dashboard/team?tab=time", entityType: "time_entry", entityId: entry!.id });
    }
    res.status(201).json({ entry: serializeOwnEntry(entry!, job.name, milestoneId ? (job.milestones.find((m) => m.id === milestoneId)?.title ?? null) : null) });
  } catch (err) {
    req.log.error({ err }, "Error saving worker time entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/t/:token/clock-in
router.post("/t/:token/clock-in", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const body = z
      .object({ projectId: z.string().uuid(), milestoneId: z.string().uuid().nullable().optional(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const [existingOpen] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, r.worker.id), isNotNull(timeEntriesTable.clockInAt), isNull(timeEntriesTable.clockOutAt)));
    if (existingOpen) {
      res.status(409).json({ error: "ALREADY_CLOCKED_IN", entry: serializeOwnEntry(existingOpen, null, null) });
      return;
    }
    const jobs = await workerJobs(r.worker);
    const job = jobs.find((j) => j.id === d.projectId);
    if (!job) {
      res.status(400).json({ error: "Invalid job" });
      return;
    }
    const milestoneId = d.milestoneId && job.milestones.some((m) => m.id === d.milestoneId) ? d.milestoneId : null;
    const now = new Date();
    const [entry] = await db
      .insert(timeEntriesTable)
      .values({
        userId: r.worker.userId,
        workerId: r.worker.id,
        projectId: job.id,
        milestoneId,
        date: localDayFor(now),
        hours: "0.00",
        rateCentsSnapshot: r.worker.hourlyRate,
        burdenPercentSnapshot: String(Number(r.worker.burdenPercent)),
        status: "submitted",
        enteredBy: "worker",
        clockInAt: now,
        clockInLat: d.lat !== undefined ? d.lat.toFixed(6) : null,
        clockInLng: d.lng !== undefined ? d.lng.toFixed(6) : null,
        geofenceFlagged: geofenceFlag(job, d.lat, d.lng),
      })
      .returning();
    await db.update(collaboratorsTable).set({ lastTimeEntryAt: now }).where(eq(collaboratorsTable.id, r.worker.id));
    res.status(201).json({ entry: serializeOwnEntry(entry!, job.name, milestoneId ? (job.milestones.find((m) => m.id === milestoneId)?.title ?? null) : null) });
  } catch (err) {
    req.log.error({ err }, "Error clocking in");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/t/:token/entries/:tid/clock-out
router.post("/t/:token/entries/:tid/clock-out", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const body = z.object({ lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const [entry] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.id, req.params.tid as string), eq(timeEntriesTable.workerId, r.worker.id)));
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!entry.clockInAt || entry.clockOutAt) {
      res.status(409).json({ error: "NOT_OPEN", message: "This entry isn't a currently open clock-in." });
      return;
    }
    const jobs = await workerJobs(r.worker);
    const job = jobs.find((j) => j.id === entry.projectId);
    const now = new Date();
    const rawHours = (now.getTime() - entry.clockInAt.getTime()) / 3_600_000;
    const hours = Math.min(Math.max(rawHours, 0.01), MAX_SESSION_HOURS);
    const outFlag = job ? geofenceFlag(job, d.lat, d.lng) : false;
    const [updated] = await db
      .update(timeEntriesTable)
      .set({
        hours: hours.toFixed(2),
        clockOutAt: now,
        clockOutLat: d.lat !== undefined ? d.lat.toFixed(6) : null,
        clockOutLng: d.lng !== undefined ? d.lng.toFixed(6) : null,
        geofenceFlagged: entry.geofenceFlagged || outFlag,
        note: rawHours > MAX_SESSION_HOURS ? `${entry.note} (auto-capped at ${MAX_SESSION_HOURS}h — forgot to clock out?)`.trim() : entry.note,
      })
      .where(eq(timeEntriesTable.id, entry.id))
      .returning();
    await db.update(collaboratorsTable).set({ lastTimeEntryAt: now }).where(eq(collaboratorsTable.id, r.worker.id));
    const dayKey = toIsoDate(localDayFor(new Date()));
    const already = await db.select({ id: timeEntriesTable.id }).from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, r.worker.id), eq(timeEntriesTable.enteredBy, "worker"), gte(timeEntriesTable.createdAt, new Date(`${dayKey}T00:00:00Z`)))).limit(2);
    if (already.length <= 1) {
      await createNotification({ userId: r.worker.userId, type: "time_entry_submitted", title: `${r.worker.name} ha registrato ore`, body: `${hours.toFixed(2)} h su ${job?.name ?? ""} — da approvare in Squadra.`, link: "/dashboard/team?tab=time", entityType: "time_entry", entityId: updated!.id });
    }
    res.json({ entry: serializeOwnEntry(updated!, job?.name ?? null, updated!.milestoneId ? (job?.milestones.find((m) => m.id === updated!.milestoneId)?.title ?? null) : null) });
  } catch (err) {
    req.log.error({ err }, "Error clocking out");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── SQUADRA-1: dal cantiere — report, compiti, "Da quando hai guardato" ─────

const reportBodySchema = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(FIELD_REPORT_KINDS),
  body: z.string().max(1000).optional().default(""),
  milestoneId: z.string().uuid().optional().or(z.literal("")),
  /** What it cost, in cents. Multipart sends strings. */
  materialsCents: z.coerce.number().int().min(0).max(10_000_000).optional(),
  clientRef: clientRefSchema,
});

// POST /api/t/:token/reports — multipart: optional `file` (a photo) + the fields above.
router.post(
  "/t/:token/reports",
  writeLimiter,
  (req, res, next) => {
    photoUpload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError || err instanceof Error) {
        res.status(400).json({ error: "BAD_FILE", message: err.message });
        return;
      }
      next(err);
    });
  },
  async (req, res) => {
    try {
      const r = await resolveWorker(req.params.token as string);
      if (!r || r.expired) {
        res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
        return;
      }
      const body = reportBodySchema.safeParse(req.body ?? {});
      if (!body.success) {
        res.status(400).json({ error: "Invalid parameters", details: body.error });
        return;
      }
      const d = body.data;
      const job = (await workerJobs(r.worker)).find((j) => j.id === d.projectId);
      if (!job) {
        res.status(400).json({ error: "Invalid job" });
        return;
      }
      const out = await createFieldReport({
        worker: r.worker,
        job,
        kind: d.kind,
        body: d.body,
        milestoneId: d.milestoneId || null,
        materialsCents: d.materialsCents ?? null,
        file: req.file ?? null,
        clientRef: d.clientRef ?? null,
      });
      const [report] = await serializeReports([out.report]);
      res.status(out.replayed ? 200 : 201).json({ report, replayed: out.replayed || undefined });
    } catch (err) {
      if (err instanceof FieldReportError) {
        res.status(err.status).json({ error: err.code, message: err.message });
        return;
      }
      req.log.error({ err }, "Error saving field report");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/t/:token/tasks/:taskId — { status } — tick a task from the field.
router.post("/t/:token/tasks/:taskId", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const body = z.object({ status: z.enum(["todo", "in_progress", "done"]) }).safeParse(req.body);
    const taskId = z.string().uuid().safeParse(req.params.taskId);
    if (!body.success || !taskId.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const [task] = await db.select().from(projectTasksTable).where(eq(projectTasksTable.id, taskId.data));
    // Only tasks on a job this worker can see: assigned, booked, or (with no assignments) any open job of their company.
    const jobs = task ? await workerJobs(r.worker) : [];
    if (!task || !jobs.some((j) => j.id === task.projectId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (task.status !== body.data.status) {
      // Both stamps from one instant: updated_at == field_updated_at is how "what changed" knows this one was the worker's own.
      const at = new Date();
      await db.update(projectTasksTable).set({ status: body.data.status, fieldUpdatedBy: r.worker.id, fieldUpdatedAt: at, updatedAt: at }).where(eq(projectTasksTable.id, task.id));
      await writeAudit({ userId: r.worker.userId, actorType: "user", actorId: null, entityType: "project_task", entityId: task.id, action: "task_status_from_field", diff: { workerId: r.worker.id, workerName: r.worker.name, from: task.status, to: body.data.status }, ip: req.ip ?? null, userAgent: req.get("user-agent")?.slice(0, 300) ?? null });
    }
    res.json({ task: { id: task.id, status: body.data.status } });
  } catch (err) {
    req.log.error({ err }, "Error updating task from the field");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/t/:token/jobs/:projectId/tasks — { title, milestoneId?, clientRef? }
// Only for a worker the office has allowed to (Squadra → operaio → "Può aggiungere attività").
router.post("/t/:token/jobs/:projectId/tasks", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const projectId = z.string().uuid().safeParse(req.params.projectId);
    const body = z.object({ title: z.string().max(300), milestoneId: z.string().uuid().nullable().optional(), clientRef: clientRefSchema }).safeParse(req.body);
    if (!projectId.success || !body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    if (!r.worker.canAddTasks) {
      res.status(403).json({ error: "NOT_ALLOWED", message: "Chiedi all'ufficio di poter aggiungere attività." });
      return;
    }
    const job = (await workerJobs(r.worker)).find((j) => j.id === projectId.data);
    if (!job) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const out = await addFieldTask({ worker: r.worker, job, title: body.data.title, milestoneId: body.data.milestoneId ?? null, clientRef: body.data.clientRef ?? null });
    if (!out.replayed) await writeAudit({ userId: r.worker.userId, actorType: "user", actorId: null, entityType: "project_task", entityId: out.task.id, action: "task_created_from_field", diff: { workerId: r.worker.id, workerName: r.worker.name, projectId: job.id, title: out.task.title }, ip: req.ip ?? null, userAgent: req.get("user-agent")?.slice(0, 300) ?? null });
    const t = out.task;
    res.status(out.replayed ? 200 : 201).json({ task: { id: t.id, title: t.title, status: t.status, milestoneTitle: null, dueDate: toIsoDate(t.dueDate), addedBy: t.createdByName }, replayed: out.replayed || undefined });
  } catch (err) {
    if (err instanceof FieldReportError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    req.log.error({ err }, "Error adding a task from the field");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/t/:token/seen — { upTo } — "Ho visto": moves the marker to the moment
// the list was built (not to now, so a change that landed in between is kept).
router.post("/t/:token/seen", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const body = z.object({ upTo: z.string().datetime({ offset: true }) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const upTo = new Date(Math.min(new Date(body.data.upTo).getTime(), Date.now()));
    // Never backwards: a stale tab's "Ho visto" must not resurrect what a newer one dismissed.
    if (!r.worker.crewSeenAt || upTo > r.worker.crewSeenAt) await db.update(collaboratorsTable).set({ crewSeenAt: upTo }).where(eq(collaboratorsTable.id, r.worker.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error marking the worker's changes seen");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/t/:token/entries/:tid — only while still "submitted"
router.delete("/t/:token/entries/:tid", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const [entry] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.id, req.params.tid as string), eq(timeEntriesTable.workerId, r.worker.id)));
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (entry.status !== "submitted") {
      res.status(409).json({ error: "LOCKED", message: "This entry has already been reviewed." });
      return;
    }
    await db.delete(timeEntriesTable).where(eq(timeEntriesTable.id, entry.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting worker time entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
