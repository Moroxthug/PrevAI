import { Router } from "express";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db, businessProfilesTable, organizationMembersTable, quotesTable, usageDailySummaryTable, PRODUCT_FEATURES, MONTHLY_USAGE_ALLOWANCE, effectivePlan, hasFeature, seatsLimit } from "@workspace/db";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { PLANS } from "./payments.js";

const router = Router();

// GET /api/plan/overview — POCKET-5 (riga 62, QuoteAI 128.4): Piano e fatturazione nell'app. Il piano e il suo stato, l'uso del mese contro
// quello che il piano permette (posti, preventivi, scontrini letti) e le funzioni che ha (comprese quelle dell'add-on Fisco). Solo lettura, per
// ogni ruolo (un membro vede solo l'uso); comprare e cambiare il piano si fa su prevai.it. PrevAI non ha tetto ai cantieri aperti né SMS.
router.get("/plan/overview", requireAuth, async (req, res) => {
  try {
    const orgId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
    const plan = effectivePlan(profile);
    const def = PLANS.find((p) => p.id === plan) ?? null;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const [members, quotes, usage] = await Promise.all([
      db.select({ id: organizationMembersTable.id }).from(organizationMembersTable).where(and(eq(organizationMembersTable.ownerId, orgId), ne(organizationMembersTable.status, "suspended"))),
      def?.quotaPerMonth != null
        ? db.select({ n: sql<number>`count(*)::int` }).from(quotesTable).where(and(eq(quotesTable.userId, orgId), gte(quotesTable.createdAt, monthStart), lt(quotesTable.createdAt, nextMonth)))
        : Promise.resolve(null),
      db.select().from(usageDailySummaryTable).where(and(eq(usageDailySummaryTable.userId, orgId), gte(usageDailySummaryTable.date, day(monthStart)))),
    ]);
    const scans = usage.filter((r) => r.kind === "ai_vision").reduce((s, r) => s + r.eventCount, 0);
    const allowance = MONTHLY_USAGE_ALLOWANCE[plan];
    const status = profile?.subscriptionStatus ?? null;

    res.json({
      plan,
      name: def?.name ?? (plan === "free" ? "Free" : plan),
      status,
      active: status === "active" || status === "trialing",
      interval: "month",
      periodEnd: profile?.subscriptionPeriodEnd?.toISOString() ?? null,
      coveredBy: null,
      resetsOn: day(nextMonth),
      logins: { used: members.length + 1, limit: seatsLimit(plan, profile?.extraSeats) },
      quotes: def?.quotaPerMonth != null ? { used: quotes?.[0]?.n ?? 0, limit: def.quotaPerMonth } : null,
      openJobs: null,
      receiptScans: allowance.receiptScans === null ? null : { used: scans, limit: allowance.receiptScans },
      texts: null,
      features: PRODUCT_FEATURES.filter((f) => hasFeature(profile, f)),
    });
  } catch (err) {
    req.log.error({ err }, "Plan overview error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
