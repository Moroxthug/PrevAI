// A-0 (docs/RUNBOOKS.md → "Cifratura campi fiscali"): encrypts at rest every
// fiscal field written before A-0 as plaintext — today `business_profiles.iban`
// (src/lib/fieldCrypto.ts format: `enc1:` + iv.tag.ciphertext, AES-256-GCM
// under TOKEN_ENCRYPTION_KEY).
//
//   TOKEN_ENCRYPTION_KEY=<64 hex> DATABASE_URL=… \
//     pnpm --filter @workspace/api-server ops:encrypt-fiscal-fields [--apply] [--user <id>]
//
// Without --apply it is a dry run that only counts. Idempotent: rows already
// carrying the prefix are skipped, so it can run again after the deploy to
// catch rows the old deployment wrote in between. Run it AFTER the A-0 code
// is live (the old code would show the ciphertext on invoices), which is the
// reverse of the usual migration→code order and why it is a script, not SQL.

import { createCipheriv, randomBytes } from "node:crypto";
import pg from "pg";

const ALGO = "aes-256-gcm";
const PREFIX = "enc1:";

// Keep in sync with `encryptField(` call sites and rotate-token-key.ts.
const COLUMNS: { table: string; pk: string; columns: string[] }[] = [{ table: "business_profiles", pk: "user_id", columns: ["iban"] }];

function key(): Buffer {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "hex");
  if (k.length !== 32) {
    console.error("TOKEN_ENCRYPTION_KEY must be 64 hex chars (openssl rand -hex 32)");
    process.exit(2);
  }
  return k;
}

function encrypt(plaintext: string, k: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, k, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return PREFIX + [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

async function main(): Promise<void> {
  const k = key();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(2);
  }
  const apply = process.argv.includes("--apply");
  const userIdx = process.argv.indexOf("--user");
  const onlyUser = userIdx === -1 ? undefined : process.argv[userIdx + 1];
  const pool = new pg.Pool({ connectionString: url, ssl: url.includes("127.0.0.1") || url.includes("localhost") ? undefined : { rejectUnauthorized: false }, max: 1 });
  const client = await pool.connect();
  let alreadyEncrypted = 0;
  const updates: { table: string; pk: string; id: unknown; column: string; value: string }[] = [];
  try {
    for (const { table, pk, columns } of COLUMNS) {
      const { rows } = await client.query<Record<string, unknown>>(
        `select ${[pk, ...columns].map((c) => `"${c}"`).join(", ")} from "public"."${table}"${onlyUser ? ` where "${pk}" = $1` : ""}`,
        onlyUser ? [onlyUser] : [],
      );
      for (const row of rows) {
        for (const column of columns) {
          const value = row[column];
          if (typeof value !== "string" || !value) continue;
          if (value.startsWith(PREFIX)) {
            alreadyEncrypted++;
            continue;
          }
          updates.push({ table, pk, id: row[pk], column, value: encrypt(value, k) });
        }
      }
      console.log(`  ${table.padEnd(28)} ${rows.length} row(s)`);
    }
    console.log(`\n${updates.length} plaintext value(s) to encrypt, ${alreadyEncrypted} already encrypted`);
    if (!apply) {
      console.log("\ndry run — re-run with --apply to write");
      return;
    }
    await client.query("BEGIN");
    for (const u of updates) {
      await client.query(`update "public"."${u.table}" set "${u.column}" = $1 where "${u.pk}" = $2`, [u.value, u.id]);
    }
    await client.query("COMMIT");
    console.log(`\napplied: ${updates.length} value(s) encrypted. Re-run (dry run) to confirm 0 left.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
