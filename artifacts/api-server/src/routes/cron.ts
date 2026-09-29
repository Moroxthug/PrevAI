import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { retryDueAutomations } from "../lib/automation";
import { runContractMaintenance } from "../contracts/maintenance.js";
import { runInvoiceMaintenance } from "../invoices/maintenance.js";
import { runLeadMaintenance } from "../leads/maintenance.js";
import { runJobReviewRequestMaintenance } from "../jobs/maintenance.js";
import { runQuoteFollowupMaintenance } from "../quotes/maintenance.js";
import { runSdiMaintenance } from "../sdi/maintenance.js";
import { runFiscalMaintenance } from "../fiscale/maintenance.js";
import { runAccountDeletionMaintenance } from "../account/deletion.js";
import { runAccountExportMaintenance } from "../account/export.js";
import { rollUpUsageForDate } from "../lib/usage.js";
import { runIncentivesFreshnessCheck } from "../incentives/maintenance.js";
import { runPriceIntelligenceTrendCheck } from "../priceIntelligence/maintenance.js";
import { runScheduleReminderMaintenance } from "../schedule/maintenance.js";
import { syncInboundForAllCompanies, pruneExternalEvents } from "../calendar/inbound.js";
import { db, cronTicksTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import { automationBacklog, pingHeartbeat, recentAutomationFailures, sendOpsAlert } from "../lib/ops.js";
import { captureException, flush } from "../lib/errorTracking.js";
import { runAssistantCostAlerts } from "../assistant/activity.js";
import { runAiBudgetAlerts } from "../lib/aiBudget.js";
import { sweepExpiredCounters } from "../lib/rateLimitStore.js";

const router = Router();

// Vercel sends `Authorization: Bearer $CRON_SECRET`; we accept the same
// header from any caller so a tick can be triggered manually with curl.
function cronAuthorized(req: { headers: { authorization?: string } }, res: { status: (n: number) => { json: (b: unknown) => void } }): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "CRON_SECRET not configured" });
    return false;
  }
  const header = req.headers.authorization ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(header);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// GET /api/cron/tick — invoked by Vercel Cron (see vercel.json), once a day.
