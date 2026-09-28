import { db, notificationsTable, auditLogTable } from "@workspace/db";
import { pushForNotification } from "./push";

/** The longest a notification waits for its push to go out (a slow push service must not slow the caller). */
const PUSH_WAIT_MS = 4000;

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  /** APP-2: false keeps a push kind in the bell only (lib/push.ts decides the rest). */
  push?: boolean;
}): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? "",
    link: params.link ?? null,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
  });
  // APP-2: the kinds worth interrupting for also reach the phone. Awaited (a serverless
  // function may be frozen once it answers) but capped, and it never throws.
  await Promise.race([pushForNotification(params), new Promise<void>((resolve) => setTimeout(resolve, PUSH_WAIT_MS).unref?.())]);
}

export async function writeAudit(params: {
  userId: string;
  actorType: "user" | "customer" | "system" | "ai";
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  diff?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await db.insert(auditLogTable).values({
    userId: params.userId,
    actorType: params.actorType,
    actorId: params.actorId ?? null,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    diff: params.diff ?? null,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
  });
}
