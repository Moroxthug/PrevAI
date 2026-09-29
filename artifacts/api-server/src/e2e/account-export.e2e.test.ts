// GDPR-1 — "Scarica i tuoi dati": richiesta con password solo dal titolare,
// ZIP in parti (dati + file), campi segreti nascosti e cifrati in chiaro,
// link firmato solo per la propria impresa, ripresa a metà, scadenza a 7 giorni.

import { randomUUID } from "node:crypto";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "better-auth/crypto";
import { db, accountExportsTable, authAccountsTable, businessProfilesTable, organizationMembersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, cleanupAll, seedQuote, api } from "./harness.js";
import { advanceExport, cleanRow, planParts, runAccountExportMaintenance, toCsv, zipPathFor, PART_MAX_BYTES } from "../account/export.js";
import { encryptField } from "../lib/fieldCrypto.js";

const PASSWORD = "Segreta-e2e-123";
const DAY = 86_400_000;
const PRIVATE = process.env.SUPABASE_PRIVATE_BUCKET ?? "private-assets";

const bucket = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!).storage.from(PRIVATE);

async function withPassword(userId: string) {
  await db.insert(authAccountsTable).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: await hashPassword(PASSWORD) });
}

async function put(path: string, text: string, contentType = "application/pdf") {
  const { error } = await bucket().upload(path, Buffer.from(text), { contentType, upsert: true });
  if (error) throw error;
}

async function fetchZip(url: string) {
  const res = await fetch(url);
  expect(res.status).toBe(200);
  return unzipSync(new Uint8Array(await res.arrayBuffer()));
}

describe("pure helpers (GDPR-1)", () => {
  test("secrets hidden, document hashes kept, encrypted fields decrypted", () => {
    const row = cleanRow({
      iban: encryptField("IT60X0542811101000000123456"),
      secret: "whsec_x",
      webhook_secret: "enc1:zzz",
      token_hash: "abc",
      invite_token_hash: "abc",
      key_hash: "abc",
      api_key: "pk_live",
      refresh_token_enc: "enc",
      unsubscribe_token: "u",
      p256dh: "k",
      auth: "a",
      pdf_hash: "sha",
      xml_hash: "sha",
      total_tokens: 12,
      token_expires_at: "2026-01-01",
      name: "Mario",
      empty_secret: null,
    });
    expect(row.iban).toBe("IT60X0542811101000000123456");
    for (const k of ["secret", "webhook_secret", "token_hash", "invite_token_hash", "key_hash", "api_key", "refresh_token_enc", "unsubscribe_token", "p256dh", "auth"]) expect(row[k], k).toBe("[nascosto]");
    expect(row).toMatchObject({ pdf_hash: "sha", xml_hash: "sha", total_tokens: 12, token_expires_at: "2026-01-01", name: "Mario", empty_secret: null });
  });

  test("CSV for Italian Excel: BOM, semicolons, quoting, dates and JSON", () => {
    const csv = toCsv([{ a: "x;y", b: 'di "Rossi"', c: new Date("2026-09-28T10:00:00Z"), d: { k: 1 }, e: null }]);
    expect(csv.startsWith("﻿a;b;c;d;e\r\n")).toBe(true);
    expect(csv).toContain(`"x;y";"di ""Rossi""";2026-09-28T10:00:00.000Z;"{""k"":1}";`);
  });

  test("parts of at most 20 MB, an oversized file alone", () => {
    const f = (size: number, i: number) => ({ bucket: PRIVATE, path: `job-photos/u/${i}.jpg`, size });
    const mb = 1024 * 1024;
    const parts = planParts([f(8 * mb, 1), f(8 * mb, 2), f(8 * mb, 3), f(30 * mb, 4), f(1 * mb, 5)]);
    expect(parts.map((p) => p.map((x) => x.path.slice(-5)))).toEqual([["1.jpg", "2.jpg"], ["3.jpg"], ["4.jpg"], ["5.jpg"]]);
    expect(PART_MAX_BYTES).toBe(20 * mb);
    expect(zipPathFor({ bucket: PRIVATE, path: "quote-pdfs/u1/q/a.pdf", size: 1 }, "u1")).toBe("file/quote-pdfs/q/a.pdf");
    expect(zipPathFor({ bucket: "public-assets", path: "logos/u1/logo.png", size: 1 }, "u1")).toBe("file/pubblici/logos/logo.png");
  });
});

