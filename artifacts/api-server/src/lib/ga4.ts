// GA4 Measurement Protocol: the `purchase` key event, sent from the Stripe
// webhook so a payment counts even when the buyer closes the tab before the
// success page. The browser's GA client id travels in the Checkout Session
// metadata (`gaClientId`), so GA4 ties the purchase to the visitor's original
// channel and landing page.
//
// Inert until both GA4_MEASUREMENT_ID and GA4_API_SECRET are set (Vercel env).
// Never throws: analytics must not fail a webhook.
import { logger } from "./logger";

/** `_ga=GA1.1.123456789.1700000000` → `123456789.1700000000`; undefined when absent. */
export function gaClientIdFromCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const m = /(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/.exec(cookieHeader);
  return m?.[1];
}

export type Ga4Purchase = {
  clientId: string | undefined;
  userId: string | undefined;
  transactionId: string;
  valueCents: number | null | undefined;
  currency: string | null | undefined;
  itemId: string;
};

export function ga4PurchasePayload(p: Ga4Purchase) {
  return {
    // Without the browser id GA4 still records the key event, just unattributed.
    client_id: p.clientId ?? `srv.${p.userId ?? "anon"}`,
    ...(p.userId ? { user_id: p.userId } : {}),
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: p.transactionId,
          value: typeof p.valueCents === "number" ? p.valueCents / 100 : 0,
          currency: (p.currency ?? "eur").toUpperCase(),
          items: [{ item_id: p.itemId, item_name: p.itemId, quantity: 1 }],
        },
      },
    ],
  };
}

export async function sendGa4Purchase(p: Ga4Purchase): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;
  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ga4PurchasePayload(p)),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) logger.warn({ status: res.status }, "GA4 purchase not accepted");
  } catch (err) {
    logger.warn({ err }, "GA4 purchase send failed (non-fatal)");
  }
}
