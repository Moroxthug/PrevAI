// Job photo storage shared by the gallery upload route and (SQUADRA-1) the
// photos a worker sends from /t/:token: same bucket layout, same row.
import multer from "multer";
import { randomUUID } from "node:crypto";
import { db, jobPhotosTable, milestonesTable, type JobPhoto } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage.js";

const objectStorage = new ObjectStorageService();

const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Use a JPG, PNG, WEBP or HEIC photo.`));
  },
});

/** Thrown for a milestone id that is not on the job. */
export class MilestoneNotFoundError extends Error {
  constructor() {
    super("Milestone not found");
  }
}

/** Uploads the bytes and inserts the gallery row, last in the job's order. */
export async function storeJobPhoto(params: {
  userId: string;
  projectId: string;
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number };
  caption?: string;
  milestoneId?: string | null;
}): Promise<JobPhoto> {
  const milestoneId = params.milestoneId || null;
  if (milestoneId) {
    const [m] = await db.select({ id: milestonesTable.id }).from(milestonesTable).where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.projectId, params.projectId)));
    if (!m) throw new MilestoneNotFoundError();
  }
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" }[params.file.mimetype] ?? "bin";
  const subPath = `job-photos/${params.userId}/${params.projectId}/${randomUUID()}.${ext}`;
  const fileUrl = await objectStorage.uploadObjectBuffer({ subPath, buffer: params.file.buffer, contentType: params.file.mimetype });
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(jobPhotosTable).where(eq(jobPhotosTable.projectId, params.projectId));
  const [photo] = await db
    .insert(jobPhotosTable)
    .values({
      userId: params.userId,
      projectId: params.projectId,
      milestoneId,
      fileName: params.file.originalname,
      fileSize: params.file.size,
      mimeType: params.file.mimetype,
      fileUrl,
      caption: (params.caption ?? "").slice(0, 500),
      sortOrder: Number(count ?? 0),
    })
    .returning();
  return photo!;
}
