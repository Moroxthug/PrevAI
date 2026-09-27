// V2-3 (docs/PIANO-AZIONE.md): in-memory Supabase Storage for the e2e suite.
//
// The suite runs against a staging *database* that may be a plain Postgres
// (the V2-3 rehearsal restores the production dump into a local Postgres 17,
// which has no Storage API). When SUPABASE_URL is not set, vitest.e2e.setup.ts
// points the storage client at a fake host and this module answers the
// storage-js REST calls that `src/lib/objectStorage.ts` and the harness make:
// upload, download, list, remove, signed download/upload URLs. Objects live in
// a Map for the lifetime of the process; nothing touches a real bucket.
// Enabled by `installVendorStubs()` when E2E_STORAGE_STUB=1.
//
// Endpoint shapes follow @supabase/storage-js 2.116 (StorageFileApi).

import type { StubbedRequest } from "./vendorStub.js";

// Type-only import above: vendorStub.ts imports this module, so keep it free of
// runtime dependencies on it.
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const STORAGE_STUB_URL = "http://e2e-storage.local";

type StoredObject = { bytes: Uint8Array<ArrayBuffer>; contentType: string; updatedAt: string };
const objects = new Map<string, StoredObject>(); // key = `${bucket}/${path}`

export function storedObjectCount(): number {
  return objects.size;
}

export function resetStorageStub(): void {
  objects.clear();
}

async function bodyBytes(raw: BodyInit | null | undefined): Promise<Uint8Array<ArrayBuffer>> {
  if (raw == null) return new Uint8Array();
  if (typeof raw === "string") return new TextEncoder().encode(raw);
  if (raw instanceof Uint8Array) return new Uint8Array(raw); // copy into a plain ArrayBuffer
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (raw instanceof Blob) return new Uint8Array(await raw.arrayBuffer());
  if (raw instanceof FormData) {
    const file = raw.get("");
    if (file instanceof Blob) return new Uint8Array(await file.arrayBuffer());
    return new Uint8Array();
  }
  if (raw instanceof URLSearchParams) return new TextEncoder().encode(raw.toString());
  // ReadableStream or Node stream
  return new Uint8Array(await new Response(raw as BodyInit).arrayBuffer());
}

function entry(name: string, obj?: StoredObject) {
  const now = obj?.updatedAt ?? new Date().toISOString();
  return {
    name,
    id: obj ? `id-${name}` : null,
    updated_at: now,
    created_at: now,
    last_accessed_at: now,
    metadata: obj ? { size: obj.bytes.byteLength, mimetype: obj.contentType } : null,
  };
}

export async function handleStorageRequest(req: StubbedRequest): Promise<Response> {
  const url = new URL(req.url);
  const rel = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ""));

  // POST /object/list/{bucket}
  let m = /^\/object\/list\/([^/]+)$/.exec(rel);
  if (m && req.method === "POST") {
    const bucket = m[1]!;
    const body = (req.json ?? {}) as { prefix?: string; limit?: number; offset?: number; search?: string };
    const prefix = (body.prefix ?? "").replace(/^\/|\/$/g, "");
    const seen = new Map<string, StoredObject | undefined>();
    for (const [key, obj] of objects) {
      if (!key.startsWith(`${bucket}/`)) continue;
      const path = key.slice(bucket.length + 1);
      if (prefix && !path.startsWith(`${prefix}/`)) continue;
      const rest = prefix ? path.slice(prefix.length + 1) : path;
      const slash = rest.indexOf("/");
      if (slash === -1) seen.set(rest, obj);
      else if (!seen.has(rest.slice(0, slash))) seen.set(rest.slice(0, slash), undefined);
    }
    let names = [...seen.keys()].sort();
    if (body.search) names = names.filter((n) => n.includes(body.search!));
    const offset = body.offset ?? 0;
    const limit = body.limit ?? 100;
    return json(200, names.slice(offset, offset + limit).map((n) => entry(n, seen.get(n))));
  }

  // POST /object/upload/sign/{bucket}/{path}  → signed upload url
  m = /^\/object\/upload\/sign\/([^/]+)\/(.+)$/.exec(rel);
  if (m && req.method === "POST") {
    return json(200, { url: `/object/upload/sign/${m[1]}/${m[2]}?token=e2e-upload-token` });
  }
  // PUT /object/upload/sign/{bucket}/{path}?token=…  → upload through the signed url
  if (m && req.method === "PUT") {
    const key = `${m[1]}/${m[2]}`;
    objects.set(key, { bytes: await bodyBytes(req.raw), contentType: req.headers["content-type"] ?? "application/octet-stream", updatedAt: new Date().toISOString() });
    return json(200, { Key: key, Id: `id-${key}` });
  }

  // POST /object/sign/{bucket}/{path}  → signed download url
  m = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(rel);
  if (m && req.method === "POST") {
    if (!objects.has(`${m[1]}/${m[2]}`)) return json(404, { statusCode: "404", error: "not_found", message: "Object not found" });
    return json(200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=e2e-signed-token` });
  }
  // GET /object/sign/{bucket}/{path}?token=…  → download through the signed url
  if (m && req.method === "GET") {
    const obj = objects.get(`${m[1]}/${m[2]}`);
    if (!obj) return json(404, { statusCode: "404", error: "not_found", message: "Object not found" });
    return new Response(obj.bytes, { status: 200, headers: { "content-type": obj.contentType } });
  }

  // DELETE /object/{bucket}  { prefixes: [...] }
  m = /^\/object\/([^/]+)$/.exec(rel);
  if (m && req.method === "DELETE") {
    const bucket = m[1]!;
    const prefixes = ((req.json ?? {}) as { prefixes?: string[] }).prefixes ?? [];
    const removed = [];
    for (const p of prefixes) {
      const key = `${bucket}/${p.replace(/^\/+/, "")}`;
      const obj = objects.get(key);
      if (obj) {
        objects.delete(key);
        removed.push({ ...entry(p, obj), bucket_id: bucket });
      }
    }
    return json(200, removed);
  }

  // POST|PUT /object/{bucket}/{path}  → upload;  GET|HEAD → download
  m = /^\/object\/([^/]+)\/(.+)$/.exec(rel);
  if (m) {
    const key = `${m[1]}/${m[2]}`;
    if (req.method === "POST" || req.method === "PUT") {
      if (req.method === "POST" && req.headers["x-upsert"] !== "true" && objects.has(key)) {
        return json(400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      }
      objects.set(key, { bytes: await bodyBytes(req.raw), contentType: req.headers["content-type"] ?? "application/octet-stream", updatedAt: new Date().toISOString() });
      return json(200, { Key: key, Id: `id-${key}` });
    }
    if (req.method === "GET" || req.method === "HEAD") {
      const obj = objects.get(key);
      if (!obj) return json(404, { statusCode: "404", error: "not_found", message: "Object not found" });
      return new Response(req.method === "HEAD" ? null : obj.bytes, { status: 200, headers: { "content-type": obj.contentType, "content-length": String(obj.bytes.byteLength) } });
    }
  }

  return json(404, { statusCode: "404", error: "not_found", message: `e2e storage stub: unhandled ${req.method} ${rel}` });
}

