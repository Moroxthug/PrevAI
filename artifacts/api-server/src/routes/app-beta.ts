import { Router } from "express";
import { z } from "zod";
import { db, appEventsTable, appFeedbackTable, businessProfilesTable, APP_EVENT_KINDS, APP_SURFACES, APP_FEEDBACK_STATES } from "@workspace/db";
import { desc, eq, gte, inArray, sql } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId, getUserEmail } from "../middlewares/authMiddleware.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { sendOpsAlert } from "../lib/ops.js";
import { requireAdmin } from "./admin.js";

// ── APP-5: beta con le imprese pilota (docs/APP-PLAN.md §5) ─────────────────
// - POST /api/app/events     three usage events, stamped with the surface
// - POST /api/app/feedback   "Segnala un problema" (stored + emailed to ops + Sentry)
// - GET  /api/admin/app-beta the pilot report: per company, per surface
// - PATCH /api/admin/app-beta/feedback/:id  nuovo → visto → risolto
//
// Inert until migrations/v2/0009_app5_beta.sql runs: without the tables,
// events are accepted and dropped (204), feedback answers 503 and the report
// says `migrated: false`. Nothing here ever blocks the dashboard.

const router = Router();

/** Postgres "relation does not exist": the 0009 migration has not run yet. */
function missingTable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

const eventsLimiter = userRateLimiter({ name: "app-beta.eventsLimiter", windowMs: 60_000, max: 60, message: "Too many events" });
const feedbackLimiter = userRateLimiter({ name: "app-beta.feedbackLimiter", windowMs: 60 * 60_000, max: 10, message: "Hai inviato molte segnalazioni: riprova tra un po'." });

const common = {
  surface: z.enum(APP_SURFACES),
  viewport: z.enum(["phone", "desktop"]).default("desktop"),
  appVersion: z.string().max(64).optional(),
};

const eventSchema = z.object({
  kind: z.enum(APP_EVENT_KINDS),
  entityId: z.string().max(64).optional(),
  channel: z.enum(["link", "email", "share_sheet"]).optional(),
  ...common,
});

router.post("/app/events", requireAuth, eventsLimiter, async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid event" });
    return;
  }
  const e = parsed.data;
  try {
    await db.insert(appEventsTable).values({
      userId: getUserId(res),
      actorUserId: getActorUserId(res),
      kind: e.kind,
      surface: e.surface,
      viewport: e.viewport,
      appVersion: e.appVersion ?? null,
      entityId: e.kind === "app_open" ? null : (e.entityId ?? null),
      channel: e.kind === "quote_shared" ? (e.channel ?? null) : null,
    });
    res.status(204).end();
  } catch (err) {
    if (!missingTable(err)) req.log.error({ err }, "Error recording app event");
    // Usage events are best-effort: the app never waits on them or shows an error.
    res.status(204).end();
  }
});

const feedbackSchema = z.object({
  message: z.string().trim().min(5).max(2000),
  route: z.string().max(300).default(""),
  ...common,
});

