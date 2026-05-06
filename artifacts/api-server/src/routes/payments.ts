import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import type { Request } from "express";
import { db, quotesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateCheckoutSessionBody } from "@workspace/api-zod";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import Stripe from "stripe";

const router = Router();

export const PLANS = [
  {
    id: "monthly_starter",
    name: "Starter",
    price: 29,
    currency: "eur",
    interval: "month",
    features: [
      "20 preventivi al mese",
      "PDF professionale",
      "Watermark incluso",
      "Supporto email",
    ],
    hasWatermark: true,
    quotaPerMonth: 20,
    tier: "starter",
  },
  {
    id: "monthly_pro",
    name: "Pro",
    price: 79,
    currency: "eur",
    interval: "month",
    features: [
      "Preventivi illimitati",
      "Nessun watermark",
      "Template PDF premium",
      "Branding completamente personalizzabile",
      "Storico clienti completo",
      "Export PDF ad alta qualità",
      "Generazione AI con foto",
      "Priorità generazione AI",
    ],
    hasWatermark: false,
    quotaPerMonth: null,
    tier: "pro",
  },
  {
    id: "oneshot_watermark",
    name: "Singolo con Watermark",
    price: 29,
    currency: "eur",
    interval: null,
    features: ["1 preventivo PDF", "Watermark incluso", "Download immediato"],
    hasWatermark: true,
    quotaPerMonth: 1,
    tier: "oneshot",
  },
  {
    id: "oneshot_clean",
    name: "Singolo Pulito",
    price: 39,
    currency: "eur",
    interval: null,
    features: ["1 preventivo PDF", "Nessun watermark", "Design professionale", "Download immediato"],
    hasWatermark: false,
    quotaPerMonth: 1,
    tier: "oneshot",
  },
];

function getUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

// GET /api/payments/plans
router.get("/payments/plans", (_req, res) => {
  res.json(PLANS);
});

// POST /api/payments/checkout
router.post("/payments/checkout", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
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

    // Look up real Stripe price ID from the synced stripe schema
    let priceId: string | null = null;
    try {
      const result = await db.execute(
        sql`SELECT pr.id FROM stripe.prices pr
            JOIN stripe.products prod ON prod.id = pr.product
            WHERE prod.metadata->>'planId' = ${plan.id}
              AND pr.active = true
              AND prod.active = true
            LIMIT 1`
      );
      priceId = (result.rows[0]?.id as string) ?? null;
    } catch {
      // stripe schema not yet available — fall through to price_data fallback
    }

    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: `prevai – ${plan.name}`,
              description: plan.features.join(", "),
            },
            unit_amount: plan.price * 100,
            ...(plan.interval ? { recurring: { interval: plan.interval as "month" | "year" } } : {}),
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [lineItem],
      mode: plan.interval ? "subscription" : "payment",
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

// GET /api/payments/verify/:quoteId
// Verifies a Stripe payment and unlocks the quote if paid.
// Used as a reliable fallback when the user returns from Stripe checkout.
router.get("/payments/verify/:quoteId", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
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
      await db.update(quotesTable).set({ status: "unlocked" }).where(eq(quotesTable.id, quoteId));
      logger.info({ quoteId }, "Quote unlocked via verify endpoint");
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
