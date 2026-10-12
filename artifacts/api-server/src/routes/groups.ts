import { Router, type Response } from "express";
import { z } from "zod";
import { db, businessProfilesTable, companyGroupsTable, companyGroupMembersTable, organizationMembersTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { roleCan } from "@workspace/config";
import { and, eq, inArray, ne } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId, getActorRole } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { createNotification, writeAudit } from "../lib/notifications.js";
import { GroupError, groupOverview, groupStateFor, removeFromGroup, roleIn, type GroupState } from "../groups/service.js";

// ── POCKET-4 (riga 61, QuoteAI 127.8): i gruppi di imprese ───────────────────
// Ogni cosa qui la decide il titolare dell'impresa che tocca: un gruppo lo crea il titolare di un'impresa, un'altra impresa entra solo quando
// *il suo* titolare accetta. Il gruppo include l'analisi dell'impresa (piano Elite, come /analytics/company). Niente listino condiviso, niente
// fattura unica, niente persone su due squadre: toccano piani e fatturazione, decisioni del titolare ancora aperte.

const router = Router();

async function profileOf(orgId: string) {
  const [p] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
  return p ?? null;
}

function fail(res: Response, err: unknown, log: { error: (o: object, m: string) => void }, what: string) {
  if (err instanceof GroupError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  log.error({ err }, what);
  res.status(500).json({ error: "Internal server error" });
}

async function requireGroupFeature(res: Response): Promise<boolean> {
  const profile = await profileOf(getUserId(res));
  if (hasFeature(profile, "analytics_pro")) return true;
  res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("analytics_pro"), message: "I gruppi di imprese fanno parte del piano Elite" });
  return false;
}

/** Il gruppo dell'impresa in uso, attivo — oppure un 404 che chi chiama restituisce. */
async function activeState(res: Response): Promise<GroupState | null> {
  const state = await groupStateFor(getUserId(res));
  if (!state || state.self.status !== "active") {
    res.status(404).json({ error: "NO_GROUP", message: "Questa impresa non è in un gruppo." });
    return null;
  }
  return state;
}

const isManager = (state: GroupState, orgId: string) => state.group.userId === orgId;

async function serializeState(state: GroupState | null, actorId: string, orgId: string) {
  if (!state) return null;
  const companies = [];
  for (const m of state.members) {
    const role = await roleIn(actorId, m.userId);
    companies.push({
      orgId: m.userId, companyName: m.companyName, province: m.province, status: m.status, covered: false, useGroupCatalog: false,
      isManager: m.userId === state.group.userId, isBilling: false, isCatalog: false, isCurrent: m.userId === orgId, yourRole: role,
    });
  }
  return {
    id: state.group.id, name: state.group.name, managerOrgId: state.group.userId, catalogOrgId: null, billingOrgId: null,
    self: { status: state.self.status, useGroupCatalog: false, covered: false }, companies,
  };
}

// GET /api/group — il gruppo dell'impresa in uso (o un invito a uno), e cosa può farne la persona.
router.get("/group", requireAuth, async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const role = getActorRole(res);
    const [state, profile] = await Promise.all([groupStateFor(orgId), profileOf(orgId)]);
    const group = await serializeState(state, actorId, orgId);
    // Imprese che la persona potrebbe far entrare: quelle che ha o amministra e che non sono già in un gruppo.
    let candidates: { orgId: string; companyName: string }[] = [];
    const canManage = roleCan(role, "settings", "full") && (!state || (state.self.status === "active" && isManager(state, orgId)));
    if (canManage) {
      const memberships = await db.select({ ownerId: organizationMembersTable.ownerId, role: organizationMembersTable.role }).from(organizationMembersTable).where(and(eq(organizationMembersTable.userId, actorId), eq(organizationMembersTable.status, "active"), ne(organizationMembersTable.ownerId, orgId)));
      const ids = [...new Set([...(actorId !== orgId ? [actorId] : []), ...memberships.filter((m) => m.role === "owner" || m.role === "admin").map((m) => m.ownerId)])];
      if (ids.length) {
        const taken = new Set((await db.select({ userId: companyGroupMembersTable.userId }).from(companyGroupMembersTable).where(inArray(companyGroupMembersTable.userId, ids))).map((r) => r.userId));
        const profiles = await db.select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(inArray(businessProfilesTable.userId, ids));
        candidates = profiles.filter((p) => !taken.has(p.userId)).map((p) => ({ orgId: p.userId, companyName: p.companyName || "Impresa" }));
      }
    }
    res.json({
      available: hasFeature(profile, "analytics_pro"),
      requiredPlan: minimumPlanFor("analytics_pro"),
      canManage,
      canDecide: roleCan(role, "settings", "full"),
      group,
      billing: null,
      coveredBy: null,
      candidates,
    });
  } catch (err) {
    fail(res, err, req.log, "Error loading group");
  }
});

// POST /api/group — { name } — crea un gruppo con questa impresa dentro.
router.post("/group", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const body = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    if (!(await requireGroupFeature(res))) return;
    if (await groupStateFor(orgId)) {
      res.status(409).json({ error: "ALREADY_IN_GROUP", message: "Questa impresa è già in un gruppo." });
      return;
    }
    const actorId = getActorUserId(res);
    const group = await db.transaction(async (tx) => {
      const [g] = await tx.insert(companyGroupsTable).values({ userId: orgId, name: body.data.name, createdByUserId: actorId }).returning();
      await tx.insert(companyGroupMembersTable).values({ groupId: g!.id, userId: orgId, status: "active", invitedByUserId: actorId, joinedAt: new Date() });
      return g!;
    });
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "company_group", entityId: group.id, action: "group_created", diff: { name: group.name } });
    res.status(201).json({ group: await serializeState(await groupStateFor(orgId), actorId, orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error creating group");
  }
});