describe("account export (GDPR-1)", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("owner only, password, ZIP with data and files, once a day, no cross-tenant link", async () => {
    const owner = await createOrg({ companyName: "Esporta Srl" });
    await withPassword(owner.userId);
    await db.update(businessProfilesTable).set({ iban: encryptField("IT60X0542811101000000123456") }).where(eq(businessProfilesTable.userId, owner.userId));
    const member = await createUser({ name: "Membro" });
    await db.insert(organizationMembersTable).values({ ownerId: owner.userId, userId: member.userId, role: "office", status: "active", invitedEmail: member.email, invitedByUserId: owner.userId, joinedAt: new Date() });
    const other = await createOrg({ companyName: "Altra Srl" });
    await withPassword(other.userId);

    const quote = await seedQuote(owner.userId, { clientName: "Cliente Esportato" });
    const contract = await db.execute<{ id: string }>(sql`
      insert into contracts (user_id, contract_number, province, template_key, document, variables, status)
      values (${owner.userId}, 'C-2026-009', 'MI', 'appalto', '{}'::jsonb, '{}'::jsonb, 'signed') returning id`);
    await db.execute(sql`insert into contract_signers (contract_id, role, name, email, token_hash) values (${contract.rows[0]!.id}, 'client', 'Firmatario', 'f@example.invalid', 'segreto')`);
    await db.execute(sql`insert into webhook_endpoints (user_id, url, secret) values (${owner.userId}, 'https://example.invalid/hook', 'whsec_segreto')`);
    await put(`quote-pdfs/${owner.userId}/${quote.id}/preventivo.pdf`, "%PDF-1.4 preventivo");
    await put(`job-photos/${owner.userId}/cantiere/foto.jpg`, "JPEGDATA", "image/jpeg");
    await put(`quote-pdfs/${other.userId}/x/altro.pdf`, "%PDF altro");

    expect((await api("/api/account/export")).status).toBe(401);
    const s0 = await owner.api("/api/account/export");
    expect(s0.body).toMatchObject({ available: true, canExport: true, ttlDays: 7, nextAllowedAt: null, exports: [] });

    // A team member cannot export the company.
    expect((await member.api("/api/account/export")).body).toMatchObject({ available: true, canExport: false });
    expect((await member.api("/api/account/export", { body: { password: PASSWORD } })).status).toBe(403);

    expect((await owner.api("/api/account/export", { body: {} })).status).toBe(400);
    expect((await owner.api("/api/account/export", { body: { password: "sbagliata" } })).status).toBe(403);
    expect(await db.select().from(accountExportsTable).where(eq(accountExportsTable.userId, owner.userId))).toHaveLength(0);

    const r = await owner.api("/api/account/export", { body: { password: PASSWORD } });
    expect(r.status).toBe(201);
    expect(r.body.export).toMatchObject({ stato: "pronta", fileCount: 2, filesDone: 2, skippedFiles: [] });
    expect(r.body.export.parts.map((p: { kind: string }) => p.kind)).toEqual(["dati", "file"]);
    const id = r.body.export.id as string;

    // Once a day.
    const again = await owner.api("/api/account/export", { body: { password: PASSWORD } });
    expect(again.status).toBe(429);
    expect((await owner.api("/api/account/export")).body.nextAllowedAt).not.toBeNull();

    // Part 1: data.
    const l1 = await owner.api(`/api/account/export/${id}/parts/1`);
    expect(l1.status).toBe(200);
    const data = await fetchZip(l1.body.url);
    const names = Object.keys(data);
    expect(names).toEqual(expect.arrayContaining(["LEGGIMI.txt", "manifest.json", "elenco-file.csv", "dati/quotes.json", "fogli/quotes.csv", "dati/business_profiles.json", "dati/contract_signers.json", "dati/organization_members.json"]));
    for (const secret of ["auth_account", "auth_session", "two_factor", "account_exports", "automation_runs"]) expect(names).not.toContain(`dati/${secret}.json`);
    expect(JSON.parse(strFromU8(data["dati/quotes.json"]!))[0].id).toBe(quote.id);
    expect(JSON.parse(strFromU8(data["dati/business_profiles.json"]!))[0].iban).toBe("IT60X0542811101000000123456");
    expect(JSON.parse(strFromU8(data["dati/webhook_endpoints.json"]!))[0].secret).toBe("[nascosto]");
    expect(JSON.parse(strFromU8(data["dati/contract_signers.json"]!))[0]).toMatchObject({ name: "Firmatario", token_hash: "[nascosto]" });
    expect([...data["fogli/quotes.csv"]!.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM
    const manifest = JSON.parse(strFromU8(data["manifest.json"]!));
    expect(manifest).toMatchObject({ impresa: "Esporta Srl", parti: 2, file: 2 });
    expect(strFromU8(data["elenco-file.csv"]!)).toContain(`file/quote-pdfs/${quote.id}/preventivo.pdf;19;2`);
    // Nothing of the other company anywhere.
    expect(JSON.stringify(Object.values(data).map((u) => strFromU8(u)))).not.toContain(other.userId);

    // Part 2: the files, byte for byte.
    const files = await fetchZip((await owner.api(`/api/account/export/${id}/parts/2`)).body.url);
    expect(Object.keys(files).sort()).toEqual([`file/job-photos/cantiere/foto.jpg`, `file/quote-pdfs/${quote.id}/preventivo.pdf`]);
    expect(strFromU8(files[`file/quote-pdfs/${quote.id}/preventivo.pdf`]!)).toBe("%PDF-1.4 preventivo");

    // Downloads are audited; no link for other companies, members, bad ids or missing parts.
    const audit = await db.execute<{ n: number }>(sql`select count(*)::int as n from audit_log where user_id = ${owner.userId} and action in ('account.export_requested', 'account.export_downloaded')`);
    expect(audit.rows[0]!.n).toBe(3);
    expect((await other.api(`/api/account/export/${id}/parts/1`)).status).toBe(404);
    expect((await member.api(`/api/account/export/${id}/parts/1`)).status).toBe(404);
    expect((await owner.api(`/api/account/export/non-un-uuid/parts/1`)).status).toBe(404);
    expect((await owner.api(`/api/account/export/${id}/parts/3`)).status).toBe(404);
    expect((await other.api(`/api/account/export/${id}/continue`, { method: "POST" })).status).toBe(404);

    // Seven days later the cron removes the ZIPs.
    await db.update(accountExportsTable).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(accountExportsTable.id, id));
    const esito = await runAccountExportMaintenance();
    expect(esito.scadute).toBeGreaterThanOrEqual(1);
    const [expired] = await db.select().from(accountExportsTable).where(eq(accountExportsTable.id, id));
    expect(expired!.stato).toBe("scaduta");
    const { data: left } = await bucket().list(`account-exports/${owner.userId}/${id}`);
    expect(left ?? []).toHaveLength(0);
    expect((await owner.api(`/api/account/export/${id}/parts/1`)).status).toBe(404);
  });

  test("half-done export resumes from the open page; a vanished file is listed, not fatal; the lock holds", async () => {
    const owner = await createOrg({ companyName: "Ripresa Srl" });
    await put(`job-photos/${owner.userId}/a/uno.jpg`, "UNO", "image/jpeg");
    const [row] = await db.insert(accountExportsTable).values({ userId: owner.userId, requestedByUserId: owner.userId, email: owner.email }).returning();

    // No time left: only the data part gets done.
    const half = await advanceExport(row!.id, 0);
    expect(half!.stato).toBe("in_preparazione");
    expect(half!.parts).toHaveLength(1);
    expect(half!.pendingFiles).toHaveLength(1);
    const st = await owner.api("/api/account/export");
    expect(st.body.exports[0]).toMatchObject({ stato: "in_preparazione", fileCount: 1, filesDone: 0, parts: [] });

    // Someone else holds the lock: nothing moves.
    await db.update(accountExportsTable).set({ lockedUntil: new Date(Date.now() + 60_000), pendingFiles: [...half!.pendingFiles!, { bucket: PRIVATE, path: `job-photos/${owner.userId}/a/sparita.jpg`, size: 3 }] }).where(eq(accountExportsTable.id, row!.id));
    expect((await owner.api(`/api/account/export/${row!.id}/continue`, { method: "POST" })).body.export.stato).toBe("in_preparazione");

    await db.update(accountExportsTable).set({ lockedUntil: null }).where(eq(accountExportsTable.id, row!.id));
    const done = await owner.api(`/api/account/export/${row!.id}/continue`, { method: "POST" });
    expect(done.status).toBe(200);
    expect(done.body.export).toMatchObject({ stato: "pronta", skippedFiles: ["file/job-photos/a/sparita.jpg"] });
    expect(done.body.export.parts).toHaveLength(2);

    // A failed export does not block a new request for 24 hours; its files go after 7 days.
    await db.update(accountExportsTable).set({ stato: "errore" }).where(eq(accountExportsTable.id, row!.id));
    expect((await owner.api("/api/account/export")).body.nextAllowedAt).toBeNull();
    await db.update(accountExportsTable).set({ createdAt: new Date(Date.now() - 8 * DAY) }).where(eq(accountExportsTable.id, row!.id));
    await runAccountExportMaintenance();
    const [cleaned] = await db.select().from(accountExportsTable).where(eq(accountExportsTable.id, row!.id));
    expect(cleaned!.stato).toBe("errore");
    expect(cleaned!.expiredAt).not.toBeNull();
  });
});
