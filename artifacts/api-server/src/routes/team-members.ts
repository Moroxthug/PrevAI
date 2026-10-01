import { Router } from "express";
import { z } from "zod";
import { randomBytes, randomInt } from "node:crypto";
import {
  db,
  businessProfilesTable,
  organizationMembersTable,
  authUsersTable,
  quotesTable,
  invoicesTable,
  hasFeature,
  minimumPlanFor,
  effectivePlan,
  seatsIncluded,
  seatsLimit,
  TEAM_MEMBER_ROLES,
  type TeamMemberRole,
} from "@workspace/db";
import { POSTO_EXTRA } from "@workspace/config";
import { and, asc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { requireAuth, getUserId, getUserEmail, getActorUserId, ACTIVE_ORG_COOKIE, resolveActingOrg } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { hashToken, newRawToken } from "../contracts/service.js";
import { sendTeamMemberInviteEmail } from "../lib/emailTeam.js";
import { logger } from "../lib/logger.js";
import { ipRateLimiter } from "../lib/rateLimit.js";

// ── Phase 7: team accounts — invite/accept, role management, org switcher ──
// "Organization" = the owner's own business_profiles.userId; members are
// other auth_user rows granted access via organization_members. The owner
// itself never appears as a row in this table.

const router = Router();
const INVITE_LINK_DAYS = 7;
const ORG_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000; // ~400 days, matches common cookie caps

const INVITABLE_ROLES = TEAM_MEMBER_ROLES.filter((r) => r !== "owner") as Exclude<TeamMemberRole, "owner">[];

function cookieOpts(): { httpOnly: true; sameSite: "lax"; secure: boolean; path: "/"; maxAge: number } {
  return { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ORG_COOKIE_MAX_AGE_MS };
}

function serializeMember(m: typeof organizationMembersTable.$inferSelect) {
  return {
    id: m.id,
    email: m.invitedEmail,
    role: m.role,
    status: m.status,
    invitedAt: m.invitedAt.toISOString(),
    joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    inviteExpiresAt: m.inviteTokenExpiresAt ? m.inviteTokenExpiresAt.toISOString() : null,
    /** TEAM-1: entrato (o da far entrare) con un codice d'accesso invece che con l'email. */
    viaCode: !!m.accessCodeHash,
    label: m.accessCodeLabel,
  };
}

// ── TEAM-1: codici d'accesso ────────────────────────────────────────────────
// Otto caratteri senza i simili (niente 0/O, 1/I): si dettano al telefono e si
// scrivono a mano. 32^8 ≈ 10^12 combinazioni, 10 tentativi ogni 15 minuti per IP.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_DAYS = 30;
const CODE_PLACEHOLDER_DOMAIN = "codici.prevai.invalid";

function newAccessCode(): string {
  let raw = "";
  for (let i = 0; i < 8; i++) raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return raw;
}
const showCode = (raw: string) => `${raw.slice(0, 4)}-${raw.slice(4)}`;
/** Quello che la persona ha scritto, ripulito: maiuscole, senza trattino né spazi. */
const normalizeCode = (typed: string) => typed.toUpperCase().replace(/[^A-Z0-9]/g, "");

function seatLimitMessage(limit: number): string {
  return `Il tuo piano comprende ${limit} ${limit === 1 ? "posto" : "posti"} e sono tutti occupati. Passa a un piano più grande o togli qualcuno dalla squadra.`;
}

/** I posti occupati (titolare incluso; inviti e codici non ancora usati contano) e il tetto del piano. */
async function seatUsage(orgId: string, profile: Awaited<ReturnType<typeof loadProfile>>) {
  const rows = await db.select({ id: organizationMembersTable.id }).from(organizationMembersTable).where(and(eq(organizationMembersTable.ownerId, orgId), ne(organizationMembersTable.status, "suspended")));
  const plan = effectivePlan(profile);
  return { used: rows.length + 1, included: seatsIncluded(plan), extra: profile?.extraSeats ?? 0, limit: seatsLimit(plan, profile?.extraSeats) };
}

async function loadProfile(userId: string) {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return profile;
}

// GET /api/team/members — everyone in the org can see who else has access
router.get("/team/members", requireAuth, requirePermission("team", "view"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const members = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.ownerId, orgId)).orderBy(asc(organizationMembersTable.invitedAt));
    const profile = await loadProfile(orgId);
    const plan = effectivePlan(profile);
    res.json({
      items: members.map(serializeMember),
      seats: {
        used: members.filter((m) => m.status !== "suspended").length + 1,
        included: seatsIncluded(plan),
        extra: profile?.extraSeats ?? 0,
        limit: seatsLimit(plan, profile?.extraSeats),
        /** D20: finché il prezzo non c'è l'app non vende posti in più. */
        extraPurchasable: POSTO_EXTRA.acquistabile,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error listing team members");
    res.status(500).json({ error: "Internal server error" });
  }
});

const InviteBody = z.object({
  email: z.string().email().max(200),
  role: z.enum(INVITABLE_ROLES as [Exclude<TeamMemberRole, "owner">, ...Exclude<TeamMemberRole, "owner">[]]),
  send: z.boolean().optional(),
});

// POST /api/team/members/invite
router.post("/team/members/invite", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const body = InviteBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const profile = await loadProfile(orgId);
    if (!hasFeature(profile, "team_accounts")) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("team_accounts"), message: "Team accounts require the Pro plan" });
      return;
    }
    const email = body.data.email.toLowerCase().trim();

    const seats = await seatUsage(orgId, profile);
    const [existingRow] = await db
      .select()
      .from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.ownerId, orgId), eq(organizationMembersTable.invitedEmail, email)));
    if (existingRow?.status === "active") {
      res.status(409).json({ error: "ALREADY_MEMBER", message: "This person already has access." });
      return;
    }

    // Reissuing an open invite doesn't add a seat; bringing back a suspended one takes one back.
    const willAddSeat = !existingRow || existingRow.status === "suspended";
    if (willAddSeat && seats.used >= seats.limit) {
      res.status(403).json({ error: "SEAT_LIMIT", message: seatLimitMessage(seats.limit), seatsIncluded: seats.included, seatsLimit: seats.limit });
      return;
    }

    const raw = newRawToken();
    const expiresAt = new Date(Date.now() + INVITE_LINK_DAYS * 86_400_000);
    let memberId: string;
    if (existingRow) {
      const [updated] = await db
        .update(organizationMembersTable)
        .set({ role: body.data.role, status: "invited", inviteTokenHash: hashToken(raw), inviteTokenExpiresAt: expiresAt, invitedByUserId: actorId, joinedAt: null, userId: null })
        .where(eq(organizationMembersTable.id, existingRow.id))
        .returning();
      memberId = updated!.id;
    } else {
      const [created] = await db
        .insert(organizationMembersTable)
        .values({ ownerId: orgId, invitedEmail: email, role: body.data.role, status: "invited", invitedByUserId: actorId, inviteTokenHash: hashToken(raw), inviteTokenExpiresAt: expiresAt })
        .returning();
      memberId = created!.id;
    }

    const url = `${getBaseUrl()}/team-invite/${raw}`;
    let emailed = false;
    if (body.data.send !== false) {
      try {
        await sendTeamMemberInviteEmail({ toEmail: email, companyName: profile?.companyName || "la tua impresa", inviterName: getUserEmail(res) || "un collega", role: body.data.role, url, language: "it" });
        emailed = true;
      } catch (err) {
        logger.warn({ err, email }, "Team invite email failed; link returned to the dashboard");
      }
    }
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "team_member", entityId: memberId, action: "invite_issued", diff: { email, role: body.data.role, emailed } });
    res.status(201).json({ url, expiresAt: expiresAt.toISOString(), emailed });
  } catch (err) {
    req.log.error({ err }, "Error inviting team member");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/members/:id/resend
router.post("/team/members/:id/resend", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const [member] = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.id, req.params.id as string), eq(organizationMembersTable.ownerId, orgId)));
    if (!member || member.status === "active") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (member.accessCodeHash) {
      // Il codice si vede una sola volta e l'indirizzo è un segnaposto: niente da rimandare. Si toglie e se ne fa un altro.
      res.status(409).json({ error: "CODE_INVITE", message: "Questo posto è un codice d'accesso: non si può rimandare per email. Toglilo e creane un altro." });
      return;
    }
    const profile = await loadProfile(orgId);
    const raw = newRawToken();
    const expiresAt = new Date(Date.now() + INVITE_LINK_DAYS * 86_400_000);
    await db.update(organizationMembersTable).set({ status: "invited", inviteTokenHash: hashToken(raw), inviteTokenExpiresAt: expiresAt }).where(eq(organizationMembersTable.id, member.id));
    const url = `${getBaseUrl()}/team-invite/${raw}`;
    let emailed = false;
    try {
      await sendTeamMemberInviteEmail({ toEmail: member.invitedEmail, companyName: profile?.companyName || "la tua impresa", inviterName: getUserEmail(res) || "un collega", role: member.role, url, language: "it" });
      emailed = true;
    } catch (err) {
      logger.warn({ err, memberId: member.id }, "Team invite resend failed; link returned to the dashboard");
    }
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "invite_reissued", diff: { emailed } });
    res.json({ url, expiresAt: expiresAt.toISOString(), emailed });
  } catch (err) {
    req.log.error({ err }, "Error resending team invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

const UpdateMemberBody = z.object({
  role: z.enum(INVITABLE_ROLES as [Exclude<TeamMemberRole, "owner">, ...Exclude<TeamMemberRole, "owner">[]]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

// PUT /api/team/members/:id — change role, suspend/reactivate
router.put("/team/members/:id", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const [member] = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.id, req.params.id as string), eq(organizationMembersTable.ownerId, orgId)));
    if (!member) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = UpdateMemberBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    if (body.data.status === "active" && member.status !== "active") {
      res.status(409).json({ error: "NOT_JOINED", message: "This person hasn't accepted their invite yet." });
      return;
    }
    const updates: Partial<typeof organizationMembersTable.$inferInsert> = {};
    if (body.data.role !== undefined) updates.role = body.data.role;
    if (body.data.status !== undefined) updates.status = body.data.status;
    const [updated] = await db.update(organizationMembersTable).set(updates).where(eq(organizationMembersTable.id, member.id)).returning();
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "updated", diff: updates });
    res.json({ member: serializeMember(updated!) });
  } catch (err) {
    req.log.error({ err }, "Error updating team member");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/team/members/:id — revoke an invite or remove an active member
router.delete("/team/members/:id", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const [member] = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.id, req.params.id as string), eq(organizationMembersTable.ownerId, orgId)));
    if (!member) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.delete(organizationMembersTable).where(eq(organizationMembersTable.id, member.id));
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "removed", diff: { email: member.invitedEmail } });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error removing team member");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public invite lookup + accept ───────────────────────────────────────────

