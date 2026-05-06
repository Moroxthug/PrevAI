import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import multer from "multer";
import type { Request } from "express";
import { db, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateBusinessProfileBody } from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage.js";

const router = Router();
const objectStorageService = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const ALLOWED_LOGO_MIMES = ["image/svg+xml", "image/png", "image/jpeg"];

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

// POST /api/business-profile/logo
// Accepts multipart/form-data with a single "file" field.
// Validates MIME type (SVG, PNG, JPEG) and size (max 2 MB) server-side.
// Uploads to logos/{userId}/{ext} and persists the serving URL on the profile.
router.post(
  "/business-profile/logo",
  requireAuth(),
  upload.single("file"),
  async (req, res) => {
    try {
      const userId = getUserId(req);

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const { mimetype, size, originalname, buffer } = req.file;

      if (!ALLOWED_LOGO_MIMES.includes(mimetype)) {
        res.status(400).json({
          error: "Invalid file type. Allowed types: SVG, PNG, JPEG",
        });
        return;
      }

      if (size > 2 * 1024 * 1024) {
        res.status(400).json({ error: "File too large. Maximum size: 2 MB" });
        return;
      }

      const ext = originalname.split(".").pop()?.toLowerCase() ?? "bin";
      const safeExt = ["svg", "png", "jpg", "jpeg"].includes(ext) ? ext : "png";
      const subPath = `logos/${userId}/logo.${safeExt}`;

      const objectPath = await objectStorageService.uploadObjectBuffer({
        subPath,
        buffer,
        contentType: mimetype,
      });

      const logoUrl = `/api/storage${objectPath}`;

      const [existing] = await db
        .select()
        .from(businessProfilesTable)
        .where(eq(businessProfilesTable.userId, userId));

      if (existing) {
        await db
          .update(businessProfilesTable)
          .set({ logoUrl })
          .where(eq(businessProfilesTable.userId, userId));
      } else {
        await db
          .insert(businessProfilesTable)
          .values({ userId, companyName: "", logoUrl });
      }

      res.json({ logoUrl });
    } catch (err) {
      req.log.error({ err }, "Error uploading logo");
      res.status(500).json({ error: "Failed to upload logo" });
    }
  }
);

export default router;
