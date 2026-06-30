import { Router, type Request, type Response, type NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { db, quotesTable, businessProfilesTable, settingsTable, authUsersTable } from "@workspace/db";
import { eq, sql, desc, count, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../stripeClient";
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";
import path from "path";

import { PRICE_TO_PLAN } from "./payments.js";

const router = Router();

async function isAdmin(req: Request): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.admin_email;
  if (!adminEmail) return false;
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return false;
    const cleanEmailStr = adminEmail.replace(/['"]/g, "");
    const emails = cleanEmailStr.split(",").map(e => e.trim().toLowerCase());
    return emails.includes(session.user.email.toLowerCase());
  } catch (err) {
    logger.error({ err }, "isAdmin check failed with exception");
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

router.post("/admin/grant-plan", async (req, res) => {
  try {
    const { email, plan, days = 365 } = req.body as { email?: string; plan?: string; days?: number };
    if (!email || !plan) {
      res.status(400).json({ error: "email and plan required" });
      return;
    }
    const validPlans = ["monthly_starter", "monthly_pro", "monthly_elite"];
    if (!validPlans.includes(plan)) {
      res.status(400).json({ error: `Invalid plan. Valid values: ${validPlans.join(", ")}` });
      return;
    }
    const [authUser] = await db.select().from(authUsersTable).where(eq(authUsersTable.email, email));
    if (!authUser) {
      res.status(404).json({ error: `No user found with email: ${email}` });
      return;
    }
    const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await db.insert(businessProfilesTable).values({
      userId: authUser.id,
      companyName: "",
      subscriptionPlan: plan,
      subscriptionStatus: "active",
      subscriptionPeriodEnd: periodEnd,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: businessProfilesTable.userId,
      set: {
        subscriptionPlan: plan,
        subscriptionStatus: "active",
        subscriptionPeriodEnd: periodEnd,
        updatedAt: new Date(),
      },
    });
    logger.info({ email, plan, days, userId: authUser.id }, "Admin manually granted plan");
    res.json({ ok: true, email, plan, periodEnd, userId: authUser.id });
  } catch (err) {
    logger.error({ err }, "Admin grant-plan error");
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

// Force-link a Stripe customer to a prevai user (useful when emails don't match)
router.post("/admin/sync-by-customer", requireAdmin, async (req, res) => {
  try {
    const { stripeCustomerId, userEmail } = req.body as { stripeCustomerId?: string; userEmail?: string };
    if (!stripeCustomerId || !userEmail) {
      res.status(400).json({ error: "stripeCustomerId and userEmail required" });
      return;
    }

    // Find prevai user by email
    const [authUser] = await db
      .select({ id: authUsersTable.id })
      .from(authUsersTable)
      .where(eq(authUsersTable.email, userEmail));
    if (!authUser) {
      res.status(404).json({ error: `No app user found for email: ${userEmail}` });
      return;
    }

    const stripe = await getUncachableStripeClient();

    // Fetch subscriptions for this customer from Stripe
    const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 10 });
    const activeSub = subs.data.find(s => s.status === "active" || s.status === "trialing") ?? subs.data[0];

    if (!activeSub) {
      res.status(404).json({ error: `No subscriptions found for customer: ${stripeCustomerId}` });
      return;
    }

    const priceId = activeSub.items.data[0]?.price?.id;
    const planType = priceId ? PRICE_TO_PLAN[priceId] : undefined;
    const isActive = activeSub.status === "active" || activeSub.status === "trialing";

    if (!planType) {
      res.status(400).json({ error: `Unknown price ID: ${priceId} — add to PRICE_TO_PLAN map` });
      return;
    }

    await db
      .insert(businessProfilesTable)
      .values({
        userId: authUser.id,
        stripeCustomerId,
        subscriptionPlan: isActive ? planType : null,
        subscriptionStatus: isActive ? "active" : activeSub.status,
      })
      .onConflictDoUpdate({
        target: businessProfilesTable.userId,
        set: {
          stripeCustomerId,
          subscriptionPlan: isActive ? planType : null,
          subscriptionStatus: isActive ? "active" : activeSub.status,
        },
      });

    logger.info({ userId: authUser.id, stripeCustomerId, planType, status: activeSub.status }, "Admin force-linked customer to user");
    res.json({ ok: true, userId: authUser.id, stripeCustomerId, planType, status: activeSub.status });
  } catch (err) {
    logger.error({ err }, "Admin sync-by-customer error");
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

// --- Real SEO Audit Engine Helpers ---
async function getPageHtml(pageUrl: string, reqOrigin: string): Promise<string> {
  const pathsToTry = [
    path.join(process.cwd(), "artifacts/preventivo-ai/dist/public", pageUrl === "/" ? "index.html" : `${pageUrl.replace(/\/$/, "")}/index.html`),
    path.join(process.cwd(), "../preventivo-ai/dist/public", pageUrl === "/" ? "index.html" : `${pageUrl.replace(/\/$/, "")}/index.html`),
    path.join(process.cwd(), "dist/public", pageUrl === "/" ? "index.html" : `${pageUrl.replace(/\/$/, "")}/index.html`),
    path.join(process.cwd(), "public", pageUrl === "/" ? "index.html" : `${pageUrl.replace(/\/$/, "")}/index.html`),
  ];

  for (const p of pathsToTry) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf-8");
      } catch (e) {
        logger.error({ err: e, path: p }, "Failed to read local file");
      }
    }
  }

  // Fallback to HTTP fetch
  const fullUrl = `${reqOrigin}${pageUrl}`;
  try {
    const res = await fetch(fullUrl);
    if (res.ok) {
      return await res.text();
    }
  } catch (err) {
    logger.warn({ err, fullUrl }, "Failed to fetch page HTML via HTTP fallback");
  }

  throw new Error(`Page HTML not found locally or via HTTP for path: ${pageUrl}`);
}

function parseHtmlSeo(html: string) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : "";

  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1 = h1Matches.length > 0 ? h1Matches[0][1].replace(/<[^>]*>/g, "").trim() : "";

  const imgTags = [...html.matchAll(/<img\s+([\s\S]*?)>/gi)];
  let missingAlt = 0;
  for (const tag of imgTags) {
    const attrs = tag[1];
    if (!/alt=["']/i.test(attrs) || /alt=["']\s*["']/i.test(attrs)) {
      missingAlt++;
    }
  }

  const ogTitle = (html.match(/<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || "";
  const ogImage = (html.match(/<meta\s+property=["']og:image["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || "";

  let score = 100;
  const issues: string[] = [];

  if (!title) {
    score -= 20;
    issues.push("Tag <title> mancante");
  } else if (title.length < 30 || title.length > 65) {
    score -= 10;
    issues.push(`Lunghezza titolo non ottimale (${title.length} caratteri). Consigliato 30-65.`);
  }

  if (!description) {
    score -= 20;
    issues.push("Meta description mancante");
  } else if (description.length < 120 || description.length > 160) {
    score -= 10;
    issues.push(`Lunghezza descrizione non ottimale (${description.length} caratteri). Consigliato 120-160.`);
  }

  if (h1Matches.length === 0) {
    score -= 15;
    issues.push("Tag <h1> mancante");
  } else if (h1Matches.length > 1) {
    score -= 10;
    issues.push(`Rilevati multipli tag <h1> (${h1Matches.length}). Consigliato solo uno.`);
  }

  if (missingAlt > 0) {
    score -= Math.min(15, missingAlt * 3);
    issues.push(`${missingAlt} immagini senza attributo 'alt' compilato`);
  }

  if (!ogTitle || !ogImage) {
    score -= 5;
    issues.push("Tag OpenGraph per social media incompleti o mancanti");
  }

  return {
    title,
    description,
    h1,
    score: Math.max(0, score),
    issues,
  };
}

router.get("/admin/seo-audit", async (req, res) => {
  try {
    const auditPages = [
      { url: "/", name: "Homepage" },
      { url: "/blog", name: "Blog Index" },
      { url: "/preventivi/imbianchino", name: "Land. Imbianchini" },
      { url: "/preventivi/elettricista", name: "Land. Elettricisti" },
      { url: "/preventivi/idraulico", name: "Land. Idraulici" },
      { url: "/preventivi/muratore", name: "Land. Muratori" },
      { url: "/preventivi/ristrutturazione/roma", name: "Roma Ristrutturazioni" },
      { url: "/preventivi/ristrutturazione/milano", name: "Milano Ristrutturazioni" },
    ];

    const origin = `${req.protocol}://${req.headers.host}`;
    const results = await Promise.all(
      auditPages.map(async (page) => {
        try {
          const html = await getPageHtml(page.url, origin);
          const seo = parseHtmlSeo(html);
          return {
            url: page.url,
            name: page.name,
            ...seo,
          };
        } catch (e: any) {
          return {
            url: page.url,
            name: page.name,
            score: 0,
            title: "Errore di lettura",
            description: "",
            h1: "",
            issues: [`Impossibile leggere la pagina: ${e.message}`],
          };
        }
      })
    );

    res.json({
      overallScore: Math.round(results.reduce((acc, curr) => acc + curr.score, 0) / results.length),
      pages: results,
      lastChecked: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Admin SEO audit error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Real Google Search Console Auth & Query helpers ---
function signGoogleJwt(clientEmail: string, privateKey: string, keyId: string): string {
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: keyId,
  };
  const base64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signatureInput = `${base64Header}.${base64Payload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signatureInput);
  const signature = signer.sign(privateKey, "base64url");
  return `${signatureInput}.${signature}`;
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const jwt = signGoogleJwt(sa.client_email, sa.private_key, sa.private_key_id);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth error: ${res.status} - ${errText}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

router.get("/admin/search-console", async (_req, res) => {
  const gscKey = process.env.GSC_SERVICE_ACCOUNT_KEY;
  const siteUrl = process.env.GSC_SITE_URL || "https://www.prevai.it/";

  try {
    if (!gscKey) {
      // Fallback fallback simulated dashboard if variables are not yet configured on Vercel
      const keywords = [
        { query: "preventivo idraulico roma (Demo)", clicks: 342, impressions: 4500, ctr: 0.076, position: 2.1 },
        { query: "modello preventivo excel (Demo)", clicks: 289, impressions: 5800, ctr: 0.049, position: 3.4 },
        { query: "creare preventivo pdf (Demo)", clicks: 210, impressions: 3200, ctr: 0.065, position: 1.8 },
        { query: "preventivo elettricista milano (Demo)", clicks: 195, impressions: 2900, ctr: 0.067, position: 2.5 },
        { query: "modello preventivo muratore (Demo)", clicks: 140, impressions: 2100, ctr: 0.066, position: 3.0 },
      ];

      const clicks = keywords.reduce((sum, k) => sum + k.clicks, 0);
      const impressions = keywords.reduce((sum, k) => sum + k.impressions, 0);
      const ctr = clicks / impressions;
      const position = keywords.reduce((sum, k) => sum + k.position * k.impressions, 0) / impressions;

      const trends = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        trends.push({
          day: d.toISOString().slice(0, 10),
          clicks: Math.round(15 + Math.random() * 25),
          impressions: Math.round(300 + Math.random() * 200),
        });
      }

      res.json({
        isDemo: true,
        summary: {
          totalClicks: clicks,
          totalImpressions: impressions,
          averageCtr: Number(ctr.toFixed(4)),
          averagePosition: Number(position.toFixed(1)),
        },
        keywords,
        trends,
      });
      return;
    }

    const token = await getGoogleAccessToken(gscKey);
    const apiEndpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const apiResponse = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: thirtyDaysAgo,
        endDate: yesterday,
        dimensions: ["query", "date"],
        rowLimit: 5000,
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      throw new Error(`Google Search Console API responded with status ${apiResponse.status}: ${errText}`);
    }

    const data = await apiResponse.json() as { rows?: any[] };
    const rows = data.rows || [];

    if (rows.length === 0) {
      res.json({
        isDemo: false,
        summary: { totalClicks: 0, totalImpressions: 0, averageCtr: 0, averagePosition: 0 },
        keywords: [],
        trends: [],
      });
      return;
    }

    // Process GSC response
    const keywordMap = new Map<string, { clicks: number; impressions: number; posSum: number; count: number }>();
    const trendMap = new Map<string, { clicks: number; impressions: number }>();

    let totalClicks = 0;
    let totalImpressions = 0;
    let weightedPositionSum = 0;

    for (const r of rows) {
      const query = r.keys[0];
      const date = r.keys[1];
      const clicks = r.clicks || 0;
      const impressions = r.impressions || 0;
      const position = r.position || 0;

      totalClicks += clicks;
      totalImpressions += impressions;
      weightedPositionSum += position * impressions;

      // Group by query
      const kw = keywordMap.get(query) || { clicks: 0, impressions: 0, posSum: 0, count: 0 };
      kw.clicks += clicks;
      kw.impressions += impressions;
      kw.posSum += position;
      kw.count += 1;
      keywordMap.set(query, kw);

      // Group by date
      const tr = trendMap.get(date) || { clicks: 0, impressions: 0 };
      tr.clicks += clicks;
      tr.impressions += impressions;
      trendMap.set(date, tr);
    }

    const keywords = Array.from(keywordMap.entries()).map(([query, d]) => {
      const ctr = d.impressions > 0 ? d.clicks / d.impressions : 0;
      return {
        query,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: Number(ctr.toFixed(4)),
        position: Number((d.posSum / d.count).toFixed(1)),
      };
    }).sort((a, b) => b.clicks - a.clicks).slice(0, 100);

    const trends = Array.from(trendMap.entries()).map(([day, d]) => ({
      day,
      clicks: d.clicks,
      impressions: d.impressions,
    })).sort((a, b) => a.day.localeCompare(b.day));

    const averageCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const averagePosition = totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0;

    res.json({
      isDemo: false,
      summary: {
        totalClicks,
        totalImpressions,
        averageCtr: Number(averageCtr.toFixed(4)),
        averagePosition: Number(averagePosition.toFixed(1)),
      },
      keywords,
      trends,
    });
  } catch (err) {
    logger.error({ err }, "Admin Search Console error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