// POST /api/group/companies — { orgId } — invita un'impresa che la persona ha o amministra. Il suo titolare accetta.
router.post("/group/companies", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const actorId = getActorUserId(res);
    const body = z.object({ orgId: z.string().min(1) }).safeParse(req.body);
    if (!body.success || body.data.orgId === orgId) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const state = await activeState(res);
    if (!state) return;
    if (!isManager(state, orgId)) {
      res.status(403).json({ error: "NOT_MANAGER", message: "Solo l'impresa che gestisce il gruppo può invitare." });
      return;
    }
    const role = await roleIn(actorId, body.data.orgId);
    if (role !== "owner" && role !== "admin") {
      res.status(403).json({ error: "FORBIDDEN", message: "Puoi invitare solo un'impresa che hai o che amministri." });
      return;
    }
    const [taken] = await db.select({ id: companyGroupMembersTable.id }).from(companyGroupMembersTable).where(eq(companyGroupMembersTable.userId, body.data.orgId));
    if (taken) {
      res.status(409).json({ error: "ALREADY_IN_GROUP", message: "Quell'impresa è già in un gruppo." });
      return;
    }
    await db.insert(companyGroupMembersTable).values({ groupId: state.group.id, userId: body.data.orgId, status: "pending", invitedByUserId: actorId });
    await createNotification({ userId: body.data.orgId, type: "group_invite", title: `${state.members.find((m) => m.userId === orgId)?.companyName ?? "Un'impresa"} ha invitato questa impresa nel gruppo «${state.group.name}»`, link: "/dashboard", entityType: "company_group", entityId: state.group.id, push: false });
    await writeAudit({ userId: orgId, actorType: "user", actorId, entityType: "company_group", entityId: state.group.id, action: "group_company_invited", diff: { orgId: body.data.orgId } });
    res.status(201).json({ group: await serializeState(await groupStateFor(orgId), actorId, orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error inviting company to group");
  }
});

// POST /api/group/accept · /api/group/decline — il titolare dell'impresa invitata.
router.post("/group/accept", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const state = await groupStateFor(orgId);
    if (!state || state.self.status !== "pending") {
      res.status(404).json({ error: "NO_INVITATION" });
      return;
    }
    await db.update(companyGroupMembersTable).set({ status: "active", joinedAt: new Date() }).where(eq(companyGroupMembersTable.id, state.self.id));
    await writeAudit({ userId: orgId, actorType: "user", actorId: getActorUserId(res), entityType: "company_group", entityId: state.group.id, action: "group_joined", diff: {} });
    await createNotification({ userId: state.group.userId, type: "group_joined", title: `${state.members.find((m) => m.userId === orgId)?.companyName ?? "Un'impresa"} è entrata in «${state.group.name}»`, link: "/dashboard", entityType: "company_group", entityId: state.group.id, push: false });
    res.json({ group: await serializeState(await groupStateFor(orgId), getActorUserId(res), orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error accepting group invitation");
  }
});

router.post("/group/decline", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const state = await groupStateFor(orgId);
    if (!state || state.self.status !== "pending") {
      res.status(404).json({ error: "NO_INVITATION" });
      return;
    }
    await db.delete(companyGroupMembersTable).where(eq(companyGroupMembersTable.id, state.self.id));
    res.json({ group: null });
  } catch (err) {
    fail(res, err, req.log, "Error declining group invitation");
  }
});

// DELETE /api/group/companies/:orgId — l'impresa che gestisce ne toglie una, o un'impresa esce.
router.delete("/group/companies/:orgId", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const target = req.params.orgId as string;
    const state = await groupStateFor(orgId);
    if (!state || (state.self.status !== "active" && target !== orgId)) {
      res.status(404).json({ error: "NO_GROUP" });
      return;
    }
    if (target !== orgId && !isManager(state, orgId)) {
      res.status(403).json({ error: "NOT_MANAGER", message: "Solo l'impresa che gestisce il gruppo può togliere un'altra impresa." });
      return;
    }
    if (!state.members.some((m) => m.userId === target)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await removeFromGroup(state, target);
    await writeAudit({ userId: orgId, actorType: "user", actorId: getActorUserId(res), entityType: "company_group", entityId: state.group.id, action: target === orgId ? "group_left" : "group_company_removed", diff: { orgId: target } });
    res.json({ group: await serializeState(await groupStateFor(orgId), getActorUserId(res), orgId) });
  } catch (err) {
    fail(res, err, req.log, "Error removing company from group");
  }
});

// GET /api/group/overview?months=6 — la vista di insieme.
router.get("/group/overview", requireAuth, requirePermission("analytics", "view"), async (req, res) => {
  try {
    if (!(await requireGroupFeature(res))) return;
    const state = await activeState(res);
    if (!state) return;
    const months = Number.parseInt(String(req.query.months ?? "6"), 10);
    res.json(await groupOverview(getActorUserId(res), state, { months: Number.isFinite(months) ? months : 6 }));
  } catch (err) {
    fail(res, err, req.log, "Error computing group overview");
  }
});

export default router;
