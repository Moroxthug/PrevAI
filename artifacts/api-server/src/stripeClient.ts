import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    // Fallback to env var for local dev without the integration
    const sk = process.env.STRIPE_SECRET_KEY;
    if (sk) return { publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '', secretKey: sk };
    throw new Error(
      'Stripe integration not configured. Connect Stripe via the Integrations tab.'
    );
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'X-Replit-Token': xReplitToken,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    items?: { settings?: { publishable?: string; secret?: string } }[]
  };
  const settings = data.items?.[0]?.settings;

  if (!settings?.publishable || !settings?.secret) {
    // Fallback to env var
    const sk = process.env.STRIPE_SECRET_KEY;
    if (sk) return { publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '', secretKey: sk };
    throw new Error(
      `Stripe ${targetEnvironment} connection not found. Connect Stripe via the Integrations tab.`
    );
  }

  return {
    publishableKey: settings.publishable,
    secretKey: settings.secret,
  };
}

// WARNING: Never cache this client. Tokens can rotate.
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey);
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = await getCredentials();
  return secretKey;
}

// WARNING: Never cache this. Fetches credentials on every call.
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL environment variable is required');

  const secretKey = await getStripeSecretKey();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
  });
}
