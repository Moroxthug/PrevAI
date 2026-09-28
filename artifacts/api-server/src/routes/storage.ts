import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { requireAuth } from "../middlewares/authMiddleware";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// SEC-4: POST /storage/uploads/request-url is gone. Nothing in the app used it,
// and it handed any signed-in user an unlimited, unchecked upload URL into the
// private bucket (no size, no type, no owner in the path). Every upload now
// goes through a route that checks size and type (multer limits) itself.

/**
 * Fase 41: uploaded files are served from the app's own origin, so an SVG logo
 * with a <script> inside would run as prevai.it if someone opened its URL.
 * The sandbox CSP stops any script in the file; <img> tags are unaffected.
 * PDFs are left out: Chrome refuses to open a PDF under a sandbox CSP.
 */
function hardenObjectResponse(res: Response): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (String(res.getHeader("content-type") ?? "").toLowerCase().startsWith("application/pdf")) return;
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
}

router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file, { isPublic: true });

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    hardenObjectResponse(res);

    if (response.body) {
      // The global ReadableStream (DOM lib/undici) doesn't expose the values()/
      // Symbol.asyncIterator of the node:stream/web type expected by
      // Readable.fromWeb: the double cast reflects that at runtime it's still
      // a compatible stream, just with a different type declaration.
      const nodeStream = Readable.fromWeb(response.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

router.get("/storage/objects/*objectPath", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.objectPath;
    const objectPath = Array.isArray(raw) ? raw.join("/") : raw;

    // Every private object is stored under `<type>/<ownerUserId>/...` — enforce
    // that the caller is the owner rather than relying on the path being hard
    // to guess (this route is otherwise reachable by any authenticated user).
    const ownerId = objectPath.split("/")[1];
    if (!ownerId || ownerId !== res.locals.userId) {
      res.status(404).json({ error: "Object not found" });
      return;
    }

    const objectData = await objectStorageService.downloadPrivateObject(objectPath);

    res.status(objectData.status);
    objectData.headers.forEach((value: string, key: string) => res.setHeader(key, value));
    hardenObjectResponse(res);

    if (objectData.body) {
      const nodeStream = Readable.fromWeb(objectData.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving private object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
