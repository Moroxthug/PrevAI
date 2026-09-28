// APP-2 — "Il cliente ha aperto il preventivo": the first time someone other
// than the company opens the public link (/p/:id), a bell notification that
// also reaches the phone (lib/config notifiche-push.ts, kind quote_viewed).
//
// Once per quote: the bell row itself is the marker (no new column on quotes,
// so nothing changes before migration 0014 runs), plus a small in-memory set
// so repeated views on one instance don't query at all. The company's own
// people are not "the client": a request carrying a session of the owner or
// an active member of the company is ignored.
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { db, notificationsTable, organizationMembersTable, readQuoteClientData, type Quote, type QuoteClientData } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { auth } from "../lib/auth.js";
import { createNotification } from "../lib/notifications.js";
import { logger } from "../lib/logger.js";

const seen = new Set<string>();
const SEEN_MAX = 5000;

async function viewerIsTeam(req: Request, companyUserId: string): Promise<boolean> {
  // No cookie → no session; skip the auth lookup for the (usual) anonymous client.
  if (!req.headers.cookie?.includes("better-auth")) return false;
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    const actor = session?.user.id;
    if (!actor) return false;
    if (actor === companyUserId) return true;
    const [m] = await db
      .select({ id: organizationMembersTable.id })
      .from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.ownerId, companyUserId), eq(organizationMembersTable.userId, actor), eq(organizationMembersTable.status, "active")));
    return !!m;
  } catch {
    return false;
  }
}

/** Records the first client view of a sent quote. Never throws. */
export async function noteQuoteViewed(req: Request, quote: Pick<Quote, "id" | "userId" | "status" | "clientData" | "numeroPreventivoData">): Promise<void> {
  if (quote.status !== "unlocked" || seen.has(quote.id)) return;
  try {
    if (await viewerIsTeam(req, quote.userId)) return;
    const [already] = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, quote.userId), eq(notificationsTable.type, "quote_viewed"), eq(notificationsTable.entityId, quote.id)))
      .limit(1);
    if (seen.size >= SEEN_MAX) seen.clear();
    seen.add(quote.id);
    if (already) return;
    const clientName = readQuoteClientData(quote.clientData as QuoteClientData | null).nome?.trim() || "Il cliente";
    const number = quote.numeroPreventivoData || `N. ${quote.id.slice(0, 4).toUpperCase()}`;
    await createNotification({
      userId: quote.userId,
      type: "quote_viewed",
      title: `${clientName} ha aperto il preventivo ${number}`,
      body: "È il momento giusto per una telefonata.",
      link: `/dashboard/quotes/${quote.id}`,
      entityType: "quote",
      entityId: quote.id,
    });
  } catch (err) {
    logger.warn({ err, quoteId: quote.id }, "Quote viewed notification failed");
  }
}