router.post("/app/feedback", requireAuth, feedbackLimiter, async (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Scrivi almeno qualche parola sul problema." });
    return;
  }
  const f = parsed.data;
  const userId = getUserId(res);
  const email = getUserEmail(res);
  const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 400);
  const route = f.route.split("?")[0]!;
  try {
    const [row] = await db
      .insert(appFeedbackTable)
      .values({
        userId,
        actorUserId: getActorUserId(res),
        actorEmail: email,
        message: f.message,
        route,
        surface: f.surface,
        viewport: f.viewport,
        appVersion: f.appVersion ?? null,
        userAgent,
      })
      .returning({ id: appFeedbackTable.id });
    const [profile] = await db
      .select({ companyName: businessProfilesTable.companyName })
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));
    await sendOpsAlert(`Segnalazione beta: ${profile?.companyName || email}`, [
      f.message,
      "",
      `Da: ${email} (${profile?.companyName ?? "—"})`,
      `Pagina: ${route || "—"} · ${f.surface} · ${f.viewport} · versione ${f.appVersion ?? "—"}`,
      `Browser: ${userAgent || "—"}`,
      `Pannello: https://prevai.it/dashboard/admin → Beta app (id ${row!.id})`,
    ]);
    res.status(201).json({ id: row!.id });
  } catch (err) {
    if (missingTable(err)) {
      res.status(503).json({ error: "Le segnalazioni non sono ancora attive. Scrivici dalla chat di assistenza." });
      return;
    }
    req.log.error({ err }, "Error saving app feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: the pilot report ─────────────────────────────────────────────────

const NATIVE = ["android", "ios"] as const;

router.get("/admin/app-beta", requireAdmin, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
  const since = new Date(Date.now() - days * 86_400_000);
  try {
    const byOrg = await db
      .select({
        userId: appEventsTable.userId,
        kind: appEventsTable.kind,
        surface: appEventsTable.surface,
        n: sql<number>`count(*)::int`,
        last: sql<string>`to_char(max(${appEventsTable.createdAt}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(appEventsTable)
      .where(gte(appEventsTable.createdAt, since))
      .groupBy(appEventsTable.userId, appEventsTable.kind, appEventsTable.surface);

    const ids = [...new Set(byOrg.map((r) => r.userId))];
    const names = ids.length
      ? await db
          .select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName })
          .from(businessProfilesTable)
          .where(inArray(businessProfilesTable.userId, ids))
      : [];
    const nameOf = new Map(names.map((n) => [n.userId, n.companyName]));

    type Counts = { app_open: number; quote_created: number; quote_shared: number };
    const zero = (): Counts => ({ app_open: 0, quote_created: 0, quote_shared: 0 });
    const totals: Record<string, Counts> = Object.fromEntries(APP_SURFACES.map((s) => [s, zero()]));
    const orgs = new Map<string, { userId: string; companyName: string; total: Counts; native: Counts; surfaces: Set<string>; lastSeen: string }>();
    for (const r of byOrg) {
      totals[r.surface] ??= zero();
      totals[r.surface]![r.kind] += r.n;
      let o = orgs.get(r.userId);
      if (!o) {
        o = { userId: r.userId, companyName: nameOf.get(r.userId) || "—", total: zero(), native: zero(), surfaces: new Set(), lastSeen: r.last };
        orgs.set(r.userId, o);
      }
      o.total[r.kind] += r.n;
      if ((NATIVE as readonly string[]).includes(r.surface)) o.native[r.kind] += r.n;
      o.surfaces.add(r.surface);
      if (r.last > o.lastSeen) o.lastSeen = r.last;
    }

    const feedback = await db.select().from(appFeedbackTable).orderBy(desc(appFeedbackTable.createdAt)).limit(100);
    const feedbackNames = new Map(nameOf);
    const missing = [...new Set(feedback.map((f) => f.userId))].filter((id) => !feedbackNames.has(id));
    if (missing.length) {
      const more = await db
        .select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName })
        .from(businessProfilesTable)
        .where(inArray(businessProfilesTable.userId, missing));
      for (const m of more) feedbackNames.set(m.userId, m.companyName);
    }

    const nativeQuotes = NATIVE.reduce((s, k) => s + (totals[k]?.quote_created ?? 0), 0);
    res.json({
      migrated: true,
      days,
      since: since.toISOString(),
      totals,
      // APP-PLAN §5 APP-5 "fatto quando": 20 quotes created from the app by the pilot companies.
      goal: { nativeQuotes, target: 20 },
      orgs: [...orgs.values()]
        .map((o) => ({ ...o, surfaces: [...o.surfaces].sort() }))
        .sort((a, b) => b.native.quote_created - a.native.quote_created || b.total.quote_created - a.total.quote_created || b.lastSeen.localeCompare(a.lastSeen)),
      feedback: feedback.map((f) => ({
        id: f.id,
        createdAt: f.createdAt,
        companyName: feedbackNames.get(f.userId) || "—",
        email: f.actorEmail,
        message: f.message,
        route: f.route,
        surface: f.surface,
        viewport: f.viewport,
        appVersion: f.appVersion,
        userAgent: f.userAgent,
        stato: f.stato,
      })),
    });
  } catch (err) {
    if (missingTable(err)) {
      res.json({ migrated: false, days, since: since.toISOString(), totals: {}, goal: { nativeQuotes: 0, target: 20 }, orgs: [], feedback: [] });
      return;
    }
    req.log.error({ err }, "Error building app beta report");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/app-beta/feedback/:id", requireAdmin, async (req, res) => {
  const parsed = z.object({ stato: z.enum(APP_FEEDBACK_STATES) }).safeParse(req.body);
  const id = z.string().uuid().safeParse(req.params.id);
  if (!parsed.success || !id.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    const [row] = await db
      .update(appFeedbackTable)
      .set({ stato: parsed.data.stato })
      .where(eq(appFeedbackTable.id, id.data))
      .returning({ id: appFeedbackTable.id, stato: appFeedbackTable.stato });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Error updating app feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
