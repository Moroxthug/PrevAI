import type { Request, Response, NextFunction } from "express";
import { db, authUsersTable, businessProfilesTable, organizationMembersTable, hasFeature, minimumPlanFor, type ApiKey, type TeamMemberRole } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { findActiveApiKeyByRawKey } from "../lib/apiKeys.js";
import { userRateLimiter } from "../lib/rateLimit.js";

// Keys by res.locals.userId, which requireApiKey sets — must run AFTER it in
// every route's middleware chain, same convention as the cookie-auth routes'
// own userRateLimiter usage.
export const publicApiLimiter = userRateLimiter({ name: "apiKeyAuth.publicApiLimiter", windowMs: 60 * 60_000, max: 300, message: "Too many API requests this hour" });

/**
 * SEC-4: a key is worth what the person who created it is worth today. Before,
 * the role was only snapshotted: a member who left (or was demoted) kept a
 * working key, and a company that turned on mandatory 2FA still accepted keys
 * made by people without it. Keys stay bearer tokens (no 2FA per request — a
 * script can't type a code); what 2FA protects is who may hold one:
 * - the creator must still be the owner or an active member of the company;
 * - with the same role the key was made with (a role change suspends the key:
 *   make a new one, so a promotion never silently widens an old key);
 * - if the company requires 2FA, the creator must have it on.
 */
async function creatorStanding(key: ApiKey, orgRequiresTwoFactor: boolean): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  let role: TeamMemberRole | null = null;
  if (key.createdByUserId === key.userId) {
    role = "owner";
  } else {
    const [m] = await db
      .select({ role: organizationMembersTable.role })
      .from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.userId, key.createdByUserId), eq(organizationMembersTable.ownerId, key.userId), eq(organizationMembersTable.status, "active")));
    role = m?.role ?? null;
  }
  if (!role) return { ok: false, code: "API_KEY_CREATOR_GONE", message: "The person who created this API key is no longer on the team. Create a new key." };
  if (role !== key.role) return { ok: false, code: "API_KEY_ROLE_CHANGED", message: "The role of the person who created this API key has changed. Create a new key." };
  if (orgRequiresTwoFactor) {
    const [u] = await db.select({ twoFactorEnabled: authUsersTable.twoFactorEnabled }).from(authUsersTable).where(eq(authUsersTable.id, key.createdByUserId));
    if (!u?.twoFactorEnabled) return { ok: false, code: "two_factor_required", message: "This company requires two-step verification: the person who created this API key must turn it on." };
  }
  return { ok: true };
}

/**
 * Auth for the public API (`/api/v1/public/*`) — a bearer API key instead of
 * the cookie session `requireAuth` uses. Sets the same `res.locals` fields so
 * every downstream `requirePermission`/`getUserId` call works unchanged: the
 * key's snapshotted role stands in for `actorRole`, and its owning company
 * for `userId`.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const rawKey = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
  if (!rawKey) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Missing Authorization: Bearer <api key> header" });
    return;
  }

  const key = await findActiveApiKeyByRawKey(rawKey);
  if (!key) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or revoked API key" });
    return;
  }

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, key.userId));
  if (!hasFeature(profile, "public_api")) {
    res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("public_api"), message: "The public API requires the Elite plan" });
    return;
  }

  const standing = await creatorStanding(key, profile?.twoFactorRequired ?? false);
  if (!standing.ok) {
    res.status(403).json({ error: standing.code, message: standing.message });
    return;
  }

  res.locals.userId = key.userId;
  res.locals.actorUserId = key.userId;
  res.locals.actorRole = key.role;
  res.locals.userEmail = "";
  res.locals.userName = "";
  next();
}