router.get("/cron/tick", async (req, res) => {
  if (!cronAuthorized(req, res)) return;

  const startedAt = Date.now();
  // Phase 69: record the tick so /api/healthz/ops can tell a silent scheduler
  // from a healthy one. Never let bookkeeping stop the tick itself.
  const [tick] = await db.insert(cronTicksTable).values({}).returning({ id: cronTicksTable.id }).catch((err: unknown) => {
    req.log.error({ err }, "Could not record cron tick");
    return [] as { id: string }[];
  });
  try {
    const automations = await retryDueAutomations();
    const contracts = await runContractMaintenance();
    const invoices = await runInvoiceMaintenance();
    const leads = await runLeadMaintenance();
    const reviewRequests = await runJobReviewRequestMaintenance();
    const incentives = await runIncentivesFreshnessCheck();
    const priceTrends = await runPriceIntelligenceTrendCheck();
    const quoteFollowups = await runQuoteFollowupMaintenance();
    // A-1: stati SdI non arrivati via webhook, fatture di acquisto, bollo trimestrale.
    const sdi = await runSdiMaintenance();
    // A-2: monitor della soglia degli 85.000 € (avvisa solo quando il livello peggiora).
    const fiscale = await runFiscalMaintenance();
    // APP-1c: promemoria e cancellazioni degli account arrivati ai 30 giorni (inerte senza la 0010).
    const accountDeletions = await runAccountDeletionMaintenance();
    // Roll up yesterday's (and today's, in case cron shifted) usage_events into the daily summary.
    const usage = await rollUpUsageForDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    await rollUpUsageForDate(new Date());
    // APP-8h: avviso allo staff quando un'impresa supera il costo dell'assistente per posto.
    const assistantCosts = await runAssistantCostAlerts();
    // SEC-2: avviso allo staff quando un'impresa passa l'80 % del tetto IA del mese; contatori dei limiti scaduti.
    const aiBudget = await runAiBudgetAlerts();
    const rateLimitRowsSwept = await sweepExpiredCounters();
    // AGENDA-1: promemoria ai lavoranti per i blocchi di oggi rimasti senza avviso (il giro della sera è /cron/evening).
    const scheduleReminders = await runScheduleReminderMaintenance();
    // AGENDA-1: calendari collegati e file .ics letti nella copia locale che mostra l'agenda; via gli eventi vecchi.
    const calendarInbound = await syncInboundForAllCompanies();
    const calendarPruned = await pruneExternalEvents();
    // GDPR-1: esportazioni lasciate a metà (pagina chiusa) e ZIP scaduti (inerte senza la 0017). Per ultima: usa il tempo che resta.
    const accountExports = await runAccountExportMaintenance(new Date(), 25_000);
    const result = { automations, contracts, invoices, leads, reviewRequests, incentives, priceTrends, quoteFollowups, sdi, fiscale, accountDeletions, usage, assistantCosts, aiBudget, rateLimitRowsSwept, scheduleReminders, calendarInbound, calendarPruned, accountExports };
    const tookMs = Date.now() - startedAt;
    if (tick) await db.update(cronTicksTable).set({ finishedAt: new Date(), ok: true, result, tookMs }).where(eq(cronTicksTable.id, tick.id));
    await db.delete(cronTicksTable).where(lt(cronTicksTable.startedAt, new Date(Date.now() - 90 * 24 * 3_600_000)));

    // Anything the retry loop could not fix since the last tick is the
    // operator's problem now: dead runs never retry, and a failed run whose
    // next attempt is already due means the backoff outlived the schedule.
    const backlog = await automationBacklog();
    if (backlog.dead > 0 || backlog.failed > 0) {
      const rows = await recentAutomationFailures(new Date(Date.now() - 25 * 3_600_000));
      await sendOpsAlert(
        `${backlog.dead} dead / ${backlog.failed} failed automation run(s)`,
        [
          `Cron tick finished OK in ${tookMs} ms but the automation queue has ${backlog.dead} dead and ${backlog.failed} overdue-failed run(s).`,
          "",
          ...rows.map((r) => `- [${r.status}] ${r.event} ${r.entityType}/${r.entityId} user=${r.userId} attempts=${r.attempts} — ${(r.lastError ?? "").slice(0, 300)}`),
          rows.length === 0 ? "(older than 25 h — see the admin automations table)" : "",
          "",
          "Retry: POST /api/admin/automations/:id/retry (see docs/RUNBOOKS.md → Cron / automation failures).",
        ],
      );
    }
    await pingHeartbeat();
    await flush(1500);
    res.json({ ok: true, ...result, backlog, tookMs });
  } catch (err) {
    req.log.error({ err }, "Cron tick failed");
    const message = err instanceof Error ? err.message : String(err);
    if (tick) await db.update(cronTicksTable).set({ finishedAt: new Date(), ok: false, error: message.slice(0, 2000), tookMs: Date.now() - startedAt }).where(eq(cronTicksTable.id, tick.id)).catch(() => undefined);
    await captureException(err, { mechanism: "cron", handled: false, level: "fatal", tags: { route: "GET /api/cron/tick" } });
    await sendOpsAlert("Cron tick failed", [`/api/cron/tick threw after ${Date.now() - startedAt} ms:`, message, "", "Nothing scheduled ran after the failing step; the next tick retries everything. See docs/RUNBOOKS.md → Cron / automation failures."]);
    await flush(1500);
    res.status(500).json({ ok: false });
  }
});

// GET /api/cron/evening — il secondo cron del giorno (16:00 UTC = 18:00 d’estate,
// 17:00 d’inverno): manda a ogni operaio i suoi blocchi di domani (AGENDA-1).
// Volutamente minimo — nient’altro va nel giro della sera — e non tocca
// cron_ticks, che sorveglia il battito del tick principale.
router.get("/cron/evening", async (req, res) => {
  if (!cronAuthorized(req, res)) return;
  const startedAt = Date.now();
  try {
    const scheduleReminders = await runScheduleReminderMaintenance();
    res.json({ ok: true, scheduleReminders, tookMs: Date.now() - startedAt });
  } catch (err) {
    req.log.error({ err }, "Evening cron failed");
    await captureException(err, { mechanism: "cron", handled: false, level: "error", tags: { route: "GET /api/cron/evening" } });
    await sendOpsAlert("Evening cron failed", [`/api/cron/evening threw after ${Date.now() - startedAt} ms:`, err instanceof Error ? err.message : String(err), "", "I promemoria di domani alla squadra non sono partiti; il tick di mezzogiorno recupera quelli del giorno stesso."]);
    await flush(1500);
    res.status(500).json({ ok: false });
  }
});

export default router;