// Token-guessing budget for the unauthenticated invite preview (Phase 62) — same shape as the other public token routes.
const invitePreviewLimiter = ipRateLimiter({ name: "team-members.invitePreviewLimiter", windowMs: 60_000, max: 30, message: "Too many requests" });

// GET /api/team/invite/:token — no auth required, just previews the invite
router.get("/team/invite/:token", invitePreviewLimiter, async (req, res) => {
  try {
    const tokenHash = hashToken(req.params.token as string);
    const [member] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.inviteTokenHash, tokenHash));
    if (!member) {
      res.status(404).json({ error: "NOT_FOUND", message: "This invite link is invalid." });
      return;
    }
    if (member.status === "active") {
      res.status(409).json({ error: "ALREADY_ACCEPTED", message: "This invite has already been accepted." });
      return;
    }
    if (!member.inviteTokenExpiresAt || member.inviteTokenExpiresAt.getTime() < Date.now()) {
      res.status(410).json({ error: "EXPIRED", message: "This invite link has expired. Ask for a new one." });
      return;
    }
    const profile = await loadProfile(member.ownerId);
    res.json({ companyName: profile?.companyName || "", email: member.invitedEmail, role: member.role });
  } catch (err) {
    req.log.error({ err }, "Error looking up team invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/invite/:token/accept — the invitee must be logged in already (sign up/sign in first)
router.post("/team/invite/:token/accept", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const tokenHash = hashToken(req.params.token as string);
    const [member] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.inviteTokenHash, tokenHash));
    if (!member) {
      res.status(404).json({ error: "NOT_FOUND", message: "This invite link is invalid." });
      return;
    }
    if (member.status === "active") {
      res.status(409).json({ error: "ALREADY_ACCEPTED", message: "This invite has already been accepted." });
      return;
    }
    if (!member.inviteTokenExpiresAt || member.inviteTokenExpiresAt.getTime() < Date.now()) {
      res.status(410).json({ error: "EXPIRED", message: "This invite link has expired. Ask for a new one." });
      return;
    }
    const actorEmail = (res.locals.userEmail ?? "").toLowerCase().trim();
    if (actorEmail && actorEmail !== member.invitedEmail) {
      res.status(403).json({ error: "EMAIL_MISMATCH", message: `This invite was sent to ${member.invitedEmail}. Sign in with that email to accept it.` });
      return;
    }
    const [updated] = await db
      .update(organizationMembersTable)
      .set({ status: "active", userId: actorId, joinedAt: new Date(), inviteTokenHash: null, inviteTokenExpiresAt: null })
      .where(eq(organizationMembersTable.id, member.id))
      .returning();
    await writeAudit({ userId: member.ownerId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "invite_accepted" });
    res.cookie(ACTIVE_ORG_COOKIE, member.ownerId, cookieOpts());
    res.json({ member: serializeMember(updated!) });
  } catch (err) {
    req.log.error({ err }, "Error accepting team invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── TEAM-1: codici d'accesso e classifica ──────────────────────────────────

const CodeBody = z.object({
  role: z.enum(INVITABLE_ROLES as [Exclude<TeamMemberRole, "owner">, ...Exclude<TeamMemberRole, "owner">[]]),
  label: z.string().trim().max(80).optional(),
});

// POST /api/team/codes — un posto riservato per chi non ha (o non vuole dare) un'email: il codice si mostra una volta
router.post("/team/codes", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const body = CodeBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const profile = await loadProfile(orgId);
    if (!hasFeature(profile, "team_accounts")) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("team_accounts"), message: "Gli accessi della squadra sono dal piano Pro." });
      return;
    }
    const seats = await seatUsage(orgId, profile);
    if (seats.used >= seats.limit) {
      res.status(403).json({ error: "SEAT_LIMIT", message: seatLimitMessage(seats.limit), seatsIncluded: seats.included, seatsLimit: seats.limit });
      return;
    }
    const raw = newAccessCode();
    const expiresAt = new Date(Date.now() + CODE_DAYS * 86_400_000);
    const [created] = await db
      .insert(organizationMembersTable)
      .values({
        ownerId: orgId,
        invitedEmail: `codice-${randomBytes(6).toString("hex")}@${CODE_PLACEHOLDER_DOMAIN}`,
        role: body.data.role,
        status: "invited",
        invitedByUserId: actorId,
        accessCodeHash: hashToken(raw),
        accessCodeLabel: body.data.label || null,
        inviteTokenExpiresAt: expiresAt,
      })
      .returning();
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "team_member", entityId: created!.id, action: "access_code_issued", diff: { role: body.data.role, label: body.data.label ?? null } });
    res.status(201).json({ code: showCode(raw), expiresAt: expiresAt.toISOString(), memberId: created!.id });
  } catch (err) {
    req.log.error({ err }, "Error issuing access code");
    res.status(500).json({ error: "Internal server error" });
  }
});

