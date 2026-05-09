import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { getBaseUrl } from './lib/baseUrl';
import app from "./app";
import { logger } from "./lib/logger";

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('DATABASE_URL not set — skipping Stripe init');
    return;
  }

  try {
    logger.info('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    logger.info('Stripe schema ready');

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = getBaseUrl();
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/payments/webhook`);
    logger.info('Stripe webhook configured');

    // Always sync STRIPE_WEBHOOK_SECRET from the managed webhook table.
    // stripeSync may recreate the webhook endpoint (rotating the secret), so
    // the DB value is always more up-to-date than any static env var.
    try {
      const { db } = await import('@workspace/db');
      const { sql } = await import('drizzle-orm');
      const rawResult = await db.execute(
        sql`SELECT secret FROM stripe._managed_webhooks ORDER BY created DESC LIMIT 1`
      );
      // drizzle-orm/pg returns QueryResult (with .rows) in some versions, or an array directly in others
      const rowsArr: { secret?: string }[] = Array.isArray(rawResult)
        ? (rawResult as { secret?: string }[])
        : ((rawResult as unknown as { rows?: { secret?: string }[] }).rows ?? []);
      const secret = rowsArr[0]?.secret;
      if (secret) {
        process.env.STRIPE_WEBHOOK_SECRET = secret;
        logger.info('STRIPE_WEBHOOK_SECRET synced from managed webhooks table');
      } else if (!process.env.STRIPE_WEBHOOK_SECRET) {
        logger.warn('No managed webhook secret found in DB — Stripe webhook signature verification may fail');
      }
    } catch (secretErr) {
      logger.error({ err: secretErr }, 'Failed to sync STRIPE_WEBHOOK_SECRET from DB');
    }

    // Run backfill in background — non-blocking
    stripeSync.syncBackfill()
      .then(() => logger.info('Stripe data backfill complete'))
      .catch((err) => logger.error({ err }, 'Stripe backfill error'));
  } catch (err) {
    // Log but don't crash the server — payments may degrade gracefully
    logger.error({ err }, 'Stripe init failed — payments may not work');
  }
}

const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
