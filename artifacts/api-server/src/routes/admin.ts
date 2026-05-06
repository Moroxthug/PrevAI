import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/express";
import { db, quotesTable, businessProfilesTable, settingsTable } from "@workspace/db";
import { eq, sql, desc, count } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

async function isAdmin(req: Request): Promise<boolean> {
  const { userId } = getAuth(req);
  if (!userId) return false;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress ?? "";
    return email.toLowerCase() === adminEmail.toLowerCase();
  } catch {
    return false;
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ok = await isAdmin(req);
  if (!ok) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// ── Public endpoint: check if registration is open ────────────────────────────
router.get("/settings/registration", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "registration_open"));
    const isOpen = row ? row.value !== "false" : true;
    res.json({ open: isOpen });
  } catch {
    res.json({ open: true });
  }
});

// All routes below require admin ──────────────────────────────────────────────
router.use("/admin", requireAdmin);

// GET /api/admin/metrics
router.get("/admin/metrics", async (_req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsersRow,
      subscriptionRows,
      quoteTotalRow,
      quotesThisMonthRow,
      quotesPrevMonthRow,
      usersThisMonthRow,
    ] = await Promise.all([
      db.select({ count: count() }).from(businessProfilesTable),
      db.select({
        plan: businessProfilesTable.subscriptionPlan,
        status: businessProfilesTable.subscriptionStatus,
        cnt: count(),
      })
        .from(businessProfilesTable)
        .groupBy(businessProfilesTable.subscriptionPlan, businessProfilesTable.subscriptionStatus),
      db.select({ total: count(), revenue: sql<string>`COALESCE(SUM(totale::numeric), 0)` }).from(quotesTable),
      db.select({ cnt: count() }).from(quotesTable).where(sql`created_at >= ${monthStart.toISOString()}`),
      db.select({ cnt: count() }).from(quotesTable).where(
        sql`created_at >= ${prevMonthStart.toISOString()} AND created_at < ${monthStart.toISOString()}`
      ),
      db.select({ cnt: count() }).from(businessProfilesTable).where(
        sql`created_at >= ${monthStart.toISOString()}`
      ),
    ]);

    const totalUsers = totalUsersRow[0]?.count ?? 0;
    const totalQuotes = quoteTotalRow[0]?.total ?? 0;
    const totalQuoteRevenue = Number(quoteTotalRow[0]?.revenue ?? 0);
    const quotesThisMonth = quotesThisMonthRow[0]?.cnt ?? 0;
    const quotesPrevMonth = quotesPrevMonthRow[0]?.cnt ?? 0;
    const usersThisMonth = usersThisMonthRow[0]?.cnt ?? 0;

    let starterCount = 0;
    let proCount = 0;
    let activeSubscriptions = 0;
    for (const row of subscriptionRows) {
      if (row.status === "active") {
        activeSubscriptions += Number(row.cnt);
        if (row.plan === "monthly_starter") starterCount += Number(row.cnt);
        if (row.plan === "monthly_pro") proCount += Number(row.cnt);
      }
    }
    const mrr = starterCount * 29 + proCount * 79;

    res.json({
      totalUsers,
      usersThisMonth,
      activeSubscriptions,
      starterCount,
      proCount,
      mrr,
      totalQuotes,
      quotesThisMonth,
      quotesPrevMonth,
      totalQuoteRevenue,
    });
  } catch (err) {
    logger.error({ err }, "Admin metrics error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/users
router.get("/admin/users", async (_req, res) => {
  try {
    const profiles = await db
      .select()
      .from(businessProfilesTable)
      .orderBy(desc(businessProfilesTable.createdAt))
      .limit(200);

    const userIds = profiles.map(p => p.userId);
    let clerkUsers: Record<string, { email: string; firstName: string | null }> = {};

    if (userIds.length > 0) {
      try {
        const { data: users } = await clerkClient.users.getUserList({ userId: userIds, limit: 200 });
        for (const u of users) {
          clerkUsers[u.id] = {
            email: u.emailAddresses[0]?.emailAddress ?? "",
            firstName: u.firstName,
          };
        }
      } catch (clerkErr) {
        logger.error({ err: clerkErr }, "Failed to fetch Clerk users (non-fatal)");
      }
    }

    const rows = profiles.map(p => ({
      userId: p.userId,
      email: clerkUsers[p.userId]?.email ?? "",
      firstName: clerkUsers[p.userId]?.firstName ?? "",
      companyName: p.companyName,
      subscriptionPlan: p.subscriptionPlan ?? null,
      subscriptionStatus: p.subscriptionStatus ?? null,
      stripeCustomerId: p.stripeCustomerId ?? null,
      createdAt: p.createdAt.toISOString(),
    }));

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Admin users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/settings
router.get("/admin/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    logger.error({ err }, "Admin settings get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/settings
router.post("/admin/settings", async (req, res) => {
  try {
    const { key, value } = req.body as { key: string; value: string };
    if (!key || value === undefined) {
      res.status(400).json({ error: "key and value required" });
      return;
    }
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Admin settings post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/quote-stats
router.get("/admin/quote-stats", async (_req, res) => {
  try {
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);

    const dailyRows = await db.execute(
      sql`SELECT DATE(created_at AT TIME ZONE 'Europe/Rome') as day, COUNT(*)::int as cnt
          FROM quotes
          WHERE created_at >= ${last30.toISOString()}
          GROUP BY day
          ORDER BY day ASC`
    );

    res.json({ daily: dailyRows.rows });
  } catch (err) {
    logger.error({ err }, "Admin quote stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
