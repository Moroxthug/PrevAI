import { db, scheduleBlocksTable, collaboratorsTable, projectsTable, businessProfilesTable, DEFAULT_AUTOMATION_SETTINGS, type BusinessProfile } from "@workspace/db";
import { and, gt, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { sendWorkerScheduleReminderEmail } from "../lib/emailTeam.js";
import { logger } from "../lib/logger.js";
import { reminderBody, reminderDue, blockLabel } from "./service.js";

// ── AGENDA-1: promemoria alla squadra (cron) ─────────────────────────────────
// La sera prima di un blocco (e la mattina stessa, per recuperare) ogni
// operaio assegnato riceve un'email. PrevAI non ha SMS: senza email non c'è
// canale. Un invio per blocco: `reminder_sent_at` viene segnato comunque,
// anche quando non c'è un canale, così il giro non riprova all'infinito.
// Spostare un blocco azzera il segno (routes/schedule.ts) e il nuovo orario
// riceve il suo promemoria.

const DAY_MS = 86_400_000;

export async function runScheduleReminderMaintenance(now = new Date()): Promise<{ email: number; skipped: number }> {
  const candidates = await db
    .select()
    .from(scheduleBlocksTable)
    .where(and(isNull(scheduleBlocksTable.reminderSentAt), isNotNull(scheduleBlocksTable.collaboratorId), gt(scheduleBlocksTable.startsAt, now), lt(scheduleBlocksTable.startsAt, new Date(now.getTime() + 2 * DAY_MS))))
    .limit(500);
  const result = { email: 0, skipped: 0 };
  if (!candidates.length) return result;

  const profiles = new Map<string, BusinessProfile>();
  for (const p of await db.select().from(businessProfilesTable).where(inArray(businessProfilesTable.userId, [...new Set(candidates.map((b) => b.userId))]))) profiles.set(p.userId, p);
  const workers = new Map<string, typeof collaboratorsTable.$inferSelect>();
  for (const w of await db.select().from(collaboratorsTable).where(inArray(collaboratorsTable.id, [...new Set(candidates.map((b) => b.collaboratorId!))]))) workers.set(w.id, w);
  const projectIds = [...new Set(candidates.map((b) => b.projectId).filter((id): id is string => !!id))];
  const projects = new Map<string, { name: string; address: string }>();
  if (projectIds.length) for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address }).from(projectsTable).where(inArray(projectsTable.id, projectIds))) projects.set(p.id, p);

  for (const block of candidates) {
    const profile = profiles.get(block.userId);
    if (!profile) continue;
    const settings = { ...DEFAULT_AUTOMATION_SETTINGS, ...(profile.automationSettings ?? {}) };
    if (!settings.scheduleReminders) continue;
    const kind = reminderDue(block, now);
    if (!kind) continue;
    const worker = workers.get(block.collaboratorId!);
    if (!worker || !worker.active) continue;
    const project = block.projectId ? projects.get(block.projectId) : undefined;
    const jobName = project?.name ?? null;
    let outcome: "email" | "skipped" = "skipped";
    if (worker.email) {
      try {
        const body = reminderBody({ kind, block, jobName, address: project?.address || null });
        await sendWorkerScheduleReminderEmail({ toEmail: worker.email, workerName: worker.name, companyName: profile.companyName ?? "", kind, body, label: blockLabel(block, jobName) });
        outcome = "email";
      } catch (err) {
        logger.error({ err, blockId: block.id }, "Schedule reminder email failed");
      }
    }
    result[outcome]++;
    await db.update(scheduleBlocksTable).set({ reminderSentAt: now }).where(and(isNull(scheduleBlocksTable.reminderSentAt), inArray(scheduleBlocksTable.id, [block.id])));
  }
  return result;
}
