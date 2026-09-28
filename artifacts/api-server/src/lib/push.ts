import { db, pushSubscriptionsTable, pushPreferencesTable, organizationMembersTable, type TeamMemberRole } from "@workspace/db";
import { PUSH_KIND_DEFS, normalizePushMuted, pushKindOf, type PushKind } from "@workspace/config";
import { and, eq, inArray, sql } from "drizzle-orm";
import { readPushKeys, sendWebPush, type PushMessage, type PushSubscriptionInput } from "./webPush";
import { roleCan } from "../middlewares/requirePermission";
import { tableReady } from "../assistant/ready";
import { logger } from "./logger";

// ── APP-2: notifiche della campanella che arrivano anche sul telefono ────────
// (docs/APP-PLAN.md, come QuoteAI Phase 77 + le preferenze della 119.)
// Only the kinds in lib/config notifiche-push.ts become a push; the bell keeps
// everything. A subscription is per browser and per person: a person receives
// a kind only if their role can see its area (owner / team member role, looked
// up at send time so a member who was removed or demoted stops at once) and
// they have not switched it off. A browser that stopped listening (404/410) is
// deleted on the spot, one that keeps failing is dropped after MAX_FAILURES.
//
// Inert until migrations/v2/0014 runs: `pushReady()` is false and nothing is
// read or written.

const MAX_FAILURES = 5;

export function isPushConfigured(): boolean {
  return readPushKeys() !== null;
}

export function pushPublicKey(): string | null {
  return readPushKeys()?.publicKey ?? null;
}

/** Both APP-2 tables exist (migration 0014). Remembered once true, asked again after a minute otherwise. */
export async function pushReady(): Promise<boolean> {
  return (await tableReady("push_subscriptions")) && (await tableReady("push_preferences"));
}

/** Upserts a browser subscription. Turning it on again from the same browser (same endpoint) moves the row, never duplicates it. */
export async function saveSubscription(params: { userId: string; memberUserId: string; subscription: PushSubscriptionInput; userAgent?: string | null }) {
  const { endpoint, keys } = params.subscription;
  const [row] = await db
    .insert(pushSubscriptionsTable)
    .values({ userId: params.userId, memberUserId: params.memberUserId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: params.userAgent ?? null })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId: params.userId, memberUserId: params.memberUserId, p256dh: keys.p256dh, auth: keys.auth, userAgent: params.userAgent ?? null, failedAt: null, failureCount: 0 },
    })
    .returning();
  return row!;
}

export async function removeSubscription(params: { memberUserId: string; endpoint: string }): Promise<boolean> {
  const rows = await db
    .delete(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.endpoint, params.endpoint), eq(pushSubscriptionsTable.memberUserId, params.memberUserId)))
    .returning({ id: pushSubscriptionsTable.id });
  return rows.length > 0;
}

export async function readMuted(userId: string, memberUserId: string): Promise<PushKind[]> {
  const [row] = await db
    .select({ muted: pushPreferencesTable.muted })
    .from(pushPreferencesTable)
    .where(and(eq(pushPreferencesTable.userId, userId), eq(pushPreferencesTable.memberUserId, memberUserId)));
  return normalizePushMuted(row?.muted ?? []);
}

export async function writeMuted(userId: string, memberUserId: string, muted: PushKind[]): Promise<PushKind[]> {
  const clean = normalizePushMuted(muted);
  await db
    .insert(pushPreferencesTable)
    .values({ userId, memberUserId, muted: clean })
    .onConflictDoUpdate({ target: [pushPreferencesTable.userId, pushPreferencesTable.memberUserId], set: { muted: clean, updatedAt: new Date() } });
  return clean;
}

/** Role of each person in the company: the owner is the company itself; members only while active. Missing = no longer in it. */
async function rolesIn(userId: string, memberUserIds: string[]): Promise<Map<string, TeamMemberRole>> {
  const roles = new Map<string, TeamMemberRole>();
  const others = [...new Set(memberUserIds.filter((id) => id !== userId))];
  if (memberUserIds.includes(userId)) roles.set(userId, "owner");
  if (others.length) {
    const rows = await db
      .select({ userId: organizationMembersTable.userId, role: organizationMembersTable.role })
      .from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.ownerId, userId), eq(organizationMembersTable.status, "active"), inArray(organizationMembersTable.userId, others)));
    for (const r of rows) if (r.userId) roles.set(r.userId, r.role);
  }
  return roles;
}

