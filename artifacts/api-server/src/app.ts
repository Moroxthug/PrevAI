import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import multer from "multer";
import { db, quotesTable, businessProfilesTable, authUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { auth } from "./lib/auth";
import { sendSubscriptionEmail } from "./lib/email";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Better Auth handler — must be before express.json() ──────────────────────
// Use raw middleware to avoid Express 5 wildcard syntax issues
app.use((req, res, next): void => {
  if (req.url?.startsWith("/api/auth/") || req.url === "/api/auth") {
    void toNodeHandler(auth)(req, res);
    return;
  }
  next();
});

// ── Stripe webhook MUST be registered before express.json() ──────────────────
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("STRIPE_WEBHOOK_SECRET not set — cannot verify webhook signature");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    let event: {
      type: string;
      data: {
        object: {
          metadata?: Record<string, string>;
          payment_status?: string;
          customer?: string;
          mode?: string;
          status?: string;
          current_period_end?: number;
          plan?: { id?: string };
          items?: { data?: { price?: { id?: string } }[] };
        };
      };
    };

    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret) as typeof event;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: `Webhook signature error: ${message}` });
      return;
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const quoteId = session.metadata?.quoteId;
        const userId = session.metadata?.userId;
        const planType = session.metadata?.planType;

        if (quoteId) {
          await db
            .update(quotesTable)
            .set({ status: "unlocked", unlockedWithPlan: planType ?? null })
            .where(eq(quotesTable.id, quoteId));
          logger.info({ quoteId, planType }, "Quote unlocked via webhook");
        }

        if (userId && session.customer && session.mode === "subscription" && planType) {
          const customerId = session.customer as string;
          await db
            .insert(businessProfilesTable)
            .values({
              userId,
              stripeCustomerId: customerId,
              subscriptionPlan: planType,
              subscriptionStatus: "active",
            })
            .onConflictDoUpdate({
              target: businessProfilesTable.userId,
              set: {
                stripeCustomerId: customerId,
                subscriptionPlan: planType,
                subscriptionStatus: "active",
              },
            });
          logger.info({ userId, planType }, "Subscription activated via webhook");

          try {
            const [authUser] = await db
              .select({ email: authUsersTable.email, name: authUsersTable.name })
              .from(authUsersTable)
              .where(eq(authUsersTable.id, userId));

            const email = authUser?.email;
            const name = authUser?.name || "Cliente";

            if (email) {
              const planInfo: Record<string, { name: string; price: number; interval: string | null }> = {
                monthly_starter: { name: "Starter", price: 29, interval: "month" },
                monthly_pro: { name: "Pro", price: 79, interval: "month" },
                monthly_elite: { name: "Elite", price: 59, interval: "month" },
              };
              const info = planInfo[planType];
              if (info) {
                await sendSubscriptionEmail({
                  toEmail: email,
                  toName: name,
                  planName: info.name,
                  planPrice: info.price,
                  planInterval: info.interval,
                });
              }
            }
          } catch (emailErr) {
            logger.error({ err: emailErr }, "Failed to send subscription email (non-fatal)");
          }
        }
      }

      if (event.type === "customer.subscription.updated") {
        const sub = event.data.object;
        if (sub.customer && sub.status === "active") {
          await db
            .update(businessProfilesTable)
            .set({ subscriptionStatus: "active" })
            .where(eq(businessProfilesTable.stripeCustomerId, sub.customer as string));
          logger.info({ customer: sub.customer }, "Subscription updated via webhook");
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object;
        if (sub.customer) {
          await db
            .update(businessProfilesTable)
            .set({ subscriptionStatus: "cancelled", subscriptionPlan: null })
            .where(eq(businessProfilesTable.stripeCustomerId, sub.customer as string));
          logger.info({ customer: sub.customer }, "Subscription cancelled via webhook");
        }
      }
    } catch (bizErr) {
      logger.error({ err: bizErr }, "Webhook business logic error (non-fatal)");
    }

    res.status(200).json({ received: true });
  }
);
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: "File troppo grande: massimo 5MB per immagine.",
      LIMIT_FILE_COUNT: "Troppi file: puoi allegare al massimo 3 immagini.",
      LIMIT_UNEXPECTED_FILE: "Campo file non previsto.",
    };
    res.status(400).json({ error: messages[err.code] ?? `Errore upload: ${err.message}` });
    return;
  }
  if (err instanceof Error && err.message.startsWith("Unsupported image type")) {
    res.status(400).json({ error: err.message });
    return;
  }
  logger.error(err, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
