// Shared fixtures for the e2e suite (Phase 63). Boots the real Express app
// on an ephemeral port, mints users + bearer sessions straight into the auth
// tables (better-auth's `bearer()` plugin accepts a raw session token), and
// tears every created user down — cascades plus a sweep of every table that
// carries a user_id — so a run leaves nothing behind.

import { randomUUID, randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { db, authUsersTable, authSessionsTable, businessProfilesTable, quotesTable, type PaymentSchedule } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import app from "../app.js";

// ── Server ───────────────────────────────────────────────────────────────────

let server: Server | null = null;
let baseUrl = "";

export async function startServer(): Promise<string> {
  if (server) return baseUrl;
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server!.address();
  if (!addr || typeof addr === "string") throw new Error("could not read server address");
  baseUrl = `http://127.0.0.1:${addr.port}`;
  return baseUrl;
}

export async function stopServer(): Promise<void> {
  if (!server) return;
  // fetch() keeps sockets alive; close() alone would wait on them forever.
  server.closeAllConnections();
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
}

// ── HTTP client ──────────────────────────────────────────────────────────────

export type ApiResponse<T = any> = { status: number; body: T; headers: Headers };

export type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Raw multipart body — sent as-is with its own content type. */
  form?: FormData;
  headers?: Record<string, string>;
  token?: string | null;
};

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${baseUrl}${path}`, { method: opts.method ?? (body ? "POST" : "GET"), headers, body });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body (CSV, PDF) — keep the text */
  }
  return { status: res.status, body: parsed as T, headers: res.headers };
}

// ── Users / orgs ─────────────────────────────────────────────────────────────

export type TestUser = {
  userId: string;
  email: string;
  name: string;
  token: string;
  /** Convenience: `api()` with this user's bearer token. */
  api: <T = any>(path: string, opts?: ApiOptions) => Promise<ApiResponse<T>>;
};

const created = new Set<string>();
// E2E_NO_PURGE=1 lets two QA scripts share the database at once (the purge would
// otherwise delete the other process's live fixtures).
let purgedThisProcess = process.env.E2E_NO_PURGE === "1";

export async function createUser(opts: { name?: string; email?: string } = {}): Promise<TestUser> {
  if (!purgedThisProcess) {
    purgedThisProcess = true;
    const purged = await purgeStaleFixtures();
    if (purged) console.log(`(purged ${purged} stale e2e fixture(s) from an earlier aborted run)`);
  }
  const userId = `e2e_${randomUUID()}`;
  const email = (opts.email ?? `e2e-${randomUUID()}@example.invalid`).toLowerCase();
  const name = opts.name ?? "E2E User";
  await db.insert(authUsersTable).values({ id: userId, name, email, emailVerified: true });
  const token = randomBytes(32).toString("base64url");
  await db.insert(authSessionsTable).values({ id: randomUUID(), token, userId, expiresAt: new Date(Date.now() + 86_400_000) });
  created.add(userId);
  return { userId, email, name, token, api: (path, o = {}) => api(path, { ...o, token }) };
}

export type OrgOptions = {
  province?: string;
  plan?: "free" | "monthly_starter" | "monthly_pro" | "monthly_elite";
  companyName?: string;
  profile?: Partial<typeof businessProfilesTable.$inferInsert>;
};

/** A contractor account: user + business profile on the given plan (elite by default — every feature on). */
export async function createOrg(opts: OrgOptions = {}): Promise<TestUser & { province: string }> {
  const province = opts.province ?? "MI";
  const companyName = opts.companyName ?? `E2E ${province} Srl`;
  const user = await createUser({ name: companyName });
  const plan = opts.plan ?? "monthly_elite";
  await db.insert(businessProfilesTable).values({
    userId: user.userId,
    companyName,
    province,
    vatNumber: "IT01234567890",
    reaNumber: "CCIAA MI-1234567",
    email: `owner-${user.userId}@example.invalid`,
    phone: "0212345678",
    subscriptionPlan: plan === "free" ? null : plan,
    subscriptionStatus: plan === "free" ? null : "active",
    automationSettings: { notifyOnQuoteAccepted: true, autoDraftContract: true, autoSendInvoices: false, invoiceAutoSendAfterHours: 0, invoiceReminders: true },
    ...(opts.profile ?? {}),
  });
  return { ...user, province };
}

// ── Quotes ───────────────────────────────────────────────────────────────────

export type SeedQuoteOptions = {
  province?: string;
  holdback?: boolean;
  clientName?: string;
  clientEmail?: string;
  status?: "draft" | "pending_payment" | "unlocked" | "accepted";
};

/** The same two-chapter $10,000 kitchen quote the Phase 6 lifecycle test used. */
export async function seedQuote(userId: string, opts: SeedQuoteOptions = {}) {
  const province = opts.province ?? "MI";
  const paymentSchedule: PaymentSchedule = {
    currency: "EUR",
    derived: false,
    holdback: { enabled: opts.holdback ?? false, percent: 10 },
    terms: [
      { id: "t1", type: "deposit", label: "Acconto", trigger: "on_signing", amountType: "percent", value: 30, dueDays: 0 },
      { id: "t2", type: "milestone", label: "Inizio lavori", trigger: "milestone", amountType: "percent", value: 40, dueDays: 15 },
      { id: "t3", type: "completion", label: "Saldo finale", trigger: "on_completion", amountType: "percent", value: 30, dueDays: 15 },
    ],
  };
  const [quote] = await db
    .insert(quotesTable)
    .values({
      userId,
      province,
      clientData: {
        nome: opts.clientName ?? "Giulia Cliente",
        indirizzo: "Via dei Clienti 456",
        city: province === "NA" ? "Napoli" : "Milano",
        province,
        postalCode: province === "NA" ? "80100" : "20100",
        email: opts.clientEmail ?? "client@e2e-test.invalid",
        phone: "0212345678",
      },
      descrizioneGenerale: "Ristrutturazione cucina",
      capitoli: [
        { lettera: "A", titolo: "Demolizioni e preparazione", subtotale: 4000, voci: [{ descrizione: "Smontaggio cucina esistente", quantita: 1, um: "a corpo", prezzoUnitario: 4000, totale: 4000 }] },
        { lettera: "B", titolo: "Mobili e piani di lavoro", subtotale: 6000, voci: [{ descrizione: "Posa mobili e piani", quantita: 1, um: "a corpo", prezzoUnitario: 6000, totale: 6000 }] },
      ],
      condizioniPagamento: ["30% acconto alla firma", "40% all'inizio lavori", "30% a fine lavori"],
      paymentSchedule,
      subtotale: "10000",
      ivaPercentuale: "0", // forces buildVariablesFromQuote to use the real province tax profile
      totale: "10000",
      status: opts.status ?? "unlocked",
    })
    .returning();
  return quote!;
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

let userIdTables: string[] | null = null;

async function tablesWithUserId(): Promise<string[]> {
  if (userIdTables) return userIdTables;
  const rows = await db.execute<{ table_name: string }>(sql`
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'user_id' and table_name <> 'auth_user'
  `);
  userIdTables = rows.rows.map((r) => r.table_name);
  return userIdTables;
}

/**
 * Deletes everything the given users own. Most tables cascade from auth_user,
 * but many tenant tables key on a plain `user_id text` with no FK — so sweep
 * every table that has the column, in as many passes as FK ordering needs,
 * then drop the users themselves.
 */
export async function cleanupUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const tables = await tablesWithUserId();
  // drizzle spreads a JS array into a tuple (`($1, $2)`), which is what `in` wants.
  const ids = sql`(${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`;
  const pending = new Set(tables);
  for (let pass = 0; pass < 6 && pending.size; pass++) {
    for (const table of [...pending]) {
      try {
        await db.execute(sql`delete from ${sql.identifier(table)} where user_id in ${ids}`);
        pending.delete(table);
      } catch (err) {
        // FK ordering — retry on the next pass.
        if (process.env.E2E_DEBUG) console.log(`cleanup ${table}: retry (${(err as Error).message})`);
      }
    }
  }
  // organization_members keys the org on owner_id.
  await db.execute(sql`delete from organization_members where owner_id in ${ids} or user_id in ${ids}`);
  for (const id of userIds) await db.delete(authUsersTable).where(eq(authUsersTable.id, id));
  await deleteStorageForUsers(userIds);
  for (const id of userIds) created.delete(id);
  if (pending.size) throw new Error(`cleanup could not empty: ${[...pending].join(", ")}`);
}

/** Every user this process created and has not yet cleaned up. */
export async function cleanupAll(): Promise<void> {
  await cleanupUsers([...created]);
}

// Signed contracts and invoice PDFs land in the private bucket under
// `<kind>/<userId>/…` (contracts/service.ts, invoices/service.ts), so one
// prefix listing per kind per user finds everything a run uploaded.
const STORAGE_KINDS = ["contracts", "invoices", "sdi", "commercialista"];

async function deleteStorageForUsers(userIds: string[]): Promise<void> {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const bucket = supabase.storage.from(process.env.SUPABASE_PRIVATE_BUCKET ?? "private-assets");
  for (const userId of userIds) {
    for (const kind of STORAGE_KINDS) {
      const prefix = `${kind}/${userId}`;
      const { data: entities } = await bucket.list(prefix, { limit: 1000 });
      const paths: string[] = [];
      for (const entity of entities ?? []) {
        const { data: files } = await bucket.list(`${prefix}/${entity.name}`, { limit: 1000 });
        for (const f of files ?? []) paths.push(`${prefix}/${entity.name}/${f.name}`);
      }
      if (paths.length) await bucket.remove(paths);
    }
  }
}

/**
 * Orphans from a previous run that was killed before its afterAll (Ctrl-C, a
 * hook timeout, a crashed worker). Every fixture user id starts with `e2e_`,
 * so this is safe on a shared database; the first `createUser` in each
 * process runs it.
 */
export async function purgeStaleFixtures(): Promise<number> {
  const rows = await db.execute<{ id: string }>(sql`select id from auth_user where id like 'e2e\_%' escape '\'`);
  const stale = rows.rows.map((r) => r.id).filter((id) => !created.has(id));
  if (stale.length) await cleanupUsers(stale);
  // PDFs whose user rows are already gone (a run that died between the two steps).
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const bucket = supabase.storage.from(process.env.SUPABASE_PRIVATE_BUCKET ?? "private-assets");
  const orphanFolders = new Set<string>();
  for (const kind of STORAGE_KINDS) {
    const { data } = await bucket.list(kind, { limit: 1000 });
    for (const d of data ?? []) if (d.name.startsWith("e2e_") && !created.has(d.name)) orphanFolders.add(d.name);
  }
  if (orphanFolders.size) await deleteStorageForUsers([...orphanFolders]);
  return stale.length + orphanFolders.size;
}

// ── Misc helpers ─────────────────────────────────────────────────────────────

export const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);
export const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