export type PushSendSummary = { sent: number; failed: number; removed: number; skipped: "not_configured" | "not_ready" | "no_subscriptions" | null };

/**
 * Sends one message to the company's subscribed browsers: all of them, only
 * one person's (`memberUserId`, the test button), and/or only people who may
 * receive `kind` (role + preferences). Never throws.
 */
export async function sendPushToCompany(userId: string, message: PushMessage, opts: { memberUserId?: string; kind?: PushKind } = {}): Promise<PushSendSummary> {
  const keys = readPushKeys();
  if (!keys) return { sent: 0, failed: 0, removed: 0, skipped: "not_configured" };
  if (!(await pushReady())) return { sent: 0, failed: 0, removed: 0, skipped: "not_ready" };
  let rows = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
  if (opts.memberUserId) rows = rows.filter((r) => r.memberUserId === opts.memberUserId);
  if (rows.length) {
    const roles = await rolesIn(userId, rows.map((r) => r.memberUserId));
    const kind = opts.kind;
    const mutedBy = new Map<string, PushKind[]>();
    if (kind) {
      const prefs = await db.select().from(pushPreferencesTable).where(eq(pushPreferencesTable.userId, userId));
      for (const p of prefs) mutedBy.set(p.memberUserId, normalizePushMuted(p.muted));
    }
    rows = rows.filter((r) => {
      const role = roles.get(r.memberUserId);
      if (!role) return false;
      if (!kind) return true;
      return roleCan(role, PUSH_KIND_DEFS[kind].area, "view") && !(mutedBy.get(r.memberUserId) ?? []).includes(kind);
    });
  }
  if (rows.length === 0) return { sent: 0, failed: 0, removed: 0, skipped: "no_subscriptions" };
  const summary: PushSendSummary = { sent: 0, failed: 0, removed: 0, skipped: null };
  await Promise.all(
    rows.map(async (row) => {
      const result = await sendWebPush(keys, { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, message);
      if (result.ok) {
        summary.sent++;
        await db.update(pushSubscriptionsTable).set({ lastUsedAt: new Date(), failedAt: null, failureCount: 0 }).where(eq(pushSubscriptionsTable.id, row.id));
        return;
      }
      summary.failed++;
      if (result.gone || row.failureCount + 1 >= MAX_FAILURES) {
        summary.removed++;
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, row.id));
        logger.info({ userId, endpoint: row.endpoint.slice(0, 60), status: result.status }, "Push subscription removed");
        return;
      }
      await db.update(pushSubscriptionsTable).set({ failedAt: new Date(), failureCount: sql`${pushSubscriptionsTable.failureCount} + 1` }).where(eq(pushSubscriptionsTable.id, row.id));
      logger.warn({ userId, status: result.status, error: result.error }, "Push delivery failed");
    }),
  );
  return summary;
}

/**
 * Called by createNotification for every bell notification: pushes the kinds in
 * lib/config notifiche-push.ts. `push: false` keeps one in the bell only (a
 * fiscal reminder weeks ahead). Never throws.
 */
export async function pushForNotification(n: { userId: string; type: string; title: string; body?: string; link?: string | null; entityType?: string | null; entityId?: string | null; push?: boolean }): Promise<void> {
  const kind = pushKindOf(n.type);
  if (!kind || n.push === false || !isPushConfigured()) return;
  try {
    await sendPushToCompany(
      n.userId,
      { title: n.title, body: n.body ?? "", link: n.link ?? "/dashboard/notifications", tag: n.entityType && n.entityId ? `${n.type}:${n.entityId}` : n.type },
      { kind },
    );
  } catch (err) {
    logger.error({ err, type: n.type }, "Push for notification failed");
  }
}
