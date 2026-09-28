// SEC-4 — the public quote link (/p/…), revocable and with an expiry.
//
// Before: the quote's UUID was the link. It never expired, could not be taken
// back (a PDF sent to the wrong address stayed open for good), and anyone who
// ever saw the id — a former employee, a log line — could open and accept it.
//
// Now the link is `<quote id>.<signature>`, the signature an HMAC of the id and
// the link's `version` (quote_public_links, migration 0016). Revoking bumps the
// version: every link sent so far dies, the next share makes a new one. Each
// share moves the expiry forward by QUOTE_LINK_DAYS.
//
// Links sent before this change (the bare UUID) keep working for quotes created
// before the cutoff (legacyCutoff), for QUOTE_LINK_DAYS after it, unless the
// company revokes them. Until migration 0016 has run everything behaves as
// before — and bare-UUID links are still handed out — so the cutoff is the
// later of LEGACY_CREATED_BEFORE and the first managed link ever made.
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, quotePublicLinksTable, quotesTable, type QuotePublicLink } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { tableReady } from "../assistant/ready.js";
import { getBaseUrl } from "../lib/baseUrl.js";

/** A link stays open this many days after the company last shared it. */
export const QUOTE_LINK_DAYS = 180;
/** Quotes created before this moment may still be opened by their bare UUID (links already in customers' inboxes). */
export const LEGACY_CREATED_BEFORE = new Date("2026-09-29T00:00:00Z");

let firstLinkAt: Date | null = null;

/**
 * Quotes created before the returned moment may be opened by their bare UUID;
 * null = no managed link exists yet, so every link out there is a bare UUID.
 * The first managed link appears right after migration 0016 (the next share),
 * which covers an owner who runs the migration days after the deploy.
 */
export async function legacyCutoff(): Promise<Date | null> {
  if (!firstLinkAt) {
    const [r] = await db.select({ at: sql<string | null>`min(${quotePublicLinksTable.createdAt})` }).from(quotePublicLinksTable);
    if (r?.at) firstLinkAt = new Date(r.at);
  }
  if (!firstLinkAt) return null;
  return firstLinkAt > LEGACY_CREATED_BEFORE ? firstLinkAt : LEGACY_CREATED_BEFORE;
}

const TABLE = "quote_public_links";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function linksReady(): Promise<boolean> {
  return tableReady(TABLE);
}

function key(): string {
  const s = process.env.QUOTE_LINK_SECRET ?? process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET;
  if (!s) throw new Error("No server secret configured for quote links (set QUOTE_LINK_SECRET)");
  return `quote-link:${s}`;
}

/** 128 bits of HMAC, base64url — short enough for a WhatsApp message. */
export function quoteLinkSignature(quoteId: string, version: number): string {
  return createHmac("sha256", key()).update(`${quoteId.toLowerCase()}:${version}`).digest("base64url").slice(0, 22);
}

export function quoteLinkRef(quoteId: string, version: number): string {
  return `${quoteId}.${quoteLinkSignature(quoteId, version)}`;
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + QUOTE_LINK_DAYS * 86_400_000);
}

export type PublicLinkInfo = {
  /** Full URL to send, or null when the link is revoked (share again to make a new one). */
  url: string | null;
  expiresAt: string | null;
  revoked: boolean;
  /** False until migration 0016 has run: the link is the bare UUID, with no expiry or revocation. */
  managed: boolean;
};

function info(quoteId: string, row: QuotePublicLink | null): PublicLinkInfo {
  if (!row) return { url: `${getBaseUrl()}/p/${quoteId}`, expiresAt: null, revoked: false, managed: false };
  if (row.revokedAt) return { url: null, expiresAt: null, revoked: true, managed: true };
  return { url: `${getBaseUrl()}/p/${quoteLinkRef(quoteId, row.version)}`, expiresAt: row.expiresAt.toISOString(), revoked: false, managed: true };
}

async function loadRow(quoteId: string): Promise<QuotePublicLink | null> {
  const [row] = await db.select().from(quotePublicLinksTable).where(eq(quotePublicLinksTable.quoteId, quoteId));
  return row ?? null;
}

/**
 * The link to give the customer. `share: true` (an email, a copy of the link)
 * makes one if needed, reopens a revoked one with a new version and moves the
 * expiry forward. `share: false` only reads (the dashboard showing the state).
 * `reopen: false` (automatic reminders) never brings back a link the company
 * revoked: url is null and the caller skips the message.
 */
