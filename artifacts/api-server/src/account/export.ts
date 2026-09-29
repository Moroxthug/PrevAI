import { zipSync, type Zippable } from "fflate";
import { and, desc, eq, gt, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db, accountExportsTable, authUsersTable, businessProfilesTable, type AccountExport, type AccountExportFile, type AccountExportPart } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { sendOpsAlert } from "../lib/ops.js";
import { decryptField, isEncryptedField } from "../lib/fieldCrypto.js";
import { DELETED_STORAGE, RETAINED_STORAGE } from "./deletion.js";
import { listFolder, listUserFiles, storageBuckets, storageClient, storageConfigured } from "./storageFiles.js";
import { sendExportReadyEmail } from "../lib/emailAccount.js";

// ── GDPR-1: "Scarica i tuoi dati" (art. 20 GDPR, docs/PIANO-AZIONE.md riga 46) ─
// Il titolare chiede l'esportazione da Impostazioni → Il tuo accesso (con la
// password). Ne esce uno ZIP diviso in parti:
//   parte 1 "dati": ogni tabella dell'impresa in JSON (dati/) e in CSV col
//     punto e virgola per Excel (fogli/), l'elenco dei file, LEGGIMI.txt;
//   parti 2…N "file": PDF, foto, ricevute, loghi, fatture elettroniche, così
//     come sono nello storage.
// Le parti stanno nel bucket privato sotto account-exports/<userId>/<id>/ (il
// bucket accetta file fino a 25 MB, da qui le parti da 20 MB) e si scaricano
// solo da dentro l'app con un link firmato di 5 minuti; l'email dice solo che
// è pronta. Dopo 7 giorni il cron le cancella.
//
// Una funzione Vercel vive 60 s: ogni passaggio (la richiesta, la pagina
// aperta che chiede "vai avanti", il cron) prepara parti finché ha tempo e
// lascia il resto al successivo. `locked_until` evita che due passaggi
// lavorino sulla stessa esportazione.
//
// Senza la migrazione 0017 tutto è inerte: la pagina rimanda a privacy@.

export const EXPORT_TTL_DAYS = 7;
export const EXPORT_COOLDOWN_HOURS = 24;
export const PART_MAX_BYTES = 20 * 1024 * 1024;
const MAX_ATTEMPTS = 3;
const LOCK_MS = 90_000;
const DAY = 86_400_000;

/** Cartelle dello storage che finiscono nello ZIP (tutte quelle dell'impresa, tranne le esportazioni stesse). */
export const EXPORT_FOLDERS = [...RETAINED_STORAGE, ...DELETED_STORAGE].filter((f) => f !== "account-exports");

/** Tabelle con `user_id` che non si esportano: credenziali e contabilità interna di PrevAI. */
export const SKIPPED_TABLES = new Set(["auth_account", "auth_session", "two_factor", "whatsapp_otp", "account_exports", "automation_runs", "ai_budgets", "rate_limit_counters"]);

/** Tabelle senza `user_id` che appartengono a una riga che ce l'ha: [tabella, colonna, tabella madre]. */
export const CHILD_TABLES: [string, string, string][] = [
  ["contract_signers", "contract_id", "contracts"],
  ["contract_events", "contract_id", "contracts"],
  ["invoice_events", "invoice_id", "invoices"],
  ["project_tasks", "project_id", "projects"],
  ["project_assignments", "project_id", "projects"],
  ["extra_costs", "project_id", "projects"],
  ["cost_budget_lines", "project_id", "projects"],
  ["accountant_share_accesses", "share_id", "accountant_shares"],
  ["webhook_deliveries", "webhook_id", "webhook_endpoints"],
];

/**
 * Colonne che non escono mai, nemmeno verso il titolare: password, token,
 * segreti, hash di token e OTP, chiavi API, token OAuth cifrati, chiavi push.
 * Gli hash dei documenti (pdf_hash, xml_hash, file_hash) invece restano: sono
 * l'impronta del documento, non un segreto.
 */
