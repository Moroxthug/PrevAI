import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import type { Request } from "express";
import { db, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateBusinessProfileBody } from "@workspace/api-zod";

const router = Router();

function getUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

// GET /api/business-profile
router.get("/business-profile", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    if (!profile) {
      res.json({
        userId,
        companyName: "",
        vatNumber: null,
        address: null,
        logoUrl: null,
        phone: null,
        email: null,
      });
      return;
    }

    res.json({
      userId: profile.userId,
      companyName: profile.companyName,
      vatNumber: profile.vatNumber ?? null,
      address: profile.address ?? null,
      logoUrl: profile.logoUrl ?? null,
      phone: profile.phone ?? null,
      email: profile.email ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching business profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/business-profile
router.put("/business-profile", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
    const parsed = UpdateBusinessProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }

    const body = parsed.data;
    const updates = {
      userId,
      ...(body.companyName !== undefined && { companyName: body.companyName }),
      ...(body.vatNumber !== undefined && { vatNumber: body.vatNumber }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.email !== undefined && { email: body.email }),
    };

    const [existing] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    let profile;
    if (existing) {
      [profile] = await db
        .update(businessProfilesTable)
        .set(updates)
        .where(eq(businessProfilesTable.userId, userId))
        .returning();
    } else {
      [profile] = await db
        .insert(businessProfilesTable)
        .values({ companyName: body.companyName ?? "", ...updates })
        .returning();
    }

    res.json({
      userId: profile!.userId,
      companyName: profile!.companyName,
      vatNumber: profile!.vatNumber ?? null,
      address: profile!.address ?? null,
      logoUrl: profile!.logoUrl ?? null,
      phone: profile!.phone ?? null,
      email: profile!.email ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error updating business profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