export async function publicQuoteLink(quote: { id: string; userId: string }, opts: { share: boolean; reopen?: boolean }, now = new Date()): Promise<PublicLinkInfo> {
  if (!(await linksReady())) return info(quote.id, null);
  if (!opts.share || opts.reopen === false) {
    const row = await loadRow(quote.id);
    if (!opts.share) return row ? info(quote.id, row) : { url: null, expiresAt: null, revoked: false, managed: true };
    if (row?.revokedAt) return info(quote.id, row);
  }
  const expiresAt = expiryFrom(now);
  const [row] = await db
    .insert(quotePublicLinksTable)
    .values({ quoteId: quote.id, userId: quote.userId, version: 1, expiresAt })
    .onConflictDoUpdate({
      target: quotePublicLinksTable.quoteId,
      set: {
        // A revoked link comes back as a new version: the old links stay dead.
        version: sql`case when ${quotePublicLinksTable.revokedAt} is null then ${quotePublicLinksTable.version} else ${quotePublicLinksTable.version} + 1 end`,
        revokedAt: null,
        expiresAt,
        updatedAt: now,
      },
    })
    .returning();
  return info(quote.id, row!);
}

/** Kills every link sent so far (the old bare-UUID one too). The next share makes a new one. */
export async function revokePublicQuoteLink(quote: { id: string; userId: string }, now = new Date()): Promise<boolean> {
  if (!(await linksReady())) return false;
  await db
    .insert(quotePublicLinksTable)
    // version 2 at once: version 1 is what a legacy UUID link counts as.
    .values({ quoteId: quote.id, userId: quote.userId, version: 2, expiresAt: now, revokedAt: now })
    .onConflictDoUpdate({
      target: quotePublicLinksTable.quoteId,
      set: { version: sql`${quotePublicLinksTable.version} + 1`, revokedAt: now, updatedAt: now },
    });
  return true;
}

export type ResolvedRef = { ok: true; quoteId: string } | { ok: false; reason: "not_found" | "expired" };

/**
 * What the public routes call with the `/p/<ref>` part. Only says "expired"
 * when the signature was right (a real link that ran out); anything else is
 * "not found", so a guess learns nothing.
 */
export async function resolvePublicQuoteRef(ref: string, now = new Date()): Promise<ResolvedRef> {
  const dot = ref.indexOf(".");
  const quoteId = dot === -1 ? ref : ref.slice(0, dot);
  if (!UUID.test(quoteId)) return { ok: false, reason: "not_found" };
  const ready = await linksReady();

  if (dot === -1) {
    // A link sent before SEC-4.
    if (!ready) return { ok: true, quoteId };
    const row = await loadRow(quoteId);
    if (row && (row.version !== 1 || row.revokedAt)) return { ok: false, reason: "not_found" };
    const [q] = await db.select({ createdAt: quotesTable.createdAt }).from(quotesTable).where(eq(quotesTable.id, quoteId));
    if (!q) return { ok: false, reason: "not_found" };
    const cutoff = await legacyCutoff();
    if (!cutoff) return { ok: true, quoteId };
    if (q.createdAt >= cutoff) return { ok: false, reason: "not_found" };
    return now.getTime() < cutoff.getTime() + QUOTE_LINK_DAYS * 86_400_000 ? { ok: true, quoteId } : { ok: false, reason: "expired" };
  }

  if (!ready) return { ok: false, reason: "not_found" };
  const row = await loadRow(quoteId);
  if (!row || row.revokedAt) return { ok: false, reason: "not_found" };
  const given = Buffer.from(ref.slice(dot + 1));
  const wanted = Buffer.from(quoteLinkSignature(quoteId, row.version));
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return { ok: false, reason: "not_found" };
  if (row.expiresAt <= now) return { ok: false, reason: "expired" };
  return { ok: true, quoteId };
}

/** The quote if it belongs to this company, with what the dashboard link routes need. */
export async function ownedQuote(userId: string, quoteId: string) {
  if (!UUID.test(quoteId)) return null;
  const [q] = await db.select({ id: quotesTable.id, userId: quotesTable.userId, status: quotesTable.status }).from(quotesTable).where(and(eq(quotesTable.id, quoteId), eq(quotesTable.userId, userId)));
  return q ?? null;
}
