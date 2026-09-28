// APP-8c — whether a table a tool writes to exists yet (a migration the owner
// runs by hand). Once it exists it stays: "ready" is remembered for good, "not
// ready" is asked again after a minute.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const cache = new Map<string, { ready: boolean; at: number }>();

async function tableReady(table: string): Promise<boolean> {
  const hit = cache.get(table);
  if (hit && (hit.ready || Date.now() - hit.at < 60_000)) return hit.ready;
  let ready: boolean;
  try {
    const r = await db.execute<{ ready: boolean }>(sql`select to_regclass(${`public.${table}`}) is not null as ready`);
    ready = Boolean(r.rows[0]?.ready);
  } catch {
    ready = false;
  }
  cache.set(table, { ready, at: Date.now() });
  return ready;
}

/** Job notes (APP-4a) — migrations/v2/0011: until it runs, the assistant is not offered propose_job_note. */
export function jobNotesReady(): Promise<boolean> {
  return tableReady("job_notes");
}