export const REDACTED_COLUMN = /(^|_)(secret|password|p256dh)$|^(auth|otp|token)$|_enc$|(token|key|otp)_hash$|api_key$|(access|refresh|id|unsubscribe)_token$/i;

const missingTable = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "42P01" || e?.cause?.code === "42P01";
};

let availableUntil = 0;
/** Vero dopo la migrazione 0017. Il "no" si ricontrolla ogni minuto, il "sì" resta. */
export async function exportAvailable(): Promise<boolean> {
  if (availableUntil === Infinity) return true;
  if (Date.now() < availableUntil) return false;
  try {
    await db.select({ id: accountExportsTable.id }).from(accountExportsTable).limit(1);
    availableUntil = Infinity;
    return true;
  } catch (err) {
    if (!missingTable(err)) throw err;
    availableUntil = Date.now() + 60_000;
    return false;
  }
}

// ── Righe → JSON e CSV ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

export function cleanRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined && v !== "" && REDACTED_COLUMN.test(k)) out[k] = "[nascosto]";
    else if (typeof v === "string" && isEncryptedField(v)) {
      // Campi cifrati a riposo (IBAN, credenziali SdI): al titolare vanno in chiaro.
      try {
        out[k] = decryptField(v);
      } catch {
        out[k] = "[cifrato]";
      }
    } else out[k] = v;
  }
  return out;
}

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV col punto e virgola e il BOM: Excel in italiano lo apre senza passare dall'importazione. */
export function toCsv(rows: Row[]): string {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [cols.join(";"), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(";"))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

async function tablesWithUserId(): Promise<string[]> {
  const r = await db.execute<{ table_name: string }>(sql`
    select c.table_name from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'user_id'
    order by c.table_name
  `);
  return r.rows.map((x) => x.table_name);
}

/** Ogni tabella dell'impresa: nome → righe già ripulite. */
export async function collectTables(userId: string): Promise<Map<string, Row[]>> {
  const out = new Map<string, Row[]>();
  const put = (name: string, rows: Row[]) => {
    if (rows.length) out.set(name, rows.map(cleanRow));
  };
  for (const table of await tablesWithUserId()) {
    if (SKIPPED_TABLES.has(table)) continue;
    // La squadra: le righe dell'impresa hanno owner_id; user_id è il membro.
    const where = table === "organization_members" ? sql`owner_id = ${userId}` : sql`user_id = ${userId}`;
    const r = await db.execute<Row>(sql`select * from ${sql.identifier(table)} where ${where}`);
    put(table, r.rows);
  }
  for (const [table, column, parent] of CHILD_TABLES) {
    try {
      const r = await db.execute<Row>(
        sql`select * from ${sql.identifier(table)} where ${sql.identifier(column)} in (select id from ${sql.identifier(parent)} where user_id = ${userId})`,
      );
      put(table, r.rows);
    } catch (err) {
      if (!missingTable(err)) throw err;
    }
  }
  return out;
}

// ── Richiesta ────────────────────────────────────────────────────────────────

/** Il titolare esporta l'impresa: serve una riga in business_profiles e agire come se stesso. */
export async function ownsCompany(userId: string): Promise<boolean> {
  const [p] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return Boolean(p);
}

/** Da quando si può chiedere la prossima (una ogni 24 ore; una fallita non conta). */
export async function nextExportAllowedAt(userId: string, now = new Date()): Promise<Date | null> {
  const [recent] = await db
    .select({ createdAt: accountExportsTable.createdAt })
    .from(accountExportsTable)
    .where(and(eq(accountExportsTable.userId, userId), ne(accountExportsTable.stato, "errore"), gt(accountExportsTable.createdAt, new Date(now.getTime() - EXPORT_COOLDOWN_HOURS * 3_600_000))))
    .orderBy(desc(accountExportsTable.createdAt))
    .limit(1);
  return recent ? new Date(recent.createdAt.getTime() + EXPORT_COOLDOWN_HOURS * 3_600_000) : null;
}

export async function createExport(p: { userId: string; requestedByUserId: string; email: string }): Promise<AccountExport> {
  const [row] = await db.insert(accountExportsTable).values(p).returning();
  return row!;
}

export async function listExports(userId: string, limit = 3): Promise<AccountExport[]> {
  return db.select().from(accountExportsTable).where(eq(accountExportsTable.userId, userId)).orderBy(desc(accountExportsTable.createdAt)).limit(limit);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un'esportazione dell'impresa (null se l'id non è suo o non è un uuid). */
export async function getExport(userId: string, exportId: string): Promise<AccountExport | null> {
  if (!UUID.test(exportId)) return null;
  const [row] = await db.select().from(accountExportsTable).where(and(eq(accountExportsTable.id, exportId), eq(accountExportsTable.userId, userId)));
  return row ?? null;
}

// ── Preparazione ─────────────────────────────────────────────────────────────

const folderOf = (row: Pick<AccountExport, "userId" | "id">) => `account-exports/${row.userId}/${row.id}`;
const privateBucket = () => storageBuckets()[0]!;
const STORED = /\.(jpe?g|png|gif|webp|heic|pdf|zip|p7m|mp4|mov)$/i;

async function upload(path: string, bytes: Uint8Array): Promise<void> {
  const { error } = await storageClient().storage.from(privateBucket()).upload(path, Buffer.from(bytes), { contentType: "application/zip", upsert: true });
  if (error) throw new Error(`Caricamento di ${path} non riuscito: ${error.message}`);
}

/** Dove sta un file dentro lo ZIP: `file/<cartella>/<resto>` senza l'id dell'impresa; i loghi pubblici a parte. */
export function zipPathFor(file: AccountExportFile, userId: string): string {
  const [folder, owner, ...rest] = file.path.split("/");
  const tail = owner === userId ? rest.join("/") : [owner, ...rest].join("/");
  const pub = file.bucket !== privateBucket();
  return `file/${pub ? "pubblici/" : ""}${folder}/${tail}`;
}

const readme = (p: { company: string; when: Date; tables: number; files: number; parts: number }) =>
  [
    `Dati di ${p.company} esportati da PrevAI il ${p.when.toLocaleString("it-IT", { timeZone: "Europe/Rome" })}.`,
    "",
    `Questa è la parte 1 di ${p.parts}.`,
    "",
    "dati/        una tabella per file, in JSON (formato leggibile da qualsiasi programma).",
    "fogli/       le stesse tabelle in CSV col punto e virgola: si aprono con Excel o LibreOffice.",
    "elenco-file.csv   tutti i file (PDF, foto, ricevute, fatture elettroniche) e in quale parte si trovano.",
    "manifest.json     quante righe per tabella e quanti file.",
    "",
    p.files ? `I ${p.files} file sono nelle parti da 2 a ${p.parts}, nella cartella file/, così come li hai caricati o come PrevAI li ha generati.` : "Non ci sono file.",
    "",
    "Password, codici di accesso, chiavi e token dei collegamenti non sono inclusi: al loro posto trovi [nascosto].",
    "Le date sono in UTC (formato ISO 8601). Gli importi sono in euro come li vedi nell'app.",
    "",
    "Diritto alla portabilità: art. 20 del Regolamento (UE) 2016/679 (GDPR). Domande: privacy@prevai.it",
  ].join("\n");

/** Raggruppa i file in parti da PART_MAX_BYTES (un file più grande fa parte da sé). */
export function planParts(files: AccountExportFile[]): AccountExportFile[][] {
  const parts: AccountExportFile[][] = [];
  let cur: AccountExportFile[] = [];
  let size = 0;
  for (const f of files) {
    if (cur.length && size + f.size > PART_MAX_BYTES) {
      parts.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(f);
    size += f.size;
  }
  if (cur.length) parts.push(cur);
  return parts;
}

/** Parte 1: le tabelle, l'elenco dei file e il LEGGIMI. Ritorna la lista dei file da impacchettare. */
async function buildDataPart(row: AccountExport): Promise<Partial<AccountExport>> {
  const enc = new TextEncoder();
  const tables = await collectTables(row.userId);
  const [user] = await db.select({ name: authUsersTable.name }).from(authUsersTable).where(eq(authUsersTable.id, row.userId));
  const [profile] = await db.select({ companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, row.userId));
  const company = profile?.companyName || user?.name || "la tua impresa";

  const listed = await listUserFiles(row.userId, EXPORT_FOLDERS);
  if (listed.errors.length) throw new Error(`Elenco dei file non riuscito: ${listed.errors.join("; ")}`);
  const files = listed.files.sort((a, b) => a.path.localeCompare(b.path));
  const plan = planParts(files);
  const totalParts = 1 + plan.length;

  const entries: Zippable = {};
  let rowCount = 0;
  const manifestTables: Record<string, number> = {};
  for (const [name, rows] of [...tables].sort(([a], [b]) => a.localeCompare(b))) {
    entries[`dati/${name}.json`] = enc.encode(JSON.stringify(rows, null, 2));
    entries[`fogli/${name}.csv`] = enc.encode(toCsv(rows));
    manifestTables[name] = rows.length;
    rowCount += rows.length;
  }
  const fileIndex = plan.flatMap((group, i) => group.map((f) => ({ file: zipPathFor(f, row.userId), bytes: f.size, parte: i + 2 })));
  entries["elenco-file.csv"] = enc.encode(toCsv(fileIndex));
  const now = new Date();
  entries["manifest.json"] = enc.encode(
    JSON.stringify({ esportatoIl: now.toISOString(), impresa: company, userId: row.userId, parti: totalParts, tabelle: manifestTables, righe: rowCount, file: files.length, byteFile: files.reduce((s, f) => s + f.size, 0) }, null, 2),
  );
  entries["LEGGIMI.txt"] = enc.encode(readme({ company, when: now, tables: tables.size, files: files.length, parts: totalParts }));

  const zipped = zipSync(entries, { level: 6 });
  if (zipped.byteLength > PART_MAX_BYTES + 4 * 1024 * 1024) {
    // Più di 24 MB di tabelle compresse non ci stanno nel bucket: serve una persona (RUNBOOKS §29).
    throw new Error(`Parte dati troppo grande (${zipped.byteLength} byte)`);
  }
  const path = `${folderOf(row)}/parte-01-dati.zip`;
  await upload(path, zipped);
  const part: AccountExportPart = { n: 1, kind: "dati", path, bytes: zipped.byteLength, files: 0 };
  return { parts: [part], pendingFiles: files, tableCount: tables.size, rowCount, fileCount: files.length, totalBytes: zipped.byteLength };
}

async function download(file: AccountExportFile): Promise<Uint8Array | null> {
  const { data, error } = await storageClient().storage.from(file.bucket).download(file.path);
  if (error || !data) return null; // sparito tra l'elenco e adesso
  return new Uint8Array(await data.arrayBuffer());
}

/** Una parte di file: scarica (4 alla volta), impacchetta, carica. */
async function buildFilePart(row: AccountExport, group: AccountExportFile[]): Promise<{ part: AccountExportPart | null; skipped: string[] }> {
  const entries: Zippable = {};
  const skipped: string[] = [];
  for (let i = 0; i < group.length; i += 4) {
    const slice = group.slice(i, i + 4);
    const got = await Promise.all(slice.map(download));
    slice.forEach((f, j) => {
      const bytes = got[j];
      if (!bytes) skipped.push(zipPathFor(f, row.userId));
      else entries[zipPathFor(f, row.userId)] = [bytes, { level: STORED.test(f.path) ? 0 : 6 }];
    });
  }
  const count = Object.keys(entries).length;
  if (!count) return { part: null, skipped };
  const n = row.parts.length + 1;
  const path = `${folderOf(row)}/parte-${String(n).padStart(2, "0")}-file.zip`;
  const zipped = zipSync(entries);
  try {
    await upload(path, zipped);
  } catch (err) {
    // Un file da solo più grande di quanto il bucket accetta: lo si segnala e si va avanti.
    if (group.length === 1) return { part: null, skipped: [...skipped, `${zipPathFor(group[0]!, row.userId)} (troppo grande)`] };
    throw err;
  }
  return { part: { n, kind: "file", path, bytes: zipped.byteLength, files: count }, skipped };
}

async function claim(id: string, now = new Date()): Promise<AccountExport | null> {
  const [row] = await db
    .update(accountExportsTable)
    .set({ lockedUntil: new Date(now.getTime() + LOCK_MS) })
    .where(and(eq(accountExportsTable.id, id), eq(accountExportsTable.stato, "in_preparazione"), or(isNull(accountExportsTable.lockedUntil), lt(accountExportsTable.lockedUntil, now))))
    .returning();
  return row ?? null;
}

async function save(id: string, patch: Partial<AccountExport>): Promise<AccountExport> {
  const [row] = await db
    .update(accountExportsTable)
    .set({ ...patch, lockedUntil: patch.lockedUntil === undefined ? new Date(Date.now() + LOCK_MS) : patch.lockedUntil })
    .where(eq(accountExportsTable.id, id))
    .returning();
  return row!;
}

/**
 * Porta avanti un'esportazione finché c'è tempo (`budgetMs`). Se qualcun altro
 * la sta già preparando, ritorna lo stato com'è. Non lancia: un errore resta
 * nella riga e il passaggio successivo riprova (3 volte, poi `errore`).
 */
export async function advanceExport(id: string, budgetMs = 40_000): Promise<AccountExport | null> {
  const deadline = Date.now() + budgetMs;
  let row = await claim(id);
  if (!row) {
    const [current] = await db.select().from(accountExportsTable).where(eq(accountExportsTable.id, id));
    return current ?? null;
  }
  try {
    if (row.pendingFiles === null) row = await save(row.id, await buildDataPart(row));
    // Ogni parte prende al massimo ~20 MB: se ne fa un'altra solo se restano almeno 15 s.
    while (row.pendingFiles?.length && Date.now() < deadline - 15_000) {
      const [group] = planParts(row.pendingFiles);
      const { part, skipped } = await buildFilePart(row, group!);
      row = await save(row.id, {
        parts: part ? [...row.parts, part] : row.parts,
        pendingFiles: row.pendingFiles.slice(group!.length),
        skippedFiles: [...row.skippedFiles, ...skipped],
        totalBytes: (row.totalBytes ?? 0) + (part?.bytes ?? 0),
      });
    }
    if (row.pendingFiles && row.pendingFiles.length === 0) {
      const now = new Date();
      row = await save(row.id, { stato: "pronta", pendingFiles: [], readyAt: now, expiresAt: new Date(now.getTime() + EXPORT_TTL_DAYS * DAY), lockedUntil: null, lastError: null });
      const [user] = await db.select({ name: authUsersTable.name }).from(authUsersTable).where(eq(authUsersTable.id, row.requestedByUserId));
      await sendExportReadyEmail({ to: row.email, name: user?.name ?? "", parts: row.parts.length, bytes: row.totalBytes ?? 0, expiresAt: row.expiresAt!, url: `${getBaseUrl()}/dashboard/settings/access` });
    } else {
      row = await save(row.id, { lockedUntil: null });
    }
    return row;
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
    const attempts = row.attempts + 1;
    logger.error({ err, exportId: row.id, attempts }, "Account export failed");
    const failed = attempts >= MAX_ATTEMPTS;
    const [saved] = await db
      .update(accountExportsTable)
      .set({ attempts, lastError: message, lockedUntil: null, ...(failed ? { stato: "errore" as const } : {}) })
      .where(eq(accountExportsTable.id, row.id))
      .returning();
    if (failed) await sendOpsAlert("Esportazione dei dati non riuscita", [`Esportazione ${row.id} (impresa ${row.userId}), ${attempts} tentativi.`, message, "Vedi docs/RUNBOOKS.md §29."]);
    return saved ?? row;
  }
}

// ── Scaricamento ─────────────────────────────────────────────────────────────

export const partFileName = (row: Pick<AccountExport, "createdAt" | "parts">, n: number) =>
  `prevai-dati-${row.createdAt.toISOString().slice(0, 10)}-parte-${n}-di-${row.parts.length}.zip`;

/** Link firmato di 5 minuti a una parte di un'esportazione pronta dell'impresa. */
export async function partDownloadUrl(userId: string, exportId: string, n: number, now = new Date()): Promise<string | null> {
  const row = await getExport(userId, exportId);
  if (!row || row.stato !== "pronta" || !row.expiresAt || row.expiresAt <= now) return null;
  const part = row.parts.find((p) => p.n === n);
  if (!part) return null;
  const { data, error } = await storageClient().storage.from(privateBucket()).createSignedUrl(part.path, 300, { download: partFileName(row, n) });
  if (error || !data) throw new Error(`Link non creato: ${error?.message}`);
  return data.signedUrl;
}

// ── Cron ─────────────────────────────────────────────────────────────────────

async function removeFiles(row: AccountExport): Promise<void> {
  const supabase = storageClient();
  const paths = (await listFolder(supabase, privateBucket(), folderOf(row))).map((f) => f.path);
  if (paths.length) {
    const { error } = await supabase.storage.from(privateBucket()).remove(paths);
    if (error) throw error;
  }
}

export type EsitoEsportazioni = { skipped?: "migrazione_0017_mancante" | "storage_non_configurato"; avanzate: number; pronte: number; scadute: number; errori: number };

/**
 * Nel tick del cron: porta avanti le esportazioni rimaste a metà (nessuno ha
 * tenuto la pagina aperta), poi cancella gli ZIP scaduti e quelli falliti da
 * più di 7 giorni.
 */
export async function runAccountExportMaintenance(now = new Date(), budgetMs = 40_000): Promise<EsitoEsportazioni> {
  const esito: EsitoEsportazioni = { avanzate: 0, pronte: 0, scadute: 0, errori: 0 };
  if (!(await exportAvailable())) return { ...esito, skipped: "migrazione_0017_mancante" };
  if (!storageConfigured()) return { ...esito, skipped: "storage_non_configurato" };
  const deadline = Date.now() + budgetMs;

  const open = await db
    .select({ id: accountExportsTable.id })
    .from(accountExportsTable)
    .where(and(eq(accountExportsTable.stato, "in_preparazione"), or(isNull(accountExportsTable.lockedUntil), lt(accountExportsTable.lockedUntil, now))))
    .orderBy(accountExportsTable.createdAt);
  for (const { id } of open) {
    const left = deadline - Date.now();
    if (left < 20_000) break;
    const row = await advanceExport(id, left);
    esito.avanzate++;
    if (row?.stato === "pronta") esito.pronte++;
    if (row?.stato === "errore") esito.errori++;
  }

  const stale = await db
    .select()
    .from(accountExportsTable)
    .where(
      and(
        isNull(accountExportsTable.expiredAt),
        or(
          and(eq(accountExportsTable.stato, "pronta"), lte(accountExportsTable.expiresAt, now)),
          and(inArray(accountExportsTable.stato, ["errore", "in_preparazione"]), lte(accountExportsTable.createdAt, new Date(now.getTime() - EXPORT_TTL_DAYS * DAY))),
        ),
      ),
    );
  for (const row of stale) {
    try {
      await removeFiles(row);
      await db
        .update(accountExportsTable)
        .set({ stato: row.stato === "pronta" ? "scaduta" : "errore", expiredAt: now, pendingFiles: null, lockedUntil: null })
        .where(eq(accountExportsTable.id, row.id));
      esito.scadute++;
    } catch (err) {
      esito.errori++;
      logger.error({ err, exportId: row.id }, "Expired account export not removed");
    }
  }
  return esito;
}
