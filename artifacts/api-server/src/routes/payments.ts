import express, { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import type { Request } from "express";
import Stripe from "stripe";
import { db, quotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateCheckoutSessionBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

const PLANS = [
  {
    id: "monthly_basic",
    name: "Base Mensile",
    price: 19,
    currency: "eur",
    interval: "month",
    features: ["20 preventivi/mese", "Watermark incluso", "PDF professionale", "Supporto email"],
    hasWatermark: true,
    quotaPerMonth: 20,
  },
  {
    id: "monthly_premium",
    name: "Premium Mensile",
    price: 59,
    currency: "eur",
    interval: "month",
    features: ["Preventivi illimitati", "Nessun watermark", "PDF premium", "Priorità supporto", "Export multi-formato"],
    hasWatermark: false,
    quotaPerMonth: null,
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

    if (!STRIPE_SECRET_KEY) {
      res.status(503).json({ error: "Stripe not configured. Please add STRIPE_SECRET_KEY." });
      return;
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

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
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: `PreventivoAI - ${plan.name}`,
              description: plan.features.join(", "),
            },
            unit_amount: plan.price * 100,
            ...(plan.interval ? { recurring: { interval: plan.interval as "month" | "year" } } : {}),
          },
          quantity: 1,
        },
      ],
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

// POST /api/payments/webhook
router.post(
  "/payments/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!STRIPE_SECRET_KEY) {
      res.status(200).end();
      return;
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const sig = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.error({ err }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: "Webhook signature verification failed" });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { quoteId, planType } = session.metadata ?? {};

      if (quoteId) {
        const plan = PLANS.find((p) => p.id === planType);
        await db
          .update(quotesTable)
          .set({ status: "unlocked" })
          .where(eq(quotesTable.id, quoteId));
        logger.info({ quoteId, planType, hasWatermark: plan?.hasWatermark }, "Quote unlocked");
      }
    }

    res.json({ received: true });
  }
);

export default router;
