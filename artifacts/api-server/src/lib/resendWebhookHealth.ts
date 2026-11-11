// Watchdog for the Resend webhook (bounces, spam complaints, deliveries).
//
// History: the webhook was created on 2026-07-17 and Resend (Svix) switched it
// off after repeated failed deliveries. Nobody noticed for four months —
// email_events stayed empty, so bounces and complaints went unseen. Re-enabled
// on 2026-11-10. This check runs in the daily cron tick and raises an ops
// alert when the endpoint is missing or disabled, or when no event has
// arrived for a week. Best-effort: never throws.

import { db, emailEventsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { MARKET } from "@workspace/config";
import { logger } from "./logger.js";

export const RESEND_WEBHOOK_PATH = "/api/webhooks/resend";
const SILENT_AFTER_DAYS = 7;

type ResendWebhook = { id: string; endpoint: string; status: string; events?: string[] };

export async function checkResendWebhook(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const problems: string[] = [];
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return problems; // no email at all: nothing to watch

  if (!process.env.RESEND_WEBHOOK_SECRET) problems.push("RESEND_WEBHOOK_SECRET is not set: every webhook delivery is rejected with 500.");

  try {
    const res = await fetchImpl("https://api.resend.com/webhooks", { headers: { Authorization: `Bearer ${apiKey}` } });
    if (res.ok) {
      const body = (await res.json()) as { data?: ResendWebhook[] };
      const ours = (body.data ?? []).filter((w) => w.endpoint.replace(/\/$/, "") === `${MARKET.siteUrl}${RESEND_WEBHOOK_PATH}`);
      if (ours.length === 0) problems.push(`No Resend webhook points at ${MARKET.siteUrl}${RESEND_WEBHOOK_PATH}: bounces and spam complaints are not recorded.`);
      for (const w of ours) {
        if (w.status !== "enabled") problems.push(`Resend webhook ${w.id} is "${w.status}" (Resend switches it off after repeated failed deliveries). Re-enable it in the Resend dashboard → Webhooks, then check the endpoint answers 200.`);
        for (const e of ["email.bounced", "email.complained"]) if (w.events && !w.events.includes(e)) problems.push(`Resend webhook ${w.id} does not subscribe to ${e}.`);
      }
    } else {
      // A sending-only API key can't list webhooks: say so once a day rather than guessing.
      logger.warn({ status: res.status }, "Resend webhook check: cannot list webhooks");
    }
  } catch (err) {
    logger.warn({ err }, "Resend webhook check: Resend API unreachable");
  }

  try {
    const [last] = await db.select({ at: emailEventsTable.createdAt }).from(emailEventsTable).orderBy(desc(emailEventsTable.createdAt)).limit(1);
    const ageDays = last ? (Date.now() - last.at.getTime()) / 86_400_000 : Infinity;
    if (ageDays > SILENT_AFTER_DAYS) problems.push(last ? `No Resend webhook event received for ${Math.floor(ageDays)} days (last ${last.at.toISOString()}).` : "No Resend webhook event has ever been recorded.");
  } catch (err) {
    logger.warn({ err }, "Resend webhook check: email_events unreadable");
  }
  return problems;
}
