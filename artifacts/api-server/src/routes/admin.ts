import { Router, type Request, type Response, type NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { db, quotesTable, businessProfilesTable, settingsTable, authUsersTable } from "@workspace/db";
import { eq, sql, desc, count, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../stripeClient";

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TUdJjCaDBaDETvnCGbjTgIq": "monthly_starter",
  "price_1TUdJjCaDBaDETvnfBv37ryF": "monthly_pro",
  "price_1TUdJjCaDBaDETvnCo3JKGJ7": "monthly_elite",
};

const router = Router();

async function isAdmin(req: Request): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return false;
    return session.user.email.toLowerCase() === adminEmail.toLowerCase();
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

router.use("/admin", requireAdmin);

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
    const mrr = starterCount * 19 + proCount * 49;

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

router.get("/admin/users", async (_req, res) => {
  try {
    const profiles = await db
      .select()
      .from(businessProfilesTable)
      .orderBy(desc(businessProfilesTable.createdAt))
      .limit(200);

    const userIds = profiles.map(p => p.userId);
    let authUsers: Record<string, { email: string; name: string }> = {};

    if (userIds.length > 0) {
      try {
        const users = await db
          .select({ id: authUsersTable.id, email: authUsersTable.email, name: authUsersTable.name })
          .from(authUsersTable)
          .where(inArray(authUsersTable.id, userIds));
        for (const u of users) {
          authUsers[u.id] = { email: u.email, name: u.name };
        }
      } catch (dbErr) {
        logger.error({ err: dbErr }, "Failed to fetch auth users (non-fatal)");
      }
    }

    const rows = profiles.map(p => ({
      userId: p.userId,
      email: authUsers[p.userId]?.email ?? "",
      firstName: authUsers[p.userId]?.name ?? "",
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

router.post("/admin/sync-subscription", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "email required" });
      return;
    }

    const stripe = await getUncachableStripeClient();

    // Search Stripe for customers with this email
    const customers = await stripe.customers.list({ email, limit: 5 });
    if (customers.data.length === 0) {
      res.status(404).json({ error: `No Stripe customer found for email: ${email}` });
      return;
    }

    // Find our user by email
    const [authUser] = await db
      .select({ id: authUsersTable.id })
      .from(authUsersTable)
      .where(eq(authUsersTable.email, email));

    if (!authUser) {
      res.status(404).json({ error: `No app user found for email: ${email}` });
      return;
    }

    // Try each Stripe customer (might have multiple), look for active subscription
    let synced: { customerId: string; planType: string; status: string } | null = null;

    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 5 });
      for (const sub of subs.data) {
        const priceId = sub.items.data[0]?.price?.id;
        const planType = priceId ? PRICE_TO_PLAN[priceId] : undefined;
        if (!planType) continue;

        const isActive = sub.status === "active" || sub.status === "trialing";
        await db
          .insert(businessProfilesTable)
          .values({
            userId: authUser.id,
            stripeCustomerId: customer.id,
            subscriptionPlan: isActive ? planType : null,
            subscriptionStatus: isActive ? "active" : sub.status,
          })
          .onConflictDoUpdate({
            target: businessProfilesTable.userId,
            set: {
              stripeCustomerId: customer.id,
              subscriptionPlan: isActive ? planType : null,
              subscriptionStatus: isActive ? "active" : sub.status,
            },
          });

        logger.info({ userId: authUser.id, customerId: customer.id, planType, status: sub.status }, "Admin manual subscription sync");
        synced = { customerId: customer.id, planType, status: sub.status };
        if (isActive) break; // prefer active sub
      }
      if (synced?.status === "active") break;
    }

    if (!synced) {
      res.status(404).json({ error: "No matching subscription found for this customer's price IDs" });
      return;
    }

    res.json({ ok: true, synced });
  } catch (err) {
    logger.error({ err }, "Admin sync-subscription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

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
