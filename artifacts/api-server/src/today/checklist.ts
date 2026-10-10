// POCKET-2 (QuoteAI Phase 146) — la lista «Da fare oggi» della Home dell'app: quello che serve alla persona
// (needsYou: bonifici, documenti scaduti, ore, richiami, preventivi senza risposta) e i compiti dei
// cantieri in scadenza entro oggi, ciascuno con una spunta tonda. Spuntare un compito lo completa davvero;
// spuntare qualsiasi altra cosa vuol dire «gestito oggi» (today_checks) e resta spuntato fino a mezzanotte.

import { and, asc, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { db, projectTasksTable, projectsTable, todayChecksTable, type BusinessProfile, type TeamMemberRole } from "@workspace/db";
import { MARKET } from "@workspace/config";
import { roleCan } from "../middlewares/requirePermission.js";
import { needsYou, type NeedsYouItem } from "./service.js";
import { localParts } from "../schedule/service.js";
import { localMidnight } from "./business.js";

const TASKS = 10;
const DAY_MS = 86_400_000;

export type ChecklistItem = (Omit<NeedsYouItem, "kind"> & { kind: NeedsYouItem["kind"] | "task" }) & {
  done: boolean;
  /** compito: il nome del suo cantiere (i giorni di ritardo stanno in `days`, 0 = scade oggi). */
  jobName?: string;
};

export async function checklist(userId: string, memberUserId: string, role: TeamMemberRole, profile: BusinessProfile | undefined, now = new Date()): Promise<{ day: string; items: ChecklistItem[] }> {
  const day = localParts(now).day;
  const [needs, ticks] = await Promise.all([
    needsYou(userId, role, profile, now),
    db.select({ itemId: todayChecksTable.itemId }).from(todayChecksTable).where(and(eq(todayChecksTable.memberUserId, memberUserId), eq(todayChecksTable.userId, userId), eq(todayChecksTable.day, day))),
  ]);
  const ticked = new Set(ticks.map((t) => t.itemId));
  const items: ChecklistItem[] = needs.map((n) => ({ ...n, done: ticked.has(n.id) }));

  if (roleCan(role, "jobs", "view")) {
    const tomorrow = new Date(localMidnight(day, MARKET.timeZone).getTime() + DAY_MS);
    const tasks = await db
      .select({ id: projectTasksTable.id, title: projectTasksTable.title, status: projectTasksTable.status, dueDate: projectTasksTable.dueDate, projectId: projectTasksTable.projectId, jobName: projectsTable.name })
      .from(projectTasksTable)
      .innerJoin(projectsTable, eq(projectTasksTable.projectId, projectsTable.id))
      .where(and(eq(projectsTable.userId, userId), isNull(projectsTable.archivedAt), inArray(projectsTable.status, ["planning", "active"]), lt(projectTasksTable.dueDate, tomorrow), ne(projectTasksTable.status, "done")))
      .orderBy(asc(projectTasksTable.dueDate))
      .limit(TASKS);
    // I compiti finiti oggi restano nella lista, spuntati.
    const tickedTasks = [...ticked].filter((i) => i.startsWith("task:")).map((i) => i.slice(5));
    const doneToday = tickedTasks.length === 0 ? [] : await db
      .select({ id: projectTasksTable.id, title: projectTasksTable.title, dueDate: projectTasksTable.dueDate, projectId: projectTasksTable.projectId, jobName: projectsTable.name })
      .from(projectTasksTable)
      .innerJoin(projectsTable, eq(projectTasksTable.projectId, projectsTable.id))
      .where(and(eq(projectsTable.userId, userId), eq(projectTasksTable.status, "done"), inArray(projectTasksTable.id, tickedTasks)));
    for (const t of [...tasks.map((x) => ({ ...x, done: false })), ...doneToday.map((x) => ({ ...x, done: true }))]) {
      const days = t.dueDate ? Math.max(0, Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${localParts(t.dueDate).day}T00:00:00Z`)) / DAY_MS)) : 0;
      items.push({ id: `task:${t.id}`, kind: "task", title: t.title, subtitle: "", jobName: t.jobName, at: t.dueDate?.toISOString() ?? null, href: `/dashboard/jobs/${t.projectId}?tab=tasks`, days, done: t.done });
    }
  }
  return { day, items };
}

/** Spunta o toglie la spunta di una voce per oggi. Un compito di cantiere viene completato (o riaperto) davvero. */
export async function setChecked(userId: string, memberUserId: string, role: TeamMemberRole, itemId: string, done: boolean, now = new Date()): Promise<"ok" | "forbidden" | "not_found"> {
  const day = localParts(now).day;
  if (itemId.startsWith("task:")) {
    if (!roleCan(role, "jobs", "edit")) return "forbidden";
    const id = itemId.slice(5);
    const [task] = await db.select({ id: projectTasksTable.id }).from(projectTasksTable).innerJoin(projectsTable, eq(projectTasksTable.projectId, projectsTable.id)).where(and(eq(projectTasksTable.id, id), eq(projectsTable.userId, userId)));
    if (!task) return "not_found";
    await db.update(projectTasksTable).set({ status: done ? "done" : "todo" }).where(eq(projectTasksTable.id, id));
  }
  if (done) {
    await db.insert(todayChecksTable).values({ userId, memberUserId, day, itemId }).onConflictDoNothing();
  } else {
    await db.delete(todayChecksTable).where(and(eq(todayChecksTable.memberUserId, memberUserId), eq(todayChecksTable.day, day), eq(todayChecksTable.itemId, itemId)));
  }
  return "ok";
}
