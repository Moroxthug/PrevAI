import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import { db, quotesTable, businessProfilesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateCheckoutSessionBody } from "@workspace/api-zod";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import Stripe from "stripe";

const TRIAL_DAYS = 7;
const TRIAL_DOWNLOAD_LIMIT = 3;

export function getTrialStatus(profile: typeof businessProfilesTable.$inferSelect | null | undefined) {
  if (!profile?.trialStartedAt) {
    return {
      isTrialActive: false,
      trialStartedAt: null,
      trialDownloadsUsed: 0,
      trialDownloadsLimit: TRIAL_DOWNLOAD_LIMIT,
      trialDaysLeft: null,
      trialExpiresAt: null,
    };
  }
  const now = new Date();
  const started = profile.trialStartedAt;
  const expiresAt = new Date(started.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const downloadsUsed = profile.trialDownloadsUsed ?? 0;
  const isExpiredByTime = now > expiresAt;
  const isExpiredByDownloads = downloadsUsed >= TRIAL_DOWNLOAD_LIMIT;
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const isTrialActive = !isExpiredByTime && !isExpiredByDownloads;
  return {
    isTrialActive,
    trialStartedAt: started.toISOString(),
    trialDownloadsUsed: downloadsUsed,
    trialDownloadsLimit: TRIAL_DOWNLOAD_LIMIT,
    trialDaysLeft: isTrialActive ? daysLeft : 0,
    trialExpiresAt: expiresAt.toISOString(),
  };
}

const router = Router();

export const PLANS = [
  {
    id: "monthly_starter",
    stripePriceId: "price_1TUSSEE2ZxgzSomHxDR0cLUk",
    name: "Starter",
    price: 19,
    currency: "eur",
    interval: "month",
    features: [
      "10 preventivi al mese",
      "PDF con logo aziendale",
      "Riga 'Fatto con prevai.it' in calce",
      "Template Standard incluso",
      "Upload appunti (2 preventivi/mese)",
      "Registrazione vocale (1 preventivo/mese)",
    ],
    hasWatermark: true,
    quotaPerMonth: 10,
    tier: "starter",
  },
  {
    id: "monthly_pro",
    stripePriceId: "price_1TUSSFE2ZxgzSomHblZkFIdj",
    name: "Pro",
    price: 49,
    currency: "eur",
    interval: "month",
    features: [
      "60 preventivi al mese",
      "PDF puliti — nessun watermark",
      "Logo aziendale personalizzato",
      "Tutti i template PDF disponibili",
      "Upload appunti (30 preventivi/mese)",
      "Registrazione vocale (30 preventivi/mese)",
      "Priorità generazione AI",
    ],
    hasWatermark: false,
    quotaPerMonth: 60,
    tier: "pro",
  },
  {
    id: "monthly_elite",
    stripePriceId: "price_1TUSRhE2ZxgzSomHmHPn5BJJ",
    name: "Elite",
    price: 59,
    currency: "eur",
    interval: "month",
    features: [
      "Preventivi illimitati",
      "PDF puliti — nessun watermark",
      "Logo aziendale personalizzato",
      "Tutti i template PDF disponibili",
      "Upload appunti illimitato",
      "Registrazione vocale illimitata",
      "Priorità massima generazione AI",
      "Supporto dedicato",
    ],
    hasWatermark: false,
    quotaPerMonth: null,
    tier: "elite",
  },
  {
    id: "oneshot_watermark",
    stripePriceId: "price_1TUSSGE2ZxgzSomHAt1w4bWp",
    name: "Singolo Base",
    price: 5,
    currency: "eur",
    interval: null,
    features: ["1 preventivo PDF", "Riga prevai.it in calce", "Download immediato"],
    hasWatermark: true,
    quotaPerMonth: 1,
    tier: "oneshot",
  },
  {
    id: "oneshot_clean",
    stripePriceId: "price_1TUSSHE2ZxgzSomHxg5Q1LXu",
    name: "Singolo Pro",
    price: 9,
    currency: "eur",
    interval: null,
    features: ["1 preventivo PDF pulito", "Logo aziendale", "Nessun watermark", "Download immediato"],
    hasWatermark: false,
    quotaPerMonth: 1,
    tier: "oneshot",
  },
];

router.get("/payments/plans", (_req, res) => {
  res.json(PLANS);
});

router.get("/payments/trial-status", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));
    res.json(getTrialStatus(profile ?? null));
  } catch (err) {
    logger.error({ err }, "Error getting trial status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/checkout", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const parsed = CreateCheckoutSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }

    const { quoteId, planType } = parsed.data;
    const plan = PLANS.find((p) => p.id === planType);
    if (!plan) {
      res.status(400).json({ error: "Invalid plan type" });
      return;
    }

    const stripe = await getUncachableStripeClient();

    const baseUrl = process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : "http://localhost:80";

    const successUrl = quoteId
      ? `${baseUrl}/dashboard/quotes/${quoteId}?payment=success`
      : `${baseUrl}/dashboard?payment=success`;
    const cancelUrl = quoteId
      ? `${baseUrl}/dashboard/quotes/${quoteId}?payment=cancelled`
      : `${baseUrl}/dashboard?payment=cancelled`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      mode: plan.interval ? "subscription" : "payment",
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        quoteId: quoteId ?? "",
        planType,
        hasWatermark: String(plan.hasWatermark),
      },
    });

    if (quoteId) {
      await db
        .update(quotesTable)
        .set({ status: "pending_payment", stripeSessionId: session.id })
        .where(eq(quotesTable.id, quoteId));
    }

    res.json({ url: session.url!, sessionId: session.id });
  } catch (err) {
    logger.error({ err }, "Error creating checkout session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payments/subscription", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    const isActive = profile?.subscriptionStatus === "active";
    const plan = PLANS.find(p => p.id === profile?.subscriptionPlan) ?? null;

    let quotaUsed: number | null = null;
    let quotaLimit: number | null = null;
    let quotaRemaining: number | null = null;
    let quotaResetDate: string | null = null;

    if (isActive && plan?.quotaPerMonth != null) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [{ count: used }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(quotesTable)
        .where(
          sql`${quotesTable.userId} = ${userId}
            AND ${quotesTable.createdAt} >= ${monthStart.toISOString()}
            AND ${quotesTable.createdAt} < ${nextMonthStart.toISOString()}`
        );

      quotaUsed = used ?? 0;
      quotaLimit = plan.quotaPerMonth;
      quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
      quotaResetDate = nextMonthStart.toISOString();
    }

    res.json({
      plan: profile?.subscriptionPlan ?? null,
      status: profile?.subscriptionStatus ?? null,
      periodEnd: profile?.subscriptionPeriodEnd?.toISOString() ?? null,
      isActive,
      quotaUsed,
      quotaLimit,
      quotaRemaining,
      quotaResetDate,
    });
  } catch (err) {
    logger.error({ err }, "Error getting subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/unlock-quote", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { quoteId } = req.body as { quoteId: string };

    if (!quoteId) {
      res.status(400).json({ error: "quoteId required" });
      return;
    }

    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    if (profile?.subscriptionStatus !== "active") {
      res.status(403).json({ error: "No active subscription" });
      return;
    }

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, quoteId));

    if (!quote || quote.userId !== userId) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    if (quote.status !== "unlocked") {
      await db
        .update(quotesTable)
        .set({ status: "unlocked", unlockedWithPlan: profile.subscriptionPlan ?? null })
        .where(eq(quotesTable.id, quoteId));
      logger.info({ quoteId, userId, plan: profile.subscriptionPlan }, "Quote unlocked via subscription");
    }

    res.json({ status: "unlocked" });
  } catch (err) {
    logger.error({ err }, "Error unlocking quote with subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/portal", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    if (!profile?.stripeCustomerId) {
      res.status(400).json({ error: "No Stripe customer found — subscribe first" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const baseUrl = process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : "http://localhost:80";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${baseUrl}/dashboard`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    logger.error({ err }, "Error creating customer portal session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payments/verify/:quoteId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const quoteId = req.params["quoteId"] as string;

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId));
    if (!quote || quote.userId !== userId) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    if (quote.status === "unlocked") {
      res.json({ status: "unlocked" });
      return;
    }

    if (!quote.stripeSessionId) {
      res.json({ status: quote.status });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(quote.stripeSessionId);

    if (session.payment_status === "paid" || session.status === "complete") {
      const planType = (session.metadata as Record<string, string> | null)?.planType ?? null;
      await db
        .update(quotesTable)
        .set({ status: "unlocked", unlockedWithPlan: planType })
        .where(eq(quotesTable.id, quoteId));
      logger.info({ quoteId, planType }, "Quote unlocked via verify endpoint");
      res.json({ status: "unlocked" });
      return;
    }

    res.json({ status: quote.status });
  } catch (err) {
    logger.error({ err }, "Error verifying payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
