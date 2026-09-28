import { createHash } from "node:crypto";
import { MemoryStore, type ClientRateLimitInfo, type Options, type Store } from "express-rate-limit";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { tableReady } from "../assistant/ready.js";
import { logger } from "./logger.js";

// ── SEC-2: rate-limit counters shared by every instance ─────────────────────
// express-rate-limit's MemoryStore lives in one serverless instance: a cold
// start reset every limit and N warm instances meant N times the budget. This
// store counts on one Postgres row per bucket (fixed window, one atomic
// upsert per request). Until migration 0015 has run, or if the database
// errors, it falls back to the old per-instance memory counter — a limit that
// works a bit worse is better than a request that fails.

const TABLE = "rate_limit_counters";
let warned = false;

/** Keys can carry a public widget key or an API token: store a digest, not the value. */
export function bucketPart(value: string): string {
  return value.length <= 64 && /^[\w.:@-]+$/.test(value) ? value : `h${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

function useMemoryOnly(): boolean {
  return process.env.RATE_LIMIT_STORE === "memory";
}

export class SharedRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = 60_000;
  private readonly memory = new MemoryStore();

  constructor(name: string) {
    this.prefix = `${name}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.memory.init(options);
  }

  private async shared(): Promise<boolean> {
    return !useMemoryOnly() && (await tableReady(TABLE));
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    if (!(await this.shared())) return this.memory.get(key);
    try {
      const r = await db.execute<{ hits: number; reset_at: Date | string }>(
        sql`select hits, reset_at from rate_limit_counters where key = ${this.prefix + key} and reset_at > now()`,
      );
      const row = r.rows[0];
      return row ? { totalHits: Number(row.hits), resetTime: new Date(row.reset_at) } : undefined;
    } catch (err) {
      this.warn(err);
      return this.memory.get(key);
    }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    if (!(await this.shared())) return this.memory.increment(key);
    try {
      const r = await db.execute<{ hits: number; reset_at: Date | string }>(sql`
        insert into rate_limit_counters (key, hits, reset_at)
        values (${this.prefix + key}, 1, now() + ${this.windowMs}::int * interval '1 millisecond')
        on conflict (key) do update set
          hits = case when rate_limit_counters.reset_at <= now() then 1 else rate_limit_counters.hits + 1 end,
          reset_at = case when rate_limit_counters.reset_at <= now() then excluded.reset_at else rate_limit_counters.reset_at end
        returning hits, reset_at
      `);
      const row = r.rows[0]!;
      if (Math.random() < 0.005) void sweepExpiredCounters();
      return { totalHits: Number(row.hits), resetTime: new Date(row.reset_at) };
    } catch (err) {
      this.warn(err);
      return this.memory.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    if (!(await this.shared())) return this.memory.decrement(key);
    try {
      await db.execute(sql`update rate_limit_counters set hits = greatest(hits - 1, 0) where key = ${this.prefix + key}`);
    } catch (err) {
      this.warn(err);
    }
  }

  async resetKey(key: string): Promise<void> {
    this.memory.resetKey(key);
    if (!(await this.shared())) return;
    try {
      await db.execute(sql`delete from rate_limit_counters where key = ${this.prefix + key}`);
    } catch (err) {
      this.warn(err);
    }
  }

  shutdown(): void {
    this.memory.shutdown();
  }

  private warn(err: unknown): void {
    if (warned) return;
    warned = true;
    logger.warn({ err }, "Shared rate-limit store unavailable, using the per-instance counter");
  }
}

/** Drops windows that ended more than an hour ago. Runs on ~1 increment in 200 and from the daily cron. */
export async function sweepExpiredCounters(): Promise<number> {
  try {
    if (!(await tableReady(TABLE))) return 0;
    const r = await db.execute(sql`delete from rate_limit_counters where reset_at < now() - interval '1 hour'`);
    return r.rowCount ?? 0;
  } catch {
    return 0;
  }
}
