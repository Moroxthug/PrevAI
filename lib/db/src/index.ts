import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Supabase's pooler needs TLS; a local Postgres (the V2-3 staging rehearsal)
// refuses it. `?sslmode=disable` in DATABASE_URL turns it off; anything else
// keeps the previous behaviour.
const sslMode = new URL(process.env.DATABASE_URL).searchParams.get("sslmode");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslMode === "disable" ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 3,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