const redeemLimiter = ipRateLimiter({ name: "team-members.redeemLimiter", windowMs: 15 * 60_000, max: 10, message: "Troppi tentativi. Riprova fra qualche minuto." });

// POST /api/team/code/redeem — chi ha già un accesso (creato da sé) scrive il codice e entra nell'impresa
router.post("/team/code/redeem", redeemLimiter, requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const body = z.object({ code: z.string().min(1).max(40) }).safeParse(req.body);
    const code = body.success ? normalizeCode(body.data.code) : "";
    if (code.length !== 8) {
      res.status(400).json({ error: "BAD_CODE", message: "Il codice ha otto caratteri, per esempio K7QM-4XNP." });
      return;
    }
    const [member] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.accessCodeHash, hashToken(code)));
    if (!member) {
      res.status(404).json({ error: "NOT_FOUND", message: "Non conosco questo codice. Controlla di averlo scritto giusto, o chiedine uno nuovo." });
      return;
    }
    if (member.userId) {
      res.status(409).json({ error: "CODE_USED", message: member.userId === actorId ? "Hai già usato questo codice: sei già nella squadra." : "Questo codice è già stato usato. Chiedine uno nuovo." });
      return;
    }
    if (!member.inviteTokenExpiresAt || member.inviteTokenExpiresAt.getTime() < Date.now()) {
      res.status(410).json({ error: "EXPIRED", message: "Questo codice è scaduto. Chiedine uno nuovo." });
      return;
    }
    if (member.ownerId === actorId) {
      res.status(409).json({ error: "OWN_COMPANY", message: "Questa è la tua impresa: il codice serve a chi entra dal di fuori." });
      return;
    }
    const email = (res.locals.userEmail ?? "").toLowerCase().trim();
    const [sameEmail] = email ? await db.select({ id: organizationMembersTable.id }).from(organizationMembersTable).where(and(eq(organizationMembersTable.ownerId, member.ownerId), eq(organizationMembersTable.invitedEmail, email))) : [];
    const [already] = await db.select({ id: organizationMembersTable.id }).from(organizationMembersTable).where(and(eq(organizationMembersTable.ownerId, member.ownerId), eq(organizationMembersTable.userId, actorId)));
    if (sameEmail || already) {
      res.status(409).json({ error: "ALREADY_MEMBER", message: "Sei già nella squadra di questa impresa (o hai un invito aperto con la tua email)." });
      return;
    }
    // Il posto era riservato alla creazione del codice. Due persone con lo stesso codice: entra una sola.
    const [updated] = await db
      .update(organizationMembersTable)
      .set({ status: "active", userId: actorId, joinedAt: new Date(), inviteTokenExpiresAt: null, ...(email ? { invitedEmail: email } : {}) })
      .where(and(eq(organizationMembersTable.id, member.id), sql`${organizationMembersTable.userId} is null`))
      .returning();
    if (!updated) {
      res.status(409).json({ error: "CODE_USED", message: "Questo codice è già stato usato. Chiedine uno nuovo." });
      return;
    }
    const profile = await loadProfile(member.ownerId);
    await writeAudit({ userId: member.ownerId, actorType: "user", actorId, entityType: "team_member", entityId: member.id, action: "access_code_redeemed" });
    res.cookie(ACTIVE_ORG_COOKIE, member.ownerId, cookieOpts());
    res.json({ member: serializeMember(updated), companyName: profile?.companyName || "" });
  } catch (err) {
    req.log.error({ err }, "Error redeeming access code");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/team/leaderboard?days=90 — chi ha inviato, chi ha vinto, quanto ha fatturato (titolare e amministratori)
router.get("/team/leaderboard", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const days = Math.min(365, Math.max(7, Math.trunc(Number(req.query.days) || 90)));
    const since = new Date(Date.now() - days * 86_400_000);

    const members = await db
      .select({ userId: organizationMembersTable.userId })
      .from(organizationMembersTable)
      .where(and(eq(organizationMembersTable.ownerId, orgId), eq(organizationMembersTable.status, "active"), isNotNull(organizationMembersTable.userId)));
    const peopleIds = [orgId, ...members.map((m) => m.userId!).filter((id) => id !== orgId)];

    const quoteRows = await db
      .select({ who: quotesTable.sentByUserId, sent: sql<number>`count(*)::int`, won: sql<number>`(count(*) filter (where ${quotesTable.status} = 'accepted'))::int` })
      .from(quotesTable)
      .where(and(eq(quotesTable.userId, orgId), isNotNull(quotesTable.sentByUserId), gte(quotesTable.sentAt, since)))
      .groupBy(quotesTable.sentByUserId);
    const invoiceRows = await db
      .select({ who: invoicesTable.sentByUserId, cents: sql<number>`coalesce(sum(${invoicesTable.totalCents}), 0)::float8` })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.userId, orgId), isNotNull(invoicesTable.sentByUserId), gte(invoicesTable.sentAt, since), ne(invoicesTable.type, "credit_note"), ne(invoicesTable.status, "void")))
      .groupBy(invoicesTable.sentByUserId);

    const everyone = [...new Set([...peopleIds, ...quoteRows.map((r) => r.who!), ...invoiceRows.map((r) => r.who!)])];
    const names = await db.select({ id: authUsersTable.id, name: authUsersTable.name, email: authUsersTable.email }).from(authUsersTable).where(inArray(authUsersTable.id, everyone));
    const nameOf = new Map(names.map((n) => [n.id, n]));
    const quotesBy = new Map(quoteRows.map((r) => [r.who!, r]));
    const invoicedBy = new Map(invoiceRows.map((r) => [r.who!, Number(r.cents)]));

    const items = everyone
      .map((id) => {
        const q = quotesBy.get(id);
        const sent = q?.sent ?? 0;
        const won = q?.won ?? 0;
        const u = nameOf.get(id);
        return { userId: id, name: u?.name || u?.email || "—", isOwner: id === orgId, quotesSent: sent, quotesWon: won, winRate: sent > 0 ? Math.round((won / sent) * 100) : null, invoicedCents: invoicedBy.get(id) ?? 0 };
      })
      .sort((a, b) => b.quotesWon - a.quotesWon || b.invoicedCents - a.invoicedCents || b.quotesSent - a.quotesSent || a.name.localeCompare(b.name, "it"));
    res.json({ days, since: since.toISOString(), items });
  } catch (err) {
    req.log.error({ err }, "Error building team leaderboard");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Org switcher ─────────────────────────────────────────────────────────────

// GET /api/team/orgs — every org this person can act as: their own (if they own one) + active memberships
router.get("/team/orgs", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const currentOrgId = getUserId(res);
    const orgs: { orgId: string; companyName: string; role: TeamMemberRole; isOwn: boolean }[] = [];
    const ownProfile = await loadProfile(actorId);
    if (ownProfile) orgs.push({ orgId: actorId, companyName: ownProfile.companyName || "My company", role: "owner", isOwn: true });
    const memberships = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.userId, actorId), eq(organizationMembersTable.status, "active"), ne(organizationMembersTable.ownerId, actorId)));
    for (const m of memberships) {
      const p = await loadProfile(m.ownerId);
      orgs.push({ orgId: m.ownerId, companyName: p?.companyName || "Company", role: m.role, isOwn: false });
    }
    res.json({ items: orgs, activeOrgId: currentOrgId });
  } catch (err) {
    req.log.error({ err }, "Error listing orgs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/switch — { orgId } — set the active org cookie
router.post("/team/switch", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const body = z.object({ orgId: z.string().min(1) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const { orgId, role } = await resolveActingOrg(actorId, body.data.orgId);
    if (orgId !== body.data.orgId) {
      res.status(403).json({ error: "FORBIDDEN", message: "You don't have access to that organization." });
      return;
    }
    res.cookie(ACTIVE_ORG_COOKIE, orgId, cookieOpts());
    res.json({ orgId, role });
  } catch (err) {
    req.log.error({ err }, "Error switching org");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
