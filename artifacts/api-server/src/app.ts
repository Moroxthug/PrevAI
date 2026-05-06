import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import multer from "multer";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { WebhookHandlers } from "./webhookHandlers";
import { db, quotesTable, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
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

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ── Stripe webhook MUST be registered before express.json() ──────────────────
// express.raw() keeps the body as Buffer so Stripe can verify the signature.
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
    try {
      // 1. Let stripe-replit-sync validate signature + sync data to stripe.* tables
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);

      // 2. Run custom business logic — safe to parse JSON since signature was already verified above
      try {
        const event = JSON.parse((req.body as Buffer).toString("utf8")) as {
          type: string;
          data: {
            object: {
              metadata?: Record<string, string>;
              payment_status?: string;
              customer?: string;
              mode?: string;
              status?: string;
              current_period_end?: number;
            };
          };
        };

        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const quoteId = session.metadata?.quoteId;
          const userId = session.metadata?.userId;
          const planType = session.metadata?.planType;

          // Unlock the specific quote with the plan info
          if (quoteId) {
            await db
              .update(quotesTable)
              .set({ status: "unlocked", unlockedWithPlan: planType ?? null })
              .where(eq(quotesTable.id, quoteId));
            logger.info({ quoteId, planType }, "Quote unlocked via webhook");
          }

          const ALL_PLAN_INFO: Record<string, { name: string; price: number; interval: string | null }> = {
            monthly_starter: { name: "Starter", price: 29, interval: "month" },
            monthly_pro: { name: "Pro", price: 79, interval: "month" },
            oneshot_watermark: { name: "Singolo con Watermark", price: 29, interval: null },
            oneshot_clean: { name: "Singolo Pulito", price: 39, interval: null },
          };

          // If subscription mode, save subscription info to business profile
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
          }

          // Send receipt/welcome email for all completed purchases (subscription + one-shot)
          if (userId && planType) {
            try {
              const clerkUser = await clerkClient.users.getUser(userId);
              const email = clerkUser.emailAddresses[0]?.emailAddress;
              const name = clerkUser.firstName || clerkUser.username || "Cliente";
              if (email) {
                const planInfo = ALL_PLAN_INFO[planType];
                if (planInfo) {
                  await sendSubscriptionEmail({
                    toEmail: email,
                    toName: name,
                    planName: planInfo.name,
                    planPrice: planInfo.price,
                    planInterval: planInfo.interval,
                  });
                }
              }
            } catch (emailErr) {
              logger.error({ err: emailErr }, "Failed to send purchase email (non-fatal)");
            }
          }
        }

        // Handle subscription cancellation
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: message });
    }
  }
);
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// Multer error handler — must be 4-arity to be recognized as an error middleware
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
