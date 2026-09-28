// SEC-4 — size and type limits on the two Supabase Storage buckets (RUNBOOKS §28).
// Both buckets were created with no limit at all. Every upload goes through the
// API, which already checks size and type (multer limits, the logo whitelist):
// this is the second lock, enforced by Supabase itself, in case a route forgets.
//
//   pnpm --filter @workspace/api-server ops:storage-buckets            # shows current vs wanted
//   pnpm --filter @workspace/api-server ops:storage-buckets --apply    # writes the wanted settings
//
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (e.g. `node --env-file=../../.env.production`).
// Idempotent. Existing files are not touched: limits apply to new uploads.
import { createClient } from "@supabase/supabase-js";

const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET ?? "public-assets";
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET ?? "private-assets";

// public-assets holds only company logos (routes/business-profile.ts: 2 MB, SVG/PNG/JPEG).
// private-assets: the largest upload the API accepts is 15 MB (voice notes); PDFs,
// XML and photos are smaller. The type list stays open there (PDF, XML, CSV, images, audio…).
const WANTED: Record<string, { public: boolean; fileSizeLimit: string; allowedMimeTypes: string[] | null }> = {
  [PUBLIC_BUCKET]: { public: true, fileSizeLimit: "2MB", allowedMimeTypes: ["image/png", "image/jpeg", "image/svg+xml"] },
  [PRIVATE_BUCKET]: { public: false, fileSizeLimit: "25MB", allowedMimeTypes: null },
};

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}
const apply = process.argv.includes("--apply");
const supabase = createClient(url, key);

const { data: buckets, error } = await supabase.storage.listBuckets();
if (error) {
  console.error(`listBuckets: ${error.message}`);
  process.exit(1);
}

for (const [name, want] of Object.entries(WANTED)) {
  const have = buckets.find((b) => b.name === name);
  if (!have) {
    console.error(`${name}: bucket not found`);
    process.exitCode = 1;
    continue;
  }
  console.log(`${name}: public=${have.public} file_size_limit=${have.file_size_limit ?? "none"} allowed_mime_types=${JSON.stringify(have.allowed_mime_types ?? null)}`);
  if (have.public !== want.public) console.warn(`  ! expected public=${want.public} — not changed by this script, check it by hand`);
  if (!apply) {
    console.log(`  wanted: file_size_limit=${want.fileSizeLimit} allowed_mime_types=${JSON.stringify(want.allowedMimeTypes)}`);
    continue;
  }
  const { error: upErr } = await supabase.storage.updateBucket(name, {
    public: have.public,
    fileSizeLimit: want.fileSizeLimit,
    allowedMimeTypes: want.allowedMimeTypes,
  });
  if (upErr) {
    console.error(`  update failed: ${upErr.message}`);
    process.exitCode = 1;
  } else {
    console.log(`  updated: file_size_limit=${want.fileSizeLimit} allowed_mime_types=${JSON.stringify(want.allowedMimeTypes)}`);
  }
}
if (!apply) console.log("\nDry run. Add --apply to write these settings.");
