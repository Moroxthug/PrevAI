import Stripe from 'stripe';

async function getCredentials(): Promise<{ secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    const sk = process.env.STRIPE_SECRET_KEY;
    if (sk) return { secretKey: sk };
    throw new Error('Missing Replit environment variables or STRIPE_SECRET_KEY fallback.');
  }

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', 'development');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'X-Replit-Token': xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error(`Failed to fetch Stripe credentials: ${response.status}`);

  const data = await response.json() as {
    items?: { settings?: { secret?: string } }[]
  };
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret) {
    const sk = process.env.STRIPE_SECRET_KEY;
    if (sk) return { secretKey: sk };
    throw new Error('Stripe integration not connected. Connect via the Integrations tab first.');
  }

  return { secretKey: settings.secret };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey);
}
